import * as THREE from 'three';
import {
  MOB_TYPES, RARITIES, MOB_CAP, ANT_MAX_SHARE, ANT_TYPES, ARENA_HALF, TILE_SIZE, SPAWN_POS,
  DROP_DAMAGE_FRAC, MIN_LOOTERS, EQUAL_RARITY_DROP_BASE, VIEW_RADIUS,
  clampToArena, collideWalls, isWallCell, wallTopAt,
  tileTypeAt, pickRarity, pickDrop,
} from '../shared/config.js';

const STALE_RECYCLE_AFTER = 600;
const STALE_SWEEP_INTERVAL = 5;
const ACTIVE_RADIUS = VIEW_RADIUS + 80;

const SAFE_RING = 60;
const SAFE_RING_MAX_RARITY = 2;
import { uid, damp } from './utils.js';
import { notifyUltraSpawn } from './discord.js';
import { spawnEscort, releaseGarrison, tickHoleAnt } from './ants.js';

const HORNET_WALL_CLEARANCE = 1.5;
const HORNET_WALL_AVOID_RANGE = TILE_SIZE * 1.1;

function hornetWallPush(pos) {
  const cgx = Math.round(pos.x / TILE_SIZE);
  const cgz = Math.round(pos.z / TILE_SIZE);
  const push = new THREE.Vector3();
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const gx = cgx + dx, gz = cgz + dz;
      const top = wallTopAt(gx * TILE_SIZE, gz * TILE_SIZE);
      if (top === 0 || pos.y > top + HORNET_WALL_CLEARANCE) continue;
      const cx = gx * TILE_SIZE, cz = gz * TILE_SIZE;
      const ex = pos.x - cx, ez = pos.z - cz;
      const d = Math.hypot(ex, ez) || 1;
      if (d < HORNET_WALL_AVOID_RANGE) {
        push.add(new THREE.Vector3(ex / d, 0, ez / d)
          .multiplyScalar((HORNET_WALL_AVOID_RANGE - d) / HORNET_WALL_AVOID_RANGE));
      }
    }
  }
  return push;
}

const HORNET = {
  aggroRange: 30,
  cruiseAlt: 5,
  volleyAlt: 5.5,
  swoopAlt: 0.6,
  standoff: 13,
  fireRange: 45,
  fireInterval: 2.2,
  regrowTime: 0.9,
  swoopSpeedMult: 1.8,
  swoopOvershoot: 18,
  swoopMaxTime: 8,
};

class Mob {
  constructor(world, type, rarityIdx, pos) {
    this.world = world;
    this.id = uid();
    this.type = type;
    this.def = MOB_TYPES[type];
    this.rarity = rarityIdx;
    const r = RARITIES[rarityIdx];
    this.maxHp = this.def.hp * r.statMult;
    this.hp = this.maxHp;
    this.dmg = this.def.dmg * r.dmgMult;
    this.armor = this.def.armor * r.armorMult;
    this.radius = this.def.radius * r.scale;
    this.speed = this.def.speed;
    this.xp = this.def.xp * r.statMult;

    this.pos = pos.clone();
    this.heading = Math.random() * Math.PI * 2;
    this.facing = this.heading;
    this.wanderTimer = 0;
    this.sinePhase = Math.random() * Math.PI * 2;
    this.aggro = false;
    this.knock = new THREE.Vector3();
    this.hitCooldowns = new Map();
    this.deadFlag = false;
    this.active = true;
    this.damageBy = new Map();

    if (this.type === 'hornet') {
      this.pos.y = HORNET.cruiseAlt + this.radius;
      this.pitch = 0;
      this.loaded = true;
      this.strafeDir = Math.random() < 0.5 ? 1 : -1;
      this.flight = { state: 'cruise', shots: 0, fireTimer: 0, regrow: 0, timer: 0, target: new THREE.Vector3() };
    }
  }

  damage(amount, source = null, attacker = null) {
    const dealt = Math.max(1, amount - this.armor);
    this.hp -= dealt;
    if (attacker) this.damageBy.set(attacker.id, (this.damageBy.get(attacker.id) || 0) + dealt);
    this.world.events.push({ e: 'flash', k: 'mob', id: this.id });
    this.world.events.push({
      e: 'dmg', a: Math.round(dealt),
      x: Math.round(this.pos.x * 100) / 100, z: Math.round(this.pos.z * 100) / 100,
    });
    if (!this.def.passive && (this.rarity >= 2 || this.def.retaliates)) this.aggro = true;
    if (source && this.speed > 0) {
      const push = this.pos.clone().sub(source).setY(0).normalize().multiplyScalar(9);
      this.knock.add(push);
    }
    if (this.type === 'anthole') releaseGarrison(this.world.mobs, this);
    if (this.hp <= 0) this.die();
  }

