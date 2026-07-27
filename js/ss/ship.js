// ---------------------------------------------------------------------------
// GURPS Spaceships — ship assembly. computeShip(design) turns a slot layout
// into a finished stat block. Covers the SS1 core rules plus the designer
// additions from SS2-SS8 (SM+4 hulls, spinal batteries, robot legs, jets,
// lift armor, magic/psi Power Points, ship quality, and the new features).
// ---------------------------------------------------------------------------

import {
  FEATURES, HULLS, SECTIONS, SLOTS_PER_SECTION, airSpeed, baseHT,
  hndAccelMod, fmtCost as fmtC,
} from './tables.js';
import { SYSTEMS } from './systems.js';
import './systems-books.js';

export { fmtC as fmtShipCost };

export function defaultShip() {
  const emptySection = () => Array.from({ length: SLOTS_PER_SECTION }, () => ({ sys: null, opts: {} }));
  return {
    name: 'New Spacecraft',
    tl: 10,
    sm: 8,
    streamlined: false,
    quality: 'normal', // SS2: 'cheap' (×1/2, HT-2) or 'veryCheap' (×1/5, HT-4)
    sections: { front: emptySection(), central: emptySection(), rear: emptySection() },
    cores: [
      { section: 'front', sys: null, opts: {} },
      { section: 'rear', sys: null, opts: {} },
    ],
    features: {},
  };
}

// Delta-V multiplier for 6+ tanks feeding one drive.
export function tankMultiplier(n) {
  if (n >= 19) return 3;
  if (n >= 18) return 2.5;
  if (n >= 17) return 2.2;
  if (n >= 16) return 2;
  if (n >= 15) return 1.8;
  if (n >= 13) return 1.6;
  if (n >= 9) return 1.4;
  if (n >= 6) return 1.2;
  return 1;
}

const r2 = (x) => Math.round(x * 100) / 100;

