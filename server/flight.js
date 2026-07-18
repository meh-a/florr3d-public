import { FLIGHT, wallTopAt } from '../shared/config.js';

function bestAlive(instances, type) {
  let best = null;
  for (const inst of instances) {
    if (inst.alive && inst.type === type && (!best || inst.rarity > best.rarity)) best = inst;
  }
  return best;
}

export function groundYAt(player) {
  const top = wallTopAt(player.pos.x, player.pos.z);
  return player.pos.y >= top - 0.01 ? top : 0;
}

function popBubble(player, bubble, airborne) {
  const input = player.input;
  let yawX, yawZ;
  if (input.fps) {
    yawX = -Math.sin(input.yaw);
    yawZ = -Math.cos(input.yaw);
  } else {
    const dx = input.tx - player.pos.x, dz = input.tz - player.pos.z;
    const len = Math.hypot(dx, dz);
    if (len > 0.5) { yawX = dx / len; yawZ = dz / len; }
    else { yawX = Math.sin(player.facing); yawZ = Math.cos(player.facing); }
  }
  let pitch = input.fps ? input.pitch : Math.max(input.pitch, FLIGHT.topdownPopPitch);
  if (!airborne) pitch = Math.max(pitch, FLIGHT.groundPopPitch);

  const impulse = FLIGHT.boost * (1 + FLIGHT.boostRarityAdd * bubble.rarity);
  const v = player.flightVel;
  if (pitch > 0 && v.y < 0) v.y = 0;
  v.x += yawX * Math.cos(pitch) * impulse;
  v.z += yawZ * Math.cos(pitch) * impulse;
  v.y += Math.sin(pitch) * impulse;

  const h = Math.hypot(v.x, v.z);
  if (h > FLIGHT.maxBoostSpeed) {
    v.x *= FLIGHT.maxBoostSpeed / h;
    v.z *= FLIGHT.maxBoostSpeed / h;
  }

  player.petals.destroyInstance(bubble);
  player.world.events.push({
    e: 'pop',
    x: Math.round(player.pos.x * 100) / 100,
    y: Math.round(player.pos.y * 100) / 100,
    z: Math.round(player.pos.z * 100) / 100,
  });
}

export function updateFlight(player, dt) {
  const p = player;
  const input = p.input;
  const v = p.flightVel;

  const defPressed = input.def && !p.prevDef;
  p.prevDef = input.def;

  const groundY = groundYAt(p);
  let airborne = p.pos.y > groundY + 0.01;

  if (defPressed) {
    const bubble = bestAlive(p.petals.instances, 'bubble');
    if (bubble) { popBubble(p, bubble, airborne); airborne = airborne || v.y > 0; }
  }

  if (!airborne && v.y <= 0) {
    v.y = 0;
    const drag = Math.exp(-FLIGHT.groundDrag * dt);
    v.x *= drag;
    v.z *= drag;
    if (v.lengthSq() < 0.01) { v.set(0, 0, 0); return; }
  } else {
    const drag = Math.exp(-FLIGHT.drag * dt);
    v.x *= drag;
    v.z *= drag;
    v.y -= FLIGHT.gravity * dt;

    const wing = bestAlive(p.petals.instances, 'wing');
    if (wing) {
      let sink = FLIGHT.glideSink * FLIGHT.sinkRarityMult ** wing.rarity;
      if (input.fps && input.pitch < -0.1) {
        sink -= input.pitch * FLIGHT.diveRate;
        const gain = -input.pitch * Math.cos(input.pitch) * FLIGHT.diveGain * dt;
        v.x += -Math.sin(input.yaw) * gain;
        v.z += -Math.cos(input.yaw) * gain;
        const h = Math.hypot(v.x, v.z);
        if (h > FLIGHT.maxBoostSpeed) {
          v.x *= FLIGHT.maxBoostSpeed / h;
          v.z *= FLIGHT.maxBoostSpeed / h;
        }
      } else if (input.fps && input.pitch > 0.1) {
        const h = Math.hypot(v.x, v.z);
        if (h > 0.5) {
          const climb = Math.min(h, input.pitch * FLIGHT.climbRate);
          v.y += climb * 3 * dt;
          const keep = Math.max(0, 1 - (climb * 1.5 * dt) / h);
          v.x *= keep;
          v.z *= keep;
        }
      }
      v.y = Math.max(v.y, -sink);
    } else {
      v.y = Math.max(v.y, -FLIGHT.maxFall);
    }
  }

  if (p.pos.y >= FLIGHT.maxAlt) v.y = Math.min(v.y, 0);

  const prevY = p.pos.y;
  p.pos.addScaledVector(v, dt);

  const top = wallTopAt(p.pos.x, p.pos.z);
  const floor = prevY >= top - 0.01 ? top : 0;
  if (p.pos.y <= floor) {
    p.pos.y = floor;
    if (v.y < 0) v.y = 0;
  }
}
