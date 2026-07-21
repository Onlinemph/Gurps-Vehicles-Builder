// ---------------------------------------------------------------------------
// GURPS 4e conversion for VE2 designs.
//
// The VE2 engineering (volumes, weights, kW, costs) is edition-agnostic;
// this module converts the *game-stat output* to 4e conventions:
//   1. TL shift (3e TL8 → 4e TL9, etc.)
//   2. HP = 4 × cbrt(empty weight in lbs)
//   3. PD deleted; DR carries over
//   4. Move in yards/second (mph ÷ 2), accel likewise
//   5. MR/SR → Hnd/SR by benchmark heuristics
//   6. HT 10-12 with f/x suffixes; SM from longest dimension
//   7. Weapons flagged for swapping with 4e High-Tech/Ultra-Tech equivalents
// There is no official conversion, so the Hnd/SR and SM steps are documented
// judgment calls — tune them to taste.
// ---------------------------------------------------------------------------

import { FUELS } from './tables.js';

// 1. TL shift. Early 3e TL7 stays 4e TL7; 1980s+ designs should be read as
// 4e TL8 (we note this rather than guess).
export function tl4eFrom3e(tl) {
  if (tl <= 7) return tl;
  if (tl === 8) return 9;
  if (tl === 9) return 10;
  if (tl <= 11) return 11;
  return 12;
}

// 2. HP from empty weight (a 3,000-lb car ≈ 58 HP).
export function hp4e(emptyLbs) {
  return Math.max(Math.round(4 * Math.cbrt(Math.max(emptyLbs, 1))), 1);
}

// 4. Move: mph → yards/second.
export const mphToMove = (mph) => Math.round(mph / 2);

// 5. MR → Hnd, benchmarked per environment. Higher 3e MR = better Hnd.
export function hndFromMR(mr, env = 'ground') {
  const bands = {
    // [minMR, Hnd] — first match wins.
    ground: [[1.5, 2], [1, 1], [0.5, 0], [0.25, -1], [0.125, -2]],
    water: [[1, 1], [0.5, 0], [0.25, -1], [0.1, -2], [0.05, -3]],
    air: [[5, 3], [3, 2], [1.5, 1], [0.75, 0], [0.375, -1], [0.2, -2]],
  }[env] || [];
  for (const [min, hnd] of bands) if (mr >= min) return hnd;
  return env === 'ground' ? -3 : -4;
}

// 5. SR carries over, clamped to the 4e range.
export const sr4e = (sr) => Math.min(Math.max(Math.round(sr), 1), 5);

// 6. SM from the Size and Speed/Range Table by longest dimension, −1 for
// long-box shapes (a 5-yard car is SM +3).
const SIZE_TABLE = [
  [0.33, -3], [0.5, -2], [0.7, -1], [1, 0], [1.5, 1], [2, 2], [3, 3],
  [5, 4], [7, 5], [10, 6], [15, 7], [20, 8], [30, 9], [50, 10],
  [70, 11], [100, 12], [150, 13], [200, 14],
];

export function sm4eFromLength(lengthYds) {
  let sm = 15;
  for (const [len, val] of SIZE_TABLE) {
    if (lengthYds <= len) { sm = val; break; }
  }
  return Math.max(sm - 1, -4);
}

// Longest-dimension estimate from total volume (cf): ~0.8 × cbrt gives
// sensible lengths (280 cf car → 5.2 yd, 1,000 cf tank → 8 yd). Override it
// with a measured length whenever you have one.
export function estimateLengthYds(totalVolumeCf) {
  return Math.round(0.8 * Math.cbrt(Math.max(totalVolumeCf, 0.1)) * 10) / 10;
}

// Weapon-ish component detector for the swap list (rule 7).
const WEAPON_RE = /gun|cannon|mg\b|machine ?gun|launcher|missile|rocket pod|autocannon|gatling|mortar|laser|blaster|beam|torpedo|bomb/i;