export function computeShip(design) {
  const errors = [];
  const warnings = [];
  const d = design;
  const hull = HULLS[d.sm];
  if (!hull) {
    return { ok: false, errors: [`SM +${d.sm} is outside the SM+4..+15 hull table.`], warnings, stats: null };
  }
  const smI = d.sm - 4;
  const ctx = {
    streamlined: d.streamlined,
    compTL: d.tl + (d.features?.advancedComputers ? 1 : 0),
  };

  // Systems that may be built at half size for half cost (SS7/SS8).
  const HALF_OK = ['cargoHold', 'factory', 'fuelTank', 'habitat', 'mining', 'refinery',
    'openSpace', 'passengerSeating', 'fusionReactor', 'antimatterReactor', 'superFusionReactor'];

  // Collect all placed systems: {section, slotLabel, isCore, entry, opts, info, cost}
  // A slot may hold a normal system, a half-size system (SS7/SS8: half cost,
  // half output), three one-SM-smaller systems, or one SM-larger system that
  // also occupies two empty slots in the same section.
  const placed = [];
  const largerBySection = { front: 0, central: 0, rear: 0 };
  const emptyBySection = { front: 0, central: 0, rear: 0 };
  for (const section of SECTIONS) {
    d.sections[section].forEach((slot, i) => {
      if (!slot.sys) { emptyBySection[section] += 1; return; }
      const entry = SYSTEMS[slot.sys];
      if (!entry) return;
      const scale = slot.scale || 'normal';
      const label = `[${i + 1}]`;
      if (scale === 'smaller') {
        const subs = (slot.sub && slot.sub.length ? slot.sub : [0, 1, 2].map(() => ({ sys: slot.sys, opts: slot.opts })))
          .filter((s) => s && s.sys && SYSTEMS[s.sys]).slice(0, 3);
        subs.forEach((s, j) => placed.push(build(SYSTEMS[s.sys], s.opts, section, `${label}${'abc'[j]}`, false, 'smaller')));
      } else {
        if (scale === 'larger') largerBySection[section] += 1;
        placed.push(build(entry, slot.opts, section, label, false, scale));
      }
    });
  }
  for (const section of SECTIONS) {
    if (largerBySection[section] && emptyBySection[section] < largerBySection[section] * 2) {
      errors.push(`A larger system spans three slots: leave ${largerBySection[section] * 2} empty slot(s) in the ${section} hull.`);
    }
  }
  const coreSections = [];
  for (const core of d.cores) {
    if (!core.sys) continue;
    const entry = SYSTEMS[core.sys];
    if (!entry) continue;
    coreSections.push(core.section);
    placed.push(build(entry, core.opts, core.section, '[core]', true));
  }
  if (coreSections.length === 2 && coreSections[0] === coreSections[1]) {
    errors.push('The two core systems must be in different hull sections.');
  }

  function build(entry, opts, section, slotLabel, isCore, scale = 'normal') {
    const statSM = scale === 'smaller' ? d.sm - 1 : scale === 'larger' ? d.sm + 1 : d.sm;
    const info = { ...(entry.info(statSM, d.tl, opts, ctx) || {}) };
    let cost = entry.cost(statSM, d.tl, opts) || 0;
    if (scale === 'smaller') {
      // Special cases: armor gives 1/3 of the FULL-size dDR; engines and
      // sails 1/3 acceleration; tanks count as 1/3 tank; smaller control
      // rooms cost -1 Hnd and SR; smaller plants power only smaller systems.
      if (info.armorDDR != null) {
        const full = entry.info(d.sm, d.tl, opts, ctx) || {};
        info.armorDDR = full.armorDDR === null ? null : (full.armorDDR || 0) / 3;
      }
      if (info.engine || info.sail) info.accelG = (info.accelG || 0) / 3;
      if (info.fuelTank) info.tankFraction = 1 / 3;
      if (info.screenDDR) info.screenDDR = Math.floor(info.screenDDR / 3);
      if (entry.key === 'controlRoom' || entry.key === 'sapientBrain') info.hndPenalty = 1;
      if (info.pp) info.smallPlant = true;
      info.smaller = true;
    } else if (scale === 'half') {
      if (!HALF_OK.includes(entry.key)) {
        errors.push(`${entry.name} cannot be built at half size (only cargo, factories, fuel tanks, habitats, mining/refinery, open space, seating, and fusion/antimatter plants).`);
      }
      cost *= 0.5;
      for (const k of ['cargoTons', 'sleeps', 'cabins', 'seats', 'hibernation', 'pp', 'openAreas']) {
        if (info[k]) info[k] = info[k] / 2;
      }
      if (info.fuelTank) info.tankFraction = 0.5;
      info.half = true;
    } else if (scale === 'larger') {
      // Larger defenses give double dDR instead of the SM+1 table value.
      if (info.armorDDR != null) {
        const own = entry.info(d.sm, d.tl, opts, ctx) || {};
        info.armorDDR = own.armorDDR === null ? null : (own.armorDDR || 0) * 2;
      }
      if (info.screenDDR) {
        const own = entry.info(d.sm, d.tl, opts, ctx) || {};
        info.screenDDR = (own.screenDDR || 0) * 2;
      }
      if (info.ppNeed) info.ppNeed *= 3; // three high-energy systems' worth
      info.larger = true;
    }
    // SS7: magic-/psi-powered high-energy systems are half price and draw
    // from the matching Power Point pool.
    let ppPool = 'normal';
    if (entry.he > 0 && (opts?.powered === 'magic' || opts?.powered === 'psi')) {
      cost *= 0.5;
      ppPool = opts.powered;
    }
    return { entry, opts: opts || {}, section, slotLabel, isCore, info, cost, ppPool, scale, statSM };
  }

  // --- Validation ----------------------------------------------------------
  for (const p of placed) {
    const e = p.entry;
    if (typeof e.tl === 'number' && e.tl > 0 && d.tl < e.tl) errors.push(`${e.name} requires TL ${e.tl}+.`);
    if (e.minSM && p.statSM < e.minSM) errors.push(`${e.name} requires SM +${e.minSM} or larger.`);
    if (e.maxSM && p.statSM > e.maxSM) errors.push(`${e.name} is only available up to SM +${e.maxSM}.`);
    if (p.isCore && e.core === false) errors.push(`${e.name} cannot be a core system.`);
    if (e.coreOnly && !p.isCore) errors.push(`${e.name} must occupy a [core] slot.`);
    if (!p.isCore && e.loc === 'rear' && p.section !== 'rear') errors.push(`${e.name} must go in the rear hull.`);
    if (!p.isCore && e.loc === 'front' && p.section !== 'front') errors.push(`${e.name} must go in the front hull.`);
    if (!p.isCore && e.loc === 'central' && p.section !== 'central') errors.push(`${e.name} must go in the central hull.`);
    if (p.info.invalid) errors.push(`${e.name}: ${p.info.desc}.`);
  }

  // Spinal batteries come in three linked parts.
  const spinalFront = placed.some((p) => p.info.spinalFront);
  const spinalCentral = placed.some((p) => p.info.spinalCentral && p.isCore);
  const spinalRear = placed.some((p) => p.info.spinalRear);
  if ((spinalFront || spinalCentral || spinalRear) && !(spinalFront && spinalCentral && spinalRear)) {
    errors.push('A spinal battery needs all three parts: front weapon, central [core] section, and rear section.');
  }

  // --- Accumulate ----------------------------------------------------------
  const acc = {
    armor: { front: 0, central: 0, rear: 0 },
    armorCost: { front: 0, central: 0, rear: 0 },
    pp: { normal: 0, magic: 0, psi: 0 },
    ppNeed: { normal: 0, magic: 0, psi: 0 },
    cargo: 0, hangar: 0, spareCargo: 0, fuelTanks: 0,
    cabins: 0, sleeps: 0, hibernation: 0, seats: 0, controlStations: 0, turrets: 0, ws: 0,
    ftl: 0, ecm: 0, screenDDR: 0,
    contragrav: false, engineRoom: false, factory: false,
    complexity: null, arrayLevel: null,
    reactionless: [], reaction: [], sails: [],
    jetG: 0, jetCaps: [], rotors: 0, airHndBonus: 0,
    liftG: 0, liftTons: 0, legs: 0, arms: 0,
    solarMirrors: 0, mirrorUsers: 0,
  };
  let systemsCost = 0;
  const armorFree = d.features.advancedArmor; // SS3: hardening is free
  const armorMult = d.features.hardenedArmor && !armorFree ? 2 : 1;

  for (const p of placed) {
    const i = p.info;
    const isArmor = p.entry.category === 'Armor';
    const cost = p.cost * (isArmor ? armorMult : 1);
    systemsCost += cost;
    if (isArmor) acc.armorCost[p.section] += cost;
    if (i.armorDDR) acc.armor[p.section] += i.armorDDR;
    if (i.pp) acc.pp[i.ppKind === 'magic' ? 'magic' : i.ppKind === 'psi' ? 'psi' : 'normal'] += i.pp;
    if (i.ppMagic) acc.pp.magic += i.ppMagic;
    if (i.ppNeed && !i.ppShared) acc.ppNeed[p.ppPool] += i.ppNeed;
    if (i.cargoTons) acc.cargo += i.cargoTons;
    if (i.hangarTons) acc.hangar += i.hangarTons;
    if (i.spareCargo) acc.spareCargo += i.spareCargo;
    if (i.fuelTank) acc.fuelTanks += i.tankFraction ?? 1;
    if (i.hndPenalty) acc.hndPenalty = (acc.hndPenalty || 0) + i.hndPenalty;
    if (i.smallPlant) acc.smallPlant = true;
    if (i.cabins) acc.cabins += i.cabins;
    if (i.sleeps) acc.sleeps += i.sleeps;
    if (i.hibernation) acc.hibernation += i.hibernation;
    if (i.seats) acc.seats += i.seats;
    if (i.controlStations) acc.controlStations += i.controlStations;
    if (i.turrets) acc.turrets += i.turrets;
    if (i.ws) acc.ws += i.ws;
    if (i.ftl) acc.ftl += i.ftl;
    if (i.ecm) acc.ecm += i.ecm;
    if (i.screenDDR) acc.screenDDR = Math.max(acc.screenDDR, i.screenDDR);
    if (i.contragrav) acc.contragrav = true;
    if (p.entry.key === 'engineRoom') acc.engineRoom = true;
    if (i.factory) acc.factory = true;
    if (i.complexity) acc.complexity = Math.max(acc.complexity ?? 0, i.complexity);
    if (i.arrayLevel) acc.arrayLevel = Math.max(acc.arrayLevel ?? -99, i.arrayLevel);
    if (i.engine) (i.reactionless ? acc.reactionless : acc.reaction).push(p);
    if (i.sail) acc.sails.push(p);
    if (i.jetG) { acc.jetG += i.jetG; if (i.airCap) acc.jetCaps.push(i.airCap); }
    if (p.entry.key === 'turbofan') acc.jetCaps.push(2000);
    if (i.rotor) acc.rotors += 1;
    if (i.airHndBonus) acc.airHndBonus += i.airHndBonus;
    if (i.liftG) acc.liftG += i.liftG;
    if (i.liftTons) acc.liftTons += i.liftTons;
    if (i.legs) acc.legs += i.legs;
    if (i.arms) acc.arms += i.arms;
    if (i.solarMirror) acc.solarMirrors += 1;
    if (p.entry.key === 'solarBoiler' || p.entry.key === 'solarThermal') acc.mirrorUsers += 1;
  }
  if (acc.legs > 0) acc.ppNeed.normal += 1; // one PP runs all robot legs

  // Streamlining requires at least one front/central armor system.
  if (d.streamlined && acc.armor.front === 0 && acc.armor.central === 0) {
    warnings.push('A streamlined hull needs at least one armor system on the front or central hull.');
  }
  if (acc.ecm > 3) warnings.push('Only three defensive ECM systems have any effect.');
  if (acc.mirrorUsers > acc.solarMirrors) {
    warnings.push('Each solar boiler or solar thermal rocket needs its own solar mirror system.');
  }
  if (acc.smallPlant) {
    warnings.push('Smaller power plants can only power other scaled-down systems in the same location.');
  }

  // --- Features ------------------------------------------------------------
  let featureCost = 0;
  for (const [key, on] of Object.entries(d.features)) {
    if (!on) continue;
    const f = FEATURES[key];
    if (!f) continue;
    if (f.streamlinedOnly && !d.streamlined) errors.push(`${f.name} requires a streamlined hull.`);
    if (f.unstreamlinedOnly && d.streamlined) errors.push(`${f.name} requires an unstreamlined hull.`);
    if (f.maxSM && d.sm > f.maxSM) errors.push(`${f.name} is limited to SM +${f.maxSM}.`);
    if (f.minSM && d.sm < f.minSM) errors.push(`${f.name} requires SM +${f.minSM}+.`);
    if (f.cost) {
      const c = f.cost[smI];
      if (c == null) errors.push(`${f.name} is not available at SM +${d.sm}.`);
      else featureCost += c;
    }
    if (f.flatCost) featureCost += f.flatCost;
    if (f.table) featureCost += (f.table[d.sm] || [0, 0])[1];
    if (f.costPerWorkspace) featureCost += f.costPerWorkspace * acc.ws;
    if (f.costPerTon) featureCost += f.costPerTon * hull.tons;
    if (f.ramFeature) featureCost += 0.5 * acc.armorCost.front;
  }
  let workspaces = acc.ws;
  if (d.features.totalAutomation) workspaces = 0;
  else if (d.features.highAutomation) workspaces = Math.ceil(workspaces / 10);

  // --- Performance ---------------------------------------------------------
  const reactionlessG = acc.reactionless.reduce((a, p) => a + p.info.accelG, 0);
  const reactionG = acc.reaction.reduce((a, p) => a + p.info.accelG, 0);
  const sailG = acc.sails.reduce((a, p) => a + p.info.accelG, 0);
  const bestG = Math.max(reactionlessG, reactionG, sailG);

  // Delta-V: tanks feed the reaction drive type with the most engines.
  let deltaV = 0;
  let fuelNote = null;
  if (acc.reaction.length && acc.fuelTanks > 0) {
    const byKey = {};
    for (const p of acc.reaction) byKey[p.entry.key] = (byKey[p.entry.key] || 0) + 1;
    const mainKey = Object.keys(byKey).sort((a, b) => byKey[b] - byKey[a])[0];
    const dvPer = acc.reaction.find((p) => p.entry.key === mainKey).info.dvPerTank || 0;
    deltaV = r2(dvPer * acc.fuelTanks * tankMultiplier(Math.floor(acc.fuelTanks)));
    fuelNote = `${r2(acc.fuelTanks)} tank(s) of ${acc.reaction.find((p) => p.entry.key === mainKey).info.fuel}`;
    if (Object.keys(byKey).length > 1) warnings.push('Multiple reaction-drive types: all fuel tanks are assigned to the most numerous type.');
  }

  // Move string.
  const hasDrive = bestG > 0;
  let move = '—';
  if (reactionlessG > 0 && reactionG > 0) move = `${r2(reactionlessG + reactionG)}G/c (${r2(reactionG)}G/${deltaV} mps reaction)`;
  else if (reactionlessG > 0) move = `${r2(reactionlessG)}G/c`;
  else if (reactionG > 0) move = `${r2(reactionG)}G/${deltaV} mps`;
  else if (sailG > 0) move = `${sailG}G (sail)`;

  // Hnd/SR.
  let hnd = null;
  let sr = null;
  if (hasDrive) {
    hnd = hull.hnd + hndAccelMod(bestG);
    sr = hull.sr;
    if (d.tl <= 8) { hnd -= 1; sr -= 1; }
    if (acc.hndPenalty) { hnd -= 1; sr -= 1; } // smaller control room
  }

  // HT.
  let ht = baseHT();
  if (d.sm <= 9 && !acc.engineRoom) ht -= 1;
  if ((d.features.totalAutomation || d.features.highAutomation) && d.tl <= 9) ht -= 1;
  if (acc.factory) ht += 1;
  if (d.features.lacksAutomation) ht += 1;
  if (d.quality === 'cheap') ht -= 2;
  if (d.quality === 'veryCheap') ht -= 4;

  // Occupancy.
  const crewOcc = acc.controlStations + acc.turrets + workspaces;
  const longTerm = acc.sleeps;
  let occ = '0';
  if (longTerm > 0 && acc.seats === 0) occ = `${longTerm}ASV`;
  else if (longTerm > 0) occ = `${longTerm}ASV+${acc.seats}SV`;
  else if (crewOcc > 0 && acc.seats === 0) occ = `${crewOcc}SV`;
  else if (crewOcc + acc.seats > 0) occ = `${crewOcc}+${acc.seats}SV`;
  const occupants = longTerm > 0 ? longTerm : crewOcc + acc.seats;

  // Load: cargo holds + hangar bays + 0.1 tons per occupant. Spare space in
  // part-filled weapon batteries is usable cargo but isn't counted here,
  // matching the book's published designs.
  const load = r2(acc.cargo + acc.hangar + 0.1 * occupants);

  // dDR string (smaller armor contributes thirds; round the total down).
  const ddr = [acc.armor.front, acc.armor.central, acc.armor.rear].map((v) => Math.floor(v));
  const ddrStr = ddr.every((v) => v === ddr[0]) ? String(ddr[0]) : ddr.join('/');

  // Air performance. Jets, rotors, lift armor and gasbags can all fly a ship
  // that lacks the thrust to lift itself.
  const gFly = d.features.winged || acc.contragrav || bestG > 1;
  const candidates = [];
  if (gFly && hasDrive) candidates.push(airSpeed(bestG, d.streamlined));
  if (acc.jetG > 0) {
    let jetSpeed = airSpeed(acc.jetG, d.streamlined);
    for (const cap of acc.jetCaps) jetSpeed = Math.min(jetSpeed, cap);
    candidates.push(jetSpeed);
  }
  if (acc.rotors > 0) candidates.push(d.streamlined ? (acc.rotors >= 2 ? 250 : 200) : (acc.rotors >= 2 ? 100 : 80));
  let air = candidates.length ? Math.max(...candidates) : null;
  if (air !== null && d.features.nauticalLines) air = Math.round(air * 0.2 / 10) * 10;
  let airHnd = null;
  if (air !== null && hnd !== null) {
    airHnd = hnd + (acc.contragrav ? 2 : 0) + (d.features.winged ? 4 : 0) + acc.airHndBonus;
    airHnd = Math.min(airHnd, 5);
  }
  const aerostatic = acc.liftG >= 1 || acc.liftTons > hull.tons;
  const liftNote = acc.liftG > 0
    ? `lifting armor: ${r2(acc.liftG)}G of lift`
    : acc.liftTons > 0 ? `gasbags: ${acc.liftTons.toLocaleString('en-US')} tons of lift (hull ${hull.tons.toLocaleString('en-US')} t)` : null;

  // Ground performance for walkers (SS4 robot legs).
  let ground = null;
  if (acc.legs > 0) {
    if (d.sm > 7) warnings.push('Robot legs are only practical on SM +4 to +7 spacecraft.');
    const top = acc.legs >= 3 ? 5 * acc.legs : acc.legs === 2 ? 10 : 5;
    const accel = acc.legs >= 2 ? 10 : 5;
    let gHnd = (8 - Math.min(d.sm, 7)) - (acc.legs >= 3 ? 1 : 0);
    if (d.streamlined || d.features.winged) gHnd -= 1;
    let gSr = acc.legs >= 4 ? 5 : acc.legs === 3 ? 4 : acc.legs === 2 ? 3 : 1;
    if (d.streamlined && d.features.winged) gSr -= 1;
    ground = { move: `${accel}/${top}`, hnd: gHnd, sr: gSr, legs: acc.legs };
  }

  let totalCost = systemsCost + featureCost;
  if (d.quality === 'cheap') totalCost *= 0.5;
  else if (d.quality === 'veryCheap') totalCost *= 0.2;
  // Physical slots: a "smaller ×3" bundle is one slot; a larger system is three.
  let slotsUsed = d.cores.filter((c) => c.sys).length;
  for (const section of SECTIONS) {
    for (const slot of d.sections[section]) {
      if (!slot.sys) continue;
      slotsUsed += (slot.scale === 'larger') ? 3 : 1;
    }
  }

  return {
    ok: errors.length === 0,
    errors, warnings, placed,
    stats: {
      dstHp: hull.dstHp, hnd, sr, ht,
      move, accelG: r2(bestG), deltaV, fuelNote,
      lwt: hull.tons, load, sm: d.sm, occ, occupants,
      hibernation: acc.hibernation || null,
      ddr: ddrStr, screenDDR: acc.screenDDR || null,
      range: acc.ftl > 0 ? `FTL-${acc.ftl}` : null,
      cost: totalCost, costStr: fmtC(totalCost),
      airSpeed: air, airHnd,
      ground, liftNote, aerostatic,
      complexity: acc.complexity, arrayLevel: acc.arrayLevel,
      ppProvided: acc.pp.normal, ppNeeded: acc.ppNeed.normal,
      magicPP: acc.pp.magic, magicPPNeeded: acc.ppNeed.magic,
      psiPP: acc.pp.psi, psiPPNeeded: acc.ppNeed.psi,
      workspaces, crewOcc, cabins: acc.cabins, seats: acc.seats,
      cargo: r2(acc.cargo + acc.hangar + acc.spareCargo),
      spareCargo: r2(acc.spareCargo),
      slotsUsed, slotsTotal: 20,
      lengthYds: hull.lengthYds,
    },
  };
}
