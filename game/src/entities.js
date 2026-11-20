// Entities: the player (on foot or in a car), traffic cars, pedestrians,
// bullets, skid marks and snow. Pure state + step functions, no drawing.

import { WORLD, PLAYER, CAR_MODELS, STREETS_X, STREETS_Y, ROAD_HALF } from './config.js';
import { mulberry32, range, pick, clamp, dist, angleTo, angleDiff } from './rng.js';
import { buildWorld, hitBuilding, gripAt, onRoad, onLake, insideWorld } from './world.js';

export function makeCar(modelIndex, x, y, angle) {
  const model = CAR_MODELS[modelIndex % CAR_MODELS.length];
  return {
    kind: 'car', modelIndex, model,
    x, y, angle, speed: 0, vx: 0, vy: 0,
    color: model.color, w: model.truck ? 96 : 62, h: model.truck ? 34 : 30,
    health: 100, driver: false, police: false, wanted: false,
    steerTarget: 0, cruise: range(Math.random, 0, 0),
  };
}

export function makePed(x, y) {
  return {
    kind: 'ped', x, y, angle: range(Math.random, 0, Math.PI * 2),
    speed: range(Math.random, 28, 55), color: pick(Math.random, ['#C9A227', '#7FA9C6', '#B4762A', '#8FA9BE', '#E8EDF2']),
    walkPhase: Math.random() * 10, flee: 0, dead: false,
  };
}

// The player: on foot, or driving a car object. `car` is null on foot.
export function makePlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, speed: 0, onFoot: true, car: null,
    health: 100, maxHealth: 100, outfit: 'parka',
    cash: 1240, respect: 0, wanted: 0, wantedHeat: 0,
    weapon: 'pistol', weapons: ['pistol'], ammo: 24,
    upgrades: [], paint: null, radio: 0, soundOn: true,
    missionIndex: 0, missionsDone: 0, kills: 0, carsStolen: 0,
    clock: 19 * 3600 + 24 * 60, // 19:24, night in Ironhold
    dead: false, busted: false, invuln: 0,
  };
}

export function createGame(seed) {
  const rnd = mulberry32(seed);
  const world = buildWorld(seed);
  const player = makePlayer(1800, 1050);
  // Mission 1 starts the player behind the wheel, on the street by the vault:
  // the first thing a new player does is drive, not hunt for a car.
  const starter = makeCar(0, 1800, 1050, -Math.PI / 2);
  starter.speed = 0;
  player.car = starter;
  player.onFoot = false;
  player.angle = -Math.PI / 2;
  const state = {
    seed, world, player,
    traffic: [], peds: [], police: [], bullets: [], skids: [], flakes: [],
    heli: null, roadblocks: [],
    time: 0, blizzard: 0, shake: 0,
    message: '', messageT: 0,
    stats: { distance: 0, chases: 0 },
  };
  // Snowfall flakes live in screen space; seeded so shots are repeatable.
  for (let i = 0; i < 130; i += 1) {
    state.flakes.push({
      x: rnd() * 1280, y: rnd() * 720, r: range(rnd, 0.9, 3.1),
      drift: range(rnd, -14, 14), fall: range(rnd, 26, 78), a: range(rnd, 0.3, 0.9),
    });
  }
  spawnTraffic(state, rnd);
  spawnPeds(state, rnd);
  return state;
}

