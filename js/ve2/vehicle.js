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
  BODY_FACES, TURRET_FACES, SLOPE_DR_MULT, SLOPE_PD_BONUS,
  locationHP, mastVolume, pdFromDR, sizeModifier, slopeVolumeMult,
  structuralHT, structureTL, surfaceArea,
} from './tables.js';
import * as P from './performance.js';

export const BODY_FACE_KEYS = ['front', 'back', 'left', 'right', 'top', 'under'];
const SLOPEABLE_FACES = ['front', 'back', 'left', 'right'];

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
    armor: {
      type: 'metalStandard',
      mode: 'overall',          // 'overall' | 'facing'
      dr: 5,                    // overall mode
      faces: Object.fromEntries(BODY_FACE_KEYS.map((f) => [f, { dr: 5, slope: 0 }])),
      otherDr: 0,               // facing mode: DR on wheels/tracks/wings/etc.
    },
    subassemblies: {
      wheels: { present: true, type: 'standard', count: 4, retractable: false },
      tracks: { present: false },
      halftracks: { present: false },
      skids: { present: false },
      legs: { present: false, count: 2 },
      wings: { present: false, type: 'standard', volumeFrac: 0.1 },
      rotors: { present: false, tl: 7 },
      turrets: [],              // { volumeCf, rotation, slopeDegrees, dr }
      superstructures: [],      // { volumeCf, slopeDegrees, dr }
      masts: { present: false, heightFt: 30 },
      gasbag: { present: false, cf: 0 },
    },
    // Each component: { name, weight, cost, volume, kwIn, kwOut, groundKw,
    //   aquaticThrust, airThrust, staticLift, contragravLift, airBreathing,
    //   location: 'body' | 'wings' | 'turret0' | 'super0' | ..., note }
    components: [],
    crew: 1,
    passengers: 0,
    cargoCf: 0,
    emptySpaceCf: 0,
    fuel: { type: 'gasoline', gallons: 0 },
    hardpoints: { count: 0, loadLbs: 0 },
    options: {
      improvedSuspension: false, improvedBrakes: false, allWheelSteering: false,
      allWheelDrive: false, smartwheels: false, rollStabilizers: false,
    },
  };
}

