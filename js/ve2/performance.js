// ---------------------------------------------------------------------------
// GURPS Vehicles 2e — performance calculations (book pp. VE128-136).
// Pure functions; each takes explicit numeric inputs and returns the derived
// stats with the book's rounding rules applied (raw values included).
// ---------------------------------------------------------------------------

// --- Rounding helpers (per the book's rules) -------------------------------
export function roundSpeed(mph) {
  return mph >= 20 ? Math.round(mph / 5) * 5 : Math.round(mph);
}

export function roundAccel(v) {
  // <1: one decimal; 1-5: nearest whole; >5: nearest 5.
  if (v < 1) return Math.round(v * 10) / 10;
  if (v <= 5) return Math.round(v);
  return Math.round(v / 5) * 5;
}

function roundGAccel(v) {
  return v < 5 ? Math.round(v) : Math.round(v / 5) * 5;
}

// --- Ground performance (p. VE128-130) -------------------------------------

// Speed factors by motive system.
export function groundSpeedFactor(system, tl, opts = {}) {
  let sf;
  switch (system) {
    case 'skids': sf = 6; break;
    case 'wheels': sf = tl <= 4 ? 8 : tl === 5 ? 12 : 16; break;
    case 'tracks': sf = tl <= 6 ? 10 : 12; break;
    case 'skitracks': sf = tl <= 6 ? 8 : 10; break;
    case 'halftracks': sf = tl <= 6 ? 12 : 14; break;
    case 'legs2': sf = 8; break;
    case 'legs3': sf = 10; break;
    case 'legs4': sf = 12; break;
    case 'flexibody': sf = 4; break;
    default: sf = 0;
  }
  if (opts.improvedSuspension) sf += system === 'wheels' ? 2 : 1;
  if (opts.railway && system === 'wheels') sf *= 2;
  return sf;
}

// motivePowerKw: drivetrain kW (+ harnessed animals) for wheels/tracks/etc.
// auxThrustLbs: sails/airscrews/jets/rockets/thrusters (wheels & skids only,
// contributes thrust/4).
export function groundSpeed({ system, tl, motivePowerKw = 0, auxThrustLbs = 0, loadedTons, streamlining = 'none', opts = {} }) {
  const sf = groundSpeedFactor(system, tl, opts);
  const usesAux = system === 'wheels' || system === 'skids';
  const effective = motivePowerKw + (usesAux ? auxThrustLbs / 4 : 0);
  if (effective <= 0 || loadedTons <= 0 || sf <= 0) {
    return { raw: 0, mph: 0, sf };
  }
  let speed = Math.sqrt(effective / loadedTons) * sf;
  if (speed >= 50 && streamlining !== 'none') {
    speed *= streamlining === 'fair' ? 1.05 : 1.1;
  }
  const goodPlus = !['none', 'fair'].includes(streamlining);
  if (!goodPlus) speed = Math.min(speed, 600);
  return { raw: speed, mph: roundSpeed(speed), sf };
}

export function gAccel({ topSpeed, sf, system = 'wheels', legs = 0 }) {
  if (sf <= 0) return { raw: 0, value: 0 };
  if (system.startsWith('legs')) {
    if (topSpeed < 30) {
      const raw = 4 * topSpeed / sf;
      return { raw, value: roundGAccel(raw) };
    }
    const bonus = legs === 2 ? 12 : legs === 3 ? 9.6 : 8;
    const raw = 0.8 * topSpeed / sf + bonus;
    return { raw, value: roundGAccel(raw) };
  }
  const raw = (topSpeed / sf) * 0.8;
  return { raw, value: roundGAccel(raw) };
}

export function gDecel({ system, improvedBrakes = false, smartwheels = false }) {
  let base;
  switch (system) {
    case 'skids': base = 5; break;
    case 'wheels': base = 10 + (improvedBrakes ? 5 : 0) + (smartwheels ? 5 : 0); break;
    case 'tracks': case 'halftracks': base = 20; break;
    case 'skitracks': base = 15; break;
    case 'legs2': case 'legs3': case 'legs4': base = 20; break;
    case 'flexibody': base = 20; break;
    default: base = 0;
  }
  return base;
}

