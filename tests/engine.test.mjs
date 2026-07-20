import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeStats, defaultDesign } from '../js/engine.js';
import { PRESETS } from '../js/presets.js';

test('default design is a legal vehicle', () => {
  const r = computeStats(defaultDesign());
  assert.deepEqual(r.errors, [], r.errors.join('; '));
  assert.ok(r.weights.loaded <= r.weights.maxLWt);
});

test('every preset compiles without errors', () => {
  for (const preset of PRESETS) {
    const r = computeStats(preset);
    assert.deepEqual(r.errors, [], `${preset.name}: ${r.errors.join('; ')}`);
  }
});

test('sedan preset lands in a sensible envelope', () => {
  const sedan = PRESETS.find((p) => p.name.startsWith('Sedan'));
  const r = computeStats(sedan);
  const s = r.stats;
  assert.ok(s.topMph > 95 && s.topMph < 145, `top speed ${s.topMph}`);
  assert.ok(s.stHp > 40 && s.stHp < 65, `HP ${s.stHp}`);
  assert.equal(s.sm, 3, `SM ${s.sm}`);
  assert.equal(s.occ, '1+3');
  assert.ok(s.rangeMi > 200, `range ${s.rangeMi}`);
  assert.ok(s.cost > 8000 && s.cost < 60000, `cost ${s.cost}`);
  assert.equal(s.locations, 'G4W');
});

test('tank preset is slow, tough, and turreted', () => {
  const tank = PRESETS.find((p) => p.name.includes('Battle Tank'));
  const r = computeStats(tank);
  const s = r.stats;
  assert.ok(s.topMph > 30 && s.topMph < 55, `top speed ${s.topMph}`);
  assert.ok(s.stHp > 150, `HP ${s.stHp}`);
  assert.ok(s.locations.includes('C') && s.locations.includes('T'), s.locations);
  assert.equal(s.dr.split('/')[0], '400');
});

test('airplane gets a stall speed; ground vehicles do not', () => {
  const plane = PRESETS.find((p) => p.name.includes('Airplane'));
  const rp = computeStats(plane);
  assert.ok(rp.stats.stallMph > 0);
  const rs = computeStats(PRESETS.find((p) => p.name.startsWith('Sedan')));
  assert.equal(rs.stats.stallMph, null);
});

test('overloading the frame is an error', () => {
  const d = defaultDesign();
  d.cargoLbs = 100000;
  const r = computeStats(d);
  assert.ok(r.errors.some((e) => e.includes('Overloaded')), r.errors.join('; '));
});

test('TL gates components', () => {
  const d = defaultDesign();
  d.tl = 5;
  d.engine = 'gasoline'; // TL6+
  const r = computeStats(d);
  assert.ok(r.errors.some((e) => e.includes('requires TL 6+')), r.errors.join('; '));
});

test('underpowered airplane cannot fly', () => {
  const plane = structuredClone(PRESETS.find((p) => p.name.includes('Airplane')));
  plane.power = 20;
  const r = computeStats(plane);
  assert.ok(r.errors.some((e) => e.includes('to fly')), r.errors.join('; '));
});

test('more power means more speed; more armor means more weight', () => {
  const a = defaultDesign();
  const b = defaultDesign();
  b.power = a.power * 2;
  assert.ok(computeStats(b).stats.topMph > computeStats(a).stats.topMph);

  const c = defaultDesign();
  c.armor = { ...c.armor, front: 50 };
  assert.ok(computeStats(c).weights.armor > computeStats(a).weights.armor);
});

test('displacement hulls are capped at hull speed', () => {
  const launch = structuredClone(PRESETS.find((p) => p.name.includes('Steam Launch')));
  launch.tl = 8;
  launch.engine = 'diesel';
  launch.power = 2000;      // wildly overpowered for a displacement hull
  launch.maxLWt = 40000;    // keep it legal despite the huge engine
  launch.fuelLbs = 1000;
  const r = computeStats(launch);
  assert.deepEqual(r.errors, [], r.errors.join('; '));
  assert.ok(r.stats.topMph < 20, `hull-capped speed ${r.stats.topMph}`);
});

test('fire suppression removes the flammable suffix', () => {
  const d = defaultDesign(); // gasoline
  assert.equal(computeStats(d).stats.htSuffix, 'f');
  d.accessories = [...d.accessories, 'fireSuppression'];
  assert.equal(computeStats(d).stats.htSuffix, '');
});

test('electric vehicles use battery weight for range', () => {
  const ev = PRESETS.find((p) => p.name.includes('Electric'));
  const r = computeStats(ev);
  assert.deepEqual(r.errors, [], r.errors.join('; '));
  assert.ok(r.weights.battery > 0);
  assert.equal(r.weights.fuel, 0);
  assert.ok(r.stats.rangeMi > 50, `EV range ${r.stats.rangeMi}`);
});

test('sails give unlimited range and hull-speed movement', () => {
  const d = defaultDesign();
  d.chassis = 'boat';
  d.engine = 'sail';
  d.tl = 5;
  d.maxLWt = 8000;
  d.armor = { material: 'wood', front: 0, sides: 0, rear: 0, top: 0, under: 0 };
  d.accessories = [];
  d.cargoLbs = 500;
  const r = computeStats(d);
  assert.deepEqual(r.errors, [], r.errors.join('; '));
  assert.equal(r.stats.rangeMi, null);
  assert.ok(r.stats.topMph > 2 && r.stats.topMph < 15, `sail speed ${r.stats.topMph}`);
  assert.ok(r.stats.locations.includes('M'), r.stats.locations);
});
