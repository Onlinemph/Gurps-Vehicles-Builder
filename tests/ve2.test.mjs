// Validation of the VE2 engine against the book's running worked example
// (the "Kitty Hawk", GURPS Vehicles 2e) plus assorted table checks.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  FRAME_STRENGTHS, MATERIALS, STREAMLINING, armorWeightMod, locationHP,
  sizeModifier, structuralHT, structureTL, surfaceArea, HP_FACTORS,
  slopeVolumeMult, pdFromDR,
} from '../js/ve2/tables.js';
import * as P from '../js/ve2/performance.js';

// --- Geometry --------------------------------------------------------------
test('area table matches the book (Kitty Hawk bodies)', () => {
  assert.equal(surfaceArea(247.5), 250);  // body
  assert.equal(surfaceArea(8), 24);       // pop turret
  assert.equal(surfaceArea(24.75), 50);   // wheels
  assert.equal(surfaceArea(0.02), 0.5);
  // Gap rule: between 0.3 and 0.4 use the lower row.
  assert.equal(surfaceArea(0.35), 3);
});

test('slope volume multipliers', () => {
  assert.equal(slopeVolumeMult(0), 1);
  assert.equal(slopeVolumeMult(60), 1.25);
  assert.equal(slopeVolumeMult(240), 5);
});

// --- Structure -------------------------------------------------------------
test('Kitty Hawk structure: 972 lbs, $97,200', () => {
  const area = 324;
  const tl = structureTL(7);
  const weight = area * tl.weight * FRAME_STRENGTHS.light.weight *
    MATERIALS.veryExpensive.weight * 2 /* submersible */ * 1 /* streamlining */;
  const cost = area * tl.cost * FRAME_STRENGTHS.light.cost *
    MATERIALS.veryExpensive.cost * 2 /* submersible */ * STREAMLINING.fair.structCost;
  assert.equal(weight, 972);
  assert.equal(cost, 97200);
});

// --- Hit points ------------------------------------------------------------
test('Kitty Hawk hit points: body 188, turret 18, wheels 19 each', () => {
  assert.equal(locationHP(250, HP_FACTORS.body, 'light'), 188);
  assert.equal(locationHP(24, HP_FACTORS.turret, 'light'), 18);
  assert.equal(locationHP(50, HP_FACTORS.wheel, 'light', 4), 19);
});

// --- Armor -----------------------------------------------------------------
test('Kitty Hawk armor: TL7 advanced laminate DR 24 = 900 lbs, $90,000', () => {
  const mod = armorWeightMod('laminateAdvanced', 7);
  assert.equal(mod, 0.15);
  const weight = 250 * 24 * mod;
  assert.equal(weight, 900);
  assert.equal(weight * 100, 90000);
});

test('armor TL availability', () => {
  assert.equal(armorWeightMod('laminateAdvanced', 6), null);   // TL7+
  assert.equal(armorWeightMod('metalStandard', 5), 0.7);
  assert.equal(armorWeightMod('reflex', 9), null);             // TL10+
});

test('PD from DR', () => {
  assert.equal(pdFromDR(24), 4);
  assert.equal(pdFromDR(12), 3);
  assert.equal(pdFromDR(3), 2);
  assert.equal(pdFromDR(1), 1);
});

// --- Statistics ------------------------------------------------------------
test('Kitty Hawk SM +3 and HT 10', () => {
  assert.equal(sizeModifier(280.25), 3);
  assert.equal(structuralHT(188, 6968.9, 7), 10);
});

// --- Ground performance ----------------------------------------------------
const KH = { loadedLbs: 6968.9, loadedTons: 3.48 };

test('Kitty Hawk ground speed 185 mph (145 without jet)', () => {
  const withJet = P.groundSpeed({
    system: 'wheels', tl: 7, motivePowerKw: 200, auxThrustLbs: 500,
    loadedTons: KH.loadedTons, streamlining: 'fair', opts: { improvedSuspension: true },
  });
  assert.equal(withJet.sf, 18);
  assert.equal(withJet.mph, 185);
  const noJet = P.groundSpeed({
    system: 'wheels', tl: 7, motivePowerKw: 200, auxThrustLbs: 0,
    loadedTons: KH.loadedTons, streamlining: 'fair', opts: { improvedSuspension: true },
  });
  assert.equal(noJet.mph, 145);
});

