// ---------------------------------------------------------------------------
// GURPS Spaceships — basic space combat engine (SS1 Chapter 4).
// Pure logic: dice, attack modifiers, damage pipeline, hit location and
// system damage, layered on the designer's ship model. The UI drives it;
// an injectable RNG keeps it testable.
// ---------------------------------------------------------------------------

import { SYSTEMS } from './systems.js';
import './systems-books.js';
import { SECTIONS } from './tables.js';
import { computeShip } from './ship.js';

// --- Dice ------------------------------------------------------------------
// Parse d-damage strings: '4d', '3d+2', '1d-3', '6d×14', '2d×1,000'.
export function parseDice(str) {
  const m = String(str).replace(/,/g, '').match(/^(\d+)d(?:([+-]\d+))?(?:[×x¥*](\d+(?:\.\d+)?))?$/);
  if (!m) return null;
  return { n: Number(m[1]), add: Number(m[2] || 0), mult: Number(m[3] || 1) };
}

export function fmtDice(d, extraMult = 1) {
  const mult = d.mult * extraMult;
  return `${d.n}d${d.add ? (d.add > 0 ? `+${d.add}` : d.add) : ''}${mult !== 1 ? `×${Math.round(mult * 100) / 100}` : ''}`;
}

export const d6 = (rng = Math.random) => Math.floor(rng() * 6) + 1;
export const roll3d = (rng = Math.random) => d6(rng) + d6(rng) + d6(rng);

export function rollDice(d, rng = Math.random, extraMult = 1) {
  let total = 0;
  for (let i = 0; i < d.n; i++) total += d6(rng);
  return Math.max(0, Math.round((total + d.add) * d.mult * extraMult));
}

// Success roll: 3d vs effective skill (B347: 3-4 always crit success,
// 17-18 always failure; crit thresholds simplified per Basic Set).
export function successRoll(skill, rng = Math.random) {
  const dice = roll3d(rng);
  const margin = skill - dice;
  const critSuccess = dice <= 4 || (dice === 5 && skill >= 15) || (dice === 6 && skill >= 16);
  const critFailure = dice === 18 || (dice === 17 && skill <= 15) || margin <= -10;
  return { dice, margin, success: margin >= 0 && !critFailure, critSuccess: critSuccess && !critFailure, critFailure };
}

// --- Range bands -------------------------------------------------------------
export const RANGE_BANDS = ['zero', 'pointBlank', 'close', 'short', 'long', 'extreme'];
export const RANGE_LABELS = { zero: 'Zero', pointBlank: 'Point-blank', close: 'Close', short: 'Short', long: 'Long', extreme: 'Extreme' };
export const RANGE_MODS = { zero: 20, pointBlank: 0, close: -4, short: -8, long: -12, extreme: -16 };

// Range Table: situation × scale → band (SS1 p. 57).
export const SITUATIONS = {
  rendezvous: { name: 'Rendezvous / docked', bands: ['zero', 'zero', 'zero'] },
  formation: { name: 'In formation / incoming', bands: ['pointBlank', 'pointBlank', 'pointBlank'] },
  collision: { name: 'Collision course', bands: ['pointBlank', 'close', 'short'] },
  engaged: { name: 'Attack vector / engaged', bands: ['close', 'short', 'long'] },
  neutral: { name: 'Neutral', bands: ['short', 'long', 'extreme'] },
};
export const SCALES = ['close', 'standard', 'distant'];
export const SCALE_LABELS = { close: 'Close (20-2,000 mi)', standard: 'Standard (200-20,000 mi)', distant: 'Distant (2,000-200,000 mi)' };
export const TURN_LENGTHS = ['20s', '1m', '3m', '10m'];
export const TURN_LABELS = { '20s': '20-second', '1m': '1-minute', '3m': '3-minute', '10m': '10-minute' };

export function rangeBand(situation, scale) {
  return SITUATIONS[situation].bands[SCALES.indexOf(scale)];
}

// Base relative velocity (mps) for ballistic attacks (SS1 p. 59).
export const BASE_VELOCITY = {
  close: { '20s': 1, '1m': 1 / 3, '3m': 0.1, '10m': 0 },
  standard: { '20s': 10, '1m': 3, '3m': 1, '10m': 1 / 3 },
  distant: { '20s': 100, '1m': 30, '3m': 10, '10m': 3 },
};
export const ENGAGED_VELOCITY = { close: 1 / 6, standard: 1 / 3, distant: 0.5 };

// Velocity-based ballistic to-hit modifier ladder (+6 at 0 mps, -3 per step).
export function velocityMod(v) {
  if (v <= 0) return 6;
  const steps = [[0.3, 3], [1, 0], [3, -3], [10, -6], [30, -9], [100, -12], [300, -15], [1000, -18], [3000, -21], [10000, -24], [30000, -27]];
  for (const [limit, mod] of steps) if (v <= limit) return mod;
  return -30;
}