export function convertTo4e(design, r, opts = {}) {
  const d = design;
  const notes = [];

  const tl4 = tl4eFrom3e(d.tl);
  if (d.tl === 7) notes.push('3e TL7 spans 1950-2000: treat 1980s-or-later designs as 4e TL8.');

  const stHp = hp4e(r.weights.empty);

  // DR: carry over effective values; PD is simply dropped.
  let drStr;
  if (r.armor.mode === 'facing' && r.armor.faces) {
    const order = ['front', 'back', 'left', 'right', 'top', 'under'];
    const vals = order.map((f) => r.armor.faces[f]?.effDR ?? 0);
    drStr = vals.every((v) => v === vals[0]) ? String(vals[0]) : `${vals[0]}/${vals[2]}/${vals[1]} (F/S/B)`;
  } else {
    drStr = String(r.armor.dr ?? 0);
  }

  // Moves per mode (accel/top, both in yards/second).
  const moves = {};
  if (r.perf.ground) moves.ground = `${mphToMove(r.perf.ground.gAccel)}/${mphToMove(r.perf.ground.topSpeed)}`;
  if (r.perf.water) moves.water = `${mphToMove(r.perf.water.wAccel)}/${mphToMove(r.perf.water.topSpeed)}`;
  if (r.perf.submerged) moves.submerged = `${mphToMove(r.perf.submerged.uAccel)}/${mphToMove(r.perf.submerged.topSpeed)}`;
  if (r.perf.aerial) moves.air = `${mphToMove(r.perf.aerial.aAccel)}/${mphToMove(r.perf.aerial.topSpeed)}`;

  // Headline Hnd/SR from the primary mode.
  let hnd = 0;
  let sr = 4;
  const hndsr = {};
  if (r.perf.ground) hndsr.ground = { hnd: hndFromMR(r.perf.ground.gMR, 'ground'), sr: sr4e(r.perf.ground.gSR) };
  if (r.perf.water) hndsr.water = { hnd: hndFromMR(r.perf.water.wMR, 'water'), sr: sr4e(r.perf.water.wSR) };
  if (r.perf.aerial) hndsr.air = { hnd: hndFromMR(r.perf.aerial.aMR, 'air'), sr: sr4e(r.perf.aerial.aSR) };
  const primary = hndsr.ground || hndsr.water || hndsr.air;
  if (primary) ({ hnd, sr } = primary);

  // HT 10-12 (better 3e structural HT nudges it up), with f/x suffixes.
  const ht = Math.min(Math.max(r.stats.ht, 10), 12);
  const fuel = FUELS[d.fuel.type] || FUELS.gasoline;
  let suffix = '';
  const hasFuel = (Number(d.fuel.gallons) || 0) > 0;
  // Higher fire number = ignites more easily; diesel (9) doesn't rate an 'f'.
  if (hasFuel && fuel.fire !== null && fuel.fire >= 10) suffix += 'f';
  const ammoWeight = (d.components || []).reduce((a, c) => a + (/ammo|rounds|shell|missile|rocket/i.test(c.name || '') ? (Number(c.weight) || 0) : 0), 0);
  if ((hasFuel && d.fuel.type === 'hydrogen') || ammoWeight > 500) suffix += 'x';

  // SM from longest dimension (estimated unless supplied).
  const lengthYds = Number(opts.lengthYds) > 0 ? Number(opts.lengthYds) : estimateLengthYds(r.totalVolume);
  const sm = sm4eFromLength(lengthYds);

  // Load = payload + fuel; Range at ~70% of top speed for the duration.
  const loadTons = Math.round((r.weights.payload + r.weights.fuel) / 20) / 100;
  let rangeMi = null;
  if (r.fuelUse?.durationHours) {
    const top = r.perf.ground?.topSpeed || r.perf.water?.topSpeed || r.perf.aerial?.topSpeed || 0;
    if (top > 0) rangeMi = Math.round(0.7 * top * r.fuelUse.durationHours);
  }

  const locations = buildLocations(d);
  const weaponsToSwap = (d.components || []).filter((c) => WEAPON_RE.test(c.name || '')).map((c) => c.name);

  return {
    tl4, stHp, hnd, sr, hndsr, ht, htSuffix: suffix, moves,
    lwtTons: r.weights.loadedTons, loadTons,
    sm, lengthYds,
    occ: `${d.crew}+${d.passengers}`,
    drStr, rangeMi,
    cost: r.stats.price,
    locations, notes, weaponsToSwap,
  };
}

