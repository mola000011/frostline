// Staged screenshot scenes behind ?shot=hero|drive|chase|missions.
// Each scene sets the real game state (player, traffic, police, wanted, mission)
// to a fixed, seeded setup and returns the screen + UI to paint, so the frame
// is what the game really looks like and the same seed always gives the same frame.

import { STEP } from './config.js';
import { makeCar } from './entities.js';
import { makePoliceCar, makeHeli } from './police.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const ROAD_ANGLE = Math.atan2(1600 - 2350, 2860 - 260); // ice road direction

function placeCar(state, modelIndex, x, y, angle, speed, color) {
  const car = makeCar(modelIndex, x, y, angle);
  car.speed = speed;
  if (color) car.color = color;
  state.traffic.push(car);
  return car;
}

function placePolice(state, x, y, angle, speed) {
  const cop = makePoliceCar(x, y);
  cop.angle = angle;
  cop.speed = speed;
  state.police.push(cop);
  return cop;
}

function givePlayerCar(state, modelIndex, x, y, angle, speed, color) {
  const p = state.player;
  const car = makeCar(modelIndex, x, y, angle);
  car.speed = speed;
  if (color) car.color = color;
  p.car = car;
  p.onFoot = false;
  p.x = x; p.y = y; p.angle = angle; p.speed = Math.abs(speed);
  return car;
}

function clearScene(state) {
  state.traffic = [];
  state.peds = [];
  state.police = [];
  state.bullets = [];
  state.roadblocks = [];
  state.heli = null;
  state.blizzard = 0;
  state.time = 12.5; // fixed, so police lights and snow sit the same every shot
}

// The cover: title over a police chase on the frozen lake, like the frame-1 hero.
function stageHero(state) {
  clearScene(state);
  const p = state.player;
  p.cash = 1240;
  p.health = 100;
  p.respect = 180;
  p.wanted = 3;
  p.wantedHeat = 3.2;
  p.missionIndex = 1; // ICE-ROAD RUN
  p.clock = 19 * 3600 + 24 * 60;
  givePlayerCar(state, 0, 1500, 2040, ROAD_ANGLE, 140);
  // Smuggler truck ahead, lead sedan further up the road.
  placeCar(state, 3, 1750, 1970, ROAD_ANGLE, 130);
  placeCar(state, 2, 2050, 1880, ROAD_ANGLE, 150, '#7FA9C6');
  // Two police cars behind with lights flashing.
  placePolice(state, 1240, 2120, ROAD_ANGLE, 170);
  placePolice(state, 1050, 2180, ROAD_ANGLE, 180);
  // A few cars on the far shore road for depth.
  placeCar(state, 5, 2200, 1400, 0, 120);
  placeCar(state, 1, 1000, 1000, Math.PI / 2, 110);
  return {
    screen: SCREEN_TITLE,
    ui: { heroMode: true, heroCam: { x: 1560, y: 1980 }, menuIndex: 0 },
  };
}

// Driving the ice road with traffic: the smuggler's view.
function stageDrive(state) {
  clearScene(state);
  const p = state.player;
  p.cash = 1890;
  p.health = 100;
  p.respect = 400;
  p.wanted = 1;
  p.wantedHeat = 1.1;
  p.missionIndex = 1;
  p.clock = 21 * 3600 + 40 * 60;
  givePlayerCar(state, 3, 1350, 2080, ROAD_ANGLE, 230);
  placeCar(state, 0, 1620, 2000, ROAD_ANGLE, 200);
  placeCar(state, 5, 1900, 1920, ROAD_ANGLE, 210, '#C9A227');
  placeCar(state, 1, 1080, 2150, ROAD_ANGLE, 190);
  placePolice(state, 980, 2190, ROAD_ANGLE, 200);
  return { screen: SCREEN_PLAY, ui: { menuIndex: 0 } };
}

// Four stars, helicopter, roadblock: the blizzard chase.
function stageChase(state) {
  clearScene(state);
  const p = state.player;
  p.cash = 3120;
  p.health = 72;
  p.respect = 800;
  p.wanted = 4;
  p.wantedHeat = 4.4;
  p.missionIndex = 6; // BLIZZARD CHASE
  p.clock = 2 * 3600 + 10 * 60;
  state.blizzard = 0.7;
  givePlayerCar(state, 2, 1800, 1000, 0, 300, '#7FA9C6');
  placePolice(state, 1560, 1000, 0, 320);
  placePolice(state, 1480, 960, 0, 310);
  placePolice(state, 1650, 1060, 0, 300);
  placePolice(state, 2050, 1000, Math.PI, 280);
  state.roadblocks.push({ x: 2260, y: 1000, angle: Math.PI / 2, t: 20 });
  state.roadblocks.push({ x: 2260, y: 1060, angle: Math.PI / 2, t: 20 });
  state.heli = makeHeli(1800, 820);
  state.message = 'SURVIVE: 47s — stay alive, stay moving';
  state.messageT = 99;
  return { screen: SCREEN_PLAY, ui: { menuIndex: 0 } };
}

// Downtown with the mission board open: campaign, garage, HUD, minimap.
function stageMissions(state) {
  clearScene(state);
  const p = state.player;
  p.cash = 4860;
  p.health = 100;
  p.respect = 800;
  p.wanted = 2;
  p.wantedHeat = 2.3;
  p.missionIndex = 4; // HARBOR LIGHTS
  p.missionsDone = 4;
  p.clock = 23 * 3600 + 5 * 60;
  givePlayerCar(state, 0, 1500, 420, Math.PI / 2, 0);
  placeCar(state, 1, 1400, 600, Math.PI / 2, 120);
  placeCar(state, 5, 1800, 1000, 0, 130, '#C9A227');
  placeCar(state, 2, 2200, 1400, -Math.PI / 2, 140);
  placePolice(state, 1300, 900, Math.PI / 4, 200);
  placePolice(state, 1900, 700, -Math.PI / 2, 190);
  // Pedestrians on the downtown sidewalk.
  for (let i = 0; i < 8; i += 1) {
    state.peds.push({
      kind: 'ped', x: 1440 + (i % 4) * 40, y: 560 + Math.floor(i / 4) * 60,
      angle: 0, speed: 40, color: '#C9A227', walkPhase: i, flee: 0, dead: false,
    });
  }
  return { screen: SCREEN_PLAY, ui: { menu: 'missions', menuIndex: 4 } };
}

export function stageShot(name, state) {
  // Re-seed the city so the shot is identical every run.
  const fn = { hero: stageHero, drive: stageDrive, chase: stageChase, missions: stageMissions }[name];
  if (!fn) return stageHero(state);
  return fn(state);
}

export { STEP };
