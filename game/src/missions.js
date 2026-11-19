// Missions and story: six jobs from fixer Rosa Delgado that take Milo Vega
// from a nobody with a stolen sedan to the crew that hits the armored van.
// Each mission is a small state machine: objective text, a map marker, a
// timer where it matters, and a cash reward on completion.
import { SPOTS } from './config.js';
import { say, addWanted, spawnGang } from './entities.js';

export const MISSIONS = [
  {
    id: 1,
    title: 'First Wheels',
    giver: 'Rosa: "New in Solmara? You need wheels. Steal a car and bring it to my garage."',
    objective: 'Steal any car (walk up to one, press E) and drive to Rosa\'s Garage',
    reward: 200,
    spot: 'garage',
    needsCar: true,
  },
  {
    id: 2,
    title: 'The Package',
    giver: 'Rosa: "A package is waiting uptown. Pick it up on foot, then drop it off — quiet."',
    objective: 'Pick up the package, then deliver it to the drop-off',
    reward: 350,
    spot: 'package',
    needsCar: false,
  },
  {
    id: 3,
    title: 'Getaway Driver',
    giver: 'Rosa: "Drive me to the docks. Fast. The cops already know my face."',
    objective: 'Drive Rosa to the Solmara Docks within 90 seconds',
    reward: 500,
    spot: 'docks',
    needsCar: true,
    timer: 90,
  },
  {
    id: 4,
    title: 'Corner Store',
    giver: 'Rosa: "The corner store keeps its cash in a back safe. Stand inside until it opens, then vanish."',
    objective: 'Rob the Corner Store (stand in the zone) then lose the cops',
    reward: 700,
    spot: 'store',
    needsCar: false,
  },
  {
    id: 5,
    title: 'Vulture Turf',
    giver: 'Rosa: "The Vultures taxed my cousin. Clear their corner — all five of them."',
    objective: 'Defeat 5 Vulture gang members in the north district',
    reward: 900,
    spot: 'turf',
    needsCar: false,
  },
  {
    id: 6,
    title: 'The Big Score',
    giver: 'Rosa: "The armored van runs the beach road at dusk. Take it. Bring it to the hideout. This is the one."',
    objective: 'Steal the armored van and deliver it to the Hideout',
    reward: 10000,
    spot: 'van',
    needsCar: true,
  },
];

export function createMissionState() {
  return {
    index: 0, // 0-based into MISSIONS; MISSIONS.length means story complete
    phase: 'brief', // brief | active | done
    timer: 0,
    robTimer: 0,
    gangLeft: 0,
    hasPackage: false,
    vanStolen: false,
    rosaInCar: false,
  };
}

export function currentMission(m) {
  return MISSIONS[m.index] ?? null;
}

export function missionSpot(m) {
  const mission = currentMission(m);
  if (!mission) return null;
  if (mission.id === 2 && m.hasPackage) return SPOTS.dropoff;
  if (mission.id === 6 && m.vanStolen) return SPOTS.hideout;
  return SPOTS[mission.spot];
}

export function missionObjective(m) {
  const mission = currentMission(m);
  if (!mission) return 'Story complete — Solmara is yours. Free roam!';
  if (mission.id === 2) return m.hasPackage ? 'Deliver the package to the drop-off' : 'Pick up the package uptown';
  if (mission.id === 4) return m.robTimer > 0 ? `Cracking the safe… ${Math.ceil(m.robTimer)}s — stay inside!` : 'Get to the Corner Store and rob it';
  if (mission.id === 5) return `Vultures left: ${m.gangLeft}`;
  if (mission.id === 6) return m.vanStolen ? 'Drive the van to the Hideout!' : 'Steal the armored van';
  if (mission.id === 3 && m.timer > 0) return `Drive Rosa to the Docks — ${Math.ceil(m.timer)}s left!`;
  return mission.objective;
}

