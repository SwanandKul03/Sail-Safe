import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three.module.js';
import {animalAtTime,createMarineLife} from '../marine-life.js';
import {createWaterNavigation} from '../navigation.js';

test('dolphin, whale and shark appear in order and the sequence repeats',()=>{
  assert.deepEqual([0,10,22,34,46,58].map(t=>animalAtTime(t).kind),['dolphin','whale','shark','dolphin','whale','shark']);
  for(const t of [8,20,32])assert.equal(animalAtTime(t).visible,false);
  for(const t of [0,12,24,36])assert.equal(animalAtTime(t).visible,true);
});

test('the full animal models stay over water throughout their route',()=>{
  const marine=createMarineLife(createWaterNavigation()),water=createWaterNavigation({clearance:0});
  for(const t of [0,2,4,6,10,12,14,16,18,22,24,26,28,30,34,36]) {
    const state=marine.update(t,{x:3,z:8});
    if(!state.group)continue;
    state.group.updateMatrixWorld(true);
    state.group.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const vertices=mesh.geometry.attributes.position;
      for(let i=0;i<vertices.count;i++) {
        const point=new THREE.Vector3().fromBufferAttribute(vertices,i).applyMatrix4(mesh.matrixWorld);
        assert(water.isWater(point),`${state.kind} intersects the shore at ${t}s`);
      }
    });
  }
});

test('wildlife dives out of the way when the ship enters its channel',()=>{
  const marine=createMarineLife(createWaterNavigation());
  const state=marine.update(0,{x:3,z:8});
  assert(state.group);
  assert.equal(marine.update(0,state.position).group,null);
});
