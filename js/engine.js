// ---------------------------------------------------------------------------
// GURPS Vehicles Builder — design engine
//
// computeStats(design) is a pure function: it takes a design object and
// returns { errors, warnings, weights, costs, stats }. All the tunable
// numbers live in data.js.
// ---------------------------------------------------------------------------

import {
  ACCESSORIES, ARMOR_MATERIALS, CAB_TYPES, CHASSIS, ENGINES, ENVIRONMENTS,
  FACINGS, FRAME_COST_PER_LB, FRAME_QUALITIES, MOUNTS, OCCUPANT_WEIGHT,
  SEATS, STREAMLINING, TL_MAX, TL_MIN, smFromYards, tlLookup,
} from './data.js';

export function defaultDesign() {
  return {
    name: 'New Vehicle',
    tl: 8,
    chassis: 'wheeled',
    maxLWt: 4500,          // frame capacity, lbs
    quality: 'standard',
    streamlining: 'standard',
    cab: 'enclosed',
    wheels: 4,
    lengthAuto: true,
    lengthYds: 5,
    engine: 'gasoline',
    power: 180,            // hp (ignored for sail/pedal)
    fuelLbs: 90,           // fuel weight; battery weight for electric
    armor: { material: 'hardSteel', front: 4, sides: 3, rear: 3, top: 3, under: 3 },
    crew: 1,
    passengers: 3,
    cargoLbs: 300,
    accessories: ['headlights', 'radio'],
    weapons: [],           // { name, weight, cost, dmg, mount, qty }
    equipment: [],         // { name, weight, cost, note } — custom/GVB gear
  };
}

const r = (x, d = 0) => {
  const m = 10 ** d;
  return Math.round(x * m) / m;
};

// Round to 3 significant figures for prices.
function sig3(x) {
  if (x === 0) return 0;
  const mag = 10 ** (Math.floor(Math.log10(Math.abs(x))) - 2);
  return Math.round(x / mag) * mag;
}

export function estimateLengthYds(design, loadedTons) {
  const chassis = CHASSIS[design.chassis];
  const tons = Math.max(loadedTons, 0.02);
  return chassis.kLen * Math.cbrt(tons);
}

function accessoryWeight(acc, maxLWt) {
  return acc.base + acc.frac * maxLWt;
}

export function accessoryAllowed(acc, design) {
  if (!acc.only) return true;
  const chassis = CHASSIS[design.chassis];
  return acc.only.includes(design.chassis) || acc.only.includes(chassis.env);
}

