// ---------------------------------------------------------------------------
// GURPS Spaceships — system registry. Each system fills one slot (5% of
// loaded mass) and reads its function and cost from per-SM tables.
// info(sm, tl, opts) returns the slot's contribution; cost(sm, tl, opts) its $.
// ---------------------------------------------------------------------------

import { ARMORS, SMS, costProgression, smIndex } from './tables.js';

const idx = smIndex;
const tlPick = (table, tl) => {
  let best;
  for (const k of Object.keys(table)) {
    const key = Number(k);
    if (tl >= key && (best === undefined || key > best)) best = key;
  }
  return best === undefined ? null : table[best];
};

// Standard workspace progression (most systems).
const WS_STD = [0, 0, 0, 0, 0, 1, 3, 10, 30, 100, 300];

// Battery tables (per battery size): values indexed by SM.
const BATTERY = {
  major: {
    name: 'Major battery', weapons: 1, minSM: 5,
    dDam: ['4d', '6d', '2d×5', '3d×5', '4d×5', '6d×5', '4d×10', '6d×10', '2d×50', '3d×50', '2d×100'],
    output: ['10MJ', '30MJ', '100MJ', '300MJ', '1GJ', '3GJ', '10GJ', '30GJ', '100GJ', '300GJ', '1TJ'],
    gun: ['10cm', '12cm', '14cm', '16cm', '20cm', '24cm', '28cm', '32cm', '40cm', '48cm', '56cm'],
    launcher: ['20cm', '24cm', '28cm', '32cm', '40cm', '48cm', '56cm', '64cm', '80cm', '96cm', '112cm'],
    uninstalled: [0.5, 1.5, 5, 15, 50, 150, 500, 1500, 5000, 15000, 50000],
    cost: [150e3, 600e3, 1.5e6, 6e6, 15e6, 60e6, 150e6, 600e6, 1.5e9, 6e9, 15e9],
    ws: WS_STD,
  },
  medium: {
    name: 'Medium battery', weapons: 3, minSM: 5,
    dDam: ['3d', '4d', '6d', '2d×5', '3d×5', '4d×5', '6d×5', '4d×10', '6d×10', '2d×50', '3d×50'],
    output: ['3MJ', '10MJ', '30MJ', '100MJ', '300MJ', '1GJ', '3GJ', '10GJ', '30GJ', '100GJ', '300GJ'],
    gun: ['8cm', '10cm', '12cm', '14cm', '16cm', '20cm', '24cm', '28cm', '32cm', '40cm', '48cm'],
    launcher: ['16cm', '20cm', '24cm', '28cm', '32cm', '40cm', '48cm', '56cm', '64cm', '80cm', '96cm'],
    uninstalled: [0.5, 1.5, 5, 15, 50, 150, 500, 1500, 5000, 15000, 50000],
    cost: [150e3, 600e3, 1.5e6, 6e6, 15e6, 60e6, 150e6, 600e6, 1.5e9, 6e9, 15e9],
    ws: WS_STD,
  },
  secondary: {
    name: 'Secondary battery', weapons: 10, minSM: 6,
    dDam: [null, '3d', '4d', '6d', '2d×5', '3d×5', '4d×5', '6d×5', '4d×10', '6d×10', '2d×50'],
    output: [null, '3MJ', '10MJ', '30MJ', '100MJ', '300MJ', '1GJ', '3GJ', '10GJ', '30GJ', '100GJ'],
    gun: [null, '8cm', '10cm', '12cm', '14cm', '16cm', '20cm', '24cm', '28cm', '32cm', '40cm'],
    launcher: [null, '16cm', '20cm', '24cm', '28cm', '32cm', '40cm', '48cm', '56cm', '64cm', '80cm'],
    uninstalled: [null, 0.5, 1.5, 5, 15, 50, 150, 500, 1500, 5000, 15000],
    cost: [null, 600e3, 1.5e6, 6e6, 15e6, 60e6, 150e6, 600e6, 1.5e9, 6e9, 15e9],
    ws: WS_STD,
  },
  tertiary: {
    name: 'Tertiary battery', weapons: 30, minSM: 7,
    dDam: [null, null, '3d', '4d', '6d', '2d×5', '3d×5', '4d×5', '6d×5', '4d×10', '6d×10'],
    output: [null, null, '3MJ', '10MJ', '30MJ', '100MJ', '300MJ', '1GJ', '3GJ', '10GJ', '30GJ'],
    gun: [null, null, '8cm', '10cm', '12cm', '14cm', '16cm', '20cm', '24cm', '28cm', '32cm'],
    launcher: [null, null, '16cm', '20cm', '24cm', '28cm', '32cm', '40cm', '48cm', '56cm', '64cm'],
    uninstalled: [null, null, 0.5, 1.5, 5, 15, 50, 150, 500, 1500, 5000],
    cost: [null, null, 1.5e6, 6e6, 15e6, 60e6, 150e6, 600e6, 1.5e9, 6e9, 15e9],
    ws: WS_STD,
  },
};