// Point-defense penalty vs fast ballistic attacks.
export function pointDefenseMod(v) {
  if (v < 300) return 0;
  if (v < 1000) return -3;
  if (v < 3000) return -6;
  if (v < 10000) return -9;
  if (v < 30000) return -12;
  if (v < 100000) return -15;
  return -18;
}

// Rapid fire bonus (expanded B548 ladder).
export function rapidFireBonus(shots) {
  if (shots < 5) return 0;
  const table = [[8, 1], [12, 2], [16, 3], [24, 4], [49, 5], [99, 6], [199, 7], [399, 8], [799, 9], [1599, 10]];
  for (const [limit, bonus] of table) if (shots <= limit) return bonus;
  // doubles beyond 1,599 keep adding +1
  return 10 + Math.ceil(Math.log2(shots / 1599));
}

// RoF per weapon by turn length (×2 improved; × mounts for fixed batteries).
export const ROF = {
  launcher: { '20s': 1, '1m': 3, '3m': 10, '10m': 30 },
  single: { '20s': 1, '1m': 3, '3m': 10, '10m': 30 },
  rapid: { '20s': 10, '1m': 30, '3m': 100, '10m': 300 },
  veryRapid: { '20s': 100, '1m': 300, '3m': 1000, '10m': 3000 },
};

// --- Beam weapons ------------------------------------------------------------
// Output ladder row per battery output string; dDam1/dDam2 and range columns.
const OUTPUTS = ['3kJ', '10kJ', '30kJ', '100kJ', '300kJ', '1MJ', '3MJ', '10MJ', '30MJ', '100MJ', '300MJ', '1GJ', '3GJ', '10GJ', '30GJ', '100GJ', '300GJ', '1TJ', '3TJ', '10TJ', '30TJ', '100TJ', '300TJ', '1PJ', '3PJ'];
const DDAM1 = ['1d-4', '1d-3', '1d-2', '1d', '1d+2', '2d', '3d', '4d', '6d', '2d×5', '3d×5', '4d×5', '3d×10', '4d×10', '6d×10', '2d×50', '3d×50', '2d×100', '3d×100', '4d×100', '6d×100', '2d×500', '3d×500', '2d×1000', '3d×1000'];
const DDAM2 = ['1d-2', '1d-1', '1d+1', '2d', '3d', '4d', '6d', '8d', '6d×2', '4d×5', '3d×10', '4d×10', '6d×10', '8d×10', '6d×20', '2d×100', '3d×100', '4d×100', '6d×100', '8d×100', '6d×200', '2d×1000', '3d×1000', '4d×1000', '6d×1000'];
const R3 = ['C/S', 'C/S', 'C/S', 'S', 'S', 'S', 'S/L', 'S/L', 'S/L', 'L', 'L', 'L', 'L/X', 'L/X', 'L/X', 'X', 'X', 'X', 'X', 'X', 'X', 'X', 'X', 'X', 'X'];
const R2 = ['C', 'C', 'C', 'C/S', 'C/S', 'C/S', 'S', 'S', 'S', 'S/L', 'S/L', 'S/L', 'L', 'L', 'L', 'L/X', 'L/X', 'L/X', 'X', 'X', 'X', 'X', 'X', 'X', 'X'];
const R1 = ['P/C', 'P/C', 'P/C', 'C', 'C', 'C', 'C/S', 'C/S', 'C/S', 'S', 'S', 'S', 'S/L', 'S/L', 'S/L', 'L', 'L', 'L', 'L/X', 'L/X', 'L/X', 'X', 'X', 'X', 'X'];
const R0 = ['P', 'P', 'P', 'P/C', 'P/C', 'P/C', 'C', 'C', 'C', 'C/S', 'C/S', 'C/S', 'S', 'S', 'S', 'S/L', 'S/L', 'S/L', 'L', 'L', 'L', 'L/X', 'L/X', 'L/X', 'X'];
const RANGE_COLS = { 0: R0, 1: R1, 2: R2, 3: R3 };

