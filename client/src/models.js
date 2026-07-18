import * as THREE from 'three';
import { toonMat, addOutline, makeRockGeometry, enableShadows } from './utils.js';
import { hasMobModel, swapInMobModel } from './mobmodels.js';
import { PETAL_TYPES, RARITIES } from '../../shared/config.js';

const YELLOW = '#ffe763';
const BLACK = '#2b2b2b';

const GLASS_VARIANTS = 4;

const geoCache = new Map();
function sharedGeo(key, factory) {
  let geo = geoCache.get(key);
  if (!geo) {
    geo = factory();
    geoCache.set(key, geo);
  }
  return geo;
}

export function makeFlower(radius = 1.1) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 18), toonMat(YELLOW));
  addOutline(body, 0.1);
  group.add(body);

  const eyeGeo = new THREE.SphereGeometry(radius * 0.16, 12, 10);
  const eyeMat = toonMat(BLACK);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.scale.set(0.55, 1, 0.6);
    eye.position.set(sx * radius * 0.32, radius * 0.22, radius * 0.86);
    group.add(eye);
  }
  const mouth = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.28, radius * 0.05, 8, 20, Math.PI * 0.75),
    toonMat(BLACK)
  );
  mouth.rotation.z = Math.PI + (Math.PI - Math.PI * 0.75) / 2;
  mouth.position.set(0, -radius * 0.18, radius * 0.92);
  group.add(mouth);
  enableShadows(group, { cast: true, receive: true });
  return group;
}

export function attachFlowerWings(group, radius = 1.1) {
  const pivots = addHornetWings(group, radius * 1.3, radius * 0.5, -radius * 0.35, 0.65);
  for (const pivot of pivots) pivot.visible = false;
  group.userData.wingPivots = pivots;
  return pivots;
}

function makeRockMob(radius) {
  const group = new THREE.Group();
  const mat = toonMat('#77777f');
  mat.flatShading = true;
  const body = new THREE.Mesh(makeRockGeometry(radius), mat);
  addOutline(body, 0.1);
  body.position.y = radius * 0.8;
  body.rotation.y = Math.random() * Math.PI * 2;
  group.add(body);
  enableShadows(group, { cast: true, receive: true });
  return group;
}

function makeLadybugMob(radius) {
  const group = new THREE.Group();
  const lift = radius * 0.8;

  const shellGeo = sharedGeo(`ladybug-shell-${radius}`, () => new THREE.SphereGeometry(radius, 24, 18));
  const shell = new THREE.Mesh(shellGeo, toonMat('#d1291b'));
  shell.scale.set(1, 0.72, 1.08);
  addOutline(shell, 0.1);
  shell.position.y = lift;
  group.add(shell);

  const headGeo = sharedGeo(`ladybug-head-${radius}`, () => new THREE.SphereGeometry(radius * 0.45, 16, 12));
  const head = new THREE.Mesh(headGeo, toonMat(BLACK));
  head.position.set(0, lift * 0.75, radius * 0.95);
  group.add(head);

  const spotGeo = sharedGeo(`ladybug-spot-${radius}`, () => new THREE.SphereGeometry(radius * 0.22, 10, 8));
  const spotMat = toonMat(BLACK);
  const spots = [
    [0.45, 0.62, -0.25], [-0.5, 0.58, 0.15], [0.05, 0.68, -0.65],
  ];
  for (const [x, y, z] of spots) {
    const spot = new THREE.Mesh(spotGeo, spotMat);
    spot.scale.set(1, 0.45, 1);
    spot.position.set(x * radius, lift + y * radius * 0.72, z * radius);
    group.add(spot);
  }
  enableShadows(group, { cast: true, receive: true });
  return group;
}

