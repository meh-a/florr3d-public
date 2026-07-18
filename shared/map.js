import { TILE_SIZE, TILE_TYPES, WALL_HEIGHT } from './config.js';

export function normalizeMap(data) {
  const warnings = [];
  if (data?.formatVersion !== 1) {
    throw new Error(`unsupported map formatVersion: ${data?.formatVersion}`);
  }
  if (data.tileSize !== TILE_SIZE) {
    warnings.push(`map tileSize ${data.tileSize} != game TILE_SIZE ${TILE_SIZE}; using game size`);
  }
  const width = data.width || 20;
  const depth = data.depth || 20;
  const ox = Math.floor(width / 2);
  const oz = Math.floor(depth / 2);

  const topOfColumn = new Map();
  let skipped = 0;
  for (const t of data.floor || []) {
    const def = TILE_TYPES[t.type];
    if (!def || def.isWall) { skipped++; continue; }
    const key = `${t.gx},${t.gz}`;
    const gy = Number.isInteger(t.gy) ? t.gy : 0;
    const top = topOfColumn.get(key);
    if (!top || gy > top.gy) topOfColumn.set(key, { type: t.type, gy });
  }
  if (skipped) warnings.push(`${skipped} floor tile(s) of unknown type skipped`);

  const tiles = {};
  for (const [key, top] of topOfColumn) {
    if (top.type === 'grass') continue;
    const [gx, gz] = key.split(',').map(Number);
    (tiles[top.type] ??= []).push(gx - ox, gz - oz);
  }
  if (data.wallHeight && data.wallHeight !== WALL_HEIGHT) {
    warnings.push(`map wallHeight ${data.wallHeight} != game WALL_HEIGHT ${WALL_HEIGHT}; using game height`);
  }

  const columns = new Map();
  let wallsSkipped = 0;
  for (const w of data.walls || []) {
    if (!TILE_TYPES[w.type]?.isWall) { wallsSkipped++; continue; }
    const key = `${w.gx - ox},${w.gz - oz}`;
    const col = columns.get(key);
    if (!col) columns.set(key, { type: w.type, h: w.gy + 1 });
    else col.h = Math.max(col.h, w.gy + 1);
  }
  if (wallsSkipped) warnings.push(`${wallsSkipped} wall tile(s) of unknown type skipped`);
  const walls = {};
  for (const [key, col] of columns) {
    const [gx, gz] = key.split(',').map(Number);
    (walls[col.type] ??= []).push(gx, gz, col.h);
  }

  const arenaHalf = (Math.max(width, depth) * TILE_SIZE) / 2;
  return { arenaHalf, tiles, walls, warnings };
}
