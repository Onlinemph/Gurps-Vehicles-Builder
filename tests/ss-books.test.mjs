// GURPS Spaceships supplements (SS2-SS8) — validated against published ships.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ARMORS, HULLS } from '../js/ss/tables.js';
import { SYSTEMS } from '../js/ss/systems.js';
import '../js/ss/systems-books.js';
import { computeShip, defaultShip } from '../js/ss/ship.js';

const slot = (sys, opts = {}) => ({ sys, opts });

test('SM+4 hull and cost rules (SS4)', () => {
  assert.equal(HULLS[4].tons, 10);
  assert.equal(HULLS[4].dstHp, 15);
  // SM+4 system cost = 10% of the SM+6 cost (one 1-3-10 ladder step below SM+5).
  assert.equal(SYSTEMS.standardReactionless.cost(4, 11), 10e3);
  assert.equal(SYSTEMS.defensiveECM.cost(4, 11), 100e3);
  // Exceptions: 50% of the SM+5 cost.
  assert.equal(SYSTEMS.passengerSeating.cost(4, 9), 5e3);
  assert.equal(SYSTEMS.softLanding.cost(4, 9), 25e3);
  assert.equal(SYSTEMS.stasisWeb.cost(4, 12), 1e6);
  // SM+4 capacities.
  assert.equal(SYSTEMS.cargoHold.info(4, 9).cargoTons, 0.5);
  assert.equal(SYSTEMS.fuelTank.info(4, 9).fuelTons, 0.5);
  assert.equal(SYSTEMS.passengerSeating.info(4, 9).seats, 1);
  // Steel armor and medium+ batteries don't exist at SM+4.
  assert.equal(ARMORS.steel.us[0], null);
  assert.ok(SYSTEMS.battery_medium.info(4, 10).invalid);
  assert.equal(SYSTEMS.battery_major.info(4, 10, { count: 1 }).invalid, undefined);
});

test('SS7 tables spot checks', () => {
  assert.equal(ARMORS.iron.us[6], 7);          // SM+10 iron: dDR 7
  assert.equal(ARMORS.etherwood.us[6], 4);     // SM+10 etherwood: dDR 4
  assert.equal(ARMORS.wooden.us[6], null);     // wood unusable above SM+9
  assert.equal(SYSTEMS.etherScrew.info(8, 7).accelG, 0.2);
  assert.equal(SYSTEMS.psychotronicPlant.info(5, 9).pp, 4);   // SM+5-6: 4 psi PP
  assert.equal(SYSTEMS.psychotronicPlant.info(8, 9).pp, 2);   // SM+7+: 2 psi PP
  assert.equal(SYSTEMS.psychotronicPlant.info(8, 9).ppKind, 'psi');
  assert.equal(SYSTEMS.vacuumEnergy.info(8, 9).pp, 3);
  assert.equal(SYSTEMS.vacuumEnergy.cost(8, 9, { deRate: 2 }), 24e6 / 3);
  assert.equal(SYSTEMS.tachyonSail.cost(13, 10), 0);           // n/a at SM+13+
  assert.equal(SYSTEMS.fissionAirRam.info(6, 10, {}).jetG, 0.6);
});

test('de-rated reactors (SS1/SS2)', () => {
  assert.equal(SYSTEMS.fusionReactor.info(8, 11, { deRate: 1 }).pp, 1);
  assert.equal(SYSTEMS.fusionReactor.cost(8, 11, { deRate: 1 }), 5e6);
  assert.equal(SYSTEMS.antimatterReactor.info(8, 10, { deRate: 2 }).pp, 2);
  assert.equal(SYSTEMS.antimatterReactor.cost(8, 10, { deRate: 2 }), 20e6 * 0.5);
});

// --- Typhoon Space Fighter (SS4: TL11^, SM+4, published $3.483M) -----------
function typhoon() {
  const d = defaultShip();
  d.name = 'Typhoon';
  d.tl = 11;
  d.sm = 4;
  d.streamlined = false;
  d.features = { hardenedArmor: true, emergencyEjection: true, gravticCompensators: true };
  d.sections.front = [
    slot('armor_nanocomposite'), slot('armor_nanocomposite'), slot('armor_nanocomposite'),
    slot('battery_major', { count: 1, weaponType: 'beam', mount: 'fixed' }),
    slot('battery_major', { count: 1, weaponType: 'beam', mount: 'fixed' }),
    slot('tacticalArray'),
  ];
  d.sections.central = [
    slot('armor_nanocomposite'), slot('armor_nanocomposite'),
    slot('defensiveECM'), slot('defensiveECM'),
    slot('superFusionReactor'), slot('superFusionReactor'),
  ];
  d.sections.rear = [
    slot('armor_nanocomposite'), slot('armor_nanocomposite'),
    slot('superFusionTorch'), slot('superFusionTorch'),
    slot('superFusionTorch'), slot('superFusionTorch'),
  ];
  d.cores = [
    { section: 'front', sys: 'controlRoom', opts: {} },
    { section: 'central', sys: 'fuelTank', opts: {} },
  ];
  return d;
}

