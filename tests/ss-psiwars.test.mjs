// Psi-Wars (Mailanka, fan) layer: presets vs published stat lines, and the
// simplified space-opera combat rules (size categories, DR 2, armor gaps,
// fixed missile table, squadrons).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeShip } from '../js/ss/ship.js';
import { PSIWARS_PRESETS } from '../js/ss/presets-psiwars.js';
import {
  PSI_CATEGORIES, PSI_MANEUVERS, PSI_MISSILES, PSI_RANGES,
  applyHit, createCombatant, psiAccelBonus, psiBeamMods, psiCategory,
  psiManeuverContest, psiMissileMods, psiPointDefenseMods, squadronDamage,
} from '../js/ss/combat.js';

const rngQueue = (...faces) => {
  const q = faces.map((f) => (f - 1) / 6 + 0.001);
  return () => q.length ? q.shift() : 0.5;
};

const byName = (frag) => {
  const p = PSIWARS_PRESETS.find((x) => x.name.includes(frag));
  assert.ok(p, `preset ${frag}`);
  return computeShip(p.design);
};

// --- Presets vs Mailanka's published stat lines ------------------------------

test('Tiger Manticore matches its published sheet', () => {
  const { stats } = byName('Tiger Manticore');
  // Hand-summing Mailanka's sheet with the SS engine tables gives exactly $746.6M.
  assert.equal(stats.cost, 746.6e6);
  assert.equal(stats.move, '75G/c');
  assert.equal(stats.ddr, '100/50/50');
  assert.equal(stats.occ, '20ASV');
  assert.equal(stats.screenDDR, 100);
  assert.equal(stats.range, 'FTL-2');
  assert.equal(stats.dstHp, 100);
});

test('Typhoon Alpha matches its published sheet', () => {
  const { stats } = byName('Typhoon Alpha');
  // Printed $2.76M vs table-priced $2.843M (he discounts SM+4 major batteries).
  assert.ok(stats.cost > 2.7e6 && stats.cost < 2.9e6, `cost ${stats.cost}`);
  assert.equal(stats.move, '200G/450 mps');
  assert.equal(stats.ddr, '15/10/10');
  assert.equal(stats.occ, '1SV');
  assert.equal(stats.hnd, 2);
});

test('all Psi-Wars presets compute without problems', () => {
  for (const p of PSIWARS_PRESETS) {
    const r = computeShip(p.design);
    assert.ok(r.stats, p.name);
    assert.deepEqual(r.problems || [], [], `${p.name}: ${(r.problems || []).join('; ')}`);
  }
});

test('super reactionless (Psi-Wars house rule) gives 25G per engine', () => {
  // Renegade Marauder: 2 engines → 50G.
  const { stats } = byName('Renegade Marauder');
  assert.equal(stats.move, '50G/c');
});

// --- Size categories and ranges ----------------------------------------------

test('psiCategory boundaries', () => {
  assert.equal(psiCategory(4), 0); // Fighter
  assert.equal(psiCategory(6), 0);
  assert.equal(psiCategory(7), 1); // Corvette
  assert.equal(psiCategory(9), 1);
  assert.equal(psiCategory(10), 2); // Capital
  assert.equal(psiCategory(12), 2);
  assert.equal(psiCategory(13), 3); // Dreadnought
  assert.equal(PSI_CATEGORIES.length, 4);
});

test('psi ranges are Neutral -8 / Engaged -4 / Hugging 0', () => {
  assert.equal(PSI_RANGES.neutral.mod, -8);
  assert.equal(PSI_RANGES.engaged.mod, -4);
  assert.equal(PSI_RANGES.hugging.mod, 0);
});

// --- Beam modifiers ----------------------------------------------------------

test('psiBeamMods: fighter shooting a capital ship at Engaged', () => {
  const mods = psiBeamMods({
    targetSM: 10, attackerSM: 4, sAcc: 0, range: 'engaged',
    tacticalArray: false, ecm: 0, fixedMount: false, shots: 1,
  });
  const total = mods.reduce((s, [v]) => s + v, 0);
  // +6 target Capital, -4 Engaged = +2.
  assert.equal(total, 2);
});

test('psiBeamMods: heavy weapon vs smaller ship penalty and targeting array vs ECM', () => {
  const mods = psiBeamMods({
    targetSM: 4, attackerSM: 9, sAcc: 0, range: 'hugging',
    heavyWeapon: true, tacticalArray: true, ecm: 1, shots: 1,
  });
  const labels = Object.fromEntries(mods.map(([v, l]) => [l, v]));
  assert.equal(labels['heavy weapon vs smaller ship'], -2); // 1 category × -2
  assert.equal(labels['targeting array vs ECM'], 1); // +2 reduced by 1 ECM
});

