// ---------------------------------------------------------------------------
// GURPS Vehicles Builder — data tables
//
// All of the numbers that drive the design system live in this file, so the
// system can be tuned (or house-ruled) without touching the engine code.
// Weights are in pounds, speeds in mph, costs in GURPS $.
// ---------------------------------------------------------------------------

export const TL_MIN = 5;
export const TL_MAX = 12;
export const TLS = [5, 6, 7, 8, 9, 10, 11, 12];

export const OCCUPANT_WEIGHT = 200; // lbs per person, including personal gear

// Look up the value for the highest TL key <= tl. Returns undefined if the
// table has no key at or below tl.
export function tlLookup(table, tl) {
  let best;
  for (const key of Object.keys(table)) {
    const k = Number(key);
    if (k <= tl && (best === undefined || k > best)) best = k;
  }
  return best === undefined ? undefined : table[best];
}

// Structural cost per lb of frame weight, by TL.
export const FRAME_COST_PER_LB = { 5: 2, 6: 3, 7: 5, 8: 8, 9: 15, 10: 25, 11: 40, 12: 60 };

// Frame build options.
export const FRAME_QUALITIES = {
  standard: { name: 'Standard', weightMult: 1.0, costMult: 1.0, htMod: 0 },
  light: { name: 'Lightweight', weightMult: 0.75, costMult: 2.0, htMod: 0, note: 'Advanced materials; lighter but pricier.' },
  heavy: { name: 'Heavy-Duty', weightMult: 1.3, costMult: 0.8, htMod: 1, note: 'Rugged and cheap, but heavy. +1 HT.' },
};

export const STREAMLINING = {
  boxy: { name: 'Boxy / utilitarian', speedMult: 0.9 },
  standard: { name: 'Standard', speedMult: 1.0 },
  streamlined: { name: 'Streamlined', speedMult: 1.15 },
};

export const CAB_TYPES = {
  exposed: { name: 'Exposed (riders in the open)', code: 'E' },
  open: { name: 'Open cab / cockpit', code: 'O' },
  enclosed: { name: 'Enclosed cab (glazed)', code: 'G' },
};

// Cruise assumptions per environment: mechFrac is the fraction of rated power
// actually needed to hold cruise speed (used for electric range); fuelFrac is
// the fuel-flow fraction of full-power flow while cruising (used for fuel
// engines — higher than mechFrac because engines are less efficient at
// partial load).
export const ENVIRONMENTS = {
  ground: { mechFrac: 0.2, fuelFrac: 0.45 },
  water: { mechFrac: 0.4, fuelFrac: 0.6 },
  air: { mechFrac: 0.65, fuelFrac: 0.7 },
};

