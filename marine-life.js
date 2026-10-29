import * as THREE from './assets/vendor/three.module.js';

export const ANIMAL_ORDER=['dolphin','whale','shark'];
const SLOT=12,ACTIVE=10;
export function animalAtTime(seconds){
  const elapsed=Math.max(0,seconds)+2,slot=Math.floor(elapsed/SLOT),local=elapsed%SLOT;
  return {kind:ANIMAL_ORDER[slot%ANIMAL_ORDER.length],key:slot,progress:Math.min(local/ACTIVE,1),visible:local<ACTIVE};
}

function shape(parent,geometry,color,x=0,y=0,z=0){
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color}));
  mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}
function ellipsoid(parent,x,y,z,sx,sy,sz,color){
  const mesh=shape(parent,new THREE.SphereGeometry(1,12,8),color,x,y,z);mesh.scale.set(sx,sy,sz);return mesh;
}
function fin(parent,points,color){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));
  geometry.setIndex([0,1,2,2,1,0]);geometry.computeVertexNormals();
  return shape(parent,geometry,color);
}
function eyes(parent,x,y,z,r=.09){
  for(const side of [-1,1])ellipsoid(parent,x,y,side*z,r,r,r,'#172e38');
}
function flukes(parent,x,width,color){
  const tail=new THREE.Group();tail.position.x=x;parent.add(tail);
  fin(tail,[[.3,0,0],[-1.15,.04,-width],[-.6,.1,-.18]],color);
  fin(tail,[[.3,0,0],[-.6,.1,.18],[-1.15,.04,width]],color);
  return tail;
}
function dolphin(){
  const group=new THREE.Group(),color='#6a929e';
  ellipsoid(group,0,0,0,1.9,.58,.65,color);
  ellipsoid(group,.2,-.18,0,1.55,.39,.54,'#c8d9d5');
  ellipsoid(group,1.35,.1,0,.75,.49,.51,color);
  ellipsoid(group,2,.02,0,.67,.17,.23,'#82a3aa');
  ellipsoid(group,-1.85,-.05,0,.86,.21,.3,color);
  fin(group,[[-.65,.35,0],[.32,.4,0],[-.35,1.35,0]],'#557a87');
  for(const side of [-1,1])fin(group,[[.65,-.2,side*.35],[-.8,-.62,side*1.65],[-.38,-.24,side*.52]],'#557d89');
  eyes(group,1.63,.18,.43);
  return {group,tail:flukes(group,-2.35,1.2,'#5d8390')};
}
function whale(){
  const group=new THREE.Group(),color='#405c6a';
  ellipsoid(group,-.25,0,0,3.05,1.08,1.2,color);
  ellipsoid(group,1.75,.03,0,1.66,1.03,1.25,'#4f6c79');
  ellipsoid(group,.8,-.43,0,2.28,.65,1.04,'#a6bdbf');
  ellipsoid(group,-3,-.05,0,1.1,.31,.43,color);
  fin(group,[[-1.6,.8,0],[-.65,.8,0],[-1.35,1.45,0]],'#354f5e');
  for(const side of [-1,1])fin(group,[[1.1,-.4,side*.8],[-1.05,-.9,side*2.8],[-.4,-.45,side*1.1]],'#456473');
  eyes(group,2.32,.1,1.12,.12);
  return {group,tail:flukes(group,-3.5,2,'#3a5666')};
}
function shark(){
  const group=new THREE.Group(),color='#73919a';
  ellipsoid(group,0,0,0,2.3,.64,.72,color);
  ellipsoid(group,.4,-.23,0,1.9,.35,.58,'#cad5d0');
  const nose=shape(group,new THREE.ConeGeometry(.61,1.8,10),'#7e9ca3',2.05,0,0);nose.rotation.z=-Math.PI/2;
  ellipsoid(group,-2.1,0,0,.95,.23,.28,color);
  fin(group,[[-.85,.4,0],[.65,.4,0],[-.47,2.1,0]],'#557783');
  for(const side of [-1,1])fin(group,[[1,-.15,side*.45],[-1.15,-.45,side*2.1],[-.55,-.1,side*.6]],'#627f8b');
  const tail=new THREE.Group();tail.position.x=-2.8;group.add(tail);
  fin(tail,[[.35,0,0],[-1.05,1.55,0],[-.65,.2,0]],'#587986');
  fin(tail,[[.35,0,0],[-.65,-.2,0],[-.8,-.95,0]],'#627f8b');
  eyes(group,1.88,.13,.48,.09);
  return {group,tail};
}

