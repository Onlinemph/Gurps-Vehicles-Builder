// ---------------------------------------------------------------------------
// GURPS Vehicles 2e ("VE2") design engine — core tables.
//
// These tables implement the design *rules* (game mechanics) of the GURPS
// Vehicles, Second Edition design system so that designs can be computed;
// no rules text is reproduced. Page references are to that book.
// ---------------------------------------------------------------------------

// --- Structure (p. VE18-19) ------------------------------------------------
// Basic design weight (lbs) and cost ($) per square foot of structural area,
// by structure TL.
export const STRUCTURE_TL = [
  { minTL: 12, weight: 1, cost: 50 },
  { minTL: 11, weight: 1.5, cost: 50 },
  { minTL: 10, weight: 2, cost: 50 },
  { minTL: 9, weight: 3, cost: 50 },
  { minTL: 8, weight: 4, cost: 50 },
  { minTL: 7, weight: 6, cost: 50 },
  { minTL: 6, weight: 8, cost: 10 },
  { minTL: 5, weight: 12, cost: 5 },
  { minTL: 2, weight: 18, cost: 5 },
  { minTL: 0, weight: 20, cost: 5 },
];

export function structureTL(tl) {
  return STRUCTURE_TL.find((row) => tl >= row.minTL) || STRUCTURE_TL.at(-1);
}

export const FRAME_STRENGTHS = {
  superLight: { name: 'Super-Light', weight: 0.1, cost: 0.1, hp: 0.1 },
  extraLight: { name: 'Extra-Light', weight: 0.25, cost: 0.25, hp: 0.25 },
  light: { name: 'Light', weight: 0.5, cost: 0.5, hp: 0.5 },
  medium: { name: 'Medium', weight: 1, cost: 1, hp: 1 },
  heavy: { name: 'Heavy', weight: 1.5, cost: 2, hp: 1.5 },
  extraHeavy: { name: 'Extra-Heavy', weight: 2, cost: 5, hp: 2 },
};

export const MATERIALS = {
  veryCheap: { name: 'Very Cheap', weight: 2, cost: 0.2, minTL: 0 },
  cheap: { name: 'Cheap', weight: 1.5, cost: 0.5, minTL: 0 },
  standard: { name: 'Standard', weight: 1, cost: 1, minTL: 0 },
  expensive: { name: 'Expensive', weight: 0.75, cost: 2, minTL: 0 },
  veryExpensive: { name: 'Very Expensive', weight: 0.5, cost: 5, minTL: 5 },
  advanced: { name: 'Advanced', weight: 0.375, cost: 10, minTL: 6 },
};

export const SPECIAL_STRUCTURES = {
  none: { name: 'None', weight: 1, cost: 1, minTL: 0 },
  responsive: { name: 'Responsive', weight: 1, cost: 1.5, minTL: 8 },
  robotic: { name: 'Robotic', weight: 1, cost: 2, minTL: 7 },
  biomechanical: { name: 'Biomechanical', weight: 1, cost: 1.5, minTL: 9 },
  livingMetal: { name: 'Living Metal', weight: 1, cost: 2, minTL: 13 },
};

// Structure cost multipliers from other body features.
export const STRUCTURE_MODIFIERS = {
  submersible: { weight: 2, cost: 2 },
  wingsOrRotors: { weight: 1, cost: 10 },
  liftingBody: { weight: 1, cost: 1.2 },
  flexibodyDrivetrain: { weight: 2, cost: 2 },
};

// --- Streamlining (p. VE11) ------------------------------------------------
export const STREAMLINING = {
  none: { name: 'None', minTL: 0, structCost: 1, bodyVolume: 1 },
  fair: { name: 'Fair', minTL: 1, structCost: 1.2, bodyVolume: 1.1 },
  good: { name: 'Good', minTL: 5, structCost: 1.5, bodyVolume: 1.2 },
  veryGood: { name: 'Very Good', minTL: 6, structCost: 2, bodyVolume: 1.25 },
  superior: { name: 'Superior', minTL: 6, structCost: 3, bodyVolume: 1.3 },
  excellent: { name: 'Excellent', minTL: 6, structCost: 5, bodyVolume: 1.35 },
  radical: { name: 'Radical', minTL: 6, structCost: 10, bodyVolume: 1.4 },
};