// gMR/gSR table: rows by motive system key, 5 volume bands:
// <=30, 31-100, 101-300, 301-3000, 3001+ cf. Cells are [gMR, gSR].
const GMR_GSR = {
  skids: [[1.25, 2], [1, 3], [0.75, 3], [0.25, 4], [0.125, 4]],
  wheels1: [[1.5, 1], [1.25, 1], [0.5, 1], [0.25, 1], [0.125, 1]],
  wheels2: [[1.5, 2], [1.25, 2], [0.5, 2], [0.25, 2], [0.125, 2]],
  wheels3: [[1.25, 2], [1, 3], [0.75, 3], [0.25, 4], [0.125, 4]],
  wheels4to6: [[1, 3], [0.75, 4], [0.75, 4], [0.5, 4], [0.125, 4]],
  wheels8plus: [[0.75, 3], [0.5, 3], [0.25, 4], [0.25, 5], [0.125, 5]],
  tracks: [[0.5, 3], [0.25, 4], [0.25, 5], [0.25, 6], [0.125, 6]],
  skitracks: [[0.5, 3], [0.25, 4], [0.25, 4], [0.25, 5], [0.125, 5]],
  halftracks: [[0.5, 3], [0.25, 4], [0.25, 4], [0.25, 5], [0.125, 5]],
  legs2: [[2.5, 1], [2, 1], [1.5, 2], [1, 2], [0.5, 2]],
  legs3: [[2, 2], [1.5, 2], [1, 3], [0.75, 3], [0.5, 3]],
  legs4: [[1.25, 3], [1, 3], [0.75, 4], [0.5, 4], [0.5, 4]],
  flexibody: [[2.5, 3], [2, 3], [1.5, 4], [1, 4], [0.5, 4]],
};

function volumeBand(bodyVolumeCf) {
  if (bodyVolumeCf <= 30) return 0;
  if (bodyVolumeCf <= 100) return 1;
  if (bodyVolumeCf <= 300) return 2;
  if (bodyVolumeCf <= 3000) return 3;
  return 4;
}

export function gMRgSR({ system, wheelCount = 4, bodyVolumeCf, tl, opts = {} }) {
  let key = system;
  if (system === 'wheels') {
    key = wheelCount <= 1 ? 'wheels1' : wheelCount === 2 ? 'wheels2'
      : wheelCount === 3 ? 'wheels3' : wheelCount <= 6 ? 'wheels4to6' : 'wheels8plus';
  }
  const row = GMR_GSR[key];
  if (!row) return { gMR: 0, gSR: 0 };
  let [gMR, gSR] = row[volumeBand(bodyVolumeCf)];

  // gMR enhancements: +0.25 each (0.125 becomes 0.25 on the first one).
  const enhancements = [
    opts.improvedSuspension,
    opts.electronicControls || opts.computerizedControls,
    opts.responsiveStructure,
    system === 'wheels' && opts.allWheelSteering,
    system === 'wheels' && opts.smartwheels,
  ].filter(Boolean).length;
  for (let i = 0; i < enhancements; i++) {
    gMR = gMR === 0.125 ? 0.25 : gMR + 0.25;
  }
  if (opts.smallOrRailwayWheels || opts.harnessedAnimals || opts.sails || opts.unfoldedWingsOrRotors) {
    gMR = Math.min(gMR, 0.5);
  }

  if (opts.improvedSuspension) gSR += 1;
  if (opts.smallWheels) gSR -= 1;
  if (system.startsWith('legs') && tl <= 7) gSR -= 1;
  if (opts.wornAsHarness) gSR -= 1;
  return { gMR, gSR: Math.max(gSR, 1) };
}