// ---------------------------------------------------------------------------
// Chassis types
//   kSpeed:    top speed = kSpeed * sqrt(hp per ton) * streamlining
//   kLen:      estimated length (yds) = kLen * (loaded tons)^(1/3)
//   armorK:    surface area (sq ft) = armorK * (frame capacity lbs)^(2/3)
//   structFrac: structure weight as a fraction of frame capacity
//   accelDiv:  acceleration (yd/s^2) = (hp per ton) / accelDiv
// ---------------------------------------------------------------------------
export const CHASSIS = {
  wheeled: {
    name: 'Wheeled (car / truck)', env: 'ground', minTL: 5,
    kSpeed: 11.5, kLen: 4.0, armorK: 1.0, structFrac: 0.22,
    hnd: 0, sr: 4, accelDiv: 20, hasWheels: true,
  },
  motorcycle: {
    name: 'Motorcycle / trike', env: 'ground', minTL: 6,
    kSpeed: 10, kLen: 3.0, armorK: 0.8, structFrac: 0.25,
    hnd: 1, sr: 2, accelDiv: 15, hasWheels: true, defaultWheels: 2, defaultCab: 'exposed',
  },
  tracked: {
    name: 'Tracked (tank / dozer)', env: 'ground', minTL: 6,
    kSpeed: 9, kLen: 2.2, armorK: 0.75, structFrac: 0.28,
    hnd: -1, sr: 5, accelDiv: 25, locCode: 'C',
  },
  halftrack: {
    name: 'Half-track', env: 'ground', minTL: 6,
    kSpeed: 9.5, kLen: 3.0, armorK: 0.85, structFrac: 0.26,
    hnd: -1, sr: 4, accelDiv: 22, hasWheels: true, defaultWheels: 2, locCode: 'C',
  },
  hovercraft: {
    name: 'Hovercraft (ACV)', env: 'ground', minTL: 7,
    kSpeed: 8, kLen: 3.5, armorK: 1.0, structFrac: 0.25,
    hnd: -2, sr: 3, accelDiv: 18, locCode: 'Sk',
    note: 'Travels over flat ground and water alike.',
  },
  boat: {
    name: 'Boat / ship (displacement hull)', env: 'water', minTL: 5,
    kSpeed: 4.5, kLen: 5.5, armorK: 1.1, structFrac: 0.30,
    hnd: -1, sr: 4, accelDiv: 30, hullSpeedCap: true,
  },
  planingBoat: {
    name: 'Speedboat (planing hull)', env: 'water', minTL: 6,
    kSpeed: 6, kLen: 5.0, armorK: 1.0, structFrac: 0.28,
    hnd: 0, sr: 3, accelDiv: 20, minHpTon: 20,
    note: 'Needs at least 20 hp/ton to get on plane; below that it behaves as a displacement hull.',
  },
  submarine: {
    name: 'Submarine', env: 'water', minTL: 6,
    kSpeed: 3.5, kLen: 6.0, armorK: 1.0, structFrac: 0.40,
    hnd: -2, sr: 5, accelDiv: 40, sealed: true, defaultCab: 'enclosed', noCabCode: true,
    note: 'Submerged endurance needs electric or fusion propulsion.',
  },
  airplane: {
    name: 'Airplane (fixed wing)', env: 'air', minTL: 6,
    kSpeed: 11, kLen: 9.0, armorK: 1.3, structFrac: 0.25,
    hnd: 1, sr: 2, accelDiv: 25, minHpTonFly: 40, stallFrac: 0.25,
    hasWheels: true, defaultWheels: 3, locCode: 'Wi',
  },
  helicopter: {
    name: 'Helicopter', env: 'air', minTL: 7,
    kSpeed: 9, kLen: 8.0, armorK: 1.2, structFrac: 0.28,
    hnd: 0, sr: 2, accelDiv: 25, minHpTonFly: 60, capMph: 220, locCode: 'R',
  },
  airship: {
    name: 'Airship / blimp', env: 'air', minTL: 6,
    kSpeed: 6, kLen: 14.0, armorK: 1.5, structFrac: 0.35,
    hnd: -2, sr: 3, accelDiv: 60, capMph: 90,
    note: 'Lift is assumed from the gas envelope; frame capacity is total lift.',
  },
};

// Basic Set size table (longest dimension in yards -> SM), with entries below
// one yard for completeness. Vehicles then take -1 for being "long boxes"
// rather than upright figures.
export const SIZE_TABLE = [
  [0.33, -3], [0.5, -2], [0.7, -1], [1, 0], [1.5, 1], [2, 2], [3, 3],
  [5, 4], [7, 5], [10, 6], [15, 7], [20, 8], [30, 9], [50, 10],
  [70, 11], [100, 12], [150, 13], [200, 14],
];

export function smFromYards(yards) {
  for (const [len, sm] of SIZE_TABLE) {
    if (yards <= len) return sm;
  }
  return 15;
}

