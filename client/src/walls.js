import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TILE_SIZE, WALL_HEIGHT, MAP_WALLS, isWallCell, tileTypeAt } from '../../shared/config.js';
import { tileTexture } from './tiles.js';
import dirtTileUrl from '../assets/dirttile.svg';
import desertTileUrl from '../assets/deserttile.svg';
import jungleTileUrl from '../assets/jungletile.svg';
import grassTileUrl from '../assets/grasstile.svg';

const SUN = new THREE.Vector3(30, 60, 20).normalize();
const FACE_NORMALS = {
  px: new THREE.Vector3(1, 0, 0), nx: new THREE.Vector3(-1, 0, 0),
  py: new THREE.Vector3(0, 1, 0), ny: new THREE.Vector3(0, -1, 0),
  pz: new THREE.Vector3(0, 0, 1), nz: new THREE.Vector3(0, 0, -1),
};
const FACE_ORDER = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];

const SIDE_TINTS = {
  dirtWall: new THREE.Color('#ffffff'),
  stoneWall: new THREE.Color('#9a9aa8'),
};
const DESERT_SIDE_TINT = new THREE.Color('#a89a80');
const TOP_COLOR = new THREE.Color('#4e7d20');
const BASE_DARKEN = 0.5;
const REPEATS = 2;

function columnGeometry(w, tint) {
  const h = w.h * WALL_HEIGHT;
  const geo = new THREE.BoxGeometry(TILE_SIZE, h, TILE_SIZE);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const vScale = (h / TILE_SIZE) * REPEATS;
  for (let i = 0; i < pos.count; i++) {
    const face = FACE_ORDER[Math.floor(i / 4)];
    uv.setX(i, uv.getX(i) * REPEATS);
    uv.setY(i, uv.getY(i) * (face === 'py' || face === 'ny' ? REPEATS : vScale));
    const light = 0.62 + 0.38 * Math.max(0, FACE_NORMALS[face].dot(SUN));
    const t = (pos.getY(i) + h / 2) / h;
    c.copy(tint).multiplyScalar(light * (BASE_DARKEN + (1 - BASE_DARKEN) * t));
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo.translate(w.gx * TILE_SIZE, h / 2, w.gz * TILE_SIZE);
}

const CAP_LIP = 1.6;
const CAP_OVERHANG = 0.25;

function capGeometry(w) {
  const top = w.h * WALL_HEIGHT + 0.02;
  const geo = new THREE.BoxGeometry(TILE_SIZE + CAP_OVERHANG * 2, CAP_LIP, TILE_SIZE + CAP_OVERHANG * 2);
  const uv = geo.attributes.uv;
  const vScale = CAP_LIP / TILE_SIZE;
  for (let i = 0; i < 24; i++) {
    const face = FACE_ORDER[Math.floor(i / 4)];
    if (face !== 'py' && face !== 'ny') uv.setY(i, uv.getY(i) * vScale);
  }
  return geo.translate(w.gx * TILE_SIZE, top - CAP_LIP / 2, w.gz * TILE_SIZE);
}

function biomeOf(w) {
  for (let ring = 1; ring <= 12; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dz = -ring; dz <= ring; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
        const gx = w.gx + dx, gz = w.gz + dz;
        if (isWallCell(gx, gz)) continue;
        return tileTypeAt(gx * TILE_SIZE, gz * TILE_SIZE);
      }
    }
  }
  return 'grass';
}

export function makeWalls(scene) {
  if (!MAP_WALLS.length) return;
  const byType = new Map();
  for (const w of MAP_WALLS) {
    if (!byType.has(w.type)) byType.set(w.type, []);
    byType.get(w.type).push(w);
  }
  for (const [type, cols] of byType) {
    if (type === 'dirtWall') {
      const desertCols = [], dirtCols = [];
      for (const w of cols) (biomeOf(w) === 'desert' ? desertCols : dirtCols).push(w);
      if (desertCols.length) {
        const geo = mergeGeometries(desertCols.map((w) => columnGeometry(w, DESERT_SIDE_TINT)));
        scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
          vertexColors: true, map: tileTexture(desertTileUrl),
        })));
      }
      if (dirtCols.length) {
        const geo = mergeGeometries(dirtCols.map((w) => columnGeometry(w, SIDE_TINTS.dirtWall)));
        scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
          vertexColors: true, map: tileTexture(dirtTileUrl),
        })));
      }
      continue;
    }
    const tint = SIDE_TINTS[type] || SIDE_TINTS.dirtWall;
    const geo = mergeGeometries(cols.map((w) => columnGeometry(w, tint)));
    scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      vertexColors: true, map: tileTexture(dirtTileUrl),
    })));
  }

  const capMaterials = {
    grass: () => new THREE.MeshBasicMaterial({ map: tileTexture(grassTileUrl) }),
    desert: () => new THREE.MeshBasicMaterial({ map: tileTexture(desertTileUrl) }),
    jungle: () => new THREE.MeshBasicMaterial({ map: tileTexture(jungleTileUrl) }),
    dirt: () => new THREE.MeshBasicMaterial({ map: tileTexture(dirtTileUrl) }),
  };
  const byBiome = new Map();
  for (const w of MAP_WALLS) {
    const biome = biomeOf(w);
    const key = capMaterials[biome] ? biome : 'grass';
    if (!byBiome.has(key)) byBiome.set(key, []);
    byBiome.get(key).push(w);
  }
  for (const [biome, cols] of byBiome) {
    const material = capMaterials[biome]
      ? capMaterials[biome]()
      : new THREE.MeshBasicMaterial({ color: TOP_COLOR });
    scene.add(new THREE.Mesh(mergeGeometries(cols.map(capGeometry)), material));
  }
}
