import {
  PETAL_TYPES, RARITIES, VIEW_RADIUS, PITCH_LIMIT,
  CHAT_MAX_LEN, NAME_MAX_LEN, stripNonAscii,
} from '../shared/config.js';
import { censorName, censorMessage } from './censor.js';
import { Player } from './player.js';
import { MobManager } from './mobs.js';
import { DropManager } from './drops.js';
import { updateCombat } from './combat.js';

const r2 = (v) => Math.round(v * 100) / 100;
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const SLOTS = 5;
const CHAT_COOLDOWN_MS = 1200;

export class World {
  constructor() {
    this.time = 0;
    this.events = [];
    this.players = new Map();
    this.mobs = new MobManager(this);
    this.drops = new DropManager(this);
  }

  addPlayer() {
    const player = new Player(this);
    this.players.set(player.id, player);
    return player;
  }

  removePlayer(id) {
    this.players.delete(id);
  }

  spectateTarget(current) {
    if (current?.k === 'player') {
      const p = this.players.get(current.id);
      if (p && !p.dead) return { k: 'player', id: p.id, x: p.pos.x, z: p.pos.z };
    } else if (current?.k === 'mob') {
      const m = this.mobs.mobs.find((m) => m.id === current.id);
      if (m) return { k: 'mob', id: m.id, x: m.pos.x, z: m.pos.z };
    }
    const alive = [...this.players.values()].filter((p) => !p.dead);
    if (alive.length) {
      const p = alive[Math.floor(Math.random() * alive.length)];
      return { k: 'player', id: p.id, x: p.pos.x, z: p.pos.z };
    }
    if (this.mobs.mobs.length) {
      const m = this.mobs.mobs[Math.floor(Math.random() * this.mobs.mobs.length)];
      return { k: 'mob', id: m.id, x: m.pos.x, z: m.pos.z };
    }
    return { k: null, id: null, x: 0, z: 0 };
  }

  nearestPlayer(pos) {
    let best = null;
    let bestD = Infinity;
    for (const p of this.players.values()) {
      if (p.dead) continue;
      const d = p.pos.distanceTo(pos);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  handle(playerId, msg) {
    const player = this.players.get(playerId);
    if (!player || !msg || typeof msg !== 'object') return;
    switch (msg.t) {
      case 'join': {
        if (typeof msg.name !== 'string') return;
        const name = stripNonAscii(msg.name).trim().slice(0, NAME_MAX_LEN);
        player.name = (name && censorName(name)) || 'Guest';
        break;
      }
      case 'input': {
        const i = player.input;
        i.tx = num(msg.tx);
        i.tz = num(msg.tz);
        i.ax = Math.max(-1, Math.min(1, num(msg.ax)));
        i.az = Math.max(-1, Math.min(1, num(msg.az)));
        i.fps = !!msg.fps;
        i.yaw = num(msg.yaw);
        i.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, num(msg.pitch)));
        i.atk = !!msg.atk;
        i.def = !!msg.def;
        break;
      }
      case 'swapSlot': {
        const i = msg.i;
        if (Number.isInteger(i) && i >= 0 && i < SLOTS) player.petals.swapSlot(i);
        break;
      }
      case 'swapRows':
        player.petals.swapRows();
        break;
      case 'rotSpeed':
        player.petals.changeRotSpeed(Math.max(-1, Math.min(1, num(msg.delta))));
        break;
      case 'equip': {
        const { row, i, key } = msg;
        if ((row !== 'primary' && row !== 'secondary') || !Number.isInteger(i) || i < 0 || i >= SLOTS) return;
        if (typeof key !== 'string') return;
        const item = player.takeFromInventory(key);
        if (!item || !PETAL_TYPES[item.type] || !RARITIES[item.rarity]) return;
        const old = player.petals.equip(row, i, item);
        if (old) player.addToInventory(old.type, old.rarity, true);
        break;
      }
      case 'chat': {
        if (typeof msg.text !== 'string') return;
        const now = Date.now();
        if (now - player.lastChatAt < CHAT_COOLDOWN_MS) return;
        const text = stripNonAscii(msg.text).trim().slice(0, CHAT_MAX_LEN);
        if (!text) return;
        player.lastChatAt = now;
        this.events.push({ e: 'chat', id: player.id, x: player.pos.x, z: player.pos.z, text: censorMessage(text) });
        break;
      }
    }
  }