// --- Hydrodynamic lines (p. VE10) ------------------------------------------
export const HYDRO_LINES = {
  none: { name: 'None (not hydrodynamic)', flotation: 62.5, bodyVolume: 1 },
  mediocre: { name: 'Mediocre', flotation: 57, bodyVolume: 1.1 },
  average: { name: 'Average', flotation: 52, bodyVolume: 1.2 },
  fine: { name: 'Fine', flotation: 48, bodyVolume: 1.3 },
  veryFine: { name: 'Very Fine', flotation: 45, bodyVolume: 1.3 },
  submarine: { name: 'Submarine (TL7)', flotation: 62.5, bodyVolume: 1.2, minTL: 7 },
};

export const FLOTATION_SUBMERSIBLE = 62.5; // lbs per cf regardless of lines

// Body volume multipliers for other features (p. VE15).
export const BODY_VOLUME_MULTS = {
  submersibleHull: 1.25,
  catamaran: 1.3,
  retractIntoBody: 1.075,
  retractIntoBodyAndWings: 1.025,
};

// Slope: total degrees across all faces -> volume multiplier (p. VE15).
export const SLOPE_VOLUME = [
  [0, 1], [30, 1.1], [60, 1.25], [90, 1.4], [120, 1.6],
  [150, 2], [180, 2.5], [210, 3.3], [240, 5],
];

export function slopeVolumeMult(totalDegrees) {
  let mult = 1;
  for (const [deg, m] of SLOPE_VOLUME) if (totalDegrees >= deg) mult = m;
  return mult;
}

// Turret rotation space, as a multiple of turret volume (p. VE15).
export const TURRET_ROTATION_SPACE = {
  limited: 0.1,
  full: 0.2,
  popLimited: 1.1,
  popFull: 1.2,
};

// Open mount rotation volume multiplier.
export const OPEN_MOUNT_ROTATION = { none: 1, limited: 1.1, full: 1.2 };

// --- Subassembly volumes, as fraction of body volume (p. VE16-17) ----------
export const SUBASSEMBLY_VOLUME = {
  skids: 0.05,
  wheelsSmall: 0.05,       // small or retractable
  wheelsStandard: 0.1,
  wheelsHeavy: 0.2,        // heavy, off-road or railway
  tracks: 0.6,
  halftrack: 0.4,          // or skitrack
  gevSkirt: 0.6,
  sevSidewalls: 0.4,
  hydrofoils: 0.15,
  rotor: 0.02,             // autogyro/TTR/CAR; per main rotor for MMR
  stubWing: 0.02,          // per vehicle (both wings)
  wingTypical: 0.1,        // typical wing volume, per wing (designer's choice)
};

// Wing/rotor surface area multipliers (p. VE17).
export const WING_AREA_MULT = {
  standard: 1.5,
  flarecraft: 1.5,
  highAgility: 2,
  stol: 2,
  biplane: 3,
  rotor: 3,
  triplane: 4,
};

// --- Surface area (p. VE17-18) ---------------------------------------------
// Area Table: [minVolume (cf), area (sf)] — pick the last row whose minimum
// is <= volume ("if a value falls between two numbers, use the lower").
export const AREA_TABLE = [
  [0, 0.5], [0.03, 1], [0.07, 1.5], [0.13, 2], [0.2, 2.5], [0.27, 3],
  [0.4, 4], [0.6, 5], [0.8, 6], [1.1, 7], [1.3, 8], [1.6, 9], [1.9, 10],
  [2.3, 11], [2.6, 12], [2.9, 13], [3.3, 14], [3.6, 15], [4.0, 16],
  [4.4, 17], [4.8, 18], [5.2, 19], [5.7, 20], [6.1, 21], [6.6, 22],
  [7.1, 23], [7.5, 24], [8.1, 25], [8.5, 27], [9.6, 30], [12, 40],
  [18, 50], [25, 60], [32, 75], [45, 100], [69, 125], [96, 150],
  [126, 175], [158, 200], [189, 250], [269, 300], [354, 400], [544, 500],
  [760, 600], [1001, 800], [1541, 1000], [2151, 1200], [2831, 1500],
  [3376, 2000], [6081, 2500], [8496, 3000], [11181, 4000], [17186, 5000],
  [24111, 6500], [35651, 8000], [48651, 10000], [68026, 12000],
  [89441, 15000], [125001, 20000], [192421, 25000], [268961, 30000],
  [353451, 40000], [544336, 50000], [760611, 60000],
];