// Beam types (SS1 Beam Weapon Table + SS7 lightning cannon).
export const BEAM_TYPES = {
  laser: { name: 'Laser', tl: 9, sAcc: 0, rangeCol: 2, rcl: 1, div: 2, dmg: 1, mods: 'burn' },
  uvLaser: { name: 'UV laser', tl: 10, sAcc: 0, rangeCol: 3, rcl: 1, div: 2, dmg: 1, mods: 'burn' },
  xrayLaser: { name: 'X-ray laser', tl: 11, sAcc: 0, rangeCol: 3, rcl: 1, div: 5, dmg: 1, mods: 'burn sur' },
  graser: { name: 'Graser', tl: 12, sAcc: 0, rangeCol: 3, rcl: 1, div: 10, dmg: 1, mods: 'burn sur' },
  heatRay: { name: 'Heat ray', tl: 7, ss: true, sAcc: 0, rangeCol: 2, rcl: 1, div: 1, dmg: 1, mods: 'burn' },
  particle: { name: 'Particle beam', tl: 10, sAcc: -3, rangeCol: 1, rcl: 1, div: 5, dmg: 1, mods: 'burn rad sur' },
  antiparticle: { name: 'Antiparticle beam', tl: 11, sAcc: -3, rangeCol: 1, rcl: 1, div: 3, dmg: 2, mods: 'cr exp sur rad' },
  ghostParticle: { name: 'Ghost particle beam', tl: 11, ss: true, sAcc: -3, rangeCol: 1, rcl: 1, div: Infinity, dmg: 1, mods: 'cr exp' },
  plasma: { name: 'Plasma beam', tl: 10, ss: true, sAcc: -6, rangeCol: 0, rcl: 2, div: 2, dmg: 2, mods: 'burn exp' },
  graviton: { name: 'Graviton beam', tl: 11, ss: true, sAcc: 0, rangeCol: 1, rcl: 1, div: Infinity, dmg: 1, tenthOutput: true, mods: 'cr' },
  tractor: { name: 'Tractor beam', tl: 11, ss: true, sAcc: 0, rangeCol: 1, rcl: 1, div: 1, dmg: 0, mods: 'special' },
  conversion: { name: 'Conversion beam', tl: 12, ss: true, sAcc: 0, rangeCol: 2, rcl: 1, div: 10, dmg: 1, mods: 'cor + followup' },
  disintegrator: { name: 'Disintegrator', tl: 12, ss: true, sAcc: 0, rangeCol: 2, rcl: 1, div: Infinity, dmg: 1, mods: 'cor' },
  lightning: { name: 'Lightning cannon', tl: 7, ss: true, sAcc: -3, rangeCol: 1, rcl: 1, div: 2, dmg: 1, mods: 'burn sur', source: 'SS7' },
};

export function beamRow(output) {
  return OUTPUTS.indexOf(output);
}

// Beam damage dice + range band limits for a battery output + beam type.
export function beamStats(output, typeKey) {
  const type = BEAM_TYPES[typeKey] || BEAM_TYPES.laser;
  let row = beamRow(output);
  if (row < 0) return null;
  if (type.tenthOutput) row = Math.max(0, row - 2); // graviton: 1/10 output (÷10 = two ladder rows)
  const dice = parseDice((type.dmg === 2 ? DDAM2 : DDAM1)[row]);
  const rangeStr = RANGE_COLS[type.rangeCol][beamRow(output)];
  const [full, half] = rangeStr.includes('/') ? rangeStr.split('/') : [rangeStr, null];
  const bandOf = { P: 'pointBlank', C: 'close', S: 'short', L: 'long', X: 'extreme' };
  return {
    type, dice,
    fullBand: bandOf[full], halfBand: half ? bandOf[half] : null,
    sAcc: type.sAcc, rcl: type.rcl, div: type.div,
  };
}

// True if the band is within reach; 'half' if in the half-damage band.
export function beamRangeCheck(stats, band) {
  const order = RANGE_BANDS;
  const i = order.indexOf(band);
  if (i <= order.indexOf(stats.fullBand)) return 'full';
  if (stats.halfBand && i <= order.indexOf(stats.halfBand)) return 'half';
  return 'out';
}

// --- Guns, launchers, warheads ----------------------------------------------
export const GUN_TYPES = {
  conventional: { name: 'Conventional gun', minV: 1, maxBand: 'close', sAcc: (cal) => cal <= 6 ? -10 : cal <= 14 ? -9 : -8, rcl: (cal) => cal <= 6 ? 3 : cal <= 14 ? 4 : 5 },
  em: { name: 'Electromagnetic gun', minV: 2, maxBand: 'short', sAcc: (cal) => cal <= 6 ? -8 : cal <= 14 ? -7 : -6, rcl: (cal) => cal <= 6 ? 2 : cal <= 14 ? 3 : 4 },
  grav: { name: 'Grav gun', minV: 5, maxBand: 'short', sAcc: () => -5, rcl: () => 2 },
};
export function missileSAcc(tl, cal) { return cal >= 32 ? tl - 7 : tl - 8; }
export function missileMinV(tl, close) {
  // lower value at point-blank/short range or after the attacker retreated
  if (tl <= 8) return close ? 1 / 3 : 1;
  return close ? 1 : 2;
}