function routeSample(points,t){
  const lengths=points.slice(1).map((p,i)=>Math.hypot(p.x-points[i].x,p.z-points[i].z));
  let distance=lengths.reduce((a,b)=>a+b,0)*t;
  for(let i=0;i<lengths.length;i++){
    if(distance<=lengths[i]||i===lengths.length-1){
      const a=points[i],b=points[i+1],u=lengths[i]?Math.min(1,distance/lengths[i]):0;
      return {x:a.x+(b.x-a.x)*u,z:a.z+(b.z-a.z)*u,heading:Math.atan2(b.z-a.z,b.x-a.x)};
    }
    distance-=lengths[i];
  }
}

export function createMarineLife(navigation){
  const animals={dolphin:dolphin(),whale:whale(),shark:shark()};
  const from={x:-7,z:-24},to={x:1,z:-3};
  const path=navigation.planRoute(from,to),reverse=[...path].reverse();
  return {update(time,shipPosition){
    const moment=animalAtTime(time);
    if(!moment.visible||path.length<2)return {...moment,group:null};
    const animal=animals[moment.kind],p=routeSample(moment.kind==='whale'?reverse:path,moment.progress);
    // Wildlife dives out of view if the visitor steers into its channel.
    if(Math.hypot(shipPosition.x-p.x,shipPosition.z-p.z)<8)return {...moment,group:null};
    const leap=moment.kind==='dolphin'?Math.max(0,Math.sin(moment.progress*Math.PI*4)):0;
    const edge=Math.min(1,moment.progress*9,(1-moment.progress)*9);
    const depth=moment.kind==='dolphin'?.05+leap*1.65:moment.kind==='whale'?-.27+Math.sin(time*1.5)*.08:-.72;
    animal.group.position.set(p.x,depth-(1-edge)*1.7,p.z);
    animal.group.rotation.set(0,-p.heading,moment.kind==='dolphin'?Math.cos(moment.progress*Math.PI*4)*.3:Math.sin(time)*.025);
    animal.tail.rotation.x=moment.kind==='shark'?0:Math.sin(time*(moment.kind==='dolphin'?5:2))*.32;
    animal.tail.rotation.y=moment.kind==='shark'?Math.sin(time*4)*.36:0;
    return {...moment,group:animal.group,position:p,edge,leap};
  }};
}

// Designed calls use Web Audio synthesis, so playback is local and needs no
// remote media. Shark audio is water movement and a splash rather than a call.
export function createMarineSound(context){
  const voices=new Set();
  function track(source){voices.add(source);source.onended=()=>{voices.delete(source);source.disconnect()};return source;}
  function tone(at,duration,frequencies,level,type='sine'){
    const source=track(context.createOscillator()),gain=context.createGain();source.type=type;
    source.frequency.setValueAtTime(frequencies[0],at);
    frequencies.slice(1).forEach((f,i)=>source.frequency.exponentialRampToValueAtTime(f,at+duration*(i+1)/(frequencies.length-1)));
    gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(level,at+.08);
    gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
    source.connect(gain).connect(context.destination);source.start(at);source.stop(at+duration+.02);
  }
  function water(at,duration,level,frequency=1000){
    const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate),data=buffer.getChannelData(0);
    let previous=0;
    for(let i=0;i<data.length;i++){previous=(previous+(Math.random()*2-1)*.5)/1.25;data[i]=previous;}
    const source=track(context.createBufferSource()),filter=context.createBiquadFilter(),gain=context.createGain();
    source.buffer=buffer;filter.type='lowpass';filter.frequency.value=frequency;
    gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(level,at+Math.min(.14,duration*.2));
    gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
    source.connect(filter).connect(gain).connect(context.destination);source.start(at);source.stop(at+duration);
  }
  return {
    play(kind){
      const at=context.currentTime+.025;
      if(kind==='dolphin'){
        tone(at,.65,[1400,2700,1700],.045);tone(at+.85,.55,[2100,1300,2500],.035);
        for(const t of [.15,.26,.38,1.1,1.22])water(at+t,.035,.12,4200);
        water(at+1.6,.7,.12,1600);
      }else if(kind==='whale'){
        tone(at,3.5,[130,74,115],.12);tone(at+.2,3.3,[196,112,175],.045);
        water(at+1.1,1,.1,750);
      }else{
        water(at,2,.18,650);water(at+.8,.65,.15,1700);
      }
    },
    stop(){for(const source of voices){try{source.stop()}catch{}source.disconnect()}voices.clear();}
  };
}