function makeBeeMob(radius) {
  const group = new THREE.Group();
  const lift = radius * 0.8;
  const a = radius * 0.78;
  const c = radius * 1.18;

  const bodyGeo = sharedGeo('bee-body', () => new THREE.SphereGeometry(1, 24, 18));
  const body = new THREE.Mesh(bodyGeo, toonMat(YELLOW));
  body.scale.set(a, a * 0.95, c);
  addOutline(body, 0.1);
  body.position.y = lift;
  group.add(body);

  const stripeMat = toonMat(BLACK);
  const tube = radius * 0.15;
  for (const zFrac of [-0.45, 0.05, 0.5]) {
    const z = zFrac * c;
    const surfaceR = a * Math.sqrt(Math.max(0.05, 1 - (z / c) ** 2));
    const ringR = Math.max(0.05, surfaceR - tube * 0.9);
    const ringGeo = sharedGeo(`bee-ring-${radius}-${zFrac}`, () => new THREE.TorusGeometry(ringR, tube, 10, 28));
    const ring = new THREE.Mesh(ringGeo, stripeMat);
    ring.position.set(0, lift, z);
    group.add(ring);
  }

  const stingerGeo = sharedGeo(`bee-stinger-${radius}`, () => new THREE.ConeGeometry(radius * 0.28, radius * 0.7, 10));
  const stinger = new THREE.Mesh(stingerGeo, stripeMat);
  stinger.rotation.x = -Math.PI / 2;
  stinger.position.set(0, lift, -c - radius * 0.2);
  group.add(stinger);

  const antGeo = sharedGeo(`bee-ant-${radius}`, () => new THREE.CylinderGeometry(0.04, 0.04, radius * 0.65, 6));
  const antTipGeo = sharedGeo(`bee-anttip-${radius}`, () => new THREE.SphereGeometry(radius * 0.11, 8, 6));
  for (const sx of [-1, 1]) {
    const ant = new THREE.Mesh(antGeo, stripeMat);
    ant.rotation.x = 0.9;
    ant.rotation.z = -sx * 0.35;
    ant.position.set(sx * radius * 0.28, lift + a * 0.75, c * 0.75);
    group.add(ant);
    const tip = new THREE.Mesh(antTipGeo, stripeMat);
    tip.position.set(sx * radius * 0.42, lift + a * 0.95, c * 0.95);
    group.add(tip);
  }
  enableShadows(group, { cast: true, receive: true });
  return group;
}

const HORNET_YELLOW = '#ffd363';

function makeHornetMob(radius) {
  const group = new THREE.Group();
  const lift = radius * 0.8;
  const a = radius * 0.75;
  const c = radius * 1.3;

  const bodyGeo = sharedGeo('hornet-body', () => new THREE.SphereGeometry(1, 24, 18));
  const body = new THREE.Mesh(bodyGeo, toonMat(HORNET_YELLOW));
  body.scale.set(a, a * 0.9, c);
  addOutline(body, 0.12, '#c9962a');
  body.position.y = lift;
  group.add(body);

  const stripeMat = toonMat(BLACK);
  const tube = radius * 0.2;
  for (const zFrac of [-0.42, 0.08, 0.52]) {
    const z = zFrac * c;
    const surfaceR = a * Math.sqrt(Math.max(0.05, 1 - (z / c) ** 2));
    const ringR = Math.max(0.05, surfaceR - tube * 0.9);
    const ringGeo = sharedGeo(`hornet-ring-${radius}-${zFrac}`, () => new THREE.TorusGeometry(ringR, tube, 10, 28));
    const ring = new THREE.Mesh(ringGeo, stripeMat);
    ring.position.set(0, lift, z);
    group.add(ring);
  }

  const antGeo = sharedGeo(`hornet-ant-${radius}`, () => new THREE.CylinderGeometry(0.045, 0.045, radius * 0.75, 6));
  const antTipGeo = sharedGeo(`hornet-anttip-${radius}`, () => new THREE.SphereGeometry(radius * 0.1, 8, 6));
  for (const sx of [-1, 1]) {
    const ant = new THREE.Mesh(antGeo, stripeMat);
    ant.rotation.x = 0.95;
    ant.rotation.z = -sx * 0.4;
    ant.position.set(sx * radius * 0.3, lift + a * 0.7, c * 0.72);
    group.add(ant);
    const tip = new THREE.Mesh(antTipGeo, stripeMat);
    tip.position.set(sx * radius * 0.48, lift + a * 0.92, c * 0.92);
    group.add(tip);
  }

  const missileGeo = sharedGeo(`hornet-missile-${radius}`, () => new THREE.ConeGeometry(radius * 0.28, radius * 1.15, 10));
  const missile = new THREE.Mesh(missileGeo, stripeMat);
  missile.rotation.x = -Math.PI / 2;
  missile.position.set(0, lift, -c - radius * 0.35);
  group.add(missile);
  group.userData.missile = missile;

  enableShadows(group, { cast: true, receive: true });

  group.userData.wingPivots = addHornetWings(group, radius, lift + a * 0.85, c * 0.05);

  return group;
}

