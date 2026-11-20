// Ironhold city map: road grid, frozen lake, ice road, buildings, lamps, trees.
// Built once from a fixed seed, so every session sees the same city.

import { WORLD, STREETS_X, STREETS_Y, ROAD_HALF, ICE_ROAD, PALETTE } from './config.js';
import { mulberry32, range, distToSegment, clamp } from './rng.js';

export const WORLD_SEED = 20261119;

export function buildWorld(seed) {
  const rnd = mulberry32(seed || WORLD_SEED);
  const buildings = [];
  const lamps = [];
  const trees = [];
  const smokestacks = [];
  const crates = [];

  // Buildings fill the blocks between streets, above the lake shore.
  for (let bx = 0; bx < STREETS_X.length - 1; bx += 1) {
    for (let by = 0; by < STREETS_Y.length - 1; by += 1) {
      const x0 = STREETS_X[bx] + ROAD_HALF + 14;
      const x1 = STREETS_X[bx + 1] - ROAD_HALF - 14;
      const y0 = STREETS_Y[by] + ROAD_HALF + 14;
      const y1 = STREETS_Y[by + 1] - ROAD_HALF - 14;
      if (y1 > WORLD.lakeY - 40) continue;
      const count = rnd() < 0.55 ? 2 : 1;
      for (let i = 0; i < count; i += 1) {
        const w = range(rnd, 90, Math.max(100, (x1 - x0) / count - 30));
        const h = range(rnd, 70, Math.max(80, y1 - y0 - 30));
        const x = x0 + (i * (x1 - x0)) / count + range(rnd, 4, 20);
        const y = y0 + range(rnd, 4, Math.max(6, y1 - y0 - h - 4));
        const tall = rnd() < 0.25;
        buildings.push({
          x, y, w: Math.min(w, x1 - x - 6), h: Math.min(h, y1 - y - 6),
          color: rnd() < 0.5 ? PALETTE.building : PALETTE.buildingB,
          tall, windows: Math.floor(range(rnd, 4, 14)),
          seed: Math.floor(rnd() * 100000),
        });
      }
    }
  }

  // Harbor warehouses along the west shore.
  for (let i = 0; i < 4; i += 1) {
    buildings.push({
      x: 60 + i * 8, y: 1060 + i * 110, w: 220, h: 84,
      color: PALETTE.buildingB, tall: false, windows: 8, seed: 7000 + i,
    });
  }
  // Factory Row smokestacks.
  for (let i = 0; i < 5; i += 1) {
    smokestacks.push({ x: 780 + i * 150, y: 240 + (i % 2) * 120, h: range(rnd, 120, 190) });
  }
  // Street lamps along every street.
  for (const sx of STREETS_X) {
    for (let y = 120; y < WORLD.lakeY; y += 180) {
      lamps.push({ x: sx + ROAD_HALF + 8, y });
      lamps.push({ x: sx - ROAD_HALF - 8, y: y + 90 });
    }
  }
  for (const sy of STREETS_Y) {
    for (let x = 120; x < WORLD.width; x += 180) {
      lamps.push({ x, y: sy + ROAD_HALF + 8 });
    }
  }
  // Snow pines in Old Town and along the shore.
  for (let i = 0; i < 90; i += 1) {
    trees.push({
      x: range(rnd, 60, WORLD.width - 60),
      y: range(rnd, 60, WORLD.lakeY - 60),
      r: range(rnd, 9, 16),
    });
  }
  // Dock crates at the harbor.
  for (let i = 0; i < 16; i += 1) {
    crates.push({ x: range(rnd, 90, 560), y: range(rnd, 1050, 1480), s: range(rnd, 14, 26) });
  }
  return { buildings, lamps, trees, smokestacks, crates, seed: seed || WORLD_SEED };
}

export function onIceRoad(x, y) {
  return distToSegment(x, y, ICE_ROAD.x1, ICE_ROAD.y1, ICE_ROAD.x2, ICE_ROAD.y2) < ICE_ROAD.halfWidth;
}

export function onLake(x, y) {
  return y >= WORLD.lakeY;
}

export function onRoad(x, y) {
  if (onIceRoad(x, y)) return true;
  if (y >= WORLD.lakeY) return false;
  for (const sx of STREETS_X) if (Math.abs(x - sx) <= ROAD_HALF) return true;
  for (const sy of STREETS_Y) if (Math.abs(y - sy) <= ROAD_HALF) return true;
  return false;
}

export function surfaceAt(x, y) {
  if (onIceRoad(x, y)) return 'iceroad';
  if (onLake(x, y)) return 'ice';
  if (onRoad(x, y)) return 'road';
  return 'snow';
}

// Grip: 1 = full asphalt control, lower = slide. Ice is treacherous by design.
export function gripAt(x, y) {
  const s = surfaceAt(x, y);
  if (s === 'road') return 1;
  if (s === 'iceroad') return 0.62;
  if (s === 'ice') return 0.38;
  return 0.7;
}

// Circle (car or pedestrian) vs building rectangles. Returns the building hit, or null.
export function hitBuilding(world, x, y, r) {
  for (const b of world.buildings) {
    const cx = clamp(x, b.x, b.x + b.w);
    const cy = clamp(y, b.y, b.y + b.h);
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return b;
  }
  return null;
}

export function insideWorld(x, y, margin) {
  const m = margin || 20;
  return x > m && x < WORLD.width - m && y > m && y < WORLD.height - m;
}