test('Typhoon matches its published stat line (SS4, SM+4)', () => {
  const r = computeShip(typhoon());
  assert.deepEqual(r.errors, [], r.errors.join('; '));
  const s = r.stats;
  assert.equal(s.dstHp, 15);
  assert.equal(s.hnd, 2);                  // hull 0 + accel mod +2 (200G)
  assert.equal(s.sr, 4);
  assert.equal(s.ht, 12);
  assert.equal(s.move, '200G/450 mps');    // 4 × 50G torches; 1 tank × 450 mps
  assert.equal(s.lwt, 10);
  assert.equal(s.occ, '1SV');
  assert.equal(s.ddr, '15/10/10');
  assert.equal(s.airSpeed, 3500);          // unstreamlined √200 × 250
  assert.equal(s.cost, 3.483e6);           // published $3.483M — exact
  assert.equal(s.ppProvided, 8);
});

// --- Ether Ironclad (SS7: TL5+2^, SM+10, published $275M) -------------------
function etherIronclad() {
  const d = defaultShip();
  d.name = 'Ether Ironclad';
  d.tl = 7; // TL5+2 divergent ≈ TL7 equivalence for gating
  d.sm = 10;
  d.streamlined = false;
  d.features = { artificialGravity: true, lacksAutomation: true };
  d.sections.front = [
    slot('armor_iron'), slot('armor_iron'), slot('armor_etherwood'),
    slot('habitat', { bunkrooms: 25, steerage: 30 }),
    slot('battery_medium', { count: 3, weaponType: 'gun', mount: 'turret' }),
    slot('solarMirror'),
  ];
  d.sections.central = [
    slot('armor_iron'), slot('armor_iron'),
    slot('battery_medium', { count: 3, weaponType: 'beam', mount: 'turret' }),
    slot('solarBoiler'), slot('solarMirror'),
    slot('battery_tertiary', { count: 10, weaponType: 'gun', mount: 'turret' }),
  ];
  d.sections.rear = [
    slot('armor_iron'), slot('armor_etherwood'),
    slot('battery_medium', { count: 2, weaponType: 'gun', mount: 'turret' }),
    slot('solarBoiler'),
    slot('etherScrew'), slot('etherScrew'),
  ];
  d.cores = [
    { section: 'front', sys: 'controlRoom', opts: {} },
    { section: 'central', sys: 'habitat', opts: { bunkrooms: 25, briefing: 1, offices: 2, labs: 1, sickbay: 5 } },
  ];
  return d;
}

test('Ether Ironclad matches its published stat line (SS7)', () => {
  const r = computeShip(etherIronclad());
  assert.deepEqual(r.errors, [], r.errors.join('; '));
  const s = r.stats;
  assert.equal(s.dstHp, 150);
  assert.equal(s.hnd, -4);                 // hull -2, accel mod -1 (0.4G), TL≤8 -1
  assert.equal(s.sr, 4);                   // hull 5, TL≤8 -1
  assert.equal(s.ht, 14);                  // 13 + 1 lacks automation
  assert.equal(s.move, '0.4G/c');          // two 0.2G ether screws (reactionless)
  assert.equal(s.occ, '260ASV');           // 30 cabins + 50 bunkrooms
  assert.equal(s.ddr, '18/14/11');
  assert.equal(s.cost, 275e6);             // published $275M — exact
});

// --- Anthem-class Light Star Freighter (SS2: TL11^, SM+8, de-rated reactor) -
function anthem() {
  const d = defaultShip();
  d.name = 'Anthem';
  d.tl = 11;
  d.sm = 8;
  d.streamlined = true;
  d.features = { artificialGravity: true };
  d.sections.front = [
    slot('armor_steel'), slot('cargoHold'), slot('cargoHold'), slot('cargoHold'),
    slot('habitat', { automed: 2 }), slot('habitat'),
  ];
  d.sections.central = [
    slot('armor_steel'), slot('cargoHold'), slot('cargoHold'), slot('cargoHold'), slot('cargoHold'),
    slot('battery_tertiary', { count: 1, weaponType: 'beam', mount: 'turret' }),
  ];
  d.sections.rear = [
    slot('armor_steel'), slot('cargoHold'), slot('cargoHold'),
    slot('hotReactionless'), slot('stardrive'), slot('engineRoom'),
  ];
  d.cores = [
    { section: 'front', sys: 'controlRoom', opts: {} },
    { section: 'rear', sys: 'fusionReactor', opts: { deRate: 1 } },
  ];
  return d;
}

