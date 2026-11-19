// HUD: cash, health, wanted stars, clock, weapon, mission objective, message
// banner, and the live minimap (roads, player, cars, police, mission marker).
import { WORLD_W, WORLD_H, MAX_WANTED } from './config.js';
import { currentMission, missionObjective, missionSpot } from './missions.js';

export function drawHud(ctx, state, w, h, screen) {
  const p = state.player;
  ctx.save();
  ctx.textBaseline = 'top';

  // Top-left: cash + health.
  ctx.fillStyle = 'rgba(10,14,24,0.72)';
  roundRect(ctx, 12, 12, 218, 64, 10);
  ctx.fill();
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(`$${p.cash.toLocaleString('en-US')}`, 24, 20);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('CASH', 24, 46);
  ctx.fillStyle = '#333';
  roundRect(ctx, 96, 50, 120, 12, 6);
  ctx.fill();
  ctx.fillStyle = p.hp > 40 ? '#7ee787' : '#ff595e';
  roundRect(ctx, 96, 50, 120 * Math.max(0, p.hp / 100), 12, 6);
  ctx.fill();
  ctx.fillStyle = '#e8e8e8';
  ctx.fillText(`HP ${Math.ceil(p.hp)}`, 96, 64);

  // Top-right: wanted stars + clock.
  ctx.fillStyle = 'rgba(10,14,24,0.72)';
  roundRect(ctx, w - 212, 12, 200, 64, 10);
  ctx.fill();
  ctx.font = '26px system-ui, sans-serif';
  let stars = '';
  for (let i = 0; i < MAX_WANTED; i++) stars += i < state.wanted ? '★' : '☆';
  ctx.fillStyle = state.wanted > 0 ? '#ffd60a' : '#8a94a6';
  ctx.fillText(stars, w - 200, 18);
  const hh = Math.floor(state.clock / 60) % 24;
  const mm = Math.floor(state.clock % 60);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, w - 200, 50);

  // Mission objective bar (top centre).
  const mission = currentMission(state.missions);
  if (mission && screen === 'play') {
    const obj = missionObjective(state.missions);
    ctx.font = 'bold 15px system-ui, sans-serif';
    const tw = ctx.measureText(obj).width;
    ctx.fillStyle = 'rgba(10,14,24,0.72)';
    roundRect(ctx, (w - tw) / 2 - 14, 12, tw + 28, 34, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd60a';
    ctx.fillText(obj, (w - tw) / 2, 21);
  }

  // Message banner.
  if (state.messageTimer > 0 && state.message) {
    ctx.font = '16px system-ui, sans-serif';
    const tw = ctx.measureText(state.message).width;
    ctx.fillStyle = 'rgba(10,14,24,0.8)';
    roundRect(ctx, (w - tw) / 2 - 12, h - 108, tw + 24, 32, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(state.message, (w - tw) / 2, h - 100);
  }

  // Bottom-right: weapon + ammo, speed when driving.
  ctx.fillStyle = 'rgba(10,14,24,0.72)';
  roundRect(ctx, w - 312, h - 64, 300, 52, 10);
  ctx.fill();
  ctx.fillStyle = '#e8e8e8';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(`PISTOL  ∞  •  ${p.ammo} bullets`, w - 300, h - 56);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = '#8a94a6';
  if (!p.onFoot && p.car) {
    ctx.fillText(`SPEED ${Math.round(Math.abs(p.car.speed) * 0.9)} km/h  •  E exit car`, w - 300, h - 34);
  } else {
    ctx.fillText('E steal car  •  Click shoot  •  F punch', w - 300, h - 34);
  }

  // Minimap (bottom-left).
  drawMinimap(ctx, state, 12, h - 172, 160);

  // Briefing prompt when a mission waits.
  if (mission && state.missions.phase === 'brief' && screen === 'play') {
    ctx.font = 'bold 16px system-ui, sans-serif';
    const t = `NEW JOB: ${mission.title} — press E to accept`;
    const tw = ctx.measureText(t).width;
    ctx.fillStyle = 'rgba(255,214,10,0.92)';
    roundRect(ctx, (w - tw) / 2 - 12, 56, tw + 24, 32, 8);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.fillText(t, (w - tw) / 2, 64);
  }
  ctx.restore();
}

export function drawMinimap(ctx, state, x, y, size) {
  const scale = size / WORLD_W;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,24,0.78)';
  roundRect(ctx, x - 4, y - 4, size + 8, size + 8, 8);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  // Sea + sand.
  ctx.fillStyle = '#1d4e6b';
  ctx.fillRect(x, y + (3300 * scale), size, size);
  ctx.fillStyle = '#e8d29a';
  ctx.fillRect(x, y + (3300 * scale), size, 8);
  // Ground.
  ctx.fillStyle = '#2c3440';
  ctx.fillRect(x, y, size, y + 3300 * scale - y);
  // Roads.
  ctx.fillStyle = '#4a5568';
  for (let c = 200; c < WORLD_W; c += 400) {
    ctx.fillRect(x + c * scale - 2, y, 4, 3300 * scale);
    ctx.fillRect(x, y + c * scale - 2, 3300 * scale, 4);
  }
  // Parks.
  ctx.fillStyle = '#2f6b3a';
  ctx.fillRect(x + 1800 * scale, y + 1400 * scale, 300 * scale, 300 * scale);
  ctx.fillRect(x + 2600 * scale, y + 600 * scale, 300 * scale, 300 * scale);
  // Mission marker.
  const spot = missionSpot(state.missions);
  if (spot) {
    const pulse = 3 + Math.sin(state.time * 5) * 1.5;
    ctx.fillStyle = '#ffd60a';
    ctx.beginPath();
    ctx.arc(x + spot.x * scale, y + spot.y * scale, 5 + pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Police (blue/red), traffic (grey), player (pink triangle).
  for (const car of state.cars) {
    ctx.fillStyle = car.police ? '#ff595e' : '#aab4c0';
    ctx.fillRect(x + car.x * scale - 2, y + car.y * scale - 2, 4, 4);
  }
  for (const c of state.cops) {
    ctx.fillStyle = '#4cc9f0';
    ctx.fillRect(x + c.x * scale - 2, y + c.y * scale - 2, 4, 4);
  }
  const p = state.player;
  ctx.fillStyle = '#ff5d8f';
  ctx.beginPath();
  ctx.arc(x + p.x * scale, y + p.y * scale, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#8a94a6';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('SOLMARA BAY', x, y - 8);
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
