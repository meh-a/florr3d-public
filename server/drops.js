import { uid } from './utils.js';

const LIFETIME = 30;

export class DropManager {
  constructor(world) {
    this.world = world;
    this.drops = [];
  }

  spawn(type, rarity, pos, owner) {
    this.drops.push({ id: uid(), type, rarity, pos: pos.clone().setY(0), age: 0, owner });
  }

  update(dt) {
    for (const drop of this.drops) {
      drop.age += dt;
      if (drop.age > LIFETIME) { drop.gone = true; continue; }
      const player = this.world.players.get(drop.owner);
      if (!player) { drop.gone = true; continue; }
      if (!player.dead && drop.pos.distanceTo(player.pos) < player.radius + 1.4) {
        player.addToInventory(drop.type, drop.rarity);
        drop.gone = true;
      }
    }
    this.drops = this.drops.filter((d) => !d.gone);
  }
}
