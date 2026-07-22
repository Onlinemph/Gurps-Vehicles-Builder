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

// --- New features: facing armor, presets, migration, hardpoints ------------
test('facing armor with equal DR matches overall body armor weight', async () => {
  const { computeVe2, defaultVe2Design } = await import('../js/ve2/vehicle.js');
  const base = defaultVe2Design();
  base.components = [{ name: 'ballast', weight: 100, cost: 0, volume: 100, location: 'body' }];

  const overall = structuredClone(base);
  overall.armor = { type: 'metalStandard', mode: 'overall', dr: 12, faces: null, otherDr: 0 };
  const ro = computeVe2(overall);

  const facing = structuredClone(base);
  facing.armor = {
    type: 'metalStandard', mode: 'facing', dr: 0, otherDr: 0,
    faces: Object.fromEntries(['front', 'back', 'left', 'right', 'top', 'under'].map((f) => [f, { dr: 12, slope: 0 }])),
  };
  const rf = computeVe2(facing);

  // Overall covers the whole structural area; facing covers only the body,
  // so facing should weigh body/structural fraction of the overall figure.
  const expected = ro.armor.weight * (ro.areas.body / ro.structuralArea);
  assert.ok(Math.abs(rf.armor.weight - expected) < 1, `${rf.armor.weight} vs ${expected}`);
});

test('sloped facing armor multiplies effective DR and adds PD', async () => {
  const { computeVe2, defaultVe2Design } = await import('../js/ve2/vehicle.js');
  const d = defaultVe2Design();
  d.components = [{ name: 'ballast', weight: 100, cost: 0, volume: 100, location: 'body' }];
  d.armor = {
    type: 'metalStandard', mode: 'facing', dr: 0, otherDr: 0,
    faces: {
      front: { dr: 100, slope: 60 }, back: { dr: 10, slope: 0 },
      left: { dr: 20, slope: 0 }, right: { dr: 20, slope: 0 },
      top: { dr: 10 }, under: { dr: 10 },
    },
  };
  const r = computeVe2(d);
  assert.equal(r.armor.faces.front.effDR, 200);   // 100 × 2 at 60°
  assert.equal(r.armor.faces.front.pd, 6);        // PD 4 + 2 slope
  assert.equal(r.armor.faces.back.effDR, 10);
  // Slope inflates body volume vs an unsloped hull.
  const flat = structuredClone(d);
  flat.armor.faces.front.slope = 0;
  assert.ok(r.volumes.body > computeVe2(flat).volumes.body);
});

test('all VE2 presets compile without errors', async () => {
  const { computeVe2 } = await import('../js/ve2/vehicle.js');
  const { VE2_PRESETS } = await import('../js/ve2/presets.js');
  for (const preset of VE2_PRESETS) {
    const r = computeVe2(preset);
    assert.deepEqual(r.errors, [], `${preset.name}: ${r.errors.join('; ')}`);
  }
});

test('tank preset: turret, slope, tracked performance', async () => {
  const { computeVe2 } = await import('../js/ve2/vehicle.js');
  const { VE2_PRESETS } = await import('../js/ve2/presets.js');
  const r = computeVe2(VE2_PRESETS.find((p) => p.name.includes('Battle Tank')));
  assert.ok(r.volumes.turret0 > 0);
  assert.equal(r.armor.faces.front.effDR, 900); // 450 × 2 at 60°
  assert.equal(r.perf.ground.system, 'tracks');
  assert.ok(r.perf.ground.topSpeed >= 30 && r.perf.ground.topSpeed <= 60, `speed ${r.perf.ground.topSpeed}`);
  assert.ok(r.hp.turret1 > 0);
  assert.ok(r.weights.loaded > 60000 && r.weights.loaded < 160000, `loaded ${r.weights.loaded}`);
});