// Conventional warhead d-damage by caliber (multiplied by velocity in mps).
const WARHEAD = {
  2: '3d', 2.5: '3d+2', 3: '4d', 3.5: '5d', 4: '6d', 5: '7d', 6: '9d', 7: '11d',
  8: '6d×2', 10: '3d×5', 12: '6d×3', 14: '3d×7', 16: '6d×4', 20: '6d×5', 24: '6d×6',
  28: '6d×7', 32: '6d×8', 40: '6d×10', 48: '6d×12', 56: '6d×14', 64: '6d×16',
  80: '6d×20', 96: '6d×24', 112: '6d×28',
};
export function conventionalWarhead(caliberCm) {
  return parseDice(WARHEAD[caliberCm] || '3d');
}
export const NUKES = {
  '25kt': { name: '25 kiloton', dice: '4d×1000' },
  '100kt': { name: '100 kiloton', dice: '8d×1000' },
  '2.5Mt': { name: '2.5 megaton', dice: '8d×5000' },
  '10Mt': { name: '10 megaton', dice: '8d×10000' },
};

// Collision: 6d × 3 × lesser dST × V.
export function collisionDice(lesserDst, v) {
  return { n: 6, add: 0, mult: 3 * lesserDst * v };
}

// --- Attack modifiers ---------------------------------------------------------
export function beamAttackMods(p) {
  const mods = [];
  const add = (v, label) => { if (v) mods.push([v, label]); };
  add(p.targetSM, `target SM ${p.targetSM >= 0 ? '+' : ''}${p.targetSM}`);
  add(p.sAcc, `sAcc ${p.sAcc}`);
  if (p.bigBeam) add(1, '1 GJ+ beam');
  add(RANGE_MODS[p.band], `${RANGE_LABELS[p.band]} range`);
  if (p.cloaked) add(p.cloakDetected ? -4 : -10, 'target cloaked');
  if (p.fixedMount) add(2, 'spinal/fixed mount');
  if (p.attackerZeroHP) add(-2, 'attacker at 0 dHP');
  if (p.streamlinedEnd) add(-1, 'streamlined front/rear hull');
  if (p.precision) add(-5, 'precision attack');
  if (p.weakPoint) add(-10, 'targeting armor weak point');
  if (p.ecm) add(-(p.tacticalArray ? 1 : 2) * Math.min(p.ecm, 3), `defensive ECM ×${Math.min(p.ecm, 3)}`);
  if (p.pointDefV) add(pointDefenseMod(p.pointDefV), 'point-defense vs fast attack');
  if (p.shots >= 2) add(rapidFireBonus(p.shots), `${p.shots} shots`);
  if (p.spreading) add(-2 * p.spreading, `spreading fire (${p.spreading} extra targets)`);
  return mods;
}

export function ballisticAttackMods(p) {
  const mods = [];
  const add = (v, label) => { if (v) mods.push([v, label]); };
  add(p.targetSM, `target SM ${p.targetSM >= 0 ? '+' : ''}${p.targetSM}`);
  add(p.sAcc, p.ramming ? `Handling ${p.sAcc}` : `sAcc ${p.sAcc >= 0 ? '+' : ''}${p.sAcc}`);
  if (p.cloaked) add(p.cloakDetected ? -4 : -10, 'target cloaked');
  if (p.streamlinedEnd) add(-1, 'streamlined front/rear hull');
  if (p.precision) add(-5, 'precision attack');
  if (p.weakPoint) add(-10, 'targeting armor weak point');
  if (p.ecm) add(-(p.tacticalArray ? 1 : 2) * Math.min(p.ecm, 3), `defensive ECM ×${Math.min(p.ecm, 3)}`);
  if (p.proximity) add(4, 'proximity detonation');
  add(velocityMod(p.velocity), `relative velocity ${Math.round(p.velocity * 100) / 100} mps`);
  if (p.shots >= 2) add(rapidFireBonus(p.shots), `${p.shots} shots/incoming`);
  if (p.spreading) add(-1 * p.spreading, `spreading fire (${p.spreading} extra targets)`);
  return mods;
}

export function dodgeScore(p) {
  const mods = [];
  const add = (v, label) => { if (v) mods.push([v, label]); };
  add(Math.ceil(p.piloting / 2), `Piloting ${p.piloting}/2`);
  add(p.hnd, `Handling ${p.hnd >= 0 ? '+' : ''}${p.hnd}`);
  const turnBonus = { '20s': 0, '1m': 1, '3m': 2, '10m': 3 }[p.turn] || 0;
  add(turnBonus, `${TURN_LABELS[p.turn]} turn`);
  add(Math.min(p.ecm || 0, 3), `defensive ECM`);
  if (p.evasive) add(1, 'Evasive Action');
  if (p.combatReflexes) add(1, 'Combat Reflexes');
  return { score: mods.reduce((a, [v]) => a + v, 0), mods };
}

