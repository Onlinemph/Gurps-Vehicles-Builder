// GURPS 4e conversion tests.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  convertTo4e, estimateLengthYds, hndFromMR, hp4e, mphToMove,
  sm4eFromLength, tl4eFrom3e, to4eMarkdown,
} from '../js/ve2/fourth.js';
import { computeVe2 } from '../js/ve2/vehicle.js';
import { VE2_PRESETS } from '../js/ve2/presets.js';

test('TL shift: 3e→4e', () => {
  assert.equal(tl4eFrom3e(6), 6);
  assert.equal(tl4eFrom3e(7), 7);   // early TL7; late is noted as 8
  assert.equal(tl4eFrom3e(8), 9);
  assert.equal(tl4eFrom3e(9), 10);
  assert.equal(tl4eFrom3e(10), 11);
  assert.equal(tl4eFrom3e(11), 11);
  assert.equal(tl4eFrom3e(12), 12);
  assert.equal(tl4eFrom3e(14), 12);
});

test('HP from empty weight: 3,000-lb car is about 58 HP', () => {
  assert.equal(hp4e(3000), 58);
});

test('speed conversion: mph halves to yards/second', () => {
  assert.equal(mphToMove(185), 93);
  assert.equal(mphToMove(10), 5);
});

test('Hnd heuristic lands in sane 4e ranges', () => {
  assert.equal(hndFromMR(1.5, 'ground'), 2);   // sports car / kitty hawk
  assert.equal(hndFromMR(0.75, 'ground'), 0);  // sedan
  assert.equal(hndFromMR(0.25, 'ground'), -1); // truck/tank
  assert.equal(hndFromMR(0.05, 'water'), -3);  // big ship
  assert.equal(hndFromMR(5, 'air'), 3);        // fighter
});

test('SM from longest dimension: a 5-yard car is SM +3', () => {
  assert.equal(sm4eFromLength(5), 3);
  assert.equal(sm4eFromLength(15), 6);
  assert.ok(estimateLengthYds(280) > 4 && estimateLengthYds(280) < 6);
});

test('jeep converts: no PD, Move from mph, weapons list empty', () => {
  const jeep = VE2_PRESETS.find((p) => p.name === 'TL6 Jeep');
  const r = computeVe2(jeep);
  const c = convertTo4e(jeep, r);
  assert.equal(c.tl4, 6);
  assert.ok(c.stHp > 20 && c.stHp < 60, `HP ${c.stHp}`);
  assert.ok(!('pd' in c), 'no PD in 4e output');
  assert.equal(c.moves.ground, `${Math.round(r.perf.ground.gAccel / 2)}/${Math.round(r.perf.ground.topSpeed / 2)}`);
  assert.ok(c.hnd >= -2 && c.hnd <= 1, `Hnd ${c.hnd}`);
  assert.ok(c.sr >= 2 && c.sr <= 5, `SR ${c.sr}`);
  assert.equal(c.htSuffix, 'f'); // gasoline
  assert.equal(c.weaponsToSwap.length, 0);
  assert.ok(c.rangeMi > 100, `range ${c.rangeMi}`);
  const md = to4eMarkdown(jeep, r);
  assert.ok(md.includes('| TL | ST/HP | Hnd/SR |'));
  assert.ok(md.includes('PD is dropped'));
});

test('tank converts: TL shift, facing DR carried, gun flagged for swap', () => {
  const tank = VE2_PRESETS.find((p) => p.name.includes('Battle Tank'));
  const r = computeVe2(tank);
  const c = convertTo4e(tank, r);
  assert.equal(c.tl4, 7);
  assert.ok(c.drStr.startsWith('900'), `DR ${c.drStr}`); // sloped front carries over
  assert.ok(c.weaponsToSwap.some((w) => w.includes('120mm')), c.weaponsToSwap.join(', '));
  assert.equal(c.htSuffix, 'x'); // >500 lbs of ammo aboard
  assert.ok(c.locations.includes('C') && c.locations.includes('T'), c.locations);
});

test('length override changes SM', () => {
  const jeep = VE2_PRESETS.find((p) => p.name === 'TL6 Jeep');
  const r = computeVe2(jeep);
  const auto = convertTo4e(jeep, r);
  const manual = convertTo4e(jeep, r, { lengthYds: 15 });
  assert.equal(manual.sm, 6);
  assert.ok(manual.sm > auto.sm);
});
