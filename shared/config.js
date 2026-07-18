export const RARITIES = [
  { name: 'Common',    color: '#7eef6d', petalMult: 1,   statMult: 1,      dmgMult: 1,   armorMult: 1,   weight: 100,  scale: 1.0  },
  { name: 'Unusual',   color: '#ffe65d', petalMult: 2,   statMult: 2,      dmgMult: 2,   armorMult: 2,   weight: 100,  scale: 1.2  },
  { name: 'Rare',      color: '#4d52e3', petalMult: 4,   statMult: 5,      dmgMult: 4,   armorMult: 4,   weight: 50,   scale: 1.5  },
  { name: 'Epic',      color: '#861fde', petalMult: 8,   statMult: 20,     dmgMult: 8,   armorMult: 8,   weight: 20,   scale: 2.0  },
  { name: 'Legendary', color: '#de1f1f', petalMult: 16,  statMult: 120,    dmgMult: 16,  armorMult: 16,  weight: 5,    scale: 2.8,  maxShare: 0.05  },
  { name: 'Mythic',    color: '#1fdbde', petalMult: 32,  statMult: 800,    dmgMult: 32,  armorMult: 32,  weight: 2.5,  scale: 4.0,  maxShare: 0.04  },
  { name: 'Ultra',     color: '#ff2b75', petalMult: 64,  statMult: 10000,  dmgMult: 64,  armorMult: 64,  weight: 0.2,  scale: 6.0,  maxShare: 0.005 },
];

export const CHAT_MAX_LEN = 100;
export const NAME_MAX_LEN = 16;
export const stripNonAscii = (s) => s.replace(/[^\x20-\x7e]/g, '');

export const ANT_MAX_SHARE = 0.35;
export const ANT_TYPES = ['baby', 'worker', 'soldier', 'anthole'];

export const MOB_TYPES = {
  rock: {
    name: 'Rock', hp: 45, dmg: 8, armor: 2, radius: 1.6, speed: 0, xp: 2,
    drops: [['rockPetal', 1]],
    spawnWeight: 0.5,
  },
  ladybug: {
    name: 'Ladybug', hp: 35, dmg: 12, armor: 0, radius: 1.5, speed: 2.4, xp: 4,
    drops: [['rose', 0.45], ['light', 0.3], ['bubble', 0.25]],
  },
  bee: {
    name: 'Bee', hp: 15, dmg: 40, armor: 0, radius: 1.4, speed: 2.8, xp: 5,
    drops: [['stinger', 1]],
  },
  hornet: {
    name: 'Hornet', hp: 62.5, dmg: 30, armor: 1, radius: 1.7, speed: 2.0, xp: 12,
    drops: [['missile', 0.5], ['orange', 0.5]],
    spawnWeight: 0.35,
    maxAlive: 6,
    missile: { hp: 5, dmg: 6, speed: 16, radius: 0.45 },
  },
  soldier: {
    name: 'Soldier Ant', hp: 40, dmg: 10, armor: 0, radius: 1.5, speed: 1.8, xp: 7,
    drops: [['glass', 1], ['wing', 1]],
    sightAggro: 14,
    leash: 40,
    spawnWeight: 0.3,
  },
  worker: {
    name: 'Worker Ant', hp: 25, dmg: 10, armor: 0, radius: 1.3, speed: 1.8, xp: 5,
    drops: [['corn', 1], ['leaf', 1]],
    retaliates: true,
  },
  baby: {
    name: 'Baby Ant', hp: 10, dmg: 10, armor: 0, radius: 1.0, speed: 1.4, xp: 2,
    drops: [['light', 1], ['rice', 1], ['leaf', 1]],
    passive: true,
    spawnWeight: 0.6,
  },
  anthole: {
    name: 'Ant Hole', hp: 500, dmg: 10, armor: 2, radius: 2.5, speed: 0, xp: 50,
    drops: [],
    spawnWeight: 0.15,
    maxAlive: 1,
  },
};

