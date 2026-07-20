// ---------------------------------------------------------------------------
// GURPS Vehicles 2e — vehicle assembly.
// computeVe2(design) runs the whole design sequence: volumes → areas →
// structure → armor → hit points → weights → statistics → performance.
// ---------------------------------------------------------------------------

import {
  BODY_VOLUME_MULTS, FLOTATION_SUBMERSIBLE, FRAME_STRENGTHS, FUELS, GASBAG,
  HP_FACTORS, HYDRO_LINES, MAST_OPEN_MOUNT, MATERIALS, PAYLOAD_PER_CARGO_CF,
  PAYLOAD_PER_PERSON, SEALED_COST_PER_SF, SPECIAL_STRUCTURES, STREAMLINING,
  STRUCTURE_MODIFIERS, SUBASSEMBLY_VOLUME, TURRET_ROTATION_SPACE,
  WATERPROOF_COST_PER_SF, WING_AREA_MULT, armorWeightMod, ARMOR_TYPES,
  locationHP, mastVolume, pdFromDR, sizeModifier, slopeVolumeMult,
  structuralHT, structureTL, surfaceArea,
} from './tables.js';
import * as P from './performance.js';

export function defaultVe2Design() {
  return {
    name: 'New VE2 Vehicle',
    tl: 7,
    controls: 'mechanical', // mechanical | electronic | computerized
    streamlining: 'none',
    features: {
      flotationHull: false, submersibleHull: false, hydroLines: 'none',
      catamaran: false, trimaran: false, sealed: false, waterproofed: false,
      liftingBody: false, responsive: false,
    },
    structure: { frame: 'medium', material: 'standard', special: 'none' },
    armor: { type: 'metalStandard', dr: 5 },
    bodySlopeDegrees: 0,
    subassemblies: {
      wheels: { present: true, type: 'standard', count: 4, retractable: false },
      tracks: { present: false },
      halftracks: { present: false },
      skids: { present: false },
      wings: { present: false, type: 'standard', volumeFrac: 0.1 },
      rotors: { present: false, tl: 7 },
      turret: { present: false, volumeCf: 8, rotation: 'full', slopeDegrees: 0 },
      masts: { present: false, heightFt: 30 },
      gasbag: { present: false, cf: 0 },
    },
    // Each component: { name, weight, cost, volume, kwIn, kwOut, groundKw,
    //   aquaticThrust, airThrust, staticLift, contragravLift, airBreathing,
    //   location: 'body' | 'turret' | 'wings', note }
    components: [],
    crew: 1,
    passengers: 0,
    cargoCf: 0,
    emptySpaceCf: 0,
    fuel: { type: 'gasoline', gallons: 0 },
    options: {
      improvedSuspension: false, improvedBrakes: false, allWheelSteering: false,
      allWheelDrive: false, smartwheels: false, rollStabilizers: false,
    },
  };
}

const n = (x) => Number(x) || 0;
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;