export function spawnTraffic(state, rnd) {
  const r = rnd || Math.random;
  while (state.traffic.length < 26) {
    const vertical = r() < 0.5;
    const street = vertical ? pick(r, STREETS_X) : pick(r, STREETS_Y);
    const along = range(r, 120, vertical ? 1500 : 3100);
    const x = vertical ? street + (r() < 0.5 ? -18 : 18) : along;
    const y = vertical ? along : street + (r() < 0.5 ? -18 : 18);
    const angle = vertical ? (r() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (r() < 0.5 ? 0 : Math.PI);
    const car = makeCar(Math.floor(r() * CAR_MODELS.length), x, y, angle);
    car.cruise = range(r, 90, 150);
    car.speed = car.cruise;
    state.traffic.push(car);
  }
}

export function spawnPeds(state, rnd) {
  const r = rnd || Math.random;
  while (state.peds.length < 42) {
    const street = pick(r, STREETS_X);
    const x = street + (r() < 0.5 ? -70 : 70) + range(r, -14, 14);
    const y = range(r, 120, 1480);
    state.peds.push(makePed(x, y));
  }
}

function driveCar(car, dt, throttle, steer, grip, maxSpeed) {
  const accel = PLAYER.carAccel * (car.model ? car.model.accel : 1);
  car.speed += throttle * accel * dt;
  if (throttle === 0) car.speed *= Math.pow(0.4, dt);
  car.speed = clamp(car.speed, -PLAYER.carReverse, maxSpeed);
  const steerPower = PLAYER.steer * grip * clamp(Math.abs(car.speed) / 120, 0.15, 1);
  car.angle += steer * steerPower * dt * Math.sign(car.speed || 1);
  const slide = 1 - grip * 0.55;
  const nx = Math.cos(car.angle);
  const ny = Math.sin(car.angle);
  car.vx = nx * car.speed;
  car.vy = ny * car.speed;
  car.x += car.vx * dt + (car.vx * slide * 0.12) * dt;
  car.y += car.vy * dt + (car.vy * slide * 0.12) * dt;
}

export function stepPlayer(state, input, dt) {
  const p = state.player;
  if (p.dead || p.busted) return;
  if (p.invuln > 0) p.invuln -= dt;
  const throttle = input.throttle();
  const steer = input.steer();
  if (p.onFoot) {
    const run = throttle !== 0;
    const spd = run ? PLAYER.runSpeed : 0;
    const moving = throttle !== 0 || steer !== 0;
    if (moving) {
      const dir = throttle !== 0 ? (throttle > 0 ? -Math.PI / 2 : Math.PI / 2) : p.angle;
      const turn = steer !== 0 ? steer * 2.4 * dt : 0;
      p.angle += turn;
      const a = throttle !== 0 ? (throttle > 0 ? p.angle : p.angle + Math.PI) : p.angle;
      const nx = p.x + Math.cos(a) * spd * dt;
      const ny = p.y + Math.sin(a) * spd * dt;
      if (!hitBuilding(state.world, nx, ny, PLAYER.radius) && insideWorld(nx, ny, 24)) {
        p.x = nx; p.y = ny;
      }
      p.speed = spd;
    } else {
      p.speed = 0;
    }
    return;
  }
  const car = p.car;
  const grip = gripAt(car.x, car.y);
  let maxSpeed = PLAYER.carMax * (car.model ? car.model.speed : 1);
  if (p.upgrades.includes('engine1')) maxSpeed *= 1.15;
  if (p.upgrades.includes('engine2')) maxSpeed *= 1.3;
  if (onLake(car.x, car.y)) maxSpeed *= 0.92;
  const handbrake = input.takeActions ? 0 : 0;
  const before = { x: car.x, y: car.y };
  driveCar(car, dt, throttle, steer, grip, maxSpeed);
  const hit = hitBuilding(state.world, car.x, car.y, 20);
  if (hit || !insideWorld(car.x, car.y, 30)) {
    car.x = before.x; car.y = before.y;
    car.speed *= -0.25;
    if (hit && Math.abs(car.speed) > 120) {
      car.health -= 6;
      state.shake = Math.max(state.shake, 0.25);
    }
  }
  p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = Math.abs(car.speed);
  state.stats.distance += Math.abs(car.speed) * dt;
  if (Math.abs(car.speed) > 200 && grip < 0.8 && Math.random() < 0.35) {
    state.skids.push({ x: car.x, y: car.y, a: car.angle, t: 0.9 });
  }
}

export function stepTraffic(state, dt) {
  const p = state.player;
  for (const car of state.traffic) {
    // Traffic follows the street grid: at an intersection, sometimes turn.
    const onX = STREETS_X.some((sx) => Math.abs(car.x - sx) < 6);
    const onY = STREETS_Y.some((sy) => Math.abs(car.y - sy) < 6);
    if ((onX || onY) && Math.random() < 0.02) {
      const dirs = [0, Math.PI / 2, -Math.PI / 2, Math.PI];
      car.angle = dirs[Math.floor(Math.random() * dirs.length)];
    }
    // Keep to the road: nudge back toward the nearest street centre.
    const sx = STREETS_X.reduce((a, b) => (Math.abs(car.x - a) < Math.abs(car.x - b) ? a : b));
    const sy = STREETS_Y.reduce((a, b) => (Math.abs(car.y - a) < Math.abs(car.y - b) ? a : b));
    const nearX = Math.abs(car.x - sx) < ROAD_HALF + 20;
    const nearY = Math.abs(car.y - sy) < ROAD_HALF + 20;
    if (nearX && !nearY) car.y += clamp(sx - car.x, -1, 1) * 0; // keep lane by angle below
    if (!onRoad(car.x, car.y)) {
      // Lost the road: steer back toward the nearest street.
      const target = angleTo(car.x, car.y, nearX ? sx : car.x, nearY ? sy : car.y);
      car.angle += angleDiff(car.angle, target) * dt * 1.2;
    }
    car.speed = car.cruise;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (!insideWorld(car.x, car.y, 10)) {
      car.x = clamp(car.x, 60, WORLD.width - 60);
      car.y = clamp(car.y, 60, WORLD.lakeY - 60);
      car.angle += Math.PI;
    }
    // Bump the player: a traffic collision slows both and raises heat.
    const d = dist(car.x, car.y, p.x, p.y);
    if (d < 46 && !p.onFoot) {
      car.speed *= 0.4;
      if (Math.abs(p.speed) > 140) addHeat(state, 0.2);
    }
  }
}

export function stepPeds(state, dt) {
  const p = state.player;
  for (const ped of state.peds) {
    if (ped.dead) continue;
    const d = dist(ped.x, ped.y, p.x, p.y);
    if (d < 90 && !p.onFoot && p.speed > 60) {
      ped.flee = 1.5;
      ped.angle = angleTo(p.x, p.y, ped.x, ped.y);
    }
    if (d < 26 && !p.onFoot && p.speed > 40) {
      ped.dead = true;
      addHeat(state, 1);
      state.message = 'Pedestrian hit! Wanted level up.';
      state.messageT = 2.5;
      continue;
    }
    if (ped.flee > 0) {
      ped.flee -= dt;
      ped.x += Math.cos(ped.angle) * 120 * dt;
      ped.y += Math.sin(ped.angle) * 120 * dt;
    } else {
      ped.walkPhase += dt * 4;
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      if (Math.random() < 0.004) ped.angle = range(Math.random, 0, Math.PI * 2);
      if (!insideWorld(ped.x, ped.y, 30) || ped.y > WORLD.lakeY - 20) ped.angle += Math.PI;
    }
    if (hitBuilding(state.world, ped.x, ped.y, 8)) ped.angle += Math.PI / 2;
  }
  // Slowly replace the dead so the streets stay alive.
  if (state.peds.filter((q) => !q.dead).length < 30) {
    const street = pick(Math.random, STREETS_X);
    state.peds.push(makePed(street + 70, range(Math.random, 120, 1400)));
  }
}

export function addHeat(state, amount) {
  const p = state.player;
  p.wantedHeat = clamp(p.wantedHeat + amount, 0, 5.6);
  const level = Math.min(5, Math.floor(p.wantedHeat));
  if (level > p.wanted) {
    p.wanted = level;
    state.message = 'WANTED LEVEL ' + level + (level >= 4 ? ' — AIR ONE IS UP' : '');
    state.messageT = 3;
  }
}

export function decayWanted(state, dt) {
  const p = state.player;
  if (p.wanted === 0) return;
  const nearPolice = state.police.some((c) => dist(c.x, c.y, p.x, p.y) < 520);
  if (!nearPolice) {
    p.wantedHeat = Math.max(0, p.wantedHeat - 0.045 * dt * 10);
    p.wanted = Math.floor(p.wantedHeat);
  }
}

export function fireBullet(state, fromX, fromY, angle, friendly) {
  state.bullets.push({ x: fromX, y: fromY, angle, speed: 900, life: 0.9, friendly });
}

export function stepBullets(state, dt) {
  const p = state.player;
  for (const b of state.bullets) {
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    if (b.friendly) {
      for (const cop of state.police) {
        if (dist(b.x, b.y, cop.x, cop.y) < 30) {
          cop.health -= 34;
          b.life = 0;
          if (cop.health <= 0) {
            cop.dead = true;
            p.kills += 1;
            addHeat(state, 0.5);
          }
        }
      }
    } else if (dist(b.x, b.y, p.x, p.y) < 18 && p.invuln <= 0) {
      p.health -= 8;
      p.invuln = 0.5;
      b.life = 0;
    }
    if (hitBuilding(state.world, b.x, b.y, 2)) b.life = 0;
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
  state.police = state.police.filter((c) => !c.dead);
}

export function stepSnow(state, dt) {
  for (const f of state.flakes) {
    f.y += f.fall * dt * (1 + state.blizzard * 2.2);
    f.x += (f.drift + state.blizzard * 60) * dt;
    if (f.y > 720) { f.y = -4; f.x = Math.random() * 1280; }
    if (f.x > 1284) f.x = -4;
    if (f.x < -4) f.x = 1284;
  }
  for (const s of state.skids) s.t -= dt;
  state.skids = state.skids.filter((s) => s.t > 0);
}