// Engine catalog: accelG / dvPerTank may vary by TL.
const ENGINES = {
  chemRocket: { name: 'Chemical rocket', tl: 7, he: 0, accel: () => 3, dv: () => 0.15, fuel: 'rocket fuel', costBase: 60e3 },
  hedmRocket: { name: 'HEDM rocket', tl: 9, he: 0, accel: () => 2, dv: () => 0.5, fuel: 'HEDM fuel', costBase: 60e3, costMult: 1.5, note: 'volatile' },
  ionDrive: { name: 'Ion drive', tl: 8, he: 1, accel: () => 0.0005, dv: () => 3, fuel: 'ionizable mass', costBase: 100e3 },
  massDriver: { name: 'Mass driver', tl: 9, he: 1, accel: () => 0.01, dv: () => 0.3, fuel: 'rock dust (or cargo!)', costBase: 100e3 },
  ntr: { name: 'Nuclear thermal rocket', tl: 7, he: 0, accel: (tl) => tlPick({ 7: 0.1, 8: 0.2, 9: 0.5 }, tl), dv: () => 0.3, fuel: 'hydrogen', costBase: 150e3 },
  nuclearLightBulb: { name: 'Nuclear light bulb', tl: 9, he: 0, accel: (tl) => tl >= 10 ? 0.05 : 0.01, dv: () => 0.8, fuel: 'hydrogen', costBase: 150e3 },
  nswr: { name: 'Nuclear saltwater rocket', tl: 9, ss: true, he: 0, accel: () => 2, dv: () => 2.5, fuel: 'uranium saltwater', costBase: 150e3, note: 'volatile; limited superscience' },
  orion: { name: 'Nuclear pulse (Orion)', tl: 7, he: 0, accel: () => 2, dv: (tl) => tlPick({ 7: 2, 8: 3, 9: 4, 10: 8 }, tl), fuel: 'bomb pulse units', costBase: 300e3, note: 'rear dDR 50+ (or dDR 5 + magsail) required' },
  fusionPulse: { name: 'Fusion pulse drive', tl: 9, he: 0, accel: (tl) => tl >= 10 ? 0.05 : 0.02, dv: (tl) => tlPick({ 9: 5, 10: 10, 11: 40 }, tl), fuel: 'fuel pellets', costBase: 300e3 },
  advFusionPulse: { name: 'Advanced fusion pulse', tl: 9, he: 0, accel: () => 0.005, dv: (tl) => tlPick({ 9: 20, 10: 100, 11: 350 }, tl), fuel: 'fuel pellets', costBase: 300e3, costMult: 2 },
  superFusionPulse: { name: 'Super fusion pulse', tl: 11, ss: true, he: 0, accel: (tl) => tl >= 12 ? 100 : 20, dv: () => 350, fuel: 'fuel pellets', costBase: 300e3, costMult: 4 },
  fusionRocket: { name: 'Fusion rocket', tl: 9, he: 0, accel: () => 0.005, dv: (tl) => tlPick({ 9: 12, 10: 60, 11: 180, 12: 450 }, tl), fuel: 'hydrogen', costBase: 300e3, minSMAtTL9: 9 },
  fusionTorch: { name: 'Fusion torch', tl: 10, ss: true, he: 0, accel: () => 0.5, dv: (tl) => tlPick({ 10: 15, 11: 45, 12: 150 }, tl), fuel: 'hydrogen', costBase: 300e3, costMult: 2 },
  superFusionTorch: { name: 'Super fusion torch', tl: 11, ss: true, he: 0, accel: () => 50, dv: () => 450, fuel: 'hydrogen', costBase: 300e3, costMult: 4 },
  amThermal: { name: 'Antimatter thermal rocket', tl: 9, he: 0, accel: (tl) => tlPick({ 9: 0.1, 10: 0.2, 11: 0.4 }, tl), dv: () => 1.8, fuel: 'antimatter-catalyzed H', costBase: 150e3 },
  amPlasma: { name: 'Antimatter plasma rocket', tl: 10, he: 0, accel: () => 0.01, dv: (tl) => tl >= 11 ? 360 : 120, fuel: 'antimatter-boosted H', costBase: 150e3 },
  amPlasmaTorch: { name: 'Antimatter plasma torch', tl: 10, ss: true, he: 0, accel: () => 1, dv: (tl) => tl >= 11 ? 360 : 120, fuel: 'antimatter-boosted H', costBase: 150e3, costMult: 2 },
  superAmPlasmaTorch: { name: 'Super antimatter plasma torch', tl: 11, ss: true, he: 0, accel: () => 100, dv: () => 360, fuel: 'antimatter-boosted H', costBase: 150e3, costMult: 4 },
  amPion: { name: 'Antimatter pion drive', tl: 11, he: 0, accel: () => 0.005, dv: () => 3400, fuel: 'matter/antimatter', costBase: 150e3, costMult: 2 },
  amPionTorch: { name: 'Antimatter pion torch', tl: 11, ss: true, he: 0, accel: () => 0.1, dv: () => 3400, fuel: 'matter/antimatter', costBase: 150e3, costMult: 4 },
  tcTorch: { name: 'Total conversion torch', tl: 12, ss: true, he: 0, accel: () => 1, dv: () => 10000, fuel: 'anything', costBase: 150e3, costMult: 4 },
  superTcTorch: { name: 'Super conversion torch', tl: 12, ss: true, he: 0, accel: () => 50, dv: () => 10000, fuel: 'anything', costBase: 150e3, costMult: 10 },
  rotaryReactionless: { name: 'Rotary reactionless engine', tl: 7, ss: true, he: 1, reactionless: true, accel: () => 0.1, costBase: 15e3 },
  standardReactionless: { name: 'Standard reactionless engine', tl: 10, ss: true, he: 1, reactionless: true, accel: (tl) => tl >= 11 ? 1 : 0.5, costBase: 30e3 },
  hotReactionless: { name: 'Hot reactionless engine', tl: 10, ss: true, he: 1, reactionless: true, accel: (tl) => tl >= 11 ? 2 : 1, costBase: 100e3 },
  superReactionless: { name: 'Super reactionless engine', tl: 11, ss: true, he: 1, reactionless: true, accel: (tl) => tl >= 12 ? 100 : 50, costBase: 200e3 },
  subwarp: { name: 'Subwarp engine', tl: 10, ss: true, he: 1, reactionless: true, accel: () => 500, costBase: 300e3 },
};

