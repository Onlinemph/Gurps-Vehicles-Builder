// ---------------------------------------------------------------------------
// GURPS Spaceships — system registry (SS1 core set). Each system fills one
// slot (5% of loaded mass) and reads its function and cost from per-SM
// tables. info(sm, tl, opts, ctx) returns the slot's contribution;
// cost(sm, tl, opts) its $. All per-SM arrays run SM +4..+15.
// Systems from later books are registered by systems-books.js.
// ---------------------------------------------------------------------------

import { ARMORS, SMS, costProgression, smIndex } from './tables.js';

export const idx = smIndex;
export const tlPick = (table, tl) => {
  let best;
  for (const k of Object.keys(table)) {
    const key = Number(k);
    if (tl >= key && (best === undefined || key > best)) best = key;
  }
  return best === undefined ? null : table[best];
};

// Standard workspace progression (most systems). SM+4 systems have none.
export const WS_STD = [0, 0, 0, 0, 0, 0, 1, 3, 10, 30, 100, 300];

// Battery tables (per battery size): values indexed by SM (+4..+15).
// SM+4 columns (major and spinal only) are from SS4.
const BATTERY = {
  major: {
    name: 'Major battery', weapons: 1, minSM: 4,
    dDam: ['3d', '4d', '6d', '2d×5', '3d×5', '4d×5', '6d×5', '4d×10', '6d×10', '2d×50', '3d×50', '2d×100'],
    output: ['3MJ', '10MJ', '30MJ', '100MJ', '300MJ', '1GJ', '3GJ', '10GJ', '30GJ', '100GJ', '300GJ', '1TJ'],
    gun: ['8cm', '10cm', '12cm', '14cm', '16cm', '20cm', '24cm', '28cm', '32cm', '40cm', '48cm', '56cm'],
    launcher: ['16cm', '20cm', '24cm', '28cm', '32cm', '40cm', '48cm', '56cm', '64cm', '80cm', '96cm', '112cm'],
    uninstalled: [0.15, 0.5, 1.5, 5, 15, 50, 150, 500, 1500, 5000, 15000, 50000],
    cost: [100e3, 150e3, 600e3, 1.5e6, 6e6, 15e6, 60e6, 150e6, 600e6, 1.5e9, 6e9, 15e9],
    ws: WS_STD,
  },
  medium: {
    name: 'Medium battery', weapons: 3, minSM: 5,
    dDam: [null, '3d', '4d', '6d', '2d×5', '3d×5', '4d×5', '6d×5', '4d×10', '6d×10', '2d×50', '3d×50'],
    output: [null, '3MJ', '10MJ', '30MJ', '100MJ', '300MJ', '1GJ', '3GJ', '10GJ', '30GJ', '100GJ', '300GJ'],
    gun: [null, '8cm', '10cm', '12cm', '14cm', '16cm', '20cm', '24cm', '28cm', '32cm', '40cm', '48cm'],
    launcher: [null, '16cm', '20cm', '24cm', '28cm', '32cm', '40cm', '48cm', '56cm', '64cm', '80cm', '96cm'],
    uninstalled: [null, 0.5, 1.5, 5, 15, 50, 150, 500, 1500, 5000, 15000, 50000],
    cost: [null, 150e3, 600e3, 1.5e6, 6e6, 15e6, 60e6, 150e6, 600e6, 1.5e9, 6e9, 15e9],
    ws: WS_STD,
  },
  secondary: {
    name: 'Secondary battery', weapons: 10, minSM: 6,
    dDam: [null, null, '3d', '4d', '6d', '2d×5', '3d×5', '4d×5', '6d×5', '4d×10', '6d×10', '2d×50'],
    output: [null, null, '3MJ', '10MJ', '30MJ', '100MJ', '300MJ', '1GJ', '3GJ', '10GJ', '30GJ', '100GJ'],
    gun: [null, null, '8cm', '10cm', '12cm', '14cm', '16cm', '20cm', '24cm', '28cm', '32cm', '40cm'],
    launcher: [null, null, '16cm', '20cm', '24cm', '28cm', '32cm', '40cm', '48cm', '56cm', '64cm', '80cm'],
    uninstalled: [null, null, 0.5, 1.5, 5, 15, 50, 150, 500, 1500, 5000, 15000],
    cost: [null, null, 600e3, 1.5e6, 6e6, 15e6, 60e6, 150e6, 600e6, 1.5e9, 6e9, 15e9],
    ws: WS_STD,
  },
  tertiary: {
    name: 'Tertiary battery', weapons: 30, minSM: 7,
    dDam: [null, null, null, '3d', '4d', '6d', '2d×5', '3d×5', '4d×5', '6d×5', '4d×10', '6d×10'],
    output: [null, null, null, '3MJ', '10MJ', '30MJ', '100MJ', '300MJ', '1GJ', '3GJ', '10GJ', '30GJ'],
    gun: [null, null, null, '8cm', '10cm', '12cm', '14cm', '16cm', '20cm', '24cm', '28cm', '32cm'],
    launcher: [null, null, null, '16cm', '20cm', '24cm', '28cm', '32cm', '40cm', '48cm', '56cm', '64cm'],
    uninstalled: [null, null, null, 0.5, 1.5, 5, 15, 50, 150, 500, 1500, 5000],
    cost: [null, null, null, 1.5e6, 6e6, 15e6, 60e6, 150e6, 600e6, 1.5e9, 6e9, 15e9],
    ws: WS_STD,
  },
};

