// Rendering: the city, cars, people, bullets and particles in a camera view,
// plus the title / pause / wasted / busted screens. All art is drawn by code:
// flat sun-soaked colours, soft shadows, no image assets at all.
import { WORLD_W, WORLD_H, ROAD_W, BEACH_Y, CITY_NAME, GAME_TITLE, GAME_SUBTITLE } from './config.js';
import { roadCenters } from './city.js';
import { currentMission, missionSpot } from './missions.js';
import { drawHud, roundRect } from './hud.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  function resize() {
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();
  return {
    ctx,
    size() { return { w: window.innerWidth, h: window.innerHeight }; },
  };
}

function drawCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(-24, -12, 48, 26);
  ctx.fillStyle = car.color;
  roundRect(ctx, -26, -13, 52, 26, 7);
  ctx.fill();
  // Cabin + windshield.
  ctx.fillStyle = 'rgba(20,30,44,0.85)';
  roundRect(ctx, -8, -11, 20, 22, 4);
  ctx.fill();
  ctx.fillStyle = car.police ? '#e8e8e8' : 'rgba(255,255,255,0.55)';
  ctx.fillRect(-26, -11, 5, 22); // front bumper strip
  if (car.police) {
    // Light bar.
    ctx.fillStyle = (Math.floor(performance.now() / 300) % 2 === 0) ? '#ff4040' : '#4090ff';
    ctx.fillRect(-6, -13, 12, 5);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.fillText('POLICE', -14, 4);
  }
  // Headlights.
  ctx.fillStyle = '#fff8c9';
  ctx.fillRect(22, -11, 3, 5);
  ctx.fillRect(22, 6, 3, 5);
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, color, radius, isPlayer) {
  ctx.save();
  ctx.translate(x, y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 3, radius, radius * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.55, 0, Math.PI * 2);
  ctx.fill();
  // Facing tick.
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  ctx.lineTo(Math.cos(angle) * (radius + 8), Math.sin(angle) * (radius + 8));
  ctx.stroke();
  if (isPlayer) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius + 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawWorld(ctx, state, camX, camY, w, h) {
  const city = state.city;
  ctx.save();
  ctx.translate(-camX, -camY);
  // Ground.
  ctx.fillStyle = '#3a3f47';
  ctx.fillRect(camX, camY, w, h);
  const vx0 = Math.max(0, camX), vy0 = Math.max(0, camY);
  const vx1 = Math.min(WORLD_W, camX + w), vy1 = Math.min(WORLD_H, camY + h);
  // Sidewalk blocks (pavement between roads).
  ctx.fillStyle = '#8a8f96';
  for (let gx = 0; gx < 9; gx++) {
    for (let gy = 0; gy < 9; gy++) {
      const bx = 200 + gx * 400 + ROAD_W / 2;
      const by = 200 + gy * 400 + ROAD_W / 2;
      if (bx + 304 < vx0 || bx > vx1 || by + 304 < vy0 || by > vy1) continue;
      ctx.fillRect(bx, by, 304, 304);
    }
  }
  // Roads.
  ctx.fillStyle = '#2e333b';
  for (const c of roadCenters()) {
    if (c > vy0 - 60 && c < vy1 + 60) ctx.fillRect(vx0, c - ROAD_W / 2, vx1 - vx0, ROAD_W);
    if (c > vx0 - 60 && c < vx1 + 60) ctx.fillRect(c - ROAD_W / 2, vy0, ROAD_W, vy1 - vy0);
  }
  // Lane dashes.
  ctx.fillStyle = '#e8d44d';
  for (const c of roadCenters()) {
    for (let d = 0; d < WORLD_W; d += 64) {
      if (c > vy0 - 60 && c < vy1 + 60 && d > vx0 && d < vx1) ctx.fillRect(d, c - 2, 30, 4);
      if (c > vx0 - 60 && c < vx1 + 60 && d > vy0 && d < vy1) ctx.fillRect(c - 2, d, 4, 30);
    }
  }
  // Beach + sea.
  if (vy1 > BEACH_Y) {
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect(vx0, BEACH_Y, vx1 - vx0, 90);
    ctx.fillStyle = '#2a7fa8';
    ctx.fillRect(vx0, BEACH_Y + 90, vx1 - vx0, vy1 - BEACH_Y - 90);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let d = 0; d < WORLD_W; d += 180) {
      const yy = BEACH_Y + 130 + Math.sin(state.time * 1.4 + d * 0.01) * 8;
      if (d > vx0 && d < vx1) ctx.fillRect(d, yy, 90, 3);
    }
  }
  // Parks.
  for (const pk of city.parks) {
    ctx.fillStyle = '#3f7d44';
    ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
    ctx.fillStyle = '#57a05a';
    ctx.fillRect(pk.x + 20, pk.y + 20, pk.w - 40, pk.h - 40);
  }
  // Trees.
  for (const t of city.trees) {
    if (t.x < vx0 - 30 || t.x > vx1 + 30 || t.y < vy0 - 30 || t.y > vy1 + 30) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.arc(t.x + 3, t.y + 4, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = t.palm ? '#2f9e44' : '#3a7d44';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#67b26f';
    ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.55, 0, Math.PI * 2); ctx.fill();
  }
  // Buildings: shadow, walls, roof, roof detail.
  for (const b of city.buildings) {
    if (b.x + b.w < vx0 || b.x > vx1 || b.y + b.h < vy0 || b.y > vy1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(b.x + b.height * 0.4, b.y + b.height * 0.4, b.w, b.h);
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(b.x + 12, b.y + 12, Math.min(40, b.w - 24), 8);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x + 6, b.y + b.h - 16, b.w - 12, 4);
  }
  // Story spots: labelled markers.
  for (const s of [{ x: 620, y: 620, label: "ROSA'S GARAGE" }, { x: 3220, y: 2980, label: 'DOCKS' }, { x: 1380, y: 1380, label: 'STORE' }, { x: 1780, y: 2180, label: 'ARMS' }, { x: 1780, y: 980, label: 'CLINIC' }]) {
    if (s.x < vx0 - 100 || s.x > vx1 + 100 || s.y < vy0 - 100 || s.y > vy1 + 100) continue;
    ctx.fillStyle = '#ffd60a';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(s.label, s.x, s.y - 52);
    ctx.textAlign = 'left';
  }
  // Mission marker: pulsing beacon + column of light.
  const spot = missionSpot(state.missions);
  if (spot) {
    const pulse = 0.5 + Math.sin(state.time * 4) * 0.5;
    ctx.fillStyle = `rgba(255,214,10,${0.20 + pulse * 0.18})`;
    ctx.fillRect(spot.x - 26, spot.y - 160, 52, 160);
    ctx.fillStyle = `rgba(255,240,150,${0.35 + pulse * 0.25})`;
    ctx.fillRect(spot.x - 8, spot.y - 160, 16, 160);
    ctx.fillStyle = '#ffd60a';
    ctx.beginPath();
    ctx.arc(spot.x, spot.y, 10 + pulse * 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // Pickups.
  for (const pk of state.pickups) {
    ctx.fillStyle = pk.kind === 'health' ? '#ff595e' : '#ffd60a';
    ctx.beginPath();
    ctx.arc(pk.x, pk.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pk.kind === 'health' ? '+' : 'A', pk.x, pk.y - 5);
    ctx.textAlign = 'left';
  }
  // Pedestrians, gang, cops.
  for (const ped of state.peds) drawPerson(ctx, ped.x, ped.y, ped.angle, ped.color, 10, false);
  for (const g of state.gang) {
    if (g.alive) drawPerson(ctx, g.x, g.y, g.angle, '#8d0801', 12, false);
  }
  for (const c of state.cops) drawPerson(ctx, c.x, c.y, c.angle, '#1b263b', 11, false);
  // Cars.
  for (const car of state.cars) drawCar(ctx, car);
  // Player.
  const p = state.player;
  if (p.onFoot) drawPerson(ctx, p.x, p.y, p.angle, '#ff5d8f', 13, true);
  // Bullets.
  ctx.strokeStyle = '#ffe66d';
  ctx.lineWidth = 2;
  for (const b of state.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Particles.
  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, pt.life * 1.6);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawCenteredPanel(ctx, w, h, lines) {
  ctx.fillStyle = 'rgba(8,10,18,0.78)';
  ctx.fillRect(0, 0, w, h);
  let y = h / 2 - lines.length * 26;
  ctx.textAlign = 'center';
  for (const line of lines) {
    ctx.fillStyle = line.color || '#e8e8e8';
    ctx.font = line.font || '20px system-ui, sans-serif';
    ctx.fillText(line.text, w / 2, y);
    y += line.gap || 44;
  }
  ctx.textAlign = 'left';
}

export function drawTitle(ctx, state, w, h, hasSave) {
  // Sunset backdrop: gradient sky, skyline silhouettes, palm trees.
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#2b1055');
  g.addColorStop(0.45, '#c94b6d');
  g.addColorStop(0.75, '#ff8c42');
  g.addColorStop(1, '#ffd60a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff3b0';
  ctx.beginPath();
  ctx.arc(w * 0.72, h * 0.3, 46, 0, Math.PI * 2);
  ctx.fill();
  // Skyline.
  ctx.fillStyle = 'rgba(30,16,48,0.85)';
  let bx = 0;
  const rngHeights = [180, 260, 150, 300, 210, 170, 280, 140, 230, 190];
  for (let i = 0; i < 10; i++) {
    const bw = w / 10;
    const bh = rngHeights[i % rngHeights.length] * (h / 700);
    ctx.fillRect(bx, h - bh - 90, bw - 6, bh + 90);
    bx += bw;
  }
  ctx.fillStyle = '#1d2b1f';
  ctx.fillRect(0, h - 90, w, 90);
  // Palms.
  ctx.strokeStyle = '#12351a';
  ctx.lineWidth = 5;
  for (const px of [w * 0.12, w * 0.88]) {
    ctx.beginPath();
    ctx.moveTo(px, h - 90);
    ctx.quadraticCurveTo(px + 14, h - 180, px + 40, h - 210);
    ctx.stroke();
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.fillText(GAME_TITLE, w / 2, h * 0.32);
  ctx.fillStyle = '#ffd60a';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText(GAME_SUBTITLE, w / 2, h * 0.32 + 44);
  ctx.fillStyle = '#fff';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText(`${CITY_NAME} — an open-world crime story, built from scratch`, w / 2, h * 0.32 + 88);
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(hasSave ? 'ENTER — Continue your story' : 'ENTER — New game', w / 2, h * 0.62);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillStyle = '#ffe8a3';
  ctx.fillText('WASD move  •  E steal / enter car  •  Mouse aim + click shoot  •  F punch  •  M mute  •  P pause', w / 2, h * 0.62 + 40);
  ctx.fillText('6 story missions  •  traffic & pedestrians  •  wanted stars & police chases  •  R saves', w / 2, h * 0.62 + 70);
  ctx.textAlign = 'left';
}

export function drawPaused(ctx, state, w, h) {
  drawCenteredPanel(ctx, w, h, [
    { text: 'PAUSED', font: 'bold 52px system-ui, sans-serif', color: '#ffd60a' },
    { text: 'P / Esc — resume', font: '20px system-ui, sans-serif' },
    { text: 'R — save game   •   M — mute   •   P — resume', font: '18px system-ui, sans-serif' },
  ]);
}

export function drawWasted(ctx, w, h) {
  drawCenteredPanel(ctx, w, h, [
    { text: 'WASTED', font: 'bold 64px system-ui, sans-serif', color: '#ff595e' },
    { text: 'Milo went down. The city keeps moving without you.', font: '20px system-ui, sans-serif' },
    { text: 'ENTER — retry from your last save', font: '18px system-ui, sans-serif' },
  ]);
}

export function drawBusted(ctx, w, h) {
  drawCenteredPanel(ctx, w, h, [
    { text: 'BUSTED', font: 'bold 64px system-ui, sans-serif', color: '#4cc9f0' },
    { text: 'The Solmara PD finally caught up with you.', font: '20px system-ui, sans-serif' },
    { text: 'ENTER — retry from your last save', font: '18px system-ui, sans-serif' },
  ]);
}

export function drawComplete(ctx, w, h) {
  drawCenteredPanel(ctx, w, h, [
    { text: 'YOU RUN SOLMARA', font: 'bold 52px system-ui, sans-serif', color: '#ffd60a' },
    { text: 'Every mission done. The van is yours, the city is yours.', font: '20px system-ui, sans-serif' },
    { text: 'ENTER — keep playing free roam', font: '18px system-ui, sans-serif' },
  ]);
}

export { drawHud };