  die() {
    if (this.deadFlag) return;
    this.deadFlag = true;
    const connected = [...this.damageBy]
      .filter(([id]) => this.world.players.has(id))
      .sort((a, b) => b[1] - a[1]);
    const total = connected.reduce((sum, [, dmg]) => sum + dmg, 0);
    const owners = connected.filter(([, dmg], rank) =>
      rank < MIN_LOOTERS || dmg >= total * DROP_DAMAGE_FRAC);
    if (owners.length > 0) {
      for (const [id] of owners) this.world.players.get(id).gainXp(this.xp);
    } else {
      const killer = this.world.nearestPlayer(this.pos);
      if (killer) killer.gainXp(this.xp);
    }
    const dropType = pickDrop(this.type);
    if (!dropType || connected.length === 0) return;
    for (const [id] of owners) {
      const equal = Math.random() < EQUAL_RARITY_DROP_BASE / 2 ** this.rarity;
      const rarity = equal ? this.rarity : Math.max(0, this.rarity - 1);
      this.world.drops.spawn(dropType, rarity, this.pos, id);
    }
  }

  update(dt) {
    if (this.hole) tickHoleAnt(this, dt);
    if (this.deadFlag) return;
    if (this.active) {
      if (this.type === 'hornet') this.updateHornet(dt);
      else this.updateGround(dt);
    }

    this.pos.addScaledVector(this.knock, dt);
    this.knock.multiplyScalar(Math.exp(-6 * dt));
    clampToArena(this.pos, this.radius);
    if (!this.flight) collideWalls(this.pos, this.radius);
  }

  updateGround(dt) {
    const player = this.world.nearestPlayer(this.pos);
    let vel = new THREE.Vector3();

    if (this.def.sightAggro) {
      const d = player ? this.pos.distanceTo(player.pos) : Infinity;
      if (d < this.def.sightAggro) this.aggro = true;
      else if (d > this.def.leash) this.aggro = false;
    }

    if (this.speed > 0) {
      if (this.aggro && player) {
        const toPlayer = player.pos.clone().sub(this.pos).setY(0);
        if (toPlayer.lengthSq() > 0.01) toPlayer.normalize();
        if (this.type === 'bee') {
          this.sinePhase += dt * 6;
          const perp = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x);
          vel = toPlayer.add(perp.multiplyScalar(Math.sin(this.sinePhase) * 0.8))
            .normalize().multiplyScalar(this.speed * 3);
        } else {
          vel = toPlayer.multiplyScalar(this.speed * 1.8);
        }
      } else {
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
          this.wanderTimer = 2 + Math.random() * 3;
          this.heading = Math.random() * Math.PI * 2;
        }
        let dir = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
        if (this.type === 'bee') {
          this.sinePhase += dt * 3;
          const perp = new THREE.Vector3(-dir.z, 0, dir.x);
          dir = dir.add(perp.multiplyScalar(Math.sin(this.sinePhase) * 0.6)).normalize();
        }
        vel = dir.multiplyScalar(this.speed);
      }
      this.pos.addScaledVector(vel, dt);
    }

    if (vel.lengthSq() > 0.01) this.facing = Math.atan2(vel.x, vel.z);
  }

  updateHornet(dt) {
    const player = this.world.nearestPlayer(this.pos);
    const f = this.flight;
    const toPlayer = player ? player.pos.clone().sub(this.pos).setY(0) : new THREE.Vector3();
    const hDist = player ? toPlayer.length() : Infinity;
    if (player && hDist > 0.01) toPlayer.multiplyScalar(1 / hDist);

    if (!player) {
      this.aggro = false;
      f.state = 'cruise';
    } else if (hDist < HORNET.aggroRange) {
      this.aggro = true;
    }

    let vel = new THREE.Vector3();
    let altTarget = HORNET.cruiseAlt + this.radius;
    let altRate = 2.2;

    if (f.state === 'cruise') {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 2 + Math.random() * 3;
        this.heading = Math.random() * Math.PI * 2;
      }
      vel.set(Math.sin(this.heading), 0, Math.cos(this.heading)).multiplyScalar(this.speed);
      this.facing = Math.atan2(vel.x, vel.z);
      if (this.aggro) {
        f.state = 'volley';
        f.shots = 2 + this.rarity;
        f.fireTimer = 1.2;
      }
    } else if (f.state === 'volley') {
      altTarget = HORNET.volleyAlt + this.radius;
      const inRing = hDist < HORNET.standoff + 2;
      if (!inRing) {
        vel.copy(toPlayer).multiplyScalar(this.speed * 1.6);
      } else if (hDist < HORNET.standoff - 2) {
        vel.copy(toPlayer).multiplyScalar(-this.speed * 1.6);
      } else {
        vel.set(-toPlayer.z, 0, toPlayer.x).multiplyScalar(this.speed * 0.7 * this.strafeDir);
      }
      this.facing = inRing
        ? Math.atan2(-toPlayer.x, -toPlayer.z)
        : Math.atan2(toPlayer.x, toPlayer.z);

      f.regrow -= dt;
      if (f.regrow <= 0) this.loaded = true;
      f.fireTimer -= dt;
      if (f.fireTimer <= 0 && this.loaded && inRing && hDist < HORNET.fireRange) {
        this.world.mobs.fireMissile(this, player);
        this.loaded = false;
        f.regrow = HORNET.regrowTime;
        f.fireTimer = HORNET.fireInterval;
        f.shots--;
        if (f.shots <= 0) {
          f.state = 'swoop';
          f.timer = HORNET.swoopMaxTime;
          f.target.copy(player.pos).addScaledVector(toPlayer, HORNET.swoopOvershoot).setY(0);
        }
      }
    } else {
      altTarget = HORNET.swoopAlt;
      altRate = 3.2;
      const toTarget = f.target.clone().sub(this.pos).setY(0);
      const dist = toTarget.length();
      if (dist > 0.01) vel.copy(toTarget.multiplyScalar(1 / dist)).multiplyScalar(this.speed * HORNET.swoopSpeedMult);
      this.facing = Math.atan2(vel.x, vel.z);
      f.timer -= dt;
      if (dist < 2.5 || f.timer <= 0) {
        f.state = this.aggro ? 'volley' : 'cruise';
        f.shots = 2 + this.rarity;
        f.fireTimer = 1.4;
      }
    }

    const wallPush = hornetWallPush(this.pos);
    if (wallPush.lengthSq() > 0) vel.add(wallPush.multiplyScalar(this.speed * 2.5));

    this.pos.addScaledVector(vel, dt);
    const prevY = this.pos.y;
    this.pos.y += (altTarget - this.pos.y) * damp(altRate, dt);

    const vy = (this.pos.y - prevY) / Math.max(dt, 1e-6);
    const targetPitch = Math.atan2(-vy, Math.max(vel.length(), 2));
    this.pitch += (targetPitch - this.pitch) * damp(6, dt);
  }
}

