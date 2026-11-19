// Fixed scenes for screenshots, driven by the page's query string.
// ?shot=menu | chase | street | mission stages a real gameplay state, lets
// the world tick a few frames, paints it and sets window.__shotReady so a
// screenshot tool knows the frame is done. Every shot is a real render of
// this game's own code — nothing is drawn just for the screenshot.
import { SPOTS } from './config.js';
import { addWanted, say } from './entities.js';
import { startMission } from './missions.js';

export function stageShot(name, state) {
  const p = state.player;
  if (name === 'menu') return { screen: 'title' };
  if (name === 'chase') {
    // Milo in a yellow coupe, 3 wanted stars, two police cars closing in,
    // mission 3 (Getaway Driver) running with the docks marker lit.
    const car = state.cars.find((c) => c.model.name === 'Coupe') || state.cars[2];
    car.parked = false; car.traffic = false;
    p.onFoot = false; p.car = car;
    car.x = 1380; car.y = 1380; car.angle = 0; car.speed = 260;
    p.x = car.x; p.y = car.y; p.angle = 0;
    state.missions.index = 2;
    startMission(state, { mission() {}, pickup() {} });
    state.missions.rosaInCar = true;
    state.missions.timer = 64;
    addWanted(state, 3);
    state.cars.push(
      { x: 1180, y: 1330, angle: 0.3, speed: 280, model: { name: 'Interceptor', color: '#222831', top: 320, accel: 420 }, color: '#222831', traffic: false, parked: false, police: true, hp: 120 },
      { x: 1560, y: 1500, angle: -2.6, speed: 270, model: { name: 'Interceptor', color: '#222831', top: 320, accel: 420 }, color: '#222831', traffic: false, parked: false, police: true, hp: 120 },
    );
    say(state, 'Rosa: "Step on it! The Docks, now!"', 10);
    return { screen: 'play' };
  }
  if (name === 'street') {
    // On foot at the corner store, traffic passing, pedestrians around.
    p.onFoot = true; p.car = null;
    p.x = SPOTS.store.x + 20; p.y = SPOTS.store.y + 40; p.angle = -Math.PI / 2;
    p.hp = 100; p.ammo = 24;
    state.missions.index = 3;
    startMission(state, { mission() {}, pickup() {} });
    state.missions.robTimer = 3;
    state.pickups.push({ x: 1400, y: 1560, kind: 'health', taken: false });
    say(state, 'Cracking the safe… 3s — stay inside!', 10);
    return { screen: 'play' };
  }
  if (name === 'mission') {
    // Vulture turf fight: gang members visible, Milo aiming, 2 stars.
    p.onFoot = true; p.car = null;
    p.x = SPOTS.turf.x - 160; p.y = SPOTS.turf.y + 60; p.angle = 0;
    p.hp = 82; p.ammo = 18;
    state.missions.index = 4;
    startMission(state, { mission() {}, pickup() {} });
    addWanted(state, 2);
    say(state, 'Vultures left: 5', 10);
    return { screen: 'play' };
  }
  return { screen: 'title' };
}