// Ground pressure & off-road speed (p. VE130).
export function contactArea({ system, subassemblyArea, tl, wheelType = 'standard' }) {
  switch (system) {
    case 'wheels':
      if (wheelType === 'railway') return subassemblyArea / 66;
      if (wheelType === 'offroad') return subassemblyArea / 33;
      return subassemblyArea / (tl <= 5 ? 66 : 50);
    case 'tracks': return subassemblyArea / 5;
    case 'halftracks': return subassemblyArea / 20;
    case 'skitracks': return subassemblyArea / 10;
    case 'skids': return subassemblyArea / 10;
    case 'legs2': case 'legs3': case 'legs4': return subassemblyArea / 12.5;
    case 'flexibody': return subassemblyArea / 6;
    default: return 0;
  }
}

const GP_ROWS = [
  [150, 'extremely low', [1, 1, 4 / 5, 2 / 3]],
  [900, 'very low', [1, 4 / 5, 2 / 3, 1 / 2]],
  [1800, 'low', [4 / 5, 2 / 3, 1 / 2, 1 / 3]],
  [2700, 'moderate', [2 / 3, 1 / 2, 1 / 3, 1 / 4]],
  [7500, 'high', [1 / 2, 1 / 3, 1 / 4, 1 / 6]],
  [15000, 'very high', [1 / 3, 1 / 4, 1 / 6, 1 / 8]],
  [Infinity, 'extremely high', [1 / 4, 1 / 6, 1 / 8, 0]],
];

// category: 1 legs/flexibody, 2 tracks, 3 AWD wheels/halftrack/skitrack,
// 4 non-AWD wheels/skids.
export function groundPressure({ loadedLbs, contragravLift = 0, area, category }) {
  const effLbs = Math.max(loadedLbs - contragravLift, 0.1 * loadedLbs);
  const gp = area > 0 ? effLbs / area : Infinity;
  const row = GP_ROWS.find(([max]) => gp <= max);
  return { gp, label: row[1], offRoadFraction: row[2][category - 1] };
}

// --- Water performance (p. VE130-132) --------------------------------------

// Hl for hydrodynamic drag.
export const HYDRO_DRAG_HL = { none: 1, mediocre: 5, average: 10, fine: 15, veryFine: 20, submarine: 5 };
// Hl for draft (a different table sharing the symbol).
export const DRAFT_HL = { none: 1, mediocre: 1.1, average: 1.2, fine: 1.3, veryFine: 1.4, submarine: 2 };

export function hydroDrag({ loadedLbs, contragravLift = 0, lines = 'none', catamaran = false, trimaran = false }) {
  const effLbs = Math.max(loadedLbs - contragravLift, 0.1 * loadedLbs);
  let hl = HYDRO_DRAG_HL[lines] ?? 1;
  if (trimaran) hl *= 1.1;
  if (catamaran) hl *= 1.2;
  const raw = Math.cbrt(effLbs) ** 2 / hl;
  return { raw, value: Math.round(raw), hl };
}

export function waterSpeed({ aquaticThrustLbs, drag, streamlining = 'none', planingOk = null, hydrofoil = false, bodyArea = 0, surfaceSpeedForFoil = null }) {
  if (aquaticThrustLbs <= 0 || drag <= 0) return { raw: 0, mph: 0, planing: false, foilborne: false };
  let speed = Math.cbrt(aquaticThrustLbs / drag) * 6;
  let planing = false;
  if (planingOk) planing = true, speed *= 2;
  let foilborne = false;
  if (hydrofoil) {
    const threshold = 20 + bodyArea / 100;
    const check = surfaceSpeedForFoil ?? speed;
    if (check >= threshold) { foilborne = true; speed *= 1.5; }
  }
  if (speed >= 50 && streamlining !== 'none') {
    speed *= streamlining === 'fair' ? 1.05 : 1.1;
  }
  const vgPlus = ['veryGood', 'superior', 'excellent', 'radical'].includes(streamlining);
  if (!vgPlus) speed = Math.min(speed, 150);
  return { raw: speed, mph: roundSpeed(speed), planing, foilborne };
}

