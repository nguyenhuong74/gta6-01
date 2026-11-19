// Entities: the player (on foot and driving), traffic, pedestrians, police
// cars and foot cops, bullets and particles — plus the wanted-level system.
import { WORLD_W, WORLD_H, CAR_MODELS, POLICE_COLOR, BEACH_Y, MAX_WANTED, WANTED_DECAY_SECONDS } from './config.js';
import { createCity, collideBuildings, isOnRoad, randomRoadPoint, pointInBuilding } from './city.js';
import { createRandom, range, pick, chance } from './random.js';

const PED_COLORS = ['#e8b4b8', '#7fb069', '#f4d35e', '#ee964b', '#5e60ce', '#ef476f', '#06d6a0', '#ffd6ff'];
const GANG_COLOR = '#8d0801';

export function createWorld(seed) {
  const rng = createRandom(seed);
  const city = createCity(seed);
  const state = {
    seed,
    city,
    time: 0,
    clock: 9 * 60 + 12, // minutes after midnight: story starts 09:12
    player: {
      x: 620, y: 700, angle: -Math.PI / 2, hp: 100, cash: 150, ammo: 24,
      onFoot: true, car: null, speed: 0, punchCd: 0, shootCd: 0, reloadCd: 0,
      bustedTimer: 0, invuln: 0,
    },
    cars: [],
    peds: [],
    cops: [], // foot police
    gang: [], // Vulture gang members
    bullets: [],
    particles: [],
    pickups: [], // health / ammo crates
    wanted: 0,
    quietTimer: 0,
    message: '',
    messageTimer: 0,
    stats: { carsStolen: 0, missionsDone: 0, copsDodged: 0 },
    rng,
  };
  spawnTraffic(state, 26);
  spawnParked(state, 14);
  spawnPeds(state, 40);
  return state;
}

export function spawnTraffic(state, n) {
  for (let i = 0; i < n; i++) {
    const p = randomRoadPoint(state.rng);
    const vertical = Math.abs(p.x % 400 - 200) < 60;
    const dir = chance(state.rng, 0.5) ? 1 : -1;
    const model = pick(state.rng, CAR_MODELS);
    state.cars.push({
      x: p.x, y: p.y, angle: vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      speed: range(state.rng, 110, 170), model, color: model.color, traffic: true,
      vertical, dir, turnCd: range(state.rng, 2, 8), parked: false, police: false, hp: 100, occupied: true,
    });
  }
}

export function spawnParked(state, n) {
  for (let i = 0; i < n; i++) {
    const p = randomRoadPoint(state.rng);
    const model = pick(state.rng, CAR_MODELS);
    const vertical = chance(state.rng, 0.5);
    state.cars.push({
      x: p.x + (vertical ? 34 : 0), y: p.y + (vertical ? 0 : 34),
      angle: vertical ? Math.PI / 2 : 0, speed: 0, model, color: model.color,
      traffic: false, parked: true, police: false, hp: 100,
    });
  }
}

export function spawnPeds(state, n) {
  for (let i = 0; i < n; i++) {
    // Pedestrians start on streets and sidewalks, never inside buildings.
    let p = randomRoadPoint(state.rng);
    let px = p.x, py = p.y;
    for (let tries = 0; tries < 8; tries++) {
      px = p.x + range(state.rng, -60, 60);
      py = p.y + range(state.rng, -60, 60);
      if (!pointInBuilding(state.city, px, py)) break;
    }
    state.peds.push({
      x: px, y: py,
      angle: range(state.rng, 0, Math.PI * 2), speed: range(state.rng, 35, 60),
      color: pick(state.rng, PED_COLORS), flee: 0, tx: p.x, ty: p.y, wait: 0,
    });
  }
}

export function spawnGang(state, x, y, n) {
  for (let i = 0; i < n; i++) {
    // Land on open ground, never on a rooftop.
    let gx = x, gy = y;
    for (let tries = 0; tries < 12; tries++) {
      gx = x + range(state.rng, -120, 120);
      gy = y + range(state.rng, -120, 120);
      if (!pointInBuilding(state.city, gx, gy)) break;
    }
    state.gang.push({
      x: gx, y: gy,
      angle: 0, hp: 50, speed: 90, shootCd: range(state.rng, 0.5, 2), alive: true,
    });
  }
}

