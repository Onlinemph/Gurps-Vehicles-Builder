// Built-in component catalog tests — checked against the same book formulas
// the official GVB data files produce.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { COMPONENT_CATALOG, buildFromCatalog } from '../js/ve2/components.js';

const get = (key) => COMPONENT_CATALOG.find((c) => c.key === key);
const build = (key, params, tl, opts = {}) => buildFromCatalog(get(key), params, tl, opts);

test('gasoline engine matches the book (jeep: 40 kW TL6 = 270 lbs, $540, 1.8 gph)', () => {
  const c = build('gasoline', { kw: 40 }, 6);
  assert.equal(c.weight, 270);
  assert.equal(c.cost, 540);
  assert.ok(Math.abs(c.fuelGph - 1.8) < 1e-9);
  assert.equal(c.kwOut, 40);
  assert.equal(c.airBreathing, true);
});

test('wheeled drivetrain matches the book (jeep: 40 kW TL6 = 120 lbs, $480)', () => {
  const c = build('wheeledDT', { kw: 40 }, 6);
  assert.equal(c.weight, 120);
  assert.equal(c.cost, 480);
  assert.equal(c.groundKw, 40);
});

test('helicopter drivetrain: lift 10 lbs/kW, thrust 1.6 lbs/kW', () => {
  const c = build('heliDT', { kw: 800 }, 7);
  assert.equal(c.weight, 0.5 * 800 + 25);
  assert.equal(c.staticLift, 8000);
  assert.equal(c.airThrust, 1280);
});

test('turbofan: TL7 8,000 lbs thrust = 1,800 lbs, 240 gph', () => {
  const c = build('turbofan', { thrust: 8000 }, 7);
  assert.equal(c.weight, 1800);
  assert.equal(c.fuelGph, 240);
  assert.equal(c.airThrust, 8000);
});

test('crew station sizes and ejection option', () => {
  const normal = build('crewStation', { count: 1 }, 7);
  assert.equal(normal.weight, 30);
  assert.equal(normal.volume, 30);
  const eject = build('crewStation', { count: 2 }, 7, { cramped: true, ejection: true });
  assert.equal(eject.weight, (20 + 100) * 2);
  assert.equal(eject.cost, (100 + 50000) * 2);
});

test('radar scales by TL and range', () => {
  const c = build('radar', { miles: 20 }, 8);
  assert.equal(c.weight, 40);       // 20 mi × 2 lb/mi at TL8
  assert.equal(c.cost, 20000);      // 20 × $1,000
  assert.equal(c.kwIn, 5);
});

test('fuel tank: TL7 50 gal = 50 lbs, $250', () => {
  const c = build('fuelTank', { gal: 50 }, 7);
  assert.equal(c.weight, 50);
  assert.equal(c.cost, 250);
  const ss = build('fuelTank', { gal: 50 }, 7, { selfSealing: true });
  assert.equal(ss.weight, 100);
});

test('TL clamps to the entry range and is noted in the name', () => {
  const c = build('gasoline', { kw: 50 }, 9); // gasoline caps at TL7
  assert.ok(c.name.includes('(TL7)'));
  assert.equal(c.weight, 5 * 50 + 25);
});

test('every catalog entry generates finite, non-negative numbers across its TL range', () => {
  for (const entry of COMPONENT_CATALOG) {
    for (let tl = entry.minTL; tl <= Math.min(entry.maxTL ?? 12, 12); tl++) {
      const params = {};
      for (const p of entry.params) params[p.key] = p.def;
      const c = buildFromCatalog(entry, params, tl);
      for (const k of ['weight', 'cost', 'volume', 'kwIn', 'kwOut', 'groundKw', 'aquaticThrust', 'airThrust', 'staticLift', 'fuelGph']) {
        assert.ok(Number.isFinite(c[k]) && c[k] >= 0, `${entry.name} TL${tl} ${k} = ${c[k]}`);
      }
      assert.ok(c.name.length > 0);
    }
  }
});
