// ---------------------------------------------------------------------------
// GURPS Spaceships (4e) — core tables.
//
// Implements the design mechanics of GURPS Spaceships (SS1) plus the
// designer-facing additions of SS2-SS8: a hull of SM +4..+15 with three
// sections (front/central/rear) of six system slots each plus two [core]
// slots; every system is 5% of loaded mass, with its stats and cost read
// from per-SM tables. No rules text is reproduced.
//
// All per-SM arrays run SM +4..+15 (12 entries, smIndex = sm - 4). The
// SM +4 hull is from SS4; its systems cost 10% of the SM +6 value — one
// step down the 1-3-10 cost ladder (exceptions noted per system).
// ---------------------------------------------------------------------------

export const SMS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
export const smIndex = (sm) => sm - 4;

// Source books for filtering. SS1 is the core set and always available.
export const BOOKS = {
  SS2: 'SS2: Traders, Liners & Transports',
  SS3: 'SS3: Warships & Space Pirates',
  SS4: 'SS4: Fighters, Carriers & Mecha',
  SS5: 'SS5: Exploration & Colony',
  SS6: 'SS6: Mining & Industrial',
  SS7: 'SS7: Divergent & Paranormal Tech',
  SS8: 'SS8: Transhuman Spacecraft',
};

// Hull Size Table (SS1; SM+4 row from SS4).
export const HULLS = {
  4: { tons: 10, lengthYds: 10, dstHp: 15, hnd: 0, sr: 4, source: 'SS4' },
  5: { tons: 30, lengthYds: 15, dstHp: 20, hnd: 0, sr: 4 },
  6: { tons: 100, lengthYds: 20, dstHp: 30, hnd: 0, sr: 4 },
  7: { tons: 300, lengthYds: 30, dstHp: 50, hnd: -1, sr: 5 },
  8: { tons: 1000, lengthYds: 50, dstHp: 70, hnd: -1, sr: 5 },
  9: { tons: 3000, lengthYds: 70, dstHp: 100, hnd: -1, sr: 5 },
  10: { tons: 10000, lengthYds: 100, dstHp: 150, hnd: -2, sr: 5 },
  11: { tons: 30000, lengthYds: 150, dstHp: 200, hnd: -2, sr: 5 },
  12: { tons: 100000, lengthYds: 200, dstHp: 300, hnd: -2, sr: 5 },
  13: { tons: 300000, lengthYds: 300, dstHp: 500, hnd: -3, sr: 5 },
  14: { tons: 1000000, lengthYds: 500, dstHp: 700, hnd: -3, sr: 5 },
  15: { tons: 3000000, lengthYds: 700, dstHp: 1000, hnd: -3, sr: 5 },
};

export const SECTIONS = ['front', 'central', 'rear'];
export const SLOTS_PER_SECTION = 6;
export const CORE_COUNT = 2; // two cores, in different sections

// One step down/up the 1-3-10 ladder (…, 1, 3, 10, 30, …).
const ladderDown = (v) => {
  const mant = v / 10 ** Math.floor(Math.log10(v) + 1e-9);
  return Math.round([1, 2, 5].some((m) => Math.abs(mant - m) < 0.01) ? v * 3 / 10 : v / 3);
};
const ladderUp = (v) => {
  const mant = v / 10 ** Math.floor(Math.log10(v) + 1e-9);
  return Math.round([1, 2, 5].some((m) => Math.abs(mant - m) < 0.01) ? v * 3 : v * 10 / 3);
};

// Cost shorthand: the book's 1-3-10 progression. `baseSm5` is the SM+5
// value; the returned array runs SM+4..+15 (the SM+4 entry is one ladder
// step below SM+5 — i.e. 10% of the SM+6 value, per SS4).
export function costProgression(baseSm5) {
  const out = [ladderDown(baseSm5)];
  let v = baseSm5;
  for (let sm = 5; sm <= 15; sm++) {
    out.push(v);
    v = ladderUp(v);
  }
  return out;
}