test('Anthem matches its published stat line (SS2)', () => {
  const r = computeShip(anthem());
  assert.deepEqual(r.errors, [], r.errors.join('; '));
  const s = r.stats;
  assert.equal(s.dstHp, 70);
  assert.equal(s.move, '2G/c');            // hot reactionless at TL11
  assert.equal(s.occ, '20ASV');
  assert.equal(s.ddr, '3');
  assert.equal(s.range, 'FTL-1');
  assert.equal(s.airSpeed, 3500);
  // Published $25.9M; the sum of the book's own tables gives $24.3M
  // (the same kind of small gap as the Star Flower's printed total).
  assert.ok(s.cost > 23.5e6 && s.cost < 26.5e6, `Cost ${s.costStr}`);
});

// --- Framework validations ---------------------------------------------------
test('spinal battery needs all three parts', () => {
  const d = defaultShip();
  d.sections.front[0] = slot('battery_spinal', { weaponType: 'beam' });
  const r = computeShip(d);
  assert.ok(r.errors.some((e) => e.includes('spinal')), r.errors.join('; '));

  d.cores[0] = { section: 'central', sys: 'spinalCentral', opts: {} };
  d.sections.rear[0] = slot('spinalRear');
  const r2 = computeShip(d);
  assert.ok(!r2.errors.some((e) => e.includes('spinal')), r2.errors.join('; '));
});

test('ship quality (SS2 cheap ships)', () => {
  const d = anthem();
  const base = computeShip(d).stats;
  d.quality = 'veryCheap';
  const cheap = computeShip(d).stats;
  assert.equal(cheap.cost, base.cost * 0.2);
  assert.equal(cheap.ht, base.ht - 4);
});

test('robot legs give ground performance and share one Power Point', () => {
  const d = defaultShip();
  d.tl = 9;
  d.sm = 5;
  d.sections.rear[0] = slot('robotLeg');
  d.sections.rear[1] = slot('robotLeg');
  d.sections.rear[2] = slot('chemRocket');
  const r = computeShip(d);
  assert.equal(r.stats.ground.move, '10/10');
  assert.equal(r.stats.ground.hnd, 3);     // SM+5, two legs → +3/3
  assert.equal(r.stats.ground.sr, 3);
  assert.equal(r.stats.ppNeeded, 1);
});

test('magic and psi power pools (SS7)', () => {
  const d = defaultShip();
  d.tl = 9;
  d.sm = 8;
  d.sections.rear[0] = slot('etherScrew', { powered: 'magic' });
  d.cores[1] = { section: 'rear', sys: 'manaEngine', opts: {} };
  const r = computeShip(d);
  assert.equal(r.stats.magicPP, 1);
  assert.equal(r.stats.magicPPNeeded, 1);
  assert.equal(r.stats.ppNeeded, 0);
  // Magic-powered high-energy systems are half price.
  const full = SYSTEMS.etherScrew.cost(8, 9);
  const p = r.placed.find((x) => x.entry.key === 'etherScrew');
  assert.equal(p.cost, full / 2);
});

// --- Smaller / half / larger systems (SS7/SS8) -------------------------------
test('half-size and larger systems', () => {
  const d = defaultShip(); // TL10 SM+8
  d.sections.front[0] = { sys: 'cargoHold', opts: {}, scale: 'half' };
  d.sections.central[0] = { sys: 'armor_steel', opts: {}, scale: 'larger' };
  d.sections.rear[0] = { sys: 'standardReactionless', opts: {} };
  d.cores[1] = { section: 'rear', sys: 'fusionReactor', opts: {} };
  const r = computeShip(d);
  const cargo = r.placed.find((p) => p.entry.key === 'cargoHold');
  assert.equal(cargo.info.cargoTons, 25);          // half of 50
  const armor = r.placed.find((p) => p.entry.key === 'armor_steel');
  assert.equal(armor.info.armorDDR, 10);           // double SM+8 steel (5)
  // larger system needs two empty slots in its section — central has them.
  assert.ok(!r.errors.some((e) => e.includes('larger')), r.errors.join('; '));
  assert.equal(r.stats.slotsUsed, 6);              // 1 + 3 + 1 + 1 core
});