function buildLocations(d) {
  const sub = d.subassemblies;
  const parts = [];
  if ((d.crew + d.passengers) > 0) parts.push(d.exposedSeats >= (d.crew + d.passengers) ? 'E' : 'G');
  if (sub.arms?.length) parts.push(`${sub.arms.length}A`);
  if (sub.wheels?.present) parts.push(`${sub.wheels.count}${sub.wheels.retractable ? 'r' : ''}W`);
  if (sub.tracks?.present || sub.halftracks?.present) parts.push('C');
  if (sub.legs?.present) parts.push(`${sub.legs.count}L`);
  if (sub.skids?.present) parts.push('s');
  if (sub.wings?.present) parts.push('Wi');
  if (sub.rotors?.present) parts.push('R');
  (sub.turrets || []).forEach(() => parts.push('T'));
  (sub.superstructures || []).forEach(() => parts.push('S'));
  (sub.openMounts || []).forEach(() => parts.push('O'));
  if (sub.masts?.present) parts.push('M');
  return parts.join('') || '–';
}

const fmt = (x) => Math.round(x).toLocaleString('en-US');
const signed = (n) => (n >= 0 ? `+${n}` : String(n));

export function to4eMarkdown(design, r, opts = {}) {
  const c = convertTo4e(design, r, opts);
  const lines = [];
  lines.push(`## ${design.name} — GURPS 4e conversion`);
  lines.push('');
  lines.push(`*Converted from a 3e Vehicles design (3e TL${design.tl} → 4e TL${c.tl4}).*`);
  lines.push('');
  lines.push('| TL | ST/HP | Hnd/SR | HT | Move | LWt. | Load | SM | Occ. | DR | Range | Cost | Locations |');
  lines.push('|----|-------|--------|----|------|------|------|----|------|----|-------|------|-----------|');
  const move = c.moves.ground || c.moves.water || c.moves.air || '0/0';
  lines.push(`| ${c.tl4} | ${c.stHp} | ${signed(c.hnd)}/${c.sr} | ${c.ht}${c.htSuffix} | ${move} ` +
    `| ${c.lwtTons} | ${c.loadTons} | ${signed(c.sm)} | ${c.occ} | ${c.drStr} ` +
    `| ${c.rangeMi === null ? '—' : `${fmt(c.rangeMi)} mi`} | $${fmt(c.cost)} | ${c.locations} |`);
  lines.push('');
  const modeNames = { ground: 'Ground', water: 'Water', submerged: 'Submerged', air: 'Air' };
  for (const [mode, mv] of Object.entries(c.moves)) {
    const hs = c.hndsr[mode === 'submerged' ? 'water' : mode];
    lines.push(`- ${modeNames[mode]} Move ${mv}` + (hs ? ` (Hnd/SR ${signed(hs.hnd)}/${hs.sr})` : '') + '.');
  }
  lines.push(`- Longest dimension ~${c.lengthYds} yds${opts.lengthYds > 0 ? '' : ' (estimated — override it if you know the real length)'}.`);
  lines.push('');
  lines.push('### Conversion notes');
  lines.push('');
  lines.push('- PD is dropped; DR values carry over unchanged.');
  lines.push('- Hnd/SR come from benchmark heuristics on the 3e MR/SR — sanity-check against comparable vehicles in the Basic Set and High-Tech.');
  for (const n of c.notes) lines.push(`- ${n}`);
  if (c.weaponsToSwap.length) {
    lines.push('- **Swap these weapons** for 4e equivalents from High-Tech/Ultra-Tech (the 3e gun-design output does not match 4e Acc/damage norms):');
    for (const w of c.weaponsToSwap) lines.push(`  - ${w}`);
  }
  return lines.join('\n');
}
