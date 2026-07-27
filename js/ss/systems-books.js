// ---------------------------------------------------------------------------
// GURPS Spaceships — systems and design features from the supplements
// (SS2-SS8), registered into the same SYSTEMS/FEATURES maps as the core
// set. Each entry carries a `source` book tag for the UI's book filter.
// ---------------------------------------------------------------------------

import { FEATURES, costProgression } from './tables.js';
import { SYSTEMS, WS_STD, idx, makeEngine, makePlant, tlPick } from './systems.js';

// --- SS4: Fighters, Carriers, and Mecha ------------------------------------

SYSTEMS.robotLeg = {
  key: 'robotLeg', name: 'Robot leg', category: 'Utility', tl: 9, source: 'SS4',
  loc: 'hull', core: false, he: 1, maxSM: 7,
  cost: (sm) => [100e3, 300e3, 1e6, 3e6][idx(sm)] ?? 0,
  info: (sm) => ({
    legs: 1, ppShared: 'robotLegs',
    desc: 'walker leg + motors; one Power Point runs all legs',
    note: 'Ground Move 10 with two legs; Hnd bonus by SM',
  }),
};

// --- SS7: Divergent and Paranormal Tech -------------------------------------
// (The SS7 armors live in tables.js ARMORS.)

const SS7_ENGINES = {
  etherOars: {
    name: 'Ether oars', tl: 0, ss: true, he: 0, reactionless: true, accel: () => 0.1,
    costBase: 30e3, costMult: 0.5, maxSM: 7,
    note: 'rowed by crew (2/6/20 rowers at SM+5/6/7) seated in the same section',
  },
  etherScrew: {
    name: 'Ether screw', tl: 0, ss: true, he: 1, reactionless: true, accel: () => 0.2,
    costBase: 30e3, note: 'also covers ether flukes; +2 to be detected visually',
  },
  etherSail: {
    name: 'Ether sail', tl: 0, ss: true, he: 0, reactionless: true, accel: () => 0.1,
    costBase: 30e3, costMult: 2, note: 'exposed (targeted as radiators); astral sail variant',
  },
  poweredEtherSail: {
    name: 'Powered ether sail', tl: 5, ss: true, he: 1, reactionless: true, accel: () => 0.3,
    costBase: 30e3, costMult: 3, note: 'exposed; not protected by armor',
  },
  magneticPlanetaryDrive: {
    name: 'Magnetic planetary drive', tl: 9, ss: true, he: 1, reactionless: true,
    accel: (tl) => tl >= 11 ? 2 : tl >= 10 ? 1 : 0.5,
    costBase: 20e3, loc: 'rear', core: true,
    note: 'works only inside strong planetary/stellar magnetospheres',
  },
  laserRocket: {
    name: 'Laser rocket', tl: 9, he: 0, accel: () => 3, dv: () => 0.5, fuel: 'ablative plastic',
    costBase: 60e3, note: 'needs a big ground-based laser installation (SS7 lists 2G)',
  },
  vasimr: {
    name: 'VASIMR electric rocket', tl: 9, he: 1, accel: () => 0.002, dv: () => 0.5, fuel: 'hydrogen',
    costBase: 200e3, note: 'low-thrust mode: 0.0002G and 10 mps per tank',
  },
  plasmaTorch: {
    name: 'Plasma torch', tl: 10, ss: true, he: 1, accel: () => 5, dv: () => 2.5, fuel: 'hydrogen',
    costBase: 200e3, costMult: 5, note: 'high-efficiency mode: 1G and 12.5 mps per tank',
  },
  solarThermal: {
    name: 'Solar thermal rocket', tl: 8, he: 0, accel: () => 0.05,
    dv: (tl) => tl >= 9 ? 0.4 : 0.3, fuel: 'hydrogen',
    costBase: 50e3, note: 'needs one solar mirror per engine; ÷distance² in AU, max 0.2G',
  },
};
for (const [key, e] of Object.entries(SS7_ENGINES)) {
  SYSTEMS[key] = makeEngine(key, e, 'SS7');
  if (e.maxSM) SYSTEMS[key].maxSM = e.maxSM;
  if (e.loc) SYSTEMS[key].loc = e.loc;
  if (e.core) SYSTEMS[key].core = true;
}
// SS8 also prints the laser rocket (at 3G, validated by the Mercury HLV).
SYSTEMS.laserRocket.source = 'SS7/SS8';

