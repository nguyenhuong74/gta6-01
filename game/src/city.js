// City generation for Solmara Bay: a road grid, building blocks, two parks,
// a beach and sea to the south, and the fixed story spots. All geometry is
// derived from a seed, so the same seed always builds the same city.
import { WORLD_W, WORLD_H, ROAD_SPACING, ROAD_W, BEACH_Y, SPOTS } from './config.js';
import { createRandom, range, pick, chance } from './random.js';

const ROOF_COLORS = ['#e8a87c', '#f2d5a0', '#d98c8c', '#8fb8c9', '#c9b8e0', '#a8c686', '#e0e0d8', '#7fa8c9'];
const WALL_COLORS = ['#f5e6c8', '#e8c9a0', '#d9a08c', '#b8d0d8', '#e8d8c0', '#c8b8a0'];

export function roadCenters() {
  const list = [];
  for (let c = ROAD_SPACING / 2; c < WORLD_W; c += ROAD_SPACING) list.push(c);
  return list;
}

export function isOnRoad(x, y) {
  if (y > BEACH_Y) return false;
  for (const c of roadCenters()) {
    if (Math.abs(x - c) < ROAD_W / 2 || Math.abs(y - c) < ROAD_W / 2) return true;
  }
  return false;
}

export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const cx of roadCenters()) {
    for (const cy of roadCenters()) {
      const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d < bestD) { bestD = d; best = { x: cx, y: cy }; }
    }
  }
  return best;
}

export function createCity(seed) {
  const rng = createRandom(seed);
  const buildings = [];
  const trees = [];
  const parks = [];
  const centers = roadCenters();
  const block = ROAD_SPACING - ROAD_W; // 304 px of buildable block

  for (let ix = 0; ix < centers.length - 1; ix++) {
    for (let iy = 0; iy < centers.length - 1; iy++) {
      const x0 = centers[ix] + ROAD_W / 2 + 8;
      const y0 = centers[iy] + ROAD_W / 2 + 8;
      const cx = x0 + block / 2;
      const cy = y0 + block / 2;
      if (cy > BEACH_Y - 120) continue; // beach blocks stay open
      // Two park blocks: one central, one north-east.
      if ((ix === 4 && iy === 3) || (ix === 6 && iy === 1)) {
        parks.push({ x: x0, y: y0, w: block, h: block });
        for (let t = 0; t < 14; t++) {
          trees.push({ x: range(rng, x0 + 20, x0 + block - 20), y: range(rng, y0 + 20, y0 + block - 20), r: range(rng, 9, 15) });
        }
        continue;
      }
      const n = chance(rng, 0.35) ? 1 : chance(rng, 0.6) ? 2 : 4;
      for (let b = 0; b < n; b++) {
        const bw = n === 1 ? block * 0.72 : n === 2 ? block * 0.42 : block * 0.42;
        const bh = n === 1 ? block * 0.72 : n === 2 ? block * 0.72 : block * 0.42;
        const bx = n === 1 ? cx - bw / 2 : x0 + 14 + (b % 2) * (block / 2 + 4);
        const by = n === 1 ? cy - bh / 2 : n === 2 ? y0 + 14 + Math.floor(b / 2) * 0 : y0 + 14 + Math.floor(b / 2) * (block / 2 + 4);
        const by2 = n === 2 ? y0 + 14 : by;
        buildings.push({
          x: bx, y: by2, w: bw, h: bh,
          roof: pick(rng, ROOF_COLORS), wall: pick(rng, WALL_COLORS),
          height: range(rng, 6, 26), // roof height: taller = bigger shadow
        });
      }
      // Street trees along block corners.
      if (chance(rng, 0.5)) {
        trees.push({ x: x0 + 12, y: y0 + 12, r: 10 });
        trees.push({ x: x0 + block - 12, y: y0 + block - 12, r: 10 });
      }
    }
  }
  // Palm row along the beach.
  for (let x = 120; x < WORLD_W; x += 130) {
    trees.push({ x: x + range(rng, -20, 20), y: BEACH_Y + 46, r: 13, palm: true });
  }
  return { buildings, trees, parks, seed };
}

// Circle-vs-building collision: pushes a circle out of any building it overlaps.
export function collideBuildings(city, body) {
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - nx;
    const dy = body.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < body.r * body.r) {
      if (d2 > 0.001) {
        const d = Math.sqrt(d2);
        body.x = nx + (dx / d) * body.r;
        body.y = ny + (dy / d) * body.r;
      } else {
        body.x += body.r; // centre inside the box: shove out sideways
      }
      return b;
    }
  }
  return null;
}

export function pointInBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}

// A random free road point (for spawning traffic / pedestrians).
export function randomRoadPoint(rng) {
  const centers = roadCenters();
  const vertical = chance(rng, 0.5);
  const c = pick(rng, centers);
  const along = range(rng, 120, WORLD_W - 120);
  return vertical ? { x: c + (chance(rng, 0.5) ? -22 : 22), y: along } : { x: along, y: c + (chance(rng, 0.5) ? -22 : 22) };
}

export function spotList() {
  return Object.entries(SPOTS).map(([id, s]) => ({ id, ...s }));
}
