// GURPS Spaceships basic space combat engine (SS1 Chapter 4).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyHit, ballisticAttackMods, beamAttackMods, beamRangeCheck, beamStats,
  collisionDice, combatantWeapons, conventionalWarhead, createCombatant,
  damageSystem, dodgeScore, effectiveStats, fmtDice, parseDice, rangeBand,
  rapidFireBonus, rollDice, velocityMod,
} from '../js/ss/combat.js';
import { defaultShip } from '../js/ss/ship.js';
import { SS_PRESETS } from '../js/ss/presets.js';

// Deterministic RNG: returns queued values scaled to [0,1) for d6.
const rngQueue = (...faces) => {
  const q = faces.map((f) => (f - 1) / 6 + 0.001);
  return () => q.length ? q.shift() : 0.5;
};

test('dice parsing and rolling', () => {
  assert.deepEqual(parseDice('4d'), { n: 4, add: 0, mult: 1 });
  assert.deepEqual(parseDice('3d+2'), { n: 3, add: 2, mult: 1 });
  assert.deepEqual(parseDice('1d-3'), { n: 1, add: -3, mult: 1 });
  assert.deepEqual(parseDice('6d×14'), { n: 6, add: 0, mult: 14 });
  assert.deepEqual(parseDice('2d×1,000'), { n: 2, add: 0, mult: 1000 });
  // 3 dice, all rolling 4 → 12; ×5 → 60; extra velocity mult 10 → 600.
  assert.equal(rollDice(parseDice('3d×5'), rngQueue(4, 4, 4), 10), 600);
  assert.equal(fmtDice(parseDice('6d×14'), 10), '6d×140');
});

test('beam stats: SM+8 tertiary UV laser (10 MJ)', () => {
  const s = beamStats('10MJ', 'uvLaser');
  assert.equal(fmtDice(s.dice), '4d');
  assert.equal(s.div, 2);
  // UV laser uses Range 3: 10 MJ → S/L (full to Short, half at Long).
  assert.equal(beamRangeCheck(s, 'short'), 'full');
  assert.equal(beamRangeCheck(s, 'long'), 'half');
  assert.equal(beamRangeCheck(s, 'extreme'), 'out');
});

test('graviton beams use 1/10 output for damage', () => {
  const g = beamStats('10MJ', 'graviton');
  assert.equal(fmtDice(g.dice), '2d'); // 1 MJ row
  assert.equal(g.div, Infinity);
});

test('range table and modifiers', () => {
  assert.equal(rangeBand('engaged', 'standard'), 'short');
  assert.equal(rangeBand('neutral', 'distant'), 'extreme');
  assert.equal(velocityMod(0), 6);
  assert.equal(velocityMod(1), 0);
  assert.equal(velocityMod(10), -6);
  assert.equal(rapidFireBonus(3), 0);
  assert.equal(rapidFireBonus(10), 2);
  assert.equal(rapidFireBonus(600), 9);
});

test('beam attack modifier list adds up like the book example', () => {
  // SM+8 target, laser (sAcc 0), Short range, 2 ECM, 10 shots.
  const mods = beamAttackMods({ targetSM: 8, sAcc: 0, band: 'short', ecm: 2, shots: 10 });
  const total = mods.reduce((a, [v]) => a + v, 0);
  assert.equal(total, 8 - 8 - 4 + 2); // SM +8, range -8, ECM -4, shots +2
});

test('ballistic modifiers: 56cm missile at 10 mps', () => {
  const mods = ballisticAttackMods({ targetSM: 10, sAcc: 2, velocity: 10, shots: 1 });
  const total = mods.reduce((a, [v]) => a + v, 0);
  assert.equal(total, 10 + 2 - 6);
  const wh = conventionalWarhead(56);
  assert.equal(fmtDice(wh, 10), '6d×140'); // book's own example
});

test('dodge score', () => {
  const { score } = dodgeScore({ piloting: 13, hnd: -1, turn: '3m', ecm: 1, evasive: true });
  assert.equal(score, 7 - 1 + 2 + 1 + 1);
});