test('psiBeamMods: armor gap costs -10', () => {
  const mods = psiBeamMods({
    targetSM: 9, attackerSM: 9, sAcc: 0, range: 'hugging', armorGap: true, shots: 1,
  });
  assert.ok(mods.some(([v, l]) => v === -10 && /armor gap/.test(l)));
});

// --- Missile table -----------------------------------------------------------

test('PSI_MISSILES table: missiles pierce (÷10), torpedoes smash', () => {
  assert.equal(PSI_MISSILES.lightMissile.div, 10);
  assert.equal(PSI_MISSILES.lightMissile.dice, '6d');
  assert.equal(PSI_MISSILES.heavyTorpedo.dice, '6d×80');
  assert.equal(PSI_MISSILES.heavyTorpedo.div, 1);
  for (const m of Object.values(PSI_MISSILES)) assert.ok(m.pd <= 0);
});

test('psiMissileMods: size difference swings both ways', () => {
  const up = psiMissileMods({ targetSM: 10, attackerSM: 4, torpedo: false, shots: 1 });
  assert.ok(up.some(([v]) => v === 6)); // +3/category, 2 up (Fighter → Capital)
  const down = psiMissileMods({ targetSM: 4, attackerSM: 10, torpedo: true, shots: 1 });
  assert.ok(down.some(([v]) => v === -6));
  // Missiles get +1 accuracy; torpedoes don't.
  assert.ok(up.some(([, l]) => l === 'missile accuracy'));
  assert.ok(!down.some(([, l]) => l === 'missile accuracy'));
});

// --- Damage: DR 2, armor gaps, squadrons -------------------------------------

const fighter = () => createCombatant(PSIWARS_PRESETS.find((p) => p.name.includes('Typhoon Alpha')).design);
const frigate = () => createCombatant(PSIWARS_PRESETS.find((p) => p.name.includes('Tiger Manticore')).design);

test('applyHit: Damage Reduction 2 halves penetrating damage', () => {
  const c = frigate();
  c.screen = 0;
  // Front armor dDR 100; 6d×20-ish flat 140 basic → 40 penetrating → 20 after DR 2.
  const res = applyHit(c, {
    section: 'front', basicDamage: 140, div: 1, rng: rngQueue(4),
    damageReduction: 2,
  });
  assert.equal(res.penetrating, 20);
  assert.equal(c.curDhp, 80);
});

test('applyHit: armor gap ignores armor, caps damage at 25% dHP, doubles threshold', () => {
  const c = frigate(); // dHP 100
  c.screen = 0;
  const res = applyHit(c, {
    section: 'front', basicDamage: 90, div: 1, rng: rngQueue(4, 4),
    armorGap: true,
  });
  // Armor ignored, but excess past the gap system is lost: cap = 25 dHP.
  assert.equal(res.penetrating, 25);
  assert.equal(c.curDhp, 75);
  // 25/100 doubled = 50% → the struck system is destroyed (major penetration).
  assert.ok(res.log.some((l) => /destroy/i.test(l)));
});

test('applyHit: armor gap disables at half the usual threshold', () => {
  const c = frigate();
  c.screen = 0;
  const res = applyHit(c, {
    section: 'front', basicDamage: 6, div: 1, rng: rngQueue(4),
    armorGap: true,
  });
  // 6% of dHP would be no system damage normally; gaps double it to 12% → disable.
  assert.equal(res.penetrating, 6);
  assert.ok(res.log.some((l) => /disab/i.test(l)));
});

test('squadronDamage: pools damage, at most one fighter per hit', () => {
  const sq = { size: 5, pool: 0, lost: 0 };
  const dhp = 15; // Typhoon: 8 penetration downs a fighter
  assert.equal(squadronDamage(sq, dhp, 3), 0); // pool 3
  assert.equal(sq.size, 5);
  assert.equal(squadronDamage(sq, dhp, 6), 1); // pool 9 → 1 down
  assert.equal(sq.size, 4);
  assert.equal(squadronDamage(sq, dhp, 40), 1); // huge hit still only downs 1
  assert.equal(sq.size, 3);
});

// --- Dogfighting: contests, advantage, point defense -------------------------

test('psiAccelBonus is +1 per full 25G', () => {
  assert.equal(psiAccelBonus(24), 0);
  assert.equal(psiAccelBonus(25), 1);
  assert.equal(psiAccelBonus(75), 3);
  assert.equal(psiAccelBonus(200), 8);
  assert.equal(psiAccelBonus(undefined), 0);
});