test('speedboat preset planes; helicopter preset hovers with stores data', async () => {
  const { computeVe2 } = await import('../js/ve2/vehicle.js');
  const { VE2_PRESETS } = await import('../js/ve2/presets.js');
  const boat = computeVe2(VE2_PRESETS.find((p) => p.name.includes('Speedboat')));
  assert.ok(boat.floats, 'boat floats');
  assert.ok(boat.perf.water.planing, 'boat planes');
  assert.ok(boat.perf.water.topSpeed >= 30, `boat speed ${boat.perf.water.topSpeed}`);

  const heli = computeVe2(VE2_PRESETS.find((p) => p.name.includes('Helicopter')));
  assert.ok(heli.perf.aerial, 'has aerial performance');
  assert.equal(heli.perf.aerial.stallSpeed, 0, 'stall 0');
  assert.ok(heli.perf.aerial.topSpeed >= 100 && heli.perf.aerial.topSpeed <= 300, `heli speed ${heli.perf.aerial.topSpeed}`);
  assert.ok(heli.perf.aerial.withStores, 'hardpoint stats computed');
  assert.ok(heli.weights.loadedWithStores > heli.weights.loaded);
});

test('legs give ground performance with leg speed factors', async () => {
  const { computeVe2, defaultVe2Design } = await import('../js/ve2/vehicle.js');
  const d = defaultVe2Design();
  d.subassemblies.wheels.present = false;
  d.subassemblies.legs = { present: true, count: 2 };
  d.components = [
    { name: 'power plant', weight: 300, cost: 1000, volume: 10, kwOut: 50, location: 'body' },
    { name: 'leg drivetrain', weight: 200, cost: 1000, volume: 8, kwIn: 50, groundKw: 50, location: 'body' },
    { name: 'crew station', weight: 50, cost: 250, volume: 15, location: 'body' },
  ];
  const r = computeVe2(d);
  assert.deepEqual(r.errors, [], r.errors.join('; '));
  assert.equal(r.perf.ground.system, 'legs2');
  assert.equal(r.perf.ground.sf, 8);
  assert.ok(r.hp.perLeg > 0);
  assert.equal(r.perf.ground.offRoad, 1); // legs are category I, low GP
});

test('old single-turret designs migrate', async () => {
  const { computeVe2, migrateVe2Design, defaultVe2Design } = await import('../js/ve2/vehicle.js');
  const old = defaultVe2Design();
  delete old.subassemblies.turrets;
  old.subassemblies.turret = { present: true, volumeCf: 8, rotation: 'full', slopeDegrees: 0 };
  old.components = [{ name: 'gun', weight: 100, cost: 100, volume: 2, location: 'turret' }];
  const migrated = migrateVe2Design(old);
  assert.equal(migrated.subassemblies.turrets.length, 1);
  assert.equal(migrated.components[0].location, 'turret0');
  const r = computeVe2(migrated);
  assert.ok(r.volumes.turret0 > 0);
});

test('VE2 markdown export contains the key lines', async () => {
  const { computeVe2 } = await import('../js/ve2/vehicle.js');
  const { toVe2Markdown } = await import('../js/ve2/export.js');
  const { VE2_PRESETS } = await import('../js/ve2/presets.js');
  const preset = VE2_PRESETS[0];
  const md = toVe2Markdown(preset, computeVe2(preset));
  assert.ok(md.includes('## TL6 Jeep'));
  assert.ok(md.includes('**Ground Performance:**'));
  assert.ok(md.includes('| Empty Wt. |'));
  assert.ok(md.includes('Hit Points'));
});

// --- Duration, open mounts, exposed seats, space ---------------------------
test('jeep fuel duration matches the GVB manual (5h33m)', async () => {
  const { computeVe2 } = await import('../js/ve2/vehicle.js');
  const { VE2_PRESETS } = await import('../js/ve2/presets.js');
  const r = computeVe2(VE2_PRESETS.find((p) => p.name === 'TL6 Jeep'));
  // 10 gallons / 1.8 gph = 5.56 hours; GVB reports "5 hours 33 minutes".
  assert.ok(Math.abs(r.fuelUse.durationHours - 5.56) < 0.01, `duration ${r.fuelUse.durationHours}`);
});