  tick(dt) {
    this.time += dt;
    for (const player of this.players.values()) {
      player.update(dt);
      player.petals.update(dt);
    }
    this.mobs.update(dt);
    this.drops.update(dt);
    updateCombat(this, dt);
  }

  buildTick(spectators = []) {
    const r2c = r2;
    const posEvents = this.events.filter((ev) => typeof ev.x === 'number');
    const globalEvents = this.events.filter((ev) => typeof ev.x !== 'number');
    const R2 = VIEW_RADIUS * VIEW_RADIUS;
    const nearEvents = (px, pz) =>
      posEvents.filter((ev) => (ev.x - px) ** 2 + (ev.z - pz) ** 2 <= R2);

    const players = [...this.players.values()];
    const entities = {
      players,
      mobs: this.mobs.mobs,
      missiles: this.mobs.missiles,
      pmissiles: players.flatMap((p) => p.petals.projectiles),
      drops: this.drops.drops,
    };

    const alive = players.filter((pl) => !pl.dead);
    const views = new Map();
    for (const p of players) {
      const px = p.pos.x, pz = p.pos.z;
      const others = alive
        .filter((o) => o.id !== p.id)
        .map((o) => ({ o, d: (o.pos.x - px) ** 2 + (o.pos.z - pz) ** 2 }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 3)
        .map(({ o }) => ({ name: o.name, x: r2c(o.pos.x), z: r2c(o.pos.z) }));
      const view = {
        px, pz, you: p.id, time: r2c(this.time), others,
        events: [...p.events, ...globalEvents, ...nearEvents(px, pz)].slice(0, 80),
      };
      if (p.xpDirty) {
        view.xp = Math.floor(p.xp);
        view.xpNext = p.xpForNext();
        p.xpDirty = false;
      }
      if (p.invDirty) {
        view.inventory = [...p.inventory.entries()];
        p.invDirty = false;
      }
      views.set(p.id, view);
    }
    for (const s of spectators) {
      views.set(s.key, {
        px: s.x, pz: s.z, you: null, spec: { k: s.k, id: s.id },
        time: r2c(this.time),
        events: [...globalEvents, ...nearEvents(s.x, s.z)].slice(0, 80),
      });
    }
    this.events = [];
    for (const p of players) p.events = [];
    return { entities, views };
  }

  buildSnapshots(spectators = []) {
    const tag = (list, entryOf) => list.map((o) => {
      const pos = o.pos;
      return { x: pos.x, z: pos.z, entry: entryOf(o) };
    });

    const playerEntries = tag([...this.players.values()], (p) => ({
      id: p.id, name: p.name,
      x: r2(p.pos.x), y: r2(p.pos.y), z: r2(p.pos.z), facing: r2(p.facing),
      hp: r2(p.hp), maxHp: p.maxHp, level: p.level,
      dead: p.dead, deadTimer: r2(p.deadTimer),
      ...(p.immunity > 0 ? { imm: true } : {}),
      petals: {
        rotFactor: p.petals.rotFactor,
        primary: p.petals.primary,
        secondary: p.petals.secondary,
        instances: p.petals.instances.map((inst) => ({
          id: inst.id, slot: inst.slotIdx, type: inst.type, rarity: inst.rarity,
          alive: inst.alive, x: r2(inst.pos.x), z: r2(inst.pos.z),
          cd: inst.alive ? 0 : r2(Math.min(1, Math.max(0, inst.cooldown / inst.reload))),
        })),
      },
    }));

    const mobEntries = tag(this.mobs.mobs, (m) => ({
      id: m.id, type: m.type, rarity: m.rarity,
      x: r2(m.pos.x), z: r2(m.pos.z), facing: r2(m.facing),
      hp: r2(m.hp), maxHp: r2(m.maxHp),
      ...(m.flight ? { y: r2(m.pos.y), pitch: r2(m.pitch), loaded: m.loaded } : {}),
    }));

    const missileEntries = tag(this.mobs.missiles, (mi) => ({
      id: mi.id, rarity: mi.rarity,
      x: r2(mi.pos.x), y: r2(mi.pos.y), z: r2(mi.pos.z),
      yaw: r2(mi.yaw), pitch: r2(mi.pitch),
    }));

    const pmissileEntries = [...this.players.values()].flatMap((p) =>
      tag(p.petals.projectiles, (proj) => ({
        id: proj.id, type: proj.type, rarity: proj.rarity,
        x: r2(proj.pos.x), y: r2(proj.pos.y), z: r2(proj.pos.z),
        yaw: r2(proj.yaw), pitch: r2(proj.pitch),
      })));

    const dropEntries = this.drops.drops.map((d) => ({
      x: d.pos.x, z: d.pos.z, owner: d.owner,
      entry: { id: d.id, type: d.type, rarity: d.rarity, x: r2(d.pos.x), z: r2(d.pos.z) },
    }));

    const posEvents = this.events.filter((ev) => typeof ev.x === 'number');
    const globalEvents = this.events.filter((ev) => typeof ev.x !== 'number');

    const R2 = VIEW_RADIUS * VIEW_RADIUS;
    const near = (list, px, pz) => {
      const outList = [];
      for (const e of list) {
        const dx = e.x - px, dz = e.z - pz;
        if (dx * dx + dz * dz <= R2) outList.push(e.entry ?? e);
      }
      return outList;
    };

    const alive = [...this.players.values()].filter((pl) => !pl.dead);
    const out = new Map();
    for (const p of this.players.values()) {
      const px = p.pos.x, pz = p.pos.z;
      const others = alive
        .filter((o) => o.id !== p.id)
        .map((o) => ({ o, d: (o.pos.x - px) ** 2 + (o.pos.z - pz) ** 2 }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 3)
        .map(({ o }) => ({ name: o.name, x: r2(o.pos.x), z: r2(o.pos.z) }));
      const snap = {
        t: 'state',
        time: r2(this.time),
        you: p.id,
        players: near(playerEntries, px, pz),
        mobs: near(mobEntries, px, pz),
        missiles: near(missileEntries, px, pz),
        pmissiles: near(pmissileEntries, px, pz),
        drops: near(dropEntries.filter((d) => d.owner === p.id), px, pz),
        others,
        events: [...globalEvents, ...near(posEvents, px, pz), ...p.events],
      };
      if (p.xpDirty) {
        snap.xp = Math.floor(p.xp);
        snap.xpNext = p.xpForNext();
        p.xpDirty = false;
      }
      if (p.invDirty) {
        snap.inventory = [...p.inventory.entries()];
        p.invDirty = false;
      }
      out.set(p.id, snap);
    }
    for (const s of spectators) {
      out.set(s.key, {
        t: 'state',
        time: r2(this.time),
        you: null,
        spec: { k: s.k, id: s.id },
        players: near(playerEntries, s.x, s.z),
        mobs: near(mobEntries, s.x, s.z),
        missiles: near(missileEntries, s.x, s.z),
        pmissiles: near(pmissileEntries, s.x, s.z),
        drops: [],
        events: [...globalEvents, ...near(posEvents, s.x, s.z)],
      });
    }
    this.events = [];
    for (const p of this.players.values()) p.events = [];
    return out;
  }
}