test('psiManeuverContest: better pilot with more thrust wins the close', () => {
  // Mover: skill 12 + accel 75G (+3) = 15, rolls 9 → margin 6.
  // Opponent: skill 12 + 0 = 12, rolls 15 → margin -3. Mover wins by 9.
  const res = psiManeuverContest({
    moverSkill: 12, moverAccel: 75, opponentSkill: 12, opponentAccel: 0,
    maneuver: 'close', rng: rngQueue(3, 3, 3, 5, 5, 5),
  });
  assert.equal(res.won, true);
  assert.equal(res.by, 9);
});

test('psiManeuverContest: evasive action doubles the accel bonus', () => {
  // Mover: skill 10 + 2×psiAccelBonus(50G)=+4 → 14, rolls 12 → margin 2.
  // Opponent: skill 12 + 2 (50G) = 14, rolls 13 → margin 1. Mover wins by 1.
  const res = psiManeuverContest({
    moverSkill: 10, moverAccel: 50, opponentSkill: 12, opponentAccel: 50,
    maneuver: 'evade', rng: rngQueue(4, 4, 4, 5, 4, 4),
  });
  assert.equal(res.won, true);
  assert.equal(res.by, 1);
});

test('psiManeuverContest: a successful stunt adds +1 per -2 taken', () => {
  // Stunt at -4: skill 12-4=8 rolls 7 → success, +2 to the contest.
  // Mover: 12 + 0 accel + 2 stunt = 14 rolls 10 → margin 4; opponent 12 rolls 12 → 0.
  const res = psiManeuverContest({
    moverSkill: 12, moverAccel: 0, opponentSkill: 12, opponentAccel: 0,
    maneuver: 'close', stuntPenalty: -4, rng: rngQueue(2, 2, 3, 3, 3, 4, 4, 4, 4),
  });
  assert.equal(res.stunt.gain, 2);
  assert.equal(res.won, true);
  assert.equal(res.by, 4);
});

test('psiManeuverContest: a badly failed stunt wrecks the engines', () => {
  // Stunt at -4: skill 8 rolls 18 → margin -10, worse than SR 4 → wrecked.
  const res = psiManeuverContest({
    moverSkill: 12, moverAccel: 0, opponentSkill: 12, opponentAccel: 0,
    maneuver: 'close', stuntPenalty: -4, moverSR: 4, rng: rngQueue(6, 6, 6),
  });
  assert.equal(res.failedStunt, true);
  assert.equal(res.wrecked, true);
  assert.equal(res.won, false);
});

test('psiBeamMods: Advantaged tail position adds up to +4', () => {
  const mods = psiBeamMods({
    targetSM: 6, attackerSM: 6, sAcc: 0, range: 'engaged', advantage: 3, shots: 1,
  });
  assert.ok(mods.some(([v, l]) => v === 3 && /Advantaged/.test(l)));
  const capped = psiBeamMods({
    targetSM: 6, attackerSM: 6, sAcc: 0, range: 'engaged', advantage: 9, shots: 1,
  });
  assert.ok(capped.some(([v, l]) => v === 4 && /Advantaged/.test(l)));
});

test('psiPointDefenseMods: pd penalty, missile-as-fighter tracking, flight-time bonus', () => {
  const mods = psiPointDefenseMods({ mKey: 'lightMissile', firedFrom: 'neutral', defenderSM: 9 });
  const total = mods.reduce((s, [v]) => s + v, 0);
  // -7 pd, -1 corvette light weapon vs fighter-sized missile, +4 fired from Neutral.
  assert.equal(total, -4);
  const hug = psiPointDefenseMods({ mKey: 'heavyTorpedo', firedFrom: 'hugging', defenderSM: 4 });
  // pd 0, fighter (no size penalty), +0 flight time → no modifiers at all.
  assert.equal(hug.reduce((s, [v]) => s + v, 0), 0);
});

test('PSI_MANEUVERS covers the four moves', () => {
  assert.deepEqual(Object.keys(PSI_MANEUVERS), ['close', 'evade', 'hold', 'retreat']);
});

test('fighters do not get Damage Reduction', () => {
  const c = fighter(); // SM+4, front dDR 15, dHP 15
  const res = applyHit(c, {
    section: 'front', basicDamage: 25, div: 1, rng: rngQueue(4),
    damageReduction: 1,
  });
  assert.equal(res.penetrating, 10);
  assert.equal(c.curDhp, 5);
});