// Spinal battery (three linked systems; stats/cost cover all three).
const SPINAL = {
  name: 'Spinal battery', minSM: 4,
  dDam: ['4d', '6d', '2d×5', '3d×5', '4d×5', '3d×10', '4d×10', '6d×10', '2d×50', '3d×50', '2d×100', '3d×100'],
  output: ['10MJ', '30MJ', '100MJ', '300MJ', '1GJ', '3GJ', '10GJ', '30GJ', '100GJ', '300GJ', '1TJ', '3TJ'],
  gun: ['10cm', '12cm', '14cm', '16cm', '20cm', '24cm', '28cm', '32cm', '40cm', '48cm', '56cm', '64cm'],
  launcher: ['20cm', '24cm', '28cm', '32cm', '40cm', '48cm', '56cm', '64cm', '80cm', '96cm', '112cm', null],
  cost: [150e3, 500e3, 1.5e6, 5e6, 15e6, 50e6, 150e6, 500e6, 1.5e9, 5e9, 15e9, 50e9],
  ws: [0, 0, 0, 0, 0, 0, 3, 9, 30, 90, 300, 900],
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
  fusionPulse: { name: 'Fusion pulse drive', tl: 9, he: 0, accel: (tl) => tl >= 10 ? 0.05 : 0.02, dv: (tl) => tlPick({ 9: 5, 10: 10, 11: 40 }, tl), fuel: 'fuel pellets', costBase: 300e3, amAug: true },
  advFusionPulse: { name: 'Advanced fusion pulse', tl: 9, he: 0, accel: () => 0.005, dv: (tl) => tlPick({ 9: 20, 10: 100, 11: 350 }, tl), fuel: 'fuel pellets', costBase: 300e3, costMult: 2, amAug: true },
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
  rotaryReactionless: { name: 'Rotary reactionless engine', tl: 7, ss: true, he: 1, reactionless: true, accel: () => 0.1, costBase: 15e3, note: 'thrust in any direction' },
  standardReactionless: { name: 'Standard reactionless engine', tl: 10, ss: true, he: 1, reactionless: true, accel: (tl) => tl >= 11 ? 1 : 0.5, costBase: 30e3 },
  hotReactionless: { name: 'Hot reactionless engine', tl: 10, ss: true, he: 1, reactionless: true, accel: (tl) => tl >= 11 ? 2 : 1, costBase: 100e3 },
  superReactionless: { name: 'Super reactionless engine', tl: 11, ss: true, he: 1, reactionless: true, accel: (tl) => tl >= 12 ? 100 : 50, costBase: 200e3 },
  subwarp: { name: 'Subwarp engine', tl: 10, ss: true, he: 1, reactionless: true, accel: () => 500, costBase: 300e3 },
};

