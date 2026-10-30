# Sail Safe

An interactive case-study website for an augmented reality maritime-navigation concept designed for Microsoft HoloLens 2.

## Features

- Interactive island navigation with water-only routes and collision-safe steering.
- Day and night views, optional sea audio and reduced-motion support.
- Original prototype footage with silent, on-screen video loops.
- Full-screen image and video gallery.
- Responsive layouts for desktop, tablet and mobile.

## Run locally

Serve the repository root with a static web server:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000` in a browser. Use a web server rather than opening `index.html` directly so the video loader and JavaScript modules work correctly.

## Project structure

- `index.html` — case-study content and page structure.
- `styles.css` — typography, layout and responsive styles.
- `app.js` — video playback, accessibility controls and media gallery.
- `voyage.js` — interactive sailing scene.
- `navigation.js` — routes, shoreline clearance and pier collision detection.
- `tests/` — navigation regression tests.
- `assets/` — original video, extracted figures, posters, fonts and bundled Three.js files.

All runtime assets are included locally. No build step or API key is required.

## Run checks

With Node.js installed, run:

```bash
node --test tests/*.test.mjs
```

## GitHub Pages

In the repository settings, open **Pages**, choose **Deploy from a branch**, then select **main** and **/(root)**. The `.nojekyll` file enables direct static-file publishing.

For another static host, publish this repository's root directory.

## Third-party software

Three.js is bundled under its MIT licence. Its licence is included at `assets/vendor/THREE-LICENSE.txt`. Inter Display is distributed under the SIL Open Font License; see `assets/INTER-LICENSE.txt`.
