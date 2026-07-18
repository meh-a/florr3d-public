import { World } from './world.js';

const TICK_MS = 1000 / 30;
const world = new World();
let player = null;
let specTarget = null;
let last = performance.now();

setInterval(() => {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  world.tick(dt);
  if (player) {
    postMessage(world.buildSnapshots().get(player.id));
  } else {
    specTarget = world.spectateTarget(specTarget);
    postMessage(world.buildSnapshots([{ key: 'spec', ...specTarget }]).get('spec'));
  }
}, TICK_MS);

onmessage = (ev) => {
  const msg = ev.data;
  if (!player) {
    if (msg?.t === 'join') {
      player = world.addPlayer();
      try { world.handle(player.id, msg); } catch (err) { console.error('bad message', err); }
    }
    return;
  }
  try { world.handle(player.id, msg); } catch (err) { console.error('bad message', err); }
};
