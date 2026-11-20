// Wanted system: police cars that chase and ram, roadblocks at 3+ stars,
// a police helicopter at 4-5 stars. Heat rises on crime and fades when the
// player breaks line of sight; getting busted ends the run.

import { WORLD, WANTED, PALETTE } from './config.js';
import { dist, angleTo, angleDiff, clamp, range } from './rng.js';
import { insideWorld } from './world.js';
import { addHeat } from './entities.js';

export function makePoliceCar(x, y) {
  return {
    kind: 'police', x, y, angle: 0, speed: 0,
    color: PALETTE.police, w: 62, h: 30, health: 100,
    police: true, stuck: 0, siren: Math.random() * 2,
  };
}

export function makeHeli(x, y) {
  return { x, y, angle: 0, radius: 190, speed: 0.5, spotlight: 0 };
}

export function stepPolice(state, dt) {
  const p = state.player;
  const want = WANTED.maxPolice[p.wanted] || 0;
  // Spawn up to the wanted level's cap, at the map edges near the player.
  while (state.police.length < want) {
    const angle = Math.random() * Math.PI * 2;
    const d = 700 + Math.random() * 300;
    const x = clamp(p.x + Math.cos(angle) * d, 80, WORLD.width - 80);
    const y = clamp(p.y + Math.sin(angle) * d, 80, WORLD.height - 80);
    state.police.push(makePoliceCar(x, y));
    state.stats.chases += 1;
  }
  // Extra cars leave when the heat drops.
  while (state.police.length > want) state.police.pop();

  for (const cop of state.police) {
    const target = angleTo(cop.x, cop.y, p.x, p.y);
    cop.angle += clamp(angleDiff(cop.angle, target), -2.4 * dt, 2.4 * dt);
    const top = 300 + p.wanted * 34;
    cop.speed = Math.min(top, cop.speed + 420 * dt);
    const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
    const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
    if (insideWorld(nx, ny, 40)) {
      cop.x = nx; cop.y = ny; cop.stuck = 0;
    } else {
      cop.stuck += dt;
      if (cop.stuck > 1.2) { cop.angle += Math.PI / 2; cop.stuck = 0; }
    }
    cop.siren += dt;
    // Ram the player: a hard hit costs health and can end the run.
    const d = dist(cop.x, cop.y, p.x, p.y);
    if (d < 44 && p.invuln <= 0) {
      if (p.onFoot) {
        p.health -= 12;
        p.invuln = 0.8;
        state.shake = 0.4;
        if (p.health <= 0) bustPlayer(state);
      } else if (p.car) {
        p.car.health -= 9;
        p.car.speed *= 0.55;
        state.shake = 0.35;
        if (p.car.health <= 0) {
          p.car = null;
          p.onFoot = true;
          p.health -= 15;
          if (p.health <= 0) bustPlayer(state);
        }
      }
    }
    // Police shoot at the player on foot at 3+ stars.
    if (p.wanted >= 3 && p.onFoot && d < 380 && Math.random() < dt * 0.5) {
      state.bullets.push({ x: cop.x, y: cop.y, angle: target, speed: 700, life: 0.8, friendly: false });
    }
  }

  // Roadblocks at 3+ stars: two police cars parked across the road ahead.
  if (p.wanted >= WANTED.roadblockAt && state.roadblocks.length === 0) {
    const ahead = p.angle;
    const bx = p.x + Math.cos(ahead) * 520;
    const by = p.y + Math.sin(ahead) * 520;
    state.roadblocks.push({ x: bx, y: by, angle: ahead + Math.PI / 2, t: 20 });
    state.roadblocks.push({ x: bx + Math.cos(ahead + Math.PI / 2) * 60, y: by + Math.sin(ahead + Math.PI / 2) * 60, angle: ahead + Math.PI / 2, t: 20 });
    state.message = 'ROADBLOCK AHEAD';
    state.messageT = 3;
  }
  for (const rb of state.roadblocks) rb.t -= dt;
  state.roadblocks = state.roadblocks.filter((rb) => rb.t > 0 && p.wanted >= WANTED.roadblockAt);
  // Smashing a roadblock costs the car, not the mission.
  for (const rb of state.roadblocks) {
    if (dist(rb.x, rb.y, p.x, p.y) < 40 && !p.onFoot) {
      rb.t = 0;
      if (p.car) { p.car.health -= 12; p.car.speed *= 0.4; }
      state.shake = 0.5;
      addHeat(state, 0.3);
    }
  }

  // Helicopter at 4-5 stars: circles overhead, spotlight follows the player.
  if (p.wanted >= WANTED.heliAt && !state.heli) {
    state.heli = makeHeli(p.x, p.y - 200);
    state.message = 'AIR ONE IS OVERHEAD — break line of sight';
    state.messageT = 3;
  }
  if (p.wanted < WANTED.heliAt) state.heli = null;
  if (state.heli) {
    state.heli.angle += state.heli.speed * dt;
    state.heli.x = p.x + Math.cos(state.heli.angle) * state.heli.radius;
    state.heli.y = p.y + Math.sin(state.heli.angle) * state.heli.radius - 60;
    state.heli.spotlight = (state.heli.spotlight + dt) % 1;
  }
}

export function bustPlayer(state) {
  const p = state.player;
  p.busted = true;
  p.dead = true;
  p.cash = Math.floor(p.cash * 0.9);
  p.wanted = 0;
  p.wantedHeat = 0;
}