// ---------------------------------------------------------------------------
// Propulsion
//   lbPerHp / costPerHp are TL tables.
//   fuel.lbPerHpHr is full-power fuel flow; cruise flow applies the
//   environment's fuelFrac.
// ---------------------------------------------------------------------------
export const ENGINES = {
  gasoline: {
    name: 'Gasoline engine', minTL: 6, flammable: true,
    lbPerHp: { 6: 8, 7: 5, 8: 3, 9: 2.5, 10: 2, 11: 1.8, 12: 1.5 },
    costPerHp: { 6: 20, 7: 15, 8: 12 },
    fuel: { label: 'Gasoline', lbPerGal: 6, lbPerHpHr: 0.20 },
  },
  diesel: {
    name: 'Diesel engine', minTL: 6, flammable: false,
    lbPerHp: { 6: 12, 7: 8, 8: 5, 9: 3.5, 10: 3, 11: 2.5, 12: 2 },
    costPerHp: { 6: 25, 7: 18, 8: 14, 9: 12 },
    fuel: { label: 'Diesel', lbPerGal: 7, lbPerHpHr: 0.16 },
  },
  gasTurbine: {
    name: 'Gas turbine', minTL: 7, flammable: true,
    lbPerHp: { 7: 1.6, 8: 1.1, 9: 0.9, 10: 0.7, 11: 0.6, 12: 0.5 },
    costPerHp: { 7: 40, 8: 30, 9: 25 },
    fuel: { label: 'Jet fuel', lbPerGal: 6.7, lbPerHpHr: 0.30 },
  },
  steam: {
    name: 'Steam engine', minTL: 5, flammable: false,
    lbPerHp: { 5: 60, 6: 30, 7: 20, 8: 15 },
    costPerHp: { 5: 8, 6: 8, 7: 10, 8: 12 },
    fuel: { label: 'Coal / wood', lbPerGal: null, lbPerHpHr: 1.2 },
  },
  electric: {
    name: 'Electric motor + batteries', minTL: 6, flammable: false, electric: true,
    lbPerHp: { 6: 6, 7: 4, 8: 2.5, 9: 1.5, 10: 1, 11: 0.8, 12: 0.6 },
    costPerHp: { 6: 20, 7: 15, 8: 12 },
    whPerLbBattery: { 6: 5, 7: 15, 8: 80, 9: 250, 10: 700, 11: 1800, 12: 4500 },
    costPerLbBattery: { 6: 2, 7: 4, 8: 5, 9: 8, 10: 12, 11: 15, 12: 20 },
  },
  fusion: {
    name: 'Fusion plant', minTL: 10, flammable: false, unlimited: true,
    lbPerHp: { 10: 2, 11: 1, 12: 0.5 },
    costPerHp: { 10: 100, 11: 60, 12: 40 },
  },
  sail: {
    name: 'Sails', minTL: 5, flammable: false, unlimited: true, sail: true,
    envOnly: 'water', note: 'Top speed is 90% of hull speed; wind permitting.',
  },
  pedal: {
    name: 'Pedal / muscle power', minTL: 5, flammable: false, unlimited: true, pedal: true,
    hpPerCrew: 0.4, lbPerStation: 25, costPerStation: 200,
  },
};

// ---------------------------------------------------------------------------
// Armor
// ---------------------------------------------------------------------------
export const ARMOR_MATERIALS = {
  wood: { name: 'Wood', minTL: 5, lbPerDRSqFt: 1.7, costPerLb: 0.4 },
  iron: { name: 'Iron', minTL: 5, lbPerDRSqFt: 0.9, costPerLb: 0.8 },
  steel: { name: 'Steel', minTL: 6, lbPerDRSqFt: 0.7, costPerLb: 1 },
  hardSteel: { name: 'Hardened steel', minTL: 6, lbPerDRSqFt: 0.58, costPerLb: 2.5 },
  aluminum: { name: 'Aluminum alloy', minTL: 6, lbPerDRSqFt: 0.65, costPerLb: 4 },
  titanium: { name: 'Titanium alloy', minTL: 7, lbPerDRSqFt: 0.45, costPerLb: 25 },
  composite: { name: 'Composite laminate', minTL: 8, lbPerDRSqFt: 0.30, costPerLb: 15 },
  advComposite: { name: 'Advanced composite', minTL: 9, lbPerDRSqFt: 0.18, costPerLb: 35 },
  nanoweave: { name: 'Nanocomposite', minTL: 10, lbPerDRSqFt: 0.10, costPerLb: 60 },
};

// How the hull surface divides among facings.
export const FACINGS = [
  { key: 'front', name: 'Front', frac: 0.15 },
  { key: 'sides', name: 'Sides', frac: 0.25 },
  { key: 'rear', name: 'Rear', frac: 0.15 },
  { key: 'top', name: 'Top', frac: 0.25 },
  { key: 'under', name: 'Underside', frac: 0.20 },
];

// ---------------------------------------------------------------------------
// Crew stations and seating
// ---------------------------------------------------------------------------
export const SEATS = {
  crew: { weight: 60, cost: 1000 },      // includes controls & instruments
  passenger: { weight: 40, cost: 200 },
};

