// ---------------------------------------------------------------------------
// GURPS Spaceships — tactical hex combat engine (SS3 Chapter 3).
// Pure logic: hex math, the velocity/thrust/burn conversions, beam ranges in
// hexes, ballistic modifiers, scale factors, facing limits, firing arcs, and
// missile salvo behavior. The map UI drives it.
//
// Hexes use axial coordinates (q, r) with flat-top orientation. Velocity is
// a per-turn hex vector; each turn a ship coasts pos += vel, then may spend
// Thrust Rating (and Burn Points, for reaction drives) to change vel.
// ---------------------------------------------------------------------------

import { beamRow } from './combat.js';

// --- Hex math (axial, flat-top) ---------------------------------------------
export const HEX_DIRS = [
  { q: 0, r: -1 },  // 0: up
  { q: 1, r: -1 },  // 1: up-right
  { q: 1, r: 0 },   // 2: down-right
  { q: 0, r: 1 },   // 3: down
  { q: -1, r: 1 },  // 4: down-left
  { q: -1, r: 0 },  // 5: up-left
];

export const hexAdd = (a, b) => ({ q: a.q + b.q, r: a.r + b.r });
export const hexSub = (a, b) => ({ q: a.q - b.q, r: a.r - b.r });
export const hexScale = (a, k) => ({ q: a.q * k, r: a.r * k });
export const hexEq = (a, b) => a.q === b.q && a.r === b.r;

