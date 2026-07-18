import * as THREE from 'three';
import { stripNonAscii } from '../../shared/config.js';

export function damp(k, dt) { return 1 - Math.exp(-k * dt); }

export function restrictToAscii(input, maxLen) {
  if (maxLen) input.maxLength = maxLen;
  input.addEventListener('input', () => {
    const filtered = stripNonAscii(input.value);
    if (filtered !== input.value) input.value = filtered;
  });
}

export function toonMat(color) {
  return new THREE.MeshToonMaterial({ color });
}

export function addOutline(mesh, thickness = 0.12, color = null) {
  const c = color
    ? new THREE.Color(color)
    : mesh.material.color.clone().multiplyScalar(0.62);
  const outline = new THREE.Mesh(
    mesh.geometry,
    new THREE.MeshBasicMaterial({ color: c, side: THREE.BackSide })
  );
  outline.scale.setScalar(1 + thickness);
  outline.userData.isOutline = true;
  mesh.add(outline);
  return outline;
}

export function enableShadows(root, { cast = true, receive = false } = {}) {
  root.traverse((obj) => {
    if (!obj.isMesh || obj.userData.isOutline) return;
    if (cast) obj.castShadow = true;
    if (receive) obj.receiveShadow = true;
  });
}

export function makeRockGeometry(radius, jitter = 0.16) {
  const geo = new THREE.IcosahedronGeometry(radius, 0);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const seen = new Map();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    if (!seen.has(key)) seen.set(key, 1 + (Math.random() * 2 - 1) * jitter);
    v.multiplyScalar(seen.get(key));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

export function flashMaterials(root, duration = 0.12) {
  root.userData.flashUntil = performance.now() + duration * 1000;
  root.traverse((obj) => {
    if (obj.isMesh && obj.material && obj.material.emissive !== undefined) {
      if (obj.material.userData.baseEmissive === undefined) {
        obj.material.userData.baseEmissive = obj.material.emissive.getHex();
      }
      obj.material.emissive.setScalar(0.55);
    }
  });
}

export function updateFlash(root) {
  if (!root.userData.flashUntil) return;
  if (performance.now() > root.userData.flashUntil) {
    root.traverse((obj) => {
      if (obj.isMesh && obj.material && obj.material.emissive !== undefined) {
        obj.material.emissive.setHex(obj.material.userData.baseEmissive ?? 0);
      }
    });
    delete root.userData.flashUntil;
  }
}

export function disposeMaterials(root) {
  const seen = new Set();
  root.traverse((obj) => {
    if (!obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      if (seen.has(m)) continue;
      seen.add(m);
      m.dispose();
    }
  });
}

export function disposeObject3D(root) {
  disposeMaterials(root);
  const seenGeo = new Set();
  root.traverse((obj) => {
    if (obj.geometry && !seenGeo.has(obj.geometry)) {
      seenGeo.add(obj.geometry);
      obj.geometry.dispose();
    }
  });
}
