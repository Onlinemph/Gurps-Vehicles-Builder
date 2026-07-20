// ---------------------------------------------------------------------------
// GVB repository library: normalizes parsed .rep templates and evaluates a
// template's formulas for a given set of user inputs.
// ---------------------------------------------------------------------------

import { evalFormula } from './formula.js';

// Formula properties we evaluate, in dependency order (later ones may use
// vTotal_Weight etc. computed from earlier ones).
const OUTPUTS = [
  ['weight', 'WeightFormula', 'Weight'],
  ['payload', 'PayloadFormula', 'Payload'],
  ['volume', 'VolumeFormula', 'Volume2'],   // props.Volume is a coefficient, not a total
  ['cost', 'CostFormula', 'Cost2'],         // props.Cost is often a coefficient too
  ['powerIn', 'PowerInFormula', 'PowerIn'],
  ['powerOut', 'PowerOutFormula', 'PowerOut'],
  ['fuelConsumption', 'FuelConsumptionFormula', 'FuelConsumption2'],
  ['motivePower', 'MotivePowerFormula', null],
  ['motiveThrust', 'MotiveThrustFormula', null],
  ['lift', 'LiftFormula', null],
  ['crew', 'CrewFormula', null],
];

export function normalizeTemplate(node, source) {
  const p = node.props;
  const radios = [];
  const checks = [];
  for (let n = 1; n <= 12; n++) {
    if (p[`Radio${n}`]) radios.push({ n, label: p[`Radio${n}`] });
    if (p[`Check${n}`]) checks.push({ n, label: p[`Check${n}`] });
  }
  return {
    source,
    class: node.class.replace(/^T|Template$/g, ''),
    name: p.Name1 || '(unnamed)',
    tl: p.TL ?? 0,
    quantityName: p.QuantityName || 'Quantity',
    ratingName: p.RatingName || '',
    unitsName: p.UnitsName || '',
    radioDesc: p.RadioDesc || 'Options',
    checkDesc: p.CheckDesc || 'Options',
    radios,
    checks,
    defaults: {
      quantity: p.QuantityDefault ?? p.Quantity ?? 1,
      rating: p.Rating ?? 1,
      units: p.Units ?? 1,
      radio: p.RadioValue ?? 0,
      checkMask: p.CheckValue ?? 0,
    },
    quantityMin: p.QuantityMin ?? 0,
    quantityMax: p.QuantityMax ?? 100000,
    description: (p.Description || '').replace(/\r\n/g, '\n'),
    fuelUnit: p.FuelConsumptionUnit || '',
    props: p,
  };
}

export function normalizeRepository(root, source) {
  return (root.children || [])
    .filter((c) => c.props && (c.props.Name1 || c.props.WeightFormula))
    .map((c) => normalizeTemplate(c, source));
}

// inputs: { quantity, rating, units, tl, radio, checks:Set<number>,
//           context: {varName: number} }  — context supplies vehicle-level
// variables (vVehicle_Weight, vBODY_HP, ...) some formulas reference.
export function evaluateTemplate(tpl, inputs) {
  const p = tpl.props;
  const vars = {
    vquantity: inputs.quantity,
    vrating: inputs.rating,
    vunits: inputs.units,
    vtl: inputs.tl,
    vmedium: p.Medium ?? 0,
    vgeneric1: 0,
    // Coefficient constants some formulas reference:
    vweight: p.Weight ?? 0,
    vvolume: p.Volume ?? 0,
    vcost: p.Cost ?? 0,
    vpayload: p.Payload ?? 0,
    vfuelconsumption: p.FuelConsumption ?? 0,
  };
  for (const [k, v] of Object.entries(inputs.context || {})) {
    vars[k.toLowerCase()] = Number(v) || 0;
  }

  const out = { errors: [], unknown: new Set() };

  // Two passes: the second pass lets formulas reference the outputs of the
  // component's other formulas (vTotal_Weight, vPower_Out, ...).
  for (let pass = 0; pass < 2; pass++) {
    out.errors = [];
    out.unknown = new Set();
    const env = { vars, radio: inputs.radio, checks: inputs.checks, unknown: out.unknown };
    for (const [key, formulaProp] of OUTPUTS) {
      const formula = p[formulaProp];
      let value = 0;
      if (formula && String(formula).trim()) {
        try {
          value = evalFormula(formula, env);
        } catch (e) {
          out.errors.push(`${formulaProp}: ${e.message}`);
          value = 0;
        }
      }
      out[key] = Number.isFinite(value) ? value : 0;
      setOutputVars(vars, key, out[key]);
    }
  }
  // Report only unknowns not satisfiable by context the user could add.
  return out;
}

function setOutputVars(vars, key, value) {
  // GVB naming: vTotal_X is the computed output; plain vX stays the
  // template's coefficient constant, so never overwrite those.
  const k = key.toLowerCase();
  vars[`vtotal_${k}`] = value;
  if (k === 'powerout') { vars.vpower_out = value; vars.vtotal_power_out = value; }
  if (k === 'powerin') { vars.vpower_in = value; vars.vtotal_power_in = value; }
  if (k === 'motivethrust') vars.vtotal_motive_thrust = value;
  if (k === 'motivepower') vars.vtotal_motive_power = value;
  if (k === 'fuelconsumption') vars.vtotal_fuel = value;
}

export function defaultInputs(tpl, vehicleTl) {
  const checks = new Set();
  for (let n = 1; n <= 12; n++) {
    if (tpl.defaults.checkMask & (1 << (n - 1))) checks.add(n);
  }
  let radio = tpl.defaults.radio;
  if (!radio && tpl.radios.length) radio = tpl.radios[0].n;
  return {
    quantity: tpl.defaults.quantity || 1,
    rating: tpl.defaults.rating || 1,
    units: tpl.defaults.units || 1,
    tl: Math.max(tpl.tl, Math.min(vehicleTl ?? tpl.tl, 16)),
    radio,
    checks,
  };
}