export function makeEngine(key, e, source) {
  return {
    key, name: e.name, category: 'Engines', tl: e.tl, superscience: !!e.ss, source,
    loc: e.loc || 'rear', core: !!e.core, he: e.he,
    cost: (sm) => costProgression(e.costBase)[idx(sm)] * (e.costMult || 1),
    info: (sm, tl, opts = {}) => {
      const dvMult = e.amAug && opts.amAugmented ? 1.2 : 1;
      return {
        engine: true,
        reactionless: !!e.reactionless,
        accelG: e.accel(tl, sm),
        dvPerTank: e.dv ? e.dv(tl) * dvMult : null,
        fuel: e.fuel || null,
        ppNeed: e.he,
        desc: e.reactionless
          ? `${e.accel(tl, sm)}G reactionless`
          : `${e.accel(tl, sm)}G; ${e.dv ? e.dv(tl) * dvMult : 0} mps per tank of ${e.fuel}${opts.amAugmented ? ' (antimatter-augmented)' : ''}`,
        note: e.note,
      };
    },
  };
}

// Power plants. deRate: { max, costFactor(levels) } — SS1/SS2's de-rated
// reactors trade Power Points for cost and endurance.
const PLANTS = {
  fuelCell: { name: 'Fuel cell', tl: 7, pp: 1, endurance: (tl) => `${tlPick({ 7: 3, 8: 6, 9: 12, 10: 24 }, tl)} hr internal fuel`, costBase: 15e3 },
  mhdTurbine: { name: 'MHD turbine', tl: 9, pp: 2, endurance: (tl) => `${tl >= 10 ? 12 : 6} hr internal fuel`, costBase: 15e3, costMult: 2 },
  fissionReactor: { name: 'Fission reactor', tl: 8, pp: 1, endurance: (tl) => `${tlPick({ 8: 25, 9: 50, 10: 75 }, tl)} yr`, costBase: 100e3 },
  fusionReactor: {
    name: 'Fusion reactor', tl: 9, pp: 2, endurance: (tl) => `${tlPick({ 9: 50, 10: 200, 11: 600, 12: 1500 }, tl)} yr`,
    costBase: 300e3, minSMAtTL9: 10, deRate: { max: 1, costFactor: () => 0.5 },
  },
  antimatterReactor: {
    name: 'Antimatter reactor', tl: 10, pp: 4, endurance: (tl) => `${tlPick({ 10: 2, 11: 20, 12: 200 }, tl)} yr`,
    costBase: 600e3, note: 'volatile', deRate: { max: 3, costFactor: (n) => 1 - 0.25 * n },
  },
  superFusionReactor: {
    name: 'Super fusion reactor', tl: 11, pp: 4, endurance: (tl) => `${tl >= 12 ? 1000 : 400} yr`,
    costBase: 1e6, deRate: { max: 3, costFactor: (n) => 1 - 0.25 * n },
  },
  tcReactor: { name: 'Total conversion reactor', tl: 12, ss: true, pp: 5, endurance: () => 'unlimited', costBase: 2e6 },
};