export function hexDistance(a, b) {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export const hexLength = (v) => hexDistance({ q: 0, r: 0 }, v);

// Direction sector (0-5) from a to b (nearest of the six hex directions).
export function hexDirection(a, b) {
  if (hexEq(a, b)) return null;
  const d = hexSub(b, a);
  // Compare against each direction vector by dot product in pixel space.
  let best = 0;
  let bestDot = -Infinity;
  const px = (h) => ({ x: 1.5 * h.q, y: Math.sqrt(3) * (h.r + h.q / 2) });
  const pd = px(d);
  const len = Math.hypot(pd.x, pd.y) || 1;
  HEX_DIRS.forEach((dir, i) => {
    const pv = px(dir);
    const plen = Math.hypot(pv.x, pv.y);
    const dot = (pd.x * pv.x + pd.y * pv.y) / (len * plen);
    if (dot > bestDot) { bestDot = dot; best = i; }
  });
  return best;
}

// Steps to rotate from facing a to facing b (0-3).
export function facingSteps(a, b) {
  const d = Math.abs(a - b) % 6;
  return Math.min(d, 6 - d);
}

// --- Scales and conversions ---------------------------------------------------
export const HEX_SCALES = ['10-mile', '100-mile', '1,000-mile', '10,000-mile'];
export const TURN_SECONDS = { '20s': 20, '1m': 60, '3m': 180, '10m': 600 };
const TURN_IDX = { '20s': 0, '1m': 1, '3m': 2, '10m': 3 };

// Velocity, Thrust, and Burn Table (SS3): factors per [scaleIdx][turnIdx].
const VEL_FACTOR = [
  [2, 6, 20, 60],
  [0.2, 2 / 3, 2, 6],
  [1 / 50, 1 / 15, 1 / 5, 2 / 3],
  [1 / 500, 1 / 150, 1 / 50, 1 / 15],
];
const TR_FACTOR = [
  [1 / 5, 2, 20, 200],
  [1 / 50, 1 / 5, 2, 20],
  [1 / 500, 1 / 50, 1 / 5, 2],
  [1 / 5000, 1 / 500, 1 / 50, 1 / 5],
];

export const mpsToHexes = (mps, scaleIdx, turn) => mps * VEL_FACTOR[scaleIdx][TURN_IDX[turn]];
export const hexesToMps = (hexes, scaleIdx, turn) => hexes / VEL_FACTOR[scaleIdx][TURN_IDX[turn]];
export const thrustRating = (accelG, scaleIdx, turn) => accelG * TR_FACTOR[scaleIdx][TURN_IDX[turn]];
export const burnPoints = (deltaVmps, scaleIdx, turn) => mpsToHexes(deltaVmps, scaleIdx, turn);

// Damage scale factor (ballistic damage = d-dam × rel. velocity × this).
export function scaleFactor(scaleIdx, turn) {
  return [2, 0.6, 0.2, 0.06][TURN_IDX[turn]] * 10 ** scaleIdx;
}

// --- Range modifier (Space Range Modifier Table) ------------------------------
export function tacticalRangeMod(hexes, scaleIdx) {
  if (hexes <= 0) return 12 - 6 * scaleIdx;
  const bands = [[1, 6], [2, 4], [4, 3], [6, 2], [9, 1], [14, 0], [19, -1], [29, -2], [49, -3], [69, -4], [99, -5], [149, -6], [199, -7], [299, -8]];
  let h = hexes;
  let extra = 0;
  while (h > 299) { h /= 10; extra -= 6; }
  for (const [limit, mod] of bands) if (h <= limit) return mod + extra - 6 * scaleIdx;
  return -8 + extra - 6 * scaleIdx;
}

// Relative Velocity Ballistic Modifier Table (velocity in hexes/turn).
export function tacticalVelocityMod(relHexes, scaleIdx) {
  const bands = [[0, 10], [1, 8], [2, 6], [4, 5], [6, 4], [9, 3], [14, 2], [19, 1], [29, 0], [49, -1], [69, -2], [99, -3], [149, -4]];
  let v = relHexes;
  let extra = 0;
  while (v > 149) { v /= 10; extra -= 6; }
  for (const [limit, mod] of bands) if (v <= limit) return mod + extra - 6 * scaleIdx;
  return -4 + extra - 6 * scaleIdx;
}

// Ballistic turn-length modifier.
export const TURN_LENGTH_MOD = { '20s': -6, '1m': -3, '3m': 0, '10m': 3 };

// --- Beam ranges in hexes (SS3 Beam Weapon Tables) ----------------------------
// [half-damage, max] at the 10-mile scale, per output band (0-8); divide by
// 10 per scale step with the book's round-half-to-even convention.
const BEAM_HEX = {
  A: [[15, 50], [30, 100], [70, 200], [150, 500], [300, 1000], [700, 2000], [1500, 5000], [3000, 10000], [5000, 15000]],
  B: [[30, 100], [70, 200], [150, 500], [300, 1000], [700, 2000], [1500, 5000], [3000, 10000], [7000, 20000], [15000, 50000]],
  C: [[7, 20], [15, 50], [30, 100], [70, 200], [150, 500], [300, 1000], [700, 2000], [1500, 5000], [3000, 10000]],
  D: [[3, 10], [7, 20], [15, 50], [30, 100], [70, 200], [150, 500], [300, 1000], [700, 2000], [1500, 5000]],
};
// Beam family by the combat engine's range column (R0..R3).
const FAMILY_BY_COL = { 0: 'D', 1: 'C', 2: 'A', 3: 'B' };

function roundHalfEven(x) {
  const f = Math.floor(x);
  const diff = x - f;
  if (Math.abs(diff - 0.5) < 1e-9) return f % 2 === 0 ? f : f + 1;
  return Math.round(x);
}
const scaleHexes = (v, scaleIdx) => {
  const scaled = v / 10 ** scaleIdx;
  return scaled >= 1 ? roundHalfEven(scaled) : (Math.abs(scaled - 0.5) < 1e-9 ? 0 : Math.round(scaled));
};

// Half/max beam range in hexes for a battery output + beam type at a scale.
export function beamHexRange(output, beamType, scaleIdx) {
  const row = beamRow(output);
  if (row < 0) return null;
  const band = Math.floor(row / 3);
  const fam = BEAM_HEX[FAMILY_BY_COL[beamType.rangeCol] || 'A'];
  const [half, max] = fam[Math.min(band, fam.length - 1)];
  return { half: scaleHexes(half, scaleIdx), max: scaleHexes(max, scaleIdx) };
}

// --- Facing changes -------------------------------------------------------------
// Facing Change Table: max facing changes per turn by SM and turn length
// ('any' = 3, i.e., can face any direction).
export function maxFacingChange(sm, turn) {
  const t = TURN_IDX[turn];
  if (sm <= 6) return 3;
  if (sm <= 9) return t >= 1 ? 3 : 2;
  if (sm <= 12) return t >= 2 ? 3 : t === 1 ? 2 : 1;
  return t === 3 ? 3 : t === 2 ? 2 : 1;
}

// --- Firing arcs -----------------------------------------------------------------
// Arc of the target relative to the ship's facing: 'front' (facing ±1),
// 'central' (the two side directions), or 'rear' (dead astern). Own hex
// counts as every arc.
export function bearingArc(shipPos, facing, targetPos) {
  if (hexEq(shipPos, targetPos)) return 'own';
  const dir = hexDirection(shipPos, targetPos);
  const steps = facingSteps(facing, dir);
  if (steps <= 1) return 'front';
  if (steps === 2) return 'central';
  return 'rear';
}

// Can a weapon in `section` (mount: turret/fixed/spinal) engage a target in `arc`?
export function arcAllows(section, mount, arc) {
  if (arc === 'own') return true;
  if (mount === 'fixed' || mount === 'spinal') {
    if (section === 'front') return arc === 'front';
    if (section === 'central') return arc === 'central';
    return arc === 'rear';
  }
  // turrets
  if (section === 'front') return arc === 'front' || arc === 'central';
  if (section === 'central') return true;
  return arc === 'rear' || arc === 'central';
}

// --- Missiles ---------------------------------------------------------------------
// Missile Thrust Rating and Burn Points per [scaleIdx] at each turn length.
const MISSILE_TABLES = {
  standard78: {
    tr: [[1, 12, 120, 1200], [0.1, 1, 12, 120], [0, 0, 1, 12], [0, 0, 0, 1]],
    bp: [[12, 36, 120, 360], [1, 4, 12, 36], [0, 0, 1, 4], [0, 0, 0, 0.3]],
    accelG: 6, deltaV: 6, sAccBase: -1, // sAcc = TL-8 handled by caller
  },
  standard912: {
    tr: [[1, 10, 100, 1000], [0.1, 1, 10, 100], [0, 0, 1, 10], [0, 0, 0, 1]],
    bp: [[20, 60, 200, 600], [2, 6, 20, 60], [0, 0, 2, 6], [0, 0, 0, 0.6]],
    accelG: 5, deltaV: 10,
  },
  super: {
    tr: [[100, 1000, 10000, 100000], [10, 100, 1000, 10000], [1, 10, 100, 1000], [0.1, 1, 10, 100]],
    bp: [[1000, 3000, 10000, 30000], [100, 300, 1000, 3000], [10, 30, 100, 300], [1, 3, 10, 30]],
    accelG: 500, deltaV: 500,
  },
};

export function missilePerformance(kind, cal, scaleIdx, turn) {
  const t = MISSILE_TABLES[kind] || MISSILE_TABLES.standard912;
  const i = TURN_IDX[turn];
  const big = cal >= 32;
  return {
    tr: t.tr[scaleIdx][i],
    bp: t.bp[scaleIdx][i] * (big ? 2 : 1),
    accelG: t.accelG,
    deltaV: t.deltaV * (big ? 2 : 1),
  };
}

// Greedy missile seek: spend up to `tr` (and available bp) adjusting velocity
// toward an intercept of the target's coasting position. Returns the thrust
// vector spent (integer hex components, cost = hex length).
export function missileSeek(missile, targetPos, targetVel) {
  const budget = Math.floor(Math.min(missile.tr, missile.bp));
  if (budget <= 0) return { q: 0, r: 0 };
  // Where will the target be next turn (coast assumption)?
  const aim = hexAdd(targetPos, targetVel);
  // Ideal velocity: reach `aim` next turn.
  const idealVel = hexSub(aim, missile.pos);
  let need = hexSub(idealVel, missile.vel);
  // Clamp the correction to the thrust budget by walking directions greedily.
  const thrust = { q: 0, r: 0 };
  for (let spent = 0; spent < budget && hexLength(need) > 0; spent++) {
    // pick the direction that best reduces `need`
    let best = null;
    let bestLen = hexLength(need);
    for (const dir of HEX_DIRS) {
      const remaining = hexSub(need, dir);
      const len = hexLength(remaining);
      if (len < bestLen) { bestLen = len; best = dir; }
    }
    if (!best) break;
    thrust.q += best.q; thrust.r += best.r;
    need = hexSub(need, best);
  }
  return thrust;
}

// --- Turn resolution helpers ---------------------------------------------------
// Coast: pos += vel. Returns new position.
export const coast = (pos, vel) => hexAdd(pos, vel);

// Validate a thrust expenditure: |thrust| ≤ TR, and for reaction ships
// |thrust| ≤ remaining burn points.
export function thrustCost(thrust) {
  return hexLength(thrust);
}