export function startMission(state, audio) {
  const m = state.missions;
  const mission = currentMission(m);
  if (!mission) return;
  m.phase = 'active';
  m.timer = mission.timer || 0;
  m.robTimer = 0;
  m.robbed = false;
  m.hasPackage = false;
  m.vanStolen = false;
  m.rosaInCar = false;
  if (mission.id === 5) {
    spawnGang(state, SPOTS.turf.x, SPOTS.turf.y, 5);
    m.gangLeft = 5;
  }
  if (mission.id === 6) {
    // The armored van waits on the beach road.
    state.cars.push({
      x: SPOTS.van.x, y: SPOTS.van.y, angle: 0, speed: 0,
      model: { name: 'Armored Van', color: '#3a3f4a', top: 240, accel: 300 },
      color: '#3a3f4a', traffic: false, parked: true, police: false, hp: 300, armored: true,
    });
  }
  say(state, `${mission.title}: ${mission.giver}`, 6);
  audio.mission();
}

function completeMission(state, audio) {
  const m = state.missions;
  const mission = currentMission(m);
  if (!mission) return;
  state.player.cash += mission.reward;
  state.stats.missionsDone += 1;
  say(state, `Mission complete: ${mission.title} — +$${mission.reward}`, 4);
  audio.mission();
  m.index += 1;
  m.phase = 'brief';
  if (m.index >= MISSIONS.length) {
    state.storyComplete = true;
    say(state, 'STORY COMPLETE — you run Solmara now. Free roam!', 6);
  }
}

export function failMission(state, reason) {
  const m = state.missions;
  if (m.phase !== 'active') return;
  m.phase = 'brief';
  m.timer = 0;
  m.robTimer = 0;
  m.hasPackage = false;
  say(state, `Mission failed: ${reason} — talk to Rosa again (press T).`, 4);
}

// Press T (or the on-screen prompt) to accept the next briefing.
export function updateMissions(state, input, dt, audio) {
  const m = state.missions;
  const mission = currentMission(m);
  if (!mission) return;
  const p = state.player;
  if (m.phase === 'brief') {
    if (input.wasPressed('interact') || input.wasPressed('enter')) startMission(state, audio);
    return;
  }
  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) { failMission(state, 'out of time'); return; }
  }
  const spot = missionSpot(m);
  const near = spot && Math.hypot(p.x - spot.x, p.y - spot.y) < 90;
  switch (mission.id) {
    case 1:
      if (near && !p.onFoot) completeMission(state, audio);
      break;
    case 2:
      if (!m.hasPackage && near) {
        m.hasPackage = true;
        say(state, 'Package secured. Now deliver it!', 3);
        audio.pickup();
      } else if (m.hasPackage && near) completeMission(state, audio);
      break;
    case 3:
      if (!m.rosaInCar && !p.onFoot) {
        m.rosaInCar = true;
        say(state, 'Rosa is in! Go — the Docks!', 3);
        addWanted(state, 1);
      }
      if (m.rosaInCar && near) completeMission(state, audio);
      break;
    case 4: {
      if (near && m.robTimer <= 0 && !m.robbed) {
        m.robTimer = 5;
        say(state, 'Cracking the safe — hold position!', 3);
      }
      if (m.robTimer > 0) {
        if (near) {
          m.robTimer -= dt;
          if (m.robTimer <= 0) {
            m.robbed = true;
            addWanted(state, 2);
            say(state, 'Safe open! $700 inside. Now LOSE the cops!', 4);
          }
        } else {
          m.robTimer = 5; // stepped out: the crack restarts
          say(state, 'You left the zone — the safe relocked.', 2.5);
        }
      }
      if (m.robbed && state.wanted === 0) completeMission(state, audio);
      break;
    }
    case 5: {
      m.gangLeft = state.gang.filter((g) => g.alive).length;
      if (m.gangLeft === 0) completeMission(state, audio);
      break;
    }
    case 6: {
      if (!m.vanStolen && !p.onFoot && p.car && p.car.armored) {
        m.vanStolen = true;
        addWanted(state, 3);
        say(state, 'Van stolen! 3 stars — get to the Hideout!', 4);
      }
      if (m.vanStolen && near) completeMission(state, audio);
      break;
    }
    default:
      break;
  }
}
