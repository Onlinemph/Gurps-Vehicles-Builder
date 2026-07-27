// GURPS Spaceships engine — validated against SS1's published ships.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { HULLS, airSpeed, costProgression, fmtCost } from '../js/ss/tables.js';
import { SYSTEMS } from '../js/ss/systems.js';
import { computeShip, defaultShip, tankMultiplier } from '../js/ss/ship.js';

test('cost progression follows the 1-3-10 ladder (SM+4 first)', () => {
  assert.deepEqual(costProgression(6e3).slice(0, 6), [2e3, 6e3, 20e3, 60e3, 200e3, 600e3]);
  assert.deepEqual(costProgression(100e3).slice(0, 5), [30e3, 100e3, 300e3, 1e6, 3e6]);
  assert.deepEqual(costProgression(15e3).slice(0, 5), [5e3, 15e3, 50e3, 150e3, 500e3]);
  assert.deepEqual(costProgression(2e6).slice(0, 5), [600e3, 2e6, 6e6, 20e6, 60e6]);
});

test('hull table and air speed', () => {
  assert.equal(HULLS[8].tons, 1000);
  assert.equal(HULLS[8].dstHp, 70);
  assert.equal(airSpeed(2, true), 3500);
  assert.equal(airSpeed(3, true), 4300);
  assert.equal(airSpeed(1, false), 300); // sqrt(1)×250 = 250, rounded to nearest 100
});

test('tank multiplier bands', () => {
  assert.equal(tankMultiplier(5), 1);
  assert.equal(tankMultiplier(6), 1.2);
  assert.equal(tankMultiplier(13), 1.6);
  assert.equal(tankMultiplier(19), 3);
});

// --- Star Flower-class Tramp Freighter (TL11^, SM+8 streamlined) -----------
function starFlower() {
  const d = defaultShip();
  d.name = 'Star Flower';
  d.tl = 11;
  d.sm = 8;
  d.streamlined = true;
  d.features = { artificialGravity: true };
  d.sections.front = [
    { sys: 'armor_metallicLaminate', opts: {} },
    { sys: 'cargoHold', opts: {} }, { sys: 'cargoHold', opts: {} },
    { sys: 'cargoHold', opts: {} }, { sys: 'cargoHold', opts: {} },
    { sys: 'enhancedArray', opts: {} },
  ];
  d.sections.central = [
    { sys: 'armor_metallicLaminate', opts: {} },
    { sys: 'habitat', opts: {} }, { sys: 'habitat', opts: { sickbay: 2 } },
    { sys: 'cargoHold', opts: {} }, { sys: 'cargoHold', opts: {} },
    { sys: 'battery_tertiary', opts: { count: 1, weaponType: 'beam', mount: 'turret' } },
  ];
  d.sections.rear = [
    { sys: 'armor_metallicLaminate', opts: {} },
    { sys: 'standardReactionless', opts: {} }, { sys: 'standardReactionless', opts: {} },
    { sys: 'stardrive', opts: {} }, { sys: 'stardrive', opts: {} },
    { sys: 'engineRoom', opts: {} },
  ];
  d.cores = [
    { section: 'front', sys: 'controlRoom', opts: {} },
    { section: 'rear', sys: 'fusionReactor', opts: {} },
  ];
  return d;
}

test('Star Flower matches its published stat line', () => {
  const r = computeShip(starFlower());
  assert.deepEqual(r.errors, [], r.errors.join('; '));
  const s = r.stats;
  assert.equal(s.dstHp, 70);
  assert.equal(s.hnd, -1);
  assert.equal(s.sr, 5);
  assert.equal(s.ht, 13);
  assert.equal(s.move, '2G/c');           // 2× standard reactionless at TL11 = 1G each
  assert.equal(s.lwt, 1000);
  assert.equal(s.sm, 8);
  assert.equal(s.occ, '20ASV');           // 10 cabins × 2 (2 cabins → sickbay)
  assert.equal(s.ddr, '7');               // streamlined metallic laminate at SM+8
  assert.equal(s.range, 'FTL-2');
  assert.equal(s.airSpeed, 3500);         // book: "Top air speed is 3,500 mph"
  // Load: 6×50-ton holds + 0.1×20 occupants = 302 (book prints 301; the
  // tertiary battery's 43.5 tons of spare space is a note, not Load).
  assert.equal(s.load, 302);
  assert.equal(s.spareCargo, 43.5);
  // The book prints $44.5M, but summing its own system tables gives $42.5M
  // (3×$1M armor, $2M array, 2×$1M habitat, $0.2M battery, 2×$1M drive,
  // 2×$10M stardrive, $0.3M engine room, $2M control room, $10M reactor,
  // $1M artificial gravity). We follow the tables.
  assert.equal(s.cost, 42.5e6);
  assert.equal(s.ppProvided, 2);
  assert.ok(s.ppNeeded >= 4, 'four high-energy systems');
});