// Planing threshold: thrust >= [(Hl × 5) + 5]% of loaded weight.
export function canPlane({ aquaticThrustLbs, loadedLbs, hl }) {
  return aquaticThrustLbs >= ((hl * 5 + 5) / 100) * loadedLbs;
}

export function wAccel({ aquaticThrustLbs, loadedLbs }) {
  const raw = (aquaticThrustLbs / loadedLbs) * 20;
  return { raw, value: roundAccel(raw) };
}

// wMR/wSR table: rows by TL, 6 volume bands:
// <=100, <=1e3, <=1e4, <=1e5, <=1e6, >1e6 cf. Cells are [wMR, wSR].
const WMR_WSR = [
  [0, [[0.25, 1], [0.05, 2], [0.01, 3], [0.005, 4], [0.002, 5], [0.001, 5]]],
  [1, [[0.25, 1], [0.1, 2], [0.02, 3], [0.01, 4], [0.005, 6], [0.002, 6]]],
  [3, [[0.25, 2], [0.1, 3], [0.05, 4], [0.02, 5], [0.01, 6], [0.005, 7]]],
  [4, [[0.25, 2], [0.1, 3], [0.05, 4], [0.05, 5], [0.02, 6], [0.01, 7]]],
  [5, [[0.25, 3], [0.1, 4], [0.05, 5], [0.05, 6], [0.02, 7], [0.02, 8]]],
  [7, [[0.5, 3], [0.25, 4], [0.1, 5], [0.1, 6], [0.05, 7], [0.02, 8]]],
  [9, [[0.75, 4], [0.5, 5], [0.25, 6], [0.1, 6], [0.05, 7], [0.02, 8]]],
  [11, [[1, 4], [0.75, 5], [0.5, 6], [0.25, 6], [0.1, 7], [0.05, 8]]],
];

function waterVolumeBand(v) {
  if (v <= 100) return 0;
  if (v <= 1000) return 1;
  if (v <= 10000) return 2;
  if (v <= 100000) return 3;
  if (v <= 1000000) return 4;
  return 5;
}

export function wMRwSR({ tl, bodyVolumeCf, lines = 'none', opts = {} }) {
  let row = WMR_WSR[0][1];
  for (const [minTL, cells] of WMR_WSR) if (tl >= minTL) row = cells;
  let band = waterVolumeBand(bodyVolumeCf);

  // wMR: shift one band left per option; past the left edge, +0.25 each.
  const shifts = [
    opts.electronicControls || opts.computerizedControls,
    opts.responsiveStructure,
    opts.flexibodyPropulsion,
  ].filter(Boolean).length;
  let extra = 0;
  let mrBand = band;
  for (let i = 0; i < shifts; i++) {
    if (mrBand > 0) mrBand--;
    else extra += 0.25;
  }
  const wMR = row[mrBand][0] + extra;

  let wSR = row[band][1];
  if (opts.electronicControls || opts.computerizedControls) wSR += 1;
  if (opts.rollStabilizers) wSR += 1;
  if (lines === 'average') wSR -= 1;
  if (['fine', 'veryFine', 'submarine'].includes(lines)) wSR -= 2;
  if (opts.catamaran || opts.trimaran) wSR += 2;
  if (opts.sailAreaSf && opts.dragForSails) {
    const ratio = opts.sailAreaSf / opts.dragForSails;
    if (ratio > 20) wSR -= 2;
    else if (ratio >= 10) wSR -= 1;
  }
  return { wMR, wSR: Math.max(wSR, 1) };
}

export function wDecel({ wMR, hl, wAccelValue = 0 }) {
  const base = Math.min(100 * (wMR / hl), 10);
  return { base: Math.round(base * 10) / 10, withPower: Math.ceil(base + wAccelValue / 2) };
}