export const PETAL_TYPES = {
  basic:     { name: 'Basic',   hp: 10, dmg: 10, reload: 2.5, radius: 0.42, count: 1, color: '#ffffff',
               desc: 'A nice petal, not too strong but not too weak.' },
  rockPetal: { name: 'Rock',    hp: 30, dmg: 10, reload: 4,   radius: 0.5,  count: 1, color: '#7d7d84',
               desc: 'Heavy and durable.' },
  rose:      { name: 'Rose',    hp: 5,  dmg: 5,  reload: 3.5, radius: 0.42, count: 1, color: '#ff94c9', heal: 11,
               desc: "It's healing properties are amazing." },
  light:     { name: 'Light',   hp: 5 / 3, dmg: 13 / 3, reload: 0.6, radius: 0.28, count: 3, color: '#ffffff',
               desc: 'Weaker, but faster' },
  stinger:   { name: 'Stinger', hp: 1,  dmg: 35, reload: 6,   radius: 0.35, count: 1, color: '#333333', flatHp: true,
               desc: 'Fragile, but deals heavy damage.' },
  orange:    { name: 'Orange',  hp: 2,  dmg: 8 / 3, reload: 1, radius: 0.3, count: 3, color: '#eb9c2d',
               desc: 'Pop! Probably tastes good too.' },
  missile:   { name: 'Missile', hp: 2,  dmg: 20, reload: 3,   radius: 0.4,  count: 1, color: '#333333',
               projectile: { speed: 24, life: 1.8 },
               desc: 'pew pew' },
  glass:     { name: 'Glass',   hp: 3,  dmg: 15, reload: 1.5, radius: 0.4,  count: 1, color: '#eaf6fb',
               hitCooldown: 1, speedDmgMult: 2,
               desc: "This one cuts. The faster you go, the more damage is dealt. Can't hit your enemies more than once per second." },
  rice:      { name: 'Rice',    hp: 1,  dmg: 1,  reload: 0.5, radius: 0.28, count: 1, color: '#f2f2ec',
               desc: 'Weak, but reloads almost instantly.' },
  corn:      { name: 'Corn',    hp: 200, dmg: 5, reload: 20,  radius: 0.55, count: 1, color: '#ffe419',
               desc: 'A long respawn time and low damage, but extremely high health.' },
  leaf:      { name: 'Leaf',    hp: 19, dmg: 8, reload: 3,   radius: 0.42, count: 1, color: '#39b54a', heal: 1,
               desc: 'Heals the user passively by a set amount of HP per second.' },
  wing:      { name: 'Wing',    hp: 15, dmg: 10, reload: 4,  radius: 0.45, count: 1, color: '#ffffff',
               desc: 'Ride the wind: glide instead of fall. Pair with Bubble to truly fly.' },
  bubble:    { name: 'Bubble',  hp: 1,  dmg: 0,  reload: 5,  radius: 0.45, count: 1, color: '#dff2fb', flatHp: true,
               desc: 'Press Defend to pop it and launch yourself where you aim. Fragile.' },
};

export const FLIGHT = {
  gravity: 18,
  maxFall: 30,
  glideSink: 2.5,
  sinkRarityMult: 0.88,
  boost: 30,
  boostRarityAdd: 0.18,
  drag: 0.35,
  groundDrag: 6,
  diveRate: 14,
  diveGain: 24,
  climbRate: 18,
  maxBoostSpeed: 40,
  airControl: 0.55,
  maxAlt: 30,
  groundPopPitch: 0.9,
  topdownPopPitch: 0.45,
};

export let ARENA_HALF = 185;

export const PITCH_LIMIT = Math.PI / 2 - 0.12;

export const TILE_SIZE = 20;
export const TILE_TYPES = {
  grass:     { name: 'Grass' },
  water:     { name: 'Water' },
  dirt:      { name: 'Dirt' },
  desert:    { name: 'Desert' },
  jungle:    { name: 'Jungle' },
  dirtWall:  { name: 'Dirt Wall',  isWall: true },
  stoneWall: { name: 'Stone Wall', isWall: true },
};
export const WALL_HEIGHT = 4;
export let MAP_TILES = [
  { gx: 1, gz: 0, type: 'water' },
  { gx: 2, gz: 0, type: 'water' },
];

export let MAP_WALLS = [];
const wallTops = new Map();
export const SPAWN_POS = { x: 0, z: 0 };

const tileTypes = new Map([['1,0', 'water'], ['2,0', 'water']]);

export function isWallCell(gx, gz) {
  return wallTops.has(gx + ',' + gz);
}
export function tileTypeAt(x, z) {
  return tileTypes.get(Math.round(x / TILE_SIZE) + ',' + Math.round(z / TILE_SIZE)) || 'grass';
}
export function wallTopAt(x, z) {
  return wallTops.get(Math.round(x / TILE_SIZE) + ',' + Math.round(z / TILE_SIZE)) || 0;
}