function makeEngine(key, e) {
  return {
    key, name: e.name, category: 'Engines', tl: e.tl, superscience: !!e.ss,
    loc: 'rear', core: false, he: e.he,
    cost: (sm) => costProgression(e.costBase)[idx(sm)] * (e.costMult || 1),
    info: (sm, tl) => ({
      engine: true,
      reactionless: !!e.reactionless,
      accelG: e.accel(tl),
      dvPerTank: e.dv ? e.dv(tl) : null,
      fuel: e.fuel || null,
      ppNeed: e.he,
      desc: e.reactionless
        ? `${e.accel(tl)}G reactionless`
        : `${e.accel(tl)}G; ${e.dv(tl)} mps per tank of ${e.fuel}`,
      note: e.note,
    }),
  };
}

// Power plants.
const PLANTS = {
  fuelCell: { name: 'Fuel cell', tl: 7, pp: 1, endurance: (tl) => `${tlPick({ 7: 3, 8: 6, 9: 12, 10: 24 }, tl)} hr internal fuel`, costBase: 15e3 },
  mhdTurbine: { name: 'MHD turbine', tl: 9, pp: 2, endurance: (tl) => `${tl >= 10 ? 12 : 6} hr internal fuel`, costBase: 15e3, costMult: 2 },
  fissionReactor: { name: 'Fission reactor', tl: 8, pp: 1, endurance: (tl) => `${tlPick({ 8: 25, 9: 50, 10: 75 }, tl)} yr`, costBase: 100e3 },
  fusionReactor: { name: 'Fusion reactor', tl: 9, pp: 2, endurance: (tl) => `${tlPick({ 9: 50, 10: 200, 11: 600, 12: 1500 }, tl)} yr`, costBase: 300e3, minSMAtTL9: 10 },
  antimatterReactor: { name: 'Antimatter reactor', tl: 10, pp: 4, endurance: (tl) => `${tlPick({ 10: 2, 11: 20, 12: 200 }, tl)} yr`, costBase: 600e3, note: 'volatile' },
  superFusionReactor: { name: 'Super fusion reactor', tl: 11, pp: 4, endurance: (tl) => `${tl >= 12 ? 1000 : 400} yr`, costBase: 1e6 },
  tcReactor: { name: 'Total conversion reactor', tl: 12, ss: true, pp: 5, endurance: () => 'unlimited', costBase: 2e6 },
};