// Surface area from volume. Uses the book's table up to 1,000,000 cf, the
// formula (6 × cbrt(V)²) above that — or always the formula if exact=true.
export function surfaceArea(volumeCf, exact = false) {
  if (volumeCf <= 0) return 0;
  if (exact || volumeCf > 1000000) {
    const area = 6 * Math.cbrt(volumeCf) ** 2;
    return volumeCf > 1000000 ? Math.round(area / 10000) * 10000 : area;
  }
  let area = AREA_TABLE[0][1];
  for (const [minV, a] of AREA_TABLE) if (volumeCf >= minV) area = a;
  return area;
}

// Mast volume (p. VE17): (height in feet)³ / 10,000.
export function mastVolume(heightFt) {
  return heightFt ** 3 / 10000;
}

// Structural surface area = total area minus masts, open mounts and gasbags.
// (p. VE18)

// Weapon volume (p. VE12): weight/50 cf normally, weight/20 if concealed.
export const WEAPON_VOLUME_DIVISOR = { normal: 50, concealed: 20 };

// --- Masts, open mounts, gasbags (p. VE19) ---------------------------------
// Weight per sf by TL; cost per sf. These don't count as structural area.
export const MAST_OPEN_MOUNT = {
  weightBySf: { 0: 12, 6: 8, 7: 6, 8: 4, 9: 3, 10: 2, 11: 1.5, 12: 1 },
  costPerSf: 10,
};
export const GASBAG = {
  weightBySf: { 0: 0.012, 6: 0.008, 7: 0.006, 8: 0.004, 9: 0.003, 10: 0.002, 11: 0.0015, 12: 0.001 },
  costBySf: { 0: 0.003, 6: 0.005, 7: 0.01 },
};

// --- Hit points (p. VE20) --------------------------------------------------
// Base HP = location area × factor (divided among identical locations where
// noted), then modified by frame strength.
export const HP_FACTORS = {
  body: 1.5,
  arm: 3,                 // per arm, its own area
  superstructure: 1.5,
  turret: 1.5,
  pod: 1.5,
  leg: 1.5,
  wing: 1.5,
  rotor: 3,
  gevSkirt: 1.5,
  sevSidewalls: 1.5,
  skid: 1.5,              // subassembly area × 1.5 / number of skids
  track: 1.5,             // subassembly area × 1.5 / number of tracks
  gasbag: 0.01,
  mast: 2,
  openMount: 2,
  wheel: 3,               // subassembly area × 3 / number of wheels
};

// Frame strength HP multiplier (gasbags, masts, open mounts are exempt).
export const HP_FRAME_MULT = {
  superLight: 0.1, extraLight: 0.25, light: 0.5,
  medium: 1, heavy: 2, extraHeavy: 4,
};

export function locationHP(area, factor, frameKey, count = 1) {
  const mult = HP_FRAME_MULT[frameKey] ?? 1;
  return Math.max(Math.round((area * factor * mult) / count), 1);
}