test('open mounts: volume from components, excluded from structural area, HP ×2', async () => {
  const { computeVe2, defaultVe2Design } = await import('../js/ve2/vehicle.js');
  const d = defaultVe2Design();
  d.components = [
    { name: 'ballast', weight: 100, cost: 0, volume: 100, location: 'body' },
    { name: 'HMG', weight: 130, cost: 14000, volume: 6, location: 'open0' },
  ];
  d.subassemblies.openMounts = [{ rotation: 'full' }];
  const r = computeVe2(d);
  assert.deepEqual(r.errors, [], r.errors.join('; '));
  assert.ok(Math.abs(r.volumes.open0 - 7.2) < 0.01, `open volume ${r.volumes.open0}`); // 6 × 1.2
  assert.ok(r.structuralArea < r.totalArea, 'open mount area excluded from structural');
  assert.ok(r.hp.openMount1 > 0);

  // Removing the mount's contents leaves an empty-mount warning.
  const empty = structuredClone(d);
  empty.components = empty.components.slice(0, 1);
  assert.ok(computeVe2(empty).warnings.some((w) => w.includes('Open mount 1 is empty')));
});

test('exposed seats add aerial drag and slow flight', async () => {
  const { computeVe2 } = await import('../js/ve2/vehicle.js');
  const { VE2_PRESETS } = await import('../js/ve2/presets.js');
  const heli = structuredClone(VE2_PRESETS.find((p) => p.name.includes('Helicopter')));
  const closed = computeVe2(heli);
  heli.exposedSeats = 6;
  const open = computeVe2(heli);
  assert.ok(open.perf.aerial.topSpeed < closed.perf.aerial.topSpeed,
    `${open.perf.aerial.topSpeed} !< ${closed.perf.aerial.topSpeed}`);
});

test('space performance reports sAccel from thrust', async () => {
  const { computeVe2, defaultVe2Design } = await import('../js/ve2/vehicle.js');
  const d = defaultVe2Design();
  d.subassemblies.wheels.present = false;
  d.computeSpace = true;
  d.armor = { type: 'metalStandard', mode: 'overall', dr: 5, faces: null, otherDr: 0 };
  d.components = [
    { name: 'rocket engine', weight: 500, cost: 10000, volume: 10, airThrust: 4000, location: 'body' },
    { name: 'crew station', weight: 50, cost: 250, volume: 15, location: 'body' },
  ];
  const r = computeVe2(d);
  assert.ok(r.perf.space, 'space perf present');
  assert.ok(Math.abs(r.perf.space.sAccelG - 4000 / r.weights.loaded) < 0.01);
});

// --- Arms ------------------------------------------------------------------
test('arm motor table math', async () => {
  const { armMotorStats, armReach } = await import('../js/ve2/tables.js');
  // ST 100, TL8 striker: 100×0.2×0.5 = 10 lbs; 100×0.004×0.5 = 0.2 cf;
  // 100×$400×0.2 = $8,000; 0.5 kW.
  const m = armMotorStats(100, 8, { striker: true });
  assert.equal(m.weight, 10);
  assert.ok(Math.abs(m.volume - 0.2) < 1e-9);
  assert.equal(m.cost, 8000);
  assert.equal(m.powerKw, 0.5);
  // Cheap doubles weight/volume, halves cost.
  const c = armMotorStats(50, 10, { cheap: true });
  assert.equal(c.weight, 10);   // 50×0.1×2
  assert.equal(c.cost, 5000);   // 50×200×0.5
  // Reach: 0.5×sqrt(area); extendable doubles.
  assert.equal(armReach(16), 2);
  assert.equal(armReach(16, true), 4);
});

