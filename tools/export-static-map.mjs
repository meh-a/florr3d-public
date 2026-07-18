import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizeMap } from '../shared/map.js';

const src = fileURLToPath(new URL('../map.json', import.meta.url));
const dest = fileURLToPath(new URL('../client/public/map.json', import.meta.url));

const raw = JSON.parse(readFileSync(src, 'utf8'));
const { warnings, ...payload } = normalizeMap(raw);
for (const w of warnings) console.warn(`export-static-map: ${w}`);
writeFileSync(dest, JSON.stringify(payload));
console.log(`export-static-map: wrote ${dest} (arenaHalf ${payload.arenaHalf})`);