// --- Midnight Sun orbiter (TL9, SM+6 streamlined, winged) ------------------
function midnightSunOrbiter() {
  const d = defaultShip();
  d.name = 'Midnight Sun orbiter';
  d.tl = 9;
  d.sm = 6;
  d.streamlined = true;
  d.features = { winged: true };
  d.sections.front = [
    { sys: 'armor_lightAlloy', opts: {} },
    { sys: 'controlRoom', opts: {} },
    { sys: 'passengerSeating', opts: {} }, { sys: 'passengerSeating', opts: {} },
    { sys: 'cargoHold', opts: {} }, { sys: 'cargoHold', opts: {} },
  ];
  d.sections.central = [
    { sys: 'armor_lightAlloy', opts: {} },
    { sys: 'fuelTank', opts: {} }, { sys: 'fuelTank', opts: {} },
    { sys: 'fuelTank', opts: {} }, { sys: 'fuelTank', opts: {} },
    { sys: 'fuelTank', opts: {} },
  ];
  d.sections.rear = [
    { sys: 'chemRocket', opts: {} },
    { sys: 'fuelTank', opts: {} }, { sys: 'fuelTank', opts: {} },
    { sys: 'fuelTank', opts: {} }, { sys: 'fuelTank', opts: {} },
    { sys: 'fuelTank', opts: {} },
  ];
  d.cores = [
    { section: 'central', sys: 'fuelTank', opts: {} },
    { section: 'rear', sys: 'fuelTank', opts: {} },
  ];
  return d;
}

test('Midnight Sun orbiter matches its published stat line', () => {
  const r = computeShip(midnightSunOrbiter());
  assert.deepEqual(r.errors, [], r.errors.join('; '));
  const s = r.stats;
  assert.equal(s.dstHp, 30);
  assert.equal(s.hnd, 0);                 // hull SM+6 = 0; TL9 no penalty; 3G accel mod 0
  assert.equal(s.sr, 4);
  assert.equal(s.ht, 12);                 // 13 - 1 (SM+5-9, no engine room)
  assert.equal(s.accelG, 3);
  // Published delta-V 2.56 mps (12 tanks × 0.15 × multiplier); table gives 2.52.
  assert.ok(Math.abs(s.deltaV - 2.56) < 0.1, `delta-V ${s.deltaV}`);
  assert.equal(s.occ, '2+12SV');          // 2 control stations + 12 seats
  assert.equal(s.ddr, '2/2/0');
  assert.equal(s.airSpeed, 4300);         // book: 4,300 mph
  assert.equal(s.airHnd, 4);              // winged +4, book: +4/5
  assert.ok(Math.abs(s.load - 11.4) < 0.3, `Load ${s.load}`);
  // Published $1.61M.
  assert.ok(s.cost > 1.3e6 && s.cost < 1.9e6, `Cost ${s.costStr}`);
});

// --- Validation rules ------------------------------------------------------
test('core systems must be in different sections; rear-only enforced', () => {
  const d = defaultShip();
  d.cores = [
    { section: 'front', sys: 'controlRoom', opts: {} },
    { section: 'front', sys: 'fusionReactor', opts: {} },
  ];
  const r = computeShip(d);
  assert.ok(r.errors.some((e) => e.includes('different hull sections')), r.errors.join('; '));

  const d2 = defaultShip();
  d2.sections.front[0] = { sys: 'chemRocket', opts: {} };
  const r2 = computeShip(d2);
  assert.ok(r2.errors.some((e) => e.includes('rear hull')), r2.errors.join('; '));
});

test('TL and SM gates', () => {
  const d = defaultShip();
  d.tl = 8;
  d.sections.rear[0] = { sys: 'fusionTorch', opts: {} }; // TL10^
  const r = computeShip(d);
  assert.ok(r.errors.some((e) => e.includes('requires TL')), r.errors.join('; '));

  const d2 = defaultShip();
  d2.sm = 5;
  d2.sections.front[0] = { sys: 'habitat', opts: {} }; // needs SM+6
  const r2 = computeShip(d2);
  assert.ok(r2.errors.some((e) => e.includes('SM +6')), r2.errors.join('; '));
});

test('battery pricing scales with installed weapons', () => {
  const full = SYSTEMS.battery_tertiary.cost(8, 11, { count: 30 });
  const one = SYSTEMS.battery_tertiary.cost(8, 11, { count: 1 });
  assert.equal(one, full / 30);
  const info = SYSTEMS.battery_tertiary.info(8, 11, { count: 1 });
  assert.equal(info.spareCargo, 43.5);    // 29 uninstalled × 1.5 tons (Star Flower's spare hold)
});

test('cost formatting matches the book style', () => {
  assert.equal(fmtCost(44.5e6), '$44.5M');
  assert.equal(fmtCost(1.5e9), '$1.5B');
});