export function draft({ loadedLbs, contragravLift = 0, lines = 'none', foilborne = false }) {
  const effLbs = Math.max(loadedLbs - contragravLift, 0);
  let d = (Math.cbrt(effLbs) / 15) * (DRAFT_HL[lines] ?? 1);
  if (foilborne) d /= 2;
  return Math.round(d * 10) / 10;
}

// --- Submerged performance (p. VE132) --------------------------------------
export const SUB_DRAG_LS = { none: 1, mediocre: 2, average: 3, fine: 4, veryFine: 6, submarine: 10 };

export function submergedDrag({ submergedLbs, lines = 'none' }) {
  const raw = Math.cbrt(submergedLbs) ** 2 / (SUB_DRAG_LS[lines] ?? 1);
  return { raw, value: Math.round(raw) };
}

export function submergedSpeed({ thrustLbs, drag }) {
  if (thrustLbs <= 0 || drag <= 0) return { raw: 0, mph: 0 };
  const raw = Math.cbrt(thrustLbs / drag) * 6;
  return { raw, mph: roundSpeed(raw) };
}

export function uAccel({ thrustLbs, submergedLbs }) {
  const raw = (thrustLbs / submergedLbs) * 20;
  return { raw, value: roundAccel(raw) };
}

export function submergedDraft({ submergedLbs }) {
  return Math.round((Math.cbrt(submergedLbs) / 3) * 10) / 10;
}

// Crush depth in yards (p. VE132).
export function crushDepth({ lowestPressurizedDR, frame, submersibleHull = true }) {
  const frameMult = { extraLight: 0.25, light: 0.5, medium: 1, heavy: 2, extraHeavy: 4 }[frame] ?? 1;
  let depth = (lowestPressurizedDR + 10) * frameMult * 10;
  if (!submersibleHull) depth /= 2;
  return depth;
}

// --- Aerial performance (p. VE133-135) -------------------------------------
const STALL_SL = { none: 1, fair: 1, good: 1.05, veryGood: 1.1, superior: 1.15, excellent: 1.2, radical: 1.3 };
const DRAG_SL = { none: 1, fair: 2, good: 3, veryGood: 5, superior: 10, excellent: 20, radical: 40 };

// liftArea = all wing+rotor area (STOL ×1.5, flarecraft/rotors ×3 for this
// purpose) + 10% of body area (30% for lifting bodies).
export function stallSpeed({ loadedLbs, staticLift = 0, liftArea, streamlining = 'none', responsive = false }) {
  if (staticLift >= loadedLbs) return { raw: 0, mph: 0 };
  if (liftArea <= 0) return { raw: Infinity, mph: Infinity };
  const sl = STALL_SL[streamlining] ?? 1;
  const rs = responsive ? 1.5 : 2;
  const raw = ((loadedLbs - staticLift) / liftArea) * sl * rs;
  return { raw, mph: Math.round(raw / 5) * 5 };
}

export function aeroDrag({ totalAreaSf, retractableAreaSf = 0, streamlining = 'none', responsive = false, dragPenalty = 0 }) {
  let sl = DRAG_SL[streamlining] ?? 1;
  if (responsive) sl *= 1.2;
  const raw = (totalAreaSf - retractableAreaSf) / sl + dragPenalty;
  return { raw, value: raw };
}

export function aerialTopSpeed({ thrustLbs, drag, caps = [] }) {
  if (thrustLbs <= 0 || drag <= 0) return { raw: 0, mph: 0 };
  let raw = Math.sqrt(7500 * (thrustLbs / drag));
  for (const cap of caps) raw = Math.min(raw, cap);
  return { raw, mph: raw > 20 ? Math.round(raw / 5) * 5 : Math.round(raw) };
}

export function aAccel({ thrustLbs, loadedLbs }) {
  const raw = (thrustLbs / loadedLbs) * 20;
  return { raw, value: Math.round(raw) };
}