// --- Armor (p. VE21-23) ----------------------------------------------------
// Weight modifier = lbs per point of DR per sf of area, keyed by TL (lookup:
// highest key <= TL; absent below the lowest key). Cost is $ per lb of armor.
export const ARMOR_TYPES = {
  woodCheap: { name: 'Wood, cheap', group: 'wood', costPerLb: 0.1, w: { 0: 1.1 } },
  woodStandard: { name: 'Wood, standard', group: 'wood', costPerLb: 0.25, w: { 0: 1 } },
  woodExpensive: { name: 'Wood, expensive', group: 'wood', costPerLb: 0.5, w: { 0: 0.9 } },
  woodAdvanced: { name: 'Wood, advanced', group: 'wood', costPerLb: 1, w: { 10: 0.6, 11: 0.4, 12: 0.3, 13: 0.2 } },
  metalCheap: { name: 'Metal, cheap', group: 'metal', costPerLb: 1, w: { 6: 0.7, 7: 0.6, 8: 0.5, 9: 0.4, 10: 0.25, 11: 0.15, 12: 0.1, 13: 0.06 } },
  metalStandard: { name: 'Metal, standard', group: 'metal', costPerLb: 2, w: { 5: 0.7, 6: 0.6, 7: 0.5, 8: 0.4, 9: 0.25, 10: 0.15, 11: 0.1, 12: 0.06, 13: 0.04 } },
  metalExpensive: { name: 'Metal, expensive', group: 'metal', costPerLb: 6, w: { 0: 0.7, 5: 0.6, 6: 0.5, 7: 0.4, 8: 0.25, 9: 0.15, 10: 0.1, 11: 0.06, 12: 0.04, 13: 0.025 } },
  metalAdvanced: { name: 'Metal, advanced', group: 'metal', costPerLb: 20, w: { 6: 0.4, 7: 0.25, 8: 0.15, 9: 0.1, 10: 0.06, 11: 0.04, 12: 0.025, 13: 0.015 } },
  ablativeCheap: { name: 'Ablative, cheap', group: 'ablative', costPerLb: 0.2, w: { 7: 0.3, 8: 0.1, 9: 0.08, 10: 0.05, 11: 0.03, 12: 0.02, 13: 0.012 } },
  ablativeStandard: { name: 'Ablative, standard', group: 'ablative', costPerLb: 0.5, w: { 7: 0.25, 8: 0.08, 9: 0.05, 10: 0.03, 11: 0.02, 12: 0.012, 13: 0.008 } },
  ablativeExpensive: { name: 'Ablative, expensive', group: 'ablative', costPerLb: 2, w: { 7: 0.1, 8: 0.05, 9: 0.03, 10: 0.02, 11: 0.012, 12: 0.008, 13: 0.005 } },
  ablativeAdvanced: { name: 'Ablative, advanced', group: 'ablative', costPerLb: 8, w: { 7: 0.08, 8: 0.03, 9: 0.02, 10: 0.012, 11: 0.008, 12: 0.005, 13: 0.003 } },
  nonrigidEarly: { name: 'Nonrigid (TL6-)', group: 'nonrigid', costPerLb: 5, w: { 0: 0.06, 7: 0.055, 8: 0.05, 9: 0.045, 10: 0.04, 11: 0.03, 12: 0.02, 13: 0.015 } },
  nonrigidAdvanced: { name: 'Nonrigid (TL7+)', group: 'nonrigid', costPerLb: 100, w: { 7: 0.045, 8: 0.04, 9: 0.03, 10: 0.02, 11: 0.015, 12: 0.008, 13: 0.005 } },
  reflex: { name: 'Reflex', group: 'reflex', costPerLb: 400, w: { 10: 0.03, 11: 0.02, 12: 0.012, 13: 0.008 } },
  compositeCheap: { name: 'Composite, cheap', group: 'composite', costPerLb: 1.5, w: { 8: 0.4, 9: 0.25, 10: 0.15, 11: 0.1, 12: 0.06, 13: 0.04 } },
  compositeStandard: { name: 'Composite, standard', group: 'composite', costPerLb: 5, w: { 7: 0.4, 8: 0.25, 9: 0.15, 10: 0.1, 11: 0.06, 12: 0.04, 13: 0.025 } },
  compositeExpensive: { name: 'Composite, expensive', group: 'composite', costPerLb: 15, w: { 7: 0.25, 8: 0.15, 9: 0.1, 10: 0.06, 11: 0.04, 12: 0.025, 13: 0.015 } },
  compositeAdvanced: { name: 'Composite, advanced', group: 'composite', costPerLb: 50, w: { 7: 0.15, 8: 0.1, 9: 0.06, 10: 0.04, 11: 0.025, 12: 0.015, 13: 0.01 } },
  laminateCheap: { name: 'Laminate, cheap', group: 'laminate', costPerLb: 3, w: { 8: 0.4, 9: 0.25, 10: 0.15, 11: 0.1, 12: 0.06, 13: 0.04 } },
  laminateStandard: { name: 'Laminate, standard', group: 'laminate', costPerLb: 10, w: { 7: 0.4, 8: 0.25, 9: 0.15, 10: 0.1, 11: 0.06, 12: 0.04, 13: 0.025 } },
  laminateExpensive: { name: 'Laminate, expensive', group: 'laminate', costPerLb: 30, w: { 7: 0.25, 8: 0.15, 9: 0.1, 10: 0.06, 11: 0.04, 12: 0.025, 13: 0.015 } },
  laminateAdvanced: { name: 'Laminate, advanced', group: 'laminate', costPerLb: 100, w: { 7: 0.15, 8: 0.1, 9: 0.06, 10: 0.04, 11: 0.025, 12: 0.015, 13: 0.01 } },
};