const SS7_PLANTS = {
  etherFurnace: {
    name: 'Ether furnace', tl: 5, ss: true, pp: 1,
    endurance: () => '3 months internal; +1 yr per tank of nebulonic fuel', costBase: 60e3,
  },
  manaEngine: { name: 'Mana engine', tl: 0, ss: true, pp: 1, ppKind: 'magic', endurance: () => 'unlimited (needs mana)', costBase: 100e3 },
  soulburner: {
    name: 'Soulburner', tl: 0, ss: true, pp: 2, ppKind: 'magic',
    endurance: (tl, sm) => `burns souls (${[10, 10, 30, 100, 300, 1e3, 3e3, 10e3, 30e3, 100e3, 300e3, 1e6][idx(sm)].toLocaleString('en-US')} for full power)`,
    costBase: 100e3,
  },
  nemaReactor: {
    name: 'NEMA reactor', tl: 7, ss: true, pp: 1,
    endurance: (tl) => `${tlPick({ 7: 25, 9: 50, 10: 75 }, tl)} yr`, costBase: 100e3, costMult: 1.5,
    extraMagicPP: 1, note: 'meltdown breaches reality',
  },
  cagedSpirit: {
    name: 'Caged spirit', tl: 0, ss: true, pp: 5, ppKind: 'magic',
    endurance: () => 'unlimited (angry if released)', costBase: 100e3, costMult: 8,
  },
  orgonePlant: {
    name: 'Orgone power plant', tl: 0, ss: true, pp: 2,
    endurance: () => 'unlimited near a living ecosystem', costBase: 50e3,
    note: 'must stay near a planetary ecosystem (or carry a living open space)',
  },
  perpetualMotion: { name: 'Perpetual motion machine', tl: 0, ss: true, pp: 1, endurance: () => 'unlimited', costBase: 200e3 },
  psychotronicPlant: {
    name: 'Psychotronic power plant', tl: 9, ss: true, pp: (sm) => sm <= 6 ? 4 : 2, ppKind: 'psi',
    endurance: (tl, sm) => `needs ${[1, 1, 1, 2, 4, 10, 30, 100, 300, 1e3, 3e3, 3e3][idx(sm)]} psi(s) as living batteries`,
    costBase: 200e3,
  },
  solarBoiler: {
    name: 'Solar boiler', tl: 7, pp: 1,
    endurance: () => 'unlimited within 2 AU; needs one solar mirror', costBase: 10e3,
  },
  vacuumEnergy: {
    name: 'Vacuum energy plant', tl: 9, ss: true, pp: 3, endurance: () => 'unlimited',
    costBase: 750e3, deRate: { max: 2, costFactor: (n) => (3 - n) / 3 },
  },
};
for (const [key, p] of Object.entries(SS7_PLANTS)) SYSTEMS[key] = makePlant(key, p, 'SS7');
// vacuum energy has a non-ladder cost row: fix explicitly.
SYSTEMS.vacuumEnergy.cost = (sm, tl, opts = {}) => {
  const base = [750e3, 750e3, 2.4e6, 7.5e6, 24e6, 75e6, 240e6, 750e6, 2.4e9, 7.5e9, 24e9, 75e9][idx(sm)];
  const deRate = Math.min(opts.deRate || 0, 2);
  return base * ((3 - deRate) / 3);
};

