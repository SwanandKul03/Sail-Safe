import test from 'node:test';
import assert from 'node:assert/strict';
import {createWaterNavigation,PORTS,sceneObstacles} from '../navigation.js';

test('routes detour around a thin pier even when both endpoints are water',()=>{
  const nav=createWaterNavigation({
    obstacles:[[{x:-.1,z:-6},{x:.1,z:-6},{x:.1,z:6},{x:-.1,z:6}]],
    clearance:1,bounds:{minX:-10,maxX:10,minZ:-10,maxZ:10}
  });
  const from={x:-5,z:0},to={x:5,z:0};
  assert(nav.isWater(from)&&nav.isWater(to));
  assert(!nav.segmentIsWater(from,to));
  const path=nav.planRoute(from,to);
  assert(path.length>2);
  assert(path.some(p=>Math.abs(p.z)>=7));
  assert.deepEqual(path.at(-1),to);
  assert(nav.move(from,{x:10,z:0}).x<-1.09);
});

test('all island destinations are reachable without crossing land or a pier',()=>{
  const nav=createWaterNavigation();
  const starts=[{x:3,z:8},...PORTS.map(p=>nav.nearestWater(p.dock)),{x:-31,z:28},{x:31,z:-29},{x:-31,z:-29}];
  for(const from of starts)for(const port of PORTS)for(const to of [port.dock,port]) {
    const path=nav.planRoute(from,to);
    assert(path.length>=2,`${JSON.stringify(from)} to ${port.id}`);
    assert(nav.isWater(path.at(-1)));
    for(let i=1;i<path.length;i++)assert(nav.segmentIsWater(path[i-1],path[i]));
  }
});

test('manual steering stops before obstacles and cannot tunnel through them',()=>{
  const nav=createWaterNavigation(),from={x:3,z:8};
  for(const polygon of sceneObstacles()) {
    const point=polygon[0];
    const stop=nav.move(from,{x:(point.x-from.x)*3,z:(point.z-from.z)*3});
    assert(nav.isWater(stop));
    assert(nav.segmentIsWater(from,stop));
  }
  const stop=nav.move({x:32,z:0},{x:100,z:0});
  assert(stop.x<=33);
});

test('an impassable channel returns no route',()=>{
  const nav=createWaterNavigation({
    obstacles:[[{x:-1,z:-10},{x:1,z:-10},{x:1,z:10},{x:-1,z:10}]],
    clearance:1,bounds:{minX:-10,maxX:10,minZ:-10,maxZ:10}
  });
  assert.deepEqual(nav.planRoute({x:-5,z:0},{x:5,z:0}),[]);
});
