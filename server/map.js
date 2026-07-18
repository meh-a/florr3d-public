import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizeMap } from '../shared/map.js';
import { applyMap } from '../shared/config.js';

const MAP_PATH = process.env.MAP_PATH
  || fileURLToPath(new URL('../map.json', import.meta.url));

export const mapPayload = load();

function load() {
  let raw;
  try {
    raw = readFileSync(MAP_PATH, 'utf8');
  } catch {
    return null;
  }
  try {
    const { warnings, ...payload } = normalizeMap(JSON.parse(raw));
    for (const w of warnings) console.warn(`map: ${w}`);
    applyMap(payload);
    const count = Object.values(payload.tiles).reduce((n, c) => n + c.length / 2, 0);
    console.log(`map: loaded ${count} tiles from ${MAP_PATH} (arenaHalf ${payload.arenaHalf})`);
    return payload;
  } catch (err) {
    console.error(`map: failed to load ${MAP_PATH} — using defaults:`, err.message);
    return null;
  }
}