export function addWanted(state, n) {
  state.wanted = Math.min(MAX_WANTED, state.wanted + n);
  state.quietTimer = 0;
}

export function say(state, text, seconds) {
  state.message = text;
  state.messageTimer = seconds || 3.5;
}

function dist2(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}

function nearestCar(state, x, y, maxD, filter) {
  let best = null, bestD = maxD * maxD;
  for (const c of state.cars) {
    if (filter && !filter(c)) continue;
    const d = dist2(x, y, c.x, c.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function updatePlayer(state, input, dt, audio) {
  const p = state.player;
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.shootCd = Math.max(0, p.shootCd - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  if (p.onFoot) {
    const mv = input.moveVector();
    const speed = input.isDown('run') ? 265 : 175;
    p.x += mv.x * speed * dt;
    p.y += mv.y * speed * dt;
    if (mv.x !== 0 || mv.y !== 0) p.angle = Math.atan2(mv.y, mv.x);
    p.x = Math.max(30, Math.min(WORLD_W - 30, p.x));
    p.y = Math.max(30, Math.min(WORLD_H - 30, p.y));
    collideBuildings(state.city, { x: p.x, y: p.y, r: 14 });
    // Steal / enter a nearby car.
    if (input.wasPressed('enter')) {
      const car = nearestCar(state, p.x, p.y, 70, (c) => !c.police);
      if (car) {
        p.onFoot = false;
        p.car = car;
        car.parked = false;
        car.traffic = false;
        car.driver = true;
        state.stats.carsStolen += 1;
        if (car.occupied) {
          addWanted(state, 1);
          say(state, 'Car jacked! The cops are coming.', 3);
        } else {
          say(state, `Stole a ${car.model.name}.`, 2);
        }
        audio.click();
      }
    }
  } else {
    const car = p.car;
    if (!car) { p.onFoot = true; return; }
    const accel = input.isDown('up') ? car.model.accel : input.isDown('down') ? -car.model.accel * 0.7 : 0;
    const steering = (input.isDown('left') ? -1 : 0) + (input.isDown('right') ? 1 : 0);
    car.speed += accel * dt;
    car.speed -= car.speed * 0.6 * dt; // drag
    if (input.isDown('down') && car.speed > 5) car.speed -= car.model.accel * 0.8 * dt; // brake
    car.speed = Math.max(-140, Math.min(car.model.top, car.speed));
    car.angle += steering * 1.9 * dt * Math.min(1, Math.abs(car.speed) / 90) * (car.speed < 0 ? -1 : 1);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = Math.max(40, Math.min(WORLD_W - 40, car.x));
    car.y = Math.max(40, Math.min(WORLD_H - 40, car.y));
    p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = car.speed;
    const hit = collideBuildings(state.city, { x: car.x, y: car.y, r: 20 });
    if (hit) {
      if (Math.abs(car.speed) > 120) { audio.crash(); addParticles(state, car.x, car.y, 10, '#ffb703'); }
      car.speed *= 0.4;
    }
    // Hit pedestrians while driving fast: a crime.
    for (const ped of state.peds) {
      if (Math.abs(car.speed) > 90 && dist2(car.x, car.y, ped.x, ped.y) < 26 * 26) {
        ped.flee = 3;
        ped.x += Math.cos(car.angle) * 40; ped.y += Math.sin(car.angle) * 40;
        addWanted(state, 1);
        say(state, 'You hit a pedestrian! Wanted level up.', 3);
        audio.crash();
      }
    }
    if (input.wasPressed('enter')) {
      p.onFoot = true;
      car.speed = 0;
      car.parked = true;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
      p.car = null;
    }
    audio.engine(Math.abs(car.speed) / car.model.top, true);
  }
  // Melee punch on foot (F or mouse click close by).
  if (p.onFoot && (input.wasPressed('interact') || (input.mouse.clicked && !p.car))) {
    p.punchCd = 0.35;
    audio.punch();
    const hx = p.x + Math.cos(p.angle) * 34;
    const hy = p.y + Math.sin(p.angle) * 34;
    for (const g of state.gang) {
      if (g.alive && dist2(hx, hy, g.x, g.y) < 40 * 40) { g.hp -= 25; addParticles(state, g.x, g.y, 6, '#ff595e'); }
    }
    for (const ped of state.peds) {
      if (dist2(hx, hy, ped.x, ped.y) < 34 * 34) { ped.flee = 3; addWanted(state, 1); }
    }
  }
  // Shooting: mouse aim, click fires (needs ammo).
  if (input.mouse.clicked && p.shootCd <= 0) {
    if (p.ammo > 0) {
      const wx = state.camX + input.mouse.x;
      const wy = state.camY + input.mouse.y;
      const a = Math.atan2(wy - p.y, wx - p.x);
      p.angle = a;
      state.bullets.push({ x: p.x + Math.cos(a) * 22, y: p.y + Math.sin(a) * 22, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, life: 0.6, fromPlayer: true });
      p.ammo -= 1;
      p.shootCd = 0.22;
      audio.shoot();
      addWanted(state, 0); // firing alone does not raise stars unless it hits someone
    } else {
      say(state, 'Out of ammo — buy more at Ironworks Arms.', 2.5);
    }
  }
  // Busted timer: a foot cop standing on the player arrests them.
  if (p.onFoot) {
    let copNear = false;
    for (const c of state.cops) if (dist2(p.x, p.y, c.x, c.y) < 34 * 34) copNear = true;
    p.bustedTimer = copNear ? p.bustedTimer + dt : 0;
  } else p.bustedTimer = 0;
}

export function updateTraffic(state, dt) {
  const p = state.player;
  for (const car of state.cars) {
    if (!car.traffic || car.police) continue;
    car.turnCd -= dt;
    // Slow for the car ahead on the same lane.
    let slow = false;
    for (const o of state.cars) {
      if (o === car || o.parked) continue;
      const dx = o.x - car.x, dy = o.y - car.y;
      const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 70 && side < 26) { slow = true; break; }
    }
    const targetSpeed = slow ? 0 : 140;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // At an intersection, sometimes turn.
    const nearX = Math.round(car.x / 400) * 400;
    const nearY = Math.round(car.y / 400) * 400;
    if (car.turnCd <= 0 && Math.abs(car.x - nearX) < 30 && Math.abs(car.y - nearY) < 30 && chance(state.rng, 0.35)) {
      car.angle += (chance(state.rng, 0.5) ? 1 : -1) * Math.PI / 2;
      car.vertical = !car.vertical;
      car.turnCd = range(state.rng, 4, 9);
    }
    // Wrap around the world edges.
    if (car.x < 60) car.x = WORLD_W - 80;
    if (car.x > WORLD_W - 60) car.x = 80;
    if (car.y < 60) car.y = WORLD_H - 80;
    if (car.y > WORLD_H - 60) car.y = 80;
    // Keep traffic on roads: nudge back onto the nearest road centre.
    if (!isOnRoad(car.x, car.y)) {
      const cx = Math.round((car.x - 200) / 400) * 400 + 200;
      const cy = Math.round((car.y - 200) / 400) * 400 + 200;
      if (Math.abs(car.x - cx) < Math.abs(car.y - cy)) car.x += (cx - car.x) * dt * 2;
      else car.y += (cy - car.y) * dt * 2;
    }
    collideBuildings(state.city, { x: car.x, y: car.y, r: 18 });
  }
}

export function updatePeds(state, dt) {
  const p = state.player;
  for (const ped of state.peds) {
    ped.flee = Math.max(0, ped.flee - dt);
    if (ped.flee > 0) {
      const a = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.x += Math.cos(a) * 150 * dt;
      ped.y += Math.sin(a) * 150 * dt;
    } else {
      ped.wait -= dt;
      if (ped.wait <= 0) {
        const t = randomRoadPoint(state.rng);
        ped.tx = t.x; ped.ty = t.y;
        ped.wait = range(state.rng, 3, 9);
      }
      const dx = ped.tx - ped.x, dy = ped.ty - ped.y;
      const d = Math.hypot(dx, dy);
      if (d > 12) {
        ped.angle = Math.atan2(dy, dx);
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
      }
    }
    ped.x = Math.max(30, Math.min(WORLD_W - 30, ped.x));
    ped.y = Math.max(30, Math.min(WORLD_H - 30, ped.y));
    if (pointInBuilding(state.city, ped.x, ped.y)) {
      // Shoved into a building (e.g. by a car): step back to the nearest road.
      const rp = randomRoadPoint(state.rng);
      ped.x = rp.x; ped.y = rp.y; ped.tx = rp.x; ped.ty = rp.y;
    }
  }
}

export function updatePolice(state, dt, audio) {
  const p = state.player;
  // Spawn police cars to match the wanted level.
  const wantCars = state.wanted >= 1 ? Math.min(state.wanted, 4) : 0;
  const haveCars = state.cars.filter((c) => c.police).length;
  if (haveCars < wantCars && Math.random() < dt * 1.2) {
    const a = Math.random() * Math.PI * 2;
    const x = Math.max(100, Math.min(WORLD_W - 100, p.x + Math.cos(a) * 700));
    const y = Math.max(100, Math.min(WORLD_H - 100, p.y + Math.sin(a) * 700));
    state.cars.push({
      x, y, angle: 0, speed: 0,
      model: { name: 'Interceptor', color: POLICE_COLOR, top: 320, accel: 420 },
      color: POLICE_COLOR, traffic: false, parked: false, police: true, hp: 120,
    });
  }
  // Foot cops when wanted is 2+.
  const wantCops = state.wanted >= 2 ? Math.min(state.wanted, 3) : 0;
  if (state.cops.length < wantCops && Math.random() < dt) {
    const a = Math.random() * Math.PI * 2;
    state.cops.push({ x: p.x + Math.cos(a) * 380, y: p.y + Math.sin(a) * 380, angle: 0, speed: 150, shootCd: 1 });
  }
  // Police cars chase and ram.
  for (const car of state.cars) {
    if (!car.police) continue;
    const dx = p.x - car.x, dy = p.y - car.y;
    const d = Math.hypot(dx, dy);
    const want = Math.atan2(dy, dx);
    let da = want - car.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, da));
    car.speed += ((d > 60 ? 300 : 120) - car.speed) * Math.min(1, dt * 1.2);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    collideBuildings(state.city, { x: car.x, y: car.y, r: 20 });
    if (d < 46) {
      if (p.onFoot && p.invuln <= 0) {
        p.hp -= 12 * dt * 4;
        if (Math.random() < dt * 2) addParticles(state, p.x, p.y, 5, '#ff595e');
      } else if (!p.onFoot) {
        car.speed *= 0.5;
        p.car.speed *= 0.6;
        if (Math.random() < dt * 3) audio.crash();
      }
    }
  }
  // Foot cops chase on foot and shoot at higher wanted levels.
  for (const c of state.cops) {
    const dx = p.x - c.x, dy = p.y - c.y;
    const d = Math.hypot(dx, dy);
    c.angle = Math.atan2(dy, dx);
    if (d > 40) {
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
    }
    c.shootCd -= dt;
    if (state.wanted >= 3 && d < 420 && d > 90 && c.shootCd <= 0) {
      c.shootCd = 1.4;
      const a = c.angle + range(state.rng, -0.12, 0.12);
      state.bullets.push({ x: c.x, y: c.y, vx: Math.cos(a) * 700, vy: Math.sin(a) * 700, life: 0.8, fromPlayer: false });
      audio.shoot();
    }
    collideBuildings(state.city, { x: c.x, y: c.y, r: 14 });
  }
  // Wanted decay: stay clean and out of sight and the heat fades.
  if (state.wanted > 0) {
    state.quietTimer += dt;
    const nearestCop = Math.min(
      ...state.cars.filter((c) => c.police).map((c) => Math.hypot(c.x - p.x, c.y - p.y)),
      ...state.cops.map((c) => Math.hypot(c.x - p.x, c.y - p.y)),
      9999,
    );
    if (state.quietTimer > WANTED_DECAY_SECONDS && nearestCop > 420) {
      state.wanted -= 1;
      state.quietTimer = 0;
      state.stats.copsDodged += 1;
      say(state, state.wanted === 0 ? 'You lost the cops. Clean.' : 'Heat dying down…', 2.5);
    }
  }
  // Remove police when clean.
  if (state.wanted === 0) {
    state.cars = state.cars.filter((c) => !c.police);
    state.cops = [];
  }
  audio.siren(state.wanted > 0, dt);
}

export function updateGang(state, dt, audio) {
  const p = state.player;
  for (const g of state.gang) {
    if (!g.alive) continue;
    if (g.hp <= 0) {
      g.alive = false;
      addParticles(state, g.x, g.y, 14, '#ff595e');
      addWanted(state, 1);
      continue;
    }
    const dx = p.x - g.x, dy = p.y - g.y;
    const d = Math.hypot(dx, dy);
    g.angle = Math.atan2(dy, dx);
    if (d > 260) {
      g.x += Math.cos(g.angle) * g.speed * dt;
      g.y += Math.sin(g.angle) * g.speed * dt;
    } else if (d < 200) {
      g.x -= Math.cos(g.angle) * g.speed * 0.5 * dt;
      g.y -= Math.sin(g.angle) * g.speed * 0.5 * dt;
    }
    g.shootCd -= dt;
    if (d < 380 && g.shootCd <= 0) {
      g.shootCd = 1.6;
      const a = g.angle + range(state.rng, -0.15, 0.15);
      state.bullets.push({ x: g.x, y: g.y, vx: Math.cos(a) * 650, vy: Math.sin(a) * 650, life: 0.8, fromPlayer: false });
      audio.shoot();
    }
    collideBuildings(state.city, { x: g.x, y: g.y, r: 14 });
  }
  state.gang = state.gang.filter((g) => g.alive || Math.random() < 0.98);
}

export function updateBullets(state, dt) {
  const p = state.player;
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (pointInBuilding(state.city, b.x, b.y)) b.life = 0;
    if (b.fromPlayer) {
      for (const g of state.gang) {
        if (g.alive && dist2(b.x, b.y, g.x, g.y) < 20 * 20) { g.hp -= 20; b.life = 0; addParticles(state, g.x, g.y, 5, '#ff595e'); }
      }
      for (const c of state.cops) {
        if (dist2(b.x, b.y, c.x, c.y) < 20 * 20) { b.life = 0; state.cops.splice(state.cops.indexOf(c), 1); addWanted(state, 2); addParticles(state, c.x, c.y, 8, '#4cc9f0'); }
      }
      for (const car of state.cars) {
        if (!car.police && dist2(b.x, b.y, car.x, car.y) < 24 * 24) { car.hp -= 15; b.life = 0; addParticles(state, b.x, b.y, 4, '#ffb703'); if (car.hp <= 0) addParticles(state, car.x, car.y, 20, '#ff8500'); }
      }
    } else if (p.invuln <= 0 && dist2(b.x, b.y, p.x, p.y) < 18 * 18) {
      p.hp -= 9;
      p.invuln = 0.25;
      b.life = 0;
      addParticles(state, p.x, p.y, 5, '#ff595e');
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
}

export function addParticles(state, x, y, n, color) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = range(state.rng, 40, 180);
    state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: range(state.rng, 0.3, 0.7), color });
  }
}

export function updateParticles(state, dt) {
  for (const pt of state.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);
}

// Pickups: health kits and ammo boxes the player walks over.
export function updatePickups(state, audio) {
  const p = state.player;
  for (const pk of state.pickups) {
    if (dist2(p.x, p.y, pk.x, pk.y) < 30 * 30) {
      if (pk.kind === 'health') p.hp = Math.min(100, p.hp + 50);
      else p.ammo += 30;
      pk.taken = true;
      audio.pickup();
      say(state, pk.kind === 'health' ? '+50 health' : '+30 ammo', 2);
    }
  }
  state.pickups = state.pickups.filter((pk) => !pk.taken);
}
