[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/nguyenhuong74/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/nguyenhuong74/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Solmara: Streets of Gold

An original open-world crime game that plays offline in desktop Chrome — no
build step, no network requests, no libraries. Built for the
[gta6-01 bounty on make.fun](https://make.fun/bounty/gta6-01).

You are Milo Vega, new in the sun-soaked coastal city of Solmara Bay, working
jobs for fixer Rosa Delgado: steal a car, run a package, drive a getaway,
rob a corner store, clear Vulture gang turf, and finally steal the armored
van. Six story missions, free roam after the story ends.

## How to play

Open `game/index.html` in desktop Chrome (or serve `game/` with any static
server — `node serve.ts` then http://localhost:8080).

- **WASD / arrows** — move on foot, drive when in a car (Shift to run)
- **E** — steal / enter a car, exit a car, accept a mission briefing
- **Mouse aim + click** — shoot the pistol • **F** — punch
- **R** — save game (continues from the title screen) • **P / Esc** — pause • **M** — mute

## What is in the game

- A 3,600 × 3,600 city: road grid, buildings, parks, palms, beach and sea
- Traffic that drives the roads, pedestrians on the sidewalks, parked cars
- Carjacking: steal any car (occupied cars raise your wanted level)
- Wanted stars (0–5) with police cars that chase and ram, and foot cops who
  shoot at 3+ stars; lose the heat by staying clean and out of sight
- 6 story missions with a cash reward each, a mission marker and a minimap
- Combat: pistol, punches, gang shootouts, bullets and particles
- HUD: cash, health, wanted stars, clock, speed, ammo, minimap, objectives
- Shops: Doc's Clinic heals ($50), Ironworks Arms sells bullets ($80)
- Synthesised sound: engine hum, police siren, gunshots, mission jingles
- Save / continue via localStorage

## How it works

- `game/src/city.js` — seeded city generation: roads, blocks, buildings, parks, beach
- `game/src/entities.js` — player, traffic AI, pedestrians, police, wanted system, bullets
- `game/src/missions.js` — the six-mission story state machine
- `game/src/render.js` — the canvas renderer and the title/pause/wasted screens
- `game/src/hud.js` — HUD, wanted stars, minimap
- `game/src/audio.js` — WebAudio-synthesised sound, no audio files
- `game/src/input.js` — keyboard + mouse
- `game/src/shots.js` — fixed screenshot scenes (`?shot=menu|chase|street|mission`)
- `main.ts` — the entry program: copies `game/` and `screenshots/` to
  `/output` and writes `/output/dossier.json` with the kit's
  `vendor/makefun-game.ts` library.

## Originality

Everything is this game's own: the city of Solmara Bay, Milo Vega, Rosa
Delgado, the Vultures, the cars, the story, the art (drawn by code) and the
sounds (synthesised). It uses no Rockstar Games name, logo, character, map,
art or music, and no asset from any commercial game.

## License

MIT — see [LICENSE](LICENSE).