function addHornetWings(group, radius, y, z, sweep = 0.5) {
  const wingGeo = sharedGeo(`hornet-wing-${radius}`, () => {
    const geo = new THREE.CircleGeometry(1, 14);
    geo.translate(1, 0, 0);
    return geo;
  });
  const wingMat = new THREE.MeshBasicMaterial({
    color: '#dcecf5', transparent: true, opacity: 0.5,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const wingPivots = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * radius * 0.12, y, z);
    pivot.rotation.y = sx === 1 ? -sweep : Math.PI + sweep;
    const wing = new THREE.Mesh(wingGeo, wingMat);
    wing.rotation.x = -Math.PI / 2;
    wing.scale.set(radius * 0.85, radius * 0.36, 1);
    pivot.add(wing);
    group.add(pivot);
    wingPivots.push(pivot);
  }
  return wingPivots;
}

export function makeMissileMesh(radius) {
  const group = new THREE.Group();
  const cone = new THREE.Mesh(
    sharedGeo(`missile-${radius}`, () => new THREE.ConeGeometry(radius * 0.62, radius * 2.6, 10)),
    toonMat(BLACK)
  );
  cone.rotation.x = Math.PI / 2;
  addOutline(cone, 0.15, '#000000');
  group.add(cone);
  enableShadows(group, { cast: true, receive: false });
  swapInMobModel(group, 'hornetmissile', radius * 0.65, null, { centerY: true });
  return group;
}