// aMR: pick the applicable formula(s), take the best.
export function aMR({ stallZero, tl, sizeModifier, wingRotorHP = 0, loadedLbs, wingTL = null,
  responsive = false, electronicControls = false, computerizedControls = false,
  highAgility = false, variableSweep = false, controlledInstability = false,
  mmrRotors = false, liftingBodyNoWings = false, hasWingsOrRotors = false }) {
  const candidates = [];
  if (stallZero) {
    let effTL = tl;
    if (responsive) effTL += 1;
    if (electronicControls || computerizedControls) effTL += 1;
    let v = (effTL - sizeModifier) / 2;
    if (v <= 0) v = 0.125;
    candidates.push(v);
  }
  if (liftingBodyNoWings) {
    let v = (electronicControls || computerizedControls) ? 0.25 : 0.125;
    if (responsive) v *= 2;
    candidates.push(v);
  }
  if (hasWingsOrRotors && wingRotorHP > 0) {
    let effTL = wingTL ?? tl;
    if (responsive) effTL += 1;
    if (highAgility) effTL += 1;
    if (variableSweep) effTL += 1;
    if (computerizedControls) effTL += 1;
    if (controlledInstability) effTL += 2;
    if (mmrRotors) effTL -= 1;
    const v = (wingRotorHP / loadedLbs) * effTL * 30;
    candidates.push(Math.round(v * 2) / 2);
  }
  return candidates.length ? Math.max(...candidates) : 0;
}

export function aSR({ totalVolumeCf, tl, electronicControls = false, computerizedControls = false,
  noWingsOrStubOnly = false, coaxialRotors = false, liftingBody = false,
  multiplane = false, controlledInstability = false, radicalStealthWithWings = false }) {
  let sr = totalVolumeCf < 100 ? 2 : totalVolumeCf < 1000 ? 3 : totalVolumeCf < 10000 ? 4
    : totalVolumeCf < 100000 ? 5 : 6;
  if (electronicControls || computerizedControls) sr += 1;
  if (tl <= 6) sr -= 1;
  if (tl >= 8) sr += 1;
  if (noWingsOrStubOnly && !coaxialRotors) sr -= 1;
  if (liftingBody) sr -= 1;
  if (multiplane) sr -= 1;
  if (controlledInstability) sr -= 1;
  if (radicalStealthWithWings) sr -= 1;
  return Math.max(sr, 1);
}

export const aDecel = (amr) => amr * 4;

// Takeoff/landing runs in yards (p. VE134).
export const takeoffRun = (stallMph, gAccelVal) => gAccelVal > 0 ? (stallMph * stallMph) / (4 * gAccelVal) : Infinity;
export const landingRun = (stallMph, gDecelVal) => gDecelVal > 0 ? (stallMph * stallMph) / (4 * gDecelVal) : Infinity;

// Aerial top speed caps (p. VE134).
export function aerialSpeedCaps({ streamlining = 'none', hasPropellers = false, rotorTL = null, hasSails = false,
  flarecraft = false, metallicDR = Infinity }) {
  const caps = [];
  if (hasSails) caps.push(100);
  if (rotorTL !== null) caps.push(rotorTL <= 6 ? 150 : 300);
  if (flarecraft) caps.push(400);
  if (['none', 'fair', 'good'].includes(streamlining)) caps.push(600);
  if (hasPropellers) caps.push(600);
  if (streamlining === 'veryGood') caps.push(740);
  if (metallicDR < 5) caps.push(600);
  else if (metallicDR < 20) caps.push(2000);
  return caps;
}

// --- Hovercraft (p. VE136) --------------------------------------------------
export function hoverLift({ hoverfanLift = 0, otherLift = 0, skirt = 'none' }) {
  const mult = skirt === 'gev' ? 5 : skirt === 'sev' ? 4 : 2;
  return hoverfanLift * mult + otherLift;
}

export function hoverAltitudeFt({ lift, loadedLbs }) {
  if (lift <= loadedLbs) return 0;
  return Math.min((2 * lift) / loadedLbs, 6);
}