export function makePlant(key, p, source) {
  return {
    key, name: p.name, category: 'Power', tl: p.tl, superscience: !!p.ss, source,
    loc: 'any', core: true, he: 0,
    cost: (sm, tl, opts = {}) => {
      const deRate = p.deRate ? Math.min(opts.deRate || 0, p.deRate.max) : 0;
      return costProgression(p.costBase)[idx(sm)] * (p.costMult || 1) * (deRate ? p.deRate.costFactor(deRate) : 1);
    },
    info: (sm, tl, opts = {}) => {
      const deRate = p.deRate ? Math.min(opts.deRate || 0, p.deRate.max) : 0;
      const pp = (typeof p.pp === 'function' ? p.pp(sm, tl) : p.pp) - deRate;
      return {
        pp, ppKind: p.ppKind || 'normal', ppMagic: p.extraMagicPP || 0,
        desc: `${pp} ${p.ppKind ? `${p.ppKind} ` : ''}Power Point${pp > 1 ? 's' : ''}`
          + `${p.extraMagicPP ? ` + ${p.extraMagicPP} magic-only` : ''}${deRate ? ' (de-rated)' : ''}; ${p.endurance(tl, sm)}`,
        note: p.note,
      };
    },
  };
}

// --- The registry ----------------------------------------------------------
export const SYSTEMS = {};

// Armor systems from the armor tables (includes SS7's divergent armors).
for (const [key, a] of Object.entries(ARMORS)) {
  SYSTEMS[`armor_${key}`] = {
    key: `armor_${key}`, name: a.name, category: 'Armor', tl: a.tl,
    superscience: !!a.superscience, source: a.source,
    loc: 'hull', core: false, he: a.he || 0,
    cost: (sm) => a.cost[idx(sm)] ?? 0,
    info: (sm, tl, opts, ctx) => {
      const ddr = ctx?.streamlined ? (a.sl ? a.sl[idx(sm)] : null) : a.us[idx(sm)];
      return {
        armorDDR: ddr,
        liftG: a.liftG || 0,
        ppNeed: a.he || 0,
        desc: ddr === null ? 'unavailable at this SM/streamlining' : `dDR ${ddr}${a.liftG ? `; lifts ${Math.round(a.liftG * 100) / 100}G` : ''}`,
        note: a.note,
        invalid: ddr === null,
      };
    },
  };
}

for (const [key, e] of Object.entries(ENGINES)) SYSTEMS[key] = makeEngine(key, e);
for (const [key, p] of Object.entries(PLANTS)) SYSTEMS[key] = makePlant(key, p);

// Habitat conversions: each entry is [cabin-equivalents, sleeps, extra $ each].
const HAB_CONVERSIONS = {
  luxury: { label: 'luxury cabin', cabins: 2, sleeps: 2 },
  bunkrooms: { label: 'bunkroom', cabins: 1, sleeps: 4 },
  cells: { label: 'cell', cabins: 1, sleeps: 4 },
  sickbay: { label: 'sickbay bed', cabins: 1, sleeps: 0 },
  automed: { label: 'automed sickbay bed', cabins: 1, sleeps: 0, extraCost: 100e3 },
  steerage: { label: 'steerage (5t cargo)', cabins: 1, sleeps: 0, cargo: 5 },
  hibernation: { label: 'hibernation chamber', cabins: 0.25, sleeps: 0, hibernation: 1 },
  growthTanks: { label: 'growth tank', cabins: 0.05, sleeps: 0, source: 'SS5' },
  offices: { label: 'office', cabins: 1, sleeps: 0 },
  briefing: { label: 'briefing room', cabins: 1, sleeps: 0 },
  labs: { label: 'lab', cabins: 2, sleeps: 0, extraCost: 1e6 },
  establishments: { label: 'establishment', cabins: 2, sleeps: 0 },
};