const BAR_HEIGHT = 0.26;
const BAR_CANVAS_H = 48;

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function makeHealthBar(width, anisotropy = 1) {
  const height = BAR_HEIGHT;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(BAR_CANVAS_H * (width / height));
  canvas.height = BAR_CANVAS_H;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;

  const material = new THREE.MeshBasicMaterial({
    map: texture, transparent: true, depthTest: true, depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.renderOrder = 2;

  let lastGreen = -1, lastRed = -1;
  function draw(greenFrac, redFrac, force = false) {
    const g = Math.max(0, Math.min(1, greenFrac));
    const r = Math.max(0, Math.min(1, redFrac));
    if (!force && Math.abs(g - lastGreen) < 0.0008 && Math.abs(r - lastRed) < 0.0008) return;
    lastGreen = g;
    lastRed = r;

    const w = canvas.width, h = canvas.height;
    const pad = h * 0.12;
    ctx.clearRect(0, 0, w, h);

    roundRectPath(ctx, 0, 0, w, h, h / 2);
    ctx.fillStyle = 'rgba(26,26,26,0.75)';
    ctx.fill();

    const innerW = w - pad * 2, innerH = h - pad * 2;
    const pill = (frac, color) => {
      if (frac <= 0) return;
      roundRectPath(ctx, pad, pad, Math.max(innerH, innerW * frac), innerH, innerH / 2);
      ctx.fillStyle = color;
      ctx.fill();
    };
    pill(r, '#c22a1e');
    pill(g, '#78dd39');

    texture.needsUpdate = true;
  }

  draw(1, 1, true);
  return { mesh, texture, draw };
}

function makeAntMob(radius, color) {
  const group = new THREE.Group();
  const lift = radius * 0.5;
  const mat = toonMat(color);
  const segGeo = sharedGeo('ant-seg', () => new THREE.SphereGeometry(1, 16, 12));
  for (const [z, r] of [[0.85, 0.42], [0.15, 0.38], [-0.7, 0.58]]) {
    const seg = new THREE.Mesh(segGeo, mat);
    seg.scale.setScalar(r * radius);
    seg.position.set(0, lift, z * radius);
    group.add(seg);
  }
  enableShadows(group, { cast: true, receive: true });
  return group;
}

function makeAntholeMob(radius) {
  const group = new THREE.Group();
  const moundGeo = sharedGeo('anthole-mound', () => new THREE.SphereGeometry(1, 20, 14));
  const mound = new THREE.Mesh(moundGeo, toonMat('#9b6b3d'));
  mound.scale.set(radius, radius * 0.45, radius);
  group.add(mound);
  const holeGeo = sharedGeo('anthole-pit', () => new THREE.CircleGeometry(1, 16));
  const hole = new THREE.Mesh(holeGeo, toonMat('#241708'));
  hole.rotation.x = -Math.PI / 2;
  hole.scale.setScalar(radius * 0.4);
  hole.position.y = radius * 0.46;
  group.add(hole);
  enableShadows(group, { cast: true, receive: true });
  return group;
}

export function makeMobMesh(type, radius) {
  let group;
  if (type === 'rock') return makeRockMob(radius);
  else if (type === 'ladybug') group = makeLadybugMob(radius);
  else if (type === 'bee') group = makeBeeMob(radius);
  else if (type === 'hornet') group = makeHornetMob(radius);
  else if (type === 'soldier') group = makeAntMob(radius, '#a04a28');
  else if (type === 'worker') group = makeAntMob(radius, '#b5622f');
  else if (type === 'baby') group = makeAntMob(radius, '#d9a05e');
  else if (type === 'anthole') group = makeAntholeMob(radius);
  else throw new Error(`unknown mob type ${type}`);

  if (type === 'soldier') {
    swapInMobModel(group, 'worker', radius, (g, inst, r) => {
      const box = new THREE.Box3().setFromObject(inst);
      g.userData.wingPivots = addHornetWings(g, r, box.max.y * 0.85, (box.min.z + box.max.z) * 0.2, -1.0);
      g.userData.wingRate = 8;
      g.userData.wingAmp = 0.04;
    });
    return group;
  }

  if (hasMobModel(type)) {
    swapInMobModel(group, type, radius, (g, inst, r) => {
      if (type !== 'hornet') return;
      const box = new THREE.Box3().setFromObject(inst);
      const missile = new THREE.Group();
      missile.rotation.y = Math.PI;
      missile.position.set(0, (box.min.y + box.max.y) / 2, box.min.z + r * 0.25);
      swapInMobModel(missile, 'hornetmissile', r * 0.3, null, { centerY: true });
      g.add(missile);
      g.userData.missile = missile;
      g.userData.wingPivots = addHornetWings(g, r, box.max.y * 0.9, (box.min.z + box.max.z) * 0.2);
    });
  }
  return group;
}

export function makePetalMesh(type, radius) {
  const def = PETAL_TYPES[type];
  let mesh;
  let outlined = false;
  if (type === 'rockPetal') {
    const mat = toonMat(def.color);
    mat.flatShading = true;
    mesh = new THREE.Mesh(makeRockGeometry(radius, 0.2), mat);
  } else if (type === 'stinger') {
    mesh = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.9, radius * 2, 3), toonMat(def.color));
    mesh.rotation.x = Math.PI / 2;
  } else if (type === 'missile') {
    mesh = new THREE.Mesh(new THREE.ConeGeometry(radius * 1.1, radius * 2.3, 3), toonMat(def.color));
    mesh.scale.set(1, 1, 0.55);
    mesh.rotation.x = Math.PI / 2;
  } else if (type === 'glass') {
    const variant = Math.floor(Math.random() * GLASS_VARIANTS);
    const geo = sharedGeo(`glass-${radius}-${variant}`, () => {
      const shape = new THREE.Shape();
      const n = 5;
      for (let i = 0; i < n; i++) {
        const angle = (i / n) * Math.PI * 2 + Math.random() * 0.4;
        const r = radius * (0.7 + Math.random() * 0.5);
        const x = Math.cos(angle) * r, y = Math.sin(angle) * r;
        if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
      }
      shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, { depth: radius * 0.25, bevelEnabled: false });
      g.center();
      g.rotateX(Math.PI / 2);
      return g;
    });
    mesh = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({
      color: def.color, transparent: true, opacity: 0.5, roughness: 0.1,
    }));
  } else if (type === 'rice') {
    const geo = sharedGeo(`rice-${radius}`, () => {
      const g = new THREE.CapsuleGeometry(radius * 0.42, radius * 1.9, 6, 12);
      const halfLen = radius * (0.95 + 0.42);
      const k = radius * 0.4 / (halfLen * halfLen);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        pos.setX(i, pos.getX(i) + k * pos.getY(i) * pos.getY(i));
      }
      g.computeVertexNormals();
      return g;
    });
    mesh = new THREE.Mesh(geo, toonMat(def.color));
    mesh.rotation.x = Math.PI / 2;
    mesh.scale.y = 0.85;
    addOutline(mesh, 0.2, '#c9c9c1');
    outlined = true;
  } else if (type === 'leaf') {
    const L = radius * 1.15, W = radius * 0.7, depth = radius * 0.16;
    const geo = sharedGeo(`leaf-${radius}`, () => {
      const shape = new THREE.Shape();
      shape.moveTo(0, L);
      shape.quadraticCurveTo(W * 1.05, L * 0.25, W * 0.9, -L * 0.3);
      shape.quadraticCurveTo(W * 0.6, -L * 0.95, 0, -L);
      shape.quadraticCurveTo(-W * 0.6, -L * 0.95, -W * 0.9, -L * 0.3);
      shape.quadraticCurveTo(-W * 1.05, L * 0.25, 0, L);
      const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
      g.center();
      g.rotateX(Math.PI / 2);
      return g;
    });
    const darkGreen = '#1e7a2c';
    mesh = new THREE.Mesh(geo, toonMat(def.color));
    const ribGeo = sharedGeo(`leaf-rib-${radius}`, () =>
      new THREE.BoxGeometry(radius * 0.09, radius * 0.05, L * 1.5));
    const rib = new THREE.Mesh(ribGeo, toonMat(darkGreen));
    rib.position.set(0, depth * 0.5 + radius * 0.02, -L * 0.1);
    mesh.add(rib);
    const stemGeo = sharedGeo(`leaf-stem-${radius}`, () =>
      new THREE.BoxGeometry(radius * 0.12, radius * 0.12, radius * 0.45));
    const stem = new THREE.Mesh(stemGeo, toonMat(darkGreen));
    stem.position.set(0, 0, -(L + radius * 0.15));
    mesh.add(stem);
    addOutline(mesh, 0.15, darkGreen);
    outlined = true;
  } else if (type === 'corn') {
    const geo = sharedGeo(`corn-${radius}`, () => {
      const w = radius * 0.75, h = radius * 0.85;
      const shape = new THREE.Shape();
      shape.moveTo(-w * 0.75, h);
      shape.quadraticCurveTo(0, h * 0.72, w * 0.75, h);
      shape.quadraticCurveTo(w * 1.1, h * 0.15, w * 0.55, -h * 0.7);
      shape.quadraticCurveTo(0, -h * 1.15, -w * 0.55, -h * 0.7);
      shape.quadraticCurveTo(-w * 1.1, h * 0.15, -w * 0.75, h);
      const g = new THREE.ExtrudeGeometry(shape, {
        depth: radius * 0.45, bevelEnabled: true, bevelSegments: 2,
        bevelThickness: radius * 0.14, bevelSize: radius * 0.12,
      });
      g.center();
      g.rotateX(Math.PI / 2);
      return g;
    });
    mesh = new THREE.Mesh(geo, toonMat(def.color));
    addOutline(mesh, 0.14, '#cfb111');
    outlined = true;
  } else if (type === 'wing') {
    const geo = sharedGeo(`wing-${radius}`, () => {
      const R = radius * 1.15;
      const shape = new THREE.Shape();
      shape.absarc(0, 0, R, -Math.PI / 2, Math.PI / 2, false);
      shape.quadraticCurveTo(R * 0.35, 0, 0, -R);
      const g = new THREE.ExtrudeGeometry(shape, {
        depth: radius * 0.16, bevelEnabled: true, bevelSegments: 2,
        bevelThickness: radius * 0.06, bevelSize: radius * 0.06,
      });
      g.center();
      g.rotateX(Math.PI / 2);
      return g;
    });
    mesh = new THREE.Mesh(geo, toonMat(def.color));
    addOutline(mesh, 0.15, '#cfcfcf');
    outlined = true;
  } else if (type === 'bubble') {
    const geo = sharedGeo(`bubble-${radius}`, () => new THREE.SphereGeometry(radius, 18, 14));
    mesh = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({
      color: def.color, transparent: true, opacity: 0.4, roughness: 0.05,
    }));
    const glintGeo = sharedGeo(`bubble-glint-${radius}`, () => new THREE.SphereGeometry(radius * 0.22, 8, 6));
    const glint = new THREE.Mesh(glintGeo, new THREE.MeshBasicMaterial({
      color: '#ffffff', transparent: true, opacity: 0.85,
    }));
    glint.position.set(radius * 0.45, radius * 0.5, radius * 0.35);
    mesh.add(glint);
    outlined = true;
  } else if (type === 'orange') {
    mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), toonMat(def.color));
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.6, 10, 8), toonMat('#35a83c'));
    leaf.scale.set(1, 0.32, 0.55);
    leaf.position.set(radius * 0.35, radius * 0.8, 0);
    leaf.rotation.z = -0.55;
    mesh.add(leaf);
  } else {
    mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), toonMat(def.color));
  }
  if (type !== 'glass' && !outlined) addOutline(mesh, 0.2);
  const group = new THREE.Group();
  group.add(mesh);
  enableShadows(group, { cast: true, receive: false });
  return group;
}

export function makeDropMesh(type, rarityIdx) {
  const group = new THREE.Group();
  const rarity = RARITIES[rarityIdx];

  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.1, 24),
    new THREE.MeshBasicMaterial({ color: rarity.color, transparent: true, opacity: 0.75 })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.06;
  group.add(disc);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(1.1, 0.09, 8, 28),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(rarity.color).multiplyScalar(0.6) })
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.07;
  group.add(rim);

  const petal = makePetalMesh(type, PETAL_TYPES[type].radius * 1.5);
  petal.position.y = 1.1;
  group.add(petal);
  group.userData.petal = petal;
  return group;
}