function makePlant(key, p) {
  return {
    key, name: p.name, category: 'Power', tl: p.tl, superscience: !!p.ss,
    loc: 'any', core: true, he: 0,
    cost: (sm) => costProgression(p.costBase)[idx(sm)] * (p.costMult || 1),
    info: (sm, tl) => ({
      pp: p.pp,
      desc: `${p.pp} Power Point${p.pp > 1 ? 's' : ''}; ${p.endurance(tl)}`,
      note: p.note,
    }),
  };
}

// --- The registry ----------------------------------------------------------
export const SYSTEMS = {};

// Armor systems from the armor tables.
for (const [key, a] of Object.entries(ARMORS)) {
  SYSTEMS[`armor_${key}`] = {
    key: `armor_${key}`, name: a.name, category: 'Armor', tl: a.tl,
    loc: 'hull', core: false, he: 0,
    cost: (sm) => a.cost[idx(sm)] ?? 0,
    info: (sm, tl, opts, ctx) => {
      const ddr = ctx?.streamlined ? (a.sl ? a.sl[idx(sm)] : null) : a.us[idx(sm)];
      return {
        armorDDR: ddr,
        desc: ddr === null ? 'unavailable at this SM/streamlining' : `dDR ${ddr}`,
        note: a.note,
        invalid: ddr === null,
      };
    },
  };
}

for (const [key, e] of Object.entries(ENGINES)) SYSTEMS[key] = makeEngine(key, e);
for (const [key, p] of Object.entries(PLANTS)) SYSTEMS[key] = makePlant(key, p);

