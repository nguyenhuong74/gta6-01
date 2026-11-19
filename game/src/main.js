// Boot and the one loop: the world advances in fixed 1/60 s steps, the
// camera follows the player, and the renderer paints what is there. Screens:
// title, play, paused, wasted, busted, complete.
//
// ?seed=N fixes the city. ?shot=menu|chase|street|mission stages that scene
// instead of running the loop, paints it and sets window.__shotReady.
// ?demo=1 auto-drives the player in a loop (used to capture gameplay shots).
import { SAVE_KEY, WORLD_W, WORLD_H, SPOTS } from './config.js';
import { createWorld, updatePlayer, updateTraffic, updatePeds, updatePolice, updateGang, updateBullets, updateParticles, updatePickups, say } from './entities.js';
import { createMissionState, updateMissions, currentMission } from './missions.js';
import { createInput, ACTION } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, drawWorld, drawTitle, drawPaused, drawWasted, drawBusted, drawComplete, drawHud } from './render.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

// Surface load errors in the DOM so a headless dump can see them.
window.addEventListener('error', (e) => {
  const s = document.getElementById('status');
  if (s) s.textContent = `ERR: ${e.message} @ ${e.filename}:${e.lineno}`;
});
const demo = params.get('demo') === '1';
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : (Math.floor(Math.random() * 4294967296) || 7);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const ctx = renderer.ctx;
const input = createInput(canvas);
const audio = createAudio();

const state = createWorld(seed);
state.missions = createMissionState();
state.camX = 0;
state.camY = 0;
state.storyComplete = false;

let screen = 'title';
let best = readSave();
let accumulator = 0;
let last = performance.now();
let demoTime = 0;

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeSave() {
  try {
    const p = state.player;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: p.cash, hp: p.hp, ammo: p.ammo, x: p.x, y: p.y,
      missionIndex: state.missions.index, missionsDone: state.stats.missionsDone,
      savedAt: new Date().toISOString(),
    }));
    say(state, 'Game saved.', 2);
  } catch { say(state, 'Save failed (storage off).', 2); }
}

function loadSave(save) {
  if (!save) return;
  const p = state.player;
  p.cash = save.cash ?? 150;
  p.hp = save.hp ?? 100;
  p.ammo = save.ammo ?? 24;
  p.x = save.x ?? 620;
  p.y = save.y ?? 700;
  state.missions.index = save.missionIndex ?? 0;
  state.stats.missionsDone = save.missionsDone ?? 0;
  state.missions.phase = 'brief';
}

function announce(message) {
  status.textContent = message;
}

function startGame(fresh) {
  if (fresh || !best) {
    const s = createWorld(seed);
    Object.assign(state, s);
    state.missions = createMissionState();
    state.camX = 0; state.camY = 0; state.storyComplete = false;
  } else {
    loadSave(best);
  }
  accumulator = 0;
  screen = 'play';
  announce('Playing. Steal a car with E, follow the mission marker.');
}

function endGame(kind) {
  screen = kind; // 'wasted' | 'busted'
  if (kind === 'wasted') audio.wasted();
  else audio.busted();
  audio.stopEngine();
  announce(kind === 'wasted' ? 'Wasted. Retry from your last save.' : 'Busted. Retry from your last save.');
}

function cameraFor() {
  const { w, h } = renderer.size();
  const p = state.player;
  state.camX = Math.max(0, Math.min(WORLD_W - w, p.x - w / 2));
  state.camY = Math.max(0, Math.min(WORLD_H - h, p.y - h / 2));
  return { w, h };
}

function tick(dt) {
  state.time += dt;
  state.clock = (state.clock + dt * 0.6) % (24 * 60);
  state.messageTimer = Math.max(0, state.messageTimer - dt);
  if (demo) demoDrive(dt);
  updatePlayer(state, input, dt, audio);
  updateTraffic(state, dt);
  updatePeds(state, dt);
  updatePolice(state, dt, audio);
  updateGang(state, dt, audio);
  updateBullets(state, dt);
  updateParticles(state, dt);
  updatePickups(state, audio);
  updateMissions(state, input, dt, audio);
  // Shops: clinic heals, arms shop sells ammo (walk into the marker).
  const p = state.player;
  if (p.onFoot) {
    if (Math.hypot(p.x - SPOTS.clinic.x, p.y - SPOTS.clinic.y) < 60 && p.hp < 100 && p.cash >= 50) {
      p.cash -= 50; p.hp = 100;
      say(state, "Doc patched you up — $50. Full health.", 2.5);
      audio.pickup();
    }
    if (Math.hypot(p.x - SPOTS.arms.x, p.y - SPOTS.arms.y) < 60 && p.cash >= 80) {
      p.cash -= 80; p.ammo += 60;
      say(state, 'Bought 60 bullets — $80. Stay safe out there.', 2.5);
      audio.pickup();
    }
  }
  if (p.hp <= 0) endGame('wasted');
  else if (p.bustedTimer > 1.5) endGame('busted');
  else if (state.storyComplete && screen === 'play') {
    // Story done: free roam continues; show the banner once via message.
    if (!state.completeShown) {
      state.completeShown = true;
      screen = 'complete';
    }
  }
}

