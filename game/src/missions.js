// Story missions: 8 scripted jobs of the IRONHOLD campaign.
// Each mission is a list of steps; the tracker shows the current one and the
// waypoint arrow points at it. Steps complete by proximity, pickup holds,
// stealing a vehicle, surviving a chase, or escaping the heat.

import { MISSIONS, PLACES } from './config.js';
import { dist } from './rng.js';
import { addHeat } from './entities.js';

export function currentMission(player) {
  if (player.missionIndex >= MISSIONS.length) return null;
  return MISSIONS[player.missionIndex];
}

export function missionProgress(player) {
  const m = currentMission(player);
  if (!m) return { done: true, label: 'CAMPAIGN COMPLETE', x: 0, y: 0 };
  const step = m.steps[player.stepIndex || 0];
  return { done: false, mission: m, step, label: step.label, x: step.x || 0, y: step.y || 0 };
}

export function createMissionState() {
  return { stepIndex: 0, holdT: 0, surviveT: 0, wantedAtStart: 0, banner: '', bannerT: 0 };
}

export function missionLabel(player) {
  const m = currentMission(player);
  if (!m) return 'CAMPAIGN COMPLETE — KING OF THE LAKE';
  return 'MISSION ' + m.id + '/8: ' + m.name;
}

// Advance the mission state one fixed step. Returns a message when a step or
// mission completes, so the caller can show it and play the reward sound.
export function stepMissions(state, dt) {
  const p = state.player;
  const ms = state.missionState;
  const m = currentMission(p);
  if (!m) return null;
  const step = m.steps[ms.stepIndex];
  if (!step) return null;

  if (step.type === 'goto' || step.type === 'escape') {
    const d = dist(p.x, p.y, step.x, step.y);
    const near = step.type === 'escape' ? d < 170 : d < 90;
    if (step.type === 'escape' && p.wanted > 0) return null;
    if (near) return completeStep(state, m, ms);
  } else if (step.type === 'pickup') {
    const d = dist(p.x, p.y, step.x, step.y);
    if (d < 90) {
      ms.holdT += dt;
      if (ms.holdT >= (step.hold || 2)) {
        ms.holdT = 0;
        return completeStep(state, m, ms);
      }
      return 'HOLD ON… ' + Math.ceil((step.hold || 2) - ms.holdT) + 's';
    }
    ms.holdT = 0;
  } else if (step.type === 'steal') {
    const d = dist(p.x, p.y, step.x, step.y);
    if (d < 80 && !p.onFoot) {
      // Stealing the truck: the reefer truck is parked at the marker.
      return completeStep(state, m, ms);
    }
    if (d < 80 && p.onFoot) return 'Get in the reefer truck (E)';
  } else if (step.type === 'wanted') {
    if (p.wanted >= (step.level || 3)) return completeStep(state, m, ms);
    return 'Raise the heat to ' + (step.level || 3) + ' stars';
  } else if (step.type === 'survive') {
    if (p.wanted < (step.level || 4)) {
      addHeat(state, 0.8);
      ms.surviveT = 0;
      return 'Get the heat to ' + (step.level || 4) + ' stars first';
    }
    ms.surviveT += dt;
    const left = Math.ceil((step.seconds || 60) - ms.surviveT);
    if (left <= 0) return completeStep(state, m, ms);
    return 'SURVIVE: ' + left + 's — stay alive, stay moving';
  }
  return null;
}

function completeStep(state, mission, ms) {
  const p = state.player;
  ms.stepIndex += 1;
  if (ms.stepIndex >= mission.steps.length) {
    p.cash += mission.reward;
    p.respect += mission.respect;
    p.missionsDone += 1;
    p.missionIndex += 1;
    ms.stepIndex = 0;
    ms.surviveT = 0;
    const next = currentMission(p);
    state.message = 'MISSION COMPLETE: ' + mission.name + '  +' + mission.reward + ' CASH';
    state.messageT = 4;
    ms.banner = next ? 'NEXT: ' + next.name : 'CAMPAIGN COMPLETE';
    ms.bannerT = 4;
    return 'MISSION COMPLETE';
  }
  state.message = 'Objective complete';
  state.messageT = 2;
  return 'OBJECTIVE COMPLETE';
}

export function startMission(state, index) {
  const p = state.player;
  p.missionIndex = index;
  state.missionState.stepIndex = 0;
  state.missionState.holdT = 0;
  state.missionState.surviveT = 0;
  const m = MISSIONS[index];
  state.message = 'NEW MISSION: ' + m.name + ' — ' + m.brief;
  state.messageT = 5;
}

// Places the player can walk up to and use with G: garage, shops, safehouse.
export function nearestPlace(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const key of Object.keys(PLACES)) {
    const place = PLACES[key];
    const d = dist(x, y, place.x, place.y);
    if (d < bestD) { bestD = d; best = { key, ...place }; }
  }
  return bestD < 110 ? best : null;
}