test('Kitty Hawk gAccel 10 (5 without jet), gDecel 15', () => {
  assert.equal(P.gAccel({ topSpeed: 185, sf: 18 }).value, 10);
  assert.equal(P.gAccel({ topSpeed: 145, sf: 18 }).value, 5);
  assert.equal(P.gDecel({ system: 'wheels', improvedBrakes: true }), 15);
});

test('Kitty Hawk gMR 1.5 / gSR 5', () => {
  const { gMR, gSR } = P.gMRgSR({
    system: 'wheels', wheelCount: 4, bodyVolumeCf: 247.5, tl: 7,
    opts: { improvedSuspension: true, computerizedControls: true, allWheelSteering: true },
  });
  assert.equal(gMR, 1.5);
  assert.equal(gSR, 5);
});

test('Kitty Hawk ground pressure: very low with contragrav, off-road 2/3', () => {
  const area = P.contactArea({ system: 'wheels', subassemblyArea: 50, tl: 7 });
  assert.equal(area, 1);
  const gp = P.groundPressure({ loadedLbs: KH.loadedLbs, contragravLift: 10000, area, category: 3 });
  assert.equal(gp.label, 'very low');
  assert.equal(gp.offRoadFraction, 2 / 3);
  const noCg = P.groundPressure({ loadedLbs: KH.loadedLbs, contragravLift: 0, area, category: 3 });
  assert.equal(noCg.label, 'high');
});

// --- Water performance -----------------------------------------------------
test('Kitty Hawk hydrodynamic drag 79 (365 without contragrav)', () => {
  assert.equal(P.hydroDrag({ loadedLbs: KH.loadedLbs, contragravLift: 10000, lines: 'none' }).value, 79);
  assert.equal(P.hydroDrag({ loadedLbs: KH.loadedLbs, contragravLift: 0, lines: 'none' }).value, 365);
});

test('Kitty Hawk water speed 14 mph (11 without jet)', () => {
  assert.equal(P.waterSpeed({ aquaticThrustLbs: 980, drag: 79 }).mph, 14);
  assert.equal(P.waterSpeed({ aquaticThrustLbs: 480, drag: 79 }).mph, 11);
  assert.equal(P.waterSpeed({ aquaticThrustLbs: 980, drag: 365 }).mph, 8);
  assert.equal(P.waterSpeed({ aquaticThrustLbs: 480, drag: 365 }).mph, 7);
});

test('Kitty Hawk wAccel 3, wMR 0.5, wSR 5, wDecel 10, draft 1.3 ft', () => {
  assert.equal(P.wAccel({ aquaticThrustLbs: 980, loadedLbs: KH.loadedLbs }).value, 3);
  const { wMR, wSR } = P.wMRwSR({ tl: 7, bodyVolumeCf: 247.5, lines: 'none', opts: { computerizedControls: true } });
  assert.equal(wMR, 0.5);
  assert.equal(wSR, 5);
  assert.equal(P.wDecel({ wMR, hl: 1 }).base, 10);
  assert.equal(P.draft({ loadedLbs: KH.loadedLbs, lines: 'none' }), 1.3);
});

// --- Submerged performance -------------------------------------------------
test('Kitty Hawk submerged: drag 674, speed 5, uAccel 0.5, crush depth 170 yds', () => {
  const swt = 17515.625;
  assert.equal(P.submergedDrag({ submergedLbs: swt, lines: 'none' }).value, 674);
  assert.equal(P.submergedSpeed({ thrustLbs: 480, drag: 674 }).mph, 5);
  assert.equal(P.uAccel({ thrustLbs: 480, submergedLbs: swt }).value, 0.5);
  assert.equal(P.submergedDraft({ submergedLbs: swt }), 8.7); // book: 8.65 → 9'
  assert.equal(P.crushDepth({ lowestPressurizedDR: 24, frame: 'light' }), 170);
});