export class MobManager {
  constructor(world) {
    this.world = world;
    this.mobs = [];
    this.missiles = [];
    this.spawnTimer = 0;
    this.staleTimer = STALE_SWEEP_INTERVAL;
    const initial = Math.floor(MOB_CAP * 0.8);
    for (let i = 0; i < initial; i++) this.trySpawn();
  }

  pickType() {
    const alive = {};
    for (const m of this.mobs) alive[m.type] = (alive[m.type] || 0) + 1;
    const capOf = (def) => Math.max(def.maxAlive, Math.round(def.maxAlive * MOB_CAP / 56));
    const antCap = Math.round(MOB_CAP * ANT_MAX_SHARE);
    const antAlive = ANT_TYPES.reduce((sum, t) => sum + (alive[t] || 0), 0);
    const entries = Object.entries(MOB_TYPES)
      .filter(([type, def]) => !def.maxAlive || (alive[type] || 0) < capOf(def))
      .filter(([type]) => !ANT_TYPES.includes(type) || antAlive < antCap);
    let total = 0;
    for (const [, def] of entries) total += def.spawnWeight ?? 1;
    let r = Math.random() * total;
    for (const [type, def] of entries) {
      r -= def.spawnWeight ?? 1;
      if (r <= 0) return type;
    }
    return entries[0][0];
  }

  trySpawn() {
    if (this.mobs.length >= MOB_CAP) return;
    const players = [...this.world.players.values()];
    for (let attempt = 0; attempt < 20; attempt++) {
      const pos = new THREE.Vector3(
        (Math.random() * 2 - 1) * (ARENA_HALF - 8), 0,
        (Math.random() * 2 - 1) * (ARENA_HALF - 8)
      );
      if (tileTypeAt(pos.x, pos.z) !== 'grass') continue;
      if (isWallCell(Math.round(pos.x / TILE_SIZE), Math.round(pos.z / TILE_SIZE))) continue;
      if (players.some((p) => pos.distanceTo(p.pos) < 30)) continue;
      const dist = Math.hypot(pos.x - SPAWN_POS.x, pos.z - SPAWN_POS.z);
      const maxDist = Math.hypot(ARENA_HALF + Math.abs(SPAWN_POS.x), ARENA_HALF + Math.abs(SPAWN_POS.z));
      let rarity = pickRarity(Math.random, Math.min(1, dist / maxDist));
      if (dist < SAFE_RING) rarity = Math.min(rarity, SAFE_RING_MAX_RARITY);
      const aliveByRarity = new Array(RARITIES.length).fill(0);
      for (const m of this.mobs) aliveByRarity[m.rarity]++;
      const tierFull = (r) => RARITIES[r].maxShare !== undefined &&
        aliveByRarity[r] >= Math.max(1, Math.round(RARITIES[r].maxShare * MOB_CAP));
      while (rarity > 0 && tierFull(rarity)) rarity--;
      const type = this.pickType();
      const mob = this.spawn(type, rarity, pos);
      if (type === 'anthole') spawnEscort(this, mob);
      if (rarity === RARITIES.length - 1) notifyUltraSpawn(MOB_TYPES[type].name);
      return;
    }
  }