Object.assign(SYSTEMS, {
  fuelTank: {
    key: 'fuelTank', name: 'Fuel tank', category: 'Engines', tl: 7,
    loc: 'any', core: true, he: 0,
    cost: (sm) => [10e3, 30e3, 100e3, 300e3, 1e6, 3e6, 10e6, 30e6, 100e6, 300e6, 1e9][idx(sm)],
    info: (sm) => {
      const tons = [1.5, 5, 15, 50, 150, 500, 1500, 5000, 15000, 50000, 150000][idx(sm)];
      return { fuelTank: true, fuelTons: tons, desc: `${tons} tons of fuel` };
    },
  },
  cargoHold: {
    key: 'cargoHold', name: 'Cargo hold', category: 'Payload', tl: 0,
    loc: 'any', core: true, he: 0,
    cost: () => 0,
    info: (sm) => {
      const tons = [1.5, 5, 15, 50, 150, 500, 1500, 5000, 15000, 50000, 150000][idx(sm)];
      return { cargoTons: tons, desc: `${tons} tons capacity` };
    },
  },
  controlRoom: {
    key: 'controlRoom', name: 'Control room', category: 'Command', tl: 7,
    loc: 'any', core: true, he: 0,
    cost: (sm) => costProgression(60e3)[idx(sm)],
    info: (sm, tl) => {
      const complexity = [6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11][idx(sm)] + (tlPick({ 7: -6, 8: -4, 9: -2, 10: 0, 11: 1, 12: 2 }, tl) ?? 0);
      const stations = [1, 2, 3, 4, 6, 10, 15, 20, 30, 40, 60][idx(sm)];
      const array = tl - 10 + [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14][idx(sm)];
      return {
        controlStations: stations, complexity, arrayLevel: array, ws: WS_STD[idx(sm)],
        desc: `${stations} control stations; Complexity ${complexity}; comm/sensor ${array}`,
      };
    },
  },
  engineRoom: {
    key: 'engineRoom', name: 'Engine room', category: 'Command', tl: 7,
    loc: 'any', core: true, he: 0, maxSM: 9,
    cost: (sm) => [15e3, 30e3, 100e3, 300e3, 1e6][idx(sm)] ?? 0,
    info: (sm) => ({
      ws: sm === 9 ? 2 : 1, controlStations: 1, engineRoom: true,
      desc: `${sm === 9 ? 2 : 1} workspace(s) + control station`,
    }),
  },
  habitat: {
    key: 'habitat', name: 'Habitat', category: 'Habitats', tl: 7,
    loc: 'any', core: true, he: 0, minSM: 6,
    cost: (sm) => [null, 100e3, 300e3, 1e6, 3e6, 10e6, 30e6, 100e6, 300e6, 1e9, 3e9][idx(sm)] ?? 0,
    // opts: cabins may be exchanged — luxury (2 cabins each), bunkroom/cell
    // (1:1, sleeps 4), sickbay beds (1 each), steerage (1 each, 5 tons cargo).
    info: (sm, tl, opts = {}) => {
      const total = [null, 1, 2, 6, 20, 60, 200, 600, 2000, 6000, 20000][idx(sm)];
      const luxury = opts.luxury || 0;
      const bunkrooms = opts.bunkrooms || 0;
      const cells = opts.cells || 0;
      const sickbay = opts.sickbay || 0;
      const steerage = opts.steerage || 0;
      const used = luxury * 2 + bunkrooms + cells + sickbay + steerage;
      const plain = total - used;
      if (plain < 0) {
        return { invalid: true, desc: `conversions need ${used} cabins but the habitat only has ${total}` };
      }
      const sleeps = plain * 2 + luxury * 2 + bunkrooms * 4 + cells * 4;
      const parts = [`${plain} cabin${plain === 1 ? '' : 's'}`];
      if (luxury) parts.push(`${luxury} luxury cabin${luxury === 1 ? '' : 's'}`);
      if (bunkrooms) parts.push(`${bunkrooms} bunkroom${bunkrooms === 1 ? '' : 's'}`);
      if (cells) parts.push(`${cells} cell${cells === 1 ? '' : 's'}`);
      if (sickbay) parts.push(`${sickbay}-bed sickbay`);
      if (steerage) parts.push(`${steerage * 5} tons steerage cargo`);
      return {
        cabins: plain + luxury, sleeps, cargoTons: steerage * 5,
        ws: WS_STD[idx(sm)], desc: parts.join(', '),
      };
    },
  },
  passengerSeating: {
    key: 'passengerSeating', name: 'Passenger seating', category: 'Habitats', tl: 7,
    loc: 'any', core: true, he: 0,
    cost: (sm) => [10e3, 30e3, 100e3, 300e3, 1e6, 3e6, 10e6, 30e6, 100e6, 300e6, 1e9][idx(sm)],
    info: (sm) => {
      const seats = [2, 6, 20, 60, 200, 600, 2000, 6000, 20000, 60000, 200000][idx(sm)];
      return { seats, desc: `${seats} seats` };
    },
  },
  openSpace: {
    key: 'openSpace', name: 'Open space', category: 'Habitats', tl: 7,
    loc: 'any', core: true, he: 0, minSM: 8,
    cost: (sm) => [null, null, null, 100e3, 200e3, 500e3, 1e6, 2e6, 5e6, 10e6, 20e6][idx(sm)] ?? 0,
    info: (sm) => {
      const areas = [null, null, null, 1, 2, 5, 10, 20, 50, 100, 200][idx(sm)];
      return { openAreas: areas, ws: [0, 0, 0, 0, 0, 1, 3, 10, 30, 100, 300][idx(sm)], desc: `${areas} area(s), 100 people each` };
    },
  },
  hangarBay: {
    key: 'hangarBay', name: 'Hangar bay', category: 'Payload', tl: 7,
    loc: 'hull', core: false, he: 0,
    cost: (sm) => [3e3, 10e3, 30e3, 100e3, 300e3, 1e6, 3e6, 10e6, 30e6, 100e6, 300e6][idx(sm)],
    info: (sm) => {
      const tons = [1, 3, 10, 30, 100, 300, 1000, 3000, 10000, 30000, 100000][idx(sm)];
      const rate = [1, 3, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000][idx(sm)];
      return { hangarTons: tons, ws: WS_STD[idx(sm)], desc: `${tons} tons craft; launch ${rate} t/min` };
    },
  },
  enhancedArray: {
    key: 'enhancedArray', name: 'Enhanced comm/sensor array', category: 'Command', tl: 7,
    loc: 'hull', core: false, he: 0, arrayMult: 1,
    cost: (sm) => costProgression(60e3)[idx(sm)],
    info: (sm, tl) => {
      const level = tl - 10 + [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16][idx(sm)];
      return { arrayLevel: level, ws: WS_STD[idx(sm)], desc: `comm/sensor Level ${level}` };
    },
  },
  tacticalArray: {
    key: 'tacticalArray', name: 'Tactical comm/sensor array', category: 'Command', tl: 7,
    loc: 'hull', core: false, he: 0,
    cost: (sm) => costProgression(60e3)[idx(sm)] * 5,
    info: (sm, tl) => {
      const level = tl - 10 + [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16][idx(sm)];
      return { arrayLevel: level, ws: WS_STD[idx(sm)], desc: `Level ${level}; negates ECM array penalty` };
    },
  },
  scienceArray: {
    key: 'scienceArray', name: 'Science comm/sensor array', category: 'Command', tl: 7,
    loc: 'hull', core: false, he: 0,
    cost: (sm) => costProgression(60e3)[idx(sm)] * 5,
    info: (sm, tl) => {
      const level = tl - 10 + [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16][idx(sm)];
      return { arrayLevel: level, ws: WS_STD[idx(sm)], desc: `Level ${level}; survey instruments` };
    },
  },
  multipurposeArray: {
    key: 'multipurposeArray', name: 'Multipurpose comm/sensor array', category: 'Command', tl: 7,
    loc: 'hull', core: false, he: 0,
    cost: (sm) => costProgression(60e3)[idx(sm)] * 10,
    info: (sm, tl) => {
      const level = tl - 10 + [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16][idx(sm)];
      return { arrayLevel: level, ws: WS_STD[idx(sm)], desc: `Level ${level}; tactical + science` };
    },
  },
  defensiveECM: {
    key: 'defensiveECM', name: 'Defensive ECM', category: 'Defenses', tl: 7,
    loc: 'any', core: true, he: 0,
    cost: (sm) => costProgression(300e3)[idx(sm)],
    info: () => ({ ecm: 1, desc: '-2 to be hit (+1 Dodge); max 3' }),
  },
  forceScreenLight: {
    key: 'forceScreenLight', name: 'Light force screen', category: 'Defenses', tl: 11, superscience: true,
    loc: 'any', core: true, he: 1,
    cost: (sm) => [500e3, 1.5e6, 5e6, 15e6, 50e6, 150e6, 500e6, 1.5e9, 5e9, 15e9, 50e9][idx(sm)],
    info: (sm, tl) => {
      const ddr = (tl >= 12 ? [30, 50, 70, 100, 150, 200, 300, 500, 700, 1000, 1500] : [20, 30, 50, 70, 100, 150, 200, 300, 500, 700, 1000])[idx(sm)];
      return { screenDDR: ddr, ppNeed: 1, desc: `screen dDR ${ddr} (all sections)` };
    },
  },
  forceScreenHeavy: {
    key: 'forceScreenHeavy', name: 'Heavy force screen', category: 'Defenses', tl: 11, superscience: true,
    loc: 'any', core: true, he: 1,
    cost: (sm) => [1.5e6, 5e6, 15e6, 50e6, 150e6, 500e6, 1.5e9, 5e9, 15e9, 50e9, 150e9][idx(sm)],
    info: (sm, tl) => {
      const ddr = (tl >= 12 ? [30, 50, 70, 100, 150, 200, 300, 500, 700, 1000, 1500] : [20, 30, 50, 70, 100, 150, 200, 300, 500, 700, 1000])[idx(sm)];
      return { screenDDR: ddr, ppNeed: 1, desc: `screen dDR ${ddr}; second PP doubles it` };
    },
  },
  cloakingDevice: {
    key: 'cloakingDevice', name: 'Cloaking device', category: 'Defenses', tl: 10, superscience: true,
    loc: 'any', core: true, he: 1,
    cost: (sm) => costProgression(1e6)[idx(sm)],
    info: () => ({ ppNeed: 1, desc: '-10 to be detected' }),
  },
  contragravLifter: {
    key: 'contragravLifter', name: 'Contragravity lifter', category: 'Engines', tl: 9, superscience: true,
    loc: 'any', core: true, he: 1,
    cost: (sm) => costProgression(300e3)[idx(sm)],
    info: () => ({ contragrav: true, ppNeed: 1, desc: 'nullifies up to 10G for landing/hover' }),
  },
  stardrive: {
    key: 'stardrive', name: 'Stardrive engine', category: 'Engines', tl: 10, superscience: true,
    loc: 'any', core: true, he: 1,
    cost: (sm) => costProgression(300e3)[idx(sm)],
    info: () => ({ ftl: 1, ppNeed: 1, desc: 'FTL-1' }),
  },
  superStardrive: {
    key: 'superStardrive', name: 'Super stardrive engine', category: 'Engines', tl: 10, superscience: true,
    loc: 'any', core: true, he: 2,
    cost: (sm) => costProgression(300e3)[idx(sm)] * 5,
    info: () => ({ ftl: 2, ppNeed: 2, desc: 'FTL-2 (or FTL-1 on 1 PP)' }),
  },
  ramscoop: {
    key: 'ramscoop', name: 'Ramscoop', category: 'Engines', tl: 10,
    loc: 'front', core: false, he: 0,
    cost: (sm) => costProgression(3e6)[idx(sm)],
    info: () => ({ desc: 'unlimited reaction mass for one drive at 1,800+ mps', ws: 0 }),
  },
  jetEngine: {
    key: 'jetEngine', name: 'Jet engine', category: 'Engines', tl: 7,
    loc: 'rear', core: false, he: 0,
    cost: (sm) => costProgression(300e3)[idx(sm)],
    info: (sm, tl) => ({ jetG: 1, desc: `1G atmospheric; one jet-fuel tank per ${tl >= 8 ? 'hour' : 'half-hour'}` }),
  },
  solarPanel: {
    key: 'solarPanel', name: 'Solar panel array', category: 'Power', tl: 7,
    loc: 'hull', core: false, he: 0, exposed: true,
    cost: (sm) => costProgression(150e3)[idx(sm)],
    info: () => ({ pp: 1, desc: '1 Power Point in sunlight; exposed' }),
  },
  lightsail: {
    key: 'lightsail', name: 'Lightsail', category: 'Engines', tl: 9,
    loc: 'hull', core: false, he: 0, exposed: true, maxSM: 12,
    cost: (sm) => costProgression(300e3)[idx(sm)],
    info: () => ({ sail: true, accelG: 0.0001, desc: '0.0001G at 1 AU; exposed' }),
  },
  magsail: {
    key: 'magsail', name: 'Magsail', category: 'Engines', tl: 9,
    loc: 'hull', core: false, he: 0, exposed: true, maxSM: 12,
    cost: (sm) => costProgression(300e3)[idx(sm)],
    info: () => ({ sail: true, accelG: 0.001, desc: '0.001G; max 375 mps; exposed' }),
  },
  factory: {
    key: 'factory', name: 'Factory', category: 'Utility', tl: 8,
    loc: 'any', core: true, he: 1, minSM: 6,
    cost: (sm) => [null, 5e6, 15e6, 50e6, 150e6, 500e6, 1.5e9, 5e9, 15e9, 50e9, 150e9][idx(sm)] ?? 0,
    info: (sm) => {
      const rate = [null, 5e3, 15e3, 50e3, 150e3, 500e3, 1.5e6, 5e6, 15e6, 50e6, 150e6][idx(sm)];
      return { ppNeed: 1, ws: [0, 0, 0, 0, 0, 1, 3, 10, 30, 100, 300][idx(sm)], desc: `produces $${(rate / 1000).toLocaleString('en-US')}K/hr of goods` };
    },
  },
  miningRefinery: {
    key: 'miningRefinery', name: 'Mining & refinery', category: 'Utility', tl: 7,
    loc: 'any', core: true, he: 1,
    cost: (sm) => costProgression(30e3)[idx(sm)],
    info: (sm) => {
      const mine = [0.15, 0.5, 1.5, 5, 15, 50, 150, 500, 1500, 5000, 15000][idx(sm)];
      return { ppNeed: 1, ws: WS_STD[idx(sm)], desc: `mines ${mine} t/hr (refines 3×)` };
    },
  },
  externalClamp: {
    key: 'externalClamp', name: 'External clamp', category: 'Utility', tl: 7,
    loc: 'hull', core: false, he: 0,
    cost: (sm) => [3e3, 10e3, 30e3, 100e3, 300e3, 1e6, 3e6, 10e6, 30e6, 100e6, 300e6][idx(sm)],
    info: () => ({ desc: 'grapples/tows external loads' }),
  },
  robotArm: {
    key: 'robotArm', name: 'Robot arm', category: 'Utility', tl: 8,
    loc: 'hull', core: false, he: 0,
    cost: (sm) => costProgression(300e3)[idx(sm)],
    info: () => ({ ws: 0, desc: 'manipulator arm; doubles as clamp' }),
  },
  softLanding: {
    key: 'softLanding', name: 'Soft-landing system', category: 'Utility', tl: 7,
    loc: 'hull', core: false, he: 0,
    cost: (sm) => [50e3, 100e3, 200e3, 500e3, 1e6, 2e6, 5e6, 10e6, 20e6, 50e6, 100e6][idx(sm)],
    info: () => ({ desc: 'one-shot parachutes/airbags' }),
  },
  jumpGate: {
    key: 'jumpGate', name: 'Jump gate', category: 'Utility', tl: 10, superscience: true,
    loc: 'hull', core: false, he: 1, minSM: 9,
    cost: (sm) => [null, null, null, null, 150e6, 500e6, 1.5e9, 5e9, 15e9, 50e9, 150e9][idx(sm)] ?? 0,
    info: (sm) => {
      const tons = [null, null, null, null, 100, 300, 1000, 3000, 10000, 30000, 100000][idx(sm)];
      return { ppNeed: 1, ws: [0, 0, 0, 0, 0, 1, 3, 10, 30, 100, 300][idx(sm)], desc: `gates ${tons} tons at once` };
    },
  },
  stasisWeb: {
    key: 'stasisWeb', name: 'Stasis web', category: 'Defenses', tl: 12, superscience: true,
    loc: 'any', core: true, he: 1,
    cost: (sm) => [2e6, 5e6, 10e6, 20e6, 50e6, 100e6, 200e6, 500e6, 1e9, 2e9, 5e9][idx(sm)],
    info: () => ({ ppNeed: 1, desc: 'invulnerable but inert while active' }),
  },
});