// --- Armor systems ---------------------------------------------------------
// us/sl = dDR per system by SM (+4..+15); null = unavailable.
// SM+4 values for the SS1 armors are from SS4's small-craft tables.
export const ARMORS = {
  ice: {
    name: 'Ice armor', tl: 0, semiAblative: true, streamlinedOk: false,
    us: [null, null, null, null, 1, 2, 2, 3, 5, 7, 10, 15], sl: null,
    cost: SMS.map(() => 0), note: 'Semi-ablative; negligible cost.',
  },
  stone: {
    name: 'Stone armor', tl: 0, semiAblative: true, streamlinedOk: false,
    us: [null, null, null, 1, 2, 2, 3, 5, 7, 10, 15, 20], sl: null,
    cost: SMS.map(() => 0), note: 'Semi-ablative; negligible cost.',
  },
  steel: {
    name: 'Steel armor', tl: 7, streamlinedOk: true,
    us: [null, 1, 2, 3, 5, 7, 10, 15, 20, 30, 50, 70],
    sl: [null, null, 1, 2, 3, 5, 7, 10, 15, 20, 30, 50],
    cost: [null, 6e3, 20e3, 60e3, 200e3, 600e3, 2e6, 6e6, 20e6, 60e6, 200e6, 600e6],
  },
  lightAlloy: {
    name: 'Light alloy armor', tl: 7, streamlinedOk: true,
    us: [1, 2, 3, 5, 7, 10, 15, 20, 30, 50, 70, 100],
    sl: [1, 1, 2, 3, 5, 7, 10, 15, 20, 30, 50, 70],
    cost: [5e3, 15e3, 50e3, 150e3, 500e3, 1.5e6, 5e6, 15e6, 50e6, 150e6, 500e6, 1.5e9],
  },
  metallicLaminate: {
    name: 'Metallic laminate armor', tl: 8, streamlinedOk: true,
    us: [2, 3, 5, 7, 10, 15, 20, 30, 50, 70, 100, 150],
    sl: [1, 2, 3, 5, 7, 10, 15, 20, 30, 50, 70, 100],
    cost: [10e3, 30e3, 100e3, 300e3, 1e6, 3e6, 10e6, 30e6, 100e6, 300e6, 1e9, 3e9],
  },
  advMetallicLaminate: {
    name: 'Advanced metallic laminate armor', tl: 9, streamlinedOk: true,
    us: [3, 5, 7, 10, 15, 20, 30, 50, 70, 100, 150, 200],
    sl: [2, 3, 5, 7, 10, 15, 20, 30, 50, 70, 100, 150],
    cost: [20e3, 60e3, 200e3, 600e3, 2e6, 6e6, 20e6, 60e6, 200e6, 600e6, 2e9, 6e9],
  },
  nanocomposite: {
    name: 'Nanocomposite armor', tl: 10, streamlinedOk: true,
    us: [5, 7, 10, 15, 20, 30, 50, 70, 100, 150, 200, 300],
    sl: [3, 5, 7, 10, 15, 20, 30, 50, 70, 100, 150, 200],
    cost: [50e3, 150e3, 500e3, 1.5e6, 5e6, 15e6, 50e6, 150e6, 500e6, 1.5e9, 5e9, 15e9],
  },
  organic: {
    name: 'Organic armor', tl: 10, streamlinedOk: true,
    us: [1, 2, 3, 5, 7, 10, 15, 20, 30, 50, 70, 100],
    sl: [0, 1, 2, 3, 5, 7, 10, 15, 20, 30, 50, 70],
    cost: [3e3, 10e3, 30e3, 100e3, 300e3, 1e6, 3e6, 10e6, 30e6, 100e6, 300e6, 1e9],
    note: 'Half DR (round down) vs burning and corrosion.',
  },
  diamondoid: {
    name: 'Diamondoid armor', tl: 11, streamlinedOk: true,
    us: [7, 10, 15, 20, 30, 50, 70, 100, 150, 200, 300, 500],
    sl: [5, 7, 10, 15, 20, 30, 50, 70, 100, 150, 200, 300],
    cost: [100e3, 300e3, 1e6, 3e6, 10e6, 30e6, 100e6, 300e6, 1e9, 3e9, 10e9, 30e9],
  },
  exoticLaminate: {
    name: 'Exotic laminate armor', tl: 12, streamlinedOk: true,
    us: [10, 15, 20, 30, 50, 70, 100, 150, 200, 300, 500, 700],
    sl: [7, 10, 15, 20, 30, 50, 70, 100, 150, 200, 300, 500],
    cost: [200e3, 600e3, 2e6, 6e6, 20e6, 60e6, 200e6, 600e6, 2e9, 6e9, 20e9, 60e9],
  },

  // --- SS7 divergent/paranormal armors -------------------------------------
  wooden: {
    name: 'Wooden armor', tl: 0, semiAblative: true, streamlinedOk: true, source: 'SS7',
    us: [null, 1, 1, 2, 2, 3, null, null, null, null, null, null],
    sl: [null, 0, 1, 1, 1, 2, null, null, null, null, null, null],
    cost: [null, 2e3, 6e3, 20e3, 60e3, 200e3, null, null, null, null, null, null],
    note: 'Semi-ablative vs burning/corrosion; hulls up to SM+9 only.',
  },
  etherwood: {
    name: 'Etherwood armor', tl: 1, superscience: true, semiAblative: true, streamlinedOk: true, source: 'SS7',
    us: [null, 1, 1, 2, 2, 3, 4, 5, 6, 7, 10, 15],
    sl: [null, 0, 1, 1, 1, 2, 3, 3, 4, 5, 7, 10],
    cost: [null, 10e3, 30e3, 100e3, 300e3, 1e6, 3e6, 10e6, 30e6, 100e6, 300e6, 1e9],
    liftG: 1 / 3,
    note: 'Contragravity wood: each system lifts 1/3G (no power).',
  },
  adamant: {
    name: 'Adamant armor', tl: 2, superscience: true, semiAblative: true, streamlinedOk: true, source: 'SS7',
    us: [null, 1, 2, 3, 5, 7, 10, 15, 20, 30, 50, 70],
    sl: [null, null, 1, 2, 3, 5, 7, 10, 15, 20, 30, 50],
    cost: [null, 10e3, 30e3, 100e3, 300e3, 1e6, 3e6, 10e6, 30e6, 100e6, 300e6, 1e9],
    note: 'Fantasy crystal; loses 1 dDR per 10 points of d-damage resisted.',
  },
  skystone: {
    name: 'Skystone armor', tl: 2, superscience: true, semiAblative: true, streamlinedOk: true, source: 'SS7',
    us: [null, 1, 2, 3, 5, 7, 10, 15, 20, 30, 50, 70],
    sl: [null, null, 1, 2, 3, 5, 7, 10, 15, 20, 30, 50],
    cost: [null, 20e3, 60e3, 200e3, 600e3, 2e6, 6e6, 20e6, 60e6, 200e6, 600e6, 2e9],
    liftG: 1 / 3,
    note: 'Lifting adamant: each system lifts 1/3G (no power).',
  },
  iron: {
    name: 'Iron armor', tl: 5, streamlinedOk: true, source: 'SS7',
    us: [null, null, 1, 2, 3, 5, 7, 10, 15, 20, 30, 50],
    sl: [null, null, 1, 1, 2, 3, 5, 7, 10, 15, 20, 30],
    cost: [null, null, 12e3, 40e3, 120e3, 400e3, 1.2e6, 4e6, 12e6, 40e6, 120e6, 400e6],
    note: 'Riveted plate; available at TL2-4 at 5× cost.',
  },
  orichalcum: {
    name: 'Orichalcum armor', tl: 2, superscience: true, streamlinedOk: true, source: 'SS7',
    us: [null, 4, 6, 9, 12, 18, 25, 40, 60, 90, 120, 180],
    sl: [null, 3, 4, 6, 9, 12, 18, 25, 40, 60, 90, 120],
    cost: [null, 50e3, 150e3, 500e3, 1.5e6, 5e6, 15e6, 50e6, 150e6, 500e6, 1.5e9, 5e9],
    note: 'Legendary super-metal.',
  },
  structuralField: {
    name: 'Structural field armor', tl: 11, superscience: true, streamlinedOk: true, source: 'SS7',
    us: [null, 30, 50, 70, 100, 150, 200, 300, 500, 700, 1000, 1500],
    sl: [null, 20, 30, 50, 70, 100, 150, 200, 300, 500, 700, 1000],
    cost: [null, 1e6, 3e6, 10e6, 30e6, 100e6, 300e6, 1e9, 3e9, 10e9, 30e9, 100e9],
    he: 1,
    note: 'Field-reinforced exotic matter; needs a Power Point — armor is destroyed if unpowered.',
  },
};