export function computeStats(design) {
  const errors = [];
  const warnings = [];

  const tl = design.tl;
  const chassis = CHASSIS[design.chassis];
  const engine = ENGINES[design.engine];
  const quality = FRAME_QUALITIES[design.quality];
  const streamlining = STREAMLINING[design.streamlining];
  const env = ENVIRONMENTS[chassis.env];
  const maxLWt = Math.max(Number(design.maxLWt) || 0, 50);

  if (tl < TL_MIN || tl > TL_MAX) errors.push(`TL must be between ${TL_MIN} and ${TL_MAX}.`);
  if (tl < chassis.minTL) errors.push(`${chassis.name} requires TL ${chassis.minTL}+.`);
  if (tl < engine.minTL) errors.push(`${engine.name} requires TL ${engine.minTL}+.`);
  if (engine.envOnly && engine.envOnly !== chassis.env) {
    errors.push(`${engine.name} only works on ${engine.envOnly} vehicles.`);
  }

  // --- Structure -----------------------------------------------------------
  const structureW = chassis.structFrac * quality.weightMult * maxLWt;
  const frameCost = structureW * (tlLookup(FRAME_COST_PER_LB, tl) ?? FRAME_COST_PER_LB[5]) * quality.costMult;

  // --- Propulsion ----------------------------------------------------------
  let power = Math.max(Number(design.power) || 0, 0);
  let engineW = 0;
  let engineCost = 0;
  let batteryW = 0;
  let batteryCost = 0;
  let fuelW = Math.max(Number(design.fuelLbs) || 0, 0);

  if (engine.sail) {
    power = 0;
    engineW = 0.04 * maxLWt;
    engineCost = engineW * 3;
    fuelW = 0;
  } else if (engine.pedal) {
    power = engine.hpPerCrew * Math.max(design.crew, 1);
    engineW = engine.lbPerStation * Math.max(design.crew, 1);
    engineCost = engine.costPerStation * Math.max(design.crew, 1);
    fuelW = 0;
  } else {
    const lbPerHp = tlLookup(engine.lbPerHp, tl);
    const costPerHp = tlLookup(engine.costPerHp, tl);
    if (lbPerHp === undefined) {
      errors.push(`${engine.name} is not available at TL ${tl}.`);
    } else {
      engineW = power * lbPerHp;
      engineCost = power * costPerHp;
    }
    if (engine.electric) {
      batteryW = fuelW;                 // the "fuel" slider is battery weight
      fuelW = 0;
      batteryCost = batteryW * (tlLookup(engine.costPerLbBattery, tl) ?? 5);
    }
    if (engine.unlimited) fuelW = 0;
  }

  // --- Armor ---------------------------------------------------------------
  const material = ARMOR_MATERIALS[design.armor.material];
  if (material && tl < material.minTL) {
    errors.push(`${material.name} armor requires TL ${material.minTL}+.`);
  }
  const area = chassis.armorK * Math.pow(maxLWt, 2 / 3);
  let armorW = 0;
  let armorCost = 0;
  const drByFacing = {};
  for (const f of FACINGS) {
    const dr = Math.max(Number(design.armor[f.key]) || 0, 0);
    drByFacing[f.key] = dr;
    if (material) {
      const w = area * f.frac * dr * material.lbPerDRSqFt;
      armorW += w;
      armorCost += w * material.costPerLb;
    }
  }

  // --- Crew, passengers, accessories, weapons ------------------------------
  const crew = Math.max(Math.floor(design.crew) || 0, 0);
  const passengers = Math.max(Math.floor(design.passengers) || 0, 0);
  if (crew === 0 && !design.accessories.includes('selfDriving')) {
    warnings.push('No crew stations — add at least one driver/pilot (or an autonomous pilot).');
  }
  const seatsW = crew * SEATS.crew.weight + passengers * SEATS.passenger.weight;
  const seatsCost = crew * SEATS.crew.cost + passengers * SEATS.passenger.cost;

  let accW = 0;
  let accCost = 0;
  for (const key of design.accessories) {
    const acc = ACCESSORIES[key];
    if (!acc) continue;
    if (tl < acc.minTL) errors.push(`${acc.name} requires TL ${acc.minTL}+.`);
    if (!accessoryAllowed(acc, design)) warnings.push(`${acc.name} does not fit a ${chassis.name.toLowerCase()}; ignoring is recommended.`);
    accW += accessoryWeight(acc, maxLWt);
    accCost += acc.cost;
  }

  let equipW = 0;
  let equipCost = 0;
  for (const item of design.equipment || []) {
    equipW += Math.max(Number(item.weight) || 0, 0);
    equipCost += Math.max(Number(item.cost) || 0, 0);
  }

  let weaponsW = 0;
  let weaponsCost = 0;
  let hasTurret = false;
  let hasOpenMount = false;
  let hasFixedWeapon = false;
  for (const w of design.weapons) {
    const mount = MOUNTS[w.mount] || MOUNTS.fixed;
    const qty = Math.max(Math.floor(w.qty) || 1, 1);
    weaponsW += (Number(w.weight) || 0) * mount.weightMult * qty;
    weaponsCost += (Number(w.cost) || 0) * mount.costMult * qty;
    if (w.mount === 'turret') hasTurret = true;
    else if (w.mount === 'open') hasOpenMount = true;
    else hasFixedWeapon = true;
    if (w.minTL && tl < w.minTL) errors.push(`${w.name} requires TL ${w.minTL}+.`);
  }

  // --- Weight totals -------------------------------------------------------
  const cargoLbs = Math.max(Number(design.cargoLbs) || 0, 0);
  const emptyW = structureW + engineW + batteryW + armorW + seatsW + accW + weaponsW + equipW;
  const occupantsW = (crew + passengers) * OCCUPANT_WEIGHT;
  const payloadW = occupantsW + cargoLbs;
  const loadedW = emptyW + fuelW + payloadW;

  if (loadedW > maxLWt) {
    errors.push(`Overloaded by ${r(loadedW - maxLWt)} lbs — increase frame capacity or shed weight.`);
  }
  const tons = loadedW / 2000;

  // --- Geometry & SM -------------------------------------------------------
  const lengthYds = design.lengthAuto
    ? estimateLengthYds(design, tons)
    : Math.max(Number(design.lengthYds) || 1, 0.5);
  const sm = Math.max(smFromYards(lengthYds) - 1, -4); // -1: long box, not upright figure

  // --- Handling / SR -------------------------------------------------------
  let hnd = chassis.hnd;
  let sr = chassis.sr;
  if (sm >= 9) { hnd -= 2; sr += 2; }
  else if (sm >= 6) { hnd -= 1; sr += 1; }
  sr = Math.min(Math.max(sr, 2), 7);
  hnd = Math.min(Math.max(hnd, -4), 2);

  // --- Speed ---------------------------------------------------------------
  const hpPerTon = tons > 0 && power > 0 ? power / tons : 0;
  const lengthFt = lengthYds * 3;
  const hullSpeed = 1.55 * Math.sqrt(lengthFt); // mph, displacement hulls

  let topMph;
  if (engine.sail) {
    topMph = 0.9 * hullSpeed;
  } else {
    topMph = chassis.kSpeed * Math.sqrt(hpPerTon) * streamlining.speedMult;
    if (chassis.hullSpeedCap) topMph = Math.min(topMph, hullSpeed);
    if (chassis.minHpTon && hpPerTon < chassis.minHpTon) {
      topMph = Math.min(topMph, hullSpeed);
      warnings.push(`Below ${chassis.minHpTon} hp/ton the hull cannot plane — treated as a displacement hull.`);
    }
    if (chassis.capMph) topMph = Math.min(topMph, chassis.capMph);
  }

  if (chassis.minHpTonFly && hpPerTon < chassis.minHpTonFly) {
    errors.push(`Needs at least ${chassis.minHpTonFly} hp/ton to fly (currently ${r(hpPerTon, 1)}).`);
  }
  if (design.chassis === 'submarine' && !engine.electric && !engine.unlimited) {
    warnings.push('Air-breathing engine: this submarine can only run surfaced (or add a snorkel at your GM’s discretion).');
  }

  let accel;
  if (engine.sail) accel = 0.5;
  else accel = Math.min(Math.max(hpPerTon / chassis.accelDiv, 0.25), 12);

  const stallMph = chassis.stallFrac ? Math.max(chassis.stallFrac * topMph, 20) : null;

  // --- HP / HT -------------------------------------------------------------
  const hp = Math.max(Math.round(4 * Math.cbrt(Math.max(emptyW, 1))), 1);
  let ht = 11 + quality.htMod;
  ht = Math.min(Math.max(ht, 7), 13);
  const flammable = !!engine.flammable && !design.accessories.includes('fireSuppression');
  const htSuffix = flammable ? 'f' : '';

  // --- Range ---------------------------------------------------------------
  const cruiseMph = 0.7 * topMph;
  let rangeMi = null; // null = unlimited
  if (engine.unlimited || engine.sail || engine.pedal) {
    rangeMi = null;
  } else if (engine.electric) {
    const whPerLb = tlLookup(engine.whPerLbBattery, tl) ?? 0;
    const cruiseKw = power * 0.746 * env.mechFrac;
    rangeMi = cruiseKw > 0 ? cruiseMph * ((batteryW * whPerLb) / 1000 / cruiseKw) : 0;
  } else {
    const flow = power * engine.fuel.lbPerHpHr * env.fuelFrac; // lbs/hr at cruise
    rangeMi = flow > 0 ? cruiseMph * (fuelW / flow) : 0;
  }

  // --- Cost ----------------------------------------------------------------
  const subtotal = frameCost + engineCost + batteryCost + armorCost + seatsCost + accCost + weaponsCost + equipCost;
  const totalCost = sig3(subtotal * 1.2); // 20% assembly & integration

  // --- Presentation strings ------------------------------------------------
  const drVals = FACINGS.map((f) => drByFacing[f.key]);
  const uniform = drVals.every((v) => v === drVals[0]);
  const drStr = uniform ? String(drVals[0]) : drVals.join('/');

  const locations = buildLocations(design, chassis, { hasTurret, hasOpenMount, hasFixedWeapon, sm });

  const moveStr = `${r(accel, accel < 2 ? 1 : 0)}/${Math.max(Math.round(topMph / 2), engine.sail ? 2 : 0)}`;

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    weights: {
      structure: structureW, engine: engineW, battery: batteryW, fuel: fuelW,
      armor: armorW, seats: seatsW, accessories: accW, weapons: weaponsW,
      equipment: equipW,
      occupants: occupantsW, cargo: cargoLbs,
      empty: emptyW, payload: payloadW, loaded: loadedW,
      maxLWt, remaining: maxLWt - loadedW,
    },
    costs: {
      frame: frameCost, engine: engineCost, battery: batteryCost, armor: armorCost,
      seats: seatsCost, accessories: accCost, weapons: weaponsCost,
      equipment: equipCost,
      subtotal, total: totalCost,
    },
    stats: {
      stHp: hp, hnd, sr, ht, htSuffix,
      accel: r(accel, 1), topMph: r(topMph), topYps: Math.round(topMph / 2),
      moveStr,
      lwtTons: r(tons, 2), loadTons: r(payloadW / 2000, 2),
      sm, occ: `${crew}+${passengers}`,
      dr: drStr, drByFacing,
      rangeMi: rangeMi === null ? null : r(rangeMi),
      cost: totalCost,
      locations,
      stallMph: stallMph === null ? null : r(stallMph),
      lengthYds: r(lengthYds, 1),
      hpPerTon: r(hpPerTon, 1),
      power: r(power, 1),
      areaSqFt: r(area),
      cruiseMph: r(cruiseMph),
    },
  };
}

function buildLocations(design, chassis, extras) {
  const parts = [];
  if (!chassis.noCabCode) {
    const cab = CAB_TYPES[design.cab];
    if (cab) parts.push(cab.code);
  }
  if (chassis.hasWheels) {
    const n = Math.max(Math.floor(design.wheels) || chassis.defaultWheels || 4, 2);
    const retract = design.accessories.includes('retractGear') ? 'r' : '';
    parts.push(`${n}${retract}W`);
  }
  if (chassis.locCode) parts.push(chassis.locCode);
  if (design.engine === 'sail') parts.push('M');
  if (chassis.env === 'water' && extras.sm >= 6 && design.chassis !== 'submarine') parts.push('S');
  if (extras.hasTurret) parts.push('T');
  if (extras.hasOpenMount) parts.push('t');
  if (extras.hasFixedWeapon) parts.push('X');
  return parts.length ? parts.join('') : '–';
}

// Compact number formatting for the UI.
export function fmtLbs(x) {
  return `${Math.round(x).toLocaleString('en-US')} lb`;
}

export function fmtCost(x) {
  return `$${Math.round(x).toLocaleString('en-US')}`;
}
