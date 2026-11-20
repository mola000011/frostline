// Drawing only: game state in, pixels out. The 1280x720 logical field scales to
// fit the window; the world is a top-down night city, the HUD is screen space.
// Fill-only shapes throughout; no text stroke, so small text stays crisp.

import {
  VIEW, WORLD, PALETTE, FONT, GAME_DATE, GAME_CITY, RADIO, MISSIONS,
  GARAGE_ITEMS, GUN_ITEMS, OUTFITS, PLACES, rankFor,
} from './config.js';
import { clamp, fmtCash, fmtClock } from './rng.js';
import { onLake, onIceRoad, onRoad, surfaceAt } from './world.js';
import { missionProgress, currentMission, missionLabel } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function circle(ctx, x, y, r, color) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function star(ctx, cx, cy, r, color) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function glow(ctx, x, y, r, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color.replace('A', alpha.toFixed(2)));
  g.addColorStop(1, color.replace('A', '0'));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, ox: 0, oy: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const w = Math.round(window.innerWidth * ratio);
    const h = Math.round(window.innerHeight * ratio);
    canvas.width = w;
    canvas.height = h;
    view.scale = Math.min(w / VIEW.width, h / VIEW.height);
    view.ox = (w - VIEW.width * view.scale) / 2;
    view.oy = (h - VIEW.height * view.scale) / 2;
  }

  function font(size, weight) {
    const key = weight + size;
    if (!fonts.has(key)) fonts.set(key, (weight || 400) + ' ' + size + 'px ' + FONT);
    return fonts.get(key);
  }

  function text(str, x, y, size, color, align, weight) {
    ctx.font = font(size, weight);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
  }

  // ---------------- world ----------------

  function drawGround(state, cam) {
    const x0 = cam.x - VIEW.width / 2 - 60;
    const y0 = cam.y - VIEW.height / 2 - 60;
    const x1 = cam.x + VIEW.width / 2 + 60;
    const y1 = cam.y + VIEW.height / 2 + 60;
    // Night ground: deep navy snow.
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, '#0B1B30');
    g.addColorStop(1, '#0A1728');
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // Frozen lake: night ice — deeper blue than the frame-1 daylight test,
    // so HUD text and amber lights read over it.
    if (y1 > WORLD.lakeY) {
      const ice = ctx.createLinearGradient(0, WORLD.lakeY, 0, WORLD.height);
      ice.addColorStop(0, '#A9C8DD');
      ice.addColorStop(0.5, '#7FA9C6');
      ice.addColorStop(1, '#5B84A6');
      ctx.fillStyle = ice;
      ctx.fillRect(x0, WORLD.lakeY, x1 - x0, WORLD.height - WORLD.lakeY);
      // Cracks: thin pale lines across the ice.
      ctx.strokeStyle = 'rgba(70,110,145,0.5)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 14; i += 1) {
        const cx = ((i * 613) % 3200) + 40;
        const cy = WORLD.lakeY + 40 + ((i * 197) % 760);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + 90, cy + 26);
        ctx.lineTo(cx + 150, cy + 70);
        ctx.lineTo(cx + 240, cy + 60);
        ctx.stroke();
      }
      // Pressure ridges.
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(120, 1900); ctx.lineTo(420, 1860); ctx.lineTo(700, 1890); ctx.lineTo(980, 1850);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(1800, 2150); ctx.lineTo(2150, 2110); ctx.lineTo(2500, 2150);
      ctx.stroke();
    }
    // Ice road: dark ploughed diagonal with amber dashes and snow banks.
    const ir = { x1: 260, y1: 2350, x2: 2860, y2: 1600 };
    ctx.fillStyle = PALETTE.road;
    ctx.beginPath();
    const dx = ir.x2 - ir.x1;
    const dy = ir.y2 - ir.y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = (-dy / len) * 78;
    const ny = (dx / len) * 78;
    ctx.moveTo(ir.x1 + nx, ir.y1 + ny);
    ctx.lineTo(ir.x2 + nx, ir.y2 + ny);
    ctx.lineTo(ir.x2 - nx, ir.y2 - ny);
    ctx.lineTo(ir.x1 - nx, ir.y1 - ny);
    ctx.closePath();
    ctx.fill();
    // Snow banks along the ice road.
    ctx.fillStyle = 'rgba(226,238,247,0.85)';
    ctx.beginPath();
    ctx.moveTo(ir.x1 + nx, ir.y1 + ny);
    ctx.lineTo(ir.x2 + nx, ir.y2 + ny);
    ctx.lineTo(ir.x2 + nx * 1.25, ir.y2 + ny * 1.25);
    ctx.lineTo(ir.x1 + nx * 1.25, ir.y1 + ny * 1.25);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(ir.x1 - nx, ir.y1 - ny);
    ctx.lineTo(ir.x2 - nx, ir.y2 - ny);
    ctx.lineTo(ir.x2 - nx * 1.25, ir.y2 - ny * 1.25);
    ctx.lineTo(ir.x1 - nx * 1.25, ir.y1 - ny * 1.25);
    ctx.closePath();
    ctx.fill();
    // Amber centre dashes.
    ctx.fillStyle = 'rgba(201,162,39,0.8)';
    for (let i = 0; i < 12; i += 1) {
      const t = 0.04 + i * 0.08;
      const px = ir.x1 + dx * t;
      const py = ir.y1 + dy * t;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.atan2(dy, dx));
      ctx.fillRect(-14, -3, 28, 6);
      ctx.restore();
    }
  }

  function drawRoads(state, cam) {
    ctx.fillStyle = PALETTE.road;
    for (const sx of [200, 600, 1000, 1400, 1800, 2200, 2600, 3000]) {
      ctx.fillRect(sx - 48, 0, 96, WORLD.lakeY);
    }
    for (const sy of [200, 600, 1000, 1400]) {
      ctx.fillRect(0, sy - 48, WORLD.width, 96);
    }
    // Centre dashes on the streets.
    ctx.fillStyle = 'rgba(201,162,39,0.7)';
    for (const sx of [200, 600, 1000, 1400, 1800, 2200, 2600, 3000]) {
      for (let y = 60; y < WORLD.lakeY; y += 90) ctx.fillRect(sx - 3, y, 6, 34);
    }
    for (const sy of [200, 600, 1000, 1400]) {
      for (let x = 60; x < WORLD.width; x += 90) ctx.fillRect(x, sy - 3, 34, 6);
    }
    // Snow piled at the road edges.
    ctx.fillStyle = 'rgba(226,238,247,0.55)';
    for (const sx of [200, 600, 1000, 1400, 1800, 2200, 2600, 3000]) {
      ctx.fillRect(sx - 56, 0, 8, WORLD.lakeY);
      ctx.fillRect(sx + 48, 0, 8, WORLD.lakeY);
    }
  }

  function drawBuildings(state, cam) {
    for (const b of state.world.buildings) {
      if (b.x > cam.x + 700 || b.x + b.w < cam.x - 700 || b.y > cam.y + 420 || b.y + b.h < cam.y - 420) continue;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      if (b.tall) {
        ctx.fillStyle = '#0D2036';
        ctx.fillRect(b.x + 8, b.y - 14, b.w - 16, 14);
      }
      // Amber windows, seeded per building.
      ctx.fillStyle = PALETTE.window;
      let s = b.seed;
      for (let i = 0; i < b.windows; i += 1) {
        s = (s * 16807) % 2147483647;
        const wx = b.x + 10 + (s % Math.max(10, b.w - 24));
        const wy = b.y + 10 + ((s >> 4) % Math.max(10, b.h - 24));
        ctx.globalAlpha = 0.45 + ((s >> 8) % 50) / 100;
        ctx.fillRect(wx, wy, 7, 9);
      }
      ctx.globalAlpha = 1;
      // Snow on the roof.
      ctx.fillStyle = 'rgba(226,238,247,0.85)';
      ctx.fillRect(b.x, b.y, b.w, 6);
    }
    // Smokestacks with amber rims and drifting smoke.
    for (const st of state.world.smokestacks) {
      ctx.fillStyle = '#0A1524';
      ctx.fillRect(st.x, st.y - st.h, 24, st.h + 60);
      ctx.fillStyle = PALETTE.amberDim;
      ctx.fillRect(st.x - 2, st.y - st.h - 6, 28, 8);
      ctx.globalAlpha = 0.12;
      for (let i = 0; i < 4; i += 1) {
        circle(ctx, st.x + 12 + i * 6, st.y - st.h - 20 - i * 16, 12 + i * 5, '#9FB2C4');
      }
      ctx.globalAlpha = 1;
    }
    // Harbor crates.
    ctx.fillStyle = '#3A2E22';
    for (const c of state.world.crates) ctx.fillRect(c.x, c.y, c.s, c.s);
    // Snow pines.
    for (const t of state.world.trees) {
      if (Math.abs(t.x - cam.x) > 700 || Math.abs(t.y - cam.y) > 420) continue;
      ctx.fillStyle = '#0E2A22';
      ctx.beginPath();
      ctx.moveTo(t.x, t.y - t.r * 1.6);
      ctx.lineTo(t.x - t.r, t.y + t.r * 0.7);
      ctx.lineTo(t.x + t.r, t.y + t.r * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(226,238,247,0.8)';
      ctx.beginPath();
      ctx.moveTo(t.x, t.y - t.r * 1.6);
      ctx.lineTo(t.x - t.r * 0.5, t.y - t.r * 0.4);
      ctx.lineTo(t.x + t.r * 0.5, t.y - t.r * 0.4);
      ctx.closePath();
      ctx.fill();
    }
    // Street lamps: amber glow pools.
    for (const l of state.world.lamps) {
      if (Math.abs(l.x - cam.x) > 700 || Math.abs(l.y - cam.y) > 420) continue;
      glow(ctx, l.x, l.y, 26, 'rgba(255,179,71,A)', 0.28);
      circle(ctx, l.x, l.y, 3, '#FFC46B');
    }
  }

  function drawMarker(state, x, y, color, label, pulse) {
    const p = pulse ? 1 + Math.sin(state.time * 4) * 0.15 : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = color;
    const s = 16 * p;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.restore();
    glow(ctx, x, y, 60 * p, 'rgba(255,179,71,A)', 0.25);
    if (label) {
      ctx.font = font(15, 700);
      ctx.fillStyle = '#F4F8FF';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y - 30);
    }
  }

  function drawCarShape(car, isPlayer, time) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const w = car.w || 62;
    const h = car.h || 30;
    // Shadow.
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#0A1A28';
    ctx.beginPath();
    ctx.ellipse(2, 6, w * 0.55, h * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Headlight beams forward.
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#FFD98A';
    ctx.beginPath();
    ctx.moveTo(w * 0.4, -h * 0.3); ctx.lineTo(w * 0.4 + 90, -h * 0.9); ctx.lineTo(w * 0.4 + 90, -h * 0.1);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w * 0.4, h * 0.3); ctx.lineTo(w * 0.4 + 90, h * 0.1); ctx.lineTo(w * 0.4 + 90, h * 0.9);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    // Body.
    ctx.fillStyle = car.color;
    rr(ctx, -w / 2, -h / 2, w, h, 8);
    ctx.fill();
    // Cabin.
    ctx.fillStyle = 'rgba(16,28,40,0.92)';
    rr(ctx, -w * 0.18, -h * 0.32, w * 0.36, h * 0.64, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(190,220,240,0.5)';
    rr(ctx, -w * 0.14, -h * 0.3, w * 0.3, h * 0.16, 3);
    ctx.fill();
    // Wheels.
    ctx.fillStyle = '#0B0E11';
    circle(ctx, -w * 0.3, -h / 2, 7, '#0B0E11');
    circle(ctx, w * 0.3, -h / 2, 7, '#0B0E11');
    circle(ctx, -w * 0.3, h / 2, 7, '#0B0E11');
    circle(ctx, w * 0.3, h / 2, 7, '#0B0E11');
    // Headlights and taillights.
    ctx.fillStyle = '#FFE9A8';
    circle(ctx, w / 2 - 2, -h * 0.28, 3, '#FFE9A8');
    circle(ctx, w / 2 - 2, h * 0.28, 3, '#FFE9A8');
    ctx.fillStyle = PALETTE.red;
    circle(ctx, -w / 2 + 2, -h * 0.28, 3, PALETTE.red);
    circle(ctx, -w / 2 + 2, h * 0.28, 3, PALETTE.red);
    if (car.police) {
      const phase = Math.floor(time * 4) % 2 === 0;
      ctx.fillStyle = '#0B0E11';
      rr(ctx, -8, -h / 2 - 4, 16, 8, 3);
      ctx.fill();
      const left = phase ? PALETTE.red : PALETTE.blue;
      const right = phase ? PALETTE.blue : PALETTE.red;
      glow(ctx, -4, -h / 2 - 2, 30, phase ? 'rgba(255,59,48,A)' : 'rgba(46,124,246,A)', 0.8);
      glow(ctx, 4, -h / 2 - 2, 30, phase ? 'rgba(46,124,246,A)' : 'rgba(255,59,48,A)', 0.8);
      circle(ctx, -4, -h / 2 - 2, 5, left);
      circle(ctx, 4, -h / 2 - 2, 5, right);
      glow(ctx, 0, 10, 60, phase ? 'rgba(255,59,48,A)' : 'rgba(46,124,246,A)', 0.22);
    }
    ctx.restore();
    if (isPlayer) {
      ctx.font = font(13, 700);
      ctx.fillStyle = '#F4F8FF';
      ctx.textAlign = 'center';
      ctx.fillText('YOU', car.x, car.y - h / 2 - 14);
    }
  }

  function drawPedShape(ped) {
    if (ped.dead) {
      ctx.fillStyle = 'rgba(200,60,50,0.9)';
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 12, 6, ped.angle, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const bob = Math.sin(ped.walkPhase) * 2;
    circle(ctx, ped.x, ped.y + bob, 9, ped.color);
    ctx.fillStyle = '#E8EDF2';
    circle(ctx, ped.x, ped.y - 4 + bob, 5, '#E8EDF2');
  }

  function drawPlayerShape(state) {
    const p = state.player;
    if (p.onFoot) {
      const bob = Math.sin(state.time * 10) * 1.5;
      circle(ctx, p.x, p.y + bob, 11, '#2C4A55');
      ctx.fillStyle = '#E8EDF2';
      circle(ctx, p.x, p.y - 5 + bob, 6, '#E8EDF2');
      // Facing tick.
      ctx.fillStyle = PALETTE.amber;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(p.angle) * 14, p.y + Math.sin(p.angle) * 14);
      ctx.lineTo(p.x + Math.cos(p.angle + 2.6) * 8, p.y + Math.sin(p.angle + 2.6) * 8);
      ctx.lineTo(p.x + Math.cos(p.angle - 2.6) * 8, p.y + Math.sin(p.angle - 2.6) * 8);
      ctx.closePath();
      ctx.fill();
      ctx.font = font(13, 700);
      ctx.fillStyle = '#F4F8FF';
      ctx.textAlign = 'center';
      ctx.fillText('YOU', p.x, p.y - 22);
    } else if (p.car) {
      drawCarShape(p.car, true, state.time);
    }
  }

  // ---------------- HUD ----------------

  function drawHud(state, ui) {
    const p = state.player;
    // Top-left: cash, health, respect — on a dark pill so it reads over pale ice.
    ctx.fillStyle = 'rgba(4,10,20,0.55)';
    rr(ctx, 18, 14, 230, 112, 10); ctx.fill();
    text(fmtCash(p.cash), 28, 44, 30, '#FFFFFF', 'left', 900);
    ctx.fillStyle = 'rgba(4,10,20,0.55)';
    rr(ctx, 28, 54, 150, 12, 6); ctx.fill();
    const maxH = p.maxHealth || 100;
    ctx.fillStyle = p.health > 30 ? PALETTE.health : PALETTE.red;
    rr(ctx, 28, 54, Math.max(0, 150 * (p.health / maxH)), 12, 6); ctx.fill();
    const rank = rankFor(p.respect);
    text(rank.name + '  ·  ' + p.respect + ' RESPECT', 28, 92, 16, PALETTE.amberBright, 'left', 700);
    if (!p.onFoot && p.car) {
      text(p.car.model.name + (p.car.health < 100 ? '  ·  ' + Math.max(0, Math.floor(p.car.health)) + '%' : ''), 28, 114, 14, PALETTE.muted, 'left', 700);
    } else {
      text('ON FOOT — E near a car to drive', 28, 114, 14, PALETTE.muted, 'left', 700);
    }
    // Top-centre: mission tracker + clock.
    const prog = missionProgress(p);
    ctx.fillStyle = 'rgba(4,10,20,0.55)';
    rr(ctx, VIEW.width / 2 - 190, 12, 380, 30, 8); ctx.fill();
    text(fmtClock(p.clock) + '  ·  ' + GAME_DATE, VIEW.width / 2, 40, 20, '#F4F8FF', 'center', 700);
    ctx.fillStyle = 'rgba(4,10,20,0.55)';
    const tw = 460;
    rr(ctx, VIEW.width / 2 - tw / 2, 52, tw, 30, 8); ctx.fill();
    text(missionLabel(p), VIEW.width / 2, 66, 14, PALETTE.amberBright, 'center', 700);
    text(prog.label, VIEW.width / 2, 82, 13, '#F4F8FF', 'center', 400);
    // Top-right: wanted stars.
    text('WANTED', VIEW.width - 28, 40, 15, '#FFC93C', 'right', 700);
    for (let i = 0; i < 5; i += 1) {
      star(ctx, VIEW.width - 28 - i * 34, 62, 13, i < p.wanted ? PALETTE.star : 'rgba(120,140,165,0.4)');
    }
    // Bottom-left: speed + surface. MPH sits right of the number, never on it.
    const mph = Math.round((p.speed || 0) * 0.62);
    ctx.font = font(56, 900);
    const mphW = ctx.measureText(String(mph)).width;
    text(String(mph), 28, 690, 56, '#FFFFFF', 'left', 900);
    text('MPH', 36 + mphW, 690, 20, PALETTE.muted, 'left', 700);
    const surf = surfaceAt(p.x, p.y);
    text(surf === 'iceroad' ? 'ICE ROAD' : surf === 'ice' ? 'FROZEN LAKE' : surf === 'road' ? 'IRONHOLD STREETS' : 'SNOWFIELD', 28, 640, 16, PALETTE.muted, 'left', 700);
    // Bottom-centre: radio.
    const station = RADIO[p.radio % RADIO.length];
    text('♪ ' + station.name + ' — ' + station.desc, VIEW.width / 2, 700, 15, PALETTE.muted, 'center', 700);
    // Message banner.
    if (state.messageT > 0 && state.message) {
      ctx.font = font(20, 700);
      const mw = ctx.measureText(state.message).width + 36;
      ctx.fillStyle = 'rgba(4,10,20,0.72)';
      rr(ctx, VIEW.width / 2 - mw / 2, 120, mw, 36, 8); ctx.fill();
      text(state.message, VIEW.width / 2, 144, 20, PALETTE.amberBright, 'center', 700);
    }
    drawMinimap(state);
  }

  function drawMinimap(state) {
    const p = state.player;
    const mx = VIEW.width - 108;
    const my = VIEW.height - 108;
    const mr = 82;
    const sx = (mr * 2) / WORLD.width;
    const sy = (mr * 2) / WORLD.height;
    ctx.fillStyle = 'rgba(5,12,24,0.85)';
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3A5A7A'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.arc(mx, my, mr - 3, 0, Math.PI * 2); ctx.clip();
    // Lake.
    ctx.fillStyle = '#8FB4CC';
    ctx.fillRect(mx - mr, my + (WORLD.lakeY * sy) - mr, mr * 2, mr * 2);
    // Roads.
    ctx.fillStyle = '#3A5A7A';
    for (const rx of [200, 600, 1000, 1400, 1800, 2200, 2600, 3000]) {
      ctx.fillRect(mx - mr + rx * sx - 1, my - mr, 2, WORLD.lakeY * sy);
    }
    for (const ry of [200, 600, 1000, 1400]) {
      ctx.fillRect(mx - mr, my - mr + ry * sy - 1, mr * 2, 2);
    }
    // Ice road.
    ctx.strokeStyle = PALETTE.amberBright;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(mx - mr + 260 * sx, my - mr + 2350 * sy);
    ctx.lineTo(mx - mr + 2860 * sx, my - mr + 1600 * sy);
    ctx.stroke();
    // Waypoint.
    const prog = missionProgress(p);
    if (!prog.done && prog.x) {
      const wx = mx - mr + prog.x * sx;
      const wy = my - mr + prog.y * sy;
      ctx.fillStyle = '#FFC93C';
      ctx.beginPath();
      ctx.moveTo(wx, wy - 7); ctx.lineTo(wx + 6, wy); ctx.lineTo(wx, wy + 7); ctx.lineTo(wx - 6, wy);
      ctx.closePath(); ctx.fill();
    }
    // Police dots.
    for (const cop of state.police) {
      circle(ctx, mx - mr + cop.x * sx, my - mr + cop.y * sy, 4, PALETTE.blue);
    }
    // Player arrow.
    ctx.save();
    ctx.translate(mx - mr + p.x * sx, my - mr + p.y * sy);
    ctx.rotate(p.angle + Math.PI / 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(-6, 7); ctx.lineTo(6, 7);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#BFD4E6';
    ctx.font = font(13, 700);
    ctx.textAlign = 'center';
    ctx.fillText('N', mx, my - mr + 16);
    ctx.restore();
  }

  function drawWaypointArrow(state) {
    const p = state.player;
    const prog = missionProgress(p);
    if (prog.done || !prog.x) return;
    const d = Math.hypot(prog.x - p.x, prog.y - p.y);
    if (d < 120) return;
    const a = Math.atan2(prog.y - p.y, prog.x - p.x);
    const cx = VIEW.width / 2 + Math.cos(a) * 300;
    const cy = VIEW.height / 2 + Math.sin(a) * 220;
    ctx.save();
    ctx.translate(clamp(cx, 80, VIEW.width - 80), clamp(cy, 140, VIEW.height - 140));
    ctx.rotate(a);
    ctx.fillStyle = PALETTE.amberBright;
    ctx.beginPath();
    ctx.moveTo(18, 0); ctx.lineTo(-10, -11); ctx.lineTo(-4, 0); ctx.lineTo(-10, 11);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.font = font(14, 700);
    const dLabel = Math.round(d) + 'm';
    const dW = ctx.measureText(dLabel).width;
    const ax = clamp(cx, 80, VIEW.width - 80);
    const ay = clamp(cy, 140, VIEW.height - 140);
    ctx.fillStyle = 'rgba(4,10,20,0.65)';
    rr(ctx, ax - dW / 2 - 8, ay + 16, dW + 16, 24, 6); ctx.fill();
    text(dLabel, ax, ay + 33, 14, PALETTE.amberBright, 'center', 700);
  }

  function drawSnow(state) {
    for (const f of state.flakes) {
      ctx.globalAlpha = f.a;
      circle(ctx, f.x, f.y, f.r, '#FFFFFF');
    }
    ctx.globalAlpha = 1;
  }

  function drawVignette() {
    const vg = ctx.createRadialGradient(640, 360, 300, 640, 360, 780);
    vg.addColorStop(0, 'rgba(4,10,20,0)');
    vg.addColorStop(1, 'rgba(4,10,20,0.35)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  // ---------------- screens ----------------

  function drawTitle(state, ui) {
    // Big title, screen space: the single most dominant element, readable at 200px.
    const band = ctx.createLinearGradient(0, 0, 0, 240);
    band.addColorStop(0, 'rgba(4,10,20,0.66)');
    band.addColorStop(1, 'rgba(4,10,20,0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, 0, VIEW.width, 240);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#F4F8FF';
    ctx.font = font(118, 900);
    ctx.fillText('FROSTLINE', VIEW.width / 2, 92);
    ctx.fillStyle = PALETTE.amber;
    ctx.fillRect(VIEW.width / 2 - 150, 152, 300, 7);
    ctx.fillStyle = PALETTE.amberBright;
    ctx.font = font(26, 600);
    ctx.fillText(GAME_CITY + ' · ' + GAME_DATE, VIEW.width / 2, 192);
    ctx.textBaseline = 'alphabetic';
    // Menu. Panel wide enough for the longest line; tagline lives inside it.
    const items = ['NEW GAME — start the Ironhold campaign', 'CONTINUE — load save slot 1', 'MISSIONS — 8 story jobs, 5-star police, garage + radio', 'HOW TO PLAY — WASD drive · E enter car · Space shoot · R radio · M missions', 'Snowbound open-world crime · 8 missions · 5-star police · helicopter + roadblocks'];
    ctx.font = font(18, 700);
    ctx.fillStyle = 'rgba(4,10,20,0.6)';
    rr(ctx, VIEW.width / 2 - 360, 470, 720, 190, 10); ctx.fill();
    items.forEach((line, i) => {
      const y = 506 + i * 36;
      const sel = ui.menuIndex === i;
      ctx.fillStyle = sel ? PALETTE.amberBright : '#F4F8FF';
      ctx.font = font(sel ? 19 : 17, sel ? 900 : 700);
      ctx.textAlign = 'center';
      ctx.fillText((sel ? '▶ ' : '') + line, VIEW.width / 2, y);
    });
  }

  function drawPanelBox(title, lines, prompt, selected) {
    const width = 640;
    const height = 150 + lines.length * 34 + 60;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    ctx.fillStyle = 'rgba(5,12,24,0.94)';
    rr(ctx, x, y, width, height, 12); ctx.fill();
    ctx.fillStyle = PALETTE.amber;
    ctx.fillRect(x, y, width, 4);
    text(title, VIEW.width / 2, y + 62, 34, '#F4F8FF', 'center', 900);
    lines.forEach((line, i) => {
      const sel = selected === i;
      text((sel ? '▶ ' : '') + line, VIEW.width / 2, y + 112 + i * 34, 19, sel ? PALETTE.amberBright : '#DCE8F2', 'center', sel ? 900 : 400);
    });
    text(prompt, VIEW.width / 2, y + height - 26, 17, PALETTE.muted, 'center', 400);
    return { x, y, width, height };
  }

  function drawMissionsPanel(state, ui) {
    const p = state.player;
    const lines = MISSIONS.map((m, i) => {
      const mark = i < p.missionsDone ? '✓ ' : i === p.missionIndex ? '● ' : '○ ';
      return mark + 'MISSION ' + m.id + ': ' + m.name + ' — $' + m.reward + ' · +' + m.respect + ' respect';
    });
    drawPanelBox('IRONHOLD CAMPAIGN — 8 MISSIONS', lines, 'M / Esc to close · ' + missionLabel(p), p.missionIndex);
    const m = currentMission(p);
    if (m) {
      text(m.brief, VIEW.width / 2, VIEW.height - 78, 17, PALETTE.muted, 'center', 400);
    }
  }

  function drawShopPanel(state, ui) {
    const p = state.player;
    if (ui.menu === 'garage') {
      const lines = GARAGE_ITEMS.map((it) => {
        const owned = p.upgrades.includes(it.id);
        return it.name + ' — $' + it.price + (owned ? '  [OWNED]' : '') + '  ·  ' + it.desc;
      });
      drawPanelBox('GARAGE — IRONHOLD MOTORS', lines, '1-7 to buy · Cash ' + fmtCash(p.cash) + ' · G / Esc to close', ui.menuIndex);
    } else if (ui.menu === 'gun') {
      const lines = GUN_ITEMS.map((it) => it.name + ' — $' + it.price + (p.weapons.includes(it.id) ? '  [OWNED]' : '') + '  ·  ' + it.desc);
      drawPanelBox('GUN SHOP — HARBOR ARMS', lines, '1-3 to buy · Cash ' + fmtCash(p.cash) + ' · G / Esc to close', ui.menuIndex);
    } else if (ui.menu === 'clothes') {
      const lines = OUTFITS.map((it) => it.name + ' — $' + it.price + (p.outfit === it.id ? '  [WORN]' : '') + '');
      drawPanelBox('OUTFITTERS — OLD TOWN', lines, '1-4 to buy/wear · Cash ' + fmtCash(p.cash) + ' · G / Esc to close', ui.menuIndex);
    }
  }

  function drawPause(state, ui) {
    drawPanelBox('PAUSED', [
      'Save game — press 1, 2 or 3 to save in that slot',
      'Resume — P or Esc',
      'Restart run — press 0',
      'Sound — X to toggle (' + (state.player.soundOn ? 'ON' : 'OFF') + ')',
      'Quit to title — press T',
    ], 'Cash ' + fmtCash(state.player.cash) + ' · ' + missionLabel(state.player), ui.menuIndex);
  }

  function drawOver(state, title, big, lines) {
    // Full-opacity overlay: a fail state must read as a state, never as a bug.
    ctx.fillStyle = 'rgba(4,8,16,0.96)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = big;
    ctx.font = font(96, 900);
    ctx.fillText(title, VIEW.width / 2, 300);
    ctx.fillStyle = PALETTE.amber;
    ctx.fillRect(VIEW.width / 2 - 150, 340, 300, 7);
    lines.forEach((line, i) => {
      text(line, VIEW.width / 2, 400 + i * 40, 26, '#F4F8FF', 'center', 700);
    });
    text('Press Enter to try again', VIEW.width / 2, 560, 22, PALETTE.amberBright, 'center', 700);
  }

  // ---------------- main draw ----------------

  function draw(state, screen, ui) {
    const opts = ui || {};
    resize();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.nightDeep;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const scale = view.scale;
    ctx.setTransform(scale, 0, 0, scale, view.ox, view.oy);
    // Camera: follow the player, or the staged hero camera.
    const cam = { x: state.player.x, y: state.player.y };
    if (opts.heroCam) { cam.x = opts.heroCam.x; cam.y = opts.heroCam.y; }
    cam.x = clamp(cam.x, VIEW.width / 2 - 60, WORLD.width - VIEW.width / 2 + 60);
    cam.y = clamp(cam.y, VIEW.height / 2 - 60, WORLD.height - VIEW.height / 2 + 60);
    const shx = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 24 : 0;
    const shy = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 24 : 0;
    ctx.save();
    ctx.translate(-cam.x + VIEW.width / 2 + shx, -cam.y + VIEW.height / 2 + shy);
    drawGround(state, cam);
    drawRoads(state, cam);
    drawBuildings(state, cam);
    // Skid marks.
    ctx.fillStyle = 'rgba(10,14,18,0.5)';
    for (const s of state.skids) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.a);
      ctx.fillRect(-14, -3, 28, 5);
      ctx.restore();
    }
    // Place markers.
    for (const key of Object.keys(PLACES)) {
      const place = PLACES[key];
      if (Math.abs(place.x - cam.x) > 760 || Math.abs(place.y - cam.y) > 480) continue;
      drawMarker(state, place.x, place.y, place.color, place.label, false);
    }
    // Mission waypoint.
    const prog = missionProgress(state.player);
    if (!prog.done && prog.x) drawMarker(state, prog.x, prog.y, '#FFC93C', '', true);
    // Bullets.
    ctx.fillStyle = '#FFE9A8';
    for (const b of state.bullets) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      ctx.fillRect(-8, -1.5, 16, 3);
      ctx.restore();
    }
    // Traffic, peds, police, player.
    for (const car of state.traffic) drawCarShape(car, false, state.time);
    for (const ped of state.peds) {
      if (Math.abs(ped.x - cam.x) < 700 && Math.abs(ped.y - cam.y) < 420) drawPedShape(ped);
    }
    for (const rb of state.roadblocks) {
      ctx.save();
      ctx.translate(rb.x, rb.y);
      ctx.rotate(rb.angle);
      ctx.fillStyle = PALETTE.police;
      rr(ctx, -31, -15, 62, 30, 8); ctx.fill();
      ctx.fillStyle = PALETTE.red;
      ctx.fillRect(-31, -15, 62, 6);
      ctx.restore();
    }
    for (const cop of state.police) drawCarShape(cop, false, state.time);
    drawPlayerShape(state);
    // Helicopter: shadow + spotlight on the ground, heli drawn in screen space below.
    if (state.heli) {
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#FFE9A8';
      ctx.beginPath();
      ctx.ellipse(state.player.x, state.player.y, 90, 60, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(10,16,24,0.55)';
      ctx.beginPath();
      ctx.ellipse(state.heli.x, state.heli.y, 34, 16, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Helicopter body (screen space, above the world).
    if (state.heli) {
      const hx = (state.heli.x - cam.x) + VIEW.width / 2 + shx;
      const hy = (state.heli.y - cam.y) + VIEW.height / 2 + shy;
      ctx.fillStyle = '#1B2A3A';
      ctx.beginPath();
      ctx.ellipse(hx, hy, 34, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2E7CF6';
      ctx.beginPath();
      ctx.ellipse(hx + 8, hy, 12, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(232,237,242,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hx - 44, hy); ctx.lineTo(hx + 44, hy);
      ctx.stroke();
      ctx.fillStyle = '#FFC93C';
      ctx.font = font(12, 700);
      ctx.textAlign = 'center';
      ctx.fillText('AIR ONE', hx, hy + 32);
    }
    drawWaypointArrow(state);
    drawVignette();
    drawSnow(state);
    if (screen === SCREEN_TITLE || opts.heroMode) {
      drawTitle(state, opts);
      return;
    }
    drawHud(state, opts);
    if (opts.menu === 'missions') drawMissionsPanel(state, opts);
    else if (opts.menu === 'garage' || opts.menu === 'gun' || opts.menu === 'clothes') drawShopPanel(state, opts);
    else if (screen === SCREEN_PAUSED) drawPause(state, opts);
    else if (screen === SCREEN_OVER) {
      const p = state.player;
      if (p.busted) {
        drawOver(state, 'BUSTED', PALETTE.blue, ['The Ironhold PD took you in.', 'Cash kept: ' + fmtCash(p.cash) + '  ·  Missions done: ' + p.missionsDone + '/8']);
      } else {
        drawOver(state, 'WASTED', PALETTE.red, ['Ironhold is cold without you.', 'Cash kept: ' + fmtCash(p.cash) + '  ·  Missions done: ' + p.missionsDone + '/8']);
      }
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