Object.assign(SYSTEMS, {
  digestiveSystem: {
    key: 'digestiveSystem', name: 'Digestive system', category: 'Utility', tl: 7, source: 'SS7',
    loc: 'any', core: true, he: 1, minSM: 6,
    cost: (sm, tl, opts = {}) => {
      const base = [null, null, 100e3, 300e3, 1e6, 3e6, 10e6, 30e6, 100e6, 300e6, 1e9, 3e9][idx(sm)] ?? 0;
      return (opts.damageType || 'crushing') === 'crushing' ? base / 2 : base;
    },
    info: (sm, tl, opts = {}) => {
      const tons = [null, null, 1, 3, 10, 30, 100, 300, 1000, 3000, 10000, 30000][idx(sm)];
      const dmg = [null, null, '2d+2', '3d', '3d+2', '4d', '4d+2', '5d', '5d+2', '6d', '6d+2', '7d'][idx(sm)];
      return {
        ppNeed: 1, hangarTons: tons, ws: WS_STD[idx(sm)],
        desc: `digests ${tons} tons (${dmg} ${opts.damageType || 'crushing'}/turn); doubles as hold/bay`,
      };
    },
  },
  exophaseField: {
    key: 'exophaseField', name: 'Exophase field', category: 'Defenses', tl: 0, superscience: true, source: 'SS7',
    loc: 'any', core: true, he: 1,
    cost: (sm) => [20e6, 20e6, 50e6, 100e6, 200e6, 500e6, 1e9, 2e9, 5e9, 10e9, 20e9, 50e9][idx(sm)],
    info: (sm) => ({ ppNeed: 1, ws: WS_STD[idx(sm)], desc: 'phases the ship out of normal space (intangible, sensor-blind both ways)' }),
  },
  extradimensionalInterface: {
    key: 'extradimensionalInterface', name: 'Extradimensional interface', category: 'Utility', tl: 12, superscience: true, source: 'SS7',
    loc: 'any', core: true, coreOnly: true, he: 2,
    cost: (sm) => [10e6, 10e6, 30e6, 100e6, 300e6, 1e9, 3e9, 10e9, 30e9, 100e9, 300e9, 1e12][idx(sm)],
    info: (sm) => ({
      ppNeed: 2, ws: WS_STD[idx(sm)],
      desc: 'bigger inside: external SM is 4 smaller per interface',
      note: 'no reaction engines, sails, ramscoops, solar panels, guns or launchers',
    }),
  },
  gasbag: {
    key: 'gasbag', name: 'Gasbag', category: 'Engines', tl: 5, source: 'SS7',
    loc: 'hull', core: false, he: 0,
    cost: (sm, tl, opts = {}) => {
      const base = [50e3, 50e3, 100e3, 200e3, 500e3, 1e6, 2e6, 5e6, 10e6, 20e6, 50e6, 100e6][idx(sm)];
      return opts.gas === 'antigravity' ? base * 5 : base;
    },
    info: (sm, tl, opts = {}) => {
      let lift = [9, 9, 30, 90, 300, 900, 3000, 9000, 30000, 90000, 300000, 900000][idx(sm)];
      if (opts.gas === 'antigravity') lift *= 10;
      return {
        liftTons: lift,
        desc: `${lift.toLocaleString('en-US')} tons of ${opts.gas === 'antigravity' ? 'antigravity-gas' : 'lifting-gas'} lift`,
        note: sm >= 10 ? 'lifting gas at SM+10+ requires superscience' : (opts.gas !== 'antigravity' ? 'hydrogen bags are volatile in oxygen atmospheres' : null),
      };
    },
  },
  helicopterRotor: {
    key: 'helicopterRotor', name: 'Helicopter rotor', category: 'Engines', tl: 7, source: 'SS7',
    loc: 'hull', core: false, he: 1,
    cost: (sm) => [100e3, 100e3, 300e3, 1e6, 3e6, 10e6, 30e6, 100e6, 300e6, 1e9, 3e9, 10e9][idx(sm)],
    info: (sm, tl, opts, ctx) => ({
      ppNeed: 1, rotor: true, ws: WS_STD[idx(sm)],
      desc: `VTOL rotor: air speed ${ctx?.streamlined ? '200 (250 with two)' : '80 (100 with two)'} mph`,
      note: sm >= 7 ? 'superscience at SM+7 or larger' : null,
    }),
  },
  holoprojector: {
    key: 'holoprojector', name: 'Holoprojector', category: 'Defenses', tl: 10, superscience: true, source: 'SS7',
    loc: 'hull', core: false, he: 0,
    cost: (sm) => costProgression(60e3)[idx(sm)],
    info: () => ({ desc: 'disguises the ship as anything of the same or one larger SM' }),
  },
  turbofan: {
    key: 'turbofan', name: 'Turbofan', category: 'Engines', tl: 7, source: 'SS7',
    loc: 'hull', core: false, he: 0,
    cost: (sm, tl, opts = {}) => costProgression(200e3)[idx(sm)] * (opts.afterburning ? 1.5 : 1),
    info: (sm, tl, opts = {}) => ({
      jetG: opts.afterburning ? 0.75 : 0.5,
      desc: `${opts.afterburning ? '0.5G (0.75G afterburning)' : '0.5G'} atmospheric; max 2,000 mph; jet-fuel tank per ${tl >= 8 ? '2 hours' : 'hour'}`,
    }),
  },
  fissionAirRam: {
    key: 'fissionAirRam', name: 'Fission air-ram', category: 'Engines', tl: 7, source: 'SS7/SS8',
    loc: 'rear', core: false, he: 0,
    cost: (sm) => costProgression(200e3)[idx(sm)] * 2,
    info: (sm, tl) => ({
      jetG: tlPick({ 7: 0.2, 8: 0.4, 9: 0.6 }, tl),
      desc: `${tlPick({ 7: 0.2, 8: 0.4, 9: 0.6 }, tl)}G atmospheric; 2 years internal nuclear fuel`,
      note: 'slightly radioactive exhaust',
    }),
  },
  fusionAirRam: {
    key: 'fusionAirRam', name: 'Fusion air-ram', category: 'Engines', tl: 10, source: 'SS7',
    loc: 'rear', core: false, he: 0,
    cost: (sm) => costProgression(200e3)[idx(sm)] * 5,
    info: () => ({ jetG: 0.2, desc: '0.2G atmospheric; 5 years internal fuel' }),
  },
  lightspeedDrive: {
    key: 'lightspeedDrive', name: 'Lightspeed drive', category: 'Engines', tl: 0, superscience: true, source: 'SS7',
    loc: 'any', core: true, he: 1,
    cost: (sm) => costProgression(300e3)[idx(sm)],
    info: (sm) => ({ ppNeed: 1, ws: WS_STD[idx(sm)], desc: 'instant lightspeed, straight-line; not FTL (real time passes)' }),
  },
  maneuverEnhancement: {
    key: 'maneuverEnhancement', name: 'Maneuver enhancement', category: 'Utility', tl: 6, source: 'SS7',
    loc: 'hull', core: false, he: 0,
    cost: (sm) => [50e3, 50e3, 150e3, 500e3, 1.5e6, 5e6, 15e6, 50e6, 150e6, 500e6, 1.5e9, 5e9][idx(sm)],
    info: () => ({ airHndBonus: 1, desc: '+1 air Handling' }),
  },
  maw: {
    key: 'maw', name: 'Maw', category: 'Weapons', tl: 8, source: 'SS7',
    loc: 'front', core: false, he: 0,
    cost: (sm, tl, opts = {}) => costProgression(30e3)[idx(sm)] * (opts.cutting ? 1.5 : 1),
    info: (sm, tl, opts = {}) => ({
      ws: WS_STD[idx(sm)],
      desc: `powered jaw (${opts.cutting ? 'cutting' : 'crushing'}); swallows prey into a bay/digester`,
    }),
  },
  ornithopterWings: {
    key: 'ornithopterWings', name: 'Ornithopter wings', category: 'Engines', tl: 5, source: 'SS7',
    loc: 'central', core: false, he: 1,
    cost: (sm) => [150e3, 150e3, 500e3, 1.5e6, 5e6, 15e6, 50e6, 150e6, 500e6, 1.5e9, 5e9, 15e9][idx(sm)],
    info: (sm) => ({
      ppNeed: 1, jetG: 0.25, airHndBonus: 1, airCap: 500, ws: WS_STD[idx(sm)],
      desc: '0.25G flapping flight (atmosphere only); +1 air Hnd; max 500 mph',
      note: 'requires the winged design feature; central hull only',
    }),
  },
  parachronicFlux: {
    key: 'parachronicFlux', name: 'Parachronic flux drive', category: 'Engines', tl: 0, superscience: true, source: 'SS7',
    loc: 'any', core: true, he: 2,
    cost: (sm, tl, opts = {}) => {
      let c = costProgression(600e3)[idx(sm)];
      if (opts.timeFlux) c *= 10;
      if (opts.anywhere) c *= 25;
      if (opts.speedLimited) c *= 0.5;
      return c;
    },
    info: (sm, tl, opts = {}) => ({
      ppNeed: 2, ws: WS_STD[idx(sm)],
      desc: `${opts.timeFlux ? 'time travel' : 'travel to parallel worlds'}${opts.anywhere ? ', anywhere/anywhen' : ''}${opts.speedLimited ? ' (speed-limited)' : ''}`,
    }),
  },
  radioisotopeSail: {
    key: 'radioisotopeSail', name: 'Radioisotope sail', category: 'Engines', tl: 7, source: 'SS7',
    loc: 'hull', core: false, he: 0, exposed: true,
    cost: (sm) => [500e3, 500e3, 1.5e6, 5e6, 15e6, 50e6, 150e6, 500e6, 1.5e9, 5e9, 15e9, 50e9][idx(sm)],
    info: () => ({ sail: true, accelG: 0.000001, desc: '0.000001G fission sail; thrust halves every 14 years' }),
  },
  tachyonSail: {
    key: 'tachyonSail', name: 'Tachyon sail', category: 'Engines', tl: 0, superscience: true, source: 'SS7',
    loc: 'hull', core: false, he: 0, exposed: true, maxSM: 12,
    cost: (sm, tl, opts = {}) => ([1.2e6, 1.2e6, 4e6, 12e6, 40e6, 120e6, 400e6, 1.2e9, 4e9][idx(sm)] ?? null) * (opts.hypersail ? 2 : 1),
    info: (sm, tl, opts = {}) => ({
      sail: true, accelG: 0.1, ftl: opts.hypersail ? 1 : 0,
      desc: `0.1G tachyon wind${opts.hypersail ? '; FTL-1 per 0.1G inside hyperspace (needs a stardrive to enter)' : ''}`,
    }),
  },
  sapientBrain: {
    key: 'sapientBrain', name: 'Sapient brain', category: 'Command', tl: 10, source: 'SS7',
    loc: 'any', core: true, he: 0,
    cost: (sm, tl, opts = {}) => [50e3, 50e3, 150e3, 500e3, 1.5e6, 5e6, 15e6, 50e6, 150e6, 500e6, 1.5e9, 5e9][idx(sm)] * (opts.psionic ? 4 : 1),
    info: (sm, tl, opts = {}) => ({
      arrayLevel: sm - 3, ws: WS_STD[idx(sm)],
      pp: opts.psionic ? 1 : 0, ppKind: opts.psionic ? 'psi' : 'normal',
      desc: `living ship brain (comm/sensor ${sm - 3}; DX 12, IQ 7)${opts.psionic ? '; 1 psi Power Point' : ''}`,
    }),
  },
  solarMirror: {
    key: 'solarMirror', name: 'Solar mirror', category: 'Power', tl: 5, source: 'SS7',
    loc: 'hull', core: false, he: 0, exposed: true,
    cost: (sm) => [10e3, 10e3, 30e3, 100e3, 300e3, 1e6, 3e6, 10e6, 30e6, 100e6, 300e6, 1e9][idx(sm)],
    info: () => ({ solarMirror: true, desc: 'feeds one solar boiler or solar thermal rocket; exposed' }),
  },
  tail: {
    key: 'tail', name: 'Tail', category: 'Weapons', tl: 8, source: 'SS7',
    loc: 'rear', core: false, he: 0,
    cost: (sm) => costProgression(60e3)[idx(sm)],
    info: (sm, tl, opts = {}) => ({
      ws: WS_STD[idx(sm)],
      desc: `${opts.tailType || 'striking'} tail (attacks to the rear)`,
    }),
  },
});