// --- Combatant state -----------------------------------------------------------
const VOLATILE_FUELS = ['antimatter-boosted H', 'matter/antimatter', 'uranium saltwater', 'HEDM fuel'];

export function createCombatant(design, opts = {}) {
  const result = computeShip(design);
  const s = result.stats;
  const slots = {};
  for (const section of SECTIONS) {
    slots[section] = design.sections[section].map((slot) => slotState(design, slot, result));
    const core = design.cores.find((c) => c.section === section && c.sys);
    slots[section].push(core ? { ...slotState(design, core, result), isCore: true } : null);
  }
  return {
    id: opts.id || design.name,
    design, result,
    dhp: s.dstHp,
    curDhp: s.dstHp,
    screen: s.screenDDR || 0,
    slots, // per section: 6 slot states + [6] = core (or null)
    facing: 'central',
    maneuver: 'holdCourse',
    accelBonus: 0,
    pilotSkill: opts.pilotSkill ?? 12,
    gunnerSkill: opts.gunnerSkill ?? 12,
    destroyed: false,
    htChecksAt: -1, // next destruction check multiple of -dHP
  };
}

function slotState(design, slot, result) {
  const entry = slot.sys ? SYSTEMS[slot.sys] : null;
  let volatile = false;
  if (entry) {
    if (entry.key === 'antimatterReactor') volatile = true;
    if (entry.battery && slot.opts?.weaponType === 'missile') volatile = true;
    if (entry.key === 'fuelTank') {
      const fuels = result.placed.filter((p) => p.info.fuel).map((p) => p.info.fuel);
      if (fuels.some((f) => VOLATILE_FUELS.includes(f))) volatile = true;
    }
  }
  return {
    sys: slot.sys, opts: slot.opts, name: entry ? entry.name : '(empty)',
    isArmor: entry?.category === 'Armor', volatile,
    state: 'ok', // ok | disabled | destroyed
  };
}

// Effective (degraded) statistics: recompute the ship without knocked-out
// systems. Destroyed armor still provides dDR (SS1 p. 62), so armor stays.
export function effectiveStats(c) {
  const d = JSON.parse(JSON.stringify(c.design));
  for (const section of SECTIONS) {
    c.slots[section].forEach((st, i) => {
      if (!st || st.state === 'ok' || st.isArmor) return;
      if (i < 6) d.sections[section][i] = { sys: null, opts: {} };
      else {
        const core = d.cores.find((x) => x.section === section);
        if (core) core.sys = null;
      }
    });
  }
  const r = computeShip(d);
  const s = r.stats;
  const zero = c.curDhp <= 0;
  return {
    ...s,
    hnd: s.hnd === null ? null : s.hnd - (zero ? 2 : 0),
    arrayLevel: s.arrayLevel === null ? null : s.arrayLevel - (zero ? 1 : 0),
    beamPenalty: zero ? -2 : 0,
  };
}

