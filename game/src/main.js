// Boot and the one loop: input every frame, the world advances in fixed 1/60 s
// steps, the renderer paints what is there. Screens: title, play, paused, over.
// Menus (missions, garage, gun shop, outfitters) are overlays over play.
//
// ?seed=N fixes the city. ?shot=hero|drive|chase|missions stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady.

import { STEP, VIEW, SAVE_KEY, GARAGE_ITEMS, GUN_ITEMS, OUTFITS, PLACES, MISSIONS } from './config.js';
import { clamp } from './rng.js';
import { createGame, stepPlayer, stepTraffic, stepPeds, stepBullets, stepSnow, addHeat, fireBullet, makeCar } from './entities.js';
import { stepPolice, bustPlayer } from './police.js';
import { createMissionState, stepMissions, currentMission, nearestPlace, startMission } from './missions.js';
import { createInput, ACT_CONFIRM, ACT_PAUSE, ACT_INTERACT, ACT_RADIO, ACT_MISSIONS, ACT_SHOOT, ACT_SOUND, ACT_TITLE } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261119;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const state = createGame(seed);
state.missionState = createMissionState();
const renderer = createRenderer(canvas);
const audio = createAudio();

function announce(message) {
  status.textContent = message;
}

function saveGame(slot) {
  const p = state.player;
  try {
    window.localStorage.setItem(SAVE_KEY + '.' + slot, JSON.stringify({
      cash: p.cash, respect: p.respect, missionIndex: p.missionIndex,
      missionsDone: p.missionsDone, upgrades: p.upgrades, weapons: p.weapons,
      outfit: p.outfit, weapon: p.weapon, x: p.x, y: p.y, clock: p.clock,
      health: p.health, carsStolen: p.carsStolen, kills: p.kills,
    }));
    return true;
  } catch {
    return false;
  }
}

function loadGame(slot) {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY + '.' + slot);
    if (!raw) return false;
    const d = JSON.parse(raw);
    const p = state.player;
    p.cash = d.cash; p.respect = d.respect; p.missionIndex = d.missionIndex;
    p.missionsDone = d.missionsDone; p.upgrades = d.upgrades || [];
    p.weapons = d.weapons || ['pistol']; p.outfit = d.outfit || 'parka';
    p.weapon = d.weapon || 'pistol'; p.x = d.x; p.y = d.y; p.clock = d.clock;
    p.health = d.health || 100; p.carsStolen = d.carsStolen || 0; p.kills = d.kills || 0;
    p.maxHealth = 100 + (p.upgrades.includes('armor2') ? 100 : p.upgrades.includes('armor1') ? 40 : 0);
    state.missionState = createMissionState();
    return true;
  } catch {
    return false;
  }
}