// ---------------------------------------------------------------------------
// Accessories. weight = base + frac * frame capacity.
// `only` restricts to chassis keys or env names.
// ---------------------------------------------------------------------------
export const ACCESSORIES = {
  headlights: { name: 'Headlights', minTL: 6, base: 5, frac: 0, cost: 100 },
  radio: { name: 'Radio', minTL: 6, base: 10, frac: 0, cost: 250 },
  navigation: { name: 'Satellite/inertial navigation', minTL: 8, base: 2, frac: 0, cost: 300 },
  autopilot: { name: 'Autopilot', minTL: 7, base: 15, frac: 0, cost: 3000 },
  selfDriving: { name: 'Autonomous pilot (self-driving)', minTL: 9, base: 10, frac: 0, cost: 8000, note: 'Drives itself; IQ 10 chauffeur.' },
  searchlight: { name: 'Searchlight', minTL: 6, base: 20, frac: 0, cost: 500 },
  siren: { name: 'Siren / PA', minTL: 6, base: 8, frac: 0, cost: 250 },
  winch: { name: 'Winch', minTL: 6, base: 50, frac: 0.005, cost: 800 },
  offroad: { name: 'Off-road suspension', minTL: 6, base: 0, frac: 0.02, cost: 2000, only: ['wheeled', 'motorcycle', 'halftrack'], note: '+1 Hnd off-road; halves bad-ground penalties.' },
  runflat: { name: 'Run-flat / puncture-proof tires', minTL: 7, base: 0, frac: 0.01, cost: 1200, only: ['wheeled', 'motorcycle', 'halftrack'] },
  sealedCab: { name: 'Sealed cab (NBC)', minTL: 7, base: 0, frac: 0.01, cost: 5000, note: 'Airtight; overpressure protection.' },
  climate: { name: 'Climate control', minTL: 7, base: 20, frac: 0.005, cost: 1500 },
  luxury: { name: 'Luxury interior', minTL: 6, base: 0, frac: 0.01, cost: 10000, note: '+1 reactions from passengers.' },
  ejection: { name: 'Ejection seat(s)', minTL: 7, base: 100, frac: 0, cost: 25000, only: ['airplane', 'helicopter'] },
  amphibious: { name: 'Amphibious kit', minTL: 6, base: 0, frac: 0.03, cost: 4000, only: ['wheeled', 'tracked', 'halftrack'], note: 'Water Move ~ 1/4 of ground Move.' },
  retractGear: { name: 'Retractable landing gear', minTL: 6, base: 0, frac: 0.01, cost: 2000, only: ['airplane'], note: 'Adds "r" to locations; +5% top speed already assumed if streamlined.' },
  smoke: { name: 'Smoke dischargers', minTL: 6, base: 20, frac: 0, cost: 600 },
  fireSuppression: { name: 'Fire suppression system', minTL: 7, base: 10, frac: 0.005, cost: 1200, note: "Removes the 'f' (flammable) HT suffix." },
  armoredGlass: { name: 'Armored windows', minTL: 7, base: 0, frac: 0.01, cost: 2500, note: 'Windows get DR 1/3 of body front DR (min 2).' },
};

// ---------------------------------------------------------------------------
// Weapons (generic presets; damage strings are flavor for the sheet).
// ---------------------------------------------------------------------------
export const WEAPONS = [
  { key: 'lmg', name: '7.62mm machine gun', minTL: 6, weight: 30, cost: 6000, dmg: '7d pi' },
  { key: 'hmg', name: '12.7mm heavy MG', minTL: 6, weight: 130, cost: 14000, dmg: '13d+1 pi+' },
  { key: 'agl', name: '40mm auto grenade launcher', minTL: 7, weight: 80, cost: 20000, dmg: '4d [2d] cr ex' },
  { key: 'ac25', name: '25mm autocannon', minTL: 7, weight: 250, cost: 60000, dmg: '6d×2 pi++' },
  { key: 'cannon120', name: '120mm tank gun', minTL: 7, weight: 4200, cost: 500000, dmg: '6d×15 pi++' },
  { key: 'atgm', name: 'ATGM launcher', minTL: 7, weight: 300, cost: 40000, dmg: '6d×6(10) cr ex' },
  { key: 'rockets', name: '70mm rocket pod', minTL: 7, weight: 500, cost: 30000, dmg: '6d×4 cr ex' },
  { key: 'waterCannon', name: 'Water cannon', minTL: 6, weight: 400, cost: 5000, dmg: 'spec. (knockback)' },
];

export const MOUNTS = {
  fixed: { name: 'Fixed (fires forward)', weightMult: 1.0, costMult: 1.0, code: null },
  open: { name: 'Open/pintle mount', weightMult: 1.2, costMult: 1.2, code: 't' },
  turret: { name: 'Turret', weightMult: 2.0, costMult: 1.5, code: 'T' },
};

export const LOCATION_LEGEND = [
  ['G', 'glazed (windowed) cab'],
  ['O', 'open cab or cockpit'],
  ['E', 'exposed riders'],
  ['nW', 'n wheels'],
  ['C', 'caterpillar tracks'],
  ['T', 'turret'],
  ['t', 'open weapon mount'],
  ['X', 'fixed external weapon'],
  ['Wi', 'wings'],
  ['R', 'rotors'],
  ['M', 'masts and rigging'],
  ['S', 'superstructure'],
  ['Sk', 'skirts (hovercraft)'],
  ['r', 'retractable landing gear'],
];