// --- SS8: Transhuman Spacecraft ---------------------------------------------
// (The fission air-ram and laser rocket are shared with SS7 above.)

// --- Design features from the supplements -----------------------------------

Object.assign(FEATURES, {
  // SS3 "Greater Survivability" switches (all free).
  advancedArmor: {
    name: 'Advanced armor (switch)', tl: 8, source: 'SS3',
    help: 'TL8+ armor is hardened free; bought hardening becomes double-hardening.',
  },
  damageReduction: {
    name: 'Damage Reduction 2 (switch)', tl: 7, source: 'SS3',
    help: 'Halve damage after dDR — a cinematic durability switch.',
  },
  missileShield: {
    name: 'Missile shield (switch)', tl: 7, source: 'SS3',
    help: 'Point-defense beams auto-kill incoming missiles up to their RoF.',
  },
  // SS4
  areaJammer: {
    name: 'Area jammer', tl: 7, source: 'SS4',
    help: 'Defensive ECM can jam for the whole formation at half effect.',
  },
  // SS7
  lacksAutomation: {
    name: 'Lacks automation', tl: 0, source: 'SS7', htBonus: 1,
    help: 'Victorian-style manual ship: crews everything by hand, +1 HT, needs a manned control room.',
  },
  nauticalLines: {
    name: 'Nautical lines', tl: 0, source: 'SS7', airMult: 0.2,
    help: 'Boat-shaped hull: streamlined, but top air speed ×0.2.',
  },
  ram: {
    name: 'Ram', tl: 0, source: 'SS7', ramFeature: true,
    help: 'Reinforced prow: double front dDR vs your own ramming attacks. Costs 50% of the front armor.',
  },
  openFrameArmor: {
    name: 'Open-frame armor', tl: 7, source: 'SS7',
    help: '4× dDR vs collisions only; no protection against weapons.',
  },
  psiShielding: {
    name: 'Psi shielding', tl: 0, source: 'SS7',
    cost: [500e3, 500e3, 1e6, 2e6, 5e6, 10e6, 20e6, 50e6, 100e6, 200e6, 500e6, 1e9],
    help: 'Ship-wide mind shield: +(TL-6) to resist telepathy and mind disruptors.',
  },
  hyperdynamicField: {
    name: 'Hyperdynamic field', tl: 0, source: 'SS7',
    cost: [500e3, 500e3, 1e6, 2e6, 5e6, 10e6, 20e6, 50e6, 100e6, 200e6, 500e6, 1e9],
    help: 'Superscience field: maneuver in space like a plane in air.',
  },
  realisticBiomorphics: {
    name: 'Realistic biomorphics', tl: 9, source: 'SS7',
    cost: [1e6, 1e6, 2e6, 5e6, 10e6, 20e6, 50e6, 100e6, 200e6, 500e6, 1e9, 2e9],
    help: 'Living-tissue skin over a creature-shaped hull (free if the ship IS a creature).',
  },
  energyPhasingSurface: {
    name: 'Energy-phasing surface', tl: 12, source: 'SS7',
    cost: [1e6, 1e6, 2e6, 5e6, 10e6, 20e6, 50e6, 100e6, 200e6, 500e6, 1e9, 2e9],
    help: 'Fixed beam weapons fire in any direction.',
  },
  regeneration: {
    name: 'Regeneration', tl: 0, source: 'SS7', costPerTon: 0.2e6,
    help: 'Living hull regrows 1% of dHP per minute ($0.2M/ton).',
  },
  selfHealing: {
    name: 'Self-healing / biomechanical self-repair', tl: 10, source: 'SS7/SS8', costPerTon: 0.02e6,
    help: 'Repairs 1% of dHP per day ($0.02M/ton). SS8 bioships pair it with organic armor + total automation.',
  },
  requiresNutrients: {
    name: 'Requires nutrients (bioship)', tl: 9, source: 'SS8',
    help: 'The ship must be fed (ST man-days of food per day) or it starves: -1 HT per day.',
  },
  advancedComputers: {
    name: 'Advanced computers (switch)', tl: 9, source: 'SS8',
    help: 'All computers count as one TL higher for Complexity (Transhuman Space default).',
  },
  telescopingArmLarge: {
    name: 'Telescoping robot arm (large)', tl: 9, source: 'SS8', flatCost: 280e3, minSM: 6,
    help: '19-foot ST 83 loading arm folded into the hull.',
  },
  telescopingArmMedium: {
    name: 'Telescoping robot arm (medium)', tl: 9, source: 'SS8', flatCost: 150e3, minSM: 6,
    help: '15-foot ST 66 loading arm.',
  },
  telescopingArmSmall: {
    name: 'Telescoping robot arm (small)', tl: 9, source: 'SS8', flatCost: 100e3, minSM: 5,
    help: '12-foot ST 53 loading arm.',
  },
  // SS6
  modularSystems: {
    name: 'Modular systems (switch)', tl: 7, source: 'SS6',
    help: 'Non-core systems built for swap-out: modular cargo holds $1K/ton, other modular systems 2× cost.',
  },
  // SS5
  smallUpperStage: {
    name: 'Small upper stage', tl: 7, source: 'SS5',
    help: 'A 2-slot upper stage in the front hull carrying a craft two SMs smaller.',
  },
});

export const BOOKS_LOADED = true;