// --- Aerial performance ----------------------------------------------------
test('Kitty Hawk aerial: stall 0, drag 150, top 160, aAccel 1, aMR 2.5, aSR 3', () => {
  assert.equal(P.stallSpeed({ loadedLbs: KH.loadedLbs, staticLift: 10000, liftArea: 0 }).mph, 0);
  const drag = P.aeroDrag({ totalAreaSf: 324, retractableAreaSf: 24, streamlining: 'fair' });
  assert.equal(drag.value, 150);
  assert.equal(P.aerialTopSpeed({ thrustLbs: 500, drag: 150, caps: [600] }).mph, 160);
  assert.equal(P.aAccel({ thrustLbs: 500, loadedLbs: KH.loadedLbs }).value, 1);
  const amr = P.aMR({ stallZero: true, tl: 7, sizeModifier: 3, computerizedControls: true });
  assert.equal(amr, 2.5);
  assert.equal(P.aDecel(amr), 10);
  const asr = P.aSR({ totalVolumeCf: 280.25, tl: 7, computerizedControls: true, noWingsOrStubOnly: true });
  assert.equal(asr, 3);
});

test('aerial speed caps', () => {
  const caps = P.aerialSpeedCaps({ streamlining: 'fair', hasPropellers: true });
  assert.ok(caps.includes(600));
  // A propeller plane can never be computed faster than 600 mph.
  assert.ok(P.aerialTopSpeed({ thrustLbs: 100000, drag: 10, caps }).mph <= 600);
});

test('takeoff and landing runs', () => {
  assert.equal(P.takeoffRun(60, 9), 100);
  assert.equal(P.landingRun(60, 10), 90);
});

// --- Full assembly ---------------------------------------------------------
test('computeVe2 assembles a simple TL6 car sanely', async () => {
  const { computeVe2, defaultVe2Design } = await import('../js/ve2/vehicle.js');
  const d = defaultVe2Design();
  d.tl = 6;
  d.streamlining = 'fair';
  d.structure = { frame: 'light', material: 'cheap', special: 'none' };
  d.armor = { type: 'metalStandard', dr: 3 };
  d.components = [
    { name: 'gasoline engine 40kW', weight: 270, cost: 540, volume: 10.8, kwOut: 40, airBreathing: true, location: 'body' },
    { name: 'wheeled drivetrain 40kW', weight: 120, cost: 480, volume: 4.8, kwIn: 40, groundKw: 40, location: 'body' },
    { name: 'fuel tank 10 gal', weight: 5, cost: 20, volume: 1.5, location: 'body' },
    { name: 'crew station', weight: 50, cost: 250, volume: 15, location: 'body' },
    { name: '3 passenger seats', weight: 90, cost: 150, volume: 30, location: 'body' },
  ];
  d.crew = 1;
  d.passengers = 3;
  d.cargoCf = 10;
  d.emptySpaceCf = 10;
  d.fuel = { type: 'gasoline', gallons: 10 };
  const r = computeVe2(d);
  assert.deepEqual(r.errors, [], r.errors.join('; '));
  assert.ok(r.volumes.body > 80 && r.volumes.body < 120, `body volume ${r.volumes.body}`);
  assert.ok(r.perf.ground, 'has ground performance');
  assert.ok(r.perf.ground.topSpeed > 40 && r.perf.ground.topSpeed < 120, `speed ${r.perf.ground.topSpeed}`);
  assert.ok(r.stats.ht >= 7 && r.stats.ht <= 12, `HT ${r.stats.ht}`);
  assert.ok(r.hp.body > 0 && r.hp.perWheel > 0);
  assert.ok(r.stats.price > 1000, `price ${r.stats.price}`);
  assert.equal(r.stats.sm, 2);
});

test('computeVe2 flags a sinking boat', async () => {
  const { computeVe2, defaultVe2Design } = await import('../js/ve2/vehicle.js');
  const d = defaultVe2Design();
  d.subassemblies.wheels.present = false;
  d.features.flotationHull = true;
  d.features.hydroLines = 'mediocre';
  d.armor = { type: 'metalStandard', dr: 2 };
  d.components = [
    { name: 'lead brick', weight: 30000, cost: 1, volume: 10, location: 'body' },
    { name: 'screw propeller', weight: 100, cost: 100, volume: 2, aquaticThrust: 500, location: 'body' },
  ];
  const r = computeVe2(d);
  assert.ok(r.warnings.some((w) => w.includes('sinks')), r.warnings.join('; '));
  assert.ok(!r.perf.water, 'no water performance when it sinks');
});