export function computeVe2(design) {
  const errors = [];
  const warnings = [];
  const d = design;
  const tl = d.tl;
  const sub = d.subassemblies;
  const feats = d.features;
  const opts = d.options;

  // --- Component totals ----------------------------------------------------
  const comps = d.components || [];
  const sum = (f) => comps.reduce((acc, c) => acc + n(f(c)), 0);
  const compWeight = sum((c) => c.weight);
  const compCost = sum((c) => c.cost);
  const powerNeeded = sum((c) => c.kwIn);
  const powerAvailable = sum((c) => c.kwOut);
  const groundKw = sum((c) => c.groundKw);
  const aquaticThrust = sum((c) => c.aquaticThrust);
  const aquaticThrustSubmerged = comps.reduce((a, c) => a + (c.airBreathing ? 0 : n(c.aquaticThrust)), 0);
  const airThrust = sum((c) => c.airThrust);
  const staticLift = sum((c) => c.staticLift);
  const contragravLift = sum((c) => c.contragravLift);

  if (powerNeeded > powerAvailable + 0.001 && powerNeeded > 0) {
    warnings.push(`Components need ${r1(powerNeeded)} kW but power plants provide only ${r1(powerAvailable)} kW.`);
  }

  // --- Volumes -------------------------------------------------------------
  const volInLocation = (loc) => comps.reduce((a, c) => a + ((c.location || 'body') === loc ? n(c.volume) : 0), 0);

  // Turret
  let turretVolume = 0;
  let turretRotSpace = 0;
  if (sub.turret.present) {
    const inTurret = volInLocation('turret');
    turretVolume = Math.max(n(sub.turret.volumeCf), inTurret) * slopeVolumeMult(n(sub.turret.slopeDegrees));
    if (inTurret > n(sub.turret.volumeCf)) {
      warnings.push(`Turret volume raised to ${r2(inTurret)} cf to fit its components.`);
    }
    turretRotSpace = turretVolume * (TURRET_ROTATION_SPACE[sub.turret.rotation] ?? 0.2);
  }

  // Body
  const bodyComponents = volInLocation('body') + n(d.cargoCf) + n(d.emptySpaceCf) + turretRotSpace;
  let bodyVolume = bodyComponents * slopeVolumeMult(n(d.bodySlopeDegrees));
  bodyVolume *= STREAMLINING[d.streamlining]?.bodyVolume ?? 1;
  if (feats.submersibleHull) bodyVolume *= BODY_VOLUME_MULTS.submersibleHull;
  bodyVolume *= HYDRO_LINES[feats.hydroLines]?.bodyVolume ?? 1;
  if (feats.catamaran || feats.trimaran) bodyVolume *= BODY_VOLUME_MULTS.catamaran;
  if (sub.wheels.present && sub.wheels.retractable) bodyVolume *= BODY_VOLUME_MULTS.retractIntoBody;

  if (bodyVolume <= 0) errors.push('The body has no volume — add components, cargo space or empty space.');

  // Other subassemblies
  const volumes = { body: bodyVolume, turret: turretVolume };
  if (sub.wheels.present) {
    const frac = sub.wheels.retractable || sub.wheels.type === 'small' ? SUBASSEMBLY_VOLUME.wheelsSmall
      : ['heavy', 'offroad', 'railway'].includes(sub.wheels.type) ? SUBASSEMBLY_VOLUME.wheelsHeavy
        : SUBASSEMBLY_VOLUME.wheelsStandard;
    volumes.wheels = frac * bodyVolume;
  }
  if (sub.tracks.present) volumes.tracks = SUBASSEMBLY_VOLUME.tracks * bodyVolume;
  if (sub.halftracks.present) volumes.halftracks = SUBASSEMBLY_VOLUME.halftrack * bodyVolume;
  if (sub.skids.present) volumes.skids = SUBASSEMBLY_VOLUME.skids * bodyVolume;
  if (sub.wings.present) {
    const inWings = volInLocation('wings');
    volumes.wings = sub.wings.type === 'stub'
      ? SUBASSEMBLY_VOLUME.stubWing * bodyVolume
      : Math.max(2 * n(sub.wings.volumeFrac) * bodyVolume, inWings);
  } else if (volInLocation('wings') > 0) {
    warnings.push('Components are located in wings, but the vehicle has no wings.');
  }
  if (sub.rotors.present) volumes.rotors = SUBASSEMBLY_VOLUME.rotor * bodyVolume;
  if (sub.masts.present) volumes.masts = mastVolume(n(sub.masts.heightFt));
  if (sub.gasbag.present) volumes.gasbag = n(sub.gasbag.cf);

  const totalVolume = Object.values(volumes).reduce((a, v) => a + v, 0);

  // --- Areas ---------------------------------------------------------------
  const areas = {};
  for (const [key, vol] of Object.entries(volumes)) {
    let area = surfaceArea(vol);
    if (key === 'wings' && sub.wings.type !== 'stub') {
      area *= WING_AREA_MULT[sub.wings.type] ?? 1.5;
    }
    if (key === 'rotors') area *= WING_AREA_MULT.rotor;
    areas[key] = area;
  }
  const totalArea = Object.values(areas).reduce((a, v) => a + v, 0);
  const structuralArea = totalArea - (areas.masts || 0) - (areas.gasbag || 0);

  // --- Structure -----------------------------------------------------------
  const st = structureTL(tl);
  const frame = FRAME_STRENGTHS[d.structure.frame];
  const material = MATERIALS[d.structure.material];
  const special = SPECIAL_STRUCTURES[d.structure.special];
  if (material.minTL > tl) errors.push(`${material.name} materials require TL ${material.minTL}+.`);
  if (special.minTL > tl) errors.push(`${special.name} structure requires TL ${special.minTL}+.`);
  const streamlining = STREAMLINING[d.streamlining];
  if (streamlining.minTL > tl) errors.push(`${streamlining.name} streamlining requires TL ${streamlining.minTL}+.`);

  let structWeight = structuralArea * st.weight * frame.weight * material.weight * special.weight;
  let structCost = structuralArea * st.cost * frame.cost * material.cost * special.cost;
  if (feats.submersibleHull) {
    structWeight *= STRUCTURE_MODIFIERS.submersible.weight;
    structCost *= STRUCTURE_MODIFIERS.submersible.cost;
  }
  if (sub.wings.present || sub.rotors.present) structCost *= STRUCTURE_MODIFIERS.wingsOrRotors.cost;
  structCost *= streamlining.structCost;
  if (feats.liftingBody) structCost *= STRUCTURE_MODIFIERS.liftingBody.cost;

  // Masts & gasbags are built separately (not structural area).
  let mastWeight = 0;
  let mastCost = 0;
  if (sub.masts.present) {
    const w = lookupTL(MAST_OPEN_MOUNT.weightBySf, tl);
    mastWeight = areas.masts * w;
    mastCost = areas.masts * MAST_OPEN_MOUNT.costPerSf;
  }
  let gasbagWeight = 0;
  let gasbagCost = 0;
  if (sub.gasbag.present) {
    gasbagWeight = areas.gasbag * lookupTL(GASBAG.weightBySf, tl);
    gasbagCost = areas.gasbag * lookupTL(GASBAG.costBySf, tl);
  }

  // --- Armor (overall) -----------------------------------------------------
  const dr = Math.max(Math.floor(n(d.armor.dr)), 0);
  let armorWeight = 0;
  let armorCost = 0;
  let pd = 0;
  if (dr > 0) {
    const mod = armorWeightMod(d.armor.type, tl);
    const type = ARMOR_TYPES[d.armor.type];
    if (mod === null) {
      errors.push(`${type?.name || d.armor.type} armor is not available at TL ${tl}.`);
    } else {
      armorWeight = structuralArea * mod * dr;
      armorCost = armorWeight * type.costPerLb;
      pd = pdFromDR(dr);
      if (type.group === 'wood') pd = Math.min(pd, 3);
      if (type.group === 'nonrigid') pd = Math.min(pd, 2);
    }
  } else if (feats.flotationHull || feats.submersibleHull || d.streamlining !== 'none' || sub.rotors.present) {
    warnings.push('Vehicles with a flotation/submersible hull, streamlining or rotors must have at least some armor.');
  }

  // --- Sealing -------------------------------------------------------------
  let sealCost = 0;
  if (feats.submersibleHull) {
    // Submersible includes sealed & waterproof at no extra cost.
  } else if (feats.sealed) {
    sealCost = structuralArea * lookupTL(SEALED_COST_PER_SF, Math.max(tl, 5));
    if (dr < 1) warnings.push('A sealed vehicle requires DR 1+ over the entire body.');
  } else if (feats.waterproofed || feats.flotationHull) {
    sealCost = structuralArea * WATERPROOF_COST_PER_SF;
  }

  // --- Hit points ----------------------------------------------------------
  const frameKey = d.structure.frame;
  const hp = { body: locationHP(areas.body, HP_FACTORS.body, frameKey) };
  if (sub.turret.present) hp.turret = locationHP(areas.turret, HP_FACTORS.turret, frameKey);
  if (sub.wheels.present) hp.perWheel = locationHP(areas.wheels, HP_FACTORS.wheel, frameKey, Math.max(sub.wheels.count, 1));
  if (sub.tracks.present) hp.perTrack = locationHP(areas.tracks, HP_FACTORS.track, frameKey, 2);
  if (sub.halftracks.present) hp.perTrack = locationHP(areas.halftracks, HP_FACTORS.track, frameKey, 2);
  if (sub.skids.present) hp.perSkid = locationHP(areas.skids, HP_FACTORS.skid, frameKey, 2);
  if (sub.wings.present) hp.perWing = locationHP(areas.wings / 2, HP_FACTORS.wing, frameKey);
  if (sub.rotors.present) hp.rotor = locationHP(areas.rotors, HP_FACTORS.rotor, frameKey);
  if (sub.masts.present) hp.mast = Math.max(Math.round(areas.masts * HP_FACTORS.mast), 1);
  if (sub.gasbag.present) hp.gasbag = Math.max(Math.round(areas.gasbag * HP_FACTORS.gasbag), 1);

  // --- Weights -------------------------------------------------------------
  const emptyWeight = structWeight + armorWeight + compWeight + mastWeight + gasbagWeight;
  const people = Math.max(Math.floor(d.crew), 0) + Math.max(Math.floor(d.passengers), 0);
  const payload = people * PAYLOAD_PER_PERSON + n(d.cargoCf) * PAYLOAD_PER_CARGO_CF;
  const fuelType = FUELS[d.fuel.type] || FUELS.gasoline;
  const fuelWeight = n(d.fuel.gallons) * fuelType.lbsPerGal;
  const loadedWeight = emptyWeight + payload + fuelWeight;
  const loadedTons = loadedWeight / 2000;

  // --- Statistics ----------------------------------------------------------
  const sm = sizeModifier(totalVolume);
  const price = structCost + armorCost + compCost + mastCost + gasbagCost + sealCost;
  const ht = structuralHT(hp.body, loadedWeight, tl);

  // Flotation
  const lines = HYDRO_LINES[feats.hydroLines] || HYDRO_LINES.none;
  const flotationPerCf = feats.submersibleHull ? FLOTATION_SUBMERSIBLE : lines.flotation;
  const flotationVolume = feats.submersibleHull ? bodyVolume + turretVolume : bodyVolume;
  const flotation = (feats.flotationHull || feats.submersibleHull) ? flotationPerCf * flotationVolume : 0;
  const floats = flotation > 0 && loadedWeight <= flotation;
  if ((feats.flotationHull || feats.submersibleHull) && !floats && flotation > 0) {
    warnings.push(`Loaded weight ${Math.round(loadedWeight)} lbs exceeds flotation ${Math.round(flotation)} lbs — it sinks. Add empty space.`);
  }
  const submergedWeight = feats.submersibleHull ? Math.max(loadedWeight, 62.5 * totalVolume) : 0;

  // --- Performance ---------------------------------------------------------
  const perf = {};
  const controlsOpts = {
    electronicControls: d.controls === 'electronic',
    computerizedControls: d.controls === 'computerized',
    responsiveStructure: feats.responsive,
  };

  // Ground
  let groundSystem = null;
  if (sub.wheels.present) groundSystem = 'wheels';
  else if (sub.tracks.present) groundSystem = 'tracks';
  else if (sub.halftracks.present) groundSystem = 'halftracks';
  else if (sub.skids.present) groundSystem = 'skids';
  if (groundSystem) {
    const speed = P.groundSpeed({
      system: groundSystem, tl,
      motivePowerKw: groundKw,
      auxThrustLbs: airThrust,
      loadedTons, streamlining: d.streamlining,
      opts: { improvedSuspension: opts.improvedSuspension, railway: sub.wheels.type === 'railway' },
    });
    const acc = P.gAccel({ topSpeed: speed.mph, sf: speed.sf, system: groundSystem });
    const dec = P.gDecel({ system: groundSystem, improvedBrakes: opts.improvedBrakes, smartwheels: opts.smartwheels });
    const mrsr = P.gMRgSR({
      system: groundSystem, wheelCount: sub.wheels.count, bodyVolumeCf: bodyVolume, tl,
      opts: {
        ...controlsOpts,
        improvedSuspension: opts.improvedSuspension,
        allWheelSteering: opts.allWheelSteering,
        smartwheels: opts.smartwheels,
        smallWheels: sub.wheels.type === 'small',
        smallOrRailwayWheels: ['small', 'railway'].includes(sub.wheels.type),
        unfoldedWingsOrRotors: sub.wings.present || sub.rotors.present,
      },
    });
    const subareaKey = groundSystem === 'wheels' ? 'wheels' : groundSystem;
    const area = P.contactArea({
      system: groundSystem, subassemblyArea: areas[subareaKey] || 0, tl, wheelType: sub.wheels.type,
    });
    const category = groundSystem === 'tracks' ? 2
      : (groundSystem === 'halftracks' || (groundSystem === 'wheels' && opts.allWheelDrive)) ? 3 : 4;
    const gp = P.groundPressure({ loadedLbs: loadedWeight, contragravLift, area, category });
    perf.ground = {
      system: groundSystem, topSpeed: speed.mph, sf: speed.sf,
      gAccel: acc.value, gDecel: dec, gMR: mrsr.gMR, gSR: mrsr.gSR,
      groundPressure: Math.round(gp.gp), gpLabel: gp.label,
      offRoad: gp.offRoadFraction,
    };
    if (groundKw <= 0 && airThrust <= 0) {
      warnings.push('Ground motive system present but no drivetrain motive power — top speed is 0.');
    }
  }

  // Water
  if (floats) {
    const drag = P.hydroDrag({
      loadedLbs: loadedWeight, contragravLift, lines: feats.hydroLines,
      catamaran: feats.catamaran, trimaran: feats.trimaran,
    });
    const planing = P.canPlane({ aquaticThrustLbs: aquaticThrust, loadedLbs: loadedWeight, hl: drag.hl });
    const speed = P.waterSpeed({
      aquaticThrustLbs: aquaticThrust, drag: drag.value,
      streamlining: d.streamlining, planingOk: planing,
    });
    const acc = P.wAccel({ aquaticThrustLbs: aquaticThrust, loadedLbs: loadedWeight });
    const mrsr = P.wMRwSR({
      tl, bodyVolumeCf: bodyVolume, lines: feats.hydroLines,
      opts: { ...controlsOpts, rollStabilizers: opts.rollStabilizers, catamaran: feats.catamaran, trimaran: feats.trimaran },
    });
    const dec = P.wDecel({ wMR: mrsr.wMR, hl: drag.hl, wAccelValue: acc.value });
    perf.water = {
      drag: drag.value, topSpeed: speed.mph, planing: speed.planing,
      wAccel: acc.value, wDecel: dec.base, wDecelPowered: dec.withPower,
      wMR: mrsr.wMR, wSR: mrsr.wSR,
      draft: P.draft({ loadedLbs: loadedWeight, contragravLift, lines: feats.hydroLines }),
    };
  }

  // Submerged
  if (feats.submersibleHull) {
    const drag = P.submergedDrag({ submergedLbs: submergedWeight, lines: feats.hydroLines });
    const speed = P.submergedSpeed({ thrustLbs: aquaticThrustSubmerged, drag: drag.value });
    perf.submerged = {
      drag: drag.value, topSpeed: speed.mph,
      uAccel: P.uAccel({ thrustLbs: aquaticThrustSubmerged, submergedLbs: submergedWeight }).value,
      draft: P.submergedDraft({ submergedLbs: submergedWeight }),
      crushDepth: P.crushDepth({ lowestPressurizedDR: dr, frame: d.structure.frame, submersibleHull: true }),
    };
  }

  // Aerial
  const totalStaticLift = staticLift + contragravLift;
  const hasLiftSurfaces = (sub.wings.present && sub.wings.type !== 'stub') || sub.rotors.present || feats.liftingBody;
  if (hasLiftSurfaces || totalStaticLift > 0) {
    let liftArea = (feats.liftingBody ? 0.3 : 0.1) * areas.body;
    if (sub.wings.present && sub.wings.type !== 'stub') {
      let wa = areas.wings;
      if (sub.wings.type === 'stol') wa *= 1.5;
      liftArea += wa;
    }
    if (sub.rotors.present) liftArea += areas.rotors * 3;

    const stall = P.stallSpeed({
      loadedLbs: loadedWeight, staticLift: totalStaticLift, liftArea,
      streamlining: d.streamlining, responsive: feats.responsive,
    });
    const retractable = (sub.turret.present && sub.turret.rotation.startsWith('pop') ? areas.turret : 0) +
      (sub.wheels.present && sub.wheels.retractable ? areas.wheels : 0);
    const exposed = 0;
    const drag = P.aeroDrag({
      totalAreaSf: totalArea, retractableAreaSf: retractable,
      streamlining: d.streamlining, responsive: feats.responsive, dragPenalty: exposed,
    });
    const caps = P.aerialSpeedCaps({
      streamlining: d.streamlining,
      rotorTL: sub.rotors.present ? sub.rotors.tl : null,
      metallicDR: ['metal', 'composite', 'laminate'].includes(ARMOR_TYPES[d.armor.type]?.group) ? dr : 0,
    });
    const speed = P.aerialTopSpeed({ thrustLbs: airThrust, drag: drag.value, caps });
    const stallZero = stall.mph === 0;
    const amr = P.aMR({
      stallZero, tl, sizeModifier: sm,
      wingRotorHP: (hp.perWing ? hp.perWing * 2 : 0) + (hp.rotor || 0),
      loadedLbs: loadedWeight,
      responsive: feats.responsive,
      electronicControls: controlsOpts.electronicControls,
      computerizedControls: controlsOpts.computerizedControls,
      liftingBodyNoWings: feats.liftingBody && !sub.wings.present,
      hasWingsOrRotors: (sub.wings.present && sub.wings.type !== 'stub') || sub.rotors.present,
    });
    const canFly = stallZero ||
      (perf.ground && perf.ground.topSpeed >= stall.mph) ||
      (perf.water && perf.water.topSpeed >= stall.mph);
    perf.aerial = {
      stallSpeed: stall.mph, drag: Math.round(drag.value), topSpeed: speed.mph,
      aAccel: P.aAccel({ thrustLbs: airThrust, loadedLbs: loadedWeight }).value,
      aMR: amr, aDecel: P.aDecel(amr),
      aSR: P.aSR({
        totalVolumeCf: totalVolume, tl,
        electronicControls: controlsOpts.electronicControls,
        computerizedControls: controlsOpts.computerizedControls,
        noWingsOrStubOnly: !sub.wings.present || sub.wings.type === 'stub',
        liftingBody: feats.liftingBody,
        multiplane: ['biplane', 'triplane'].includes(sub.wings.type),
      }),
      canFly,
      hover: stallZero && totalStaticLift >= loadedWeight,
      takeoffRun: (!stallZero && perf.ground && perf.ground.gAccel > 0)
        ? Math.round(P.takeoffRun(stall.mph, perf.ground.gAccel)) : null,
    };
    if (!canFly && airThrust > 0) {
      warnings.push(`Stall speed ${stall.mph} mph exceeds ground/water top speed — it cannot take off unaided.`);
    }
  }

  return {
    ok: errors.length === 0,
    errors, warnings,
    volumes: mapRound(volumes, r2),
    totalVolume: r2(totalVolume),
    areas: mapRound(areas, r1),
    totalArea: r1(totalArea),
    structuralArea: r1(structuralArea),
    structure: { weight: r1(structWeight), cost: Math.round(structCost) },
    armor: { weight: r1(armorWeight), cost: Math.round(armorCost), dr, pd },
    sealCost: Math.round(sealCost),
    hp,
    weights: {
      structure: r1(structWeight), armor: r1(armorWeight), components: r1(compWeight),
      masts: r1(mastWeight), gasbag: r1(gasbagWeight),
      empty: r1(emptyWeight), payload: r1(payload), fuel: r1(fuelWeight),
      loaded: r1(loadedWeight), loadedTons: r2(loadedTons),
      submerged: r1(submergedWeight),
    },
    power: { needed: r1(powerNeeded), available: r1(powerAvailable) },
    propulsion: { groundKw, aquaticThrust, airThrust, staticLift, contragravLift },
    flotation: r1(flotation),
    floats,
    stats: { sm, price: Math.round(price), ht },
    perf,
  };
}

function lookupTL(table, tl) {
  let best;
  for (const k of Object.keys(table)) {
    const key = Number(k);
    if (tl >= key && (best === undefined || key > best)) best = key;
  }
  return best === undefined ? 0 : table[best];
}

function mapRound(obj, f) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, f(v)]));
}