// Unarmored hull: personal-scale DR only (dDR 0).
export const UNARMORED_DDR = 0;

// --- Design features (not systems) -----------------------------------------
// Cost arrays are per SM (+4..+15) unless flat. SM+4 values from SS4.
export const FEATURES = {
  artificialGravity: {
    name: 'Artificial gravity', tl: '10^',
    cost: [10e3, 30e3, 100e3, 300e3, 1e6, 3e6, 10e6, 30e6, 100e6, 300e6, 1e9, 3e9],
    help: '0-3G set per section or room; superscience.',
  },
  gravticCompensators: {
    name: 'Gravitic compensators', tl: '10^',
    cost: [10e3, 30e3, 100e3, 300e3, 1e6, 3e6, 10e6, 30e6, 100e6, 300e6, 1e9, 3e9],
    help: 'Negates up to 99.5% of felt acceleration (no gravity).',
  },
  spinGravity: {
    name: 'Spin gravity', tl: 7, unstreamlinedOnly: true, minSM: 8,
    // [maxG, cost] by SM 8..15
    table: { 8: [0.1, 0.1e6], 9: [0.15, 0.3e6], 10: [0.2, 1e6], 11: [0.3, 3e6], 12: [0.5, 10e6], 13: [0.7, 30e6], 14: [1, 100e6], 15: [1.5, 300e6] },
    help: 'Rotating sections; -2 Hnd while spinning; no gravity in cores.',
  },
  winged: {
    name: 'Winged', tl: 7, streamlinedOnly: true, maxSM: 12,
    cost: [50e3, 150e3, 500e3, 1.5e6, 5e6, 15e6, 50e6, 150e6, 500e6, null, null, null],
    help: 'Wings for atmospheric flight: air Hnd +4, SR +1; wheels landing gear.',
  },
  stealth: {
    name: 'Stealth hull', tl: 8,
    cost: [125e3, 200e3, 500e3, 1e6, 2e6, 5e6, 10e6, 20e6, 50e6, 100e6, 200e6, 500e6],
    help: 'Radar-absorbing hull: -(TL-6)×2 to detect.',
  },
  dynamicChameleon: {
    name: 'Dynamic chameleon', tl: 10,
    cost: [90e3, 180e3, 350e3, 700e3, 1.5e6, 3.5e6, 7e6, 15e6, 35e6, 70e6, 150e6, 350e6],
    help: 'Adaptive camouflage skin: -4 to visual detection.',
  },
  hardenedArmor: {
    name: 'Hardened armor', tl: 7, costMult: 2,
    help: 'Doubles each armor system’s cost; reduces attackers’ armor divisors one step. Not ice/stone/organic.',
  },
  totalAutomation: {
    name: 'Total automation', tl: 9, costPerWorkspace: 5e6,
    help: 'Eliminates all workspaces ($5M per workspace removed). -1 HT at TL7-9.',
  },
  highAutomation: {
    name: 'High automation', tl: 9, minSM: 12, costPerWorkspace: 1e6,
    help: 'Divides workspaces by 10 ($1M per workspace removed). SM+12+ only.',
  },
  emergencyEjection: {
    name: 'Emergency ejection', tl: 7, maxSM: 8,
    cost: [50e3, 500e3, 500e3, 500e3, 500e3, null, null, null, null, null, null, null],
    help: 'Control room ejects as an escape capsule in 1 second (an ejection seat at SM+4).',
  },
};