// Weapon batteries.
for (const [key, b] of Object.entries(BATTERY)) {
  SYSTEMS[`battery_${key}`] = {
    key: `battery_${key}`, name: b.name, category: 'Weapons', tl: 7,
    loc: 'hull', core: false, he: 1, minSM: b.minSM,
    battery: true,
    cost: (sm, tl, opts = {}) => {
      const full = b.cost[idx(sm)];
      if (full === null) return 0;
      const n = Math.min(Math.max(opts.count || b.weapons, 1), b.weapons);
      return full * (n / b.weapons);
    },
    info: (sm, tl, opts = {}) => {
      const i = idx(sm);
      if (b.dDam[i] === null) return { invalid: true, desc: 'not available at this SM' };
      const n = Math.min(Math.max(opts.count || b.weapons, 1), b.weapons);
      const type = opts.weaponType || 'beam';
      const mount = opts.mount || 'turret';
      const freed = (b.weapons - n) * b.uninstalled[i];
      const armament = type === 'gun' ? `${b.gun[i]} gun` : type === 'missile' ? `${b.launcher[i]} launcher` : `${b.output[i]} beam (${b.dDam[i]})`;
      return {
        weapons: n, turrets: mount === 'turret' ? n : 0,
        spareCargo: freed,
        ppNeed: type === 'beam' ? 1 : 0,
        ws: b.ws[i] ?? 0,
        desc: `${n}× ${armament} in ${mount}s${freed ? `; ${freed} tons spare cargo` : ''}`,
      };
    },
  };
}

export const SYSTEM_LIST = Object.values(SYSTEMS);
export const SYSTEM_CATEGORIES = [...new Set(SYSTEM_LIST.map((s) => s.category))];
