import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { enableShadows } from './utils.js';

const YAW = -Math.PI / 2;
const MODELS = {
  bee:     { url: new URL('../assets/bee.glb', import.meta.url), yaw: YAW },
  hornet:  { url: new URL('../assets/hornet.glb', import.meta.url), yaw: YAW },
  ladybug: { url: new URL('../assets/ladybug.glb', import.meta.url), yaw: YAW },
  queen:   { url: new URL('../assets/queen.glb', import.meta.url), yaw: YAW },
  worker:  { url: new URL('../assets/worker.glb', import.meta.url), yaw: YAW },
  baby:    { url: new URL('../assets/baby.glb', import.meta.url), yaw: YAW },
  anthole: { url: new URL('../assets/anthole.glb', import.meta.url), yaw: YAW },
  hornetmissile: { url: new URL('../assets/hornetmissile.glb', import.meta.url), yaw: -YAW },
};

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();

export function hasMobModel(type) {
  return type in MODELS;
}

function loadModel(type) {
  let promise = cache.get(type);
  if (!promise) {
    const def = MODELS[type];
    promise = loader.loadAsync(def.url.href).then((gltf) => {
      const inner = gltf.scene;
      inner.rotation.y = def.yaw;
      const template = new THREE.Group();
      template.add(inner);
      template.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(template);
      const center = box.getCenter(new THREE.Vector3());
      inner.position.x -= center.x;
      inner.position.z -= center.z;
      inner.position.y -= box.min.y;
      const size = box.getSize(new THREE.Vector3());
      enableShadows(template, { cast: true, receive: true });
      return { template, footprint: (size.x + size.z) / 4, height: size.y };
    });
    cache.set(type, promise);
  }
  return promise;
}

export function preloadMobModels(types) {
  for (const type of types) if (hasMobModel(type)) loadModel(type);
}

export function swapInMobModel(group, type, radius, decorate, { centerY = false } = {}) {
  loadModel(type).then(({ template, footprint, height }) => {
    if (group.userData.modelSwapped) return;
    group.userData.modelSwapped = true;
    for (const child of [...group.children]) group.remove(child);
    const inst = template.clone();
    inst.traverse((o) => {
      if (o.isMesh) o.material = o.material.clone();
    });
    const s = radius / footprint;
    inst.scale.setScalar(s);
    inst.position.y = centerY ? -height * s / 2 : 0.04;
    group.add(inst);
    decorate?.(group, inst, radius);
  }).catch((err) => {
    console.warn(`mob model ${type} failed to load — keeping placeholder`, err);
  });
}