// --- Damage pipeline ------------------------------------------------------------
// Resolve one hit: basic damage → screen → armor → penetration → hull damage.
// Returns a log (array of strings) and mutates the combatant.
export function applyHit(c, { section, basicDamage, div = 1, halfDamage = false, rng = Math.random, precisionSlot = null, weakPoint = false, armorGap = false, damageReduction = 1 }) {
  const log = [];
  let dmg = basicDamage;
  if (halfDamage) { dmg = Math.floor(dmg / 2); log.push(`half-damage range: basic damage ${dmg}`); }

  // 1. Force screen (semi-ablative: -1 dDR per 10 basic damage rolled).
  if (c.screen > 0) {
    const eff = div === Infinity ? 0 : Math.floor(c.screen / div);
    const stop = Math.min(dmg, eff);
    dmg -= stop;
    const ablate = Math.floor(basicDamage / 10);
    c.screen = Math.max(0, c.screen - ablate);
    log.push(`force screen stops ${stop} (screen ablates ${ablate} → dDR ${c.screen})`);
    if (dmg <= 0) { log.push('no penetration.'); return { log, penetrating: 0 }; }
  }

  // 2. Hit location roll (1d), before armor: a destroyed armor location
  //    loses its own dDR contribution.
  let slotIdx = precisionSlot !== null ? precisionSlot : d6(rng) - 1;
  log.push(precisionSlot !== null ? `precision attack: location [${slotIdx + 1}]` : `hit location roll: [${slotIdx + 1}]`);

  // 3. Armor.
  const armorSlots = c.slots[section].filter((st) => st && st.isArmor);
  let armorDDR = 0;
  for (const st of armorSlots) {
    const entry = SYSTEMS[st.sys];
    const info = entry.info(c.design.sm, c.design.tl, st.opts, { streamlined: c.design.streamlined });
    let ddr = info.armorDDR || 0;
    const hitThis = c.slots[section][slotIdx] === st;
    if (st.state === 'destroyed' && hitThis) ddr = 0; // hit passes through the hole
    armorDDR += ddr;
  }
  if (weakPoint) { armorDDR = 0; log.push('weak point targeted: armor ignored'); }
  if (armorGap) { armorDDR = 0; log.push('armor gap targeted: armor ignored'); }
  const effArmor = div === Infinity ? 0 : Math.floor(armorDDR / div);
  let pen = Math.max(0, dmg - effArmor);
  log.push(`armor dDR ${armorDDR}${div !== 1 ? ` ÷ (${div === Infinity ? '∞' : div}) = ${effArmor}` : ''} — penetrating damage ${pen}`);
  if (pen > 0 && damageReduction > 1) {
    pen = Math.floor(pen / damageReduction);
    log.push(`Damage Reduction ${damageReduction} (Psi-Wars): penetrating damage halved to ${pen}`);
  }
  if (pen > 0 && armorGap) {
    // Psi-Wars armor gaps: damage past what destroys the system is lost.
    const cap = Math.ceil(c.dhp * 0.25);
    if (pen > cap) { pen = cap; log.push(`armor gap: excess damage lost — capped at ${cap}`); }
  }
  if (pen <= 0) { log.push('no penetration.'); return { log, penetrating: 0 }; }

  // 4. Hull damage. Psi-Wars armor gaps disable at half the usual thresholds.
  c.curDhp -= pen;
  log.push(`dHP ${c.curDhp + pen} → ${c.curDhp}`);
  const pct = (pen / c.dhp) * (armorGap ? 2 : 1);
  if (pct >= 0.5) {
    log.push(...damageSystem(c, section, slotIdx, 'destroy', rng));
    const extra = d6(rng) - 1;
    log.push(`major penetration: extra system damage roll [${extra + 1}]`);
    log.push(...damageSystem(c, section, extra, 'disable', rng));
  } else if (pct >= 0.1) {
    log.push(...damageSystem(c, section, slotIdx, 'disable', rng));
  } else {
    log.push('penetration under 10% of dHP: no system damage.');
  }

  // 5. Destruction thresholds.
  if (c.curDhp <= -5 * c.dhp) {
    c.destroyed = true;
    log.push('vessel at -5×dHP: automatically destroyed.');
  } else if (c.curDhp <= c.htChecksAt * c.dhp) {
    log.push(`vessel at ${c.htChecksAt}×dHP: roll HT ${c.result.stats.ht} or be destroyed!`);
    c.htChecksAt -= 1;
  }
  return { log, penetrating: pen };
}

// Disable/destroy a system with the book's skip-upward rule.
export function damageSystem(c, section, startIdx, mode, rng = Math.random) {
  const log = [];
  const list = c.slots[section];
  // order: startIdx..5, then core (index 6) if present, then wrap 0..startIdx-1
  const order = [];
  for (let i = startIdx; i < 6; i++) order.push(i);
  if (list[6]) order.push(6);
  for (let i = 0; i < startIdx; i++) order.push(i);

  for (const i of order) {
    const st = list[i];
    if (!st) continue;
    if (st.state === 'destroyed') continue; // pass through
    const label = i === 6 ? '[core]' : `[${i + 1}]`;
    if (mode === 'destroy') {
      st.state = 'destroyed';
      log.push(`${section} ${label} ${st.name}: DESTROYED`);
    } else if (st.state === 'disabled') {
      st.state = 'destroyed';
      log.push(`${section} ${label} ${st.name}: already disabled — DESTROYED`);
    } else {
      st.state = 'disabled';
      log.push(`${section} ${label} ${st.name}: disabled`);
    }
    if (st.volatile) {
      log.push(`⚠ ${st.name} is VOLATILE: roll HT${mode === 'destroy' || st.state === 'destroyed' ? ' at -5' : ''} — failure: explodes at end of its next turn (crit fail: immediately).`);
    }
    if (st.state === 'destroyed' && (st.sys === 'hangarBay')) log.push('all craft/cargo in the hangar are destroyed.');
    return log;
  }
  log.push(`every system in the ${section} hull is already destroyed — damage passes to the adjacent section (armor ignored).`);
  return log;
}