export function collideWalls(pos, radius) {
  if (wallTops.size === 0) return;
  const cgx = Math.round(pos.x / TILE_SIZE);
  const cgz = Math.round(pos.z / TILE_SIZE);
  const half = TILE_SIZE / 2;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const gx = cgx + dx, gz = cgz + dz;
      const top = wallTops.get(gx + ',' + gz);
      if (!top) continue;
      if ((pos.y || 0) >= top - 0.01) continue;
      const cx = gx * TILE_SIZE, cz = gz * TILE_SIZE;
      const px = Math.max(cx - half, Math.min(cx + half, pos.x));
      const pz = Math.max(cz - half, Math.min(cz + half, pos.z));
      const ex = pos.x - px, ez = pos.z - pz;
      const d2 = ex * ex + ez * ez;
      if (d2 >= radius * radius) continue;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        pos.x = px + (ex / d) * radius;
        pos.z = pz + (ez / d) * radius;
      } else {
        const ox = pos.x - cx, oz = pos.z - cz;
        if (Math.abs(ox) > Math.abs(oz)) pos.x = cx + Math.sign(ox || 1) * (half + radius);
        else pos.z = cz + Math.sign(oz || 1) * (half + radius);
      }
    }
  }
}

export function applyMap({ arenaHalf, tiles, walls = {} }) {
  if (typeof arenaHalf !== 'number' || !Number.isFinite(arenaHalf) || !tiles) {
    throw new Error('applyMap: expected a normalized map payload ({ arenaHalf, tiles, walls }), got something else');
  }
  MOB_CAP = Math.min(520, Math.max(56, Math.round(56 * (arenaHalf / 185) ** 2)));
  ARENA_HALF = arenaHalf;
  MAP_TILES = [];
  tileTypes.clear();
  for (const [type, coords] of Object.entries(tiles)) {
    for (let i = 0; i < coords.length; i += 2) {
      MAP_TILES.push({ gx: coords[i], gz: coords[i + 1], type });
      tileTypes.set(coords[i] + ',' + coords[i + 1], type);
    }
  }
  MAP_WALLS = [];
  wallTops.clear();
  for (const [type, cols] of Object.entries(walls)) {
    for (let i = 0; i < cols.length; i += 3) {
      const col = { gx: cols[i], gz: cols[i + 1], h: cols[i + 2], type };
      MAP_WALLS.push(col);
      wallTops.set(col.gx + ',' + col.gz, col.h * WALL_HEIGHT);
    }
  }
  const edge = Math.ceil(ARENA_HALF / TILE_SIZE) - 1;
  SPAWN_POS.x = edge * TILE_SIZE; SPAWN_POS.z = -edge * TILE_SIZE;
  outer: for (let ring = 0; ring <= 2 * edge; ring++) {
    for (let dx = 0; dx <= ring; dx++) {
      for (let dz = 0; dz <= ring; dz++) {
        if (Math.max(dx, dz) !== ring) continue;
        const gx = edge - dx, gz = -edge + dz;
        if (isWallCell(gx, gz)) continue;
        if (tileTypes.has(gx + ',' + gz)) continue;
        SPAWN_POS.x = gx * TILE_SIZE;
        SPAWN_POS.z = gz * TILE_SIZE;
        break outer;
      }
    }
  }
}
export let MOB_CAP = 56;
export const VIEW_RADIUS = 110;
export const PLAYER_BODY_DAMAGE = 10;
export const HIT_COOLDOWN = 0.45;
export const EQUAL_RARITY_DROP_BASE = 0.64;
export const DROP_DAMAGE_FRAC = 0.1;
export const MIN_LOOTERS = 10;
export const SPAWN_IMMUNITY = 3;

export function clampToArena(pos, margin = 0) {
  const half = ARENA_HALF - margin;
  pos.x = Math.max(-half, Math.min(half, pos.x));
  pos.z = Math.max(-half, Math.min(half, pos.z));
}

const RARITY_DEPTH_BIAS = 2.0;
export function pickRarity(rng = Math.random, depth = 0) {
  const weights = RARITIES.map((r, i) => r.weight * RARITY_DEPTH_BIAS ** (i * depth));
  const total = weights.reduce((s, w) => s + w, 0);
  let roll = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return i;
  }
  return 0;
}

export function pickDrop(mobType, rng = Math.random) {
  const drops = MOB_TYPES[mobType].drops;
  const total = drops.reduce((s, [, w]) => s + w, 0);
  let roll = rng() * total;
  for (const [type, w] of drops) {
    roll -= w;
    if (roll <= 0) return type;
  }
  return null;
}