function runShot(name) {
  const scene = stageShot(name, state);
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen, scene.ui);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput();
  let screen = SCREEN_TITLE;
  let menu = null; // null | 'missions' | 'garage' | 'gun' | 'clothes'
  let menuIndex = 0;
  let prevThrottle = 0;
  let accumulator = 0;
  let last = performance.now();

  function startGame(fresh) {
    if (fresh) {
      const keepSeed = state.seed;
      const freshState = createGame(keepSeed);
      Object.assign(state, freshState);
      state.missionState = createMissionState();
      startMission(state, 0);
    }
    menu = null;
    screen = SCREEN_PLAY;
    announce('Playing. Mission 1: First Snow.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    announce(state.player.busted ? 'Busted. The Ironhold PD took you in.' : 'Wasted. Ironhold is cold without you.');
  }

  function togglePause() {
    if (screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  // Enter or exit the nearest car. Stealing a parked traffic car raises heat.
  function enterExitCar() {
    const p = state.player;
    if (!p.onFoot) {
      const car = p.car;
      p.car = null;
      p.onFoot = true;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 44;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 44;
      p.speed = 0;
      state.traffic.push(car);
      return;
    }
    let best = null;
    let bestD = 70;
    for (const car of state.traffic) {
      const d = Math.hypot(car.x - p.x, car.y - p.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    if (best) {
      state.traffic.splice(state.traffic.indexOf(best), 1);
      p.car = best;
      p.onFoot = false;
      p.x = best.x; p.y = best.y; p.angle = best.angle;
      p.carsStolen += 1;
      addHeat(state, 1);
      state.message = 'Car stolen — ' + best.model.name + '. Wanted level up.';
      state.messageT = 3;
      audio.pickup();
    }
  }

  function shoot() {
    const p = state.player;
    if (!p.onFoot) {
      // Handbrake pulse in a car.
      if (p.car) p.car.speed *= 0.55;
      return;
    }
    if (p.ammo <= 0) {
      state.message = 'Out of ammo — visit the Gun Shop.';
      state.messageT = 2;
      return;
    }
    p.ammo -= 1;
    fireBullet(state, p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20, p.angle, true);
    addHeat(state, 0.2);
    audio.shot();
  }

  function interact() {
    const p = state.player;
    const place = nearestPlace(p.x, p.y);
    if (!place) return;
    if (place.key === 'safehouse') {
      p.health = p.maxHealth;
      saveGame(1);
      state.message = 'Safehouse: healed and saved (slot 1).';
      state.messageT = 3;
      audio.pickup();
      return;
    }
    if (place.key === 'garage') { menu = 'garage'; menuIndex = 0; return; }
    if (place.key === 'gunShop') { menu = 'gun'; menuIndex = 0; return; }
    if (place.key === 'clothes') { menu = 'clothes'; menuIndex = 0; return; }
    state.message = place.label + ' — ' + (place.key === 'vault' ? 'Mission 8 cracks this vault.' : place.key === 'factory' ? 'Mission 3 steals a truck here.' : 'Part of Ironhold. Keep driving.');
    state.messageT = 3;
  }

  function buy(item, listName) {
    const p = state.player;
    if (listName === 'garage') {
      if (p.upgrades.includes(item.id)) return;
      if (item.needs && !p.upgrades.includes(item.needs)) {
        state.message = 'Needs ' + item.needs + ' first.';
        state.messageT = 2;
        return;
      }
      if (p.cash < item.price) { state.message = 'Not enough cash.'; state.messageT = 2; return; }
      p.cash -= item.price;
      p.upgrades.push(item.id);
      if (item.id === 'armor1') p.maxHealth = 140;
      if (item.id === 'armor2') p.maxHealth = 200;
      if (item.id === 'paintAmber' && p.car) p.car.color = '#C96A1E';
      if (item.id === 'paintIce' && p.car) p.car.color = '#7FA9C6';
      if (item.id === 'tires') state.message = 'Studded ice tires fitted — grip on the lake improved.';
      state.message = 'Bought: ' + item.name;
      state.messageT = 2;
      audio.pickup();
    } else if (listName === 'gun') {
      if (p.weapons.includes(item.id)) { p.weapon = item.id; state.message = 'Equipped: ' + item.name; state.messageT = 2; return; }
      if (p.cash < item.price) { state.message = 'Not enough cash.'; state.messageT = 2; return; }
      p.cash -= item.price;
      p.weapons.push(item.id);
      p.weapon = item.id;
      p.ammo += 30;
      state.message = 'Bought: ' + item.name;
      state.messageT = 2;
      audio.pickup();
    } else if (listName === 'clothes') {
      if (p.cash < item.price && p.outfit !== item.id) { state.message = 'Not enough cash.'; state.messageT = 2; return; }
      if (p.outfit !== item.id) p.cash -= item.price;
      p.outfit = item.id;
      state.message = 'Wearing: ' + item.name;
      state.messageT = 2;
      audio.pickup();
    }
  }

  function handleMenuDigit(d) {
    if (screen === SCREEN_TITLE) {
      menuIndex = clamp(d - 1, 0, 3);
      confirmTitle();
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (d >= 1 && d <= 3) {
        const ok = saveGame(d);
        state.message = ok ? 'Saved in slot ' + d + '.' : 'Save failed (storage off).';
        state.messageT = 2;
      } else if (d === 0) {
        startGame(true);
      }
      return;
    }
    if (menu === 'garage' && d >= 1 && d <= GARAGE_ITEMS.length) buy(GARAGE_ITEMS[d - 1], 'garage');
    else if (menu === 'gun' && d >= 1 && d <= GUN_ITEMS.length) buy(GUN_ITEMS[d - 1], 'gun');
    else if (menu === 'clothes' && d >= 1 && d <= OUTFITS.length) buy(OUTFITS[d - 1], 'clothes');
  }

  function confirmTitle() {
    if (menuIndex === 0) startGame(true);
    else if (menuIndex === 1) {
      if (loadGame(1)) { screen = SCREEN_PLAY; announce('Save loaded. Welcome back to Ironhold.'); }
      else { state.message = 'No save in slot 1 yet — starting fresh.'; state.messageT = 3; startGame(true); }
    } else if (menuIndex === 2) {
      startGame(true);
      menu = 'missions';
    } else {
      state.message = 'WASD drive · E enter car · Space shoot/brake · R radio · M missions · G interact · P pause';
      state.messageT = 5;
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    const digit = input.takeDigit();
    const throttle = input.throttle();
    // Menu navigation with W/S rising edges.
    if (throttle !== prevThrottle && throttle !== 0 && (screen === SCREEN_TITLE || menu)) {
      const max = screen === SCREEN_TITLE ? 3 : 7;
      menuIndex = clamp(menuIndex + (throttle > 0 ? -1 : 1), 0, max);
    }
    prevThrottle = throttle;
    if (digit !== null && digit !== undefined) handleMenuDigit(digit);
    if (actions & ACT_TITLE && screen === SCREEN_PAUSED) {
      screen = SCREEN_TITLE;
      menu = null;
      announce('FROSTLINE. Press Enter to start.');
    }
    if (actions & ACT_SOUND) {
      state.player.soundOn = !state.player.soundOn;
      audio.setEnabled(state.player.soundOn);
    }
    audio.unlock();
    if (actions & ACT_CONFIRM) {
      if (screen === SCREEN_TITLE) confirmTitle();
      else if (screen === SCREEN_OVER) startGame(true);
      else if (screen === SCREEN_PAUSED) togglePause();
      else if (menu === 'garage') buy(GARAGE_ITEMS[menuIndex] || GARAGE_ITEMS[0], 'garage');
      else if (menu === 'gun') buy(GUN_ITEMS[menuIndex] || GUN_ITEMS[0], 'gun');
      else if (menu === 'clothes') buy(OUTFITS[menuIndex] || OUTFITS[0], 'clothes');
    }
    if (actions & ACT_PAUSE) {
      if (menu) menu = null;
      else togglePause();
    }
    if (screen !== SCREEN_PLAY) return;
    if (actions & ACT_INTERACT) {
      if (menu) menu = null;
      else enterExitCar();
    }
    if (actions & ACT_SHOOT) shoot();
    if (actions & ACT_RADIO) {
      state.player.radio = (state.player.radio + 1) % 3;
      audio.setStation(state.player.radio);
      state.message = 'Radio: ' + ['FROST FM 88.1', 'IRONHOLD ROCK 94.7', 'NORTHLIGHT 101.3'][state.player.radio];
      state.messageT = 2;
    }
    if (actions & ACT_MISSIONS) {
      menu = menu === 'missions' ? null : 'missions';
    }
  }

  function step() {
    const p = state.player;
    if (screen !== SCREEN_PLAY || menu) return;
    stepPlayer(state, input, STEP);
    stepTraffic(state, STEP);
    stepPeds(state, STEP);
    stepPolice(state, STEP);
    stepBullets(state, STEP);
    stepSnow(state, STEP);
    // Wanted decays when no police are close; the heat otherwise stays.
    const nearPolice = state.police.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 520);
    if (!nearPolice && p.wanted > 0) {
      p.wantedHeat = Math.max(0, p.wantedHeat - 0.045 * STEP * 10);
      p.wanted = Math.floor(p.wantedHeat);
    }
    // Clock: one game minute every two real seconds.
    p.clock = (p.clock + STEP * 30) % 86400;
    // Blizzard blows in at random, 20 seconds at a time.
    if (Math.random() < STEP * 0.004) state.blizzard = 0.7;
    if (state.blizzard > 0 && Math.random() < STEP * 0.05) state.blizzard = 0;
    const m = stepMissions(state, STEP);
    if (m === 'MISSION COMPLETE') audio.missionDone();
    else if (m && m !== 'OBJECTIVE COMPLETE') { state.message = m; state.messageT = 1; }
    if (state.messageT > 0) state.messageT -= STEP;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - STEP * 1.5);
    // Interact hint: standing near a usable place.
    const place = nearestPlace(p.x, p.y);
    if (place && !state.message) { /* hint drawn by HUD via place label */ }
    // Death checks.
    if (p.health <= 0 && !p.dead) {
      p.dead = true;
      endGame();
    }
    if (p.busted && !p.dead) { p.dead = true; endGame(); }
    audio.engine(p.onFoot ? 0 : (p.car ? p.car.speed : 0), 420);
    audio.siren(p.wanted, state.time);
    state.time += STEP;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    while (accumulator >= STEP && screen !== SCREEN_OVER) {
      step();
      accumulator -= STEP;
      if (screen === SCREEN_TITLE) {
        // Title backdrop: traffic drifts, snow falls.
        stepTraffic(state, STEP);
        stepSnow(state, STEP);
        state.time += STEP;
      }
    }
    if (screen === SCREEN_OVER) accumulator = 0;
    renderer.draw(state, screen, { menu, menuIndex, heroMode: false });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // Debug handle for playtests (read-only inspection of live state).
  window.__frostline = state;
  // Title backdrop: the player idles in a sedan on the ice road while the menu shows.
  const p0 = state.player;
  const titleCar = makeCar(0, 1500, 2040, Math.atan2(1600 - 2350, 2860 - 260));
  titleCar.speed = 0;
  p0.car = titleCar;
  p0.onFoot = false;
  p0.x = 1500; p0.y = 2040;
  p0.cash = 1240; p0.wanted = 3; p0.wantedHeat = 3.2;
  state.police.push(Object.assign({}, { kind: 'police', x: 1240, y: 2120, angle: titleCar.angle, speed: 0, color: '#E8EDF2', w: 62, h: 30, health: 100, police: true, stuck: 0, siren: 0 }));
  announce('FROSTLINE. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
