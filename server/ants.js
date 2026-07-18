import { MOB_TYPES, RARITIES, MOB_CAP, ANT_MAX_SHARE, ANT_TYPES, clampToArena } from '../shared/config.js';

const antCapFull = (mobs) => {
  const antAlive = mobs.mobs.reduce((n, m) => n + (ANT_TYPES.includes(m.type) ? 1 : 0), 0);
  return antAlive >= Math.round(MOB_CAP * ANT_MAX_SHARE);
};

export const ANTHOLE = {
  escort: { baby: 3, worker: 2, soldier: 1 },
  reinforcements: [['baby', 5], ['worker', 8], ['soldier', 26]],
};

const IDLE_DESPAWN_GRACE = 30;
const IDLE_DESPAWN_RADIUS = 60;

export function tickHoleAnt(ant, dt) {
  if (!ant.hole.deadFlag) return;
  const p = ant.world.nearestPlayer(ant.pos);
  if (p && p.pos.distanceTo(ant.pos) < IDLE_DESPAWN_RADIUS) {
    ant.idleTime = 0;
    return;
  }
  ant.idleTime = (ant.idleTime || 0) + dt;
  if (ant.idleTime > IDLE_DESPAWN_GRACE) ant.deadFlag = true;
}

export function spawnHoleAnt(mobs, hole, type, aggro) {
  const angle = Math.random() * Math.PI * 2;
  const dist = hole.radius + MOB_TYPES[type].radius * RARITIES[hole.rarity].scale * 0.6;
  const pos = hole.pos.clone();
  pos.x += Math.sin(angle) * dist;
  pos.z += Math.cos(angle) * dist;
  const ant = mobs.spawn(type, hole.rarity, pos);
  clampToArena(ant.pos, ant.radius);
  ant.aggro = aggro && !ant.def.passive;
  ant.hole = hole;
  return ant;
}

export function spawnEscort(mobs, hole) {
  hole.escortAnts = [];
  for (const [type, n] of Object.entries(ANTHOLE.escort)) {
    for (let i = 0; i < n; i++) {
      if (antCapFull(mobs)) return;
      hole.escortAnts.push(spawnHoleAnt(mobs, hole, type, false));
    }
  }
}

export function releaseGarrison(mobs, hole) {
  for (const ant of hole.escortAnts ?? []) {
    if (!ant.deadFlag && !ant.def.passive) ant.aggro = true;
  }
  hole.reinforced ??= 0;
  const total = ANTHOLE.reinforcements.reduce((sum, [, n]) => sum + n, 0);
  const due = Math.min(total, Math.ceil(
    (1 - Math.max(0, hole.hp) / hole.maxHp) * total));
  while (hole.reinforced < due && !antCapFull(mobs)) {
    let idx = hole.reinforced++;
    for (const [type, n] of ANTHOLE.reinforcements) {
      if (idx < n) { spawnHoleAnt(mobs, hole, type, true); break; }
      idx -= n;
    }
  }
}
