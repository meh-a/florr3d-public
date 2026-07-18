import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TILE_SIZE, MAP_TILES } from '../../shared/config.js';
import waterNormalsUrl from '../assets/waternormals.jpg';
import desertTileUrl from '../assets/deserttile.svg';
import jungleTileUrl from '../assets/jungletile.svg';

export const WATER_LEVEL = -0.55;
const BASIN_DEPTH = 1.8;

const DIRT = '#8a6b42';
const DIRT_DARK = '#63482a';

function buildBasin(scene, waterTiles) {
  const isWater = new Set(waterTiles.map((t) => `${t.gx},${t.gz}`));
  const half = TILE_SIZE / 2;
  const floors = [];
  const walls = [];

  for (const t of waterTiles) {
    const cx = t.gx * TILE_SIZE, cz = t.gz * TILE_SIZE;

    floors.push(new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE)
      .rotateX(-Math.PI / 2)
      .translate(cx, -BASIN_DEPTH, cz));

    const sides = [
      { dx: 1, dz: 0, rotY: Math.PI / 2 },
      { dx: -1, dz: 0, rotY: Math.PI / 2 },
      { dx: 0, dz: 1, rotY: 0 },
      { dx: 0, dz: -1, rotY: 0 },
    ];
    for (const s of sides) {
      if (isWater.has(`${t.gx + s.dx},${t.gz + s.dz}`)) continue;
      walls.push(new THREE.PlaneGeometry(TILE_SIZE, BASIN_DEPTH)
        .rotateY(s.rotY)
        .translate(cx + s.dx * half, -BASIN_DEPTH / 2, cz + s.dz * half));
    }
  }

  scene.add(new THREE.Mesh(mergeGeometries(floors),
    new THREE.MeshToonMaterial({ color: DIRT_DARK })));
  if (walls.length) scene.add(new THREE.Mesh(mergeGeometries(walls),
    new THREE.MeshToonMaterial({ color: DIRT, side: THREE.DoubleSide })));
}

function mergedTileGeometry(tiles) {
  return mergeGeometries(tiles.map((t) =>
    new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE)
      .translate(t.gx * TILE_SIZE, -t.gz * TILE_SIZE, 0)
  ));
}

const OVERLAY_Y = 0.02;

function makeOverlay(scene, tiles, material) {
  const mesh = new THREE.Mesh(mergedTileGeometry(tiles), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = OVERLAY_Y;
  scene.add(mesh);
}

export function tileTexture(url) {
  const tx = new THREE.TextureLoader().load(url);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  tx.anisotropy = 4;
  return tx;
}

function lakeComponents(waterTiles) {
  const byKey = new Map(waterTiles.map((t) => [`${t.gx},${t.gz}`, t]));
  const seen = new Set();
  const lakes = [];
  for (const t of waterTiles) {
    if (seen.has(`${t.gx},${t.gz}`)) continue;
    seen.add(`${t.gx},${t.gz}`);
    const lake = [];
    const stack = [t];
    while (stack.length) {
      const cur = stack.pop();
      lake.push(cur);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nk = `${cur.gx + dx},${cur.gz + dz}`;
        if (byKey.has(nk) && !seen.has(nk)) { seen.add(nk); stack.push(byKey.get(nk)); }
      }
    }
    lakes.push(lake);
  }
  return lakes;
}

const rippleFactor = (tiles) => Math.min(2.5, 0.55 + 0.45 * Math.log2(tiles + 1));

function waterSurfaceGeometry(waterTiles) {
  const geos = [];
  for (const lake of lakeComponents(waterTiles)) {
    const f = rippleFactor(lake.length);
    for (const t of lake) {
      const g = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE)
        .translate(t.gx * TILE_SIZE, -t.gz * TILE_SIZE, 0);
      g.setAttribute('aRipple', new THREE.Float32BufferAttribute([f, f, f, f], 1));
      geos.push(g);
    }
  }
  return mergeGeometries(geos);
}

function makeReflectiveWater(scene, waterTiles, sunDir) {
  const waterNormals = new THREE.TextureLoader().load(waterNormalsUrl, (tx) => {
    tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  });
  const water = new Water(waterSurfaceGeometry(waterTiles), {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals,
    sunDirection: sunDir.clone().normalize(),
    sunColor: 0xffffff,
    waterColor: 0x0e6b8e,
    distortionScale: 0.9,
    fog: true,
  });
  const mat = water.material;
  mat.vertexShader = mat.vertexShader
    .replace('varying vec4 mirrorCoord;', 'varying vec4 mirrorCoord;\n\tattribute float aRipple;\n\tvarying float vRipple;')
    .replace('void main() {', 'void main() {\n\tvRipple = aRipple;');
  mat.fragmentShader = mat.fragmentShader
    .replace('varying vec4 mirrorCoord;', 'varying vec4 mirrorCoord;\n\tvarying float vRipple;')
    .replace(
      'vec2 distortion = surfaceNormal.xz * ( 0.001 + 1.0 / distance ) * distortionScale;',
      'vec2 distortion = surfaceNormal.xz * ( 0.001 + 1.0 / distance ) * distortionScale * vRipple;'
    );
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_LEVEL;
  scene.add(water);
  return (dt) => { water.material.uniforms.time.value += dt * 0.2; };
}

function makeFlatWater(scene, waterTiles) {
  const mesh = new THREE.Mesh(
    mergedTileGeometry(waterTiles),
    new THREE.MeshToonMaterial({ color: '#2f8fbf', transparent: true, opacity: 0.9 })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = WATER_LEVEL;
  scene.add(mesh);
}

export function makeTiles(scene, quality, sunDir) {
  const updates = [];

  const byType = new Map();
  for (const t of MAP_TILES) {
    if (!byType.has(t.type)) byType.set(t.type, []);
    byType.get(t.type).push(t);
  }

  const waterTiles = byType.get('water');
  if (waterTiles) {
    buildBasin(scene, waterTiles);
    if (quality !== 'low') updates.push(makeReflectiveWater(scene, waterTiles, sunDir));
    else makeFlatWater(scene, waterTiles);
  }

  const desertTiles = byType.get('desert');
  if (desertTiles) {
    makeOverlay(scene, desertTiles, new THREE.MeshToonMaterial({ map: tileTexture(desertTileUrl) }));
  }
  const jungleTiles = byType.get('jungle');
  if (jungleTiles) {
    makeOverlay(scene, jungleTiles, new THREE.MeshToonMaterial({ map: tileTexture(jungleTileUrl) }));
  }
  const dirtTiles = byType.get('dirt');
  if (dirtTiles) {
    makeOverlay(scene, dirtTiles, new THREE.MeshToonMaterial({ color: DIRT }));
  }

  return (dt) => { for (const u of updates) u(dt); };
}
