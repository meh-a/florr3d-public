import { ARENA_HALF, TILE_SIZE, MAP_TILES, MAP_WALLS } from '../../shared/config.js';

const TILE_COLORS = {
  grass: '#1ea761',
  water: '#2f8fbf',
  dirt: '#8a6b42',
  desert: '#e0c374',
  jungle: '#0d5c2e',
};
const WALL_COLORS = { dirtWall: '#54402a', stoneWall: '#6e6e75' };

export function makeMinimap(parent) {
  const cells = Math.ceil(ARENA_HALF / TILE_SIZE) * 2 + 1;
  const halfCells = (cells - 1) / 2;

  const bg = document.createElement('canvas');
  bg.width = bg.height = cells;
  const bctx = bg.getContext('2d');
  bctx.fillStyle = TILE_COLORS.grass;
  bctx.fillRect(0, 0, cells, cells);
  for (const t of MAP_TILES) {
    bctx.fillStyle = TILE_COLORS[t.type] || TILE_COLORS.grass;
    bctx.fillRect(t.gx + halfCells, t.gz + halfCells, 1, 1);
  }
  for (const w of MAP_WALLS) {
    bctx.fillStyle = WALL_COLORS[w.type] || WALL_COLORS.dirtWall;
    bctx.fillRect(w.gx + halfCells, w.gz + halfCells, 1, 1);
  }

  const canvas = document.createElement('canvas');
  canvas.id = 'minimap';
  const scale = Math.max(2, Math.floor(288 / cells));
  canvas.width = canvas.height = cells * scale;
  parent.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  return (pos) => {
    ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
    const px = ((pos.x + ARENA_HALF) / (2 * ARENA_HALF)) * canvas.width;
    const pz = ((pos.z + ARENA_HALF) / (2 * ARENA_HALF)) * canvas.height;
    ctx.beginPath();
    ctx.arc(px, pz, Math.max(3, scale * 0.8), 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.stroke();
  };
}