Object.assign(SYSTEMS, {
  fuelTank: {
    key: 'fuelTank', name: 'Fuel tank', category: 'Engines', tl: 7,
    loc: 'any', core: true, he: 0,
    cost: (sm) => [3e3, 10e3, 30e3, 100e3, 300e3, 1e6, 3e6, 10e6, 30e6, 100e6, 300e6, 1e9][idx(sm)],
    info: (sm) => {
      const tons = [0.5, 1.5, 5, 15, 50, 150, 500, 1500, 5000, 15000, 50000, 150000][idx(sm)];
      return { fuelTank: true, fuelTons: tons, desc: `${tons} tons of fuel` };
    },
  },
  cargoHold: {
    key: 'cargoHold', name: 'Cargo hold', category: 'Payload', tl: 0,
    loc: 'any', core: true, he: 0,
    cost: () => 0,
    info: (sm) => {
      const tons = [0.5, 1.5, 5, 15, 50, 150, 500, 1500, 5000, 15000, 50000, 150000][idx(sm)];
      return { cargoTons: tons, desc: `${tons} tons capacity` };
    },
  },
  controlRoom: {
    key: 'controlRoom', name: 'Control room', category: 'Command', tl: 7,
    loc: 'any', core: true, he: 0,
    cost: (sm, tl, opts = {}) => costProgression(60e3)[idx(sm)] - (opts.removeStations || 0) * (sm === 4 ? 10e3 : 50e3),
    info: (sm, tl, opts = {}, ctx = {}) => {
      const compTL = ctx.compTL ?? tl;
      const complexity = [6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11][idx(sm)] + (tlPick({ 7: -6, 8: -4, 9: -2, 10: 0, 11: 1, 12: 2 }, compTL) ?? 0);
      const baseStations = [1, 1, 2, 3, 4, 6, 10, 15, 20, 30, 40, 60][idx(sm)];
      const stations = Math.max(0, baseStations - (opts.removeStations || 0));
      const array = tl - 10 + [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14][idx(sm)];
      return {
        controlStations: stations, complexity, arrayLevel: array, ws: WS_STD[idx(sm)],
        desc: `${stations} control station${stations === 1 ? '' : 's'}; Complexity ${complexity}; comm/sensor ${array}`,
      };
    },
  },
  engineRoom: {
    key: 'engineRoom', name: 'Engine room', category: 'Command', tl: 7,
    loc: 'any', core: true, he: 0, minSM: 5, maxSM: 9,
    cost: (sm) => [null, 15e3, 30e3, 100e3, 300e3, 1e6][idx(sm)] ?? 0,
    info: (sm) => ({
      ws: sm === 9 ? 2 : 1, controlStations: 1, engineRoom: true,
      desc: `${sm === 9 ? 2 : 1} workspace(s) + control station`,
    }),
  },
  habitat: {
    key: 'habitat', name: 'Habitat', category: 'Habitats', tl: 7,
    loc: 'any', core: true, he: 0, minSM: 6,
    cost: (sm, tl, opts = {}) => {
      let cost = [null, null, 100e3, 300e3, 1e6, 3e6, 10e6, 30e6, 100e6, 300e6, 1e9, 3e9][idx(sm)] ?? 0;
      for (const [key, conv] of Object.entries(HAB_CONVERSIONS)) {
        if (conv.extraCost && opts[key]) cost += conv.extraCost * opts[key];
      }
      return cost;
    },
    info: (sm, tl, opts = {}) => {
      const total = [null, null, 1, 2, 6, 20, 60, 200, 600, 2000, 6000, 20000][idx(sm)];
      let used = 0;
      let sleeps = 0;
      let cargo = 0;
      let hibernation = 0;
      const parts = [];
      for (const [key, conv] of Object.entries(HAB_CONVERSIONS)) {
        const n = opts[key] || 0;
        if (!n) continue;
        used += conv.cabins * n;
        sleeps += (conv.sleeps || 0) * n;
        cargo += (conv.cargo || 0) * n;
        hibernation += (conv.hibernation || 0) * n;
        parts.push(`${n}× ${conv.label}`);
      }
      const plain = total - Math.ceil(used);
      if (plain < 0) {
        return { invalid: true, desc: `conversions need ${Math.ceil(used)} cabins but the habitat only has ${total}` };
      }
      sleeps += plain * 2;
      parts.unshift(`${plain} cabin${plain === 1 ? '' : 's'}`);
      return {
        cabins: plain + (opts.luxury || 0), sleeps, cargoTons: cargo, hibernation,
        ws: WS_STD[idx(sm)], desc: parts.join(', '),
      };
    },
  },
  passengerSeating: {
    key: 'passengerSeating', name: 'Passenger seating', category: 'Habitats', tl: 7,
    loc: 'any', core: true, he: 0,
    cost: (sm) => [5e3, 10e3, 30e3, 100e3, 300e3, 1e6, 3e6, 10e6, 30e6, 100e6, 300e6, 1e9][idx(sm)],
    info: (sm) => {
      const seats = [1, 2, 6, 20, 60, 200, 600, 2000, 6000, 20000, 60000, 200000][idx(sm)];
      return { seats, desc: `${seats} seat${seats === 1 ? '' : 's'}` };
    },
  },
  openSpace: {
    key: 'openSpace', name: 'Open space', category: 'Habitats', tl: 7,
    loc: 'any', core: true, he: 0, minSM: 8,
    cost: (sm) => [null, null, null, null, 100e3, 200e3, 500e3, 1e6, 2e6, 5e6, 10e6, 20e6][idx(sm)] ?? 0,
    info: (sm) => {
      const areas = [null, null, null, null, 1, 2, 5, 10, 20, 50, 100, 200][idx(sm)];
      return { openAreas: areas, openSpace: true, ws: WS_STD[idx(sm)], desc: `${areas} area(s), 100 people each` };
    },
  },
  hangarBay: {
    key: 'hangarBay', name: 'Hangar bay', category: 'Payload', tl: 7,
    loc: 'hull', core: false, he: 0,
    cost: (sm) => [1e3, 3e3, 10e3, 30e3, 100e3, 300e3, 1e6, 3e6, 10e6, 30e6, 100e6, 300e6][idx(sm)],
    info: (sm) => {
      const tons = [0.3, 1, 3, 10, 30, 100, 300, 1000, 3000, 10000, 30000, 100000][idx(sm)];
      const rate = [0.3, 1, 3, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000][idx(sm)];
      return { hangarTons: tons, ws: WS_STD[idx(sm)], desc: `${tons} tons craft; launch ${rate} t/min` };
    },
  },
  enhancedArray: {
    key: 'enhancedArray', name: 'Enhanced comm/sensor array', category: 'Command', tl: 7,
    loc: 'hull', core: false, he: 0, arrayMult: 1,
    cost: (sm) => costProgression(60e3)[idx(sm)],
    info: (sm, tl) => {
      const level = tl - 10 + [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16][idx(sm)];
      return { arrayLevel: level, ws: WS_STD[idx(sm)], desc: `comm/sensor Level ${level}` };
    },
  },
  tacticalArray: {
    key: 'tacticalArray', name: 'Tactical comm/sensor array', category: 'Command', tl: 7,
    loc: 'hull', core: false, he: 0,
    cost: (sm) => costProgression(60e3)[idx(sm)] * 5,
    info: (sm, tl) => {
      const level = tl - 10 + [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16][idx(sm)];
      return { arrayLevel: level, ws: WS_STD[idx(sm)], desc: `Level ${level}; negates ECM array penalty` };
    },
  },
  scienceArray: {
    key: 'scienceArray', name: 'Science comm/sensor array', category: 'Command', tl: 7,
    loc: 'hull', core: false, he: 0,
    cost: (sm) => costProgression(60e3)[idx(sm)] * 5,
    info: (sm, tl) => {
      const level = tl - 10 + [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16][idx(sm)];
      return { arrayLevel: level, ws: WS_STD[idx(sm)], desc: `Level ${level}; survey instruments` };
    },
  },
  multipurposeArray: {
    key: 'multipurposeArray', name: 'Multipurpose comm/sensor array', category: 'Command', tl: 7,
    loc: 'hull', core: false, he: 0,
    cost: (sm) => costProgression(60e3)[idx(sm)] * 10,
    info: (sm, tl) => {
      const level = tl - 10 + [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16][idx(sm)];
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
    cost: (sm) => [150e3, 500e3, 1.5e6, 5e6, 15e6, 50e6, 150e6, 500e6, 1.5e9, 5e9, 15e9, 50e9][idx(sm)],
    info: (sm, tl) => {
      const ddr = (tl >= 12 ? [20, 30, 50, 70, 100, 150, 200, 300, 500, 700, 1000, 1500] : [15, 20, 30, 50, 70, 100, 150, 200, 300, 500, 700, 1000])[idx(sm)];
      return { screenDDR: ddr, ppNeed: 1, desc: `screen dDR ${ddr} (all sections)` };
    },
  },
  forceScreenHeavy: {
    key: 'forceScreenHeavy', name: 'Heavy force screen', category: 'Defenses', tl: 11, superscience: true,
    loc: 'any', core: true, he: 1,
    cost: (sm) => [500e3, 1.5e6, 5e6, 15e6, 50e6, 150e6, 500e6, 1.5e9, 5e9, 15e9, 50e9, 150e9][idx(sm)],
    info: (sm, tl) => {
      const ddr = (tl >= 12 ? [20, 30, 50, 70, 100, 150, 200, 300, 500, 700, 1000, 1500] : [15, 20, 30, 50, 70, 100, 150, 200, 300, 500, 700, 1000])[idx(sm)];
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
    cost: (sm) => [null, null, 5e6, 15e6, 50e6, 150e6, 500e6, 1.5e9, 5e9, 15e9, 50e9, 150e9][idx(sm)] ?? 0,
    info: (sm) => {
      const rate = [null, null, 5e3, 15e3, 50e3, 150e3, 500e3, 1.5e6, 5e6, 15e6, 50e6, 150e6][idx(sm)];
      return { ppNeed: 1, factory: true, ws: WS_STD[idx(sm)], desc: `produces $${(rate / 1000).toLocaleString('en-US')}K/hr of goods` };
    },
  },
  mining: {
    key: 'mining', name: 'Mining', category: 'Utility', tl: 7,
    loc: 'any', core: true, he: 1,
    cost: (sm) => [10e3, 30e3, 100e3, 300e3, 1e6, 3e6, 10e6, 30e6, 100e6, 300e6, 1e9, 3e9][idx(sm)],
    info: (sm) => {
      const rate = [0.05, 0.15, 0.5, 1.5, 5, 15, 50, 150, 500, 1500, 5000, 15000][idx(sm)];
      return { ppNeed: 1, ws: WS_STD[idx(sm)], desc: `extracts ${rate} tons of ore/hour` };
    },
  },
  refinery: {
    key: 'refinery', name: 'Chemical refinery', category: 'Utility', tl: 7,
    loc: 'any', core: true, he: 1,
    cost: (sm) => [10e3, 30e3, 100e3, 300e3, 1e6, 3e6, 10e6, 30e6, 100e6, 300e6, 1e9, 3e9][idx(sm)],
    info: (sm) => {
      const rate = [0.15, 0.5, 1.5, 5, 15, 50, 150, 500, 1500, 5000, 15000, 50000][idx(sm)];
      return { ppNeed: 1, ws: WS_STD[idx(sm)], desc: `refines ${rate} tons of fuel/hour` };
    },
  },
  externalClamp: {
    key: 'externalClamp', name: 'External clamp', category: 'Utility', tl: 7,
    loc: 'hull', core: false, he: 0,
    cost: (sm) => [1e3, 3e3, 10e3, 30e3, 100e3, 300e3, 1e6, 3e6, 10e6, 30e6, 100e6, 300e6][idx(sm)],
    info: () => ({ desc: 'grapples/tows external loads' }),
  },
  robotArm: {
    key: 'robotArm', name: 'Robot arm', category: 'Utility', tl: 8,
    loc: 'hull', core: false, he: 0,
    cost: (sm) => costProgression(300e3)[idx(sm)],
    info: () => ({ ws: 0, arms: 1, desc: 'manipulator arm; doubles as clamp' }),
  },
  softLanding: {
    key: 'softLanding', name: 'Soft-landing system', category: 'Utility', tl: 7,
    loc: 'hull', core: false, he: 0,
    cost: (sm) => [25e3, 50e3, 100e3, 200e3, 500e3, 1e6, 2e6, 5e6, 10e6, 20e6, 50e6, 100e6][idx(sm)],
    info: () => ({ desc: 'one-shot parachutes/airbags' }),
  },
  jumpGate: {
    key: 'jumpGate', name: 'Jump gate', category: 'Utility', tl: 10, superscience: true,
    loc: 'hull', core: false, he: 1, minSM: 9,
    cost: (sm) => [null, null, null, null, null, 150e6, 500e6, 1.5e9, 5e9, 15e9, 50e9, 150e9][idx(sm)] ?? 0,
    info: (sm) => {
      const tons = [null, null, null, null, null, 100, 300, 1000, 3000, 10000, 30000, 100000][idx(sm)];
      return { ppNeed: 1, ws: WS_STD[idx(sm)], desc: `gates ${tons} tons at once` };
    },
  },
  stasisWeb: {
    key: 'stasisWeb', name: 'Stasis web', category: 'Defenses', tl: 12, superscience: true,
    loc: 'any', core: true, he: 1,
    cost: (sm) => [1e6, 2e6, 5e6, 10e6, 20e6, 50e6, 100e6, 200e6, 500e6, 1e9, 2e9, 5e9][idx(sm)],
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
        output: b.output[i], gunCal: b.gun[i], launcherCal: b.launcher[i], dDam: b.dDam[i],
        desc: `${n}× ${armament} in ${mount}s${freed ? `; ${freed} tons spare cargo` : ''}`,
      };
    },
  };
}

// Spinal battery: one front weapon system + linked central [core] and rear
// sections. Cost and stats (on the front part) cover all three.
SYSTEMS.battery_spinal = {
  key: 'battery_spinal', name: 'Spinal battery (front)', category: 'Weapons', tl: 7,
  loc: 'front', core: false, he: 1, minSM: 4, battery: true, spinal: true,
  cost: (sm) => SPINAL.cost[idx(sm)],
  info: (sm, tl, opts = {}) => {
    const i = idx(sm);
    const type = opts.weaponType || 'beam';
    const armament = type === 'gun' ? `${SPINAL.gun[i]} gun` : type === 'missile' ? `${SPINAL.launcher[i]} launcher` : `${SPINAL.output[i]} beam (${SPINAL.dDam[i]})`;
    return {
      weapons: 1, spinalFront: true,
      ppNeed: 3,
      ws: SPINAL.ws[i],
      output: SPINAL.output[i], gunCal: SPINAL.gun[i], launcherCal: SPINAL.launcher[i], dDam: SPINAL.dDam[i],
      desc: `fixed ${armament}; needs central [core] + rear spinal sections`,
    };
  },
};
SYSTEMS.spinalCentral = {
  key: 'spinalCentral', name: 'Spinal battery (central)', category: 'Weapons', tl: 7,
  loc: 'central', core: true, he: 0, minSM: 4, spinal: true,
  cost: () => 0,
  info: () => ({ spinalCentral: true, desc: 'central section of the spinal mount (must be the core slot)' }),
};
SYSTEMS.spinalRear = {
  key: 'spinalRear', name: 'Spinal battery (rear)', category: 'Weapons', tl: 7,
  loc: 'rear', core: false, he: 0, minSM: 4, spinal: true,
  cost: () => 0,
  info: () => ({ spinalRear: true, desc: 'rear section of the spinal mount' }),
};

export const SYSTEM_LIST = Object.values(SYSTEMS);
export const SYSTEM_CATEGORIES = () => [...new Set(Object.values(SYSTEMS).map((s) => s.category))];