// Weapons available to a combatant (functional batteries with bearing).
export function combatantWeapons(c) {
  const out = [];
  for (const section of SECTIONS) {
    c.slots[section].forEach((st, i) => {
      if (!st || !st.sys) return;
      const entry = SYSTEMS[st.sys];
      if (!entry?.battery) return;
      if (st.state === 'destroyed') return;
      const info = entry.info(c.design.sm, c.design.tl, st.opts, { streamlined: c.design.streamlined });
      let weapons = info.weapons || 1;
      if (st.state === 'disabled') weapons = entry.key === 'battery_major' || entry.spinal ? 0 : Math.floor(weapons / 2);
      if (weapons <= 0) return;
      out.push({
        section, slot: i, entry, opts: st.opts, info, weapons,
        label: `${section} [${i + 1}] ${entry.name} — ${info.desc}${st.state === 'disabled' ? ' (disabled: half weapons)' : ''}`,
      });
    });
  }
  return out;
}

// --- Psi-Wars simplified space-opera combat (Mailanka, Iteration 5) -----------
// A cinematic house-rule layer over the basic system: four ship size
// categories, three range bands, Damage Reduction 2 for corvettes and up,
// armor gaps, and a fixed missile/torpedo table.

export const PSI_CATEGORIES = ['Fighter', 'Corvette', 'Capital', 'Dreadnought'];
export function psiCategory(sm) {
  if (sm <= 6) return 0;
  if (sm <= 9) return 1;
  if (sm <= 12) return 2;
  return 3;
}

// Psi-Wars ranges: Neutral (Short), Engaged (Close), Hugging (Point-blank).
export const PSI_RANGES = {
  neutral: { name: 'Neutral', mod: -8 },
  engaged: { name: 'Engaged', mod: -4 },
  hugging: { name: 'Hugging', mod: 0 },
};

// Attack modifiers for beams under the Psi-Wars layer.
export function psiBeamMods(p) {
  const mods = [];
  const add = (v, label) => { if (v) mods.push([v, label]); };
  const tCat = psiCategory(p.targetSM);
  const aCat = psiCategory(p.attackerSM);
  add(3 * tCat, `target is ${PSI_CATEGORIES[tCat]} (+3/category)`);
  // Big weapons struggle to track smaller ships.
  if (tCat < aCat) {
    const per = p.heavyWeapon ? 2 : 1;
    add(-per * (aCat - tCat), `${p.heavyWeapon ? 'heavy' : 'light'} weapon vs smaller ship`);
  }
  add(p.sAcc, `sAcc ${p.sAcc}`);
  add(PSI_RANGES[p.range]?.mod ?? -8, `${PSI_RANGES[p.range]?.name ?? 'Neutral'} range`);
  // ECM: +2 for a targeting array, reduced by 1 per defensive ECM (min 0).
  if (p.tacticalArray) add(Math.max(0, 2 - (p.ecm || 0)), 'targeting array vs ECM');
  else if (p.ecm) add(0, '');
  if (p.fixedMount) add(2, 'spinal/fixed mount');
  if (p.advantage) add(Math.min(4, p.advantage), 'Advantaged: on the target\'s tail');
  if (p.streamlinedEnd) add(-1, 'streamlined front/rear hull');
  if (p.precision) add(-5, 'precision attack');
  if (p.armorGap) add(-10, 'armor gap');
  if (p.weakPoint) add(-10, 'armor weak point');
  if (p.attackerZeroHP) add(-2, 'attacker at 0 dHP');
  if (p.shots >= 2) add(rapidFireBonus(p.shots), `${p.shots} shots`);
  return mods;
}

// Fixed Psi-Wars missile/torpedo table (damage does not scale with velocity).
export const PSI_MISSILES = {
  lightMissile: { name: 'Light missile (20cm)', dice: '6d', div: 10, pd: -7, cost: 125e3, torpedo: false },
  lightTorpedo: { name: 'Light torpedo (20cm)', dice: '6d×20', div: 1, pd: -4, cost: 200e3, torpedo: true },
  mediumMissile: { name: 'Medium missile (40cm)', dice: '6d×2', div: 10, pd: -5, cost: 2e6, torpedo: false },
  mediumTorpedo: { name: 'Medium torpedo (40cm)', dice: '6d×40', div: 1, pd: -2, cost: 3e6, torpedo: true },
  heavyMissile: { name: 'Heavy missile (80cm)', dice: '6d×4', div: 10, pd: -3, cost: 30e6, torpedo: false },
  heavyTorpedo: { name: 'Heavy torpedo (80cm)', dice: '6d×80', div: 1, pd: 0, cost: 40e6, torpedo: true },
};

export function psiMissileMods(p) {
  const mods = [];
  const add = (v, label) => { if (v) mods.push([v, label]); };
  const diff = psiCategory(p.targetSM) - psiCategory(p.attackerSM);
  add(3 * diff, `size difference (${diff >= 0 ? '+' : ''}${diff} categories)`);
  if (!p.torpedo) add(1, 'missile accuracy');
  add(-2 * (p.ecm || 0), `defensive ECM ×${p.ecm || 0}`);
  if (p.tacticalArray) add(2, 'tactical array');
  if (p.streamlinedEnd) add(-1, 'streamlined front/rear hull');
  if (p.precision) add(-5, 'precision attack');
  if (p.weakPoint) add(-10, 'armor weak point');
  if (p.shots >= 2) add(rapidFireBonus(p.shots), `${p.shots} shots`);
  return mods;
}