// --- Finalization ----------------------------------------------------------
export function baseHT() { return 13; }

// Hnd modifier by best acceleration (use the lower band between steps).
export function hndAccelMod(g) {
  if (g >= 1000) return 3;
  if (g >= 100) return 2;
  if (g >= 10) return 1;
  if (g >= 1) return 0;
  if (g >= 0.1) return -1;
  if (g >= 0.01) return -2;
  if (g > 0) return -3;
  return 0;
}

// Air speed for flight-capable ships: sqrt(G) × 2,500 mph streamlined
// (÷10 unstreamlined), rounded to the nearest 100 (1,000 if ≥ 10,000).
export function airSpeed(g, streamlined) {
  if (g <= 0) return 0;
  let mph = Math.sqrt(g) * 2500 * (streamlined ? 1 : 0.1);
  const step = mph >= 10000 ? 1000 : 100;
  return Math.round(mph / step) * step;
}

export const OCCUPANT_LOAD_TONS = 0.1; // per occupant, added to Load

// Format $ in the book's K/M/B/T style.
export function fmtCost(x) {
  const units = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  for (const [div, suffix] of units) {
    if (Math.abs(x) >= div) {
      const v = x / div;
      return `$${v >= 100 ? Math.round(v) : Math.round(v * 10) / 10}${suffix}`;
    }
  }
  return `$${Math.round(x)}`;
}