test('larger system without room errors out', () => {
  const d = defaultShip();
  d.sections.front = d.sections.front.map(() => ({ sys: 'cargoHold', opts: {} }));
  d.sections.front[0] = { sys: 'armor_steel', opts: {}, scale: 'larger' };
  const r = computeShip(d);
  assert.ok(r.errors.some((e) => e.includes('three slots')), r.errors.join('; '));
});

// --- Mercury-class HLV (SS8: TL10, SM+9, published $32.85M) ------------------
function mercury() {
  const d = defaultShip();
  d.name = 'Mercury-class HLV';
  d.tl = 10;
  d.sm = 9;
  d.streamlined = true;
  d.features = {};
  d.sections.front = [
    slot('armor_lightAlloy'),
    { sys: 'controlRoom', opts: {}, scale: 'smaller', sub: [
      { sys: 'controlRoom', opts: { removeStations: 3 } },
      { sys: 'cargoHold', opts: {} },
      { sys: 'cargoHold', opts: {} },
    ] },
    slot('passengerSeating'), slot('passengerSeating'),
    slot('passengerSeating'), slot('passengerSeating'),
  ];
  d.sections.central = [
    slot('armor_lightAlloy'), slot('fuelTank'), slot('fuelTank'),
    slot('fuelTank'), slot('fuelTank'), slot('fuelTank'),
  ];
  d.sections.rear = [
    slot('armor_lightAlloy'), slot('armor_lightAlloy'),
    slot('laserRocket'), slot('laserRocket'),
    slot('fuelTank'), slot('fuelTank'),
  ];
  d.cores = [
    { section: 'central', sys: 'fuelTank', opts: {} },
    { section: 'rear', sys: 'fuelTank', opts: {} },
  ];
  return d;
}

test('Mercury HLV matches its published stat line (SS8, smaller systems)', () => {
  const r = computeShip(mercury());
  assert.deepEqual(r.errors, [], r.errors.join('; '));
  const s = r.stats;
  assert.equal(s.dstHp, 100);
  assert.equal(s.hnd, -2);                 // hull -1, 6G mod 0, smaller control room -1
  assert.equal(s.sr, 4);                   // hull 5, smaller control room -1
  assert.equal(s.ht, 12);
  assert.equal(s.move, '6G/6.3 mps');      // 2×3G laser rockets; 9 tanks × 0.5 × 1.4
  assert.equal(s.occ, '1+800SV');
  assert.equal(s.ddr, '7/7/14');
  assert.equal(s.load, 180.1);             // 100 t cargo + 0.1 × 801 occupants — exact
  assert.equal(s.cost, 32.85e6);           // published $32.85M — exact
});

// --- Nadezhda Bioship (SS8: TL10, SM+9, cargo as reaction mass) --------------
function nadezhda() {
  const d = defaultShip();
  d.name = 'Nadezhda Bioship';
  d.tl = 10;
  d.sm = 9;
  d.streamlined = false;
  d.features = { dynamicChameleon: true, stealth: true, totalAutomation: true, selfHealing: true, requiresNutrients: true };
  const dust = () => ({ sys: 'cargoHold', opts: { reactionMass: true } });
  d.sections.front = [
    slot('armor_organic'),
    slot('controlRoom', { removeStations: 3 }),
    slot('habitat', { tlsCabins: 4, labs: 4, automed: 1, steerage: 3 }),
    dust(), dust(), dust(),
  ];
  d.sections.central = [
    slot('armor_organic'), dust(), dust(), dust(), dust(), dust(),
  ];
  d.sections.rear = [
    slot('armor_organic'), dust(), dust(), dust(), dust(),
    slot('massDriver'),
  ];
  d.cores = [
    { section: 'central', sys: 'fusionReactor', opts: { deRate: 1 } },
    { section: 'rear', sys: 'engineRoom', opts: {} },
  ];
  return d;
}

test('Nadezhda Bioship matches its published stat line (SS8)', () => {
  const r = computeShip(nadezhda());
  assert.deepEqual(r.errors, [], r.errors.join('; '));
  const s = r.stats;
  assert.equal(s.dstHp, 100);
  assert.equal(s.ht, 13);                  // engine room aboard
  assert.equal(s.move, '0.01G/5.04 mps');  // 12 dust holds × 0.3 × 1.4 — exact
  assert.equal(s.occ, '8ASV');             // 4 total-life-support cabins
  assert.equal(s.ddr, '10');
  assert.equal(s.load, 1815.8);            // 1,800 t dust + 15 t steerage + 0.8 — exact
  // Published $120.45M; table-sum lands close.
  assert.ok(s.cost > 110e6 && s.cost < 125e6, `Cost ${s.costStr}`);
});
