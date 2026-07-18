import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, quantize, meshopt } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';

const [,, input, output, ratioArg, errorArg] = process.argv;
if (!input || !output) {
  console.error('usage: node tools/decimate.mjs in.glb out.glb [ratio] [error]');
  process.exit(1);
}
const ratio = Number(ratioArg ?? 0.15), errCap = Number(errorArg ?? 0.05);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(input);
await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;

const GRID = 144;
const MAX_HOLE_EDGES = 14;
const BODY_OUTWARD_FRAC = 0.9;
const BODY_SHRINK = 0.012;

function fillSmallHoles(tris) {
  const EK = 1 << 21;
  const count = new Map();
  const dirOwner = new Map();
  for (let i = 0; i < tris.length; i += 3) {
    for (let e = 0; e < 3; e++) {
      const a = tris[i + e], b = tris[i + (e + 1) % 3];
      const k = a < b ? a * EK + b : b * EK + a;
      count.set(k, (count.get(k) || 0) + 1);
      dirOwner.set(a * EK + b, true);
    }
  }
  const next = new Map();
  for (const [k, n] of count) {
    if (n !== 1) continue;
    const a = Math.floor(k / EK), b = k % EK;
    if (dirOwner.get(a * EK + b)) next.set(b, a);
    else next.set(a, b);
  }
  const filled = [];
  const seen = new Set();
  let holes = 0;
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const loop = [start];
    seen.add(start);
    let v = next.get(start);
    while (v !== undefined && v !== start && loop.length <= MAX_HOLE_EDGES) {
      if (seen.has(v)) break;
      loop.push(v);
      seen.add(v);
      v = next.get(v);
    }
    if (v !== start || loop.length < 3 || loop.length > MAX_HOLE_EDGES) continue;
    holes++;
    for (let i = 1; i < loop.length - 1; i++) filled.push(loop[0], loop[i], loop[i + 1]);
  }
  return { filled, holes };
}

function triVisibility(pos, idx, occluder) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let v = 0; v < pos.length; v += 3) {
    minX = Math.min(minX, pos[v]); maxX = Math.max(maxX, pos[v]);
    minY = Math.min(minY, pos[v + 1]); maxY = Math.max(maxY, pos[v + 1]);
    minZ = Math.min(minZ, pos[v + 2]); maxZ = Math.max(maxZ, pos[v + 2]);
  }
  const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
  const cell = span / GRID;
  const nx = Math.ceil((maxX - minX) / cell) + 2;
  const ny = Math.ceil((maxY - minY) / cell) + 2;
  const nz = Math.ceil((maxZ - minZ) / cell) + 2;
  const cellOf = (x, y, z) => {
    const cx = Math.min(nx - 2, Math.floor((x - minX) / cell)) + 1;
    const cy = Math.min(ny - 2, Math.floor((y - minY) / cell)) + 1;
    const cz = Math.min(nz - 2, Math.floor((z - minZ) / cell)) + 1;
    return (cx * ny + cy) * nz + cz;
  };
  const grid = new Uint8Array(nx * ny * nz);

  const triCells = new Array(idx.length / 3);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const e1 = Math.hypot(pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]);
    const e2 = Math.hypot(pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]);
    const n = Math.max(1, Math.ceil(Math.max(e1, e2) / cell) * 2);
    const cells = new Set();
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n - i; j++) {
        const u = i / n, v = j / n, w = 1 - u - v;
        const x = pos[a] * w + pos[b] * u + pos[c] * v;
        const y = pos[a + 1] * w + pos[b + 1] * u + pos[c + 1] * v;
        const z = pos[a + 2] * w + pos[b + 2] * u + pos[c + 2] * v;
        const cellIdx = cellOf(x, y, z);
        cells.add(cellIdx);
        if (occluder[t / 3]) grid[cellIdx] = 1;
      }
    }
    triCells[t / 3] = [...cells];
  }

  const queue = [];
  const push = (i) => { if (grid[i] === 0) { grid[i] = 2; queue.push(i); } };
  for (let x = 0; x < nx; x++) {
    for (let y = 0; y < ny; y++) { push((x * ny + y) * nz); push((x * ny + y) * nz + nz - 1); }
  }
  for (let x = 0; x < nx; x++) {
    for (let z = 0; z < nz; z++) { push((x * ny) * nz + z); push((x * ny + ny - 1) * nz + z); }
  }
  for (let y = 0; y < ny; y++) {
    for (let z = 0; z < nz; z++) { push((y * nz) + z); push(((nx - 1) * ny + y) * nz + z); }
  }
  while (queue.length) {
    const i = queue.pop();
    const z = i % nz, y = ((i - z) / nz) % ny, x = (i - z - y * nz) / (ny * nz);
    if (x > 0) push(i - ny * nz);
    if (x < nx - 1) push(i + ny * nz);
    if (y > 0) push(i - nz);
    if (y < ny - 1) push(i + nz);
    if (z > 0) push(i - 1);
    if (z < nz - 1) push(i + 1);
  }

  const offsets = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) offsets.push((dx * ny + dy) * nz + dz);
    }
  }
  const visible = new Uint8Array(triCells.length);
  for (let t = 0; t < triCells.length; t++) {
    outer: for (const cellIdx of triCells[t]) {
      for (const off of offsets) {
        if (grid[cellIdx + off] === 2) { visible[t] = 1; break outer; }
      }
    }
  }
  return visible;
}