test('combat walker preset: legs + arms compile and perform', async () => {
  const { computeVe2 } = await import('../js/ve2/vehicle.js');
  const { VE2_PRESETS } = await import('../js/ve2/presets.js');
  const walker = VE2_PRESETS.find((p) => p.name.includes('Combat Walker'));
  const r = computeVe2(walker);
  assert.deepEqual(r.errors, [], r.errors.join('; '));
  assert.equal(r.perf.ground.system, 'legs2');
  assert.ok(r.perf.ground.topSpeed >= 30 && r.perf.ground.topSpeed <= 80, `speed ${r.perf.ground.topSpeed}`);
  assert.equal(r.arms.length, 2);
  assert.equal(r.arms[0].st, 60);
  assert.ok(r.arms[0].reach >= 1, `reach ${r.arms[0].reach}`);
  assert.ok(r.hp.arm1 > 0 && r.hp.arm2 > 0);
  // The striker arm's motor is half the weight of the manipulator's.
  assert.ok(Math.abs(r.arms[1].motor.weight - r.arms[0].motor.weight / 2) < 0.1);
  // Arm motors draw power: 2 × 60/200 = 0.6 kW on top of component draw.
  assert.ok(Math.abs(r.power.needed - (102 + 0.6)) < 0.01, `power ${r.power.needed}`);
  assert.equal(r.perf.ground.offRoad, 1);
});

test('arms below TL7 are an error; arms limit streamlining', async () => {
  const { computeVe2, defaultVe2Design } = await import('../js/ve2/vehicle.js');
  const d = defaultVe2Design();
  d.tl = 6;
  d.subassemblies.arms = [{ st: 20, options: {} }];
  d.components = [{ name: 'ballast', weight: 100, cost: 0, volume: 50, location: 'body' }];
  const r = computeVe2(d);
  assert.ok(r.errors.some((e) => e.includes('Arm motors require TL 7+')), r.errors.join('; '));

  const d2 = defaultVe2Design();
  d2.tl = 8;
  d2.streamlining = 'veryGood';
  d2.subassemblies.arms = [{ st: 20, options: {} }];
  d2.components = [{ name: 'ballast', weight: 100, cost: 0, volume: 50, location: 'body' }];
  const r2 = computeVe2(d2);
  assert.ok(r2.warnings.some((w) => w.includes('cannot have better than Good streamlining')), r2.warnings.join('; '));
});

// --- Eclipse Phase spacecraft presets ---------------------------------------
test('all Eclipse Phase presets compile without errors or warnings', async () => {
  const { computeVe2 } = await import('../js/ve2/vehicle.js');
  const { EP_PRESETS } = await import('../js/ve2/presets-ep.js');
  assert.equal(EP_PRESETS.length, 4);
  for (const ship of EP_PRESETS) {
    const r = computeVe2(ship);
    assert.deepEqual(r.errors, [], `${ship.name}: ${r.errors.join('; ')}`);
    assert.deepEqual(r.warnings, [], `${ship.name}: ${r.warnings.join('; ')}`);
    assert.ok(r.perf.space, `${ship.name} has space performance`);
  }
});

test('EP ships hit setting-appropriate accelerations', async () => {
  const { computeVe2 } = await import('../js/ve2/vehicle.js');
  const { EP_PRESETS } = await import('../js/ve2/presets-ep.js');
  const g = (name) => computeVe2(EP_PRESETS.find((p) => p.name.includes(name))).perf.space.sAccelG;
  assert.ok(g('LOTV') >= 1, `shuttle ${g('LOTV')} G — must exceed 1 G to lift off`);
  assert.ok(g('Courier') > 0.3 && g('Courier') < 1, `courier ${g('Courier')} G`);
  assert.ok(g('Scum Barge') > 0.05 && g('Scum Barge') < 0.2, `barge ${g('Scum Barge')} G`);
  assert.ok(g('Interceptor') > 1.5, `interceptor ${g('Interceptor')} G`);
});

test('LOTV shuttle hovers and flies; barge is SM +9', async () => {
  const { computeVe2 } = await import('../js/ve2/vehicle.js');
  const { EP_PRESETS } = await import('../js/ve2/presets-ep.js');
  const lotv = computeVe2(EP_PRESETS.find((p) => p.name.includes('LOTV')));
  assert.equal(lotv.perf.aerial.stallSpeed, 0);
  assert.ok(lotv.perf.aerial.hover);
  assert.ok(lotv.perf.aerial.topSpeed >= 500, `LOTV air speed ${lotv.perf.aerial.topSpeed}`);
  const barge = computeVe2(EP_PRESETS.find((p) => p.name.includes('Barge')));
  assert.equal(barge.stats.sm, 9);
  assert.ok(!barge.perf.aerial, 'barge has no aerial performance');
});
