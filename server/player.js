import * as THREE from 'three';
import {
  PETAL_TYPES, RARITIES, TILE_TYPES, SPAWN_IMMUNITY, SPAWN_POS, FLIGHT,
  clampToArena, collideWalls, tileTypeAt,
} from '../shared/config.js';
import { uid } from './utils.js';
import { PetalManager } from './petals.js';
import { updateFlight, groundYAt } from './flight.js';

const maxHpForLevel = (level) => 200 + (level - 1) * 6;

export class Player {
  constructor(world) {
    this.world = world;
    this.id = uid();
    this.name = 'Guest';
    this.input = { tx: 0, tz: 0, ax: 0, az: 0, fps: false, yaw: 0, pitch: 0, atk: false, def: false };
    this.inventory = new Map();
    this.events = [];
    this.invDirty = true;
    this.xpDirty = true;
    this.pos = new THREE.Vector3(SPAWN_POS.x, 0, SPAWN_POS.z);
    this.radius = 1.1;
    this.maxHp = maxHpForLevel(1);
    this.hp = this.maxHp;
    this.speed = 13;
    this.moveSpeed = 0;
    this.regen = 2;
    this.level = 1;
    this.xp = 0;
    this.dead = false;
    this.deadTimer = 0;
    this.immunity = SPAWN_IMMUNITY;
    this.hitCooldowns = new Map();
    this.knock = new THREE.Vector3();
    this.flightVel = new THREE.Vector3();
    this.prevDef = false;
    this.facing = 0;
    this.zoneToasts = new Set();
    this.lastChatAt = 0;
    this.petals = new PetalManager(world, this);
  }

  toast(text) { this.events.push({ e: 'toast', text }); }

  serializeSave() {
    return {
      v: 1,
      level: this.level,
      xp: Math.floor(this.xp),
      inventory: [...this.inventory.entries()],
      primary: this.petals.primary,
      secondary: this.petals.secondary,
    };
  }

  applySave(save) {
    if (!save || save.v !== 1) return;
    const slot = (s) => (s && PETAL_TYPES[s.type] && RARITIES[s.rarity]
      ? { type: s.type, rarity: s.rarity } : null);
    if (Number.isInteger(save.level) && save.level >= 1) this.level = Math.min(save.level, 200);
    this.maxHp = maxHpForLevel(this.level);
    this.hp = this.maxHp;
    if (Number.isFinite(save.xp) && save.xp >= 0) this.xp = save.xp;
    if (Array.isArray(save.inventory)) {
      for (const [key, count] of save.inventory) {
        if (typeof key !== 'string' || !Number.isInteger(count) || count <= 0) continue;
        const [type, rarity] = key.split(':');
        if (PETAL_TYPES[type] && RARITIES[Number(rarity)]) this.inventory.set(key, count);
      }
    }
    if (Array.isArray(save.primary)) {
      this.petals.primary = this.petals.primary.map((cur, i) => slot(save.primary[i]) ?? cur);
    }
    if (Array.isArray(save.secondary)) {
      this.petals.secondary = this.petals.secondary.map((cur, i) => slot(save.secondary[i]));
    }
    this.invDirty = true;
    this.xpDirty = true;
    this.petals.rebuildAll();
  }

  addToInventory(type, rarity, silent = false) {
    const key = `${type}:${rarity}`;
    this.inventory.set(key, (this.inventory.get(key) || 0) + 1);
    this.invDirty = true;
    if (!silent) this.toast(`+ ${RARITIES[rarity].name} ${PETAL_TYPES[type].name}`);
  }

  takeFromInventory(key) {
    const n = this.inventory.get(key) || 0;
    if (n <= 0) return null;
    if (n === 1) this.inventory.delete(key); else this.inventory.set(key, n - 1);
    this.invDirty = true;
    const [type, rarity] = key.split(':');
    return { type, rarity: Number(rarity) };
  }

  xpForNext() { return Math.floor(60 * Math.pow(1.25, this.level - 1)); }

  gainXp(amount) {
    this.xp += amount;
    this.xpDirty = true;
    while (this.xp >= this.xpForNext()) {
      this.xp -= this.xpForNext();
      this.level++;
      const prev = this.maxHp;
      this.maxHp = maxHpForLevel(this.level);
      this.hp += this.maxHp - prev;
      this.toast(`Level ${this.level}!`);
    }
  }

  damage(amount) {
    if (this.dead || this.immunity > 0) return;
    this.hp -= amount;
    this.world.events.push({ e: 'flash', k: 'player', id: this.id });
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.deadTimer = 3;
    }
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  update(dt) {
    const input = this.input;

    if (this.dead) {
      this.deadTimer -= dt;
      if (this.deadTimer <= 0) {
        this.dead = false;
        this.hp = this.maxHp;
        this.pos.set(SPAWN_POS.x, 0, SPAWN_POS.z);
        this.knock.set(0, 0, 0);
        this.flightVel.set(0, 0, 0);
        this.immunity = SPAWN_IMMUNITY;
      }
      return;
    }

    if (this.immunity > 0) {
      this.immunity = input.atk ? 0 : Math.max(0, this.immunity - dt);
    }

    this.heal(this.regen * dt);

    const prevX = this.pos.x, prevZ = this.pos.z;

    const airborne = this.pos.y > groundYAt(this) + 0.01;
    const speed = this.speed * (airborne ? FLIGHT.airControl : 1);

    if (input.fps) {
      const yaw = input.yaw;
      let { ax, az } = input;
      const len = Math.hypot(ax, az);
      if (len > 1) { ax /= len; az /= len; }
      if (ax !== 0 || az !== 0) {
        const dirX = -Math.sin(yaw) * az + Math.cos(yaw) * ax;
        const dirZ = -Math.cos(yaw) * az - Math.sin(yaw) * ax;
        this.pos.x += dirX * speed * dt;
        this.pos.z += dirZ * speed * dt;
        this.facing = Math.atan2(dirX, dirZ);
      } else {
        this.facing = yaw + Math.PI;
      }
    } else {
      const delta = new THREE.Vector3(input.tx - this.pos.x, 0, input.tz - this.pos.z);
      const dist = delta.length();
      if (dist > 0.6) {
        const speedFrac = Math.min(1, dist / 8);
        delta.normalize().multiplyScalar(speed * speedFrac * dt);
        this.pos.add(delta);
        this.facing = Math.atan2(delta.x, delta.z);
      }
    }
    this.pos.addScaledVector(this.knock, dt);
    this.knock.multiplyScalar(Math.exp(-6 * dt));
    updateFlight(this, dt);
    clampToArena(this.pos, this.radius);
    collideWalls(this.pos, this.radius);
    this.moveSpeed = dt > 0 ? Math.hypot(this.pos.x - prevX, this.pos.z - prevZ) / dt : 0;

    const tile = tileTypeAt(this.pos.x, this.pos.z);
    if (tile !== 'grass' && tile !== 'water' && !this.zoneToasts.has(tile)) {
      this.zoneToasts.add(tile);
      this.toast(`${TILE_TYPES[tile]?.name ?? tile} mobs aren't ready yet, coming soon!`);
    }
  }
}