for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION').getArray();
    const rawIdx = prim.getIndices().getArray();
    const before = rawIdx.length / 3;
    const nVerts = pos.length / 3;

    const canon = new Map();
    const remap = new Uint32Array(nVerts);
    for (let v = 0; v < nVerts; v++) {
      const key = `${pos[v * 3].toFixed(5)},${pos[v * 3 + 1].toFixed(5)},${pos[v * 3 + 2].toFixed(5)}`;
      let c = canon.get(key);
      if (c === undefined) { c = v; canon.set(key, c); }
      remap[v] = c;
    }
    const idx = new Uint32Array(rawIdx.length);
    for (let i = 0; i < rawIdx.length; i++) idx[i] = remap[rawIdx[i]];

    let cx = 0, cy = 0, cz = 0;
    let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let v = 0; v < nVerts; v++) {
      cx += pos[v * 3]; cy += pos[v * 3 + 1]; cz += pos[v * 3 + 2];
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k], pos[v * 3 + k]);
        hi[k] = Math.max(hi[k], pos[v * 3 + k]);
      }
    }
    cx /= nVerts; cy /= nVerts; cz /= nVerts;
    const span = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
    const outward = new Uint8Array(idx.length / 3);
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
      const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
      const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const mx = (pos[a] + pos[b] + pos[c]) / 3 - cx;
      const my = (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3 - cy;
      const mz = (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3 - cz;
      if (nx * mx + ny * my + nz * mz > 0) outward[i / 3] = 1;
    }

    const visible = triVisibility(pos, idx, outward);

    const parent = new Uint32Array(nVerts).map((_, i) => i);
    const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    for (let i = 0; i < idx.length; i += 3) {
      const a = find(idx[i]), b = find(idx[i + 1]), c = find(idx[i + 2]);
      parent[b] = a; parent[c] = a;
    }
    const byComp = new Map();
    const compStats = new Map();
    for (let i = 0; i < idx.length; i += 3) {
      const r = find(idx[i]);
      if (!byComp.has(r)) { byComp.set(r, []); compStats.set(r, { seen: false, inward: 0 }); }
      byComp.get(r).push(idx[i], idx[i + 1], idx[i + 2]);
      const s = compStats.get(r);
      if (visible[i / 3]) s.seen = true;
      if (!outward[i / 3]) s.inward++;
    }

    const out = [];
    const shrinkVerts = new Set();
    for (const [root, compIdx] of byComp) {
      const s = compStats.get(root);
      if (!s.seen) {
        console.log(`  component: ${compIdx.length / 3} tris — fully enclosed, dropped`);
        continue;
      }
      const arr = new Uint32Array(compIdx);
      const target = Math.max(3, Math.floor(arr.length * ratio / 3) * 3);
      let [slim, err] = MeshoptSimplifier.simplifySloppy(arr, pos, 3, null, target, errCap);
      const nrm = prim.getAttribute('NORMAL')?.getArray();
      let flipped = 0;
      if (nrm) {
        const okTris = [];
        for (let i = 0; i < slim.length; i += 3) {
          const a = slim[i] * 3, b = slim[i + 1] * 3, c = slim[i + 2] * 3;
          const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
          const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
          const gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
          const sx = nrm[a] + nrm[b] + nrm[c], sy = nrm[a + 1] + nrm[b + 1] + nrm[c + 1], sz = nrm[a + 2] + nrm[b + 2] + nrm[c + 2];
          if (gx * sx + gy * sy + gz * sz < 0) { flipped++; continue; }
          okTris.push(slim[i], slim[i + 1], slim[i + 2]);
        }
        slim = new Uint32Array(okTris);
      }
      const { filled, holes } = fillSmallHoles(slim);
      const isBody = 1 - s.inward / (compIdx.length / 3) > BODY_OUTWARD_FRAC;
      if (isBody) { for (const v of slim) shrinkVerts.add(v); for (const v of filled) shrinkVerts.add(v); }
      console.log(`  component: ${arr.length / 3} -> ${slim.length / 3} tris (err ${err.toFixed(4)}, ${flipped} flipped dropped, ${holes} tears filled)${isBody ? ' [body, shrunk]' : ''}`);
      out.push(...slim, ...filled);
    }

    const used = new Map();
    const finalIdx = new Uint32Array(out.length);
    for (let i = 0; i < out.length; i++) {
      let n = used.get(out[i]);
      if (n === undefined) { n = used.size; used.set(out[i], n); }
      finalIdx[i] = n;
    }
    for (const name of prim.listSemantics()) {
      const attr = prim.getAttribute(name);
      const src = attr.getArray();
      const size = attr.getElementSize();
      const dst = new src.constructor(used.size * size);
      for (const [oldV, newV] of used) {
        for (let k = 0; k < size; k++) dst[newV * size + k] = src[oldV * size + k];
      }
      attr.setArray(dst);
    }
    const posAttr = prim.getAttribute('POSITION');
    const normAttr = prim.getAttribute('NORMAL');
    if (normAttr && shrinkVerts.size) {
      const p2 = posAttr.getArray(), n2 = normAttr.getArray();
      const eps = span * BODY_SHRINK;
      for (const [oldV, newV] of used) {
        if (!shrinkVerts.has(oldV)) continue;
        const len = Math.hypot(n2[newV * 3], n2[newV * 3 + 1], n2[newV * 3 + 2]) || 1;
        p2[newV * 3] -= (n2[newV * 3] / len) * eps;
        p2[newV * 3 + 1] -= (n2[newV * 3 + 1] / len) * eps;
        p2[newV * 3 + 2] -= (n2[newV * 3 + 2] / len) * eps;
      }
      posAttr.setArray(p2);
    }
    prim.getIndices().setArray(finalIdx);
    console.log(`total: ${before} -> ${finalIdx.length / 3} tris, ${nVerts} -> ${used.size} verts`);
  }
}

await doc.transform(prune(), quantize(), meshopt({ encoder: MeshoptEncoder }));
await io.write(output, doc);
console.log(`wrote ${output}`);