// Demo mode: an autopilot that steals the nearest car and cruises the grid,
// so screenshots can show real driving without a human at the keyboard.
function demoDrive(dt) {
  demoTime += dt;
  const p = state.player;
  if (p.onFoot) {
    // Walk toward the nearest car.
    let bestCar = null, bestD = Infinity;
    for (const c of state.cars) {
      if (c.police) continue;
      const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
      if (d < bestD) { bestD = d; bestCar = c; }
    }
    if (bestCar) {
      const a = Math.atan2(bestCar.y - p.y, bestCar.x - p.x);
      p.x += Math.cos(a) * 175 * dt;
      p.y += Math.sin(a) * 175 * dt;
      if (bestD < 60 * 60) {
        p.onFoot = false; p.car = bestCar;
        bestCar.parked = false; bestCar.traffic = false;
      }
    }
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
  last = now;
  if (screen === 'play') {
    accumulator += elapsed;
    while (accumulator >= STEP) {
      tick(STEP);
      accumulator -= STEP;
      if (screen !== 'play') break;
    }
  }
  const { w, h } = cameraFor();
  ctx.clearRect(0, 0, w, h);
  if (screen === 'title') {
    drawTitle(ctx, state, w, h, !!best);
  } else if (screen === 'paused') {
    drawWorld(ctx, state, state.camX, state.camY, w, h);
    drawHud(ctx, state, w, h, screen);
    drawPaused(ctx, state, w, h);
  } else if (screen === 'wasted') {
    drawWorld(ctx, state, state.camX, state.camY, w, h);
    drawWasted(ctx, w, h);
  } else if (screen === 'busted') {
    drawWorld(ctx, state, state.camX, state.camY, w, h);
    drawBusted(ctx, w, h);
  } else if (screen === 'complete') {
    drawWorld(ctx, state, state.camX, state.camY, w, h);
    drawComplete(ctx, w, h);
  } else {
    drawWorld(ctx, state, state.camX, state.camY, w, h);
    drawHud(ctx, state, w, h, screen);
  }
  handleKeys();
  input.endFrame();
}

function handleKeys() {
  if (input.wasPressed('pause')) {
    if (screen === 'play') { screen = 'paused'; audio.stopEngine(); }
    else if (screen === 'paused') screen = 'play';
  }
  if (input.wasPressed('mute')) {
    const m = audio.toggleMute();
    say(state, m ? 'Sound muted.' : 'Sound on.', 1.5);
  }
  if (screen === 'title' && (input.wasPressed('confirm') || input.mouse.clicked)) {
    audio.unlock();
    audio.click();
    startGame(false);
  }
  if ((screen === 'wasted' || screen === 'busted') && (input.wasPressed('confirm') || input.mouse.clicked)) {
    startGame(false);
  }
  if (screen === 'complete' && (input.wasPressed('confirm') || input.mouse.clicked)) {
    screen = 'play';
  }
  // R saves the game while playing.
  if (screen === 'play' && input.wasPressed('reload')) writeSave();
}

function runShot(name) {
  const scene = stageShot(name, state);
  screen = scene.screen;
  // Let the world settle a few frames so traffic and the chase read on screen.
  for (let i = 0; i < 12; i++) {
    if (scene.screen === 'play') tick(STEP);
  }
  const { w, h } = cameraFor();
  ctx.clearRect(0, 0, w, h);
  if (scene.screen === 'title') drawTitle(ctx, state, w, h, !!best);
  else {
    drawWorld(ctx, state, state.camX, state.camY, w, h);
    drawHud(ctx, state, w, h, 'play');
  }
  status.textContent = `shot-ready:${name}`;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
}

if (shot) {
  runShot(shot);
} else {
  requestAnimationFrame(frame);
}

// Expose a little debug surface for play-testing (not used by the game).
window.__solmara = { state, get screen() { return screen; } };