test('collision dice', () => {
  const d = collisionDice(20, 0.5); // dST 20 fighter at 0.5 mps
  assert.equal(fmtDice(d), '6d×30');
});

// --- Damage pipeline on a real ship ------------------------------------------
const starFlower = () => JSON.parse(JSON.stringify(SS_PRESETS[0].design));

test('hit that fails to penetrate armor', () => {
  const c = createCombatant(starFlower());
  const r = applyHit(c, { section: 'front', basicDamage: 5, rng: rngQueue(2) });
  assert.equal(r.penetrating, 0);
  assert.equal(c.curDhp, c.dhp);
});

test('minor penetration disables the hit system', () => {
  const c = createCombatant(starFlower()); // dHP 70, front dDR 7
  // 20 basic - 7 armor = 13 penetrating (≥10%, <50% of 70) → disable slot [2].
  const r = applyHit(c, { section: 'front', basicDamage: 20, rng: rngQueue(2) });
  assert.equal(r.penetrating, 13);
  assert.equal(c.curDhp, 57);
  assert.equal(c.slots.front[1].state, 'disabled');
});

test('major penetration destroys and damages an extra system', () => {
  const c = createCombatant(starFlower());
  // 50 basic - 7 armor = 43 pen ≥ 50% of 70 → destroy [3], plus extra roll [5] disabled.
  applyHit(c, { section: 'front', basicDamage: 50, rng: rngQueue(3, 5) });
  assert.equal(c.slots.front[2].state, 'destroyed');
  assert.equal(c.slots.front[4].state, 'disabled');
});

test('skip-upward rule walks past destroyed systems into the core', () => {
  const c = createCombatant(starFlower());
  for (let i = 1; i < 6; i++) c.slots.front[i].state = 'destroyed';
  // hit slot [4]: everything up is destroyed → falls through to the core.
  const log = damageSystem(c, 'front', 3, 'disable');
  assert.ok(log.some((l) => l.includes('[core]')), log.join('; '));
  assert.equal(c.slots.front[6].state, 'disabled');
});

test('armor divisor and destroyed-armor hole', () => {
  const c = createCombatant(starFlower());
  c.slots.front[0].state = 'destroyed'; // the armor slot
  // Hit location [1] = the destroyed armor: its dDR is ignored → 10 pen (no armor left in front).
  const r = applyHit(c, { section: 'front', basicDamage: 10, rng: rngQueue(1) });
  assert.equal(r.penetrating, 10);
});

test('force screen ablates and protects', () => {
  const d = defaultShip();
  d.tl = 11;
  d.sections.front[0] = { sys: 'armor_metallicLaminate', opts: {} };
  d.sections.central[0] = { sys: 'forceScreenLight', opts: {} };
  d.sections.rear[0] = { sys: 'standardReactionless', opts: {} };
  d.cores[1] = { section: 'rear', sys: 'fusionReactor', opts: {} };
  const c = createCombatant(d);
  assert.equal(c.screen, 70); // SM+8 TL11 light screen dDR
  const before = c.screen;
  applyHit(c, { section: 'front', basicDamage: 40, rng: rngQueue(2) });
  assert.equal(c.screen, before - 4); // ablates 1 per 10 basic damage
  assert.equal(c.curDhp, c.dhp);      // screen stopped it all
});

test('degraded stats after losing an engine', () => {
  const c = createCombatant(starFlower()); // 2 × 1G reactionless
  c.slots.rear[1].state = 'destroyed';
  const s = effectiveStats(c);
  assert.equal(s.accelG, 1);
  assert.equal(s.move, '1G/c');
});

test('0 dHP penalties', () => {
  const c = createCombatant(starFlower());
  c.curDhp = 0;
  const s = effectiveStats(c);
  assert.equal(s.hnd, c.result.stats.hnd - 2);
  assert.equal(s.beamPenalty, -2);
});

test('weapons list respects disabled batteries', () => {
  const c = createCombatant(starFlower());
  let w = combatantWeapons(c);
  assert.equal(w.length, 1); // the tertiary battery
  assert.equal(w[0].weapons, 1);
  c.slots.central[5].state = 'destroyed';
  w = combatantWeapons(c);
  assert.equal(w.length, 0);
});