export function armorWeightMod(typeKey, tl) {
  const type = ARMOR_TYPES[typeKey];
  if (!type) return null;
  let best = null;
  for (const [k, v] of Object.entries(type.w)) {
    const key = Number(k);
    if (tl >= key && (best === null || key > best.key)) best = { key, v };
  }
  return best ? best.v : null; // null = not available at this TL
}

// Armor weight = area × weightMod × DR; cost = weight × costPerLb.
// Location armor by facing: each body face is 1/6 of body area, each
// turret/superstructure face 1/5 of its area.
export const BODY_FACES = 6;
export const TURRET_FACES = 5;

// Slope effects on the sloped face's armor (p. VE22-23).
export const SLOPE_DR_MULT = { 0: 1, 30: 1.5, 60: 2 };
export const SLOPE_PD_BONUS = { 0: 0, 30: 1, 60: 2 }; // metal/composite/laminate only

// Passive Defense from DR (p. VE23).
export function pdFromDR(dr) {
  if (dr <= 0) return 0;
  if (dr === 1) return 1;
  if (dr <= 4) return 2;
  if (dr <= 15) return 3;
  return 4; // wood max PD 3, nonrigid max PD 2 — enforce at call site
}

// Sealing (p. VE23): cost per sf of structural area.
export const SEALED_COST_PER_SF = { 5: 40, 8: 20, 9: 10 };
export const WATERPROOF_COST_PER_SF = 2;

// --- Statistics (p. VE24-25) -----------------------------------------------
// Usual internal payload: 200 lbs per person, 20 lbs per cf of cargo space.
export const PAYLOAD_PER_PERSON = 200;
export const PAYLOAD_PER_CARGO_CF = 20;

// Size Modifier from total volume: first threshold >= volume ("use the
// higher one"). Extrapolates by the table's ×3.16 / +1 SM pattern.
export const SM_TABLE = [
  [0.1, -4], [0.3, -3], [1, -2], [3, -1], [10, 0], [30, 1], [100, 2],
  [300, 3], [1000, 4], [3000, 5], [10000, 6], [30000, 7], [100000, 8],
  [300000, 9], [1000000, 10], [3000000, 11], [10000000, 12],
];

export function sizeModifier(volumeCf) {
  if (volumeCf <= 0) return -4;
  for (const [vol, sm] of SM_TABLE) if (volumeCf <= vol) return sm;
  // Beyond the table: each ×10 volume is +2 SM.
  return Math.ceil(12 + 2 * Math.log10(volumeCf / 10000000));
}

// Structural HT = (200 × body HP / loaded weight) + 5, capped at
// max(12, TL), rounded to nearest (p. VE25).
export function structuralHT(bodyHP, loadedWeight, tl) {
  if (loadedWeight <= 0) return 12;
  const ht = 200 * bodyHP / loadedWeight + 5;
  return Math.min(Math.round(ht), Math.max(12, tl));
}

// --- Fuel (p. VE84 Reaction Mass and Fuel Table) ---------------------------
// lbs per gallon; cost per gallon at TL7+ (divide by 5 at TL6-); fire number
// on 3d (null = won't ignite).
export const FUELS = {
  alcohol: { name: 'Alcohol', lbsPerGal: 5.8, costPerGal: 0.5, fire: 10 },
  avgas: { name: 'Aviation gas', lbsPerGal: 6.5, costPerGal: 2, fire: 13 },
  diesel: { name: 'Diesel', lbsPerGal: 6, costPerGal: 1.2, fire: 9 },
  gasoline: { name: 'Gasoline', lbsPerGal: 6, costPerGal: 1.5, fire: 11 },
  jetFuel: { name: 'Jet fuel', lbsPerGal: 6.5, costPerGal: 3, fire: 13 },
  rocketFuel: { name: 'Rocket fuel', lbsPerGal: 10, costPerGal: 2, fire: 13 },
  water: { name: 'Water', lbsPerGal: 8.5, costPerGal: 0, fire: null },
  hydrogen: { name: 'Hydrogen', lbsPerGal: 0.58, costPerGal: 0.1, fire: 13 },
  metalLox: { name: 'Metal/LOX', lbsPerGal: 12, costPerGal: 15, fire: 13 },
  lox: { name: 'Oxygen (LOX)', lbsPerGal: 9.6, costPerGal: 0.1, fire: 13 },
  propane: { name: 'Propane/LNG', lbsPerGal: 4.2, costPerGal: 0.5, fire: 13 },
};
