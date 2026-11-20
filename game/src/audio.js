// Sound, synthesized live with WebAudio: engine hum, police siren, radio
// stations as looping note patterns, pickup and mission chimes. No audio
// files, no network. Created on the first user gesture; X toggles it.

import { RADIO } from './config.js';

const BASE = [220, 233.08, 246.94, 261.63, 277.18, 293.66, 311.13, 329.63, 349.23, 369.99, 392, 415.3];

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let radioTimer = null;
  let radioStep = 0;
  let enabled = true;
  let station = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type, vol) {
    if (!ctx || !enabled) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.value = vol || 0.12;
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g);
      g.connect(master);
      o.start();
      o.stop(ctx.currentTime + dur);
    } catch { /* sound is decoration, never fatal */ }
  }

  function radioTick() {
    if (!ctx || !enabled) return;
    const st = RADIO[station % RADIO.length];
    const scale = st.scale;
    const note = scale[radioStep % scale.length] + 12 * Math.floor(radioStep / scale.length) % 24;
    const freq = BASE[note % 12] * (note >= 12 ? 2 : 1);
    blip(freq, 0.22, 'triangle', 0.05);
    if (radioStep % 4 === 0) blip(freq / 2, 0.3, 'sine', 0.05);
    radioStep += 1;
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    setEnabled(on) {
      enabled = on;
      if (!enabled && ctx) {
        if (engineGain) engineGain.gain.value = 0;
        if (sirenGain) sirenGain.gain.value = 0;
        if (radioTimer) { clearInterval(radioTimer); radioTimer = null; }
      } else if (enabled && ctx && !radioTimer) {
        radioTimer = setInterval(radioTick, 60000 / RADIO[station % RADIO.length].tempo / 2);
      }
    },
    setStation(n) {
      station = n;
      radioStep = 0;
      if (ctx && enabled) {
        if (radioTimer) clearInterval(radioTimer);
        radioTimer = setInterval(radioTick, 60000 / RADIO[station % RADIO.length].tempo / 2);
      }
    },
    engine(speed, maxSpeed) {
      if (!ctx || !enabled || !engineGain) return;
      const v = Math.min(1, Math.abs(speed) / (maxSpeed || 420));
      engineGain.gain.value = 0.02 + v * 0.05;
      engineOsc.frequency.value = 48 + v * 110;
    },
    siren(wanted, time) {
      if (!ctx || !enabled || !sirenGain) return;
      if (wanted > 0) {
        sirenGain.gain.value = 0.02 + wanted * 0.006;
        sirenOsc.frequency.value = Math.sin(time * 3) > 0 ? 720 : 540;
      } else {
        sirenGain.gain.value = 0;
      }
    },
    pickup() { blip(660, 0.12, 'sine', 0.12); setTimeout(() => blip(880, 0.15, 'sine', 0.12), 90); },
    missionDone() {
      blip(523, 0.15, 'triangle', 0.14);
      setTimeout(() => blip(659, 0.15, 'triangle', 0.14), 120);
      setTimeout(() => blip(784, 0.25, 'triangle', 0.14), 240);
    },
    shot() { blip(180, 0.08, 'square', 0.1); },
    crash() { blip(90, 0.25, 'sawtooth', 0.16); },
  };
}
