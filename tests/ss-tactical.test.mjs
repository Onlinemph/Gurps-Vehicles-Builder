// GURPS Spaceships tactical hex combat engine (SS3).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  HEX_DIRS, arcAllows, beamHexRange, bearingArc, burnPoints, coast,
  facingSteps, hexAdd, hexDistance, hexDirection, hexLength, hexesToMps,
  maxFacingChange, missilePerformance, missileSeek, mpsToHexes,
  scaleFactor, tacticalRangeMod, tacticalVelocityMod, thrustRating,
} from '../js/ss/tactical.js';
import { BEAM_TYPES } from '../js/ss/combat.js';

test('hex math basics', () => {
  assert.equal(hexDistance({ q: 0, r: 0 }, { q: 3, r: -3 }), 3);
  assert.equal(hexDistance({ q: 0, r: 0 }, { q: 2, r: 1 }), 3);
  assert.equal(hexLength({ q: -2, r: 2 }), 2);
  assert.equal(hexDirection({ q: 0, r: 0 }, { q: 0, r: -4 }), 0); // straight up
  assert.equal(hexDirection({ q: 0, r: 0 }, { q: 3, r: 0 }), 2);  // down-right
  assert.equal(facingSteps(0, 5), 1);
  assert.equal(facingSteps(1, 4), 3);
});

test('velocity/thrust/burn conversions (the book worked values)', () => {
  // Standard scale is not a thing here — these are hex-scale factors.
  // 1 mps at 10-mile hexes, 3-minute turns = 20 hexes/turn.
  assert.equal(mpsToHexes(1, 0, '3m'), 20);
  assert.equal(hexesToMps(20, 0, '3m'), 1);
  // 1G at 10-mile/20-second = 0.2 hexes/turn²; at 3-minute = 20.
  assert.equal(thrustRating(1, 0, '20s'), 0.2);
  assert.equal(thrustRating(1, 0, '3m'), 20);
  // 100-mile hexes divide by 10.
  assert.equal(thrustRating(1, 1, '3m'), 2);
  // Burn points track current delta-V at the velocity factor.
  assert.equal(burnPoints(6.3, 0, '1m'), 37.8);
  // Damage scale factor: 3-minute at 100-mile hexes = 2.
  assert.equal(scaleFactor(1, '3m'), 2);
});

test('tactical range and velocity modifiers', () => {
  assert.equal(tacticalRangeMod(0, 0), 12);
  assert.equal(tacticalRangeMod(10, 0), 0);
  assert.equal(tacticalRangeMod(30, 1), -9);
  assert.equal(tacticalRangeMod(1000, 0), -12); // 100-149 band ÷10 → -6 -6
  assert.equal(tacticalVelocityMod(0, 0), 10);
  assert.equal(tacticalVelocityMod(2, 0), 6);
  assert.equal(tacticalVelocityMod(10, 1), -4); // +2 at 10-mi, -6 for 100-mi
});

test('beam ranges in hexes match the SS3 tables', () => {
  const laser = BEAM_TYPES.laser;
  assert.deepEqual(beamHexRange('10MJ', laser, 0), { half: 70, max: 200 });
  assert.deepEqual(beamHexRange('10MJ', laser, 1), { half: 7, max: 20 });
  assert.deepEqual(beamHexRange('10MJ', laser, 2), { half: 1, max: 2 });
  // 3 kJ laser: 15/50 → at 100-mile: 2/5 (round half to even: 1.5→2).
  assert.deepEqual(beamHexRange('3kJ', laser, 1), { half: 2, max: 5 });
  // …and at 1,000-mile: 0.15/0.5 → 0/0.
  assert.deepEqual(beamHexRange('3kJ', laser, 2), { half: 0, max: 0 });
  // Graser family reaches farther; plasma shorter.
  assert.deepEqual(beamHexRange('10MJ', BEAM_TYPES.graser, 0), { half: 150, max: 500 });
  assert.deepEqual(beamHexRange('10MJ', BEAM_TYPES.plasma, 0), { half: 15, max: 50 });
  // Ghost/particle family at 1,000-mile from 30/100: 0/1.
  assert.deepEqual(beamHexRange('3MJ', BEAM_TYPES.ghostParticle, 2), { half: 0, max: 1 });
});

test('facing change limits', () => {
  assert.equal(maxFacingChange(6, '20s'), 3);
  assert.equal(maxFacingChange(8, '20s'), 2);
  assert.equal(maxFacingChange(8, '1m'), 3);
  assert.equal(maxFacingChange(11, '20s'), 1);
  assert.equal(maxFacingChange(14, '3m'), 2);
});

test('bearing arcs and weapon arcs', () => {
  const me = { q: 0, r: 0 };
  // Facing up (0); target straight up = front; behind = rear; side = central.
  assert.equal(bearingArc(me, 0, { q: 0, r: -3 }), 'front');
  assert.equal(bearingArc(me, 0, { q: 0, r: 4 }), 'rear');
  assert.equal(bearingArc(me, 0, { q: 3, r: 0 }), 'central');
  assert.ok(arcAllows('front', 'turret', 'front'));
  assert.ok(arcAllows('front', 'turret', 'central'));
  assert.ok(!arcAllows('front', 'turret', 'rear'));
  assert.ok(arcAllows('central', 'turret', 'rear'));
  assert.ok(!arcAllows('front', 'fixed', 'central'));
  assert.ok(arcAllows('rear', 'fixed', 'rear'));
});

test('missile performance tables', () => {
  const m = missilePerformance('standard912', 28, 0, '1m');
  assert.equal(m.tr, 10);
  assert.equal(m.bp, 60);
  const big = missilePerformance('standard912', 32, 0, '1m');
  assert.equal(big.bp, 120); // 32cm+ doubles burn points
  const sup = missilePerformance('super', 28, 1, '20s');
  assert.equal(sup.tr, 10);
});

test('missile seek closes on a coasting target', () => {
  const missile = { pos: { q: 0, r: 0 }, vel: { q: 0, r: 0 }, tr: 10, bp: 60 };
  const targetPos = { q: 6, r: 0 };
  const targetVel = { q: 0, r: 0 };
  const thrust = missileSeek(missile, targetPos, targetVel);
  missile.vel = hexAdd(missile.vel, thrust);
  missile.pos = coast(missile.pos, missile.vel);
  assert.ok(hexDistance(missile.pos, targetPos) < 6, `closed to ${hexDistance(missile.pos, targetPos)}`);
});

test('missile with no burn points cannot thrust', () => {
  const missile = { pos: { q: 0, r: 0 }, vel: { q: 1, r: 0 }, tr: 10, bp: 0 };
  const thrust = missileSeek(missile, { q: 5, r: 0 }, { q: 0, r: 0 });
  assert.deepEqual(thrust, { q: 0, r: 0 });
});
