import { WebSocketServer } from 'ws';
import { DeltaEncoder, decodeCmd } from '../shared/protocol.js';
import { Governor } from './governor.js';
import { isBannedName } from './censor.js';
import { verifyJoinToken } from './jointoken.js';
import { World } from './world.js';
import { sessionFromCookie } from './auth.js';
import { loadSave, writeSave } from './db.js';
import { clientIp } from './utils.js';
import { PETAL_TYPES, RARITIES } from '../shared/config.js';

let starterPetals = null;
function getStarterPetals() {
  starterPetals ??= (process.env.DEV_STARTER_PETALS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [type, rarity] = s.split(':');
      return { type, rarity: Number(rarity) || 0 };
    })
    .filter((e) => PETAL_TYPES[e.type] && RARITIES[e.rarity]);
  return starterPetals;
}

const TICK_MS = 1000 / 20;
const AUTOSAVE_MS = 60_000;
const HEARTBEAT_MS = 30_000;
const MAX_BUFFERED = 1_000_000;
const MAX_CONNS_PER_IP = 2;
const MAX_ACTIVE_SPECTATORS = 60;
const SPECTATOR_IDLE_TIMEOUT_MS = 120_000;
const MAX_SPECTATORS_TOTAL = 150;

export function attachGameServer(httpServer, path = '/ws') {
  const wss = new WebSocketServer({
    noServer: true,
    perMessageDeflate: {
      serverNoContextTakeover: true,
      clientNoContextTakeover: true,
      zlibDeflateOptions: { level: 1 },
      threshold: 8192,
    },
  });
  const world = new World();
  const sockets = new Map();
  const spectators = new Map();
  const accounts = new Map();
  const ipCounts = new Map();
  let nextSpecKey = 1;

  setInterval(() => {
    for (const [playerId, accountId] of accounts) {
      const player = world.players.get(playerId);
      if (player) writeSave(accountId, player.serializeSave());
    }
  }, AUTOSAVE_MS);

  httpServer.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname !== path) return;
    if ((ipCounts.get(clientIp(req)) || 0) >= MAX_CONNS_PER_IP) {
      socket.write('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    if (spectators.size >= MAX_SPECTATORS_TOTAL) {
      socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  const perf = { n: 0, sim: 0, build: 0, send: 0, max: 0, bytes: 0 };
  setInterval(() => {
    if (perf.n === 0) return;
    const ms = (v) => (v / perf.n).toFixed(1);
    console.log(`[tick] players=${world.players.size} spectators=${spectators.size} ` +
      `avg=${ms(perf.sim + perf.build + perf.send)}ms ` +
      `(sim=${ms(perf.sim)} build=${ms(perf.build)} send=${ms(perf.send)}) ` +
      `max=${perf.max.toFixed(1)}ms of ${TICK_MS.toFixed(1)}ms budget ` +
      `out=${(perf.bytes / perf.n / 1024).toFixed(1)}KB/tick`);
    perf.n = perf.sim = perf.build = perf.send = perf.max = perf.bytes = 0;

    const now = Date.now();
    const buckets = { under30s: 0, s30to120: 0, over120sSilent: 0, everMessaged: 0 };
    for (const spec of spectators.values()) {
      const age = now - spec.connectedAt;
      if (spec.everMessaged) buckets.everMessaged++;
      else if (age < 30_000) buckets.under30s++;
      else if (age < 120_000) buckets.s30to120++;
      else buckets.over120sSilent++;
    }
    console.log(`[spec-breakdown] total=${spectators.size} everMessaged=${buckets.everMessaged} ` +
      `silent<30s=${buckets.under30s} silent30-120s=${buckets.s30to120} silent>120s=${buckets.over120sSilent}`);
  }, 60_000);

  const encoder = new DeltaEncoder();
  const gov = new Governor(TICK_MS);
  let last = performance.now();
  let tickNo = 0;
  setInterval(() => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (world.players.size === 0 && spectators.size === 0) return;
    const t0 = performance.now();
    world.tick(dt);
    const t1 = performance.now();
    tickNo++;
    const playerTick = tickNo % gov.playerEvery === 0;
    const specTick = tickNo % gov.specEvery === 0;
    let t2 = t1, t3 = t1;
    if (playerTick) {
      const specViews = [];
      if (specTick) {
        let n = 0;
        for (const spec of spectators.values()) {
          if (n++ >= MAX_ACTIVE_SPECTATORS) break;
          spec.target = world.spectateTarget(spec.target);
          specViews.push({ key: spec.key, ...spec.target });
        }
      }
      const { entities, views } = world.buildTick(specViews);
      encoder.beginTick(entities);
      t2 = performance.now();
      const deliver = (ws, view) => {
        if (!view || ws.readyState !== ws.OPEN) return;
        if (ws.bufferedAmount > MAX_BUFFERED) { ws.terminate(); return; }
        ws.deltaCache ??= DeltaEncoder.newCache();
        const frame = encoder.encodeFor(ws.deltaCache, view, gov.playerCap);
        perf.bytes += frame.length;
        ws.send(frame);
      };
      for (const [playerId, ws] of sockets) deliver(ws, views.get(playerId));
      if (specTick) for (const [ws, spec] of spectators) deliver(ws, views.get(spec.key));
      t3 = performance.now();
    }
    perf.n++;
    perf.sim += t1 - t0;
    perf.build += t2 - t1;
    perf.send += t3 - t2;
    perf.max = Math.max(perf.max, t3 - t0);
    if (playerTick && gov.record(t3 - t0, now)) {
      console.log(`[load] level ${gov.level} at avg=${gov.avg.toFixed(1)}ms ` +
        `(players=${world.players.size}) — rate 1/${gov.playerEvery}, cap ${gov.playerCap}, joins ${gov.joinsOpen ? 'open' : 'PAUSED'}`);
    }
  }, TICK_MS);

  setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
    const now = Date.now();
    for (const [ws, spec] of spectators) {
      if (!spec.everMessaged && now - spec.connectedAt > SPECTATOR_IDLE_TIMEOUT_MS) ws.terminate();
    }
  }, HEARTBEAT_MS);

  const shutdown = () => {
    for (const [playerId, accountId] of accounts) {
      const player = world.players.get(playerId);
      if (player) writeSave(accountId, player.serializeSave());
    }
    const bye = JSON.stringify({ t: 'update' });
    for (const ws of wss.clients) {
      if (ws.readyState === ws.OPEN) ws.send(bye);
    }
    setTimeout(() => process.exit(0), 300).unref();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  wss.on('connection', (ws, req) => {
    let player = null;
    const ip = clientIp(req);
    ipCounts.set(ip, (ipCounts.get(ip) || 0) + 1);
    const accountId = sessionFromCookie(req?.headers?.cookie);
    spectators.set(ws, { key: `spec${nextSpecKey++}`, target: null, connectedAt: Date.now(), everMessaged: false });
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('error', (err) => { console.error('ws error', err.message); ws.terminate(); });

    ws.on('message', (data, isBinary) => {
      const specEntry = spectators.get(ws);
      if (specEntry) specEntry.everMessaged = true;
      let msg;
      if (isBinary) {
        try { msg = decodeCmd(data); } catch { return; }
      } else {
        try { msg = JSON.parse(data); } catch { return; }
      }
      if (!player) {
        if (msg?.t === 'join') {
          if (!verifyJoinToken(msg.token, ip)) {
            console.log(`[jointoken] rejected ip=${ip}`);
            return;
          }
          if (typeof msg.name === 'string' && isBannedName(msg.name)) {
            console.log(`[ban] refused name="${msg.name.slice(0, 24)}" ip=${ip}`);
            return;
          }
          if (!gov.joinsOpen) {
            ws.send(JSON.stringify({ t: 'full' }));
            return;
          }
          spectators.delete(ws);
          player = world.addPlayer();
          for (const { type, rarity } of getStarterPetals()) {
            player.addToInventory(type, rarity, true);
          }
          sockets.set(player.id, ws);
          if (accountId != null && ![...accounts.values()].includes(accountId)) {
            player.applySave(loadSave(accountId));
            accounts.set(player.id, accountId);
          }
          try { world.handle(player.id, msg); } catch (err) { console.error('bad message', err); }
        }
        return;
      }
      try { world.handle(player.id, msg); } catch (err) { console.error('bad message', err); }
    });
    ws.on('close', () => {
      const n = (ipCounts.get(ip) || 0) - 1;
      if (n > 0) ipCounts.set(ip, n); else ipCounts.delete(ip);
      spectators.delete(ws);
      if (player) {
        const acct = accounts.get(player.id);
        if (acct != null) {
          writeSave(acct, player.serializeSave());
          accounts.delete(player.id);
        }
        sockets.delete(player.id);
        world.removePlayer(player.id);
      }
    });
  });

  return wss;
}
