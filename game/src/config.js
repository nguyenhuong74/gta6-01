// Solmara: Streets of Gold — tuning constants and shared names.
// Everything here is original: a fictional sun-soaked coastal city, its own
// people, cars, gangs and story. Nothing is taken from any commercial game.

export const WORLD_W = 3600;
export const WORLD_H = 3600;
export const ROAD_SPACING = 400;
export const ROAD_W = 96;
export const BEACH_Y = 3300; // south of this line: sand, then sea

export const CITY_NAME = 'Solmara Bay';
export const GAME_TITLE = 'SOLMARA';
export const GAME_SUBTITLE = 'Streets of Gold';

// Fixed story locations (world coordinates, picked on real road corners).
export const SPOTS = {
  garage: { x: 620, y: 620, label: "Rosa's Garage" },
  package: { x: 2180, y: 620, label: 'Package pickup' },
  dropoff: { x: 2980, y: 1780, label: 'Drop-off point' },
  docks: { x: 3220, y: 2980, label: 'Solmara Docks' },
  store: { x: 1380, y: 1380, label: 'Corner Store' },
  turf: { x: 2580, y: 2580, label: 'Vulture turf' },
  van: { x: 980, y: 2580, label: 'Armored van' },
  hideout: { x: 620, y: 2980, label: 'Hideout' },
  clinic: { x: 1780, y: 980, label: "Doc's Clinic" },
  arms: { x: 1780, y: 2180, label: 'Ironworks Arms' },
  park: { x: 2180, y: 1380, label: 'Palm Park' },
};

export const CAR_MODELS = [
  { name: 'Civic', color: '#c94f43', top: 240, accel: 300 },
  { name: 'Sedan', color: '#3f6fb5', top: 260, accel: 320 },
  { name: 'Coupe', color: '#e8b23a', top: 300, accel: 360 },
  { name: 'Pickup', color: '#5d8a4f', top: 230, accel: 280 },
  { name: 'Taxi', color: '#e8c832', top: 250, accel: 310 },
  { name: 'Van', color: '#8a8f96', top: 210, accel: 260 },
];

export const POLICE_COLOR = '#222831';
export const PLAYER_COLOR = '#ff5d8f';

export const SAVE_KEY = 'solmara-streets-of-gold-save-v1';

export const WANTED_DECAY_SECONDS = 18;
export const MAX_WANTED = 5;
