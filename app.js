(() => {
  'use strict';
  const videos = [...document.querySelectorAll('video[data-start]')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const motionButton = document.querySelector('.motion-control');
  const motionStatus = document.querySelector('#motion-status');
  let loopsPaused = reducedMotion.matches;
  let sharedSource;
  let sourcePromise;
  let figureWasPlaying = [];
  const states = new Map(videos.map(video => [video, { visible: false, ready: false, loading: false, manualPause: false, expectedPause: false }]));

  function getSource() {
    if (!sourcePromise) {
      sourcePromise = fetch('assets/sail-safe.mp4', { cache: 'force-cache' })
        .then(response => { if (!response.ok) throw new Error('Footage unavailable'); return response.blob(); })
        .then(blob => { sharedSource = URL.createObjectURL(blob); return sharedSource; })
        .catch(error => { sourcePromise = undefined; throw error; });
    }
    return sourcePromise;
  }

  function shouldPlay(video) {
    const state = states.get(video);
    return state.visible && state.ready && !loopsPaused && !document.hidden && !document.body.classList.contains('dialog-open') && !state.manualPause;
  }

  function pause(video) {
    if (!video.paused) { states.get(video).expectedPause = true; video.pause(); }
  }

  function sync(video) {
    if (shouldPlay(video)) video.play().catch(() => {});
    else pause(video);
  }

  async function prepare(video) {
    const state = states.get(video);
    if (state.loading || state.ready) return;
    state.loading = true;
    try {
      const url = await getSource();
      await new Promise((resolve, reject) => {
        const loaded = () => { cleanup(); resolve(); };
        const failed = () => { cleanup(); reject(new Error('Playback unavailable')); };
        const cleanup = () => { video.removeEventListener('loadedmetadata', loaded); video.removeEventListener('error', failed); };
        video.addEventListener('loadedmetadata', loaded, { once: true });
        video.addEventListener('error', failed, { once: true });
        video.src = url;
        video.preload = 'auto';
        video.load();
      });
      video.currentTime = Number(video.dataset.start);
      state.ready = true;
      video.closest('.media-frame').classList.remove('media-failed');
      const error = video.closest('.media-frame').querySelector('.media-error');
      if (error) error.hidden = true;
      sync(video);
    } catch {
      video.closest('.media-frame').classList.add('media-failed');
      const error = video.closest('.media-frame').querySelector('.media-error');
      if (error) error.hidden = false;
    } finally { state.loading = false; }
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const video = entry.target;
      const state = states.get(video);
      state.visible = entry.isIntersecting;
      if (state.visible) prepare(video);
      sync(video);
    });
  }, { threshold: 0.05 });

  videos.forEach(video => {
    video.muted = true;
    // Autoplay is coordinated by visibility, rather than by the HTML attribute.
    video.autoplay = false;
    observer.observe(video);
    video.addEventListener('timeupdate', () => {
      const end = Number(video.dataset.end);
      const start = Number(video.dataset.start);
      if (!video.dataset.full && (video.currentTime >= end || video.currentTime < start - 0.25)) video.currentTime = start;
    });
    video.addEventListener('ended', () => {
      video.currentTime = Number(video.dataset.start);
      sync(video);
    });
    if (video.dataset.full) {
      video.addEventListener('pause', () => {
        const state = states.get(video);
        if (state.expectedPause) state.expectedPause = false;
        else if (state.visible && !video.ended && state.ready && !loopsPaused && !document.hidden) state.manualPause = true;
      });
      video.addEventListener('play', () => { states.get(video).manualPause = false; });
    }
  });

  function updateMotionButton() {
    motionButton.textContent = loopsPaused ? 'Resume motion' : 'Pause motion';
    motionButton.setAttribute('aria-pressed', String(loopsPaused));
    document.dispatchEvent(new CustomEvent('scene-motion', { detail: { paused: loopsPaused } }));
  }
  updateMotionButton();
  motionButton.addEventListener('click', () => {
    loopsPaused = !loopsPaused;
    updateMotionButton();
    motionStatus.textContent = loopsPaused ? 'Motion paused.' : 'Visible motion playing.';
    videos.forEach(sync);
  });
  reducedMotion.addEventListener('change', event => {
    loopsPaused = event.matches;
    updateMotionButton();
    videos.forEach(sync);
  });
  document.addEventListener('visibilitychange', () => videos.forEach(sync));
  document.querySelectorAll('.retry-media').forEach(button => button.addEventListener('click', () => videos.filter(video => states.get(video).visible).forEach(prepare)));
  window.addEventListener('pagehide', event => { if (!event.persisted) { videos.forEach(pause); if (sharedSource) URL.revokeObjectURL(sharedSource); } });

  document.querySelectorAll('.dossier-details').forEach(details => {
    details.addEventListener('toggle', () => {
      const label = details.querySelector('.details-action');
      const isSource = details.classList.contains('source-details');
      label.textContent = details.open ? (isSource ? 'Close notes' : 'Close table') : (isSource ? 'Open notes' : 'Open table');
    });
  });

  const dialog = document.querySelector('.figure-dialog');
  const dialogImage = dialog.querySelector('img');
  const dialogVideo = dialog.querySelector('.gallery-video');
  const dialogCaption = dialog.querySelector('.dialog-caption');
  const counter = dialog.querySelector('.gallery-counter');
  const media = [...document.querySelectorAll('.figure-open, video[data-start]')].map(element => ({ element, kind: element.tagName === 'VIDEO' ? 'video' : 'image' }));
  let currentIndex = 0;
  let lastMediaButton;
  let galleryRequest = 0;

  async function showMedia(index) {
    currentIndex = (index + media.length) % media.length;
    const entry = media[currentIndex];
    const request = ++galleryRequest;
    dialogVideo.pause();
    dialogCaption.hidden = true;
    dialogImage.hidden = entry.kind !== 'image';
    dialogVideo.hidden = entry.kind !== 'video';
    counter.textContent = `${String(currentIndex + 1).padStart(2,'0')} / ${String(media.length).padStart(2,'0')}`;
    if (entry.kind === 'image') {
      dialogImage.src = entry.element.dataset.image;
      dialogImage.alt = entry.element.querySelector('img').alt;
    } else {
      const source = await getSource();
      if (request !== galleryRequest || !dialog.open) return;
      dialogVideo.dataset.clipStart = entry.element.dataset.start;
      dialogVideo.dataset.clipEnd = entry.element.dataset.end;
      if (dialogVideo.src !== source) {
        await new Promise(resolve => { dialogVideo.addEventListener('loadedmetadata', resolve, { once:true }); dialogVideo.src = source; dialogVideo.load(); });
      }
      if (request !== galleryRequest || !dialog.open) return;
      dialogVideo.currentTime = Number(entry.element.dataset.start);
      dialogVideo.play().catch(() => {});
    }
  }
  function openMedia(index, button) {
    lastMediaButton = button;
    figureWasPlaying = videos.filter(video => !video.paused);
    document.body.classList.add('dialog-open');
    videos.forEach(pause);
    dialog.showModal();
    showMedia(index).catch(() => { dialogCaption.hidden = false; dialogCaption.textContent = 'Footage could not load. Close the viewer and try again.'; });
  }
  media.forEach((entry,index) => {
    if (entry.kind === 'image') entry.element.addEventListener('click', () => openMedia(index,entry.element));
    else {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'media-expand'; button.textContent = 'View full screen';
      button.setAttribute('aria-label', 'Expand: ' + entry.element.getAttribute('aria-label'));
      entry.element.closest('.media-frame').append(button);
      button.addEventListener('click', () => openMedia(index,button));
    }
  });
  dialogVideo.addEventListener('timeupdate', () => {
    const start = Number(dialogVideo.dataset.clipStart || 0), end = Number(dialogVideo.dataset.clipEnd || 86.75);
    if (dialogVideo.currentTime >= end || dialogVideo.currentTime < start - .25) dialogVideo.currentTime = start;
  });
  dialogVideo.addEventListener('ended', () => { dialogVideo.currentTime = Number(dialogVideo.dataset.clipStart || 0); if(dialog.open) dialogVideo.play().catch(() => {}); });
  dialog.querySelector('.gallery-prev').addEventListener('click', () => showMedia(currentIndex - 1));
  dialog.querySelector('.gallery-next').addEventListener('click', () => showMedia(currentIndex + 1));
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => { if(event.target.tagName === 'VIDEO') return; if(event.key === 'ArrowLeft'){event.preventDefault();showMedia(currentIndex-1);} if(event.key === 'ArrowRight'){event.preventDefault();showMedia(currentIndex+1);} });
  dialog.addEventListener('click', event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } });
  dialog.addEventListener('close', () => {
    galleryRequest++;
    dialogVideo.pause();
    document.body.classList.remove('dialog-open');
    figureWasPlaying.forEach(sync);
    lastMediaButton?.focus({preventScroll:true});
  });
})();