// Migrate older saved designs (single `turret` object, `bodySlopeDegrees`).
export function migrateVe2Design(d) {
  const next = structuredClone(d);
  const sub = next.subassemblies || {};
  if (sub.turret && !sub.turrets) {
    sub.turrets = sub.turret.present
      ? [{ volumeCf: sub.turret.volumeCf, rotation: sub.turret.rotation, slopeDegrees: sub.turret.slopeDegrees || 0, dr: next.armor?.dr ?? 0 }]
      : [];
    delete sub.turret;
    next.components = (next.components || []).map((c) => c.location === 'turret' ? { ...c, location: 'turret0' } : c);
  }
  if (next.bodySlopeDegrees && next.armor && !next.armor.faces) {
    // old designs stored a single body slope; spread it onto the front face
    next.armor.faces = defaultVe2Design().armor.faces;
    next.armor.faces.front.slope = Math.min(next.bodySlopeDegrees, 60);
  }
  return next;
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
  const turrets = sub.turrets || [];
  const supers = sub.superstructures || [];

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

  // Turrets (attached to the body; rotation space occupies the body).
  let turretRotSpace = 0;
  const turretVolumes = turrets.map((t, i) => {
    const inTurret = volInLocation(`turret${i}`);
    const vol = Math.max(n(t.volumeCf), inTurret) * slopeVolumeMult(n(t.slopeDegrees));
    if (inTurret > n(t.volumeCf)) warnings.push(`Turret ${i + 1} volume raised to ${r2(inTurret)} cf to fit its components.`);
    turretRotSpace += vol * (TURRET_ROTATION_SPACE[t.rotation] ?? 0.2);
    return vol;
  });

  // Superstructures (no rotation space).
  const superVolumes = supers.map((s, i) => {
    const inSuper = volInLocation(`super${i}`);
    const vol = Math.max(n(s.volumeCf), inSuper) * slopeVolumeMult(n(s.slopeDegrees));
    if (inSuper > n(s.volumeCf)) warnings.push(`Superstructure ${i + 1} volume raised to ${r2(inSuper)} cf to fit its components.`);
    return vol;
  });

  // Body slope comes from the sloped armor faces (facing mode only).
  const bodySlopeDegrees = d.armor.mode === 'facing'
    ? SLOPEABLE_FACES.reduce((a, f) => a + n(d.armor.faces?.[f]?.slope), 0)
    : 0;

  const bodyComponents = volInLocation('body') + n(d.cargoCf) + n(d.emptySpaceCf) + turretRotSpace;
  let bodyVolume = bodyComponents * slopeVolumeMult(bodySlopeDegrees);
  bodyVolume *= STREAMLINING[d.streamlining]?.bodyVolume ?? 1;
  if (feats.submersibleHull) bodyVolume *= BODY_VOLUME_MULTS.submersibleHull;
  bodyVolume *= HYDRO_LINES[feats.hydroLines]?.bodyVolume ?? 1;
  if (feats.catamaran || feats.trimaran) bodyVolume *= BODY_VOLUME_MULTS.catamaran;
  if (sub.wheels.present && sub.wheels.retractable) bodyVolume *= BODY_VOLUME_MULTS.retractIntoBody;

  if (bodyVolume <= 0) errors.push('The body has no volume — add components, cargo space or empty space.');
  const attachedVolume = turretVolumes.reduce((a, v) => a + v, 0) + superVolumes.reduce((a, v) => a + v, 0);
  if (attachedVolume > bodyVolume && bodyVolume > 0) {
    warnings.push('Combined turret/superstructure volume exceeds the body volume — add empty space to the body.');
  }

  // Other subassemblies
  const volumes = { body: bodyVolume };
  turretVolumes.forEach((v, i) => { volumes[`turret${i}`] = v; });
  superVolumes.forEach((v, i) => { volumes[`super${i}`] = v; });
  if (sub.wheels.present) {
    const frac = sub.wheels.retractable || sub.wheels.type === 'small' ? SUBASSEMBLY_VOLUME.wheelsSmall
      : ['heavy', 'offroad', 'railway'].includes(sub.wheels.type) ? SUBASSEMBLY_VOLUME.wheelsHeavy
        : SUBASSEMBLY_VOLUME.wheelsStandard;
    volumes.wheels = frac * bodyVolume;
  }
  if (sub.tracks.present) volumes.tracks = SUBASSEMBLY_VOLUME.tracks * bodyVolume;
  if (sub.halftracks.present) volumes.halftracks = SUBASSEMBLY_VOLUME.halftrack * bodyVolume;
  if (sub.skids.present) volumes.skids = SUBASSEMBLY_VOLUME.skids * bodyVolume;
  if (sub.legs?.present) volumes.legs = 0.4 * bodyVolume; // combined minimum for all legs
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
    if (key === 'legs') {
      const count = Math.max(Math.floor(sub.legs.count) || 2, 2);
      areas.legs = surfaceArea(vol / count) * count; // per-leg areas, summed
      continue;
    }
    let area = surfaceArea(vol);
    if (key === 'wings' && sub.wings.type !== 'stub') area *= WING_AREA_MULT[sub.wings.type] ?? 1.5;
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

  let mastWeight = 0;
  let mastCost = 0;
  if (sub.masts.present) {
    mastWeight = areas.masts * lookupTL(MAST_OPEN_MOUNT.weightBySf, tl);
    mastCost = areas.masts * MAST_OPEN_MOUNT.costPerSf;
  }
  let gasbagWeight = 0;
  let gasbagCost = 0;
  if (sub.gasbag.present) {
    gasbagWeight = areas.gasbag * lookupTL(GASBAG.weightBySf, tl);
    gasbagCost = areas.gasbag * lookupTL(GASBAG.costBySf, tl);
  }

  // --- Armor ---------------------------------------------------------------
  const armorType = ARMOR_TYPES[d.armor.type];
  const armorMod = armorWeightMod(d.armor.type, tl);
  const metallic = ['metal', 'composite', 'laminate'].includes(armorType?.group);
  let armorWeight = 0;
  let armorCost = 0;
  const armorFaces = {};   // facing mode: effective DR & PD per body face
  let bodyMinDR = 0;
  let overallPD = 0;

  const anyArmorWanted = d.armor.mode === 'overall'
    ? n(d.armor.dr) > 0
    : BODY_FACE_KEYS.some((f) => n(d.armor.faces?.[f]?.dr) > 0);

  if (anyArmorWanted && armorMod === null) {
    errors.push(`${armorType?.name || d.armor.type} armor is not available at TL ${tl}.`);
  } else if (d.armor.mode === 'overall') {
    const dr = Math.max(Math.floor(n(d.armor.dr)), 0);
    bodyMinDR = dr;
    if (dr > 0) {
      armorWeight = structuralArea * armorMod * dr; // covers everything
      armorCost = armorWeight * armorType.costPerLb;
      overallPD = clampPD(pdFromDR(dr), armorType);
    }
  } else {
    // Facing armor on the body: each face is 1/6 of the body area.
    const faceArea = areas.body / BODY_FACES;
    bodyMinDR = Infinity;
    for (const face of BODY_FACE_KEYS) {
      const f = d.armor.faces?.[face] || { dr: 0, slope: 0 };
      const dr = Math.max(Math.floor(n(f.dr)), 0);
      const slope = SLOPEABLE_FACES.includes(face) ? (n(f.slope) === 60 ? 60 : n(f.slope) === 30 ? 30 : 0) : 0;
      const w = faceArea * armorMod * dr;
      armorWeight += w;
      armorCost += w * (armorType?.costPerLb ?? 0);
      const effDR = Math.round(dr * (SLOPE_DR_MULT[slope] ?? 1));
      let pd = clampPD(pdFromDR(dr), armorType);
      if (slope && metallic && dr > 0) pd = Math.min(pd + SLOPE_PD_BONUS[slope], 6);
      armorFaces[face] = { dr, effDR, slope, pd };
      bodyMinDR = Math.min(bodyMinDR, dr);
    }
    if (!isFinite(bodyMinDR)) bodyMinDR = 0;
    // Turrets & superstructures: own overall DR over their whole area.
    turrets.forEach((t, i) => {
      const dr = Math.max(Math.floor(n(t.dr)), 0);
      if (dr > 0) {
        const w = (areas[`turret${i}`] || 0) * armorMod * dr;
        armorWeight += w;
        armorCost += w * armorType.costPerLb;
      }
    });
    supers.forEach((s, i) => {
      const dr = Math.max(Math.floor(n(s.dr)), 0);
      if (dr > 0) {
        const w = (areas[`super${i}`] || 0) * armorMod * dr;
        armorWeight += w;
        armorCost += w * armorType.costPerLb;
      }
    });
    // Optional armor over the remaining subassemblies (wheels, wings, ...).
    const otherDr = Math.max(Math.floor(n(d.armor.otherDr)), 0);
    if (otherDr > 0) {
      const otherArea = structuralArea - areas.body -
        turrets.reduce((a, _, i) => a + (areas[`turret${i}`] || 0), 0) -
        supers.reduce((a, _, i) => a + (areas[`super${i}`] || 0), 0);
      const w = Math.max(otherArea, 0) * armorMod * otherDr;
      armorWeight += w;
      armorCost += w * armorType.costPerLb;
    }
    if (sub.rotors.present && otherDr > 0 && otherDr < 5) warnings.push('Rotors must have at least DR 5.');
  }

  if (!anyArmorWanted && (feats.flotationHull || feats.submersibleHull || d.streamlining !== 'none' || sub.rotors.present)) {
    warnings.push('Vehicles with a flotation/submersible hull, streamlining or rotors must have at least some armor.');
  }
  if (d.armor.mode === 'overall' && bodySlopeDegrees === 0 &&
    BODY_FACE_KEYS.some((f) => n(d.armor.faces?.[f]?.slope) > 0)) {
    warnings.push('Sloped faces require facing armor mode.');
  }

  // --- Sealing -------------------------------------------------------------
  let sealCost = 0;
  if (feats.submersibleHull) {
    // Submersible includes sealed & waterproof at no extra cost.
  } else if (feats.sealed) {
    sealCost = structuralArea * lookupTL(SEALED_COST_PER_SF, Math.max(tl, 5));
    if (bodyMinDR < 1) warnings.push('A sealed vehicle requires DR 1+ over the entire body.');
  } else if (feats.waterproofed || feats.flotationHull) {
    sealCost = structuralArea * WATERPROOF_COST_PER_SF;
  }

  // --- Hit points ----------------------------------------------------------
  const frameKey = d.structure.frame;
  const hp = { body: locationHP(areas.body, HP_FACTORS.body, frameKey) };
  turrets.forEach((_, i) => { hp[`turret${i + 1}`] = locationHP(areas[`turret${i}`], HP_FACTORS.turret, frameKey); });
  supers.forEach((_, i) => { hp[`superstructure${i + 1}`] = locationHP(areas[`super${i}`], HP_FACTORS.superstructure, frameKey); });
  if (sub.wheels.present) hp.perWheel = locationHP(areas.wheels, HP_FACTORS.wheel, frameKey, Math.max(sub.wheels.count, 1));
  if (sub.tracks.present) hp.perTrack = locationHP(areas.tracks, HP_FACTORS.track, frameKey, 2);
  if (sub.halftracks.present) hp.perTrack = locationHP(areas.halftracks, HP_FACTORS.track, frameKey, 2);
  if (sub.skids.present) hp.perSkid = locationHP(areas.skids, HP_FACTORS.skid, frameKey, 2);
  if (sub.legs?.present) hp.perLeg = locationHP(areas.legs / Math.max(sub.legs.count, 2), HP_FACTORS.leg, frameKey);
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
  const hardpointLoad = Math.max(n(d.hardpoints?.loadLbs), 0);
  const hardpointCount = Math.max(Math.floor(n(d.hardpoints?.count)), 0);
  const loadedWithStores = loadedWeight + hardpointLoad;

  // --- Statistics ----------------------------------------------------------
  const sm = sizeModifier(totalVolume);
  const price = structCost + armorCost + compCost + mastCost + gasbagCost + sealCost;
  // With hardpoints, HT always uses the weight with stores loaded.
  const ht = structuralHT(hp.body, hardpointLoad > 0 ? loadedWithStores : loadedWeight, tl);

  const lines = HYDRO_LINES[feats.hydroLines] || HYDRO_LINES.none;
  const flotationPerCf = feats.submersibleHull ? FLOTATION_SUBMERSIBLE : lines.flotation;
  const flotationVolume = feats.submersibleHull
    ? bodyVolume + turretVolumes.reduce((a, v) => a + v, 0) + superVolumes.reduce((a, v) => a + v, 0)
    : bodyVolume;
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
  else if (sub.legs?.present) groundSystem = `legs${Math.min(Math.max(sub.legs.count, 2), 4) === 3 ? 3 : sub.legs.count >= 4 ? 4 : 2}`;
  else if (sub.skids.present) groundSystem = 'skids';

  const computeGround = (tons) => {
    const speed = P.groundSpeed({
      system: groundSystem.startsWith('legs') ? groundSystem : groundSystem, tl,
      motivePowerKw: groundKw,
      auxThrustLbs: airThrust,
      loadedTons: tons, streamlining: d.streamlining,
      opts: { improvedSuspension: opts.improvedSuspension, railway: sub.wheels.type === 'railway' },
    });
    const acc = P.gAccel({ topSpeed: speed.mph, sf: speed.sf, system: groundSystem, legs: sub.legs?.count || 0 });
    return { speed, acc };
  };

  if (groundSystem) {
    const { speed, acc } = computeGround(loadedTons);
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
    const subareaKey = groundSystem.startsWith('legs') ? 'legs' : groundSystem;
    const area = P.contactArea({
      system: groundSystem, subassemblyArea: areas[subareaKey] || 0, tl, wheelType: sub.wheels.type,
    });
    const category = groundSystem.startsWith('legs') ? 1
      : groundSystem === 'tracks' ? 2
        : (groundSystem === 'halftracks' || (groundSystem === 'wheels' && opts.allWheelDrive)) ? 3 : 4;
    const gp = P.groundPressure({ loadedLbs: loadedWeight, contragravLift, area, category });
    perf.ground = {
      system: groundSystem, topSpeed: speed.mph, sf: speed.sf,
      gAccel: acc.value, gDecel: dec, gMR: mrsr.gMR, gSR: mrsr.gSR,
      groundPressure: Math.round(gp.gp), gpLabel: gp.label,
      offRoad: gp.offRoadFraction,
    };
    if (hardpointLoad > 0) {
      perf.ground.topSpeedWithStores = computeGround(loadedWithStores / 2000).speed.mph;
    }
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
      crushDepth: P.crushDepth({ lowestPressurizedDR: bodyMinDR, frame: d.structure.frame, submersibleHull: true }),
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

    const popTurretArea = turrets.reduce((a, t, i) => a + (String(t.rotation).startsWith('pop') ? (areas[`turret${i}`] || 0) : 0), 0);
    const retractable = popTurretArea + (sub.wheels.present && sub.wheels.retractable ? areas.wheels : 0);

    const metallicDR = metallic ? bodyMinDR : 0;
    const caps = P.aerialSpeedCaps({
      streamlining: d.streamlining,
      rotorTL: sub.rotors.present ? sub.rotors.tl : null,
      metallicDR,
    });

    const computeAir = (lbs, storesLoaded) => {
      const stall = P.stallSpeed({
        loadedLbs: lbs, staticLift: totalStaticLift, liftArea,
        streamlining: d.streamlining, responsive: feats.responsive,
      });
      const drag = P.aeroDrag({
        totalAreaSf: totalArea, retractableAreaSf: retractable,
        streamlining: d.streamlining, responsive: feats.responsive,
        dragPenalty: storesLoaded ? 5 * hardpointCount : 0,
      });
      const speed = P.aerialTopSpeed({ thrustLbs: airThrust, drag: drag.value, caps });
      return { stall, drag, speed };
    };

    const { stall, drag, speed } = computeAir(loadedWeight, false);
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
    if (hardpointLoad > 0) {
      const loaded = computeAir(loadedWithStores, true);
      perf.aerial.withStores = {
        stallSpeed: loaded.stall.mph,
        topSpeed: loaded.speed.mph,
        aAccel: P.aAccel({ thrustLbs: airThrust, loadedLbs: loadedWithStores }).value,
      };
    }
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
    armor: {
      weight: r1(armorWeight), cost: Math.round(armorCost),
      mode: d.armor.mode,
      dr: d.armor.mode === 'overall' ? Math.max(Math.floor(n(d.armor.dr)), 0) : null,
      pd: d.armor.mode === 'overall' ? overallPD : null,
      faces: d.armor.mode === 'facing' ? armorFaces : null,
      bodyMinDR,
    },
    sealCost: Math.round(sealCost),
    hp,
    weights: {
      structure: r1(structWeight), armor: r1(armorWeight), components: r1(compWeight),
      masts: r1(mastWeight), gasbag: r1(gasbagWeight),
      empty: r1(emptyWeight), payload: r1(payload), fuel: r1(fuelWeight),
      loaded: r1(loadedWeight), loadedTons: r2(loadedTons),
      loadedWithStores: hardpointLoad > 0 ? r1(loadedWithStores) : null,
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

function clampPD(pd, type) {
  if (!type) return pd;
  if (type.group === 'wood') return Math.min(pd, 3);
  if (type.group === 'nonrigid') return Math.min(pd, 2);
  return pd;
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
