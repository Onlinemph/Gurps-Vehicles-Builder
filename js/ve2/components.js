// ---------------------------------------------------------------------------
// Built-in component catalog for the VE2 designer.
//
// Each entry is a parameterized generator implementing the design formulas of
// GURPS Vehicles 2e (weight/cost/volume/power per kW, per gallon, per mile of
// range, etc.). Pick one, set its size, and it produces a ready-to-add
// component — no GVB data files or hand-typed numbers needed.
//
// Conventions: volumes assume no access space (multiply ×2/×3 yourself for
// short/long-term maintenance access). tl() lookups clamp to the entry's
// TL range.
// ---------------------------------------------------------------------------

function byTL(table, tl) {
  let best;
  for (const k of Object.keys(table)) {
    const key = Number(k);
    if (tl >= key && (best === undefined || key > best)) best = key;
  }
  return best === undefined ? undefined : table[best];
}

// Small-unit rule: below 5 kW, weight is simply smallRate × kW; at 5 kW and
// up it's rate × kW + base (the book's standard engine/drivetrain shape).
const scaled = (kw, smallRate, rate, base) => kw < 5 ? smallRate * kw : rate * kw + base;

export const COMPONENT_CATALOG = [
  // ===================== POWER PLANTS =====================
  {
    key: 'gasoline', category: 'Power plants', name: 'Gasoline engine', minTL: 5, maxTL: 7,
    help: 'The classic internal-combustion engine: cheap, reasonably light, burns flammable gasoline.',
    params: [{ key: 'kw', label: 'kW output', def: 50, min: 1 }],
    options: [{ key: 'turbo', label: 'turbo/supercharger', minTL: 6, help: 'Lighter per kW, double cost.' }],
    generate({ kw }, tl, o) {
      const weight = o.turbo && tl >= 6
        ? (kw < 5 ? byTL({ 6: 8.5, 7: 8 }, tl) * kw : byTL({ 6: 4.5, 7: 4 }, tl) * kw + 20)
        : scaled(kw, byTL({ 5: 40, 6: 12, 7: 10 }, tl), byTL({ 5: 20, 6: 6, 7: 5 }, tl), byTL({ 5: 100, 6: 30, 7: 25 }, tl));
      return {
        name: `gasoline engine, ${kw} kW${o.turbo ? ' (turbo)' : ''}`,
        weight, cost: weight * byTL({ 5: 1, 6: 2, 7: 5 }, tl) * (o.turbo ? 2 : 1),
        volume: weight * 0.02, kwOut: kw,
        fuelGph: kw * byTL({ 5: 0.06, 6: 0.045, 7: 0.04 }, tl),
        airBreathing: true,
      };
    },
  },
  {
    key: 'diesel', category: 'Power plants', name: 'Diesel engine', minTL: 6, maxTL: 7,
    help: 'Heavier than gasoline but its fuel barely burns — the military and marine standard.',
    params: [{ key: 'kw', label: 'kW output', def: 100, min: 1 }],
    options: [{ key: 'turbo', label: 'turbo/supercharger', minTL: 7 }],
    generate({ kw }, tl, o) {
      const weight = tl >= 7
        ? (o.turbo ? scaled(kw, 12, 6, 30) : scaled(kw, 14, 8, 30))
        : scaled(kw, 20, 12, 40);
      return {
        name: `diesel engine, ${kw} kW${o.turbo ? ' (turbo)' : ''}`,
        weight, cost: weight * byTL({ 6: 2, 7: 4 }, tl) * (o.turbo ? 1.5 : 1),
        volume: weight * 0.02, kwOut: kw,
        fuelGph: kw * byTL({ 6: 0.04, 7: 0.035 }, tl),
        airBreathing: true,
      };
    },
  },
  {
    key: 'gasTurbine', category: 'Power plants', name: 'Gas turbine', minTL: 7, maxTL: 8,
    help: 'Very light for its power and very thirsty — helicopters, tanks, fast ships.',
    params: [{ key: 'kw', label: 'kW output', def: 500, min: 1 }],
    generate({ kw }, tl) {
      const weight = scaled(kw, byTL({ 7: 10, 8: 4 }, tl), byTL({ 7: 2, 8: 1 }, tl), byTL({ 7: 40, 8: 15 }, tl));
      return {
        name: `gas turbine, ${kw} kW`,
        weight, cost: weight * byTL({ 7: 20, 8: 30 }, tl),
        volume: weight * 0.02, kwOut: kw,
        fuelGph: kw * byTL({ 7: 0.06, 8: 0.055 }, tl),
        airBreathing: true,
      };
    },
  },
  {
    key: 'hpGasTurbine', category: 'Power plants', name: 'High-performance gas turbine', minTL: 7, maxTL: 8,
    help: 'Aerospace-grade turbine: half the weight again, over double the price.',
    params: [{ key: 'kw', label: 'kW output', def: 500, min: 1 }],
    generate({ kw }, tl) {
      const weight = scaled(kw, byTL({ 7: 4, 8: 2.5 }, tl), byTL({ 7: 1, 8: 0.5 }, tl), byTL({ 7: 15, 8: 10 }, tl));
      return {
        name: `HP gas turbine, ${kw} kW`,
        weight, cost: weight * byTL({ 7: 50, 8: 80 }, tl),
        volume: weight * 0.02, kwOut: kw,
        fuelGph: kw * byTL({ 7: 0.07, 8: 0.06 }, tl),
        airBreathing: true,
      };
    },
  },
  {
    key: 'steam', category: 'Power plants', name: 'Steam engine (double expansion)', minTL: 5,
    help: 'Massive TL5 machinery burning coal or wood. Fuel figure is coal; wood burns 4× as fast.',
    params: [{ key: 'kw', label: 'kW output', def: 20, min: 1 }],
    generate({ kw }) {
      const weight = scaled(kw, 112, 56, 280);
      return {
        name: `steam engine, ${kw} kW`,
        weight, cost: weight * 0.6, volume: weight * 0.02, kwOut: kw,
        fuelGph: kw * 0.04, airBreathing: true, note: 'coal-fired',
      };
    },
  },
  {
    key: 'fuelCell', category: 'Power plants', name: 'Fuel cell', minTL: 7, maxTL: 9,
    help: 'Silently converts hydrogen to electricity — no moving parts, no flame.',
    params: [{ key: 'kw', label: 'kW output', def: 50, min: 1 }],
    generate({ kw }, tl) {
      const weight = scaled(kw, byTL({ 7: 20, 8: 10 }, tl), byTL({ 7: 10, 8: 5 }, tl), byTL({ 7: 50, 8: 25 }, tl));
      return {
        name: `fuel cell, ${kw} kW`,
        weight, cost: Math.max(weight * byTL({ 7: 20, 8: 5 }, tl), 500),
        volume: weight * 0.02, kwOut: kw,
        fuelGph: kw * byTL({ 7: 0.15, 8: 0.13, 9: 0.115 }, tl),
        note: 'burns hydrogen',
      };
    },
  },
  {
    key: 'fission', category: 'Power plants', name: 'Fission reactor', minTL: 7, maxTL: 10,
    help: 'A shielded nuclear pile: enormous minimum weight, years of fuel.',
    params: [{ key: 'kw', label: 'kW output', def: 5000, min: 1 }],
    generate({ kw }, tl) {
      const weight = kw * byTL({ 7: 8, 8: 4, 9: 1 }, tl) + byTL({ 7: 20000, 8: 4000, 9: 1000 }, tl);
      const cost = Math.max(weight * byTL({ 7: 200, 8: 100, 9: 40, 10: 20 }, tl) + byTL({ 7: 400000, 8: 200000, 9: 40000, 10: 0 }, tl), 20000);
      return { name: `fission reactor, ${kw} kW`, weight, cost, volume: weight * 0.02, kwOut: kw, note: 'refuel every few years' };
    },
  },
  {
    key: 'fusion', category: 'Power plants', name: 'Fusion reactor', minTL: 9, maxTL: 11,
    help: 'Clean superscience power — effectively unlimited endurance.',
    params: [{ key: 'kw', label: 'kW output', def: 10000, min: 1 }],
    generate({ kw }, tl) {
      const weight = kw * byTL({ 9: 1, 10: 0.2 }, tl) + byTL({ 9: 20000, 10: 2000 }, tl);
      const cost = Math.max(weight * byTL({ 9: 200, 10: 50, 11: 25 }, tl) + byTL({ 9: 1000000, 10: 200000, 11: 100000 }, tl), 20000);
      return { name: `fusion reactor, ${kw} kW`, weight, cost, volume: weight * 0.02, kwOut: kw, note: 'unlimited fuel' };
    },
  },
  {
    key: 'leadAcid', category: 'Power plants', name: 'Lead-acid battery', minTL: 5, maxTL: 7,
    help: 'Stored energy in kWs (kilowatt-seconds): divide by a device’s kW draw for seconds of operation.',
    params: [{ key: 'kws', label: 'kWs stored', def: 2000, min: 1 }],
    generate({ kws }, tl) {
      const weight = kws * byTL({ 5: 0.03, 6: 0.025, 7: 0.02 }, tl);
      return {
        name: `lead-acid battery, ${kws} kWs`,
        weight, cost: weight * byTL({ 5: 0.25, 6: 0.5, 7: 1.25 }, tl),
        volume: weight / 200, note: `${Math.round(kws / 36) / 100} kWh stored`,
      };
    },
  },
  {
    key: 'advBattery', category: 'Power plants', name: 'Advanced battery', minTL: 7,
    help: 'High-density cells: 6-30× the storage per pound of lead-acid.',
    params: [{ key: 'kws', label: 'kWs stored', def: 20000, min: 1 }],
    generate({ kws }, tl) {
      const weight = kws * (tl >= 8 ? 0.001 : 0.005);
      return {
        name: `advanced battery, ${kws} kWs`,
        weight, cost: weight * (tl >= 8 ? 30 : 10),
        volume: weight / (tl >= 8 ? 50 : 100), note: `${Math.round(kws / 36) / 100} kWh stored`,
      };
    },
  },

  // ===================== DRIVETRAINS & PROPULSION =====================
  {
    key: 'wheeledDT', category: 'Drivetrains & propulsion', name: 'Wheeled drivetrain', minTL: 5, maxTL: 8,
    help: 'Transmission, axles and differentials feeding the wheels. Its kW is what actually sets ground speed.',
    params: [{ key: 'kw', label: 'kW motive power', def: 50, min: 1 }],
    options: [{ key: 'awd', label: 'all-wheel drive', help: 'Heavier and pricier; hugely better off-road (pair with the AWD option below).' }],
    generate({ kw }, tl, o) {
      let weight = scaled(kw, byTL({ 5: 20, 6: 10, 7: 7.5, 8: 5 }, tl), byTL({ 5: 4, 6: 2, 7: 1.5, 8: 1 }, tl), byTL({ 5: 80, 6: 40, 7: 30, 8: 20 }, tl));
      if (o.awd) weight *= byTL({ 5: 1.5, 7: 4 / 3, 8: 1.5 }, tl);
      return {
        name: `wheeled drivetrain, ${kw} kW${o.awd ? ' (AWD)' : ''}`,
        weight, cost: weight * byTL({ 5: 2, 6: 4, 7: 10 }, tl) * (o.awd ? 2 : 1),
        volume: weight / 50, kwIn: kw, groundKw: kw,
      };
    },
  },
  {
    key: 'trackedDT', category: 'Drivetrains & propulsion', name: 'Tracked drivetrain', minTL: 6, maxTL: 8,
    help: 'Final drives and sprockets for tracks — heavier than a wheeled drivetrain per kW.',
    params: [{ key: 'kw', label: 'kW motive power', def: 300, min: 1 }],
    generate({ kw }, tl) {
      const weight = scaled(kw, byTL({ 6: 30, 7: 20, 8: 15 }, tl), byTL({ 6: 6, 7: 4, 8: 3 }, tl), byTL({ 6: 120, 7: 80, 8: 60 }, tl));
      return {
        name: `tracked drivetrain, ${kw} kW`,
        weight, cost: weight * byTL({ 6: 10, 7: 20 }, tl),
        volume: weight / 50, kwIn: kw, groundKw: kw,
      };
    },
  },
  {
    key: 'leggedDT', category: 'Drivetrains & propulsion', name: 'Legged drivetrain', minTL: 7,
    help: 'Actuators and gearing for walking legs. Two-legged designs pay 4× cost for the balance problem.',
    params: [{ key: 'kw', label: 'kW motive power', def: 100, min: 1 }, { key: 'legs', label: 'number of legs', def: 2, min: 2 }],
    generate({ kw, legs }, tl) {
      const weight = scaled(kw,
        byTL({ 7: 80, 8: 60, 9: 40, 10: 30, 11: 20, 12: 15 }, tl),
        byTL({ 7: 8, 8: 6, 9: 4, 10: 3, 11: 2, 12: 1 }, tl),
        byTL({ 7: 360, 8: 270, 9: 180, 10: 135, 11: 90, 12: 70 }, tl));
      const legMult = legs === 2 ? 4 : legs === 3 ? 2 : 1;
      return {
        name: `legged drivetrain, ${kw} kW (${legs} legs)`,
        weight, cost: weight * 50 * legMult,
        volume: weight / 50, kwIn: kw, groundKw: kw,
      };
    },
  },
  {
    key: 'heliDT', category: 'Drivetrains & propulsion', name: 'Helicopter drivetrain (TTR)', minTL: 6, maxTL: 8,
    help: 'Main rotor, tail rotor and gearbox: 10 lbs of lift and 1.6 lbs of thrust per kW. Requires the Rotors subassembly.',
    params: [{ key: 'kw', label: 'kW motive power', def: 500, min: 1 }],
    generate({ kw }, tl) {
      const weight = scaled(kw, byTL({ 6: 7, 7: 5.5, 8: 3.3 }, tl), byTL({ 6: 1, 7: 0.5, 8: 0.3 }, tl), byTL({ 6: 30, 7: 25, 8: 15 }, tl));
      return {
        name: `helicopter drivetrain, ${kw} kW`,
        weight, cost: weight * 25, volume: weight / 50,
        kwIn: kw, airThrust: kw * 1.6, staticLift: kw * 10,
      };
    },
  },
  {
    key: 'aerialProp', category: 'Drivetrains & propulsion', name: 'Aerial propeller', minTL: 5, maxTL: 7,
    help: 'A propeller converting engine power to thrust: 2.5-3.5 lbs per kW by TL.',
    params: [{ key: 'kw', label: 'kW absorbed', def: 150, min: 1 }],
    generate({ kw }, tl) {
      const weight = scaled(kw, byTL({ 5: 6, 6: 4 }, tl), byTL({ 5: 0.6, 6: 0.4 }, tl), byTL({ 5: 27, 6: 18 }, tl));
      return {
        name: `aerial propeller, ${kw} kW`,
        weight, cost: weight * (tl <= 6 ? 5 : 20), volume: 0,
        kwIn: kw, airThrust: kw * byTL({ 5: 2.5, 6: 3, 7: 3.5 }, tl),
      };
    },
  },
  {
    key: 'screwProp', category: 'Drivetrains & propulsion', name: 'Screw propeller', minTL: 5,
    help: 'A ship’s screw: 10-15 lbs of water thrust per kW.',
    params: [{ key: 'kw', label: 'kW absorbed', def: 200, min: 1 }],
    generate({ kw }, tl) {
      const weight = tl >= 6 ? scaled(kw, 25, 5, 100) : scaled(kw, 50, 10, 200);
      return {
        name: `screw propeller, ${kw} kW`,
        weight, cost: weight * 10, volume: weight / 50,
        kwIn: kw, aquaticThrust: kw * (tl >= 6 ? 15 : 10),
      };
    },
  },
  {
    key: 'hydrojet', category: 'Drivetrains & propulsion', name: 'Hydrojet', minTL: 5, maxTL: 8,
    help: 'A water jet — no exposed propeller, great for shallow water and jet-skis.',
    params: [{ key: 'kw', label: 'kW absorbed', def: 150, min: 1 }],
    generate({ kw }, tl) {
      const weight = scaled(kw, byTL({ 5: 100, 7: 10, 8: 5 }, tl), byTL({ 5: 20, 7: 2, 8: 1 }, tl), byTL({ 5: 400, 7: 40, 8: 20 }, tl));
      return {
        name: `hydrojet, ${kw} kW`,
        weight, cost: weight * 40, volume: weight / 50,
        kwIn: kw, aquaticThrust: kw * byTL({ 5: 7, 7: 12, 8: 20 }, tl),
      };
    },
  },
  {
    key: 'paddle', category: 'Drivetrains & propulsion', name: 'Paddle wheel', minTL: 5,
    help: 'The riverboat classic: bulky, romantic, 8 lbs of thrust per kW.',
    params: [{ key: 'kw', label: 'kW absorbed', def: 50, min: 1 }],
    generate({ kw }) {
      const weight = kw < 5 ? 125 * kw : 25 * kw + 500;
      return { name: `paddle wheel, ${kw} kW`, weight, cost: weight * 4, volume: weight / 50, kwIn: kw, aquaticThrust: kw * 8 };
    },
  },
  {
    key: 'turbojet', category: 'Drivetrains & propulsion', name: 'Turbojet', minTL: 6, maxTL: 7,
    help: 'An early jet engine, rated directly in pounds of thrust. Thirsty.',
    params: [{ key: 'thrust', label: 'lbs thrust', def: 4000, min: 10 }],
    generate({ thrust }, tl) {
      const weight = thrust * byTL({ 6: 0.3, 7: 0.15 }, tl) + byTL({ 6: 500, 7: 150 }, tl);
      return {
        name: `turbojet, ${thrust} lbs thrust`,
        weight, cost: weight * 50, volume: weight / 50,
        airThrust: thrust, fuelGph: thrust * byTL({ 6: 0.1, 7: 0.045 }, tl),
        airBreathing: true,
      };
    },
  },
  {
    key: 'turbofan', category: 'Drivetrains & propulsion', name: 'Turbofan', minTL: 7, maxTL: 8,
    help: 'The modern airliner/fighter engine: quieter and far more efficient than a turbojet.',
    params: [{ key: 'thrust', label: 'lbs thrust', def: 8000, min: 10 }],
    generate({ thrust }, tl) {
      const weight = thrust * byTL({ 7: 0.2, 8: 0.1 }, tl) + byTL({ 7: 200, 8: 100 }, tl);
      return {
        name: `turbofan, ${thrust} lbs thrust`,
        weight, cost: weight * 50, volume: weight / 50,
        airThrust: thrust, fuelGph: thrust * byTL({ 7: 0.03, 8: 0.015 }, tl),
        airBreathing: true,
      };
    },
  },
  {
    key: 'rocket', category: 'Drivetrains & propulsion', name: 'Liquid-fuel rocket', minTL: 6, maxTL: 8,
    help: 'Featherweight thrust that works in vacuum — and devours rocket fuel in minutes.',
    params: [{ key: 'thrust', label: 'lbs thrust', def: 10000, min: 10 }],
    generate({ thrust }, tl) {
      const weight = thrust * byTL({ 6: 0.015, 7: 0.012, 8: 0.01 }, tl);
      return {
        name: `rocket engine, ${thrust} lbs thrust`,
        weight, cost: weight * 25, volume: weight * 0.02,
        airThrust: thrust, fuelGph: thrust * byTL({ 6: 1.5, 7: 1.25, 8: 1.1 }, tl),
        note: 'burns rocket fuel; works in vacuum',
      };
    },
  },

  // ===================== CREW & ACCOMMODATIONS =====================
  {
    key: 'crewStation', category: 'Crew & accommodations', name: 'Crew station', minTL: 0,
    help: 'A working position with seat, controls and instruments. One per crew member.',
    params: [{ key: 'count', label: 'stations', def: 1, min: 1 }],
    options: [
      { key: 'cramped', label: 'cramped (20 cf)', help: 'Tank-crew squeeze: -1 DX on work.' },
      { key: 'roomy', label: 'roomy (40 cf)', help: 'Comfortable long-shift workspace.' },
      { key: 'ejection', label: 'ejection seat', help: '+100 lbs, +$50,000, +5 cf per station.' },
      { key: 'airbag', label: 'air bag' }, { key: 'crashweb', label: 'crash web' },
    ],
    generate({ count }, tl, o) {
      const size = o.cramped ? { w: 20, v: 20, tag: 'cramped' } : o.roomy ? { w: 40, v: 40, tag: 'roomy' } : { w: 30, v: 30, tag: '' };
      let weight = size.w, vol = size.v, cost = 100;
      if (o.ejection) { weight += 100; cost += 50000; vol += 5; }
      if (o.airbag) { weight += 10; cost += 200; vol += 1; }
      if (o.crashweb) { weight += 5; cost += 100; vol += 0.5; }
      return {
        name: `${count > 1 ? count + '× ' : ''}crew station${size.tag ? ` (${size.tag})` : ''}${o.ejection ? ' + ejection seat' : ''}`,
        weight: weight * count, cost: cost * count, volume: vol * count,
      };
    },
  },
  {
    key: 'passengerSeat', category: 'Crew & accommodations', name: 'Passenger seat', minTL: 0,
    help: 'A seat for someone who is just riding along.',
    params: [{ key: 'count', label: 'seats', def: 2, min: 1 }],
    options: [
      { key: 'cramped', label: 'cramped (20 cf)' }, { key: 'roomy', label: 'roomy (40 cf)' },
      { key: 'folding', label: 'folding', help: '5× cost; folds away when unused.' },
    ],
    generate({ count }, tl, o) {
      const size = o.cramped ? { w: 20, v: 20, tag: 'cramped' } : o.roomy ? { w: 40, v: 40, tag: 'roomy' } : { w: 30, v: 30, tag: '' };
      return {
        name: `${count > 1 ? count + '× ' : ''}passenger seat${size.tag ? ` (${size.tag})` : ''}`,
        weight: size.w * count, cost: 100 * (o.folding ? 5 : 1) * count, volume: size.v * count,
      };
    },
  },
  {
    key: 'bunk', category: 'Crew & accommodations', name: 'Bunk', minTL: 0,
    help: 'A sleeping berth for long voyages: 200 lbs, 100 cf each.',
    params: [{ key: 'count', label: 'bunks', def: 2, min: 1 }],
    generate({ count }) {
      return { name: `${count}× bunk`, weight: 200 * count, cost: 100 * count, volume: 100 * count };
    },
  },
  {
    key: 'cabin', category: 'Crew & accommodations', name: 'Cabin', minTL: 0,
    help: 'A private room with bunk, desk and locker — 500 cf of shipboard comfort.',
    params: [{ key: 'count', label: 'cabins', def: 1, min: 1 }],
    options: [{ key: 'luxury', label: 'luxury', help: 'Double size and weight, $10,000: a stateroom.' }],
    generate({ count }, tl, o) {
      const m = o.luxury ? 2 : 1;
      return {
        name: `${count > 1 ? count + '× ' : ''}${o.luxury ? 'luxury ' : ''}cabin`,
        weight: 2000 * m * count, cost: (o.luxury ? 10000 : 3000) * count, volume: 500 * m * count,
      };
    },
  },
  {
    key: 'envControl', category: 'Crew & accommodations', name: 'Environmental control', minTL: 5,
    help: 'Heating and air conditioning, sized per person aboard.',
    params: [{ key: 'men', label: 'people supported', def: 4, min: 1 }],
    generate({ men }, tl) {
      const f = byTL({ 5: 1, 6: 0.5, 7: 0.25 }, tl);
      return {
        name: `environmental control (${men} people)`,
        weight: men * 20 * f, cost: men * 10 * byTL({ 5: 1, 6: 2, 7: 5 }, tl),
        volume: men * 0.4 * f, kwIn: men * 0.25,
      };
    },
  },

  // ===================== INSTRUMENTS & ELECTRONICS =====================
  {
    key: 'radio', category: 'Instruments & electronics', name: 'Radio', minTL: 6,
    help: 'Two-way communications, sized by range class.',
    params: [{ key: 'range', label: 'range: 1=2mi 2=20mi 3=200mi 4=2,000mi 5=planetary', def: 2, min: 1, max: 5 }],
    generate({ range }, tl) {
      const r = Math.min(Math.max(Math.round(range), 1), 5);
      const wMult = [0.25, 1, 10, 100, 1000][r - 1];
      const cMult = [0.25, 1, 3, 10, 30][r - 1];
      const pMult = [0.1, 1, 4, 10, 40][r - 1];
      const weight = 10 * wMult;
      return {
        name: `radio, ${['short', 'medium', 'long', 'very long', 'extreme'][r - 1]} range`,
        weight, cost: 200 * cMult, volume: weight / 50, kwIn: 0.1 * pMult,
      };
    },
  },
  {
    key: 'radar', category: 'Instruments & electronics', name: 'Radar', minTL: 6,
    help: 'Detects and tracks targets by radio echo; scales with range in miles.',
    params: [{ key: 'miles', label: 'range (miles)', def: 20, min: 1 }],
    generate({ miles }, tl) {
      const weight = miles * byTL({ 6: 20, 7: 10, 8: 2, 9: 1, 10: 0.5, 11: 0.25 }, tl);
      const costBase = miles > 125 ? 100 + miles / 5 : miles;
      return {
        name: `radar, ${miles}-mile`,
        weight, cost: costBase * byTL({ 6: 1000, 7: 2000, 8: 1000, 9: 500, 10: 250, 11: 125 }, tl),
        volume: weight * 0.02, kwIn: miles * 0.25,
      };
    },
  },
  {
    key: 'sonar', category: 'Instruments & electronics', name: 'Active sonar', minTL: 6,
    help: 'Sees underwater by sound pulses; range in miles.',
    params: [{ key: 'miles', label: 'range (miles)', def: 5, min: 1 }],
    generate({ miles }) {
      return { name: `active sonar, ${miles}-mile`, weight: miles * 200, cost: miles * 4000, volume: miles * 4, kwIn: miles * 2.5 };
    },
  },
  {
    key: 'thermograph', category: 'Instruments & electronics', name: 'Thermograph', minTL: 7, maxTL: 10,
    help: 'Passive infrared imaging — sees heat in total darkness.',
    params: [{ key: 'miles', label: 'range (miles)', def: 5, min: 1 }],
    generate({ miles }, tl) {
      const weight = miles * byTL({ 7: 5, 8: 2, 9: 1, 10: 0.5 }, tl);
      const costBase = miles > 125 ? 100 + miles / 5 : miles;
      return {
        name: `thermograph, ${miles}-mile`,
        weight, cost: costBase * byTL({ 7: 16000, 8: 4000, 9: 2000, 10: 1000 }, tl),
        volume: weight * 0.02, kwIn: 0.1,
      };
    },
  },
  {
    key: 'navigation', category: 'Instruments & electronics', name: 'Navigation instruments', minTL: 3,
    help: 'Compass, charts and (at high TL) positioning gear: +1 to Navigation.',
    params: [],
    generate() {
      return { name: 'navigation instruments', weight: 20, cost: 50, volume: 0.4 };
    },
  },
  {
    key: 'autopilot', category: 'Instruments & electronics', name: 'Autopilot', minTL: 6,
    help: 'Holds a course without a hand on the controls.',
    params: [],
    generate() {
      return { name: 'autopilot', weight: 5, cost: 200, volume: 0.1 };
    },
  },
  {
    key: 'searchlight', category: 'Instruments & electronics', name: 'Searchlight', minTL: 5, maxTL: 7,
    help: 'A powered beam, sized by its range in miles.',
    params: [{ key: 'miles', label: 'beam range (miles)', def: 1, min: 1 }],
    generate({ miles }, tl) {
      return {
        name: `searchlight, ${miles}-mile`,
        weight: miles * byTL({ 5: 40, 6: 20, 7: 10 }, tl),
        cost: miles * byTL({ 5: 50, 6: 100, 7: 500 }, tl),
        volume: miles * byTL({ 5: 0.8, 6: 0.4, 7: 0.2 }, tl), kwIn: miles,
      };
    },
  },
  {
    key: 'terrainRadar', category: 'Instruments & electronics', name: 'Terrain-following radar', minTL: 7, maxTL: 11,
    help: 'Lets an aircraft hug the ground at speed in any visibility.',
    params: [],
    generate(_, tl) {
      return {
        name: 'terrain-following radar',
        weight: byTL({ 7: 25, 8: 10, 9: 5, 10: 2.5, 11: 1.25 }, tl),
        cost: byTL({ 7: 20000, 8: 4000, 9: 2000, 10: 1000, 11: 500 }, tl),
        volume: 0.5, kwIn: 1,
      };
    },
  },

  // ===================== TANKS & MISC =====================
  {
    key: 'fuelTank', category: 'Tanks & miscellaneous', name: 'Fuel tank', minTL: 5,
    help: 'Holds the fuel (enter the same gallons in Crew, Payload & Fuel). Tank weight excludes the fuel itself.',
    params: [{ key: 'gal', label: 'gallons', def: 50, min: 1 }],
    options: [{ key: 'selfSealing', label: 'self-sealing', help: 'Double weight and cost; leaks seal themselves when shot.' }],
    generate({ gal }, tl, o) {
      const m = o.selfSealing ? 2 : 1;
      return {
        name: `fuel tank, ${gal} gal${o.selfSealing ? ' (self-sealing)' : ''}`,
        weight: gal * byTL({ 5: 2.5, 6: 1.5, 7: 1, 8: 0.5 }, tl) * m,
        cost: gal * byTL({ 5: 1, 6: 2, 7: 5 }, tl) * m,
        volume: gal * 0.15,
      };
    },
  },
  {
    key: 'winch', category: 'Tanks & miscellaneous', name: 'Winch', minTL: 5, maxTL: 8,
    help: 'A powered cable drum rated by the ST it pulls with.',
    params: [{ key: 'st', label: 'ST', def: 50, min: 10 }],
    generate({ st }, tl) {
      const weight = (st / 10) * byTL({ 5: 150, 6: 100, 7: 50, 8: 25 }, tl);
      return {
        name: `winch, ST ${st}`,
        weight, cost: (st / 10) * byTL({ 5: 50, 6: 100, 7: 400, 8: 200 }, tl),
        volume: weight / 50, kwIn: (st / 10) * 0.05,
      };
    },
  },
  {
    key: 'crane', category: 'Tanks & miscellaneous', name: 'Crane', minTL: 5,
    help: 'A lifting boom, rated by reach in feet.',
    params: [{ key: 'ft', label: 'boom length (ft)', def: 12, min: 6 }],
    generate({ ft }) {
      return { name: `crane, ${ft}-ft boom`, weight: (ft / 6) * 2000, cost: (ft / 6) * 400, volume: (ft / 6) * 40, kwIn: ft / 6 };
    },
  },
  {
    key: 'fireExt', category: 'Tanks & miscellaneous', name: 'Fire extinguisher system', minTL: 6,
    help: 'Hoses and bottles plumbed through the vehicle; automatic at TL8+.',
    params: [],
    generate() {
      return { name: 'fire extinguisher system', weight: 150, cost: 300, volume: 3 };
    },
  },
  {
    key: 'fireSupp', category: 'Tanks & miscellaneous', name: 'Full fire suppression', minTL: 7,
    help: 'Inert-gas flooding that kills fires in milliseconds.',
    params: [],
    generate() {
      return { name: 'full fire suppression system', weight: 200, cost: 5000, volume: 4 };
    },
  },
  {
    key: 'fireSuppCompact', category: 'Tanks & miscellaneous', name: 'Compact fire suppression', minTL: 7,
    help: 'Nearly as good as the full system at a quarter the bulk.',
    params: [],
    generate() {
      return { name: 'compact fire suppression system', weight: 50, cost: 500, volume: 1 };
    },
  },
  {
    key: 'bilge', category: 'Tanks & miscellaneous', name: 'Bilge pump', minTL: 5,
    help: 'Pumps out leaks: removes 10 × TL lbs of water a minute. Big ships (100+ cf) get them free.',
    params: [],
    generate(_, tl) {
      return { name: 'bilge pump', weight: 200, cost: 500, volume: 10, kwIn: tl >= 7 ? 1 : 0 };
    },
  },

  // ===================== WEAPONS (GENERIC) =====================
  ...[
    ['lmg', '7.62mm machine gun', 6, 30, 6000, '7d pi'],
    ['hmg', '12.7mm heavy MG', 6, 130, 14000, '13d+1 pi+'],
    ['agl', '40mm auto grenade launcher', 7, 80, 20000, '4d [2d] cr ex'],
    ['ac25', '25mm autocannon', 7, 250, 60000, '6d×2 pi++'],
    ['cannon75', '75mm cannon', 6, 1500, 150000, '6d×8 pi++'],
    ['cannon120', '120mm tank gun', 7, 4400, 500000, '6d×15 pi++'],
    ['atgm', 'ATGM launcher', 7, 300, 40000, '6d×6(10) cr ex'],
    ['rocketPod', '70mm rocket pod', 7, 500, 30000, '6d×4 cr ex'],
  ].map(([key, name, minTL, weight, cost, dmg]) => ({
    key, category: 'Weapons (generic)', name, minTL,
    help: `Generic vehicular weapon (${dmg}); swap for a book-accurate weapon if you have one. Ammunition is extra.`,
    params: [],
    generate: () => ({ name, weight, cost, volume: weight / 50, note: dmg }),
  })),
];

export const CATALOG_CATEGORIES = [...new Set(COMPONENT_CATALOG.map((c) => c.category))];

// Build a component object from a catalog entry + parameter values.
export function buildFromCatalog(entry, params, tl, opts = {}) {
  const clampedTL = Math.min(Math.max(tl, entry.minTL), entry.maxTL ?? 99);
  const values = {};
  for (const p of entry.params) {
    values[p.key] = Math.max(Number(params[p.key]) || p.def, p.min ?? 0);
  }
  const c = entry.generate(values, clampedTL, opts);
  return {
    weight: 0, cost: 0, volume: 0, kwIn: 0, kwOut: 0, groundKw: 0,
    aquaticThrust: 0, airThrust: 0, staticLift: 0, contragravLift: 0,
    fuelGph: 0, airBreathing: false, location: 'body',
    ...c,
    name: c.name + (clampedTL !== tl ? ` (TL${clampedTL})` : ''),
  };
}