  spawn(type, rarity, pos) {
    const mob = new Mob(this.world, type, rarity, pos);
    this.mobs.push(mob);
    return mob;
  }

  fireMissile(hornet, player) {
    const r = RARITIES[hornet.rarity];
    const mdef = hornet.def.missile;
    const target = new THREE.Vector3(player.pos.x, player.pos.y + 1.1, player.pos.z);
    const aim = target.clone().sub(hornet.pos).setY(0).normalize();
    const origin = hornet.pos.clone().addScaledVector(aim, hornet.radius * 1.2);
    const vel = target.sub(origin).normalize().multiplyScalar(mdef.speed);
    this.missiles.push({
      id: uid(),
      pos: origin,
      vel,
      radius: mdef.radius * r.scale,
      hp: mdef.hp * r.statMult,
      dmg: mdef.dmg * r.dmgMult,
      rarity: hornet.rarity,
      life: 4,
      yaw: Math.atan2(vel.x, vel.z),
      pitch: Math.atan2(-vel.y, Math.hypot(vel.x, vel.z)),
      dead: false,
    });
  }

  update(dt) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.25;
      this.trySpawn();
    }

    for (const mob of this.mobs) mob.update(dt);

    this.staleTimer -= dt;
    if (this.staleTimer <= 0) {
      this.staleTimer = STALE_SWEEP_INTERVAL;
      const alive = [...this.world.players.values()].filter((p) => !p.dead);
      const r2 = VIEW_RADIUS * VIEW_RADIUS;
      const activeR2 = ACTIVE_RADIUS * ACTIVE_RADIUS;
      for (const m of this.mobs) {
        if (alive.some((p) => p.pos.distanceToSquared(m.pos) < r2)) {
          m.lonely = 0;
        } else {
          m.lonely = (m.lonely || 0) + STALE_SWEEP_INTERVAL;
          if (m.lonely >= STALE_RECYCLE_AFTER) m.deadFlag = true;
        }
        m.active = alive.some((p) => p.pos.distanceToSquared(m.pos) < activeR2);
      }
    }

    const CELL = 24;
    const grid = new Map();
    const keys = new Array(this.mobs.length);
    for (let i = 0; i < this.mobs.length; i++) {
      const m = this.mobs[i];
      const key = Math.floor(m.pos.x / CELL) + ',' + Math.floor(m.pos.z / CELL);
      keys[i] = key;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(i);
    }
    for (let i = 0; i < this.mobs.length; i++) {
      const a = this.mobs[i];
      const [cx, cz] = keys[i].split(',').map(Number);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const bucket = grid.get((cx + dx) + ',' + (cz + dz));
          if (!bucket) continue;
          for (const j of bucket) {
            if (j <= i) continue;
            const b = this.mobs[j];
            const d = a.pos.distanceTo(b.pos);
            const min = a.radius + b.radius;
            if (d < min && d > 0.001) {
              const push = b.pos.clone().sub(a.pos).setY(0).normalize()
                .multiplyScalar((min - d) * 0.5);
              if (a.speed > 0) a.pos.sub(push);
              if (b.speed > 0) b.pos.add(push);
            }
          }
        }
      }
    }

    this.mobs = this.mobs.filter((m) => !m.deadFlag);

    for (const mi of this.missiles) {
      mi.pos.addScaledVector(mi.vel, dt);
      mi.life -= dt;
      if (mi.life <= 0 || mi.pos.y <= 0.05 ||
          mi.pos.y < wallTopAt(mi.pos.x, mi.pos.z) ||
          Math.max(Math.abs(mi.pos.x), Math.abs(mi.pos.z)) > ARENA_HALF + 4) {
        mi.dead = true;
      }
    }
    this.missiles = this.missiles.filter((m) => !m.dead);
  }
}
