import * as THREE from 'three';
import { HIT_COOLDOWN, PLAYER_BODY_DAMAGE, PETAL_TYPES } from '../shared/config.js';

function canHit(owner, otherId, time, cooldown = HIT_COOLDOWN) {
  const last = owner.hitCooldowns.get(otherId) || -Infinity;
  if (time - last < cooldown) return false;
  owner.hitCooldowns.set(otherId, time);
  return true;
}

export function updateCombat(world, dt) {
  const t = world.time;
  const players = [...world.players.values()];

  for (const mob of world.mobs.mobs) {
    if (mob.deadFlag) continue;

    for (const player of players) {
      {
        const dx = mob.pos.x - player.pos.x, dz = mob.pos.z - player.pos.z;
        const reach = mob.radius + 8;
        if (dx * dx + dz * dz > reach * reach) continue;
      }
      if (!player.dead && player.immunity <= 0) {
        const d = mob.pos.distanceTo(player.pos);
        if (d < mob.radius + player.radius) {
          if (canHit(mob, player.id, t)) {
            player.damage(mob.dmg);
            mob.damage(PLAYER_BODY_DAMAGE, player.pos, player);
            const push = player.pos.clone().sub(mob.pos).setY(0).normalize();
            player.knock.addScaledVector(push, 12);
          }
        }
      }
      if (mob.deadFlag) break;

      for (const petal of player.petals.instances) {
        if (!petal.alive) continue;
        const d = mob.pos.distanceTo(petal.pos);
        if (d < mob.radius + petal.radius) {
          const pdef = PETAL_TYPES[petal.type];
          if (canHit(mob, petal.id, t, pdef.hitCooldown)) {
            const dmg = pdef.speedDmgMult
              ? petal.dmg * (1 + Math.min(1, player.moveSpeed / player.speed) * pdef.speedDmgMult)
              : petal.dmg;
            mob.damage(dmg, petal.pos, player);
            petal.hp -= mob.dmg;
            if (petal.hp <= 0) player.petals.destroyInstance(petal);
            if (mob.deadFlag) break;
          }
        }
      }
      if (mob.deadFlag) break;
    }
  }

  for (const player of players) {
    for (const proj of player.petals.projectiles) {
      if (proj.dead) continue;
      for (const mob of world.mobs.mobs) {
        if (mob.deadFlag) continue;
        if (proj.pos.distanceTo(mob.pos) < proj.radius + mob.radius) {
          mob.damage(proj.dmg, proj.pos, player);
          proj.dead = true;
          break;
        }
      }
    }
  }

  const hitPoint = new THREE.Vector3();
  for (const mi of world.mobs.missiles) {
    if (mi.dead) continue;

    for (const player of players) {
      if (!player.dead && player.immunity <= 0) {
        hitPoint.set(player.pos.x, player.pos.y + 1.1, player.pos.z);
        if (mi.pos.distanceTo(hitPoint) < mi.radius + player.radius) {
          player.damage(mi.dmg);
          mi.dead = true;
          break;
        }
      }

      for (const petal of player.petals.instances) {
        if (!petal.alive) continue;
        hitPoint.set(petal.pos.x, petal.pos.y + 1.1, petal.pos.z);
        if (mi.pos.distanceTo(hitPoint) < mi.radius + petal.radius) {
          petal.hp -= mi.dmg;
          mi.hp -= petal.dmg;
          world.events.push({
            e: 'dmg', a: Math.round(petal.dmg),
            x: Math.round(mi.pos.x * 100) / 100, z: Math.round(mi.pos.z * 100) / 100,
          });
          if (petal.hp <= 0) player.petals.destroyInstance(petal);
          if (mi.hp <= 0) {
            mi.dead = true;
            break;
          }
        }
      }
      if (mi.dead) break;
    }
  }
}