// Psi-Wars dogfighting: every 25G of acceleration is +1 in pilot contests.
export function psiAccelBonus(accelG) {
  return Math.floor(Math.max(0, accelG || 0) / 25);
}

// Psi-Wars maneuvers, resolved as quick contests of Pilot skill.
export const PSI_MANEUVERS = {
  close: { name: 'Close', desc: 'Fight to get on the enemy: success engages (Close range); by 10+, or when already engaged, win Advantage' },
  evade: { name: 'Evasive Action', desc: 'Break off: give up Advantage, double your acceleration bonus, success breaks the engagement (+1 dodge)' },
  hold: { name: 'Hold Course / shake', desc: 'Fly straight; contest only to shake an Advantaged pursuer' },
  retreat: { name: 'Retreat', desc: 'Leave the fight — only possible once nobody is engaged with you' },
};

// One quick contest of Pilot between mover and opponent. A stunt is a second
// Pilot roll at -2..-10 that adds +1 to the contest per -2 taken — but failing
// it drifts (or wrecks the engines on a bad failure).
export function psiManeuverContest({ moverSkill, moverAccel, opponentSkill, opponentAccel, maneuver, stuntPenalty = 0, moverSR = 4, rng = Math.random }) {
  const log = [];
  let bonus = psiAccelBonus(moverAccel);
  if (maneuver === 'evade') bonus *= 2; // evasive action doubles the accel bonus
  let stunt = null;
  if (stuntPenalty) {
    const r = successRoll(moverSkill + stuntPenalty, rng);
    const gain = Math.floor(-stuntPenalty / 2);
    stunt = { roll: r, gain };
    if (r.success) {
      bonus += gain;
      log.push(`stunt at ${stuntPenalty} succeeds (rolled ${r.dice}): +${gain} to the contest`);
    } else {
      const wrecked = -r.margin > moverSR;
      log.push(`stunt at ${stuntPenalty} FAILS (rolled ${r.dice}, by ${-r.margin}): ${wrecked ? 'engines disabled!' : 'uncontrolled drift!'}`);
      return { log, stunt, failedStunt: true, wrecked, won: false };
    }
  }
  const mover = successRoll(moverSkill + bonus, rng);
  const opp = successRoll(opponentSkill + psiAccelBonus(opponentAccel), rng);
  const won = mover.success && (!opp.success || mover.margin > opp.margin);
  const by = mover.margin - opp.margin;
  log.push(`quick contest of Pilot: ${moverSkill}+${bonus} rolls ${mover.dice} (margin ${mover.margin}) vs ${opponentSkill}+${psiAccelBonus(opponentAccel)} rolls ${opp.dice} (margin ${opp.margin}) — ${won ? `mover wins by ${by}` : mover.success && opp.success && mover.margin === opp.margin ? 'tie: no change' : 'mover loses'}`);
  return { log, stunt, mover, opp, won, by };
}

// Point defense against a Psi-Wars missile: the target's gunners try to shoot
// it down before impact. Ignore range/target modifiers; the farther out the
// salvo was fired, the longer the defenders get to track it.
export function psiPointDefenseMods({ mKey, firedFrom, defenderSM, heavyWeapon = false }) {
  const mods = [];
  const add = (v, label) => { if (v) mods.push([v, label]); };
  const m = PSI_MISSILES[mKey];
  add(m.pd, `${m.name} point-defense penalty`);
  // The missile counts as fighter-sized for relative size.
  const cat = psiCategory(defenderSM);
  if (cat > 0) add(-(heavyWeapon ? 2 : 1) * cat, `${heavyWeapon ? 'heavy' : 'light'} weapon tracking a missile`);
  add(firedFrom === 'neutral' ? 4 : firedFrom === 'engaged' ? 2 : 0, 'flight time (fired from range)');
  return mods;
}

// Squadron damage (mook fighter wings): sum penetrating damage in a pool;
// every 50% of one fighter's dHP destroys a fighter, at most one per hit.
export function squadronDamage(sq, dhp, penetrating) {
  sq.pool = (sq.pool || 0) + penetrating;
  const perFighter = Math.max(1, Math.ceil(dhp * 0.5));
  const totalLost = Math.floor(sq.pool / perFighter);
  const newlyLost = Math.min(1, Math.max(0, totalLost - (sq.lost || 0)));
  sq.lost = (sq.lost || 0) + newlyLost;
  sq.size = Math.max(0, sq.size - newlyLost);
  return newlyLost;
}
