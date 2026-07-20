// ---------------------------------------------------------------------------
// GURPS Vehicles 2e designer — UI. Binds ve2.html to a design object and
// renders the full computed sheet on every change.
// ---------------------------------------------------------------------------

import {
  ARMOR_TYPES, FRAME_STRENGTHS, FUELS, HYDRO_LINES, MATERIALS,
  SPECIAL_STRUCTURES, STREAMLINING,
} from './tables.js';
import { BODY_FACE_KEYS, computeVe2, defaultVe2Design, migrateVe2Design } from './vehicle.js';
import { toVe2Markdown } from './export.js';
import { VE2_PRESETS } from './presets.js';
import { initGvbLibrary } from '../gvb/ui-library.js';

let design = defaultVe2Design();
let lastResult = null;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (x, d = 0) => (Math.round(x * 10 ** d) / 10 ** d).toLocaleString('en-US');

// --- Static selects --------------------------------------------------------
function fillSelect(el, entries, selected) {
  el.innerHTML = '';
  for (const [value, label] of entries) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    if (value === String(selected)) opt.selected = true;
    el.appendChild(opt);
  }
}

function initStatic() {
  fillSelect($('f-controls'), [
    ['mechanical', 'Mechanical (TL5)'], ['electronic', 'Electronic (TL6)'], ['computerized', 'Computerized (TL7)'],
  ], design.controls);
  fillSelect($('f-streamlining'), Object.entries(STREAMLINING).map(([k, v]) => [k, v.name]), design.streamlining);
  fillSelect($('f-hydrolines'), Object.entries(HYDRO_LINES).map(([k, v]) => [k, v.name]), design.features.hydroLines);
  fillSelect($('f-frame'), Object.entries(FRAME_STRENGTHS).map(([k, v]) => [k, v.name]), design.structure.frame);
  fillSelect($('f-material'), Object.entries(MATERIALS).map(([k, v]) => [k, v.name]), design.structure.material);
  fillSelect($('f-special'), Object.entries(SPECIAL_STRUCTURES).map(([k, v]) => [k, v.name]), design.structure.special);
  fillSelect($('f-armortype'), Object.entries(ARMOR_TYPES).map(([k, v]) => [k, v.name]), design.armor.type);
  fillSelect($('s-wheeltype'), [
    ['standard', 'Standard'], ['small', 'Small'], ['heavy', 'Heavy'], ['offroad', 'Off-road'], ['railway', 'Railway'],
  ], design.subassemblies.wheels.type);
  fillSelect($('s-wingtype'), [
    ['standard', 'Standard'], ['stol', 'STOL'], ['highAgility', 'High-agility'],
    ['biplane', 'Biplane'], ['triplane', 'Triplane'], ['stub', 'Stub wings'],
  ], design.subassemblies.wings.type);
  fillSelect($('f-fueltype'), Object.entries(FUELS).map(([k, v]) => [k, v.name]), design.fuel.type);
  fillSelect($('preset-select'), [['', '— Load a sample design —'], ...VE2_PRESETS.map((p, i) => [String(i), p.name])], '');
}

// --- Binding ---------------------------------------------------------------
const getPath = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => o[k], obj)[last] = value;
}

const BINDINGS = [
  ['f-name', 'name', 'text'],
  ['f-tl', 'tl', 'num'],
  ['f-controls', 'controls', 'text'],
  ['f-streamlining', 'streamlining', 'text'],
  ['f-flotation', 'features.flotationHull', 'bool'],
  ['f-submersible', 'features.submersibleHull', 'bool'],
  ['f-sealed', 'features.sealed', 'bool'],
  ['f-catamaran', 'features.catamaran', 'bool'],
  ['f-liftingbody', 'features.liftingBody', 'bool'],
  ['f-responsive', 'features.responsive', 'bool'],
  ['f-hydrolines', 'features.hydroLines', 'text'],
  ['f-frame', 'structure.frame', 'text'],
  ['f-material', 'structure.material', 'text'],
  ['f-special', 'structure.special', 'text'],
  ['f-armortype', 'armor.type', 'text'],
  ['f-armormode', 'armor.mode', 'text'],
  ['f-dr', 'armor.dr', 'num'],
  ['f-otherdr', 'armor.otherDr', 'num'],
  ...BODY_FACE_KEYS.map((f) => [`af-${f}`, `armor.faces.${f}.dr`, 'num']),
  ...['front', 'back', 'left', 'right'].map((f) => [`as-${f}`, `armor.faces.${f}.slope`, 'num']),
  ['s-wheels', 'subassemblies.wheels.present', 'bool'],
  ['s-wheeltype', 'subassemblies.wheels.type', 'text'],
  ['s-wheelcount', 'subassemblies.wheels.count', 'num'],
  ['s-wheelretract', 'subassemblies.wheels.retractable', 'bool'],
  ['s-tracks', 'subassemblies.tracks.present', 'bool'],
  ['s-halftracks', 'subassemblies.halftracks.present', 'bool'],
  ['s-skids', 'subassemblies.skids.present', 'bool'],
  ['s-legs', 'subassemblies.legs.present', 'bool'],
  ['s-legcount', 'subassemblies.legs.count', 'num'],
  ['s-wings', 'subassemblies.wings.present', 'bool'],
  ['s-wingtype', 'subassemblies.wings.type', 'text'],
  ['s-wingfrac', 'subassemblies.wings.volumeFrac', 'num'],
  ['s-rotors', 'subassemblies.rotors.present', 'bool'],
  ['s-masts', 'subassemblies.masts.present', 'bool'],
  ['s-mastheight', 'subassemblies.masts.heightFt', 'num'],
  ['s-gasbag', 'subassemblies.gasbag.present', 'bool'],
  ['s-gasbagcf', 'subassemblies.gasbag.cf', 'num'],
  ['f-crew', 'crew', 'num'],
  ['f-passengers', 'passengers', 'num'],
  ['f-exposed', 'exposedSeats', 'num'],
  ['f-space', 'computeSpace', 'bool'],
  ['f-cargocf', 'cargoCf', 'num'],
  ['f-emptycf', 'emptySpaceCf', 'num'],
  ['f-fueltype', 'fuel.type', 'text'],
  ['f-fuelgal', 'fuel.gallons', 'num'],
  ['f-hpcount', 'hardpoints.count', 'num'],
  ['f-hpload', 'hardpoints.loadLbs', 'num'],
  ['o-suspension', 'options.improvedSuspension', 'bool'],
  ['o-brakes', 'options.improvedBrakes', 'bool'],
  ['o-aws', 'options.allWheelSteering', 'bool'],
  ['o-awd', 'options.allWheelDrive', 'bool'],
  ['o-smartwheels', 'options.smartwheels', 'bool'],
  ['o-rollstab', 'options.rollStabilizers', 'bool'],
];

function bindAll() {
  for (const [id, path, kind] of BINDINGS) {
    const el = $(id);
    if (!el) continue;
    const event = kind === 'bool' || el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(event, () => {
      const value = kind === 'bool' ? el.checked : kind === 'num' ? Number(el.value) || 0 : el.value;
      setPath(design, path, value);
      if (id === 'f-armormode') syncArmorMode();
      render();
    });
  }
}

function syncArmorMode() {
  const facing = design.armor.mode === 'facing';
  $('armor-overall').style.display = facing ? 'none' : '';
  $('armor-facing').style.display = facing ? '' : 'none';
}

function syncForm() {
  if (!design.armor.faces) design.armor.faces = defaultVe2Design().armor.faces;
  for (const [id, path, kind] of BINDINGS) {
    const el = $(id);
    if (!el) continue;
    const value = getPath(design, path);
    if (kind === 'bool') el.checked = !!value;
    else el.value = value ?? '';
  }
  syncArmorMode();
  renderTurrets();
  renderSupers();
  renderOpenMounts();
  renderComponents();
  syncLocationOptions();
}

// --- Turrets & superstructures ---------------------------------------------
function renderTurrets() {
  const wrap = $('turret-list');
  wrap.innerHTML = '';
  (design.subassemblies.turrets || []).forEach((t, i) => {
    const row = document.createElement('div');
    row.className = 'weapon-row';
    row.innerHTML = `
      <span class="weapon-name">Turret ${i + 1}</span>
      <span class="weapon-detail sub-edit">
        <label>cf <input type="number" data-k="volumeCf" min="0.5" step="0.5" value="${t.volumeCf}"></label>
        <label>rotation <select data-k="rotation">
          ${['full', 'limited', 'popFull', 'popLimited'].map((rt) => `<option value="${rt}" ${t.rotation === rt ? 'selected' : ''}>${rt}</option>`).join('')}
        </select></label>
        <label>slope° <input type="number" data-k="slopeDegrees" min="0" max="240" step="30" value="${t.slopeDegrees || 0}"></label>
        <label>DR <input type="number" data-k="dr" min="0" step="1" value="${t.dr || 0}" title="Used in facing-armor mode"></label>
      </span>`;
    row.querySelectorAll('[data-k]').forEach((el) => {
      el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
        t[el.dataset.k] = el.tagName === 'SELECT' ? el.value : Number(el.value) || 0;
        render();
      });
    });
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn small danger';
    del.textContent = '✕';
    del.addEventListener('click', () => {
      design.subassemblies.turrets.splice(i, 1);
      design.components = design.components.filter((c) => c.location !== `turret${i}`)
        .map((c) => remapLocation(c, 'turret', i));
      renderTurrets(); syncLocationOptions(); renderComponents(); render();
    });
    row.appendChild(del);
    wrap.appendChild(row);
  });
  if (!design.subassemblies.turrets?.length) wrap.innerHTML = '<p class="muted">No turrets.</p>';
}

function renderSupers() {
  const wrap = $('super-list');
  wrap.innerHTML = '';
  (design.subassemblies.superstructures || []).forEach((s, i) => {
    const row = document.createElement('div');
    row.className = 'weapon-row';
    row.innerHTML = `
      <span class="weapon-name">Superstructure ${i + 1}</span>
      <span class="weapon-detail sub-edit">
        <label>cf <input type="number" data-k="volumeCf" min="0.5" step="0.5" value="${s.volumeCf}"></label>
        <label>slope° <input type="number" data-k="slopeDegrees" min="0" max="240" step="30" value="${s.slopeDegrees || 0}"></label>
        <label>DR <input type="number" data-k="dr" min="0" step="1" value="${s.dr || 0}" title="Used in facing-armor mode"></label>
      </span>`;
    row.querySelectorAll('[data-k]').forEach((el) => {
      el.addEventListener('input', () => { s[el.dataset.k] = Number(el.value) || 0; render(); });
    });
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn small danger';
    del.textContent = '✕';
    del.addEventListener('click', () => {
      design.subassemblies.superstructures.splice(i, 1);
      design.components = design.components.filter((c) => c.location !== `super${i}`)
        .map((c) => remapLocation(c, 'super', i));
      renderSupers(); syncLocationOptions(); renderComponents(); render();
    });
    row.appendChild(del);
    wrap.appendChild(row);
  });
  if (!design.subassemblies.superstructures?.length) wrap.innerHTML = '<p class="muted">No superstructures.</p>';
}

function renderOpenMounts() {
  const wrap = $('open-list');
  wrap.innerHTML = '';
  (design.subassemblies.openMounts || []).forEach((m, i) => {
    const row = document.createElement('div');
    row.className = 'weapon-row';
    row.innerHTML = `
      <span class="weapon-name">Open mount ${i + 1}</span>
      <span class="weapon-detail sub-edit">
        <label>rotation <select data-k="rotation">
          ${['none', 'limited', 'full'].map((rt) => `<option value="${rt}" ${m.rotation === rt ? 'selected' : ''}>${rt}</option>`).join('')}
        </select></label>
      </span>`;
    row.querySelector('[data-k]').addEventListener('change', (e) => { m.rotation = e.target.value; render(); });
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn small danger';
    del.textContent = '✕';
    del.addEventListener('click', () => {
      design.subassemblies.openMounts.splice(i, 1);
      design.components = design.components.filter((c) => c.location !== `open${i}`)
        .map((c) => remapLocation(c, 'open', i));
      renderOpenMounts(); syncLocationOptions(); renderComponents(); render();
    });
    row.appendChild(del);
    wrap.appendChild(row);
  });
  if (!design.subassemblies.openMounts?.length) wrap.innerHTML = '<p class="muted">No open mounts.</p>';
}

// After deleting subassembly i, shift higher-numbered locations down.
function remapLocation(c, prefix, deleted) {
  const m = String(c.location || '').match(new RegExp(`^${prefix}(\\d+)$`));
  if (m && Number(m[1]) > deleted) return { ...c, location: `${prefix}${Number(m[1]) - 1}` };
  return c;
}

function initSubassemblyAdders() {
  $('turret-add').addEventListener('click', () => {
    design.subassemblies.turrets.push({ volumeCf: 8, rotation: 'full', slopeDegrees: 0, dr: 0 });
    renderTurrets(); syncLocationOptions(); render();
  });
  $('super-add').addEventListener('click', () => {
    design.subassemblies.superstructures.push({ volumeCf: 50, slopeDegrees: 0, dr: 0 });
    renderSupers(); syncLocationOptions(); render();
  });
  $('open-add').addEventListener('click', () => {
    if (!design.subassemblies.openMounts) design.subassemblies.openMounts = [];
    design.subassemblies.openMounts.push({ rotation: 'full' });
    renderOpenMounts(); syncLocationOptions(); render();
  });
}

function syncLocationOptions() {
  const entries = [['body', 'Body'], ['wings', 'Wings']];
  (design.subassemblies.turrets || []).forEach((_, i) => entries.push([`turret${i}`, `Turret ${i + 1}`]));
  (design.subassemblies.superstructures || []).forEach((_, i) => entries.push([`super${i}`, `Superstructure ${i + 1}`]));
  (design.subassemblies.openMounts || []).forEach((_, i) => entries.push([`open${i}`, `Open mount ${i + 1}`]));
  const current = $('c-location').value || 'body';
  fillSelect($('c-location'), entries, entries.some(([v]) => v === current) ? current : 'body');
}

// --- Components ------------------------------------------------------------
function locationLabel(loc) {
  if (!loc || loc === 'body') return '';
  if (loc === 'wings') return 'in wings';
  const m = loc.match(/^(turret|super|open)(\d+)$/);
  if (m) {
    const kind = { turret: 'turret', super: 'superstructure', open: 'open mount' }[m[1]];
    return `in ${kind} ${Number(m[2]) + 1}`;
  }
  return `in ${loc}`;
}

function renderComponents() {
  const wrap = $('component-list');
  wrap.innerHTML = '';
  (design.components || []).forEach((c, i) => {
    const bits = [
      `${fmt(c.weight)} lb`, `$${fmt(c.cost)}`, `${fmt(c.volume, 2)} cf`,
      c.fuelGph ? `${fmt(c.fuelGph, 2)} gph` : '',
      c.kwIn ? `needs ${fmt(c.kwIn, 1)} kW` : '',
      c.kwOut ? `puts out ${fmt(c.kwOut, 1)} kW` : '',
      c.groundKw ? `${fmt(c.groundKw, 1)} kW ground` : '',
      c.aquaticThrust ? `${fmt(c.aquaticThrust)} lb aquatic thrust` : '',
      c.airThrust ? `${fmt(c.airThrust)} lb aerial thrust` : '',
      c.staticLift ? `${fmt(c.staticLift)} lb lift` : '',
      c.contragravLift ? `${fmt(c.contragravLift)} lb contragrav` : '',
      c.airBreathing ? 'air-breathing' : '',
      locationLabel(c.location),
    ].filter(Boolean).join(' · ');
    const row = document.createElement('div');
    row.className = 'weapon-row';
    row.innerHTML = `<span class="weapon-name">${esc(c.name)}</span><span class="weapon-detail">${bits}</span>`;
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn small danger';
    del.textContent = '✕';
    del.addEventListener('click', () => { design.components.splice(i, 1); renderComponents(); render(); });
    row.appendChild(del);
    wrap.appendChild(row);
  });
  if (!design.components.length) wrap.innerHTML = '<p class="muted">No components yet. A vehicle needs at least an engine, a drivetrain and a crew station.</p>';
}

function componentFormValue() {
  return {
    name: $('c-name').value.trim() || 'Component',
    weight: Number($('c-weight').value) || 0,
    cost: Number($('c-cost').value) || 0,
    volume: Number($('c-volume').value) || 0,
    fuelGph: Number($('c-gph').value) || 0,
    kwIn: Number($('c-kwin').value) || 0,
    kwOut: Number($('c-kwout').value) || 0,
    groundKw: Number($('c-groundkw').value) || 0,
    aquaticThrust: Number($('c-aqua').value) || 0,
    airThrust: Number($('c-air').value) || 0,
    staticLift: Number($('c-lift').value) || 0,
    contragravLift: Number($('c-contragrav').value) || 0,
    airBreathing: $('c-airbreathing').checked,
    location: $('c-location').value,
  };
}

function clearComponentForm() {
  $('c-name').value = '';
  for (const id of ['c-weight', 'c-cost', 'c-volume', 'c-gph', 'c-kwin', 'c-kwout', 'c-groundkw', 'c-aqua', 'c-air', 'c-lift', 'c-contragrav']) $(id).value = 0;
  $('c-airbreathing').checked = false;
}

function initComponentAdder() {
  $('c-add').addEventListener('click', () => {
    design.components.push(componentFormValue());
    clearComponentForm();
    renderComponents();
    render();
    flash('Component added.');
  });
}

// Prefill the component form from a GVB library selection.
function prefillFromGvb(item, detail) {
  const { template, result } = detail;
  $('c-name').value = item.name;
  $('c-weight').value = round2(result.weight);
  $('c-cost').value = round2(result.cost);
  $('c-volume').value = round2(result.volume);
  $('c-kwin').value = round2(result.powerIn);
  $('c-kwout').value = round2(result.powerOut);
  // GVB fuel consumption is usually gph; other units need manual conversion.
  $('c-gph').value = (!template.fuelUnit || template.fuelUnit === 'gph') ? round2(result.fuelConsumption) : 0;

  const hay = `${template.class} ${template.name}`.toLowerCase();
  const aquatic = /hydro|screw|paddle|oar|aquatic|marine|swim/.test(hay);
  const aerial = /propeller|fan|jet|rocket|thruster|ornithopter|aerial/.test(hay);
  $('c-groundkw').value = round2(result.motivePower);
  $('c-aqua').value = aquatic ? round2(result.motiveThrust) : 0;
  $('c-air').value = !aquatic && aerial ? round2(result.motiveThrust) : 0;
  const contragrav = /contragrav|cg unit/.test(hay);
  $('c-lift').value = contragrav ? 0 : round2(result.lift);
  $('c-contragrav').value = contragrav ? round2(result.lift) : 0;
  $('c-airbreathing').checked = /combustion|turbine|gasoline|diesel|jet|steam/.test(hay) && result.fuelConsumption > 0;
  flash('Component form prefilled — review the thrust/lift boxes, then press Add component.');
  $('c-name').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

const round2 = (x) => Math.round((Number(x) || 0) * 100) / 100;

// --- Output ----------------------------------------------------------------
function row(label, value) {
  return `<div class="bd-row"><span>${label}</span><span>${value}</span></div>`;
}

function render() {
  const r = computeVe2(design);
  lastResult = r;

  $('sheet-name').textContent = design.name;
  $('sheet-sub').textContent = `TL${design.tl} · ${FRAME_STRENGTHS[design.structure.frame].name} frame, ${MATERIALS[design.structure.material].name.toLowerCase()} materials`;

  let html = '';

  html += '<h3>Size &amp; Structure</h3>';
  html += row('Body volume', `${fmt(r.volumes.body, 2)} cf`);
  for (const [k, v] of Object.entries(r.volumes)) {
    if (k !== 'body' && v > 0) html += row(`${volumeLabel(k)} volume`, `${fmt(v, 2)} cf`);
  }
  html += row('Total volume / Size Modifier', `${fmt(r.totalVolume, 1)} cf · SM ${r.stats.sm >= 0 ? '+' : ''}${r.stats.sm}`);
  html += row('Surface area (total / structural)', `${fmt(r.totalArea)} / ${fmt(r.structuralArea)} sf`);
  html += row('Structure', `${fmt(r.structure.weight)} lbs · $${fmt(r.structure.cost)}`);

  html += '<h3>Armor</h3>';
  if (r.armor.mode === 'overall') {
    html += row('Coverage', r.armor.dr > 0 ? `PD ${r.armor.pd}, DR ${r.armor.dr} overall` : 'none');
  } else if (r.armor.faces) {
    for (const f of BODY_FACE_KEYS) {
      const face = r.armor.faces[f];
      if (!face || face.dr === 0) continue;
      html += row(prettyKey(f), `PD ${face.pd}, DR ${face.effDR}${face.slope ? ` (${face.dr} @ ${face.slope}°)` : ''}`);
    }
    (design.subassemblies.turrets || []).forEach((t, i) => {
      if (t.dr > 0) html += row(`Turret ${i + 1}`, `DR ${t.dr}`);
    });
    (design.subassemblies.superstructures || []).forEach((s, i) => {
      if (s.dr > 0) html += row(`Superstructure ${i + 1}`, `DR ${s.dr}`);
    });
    if (design.armor.otherDr > 0) html += row('Other subassemblies', `DR ${design.armor.otherDr}`);
  }
  if (r.armor.weight > 0) html += row('Armor weight & cost', `${fmt(r.armor.weight)} lbs · $${fmt(r.armor.cost)}`);

  html += '<h3>Hit Points</h3>';
  html += `<p>${Object.entries(r.hp).map(([k, v]) => `${prettyKey(k.replace('per', ''))} ${v}`).join(' · ')}</p>`;

  html += '<h3>Weights</h3>';
  html += row('Empty weight', `${fmt(r.weights.empty)} lbs`);
  html += row('Payload (people + cargo)', `${fmt(r.weights.payload)} lbs`);
  html += row('Fuel', `${fmt(r.weights.fuel)} lbs`);
  html += row('Loaded weight', `${fmt(r.weights.loaded)} lbs (${fmt(r.weights.loadedTons, 2)} tons)`);
  if (r.weights.loadedWithStores) html += row('With hardpoints loaded', `${fmt(r.weights.loadedWithStores)} lbs`);
  if (r.flotation > 0) html += row('Flotation', `${fmt(r.flotation)} lbs ${r.floats ? '— floats' : '— SINKS'}`);
  if (r.weights.submerged > 0) html += row('Submerged weight', `${fmt(r.weights.submerged)} lbs`);
  if (r.power.needed > 0 || r.power.available > 0) {
    html += row('Power', `${fmt(r.power.needed, 1)} kW needed / ${fmt(r.power.available, 1)} kW available`);
  }
  if (r.fuelUse.gph > 0) {
    html += row('Fuel use', `${fmt(r.fuelUse.gph, 2)} gph` +
      (r.fuelUse.durationHours !== null ? ` · duration ${formatDuration(r.fuelUse.durationHours)}` : ''));
  }

  html += '<h3>Statistics</h3>';
  html += row('Health (HT)', r.stats.ht);
  html += row('Price', `$${fmt(r.stats.price)}`);

  if (r.perf.ground) {
    const g = r.perf.ground;
    html += '<h3>Ground Performance</h3>';
    html += row('Top speed', `${g.topSpeed} mph${g.topSpeedWithStores ? ` (${g.topSpeedWithStores} with stores)` : ''}`);
    html += row('gAccel / gDecel', `${g.gAccel} / ${g.gDecel} mph/s`);
    html += row('gMR / gSR', `${g.gMR} / ${g.gSR}`);
    html += row('Ground pressure', `${fmt(g.groundPressure)} (${g.gpLabel})`);
    html += row('Off-road speed', g.offRoad === 0 ? 'none' : g.offRoad === 1 ? 'full' : `${Math.round(g.offRoad * 100)}% of top`);
  }
  if (r.perf.water) {
    const w = r.perf.water;
    html += '<h3>Water Performance</h3>';
    html += row('Top speed', `${w.topSpeed} mph${w.planing ? ' (planing)' : ''}`);
    html += row('wAccel / wDecel', `${w.wAccel} / ${w.wDecel} (${w.wDecelPowered}) mph/s`);
    html += row('wMR / wSR', `${w.wMR} / ${w.wSR}`);
    html += row('Draft', `${w.draft} ft`);
  }
  if (r.perf.submerged) {
    const u = r.perf.submerged;
    html += '<h3>Submerged Performance</h3>';
    html += row('Top speed', `${u.topSpeed} mph`);
    html += row('uAccel', `${u.uAccel} mph/s`);
    html += row('Draft / Crush depth', `${u.draft} ft / ${fmt(u.crushDepth)} yds`);
  }
  if (r.perf.aerial) {
    const a = r.perf.aerial;
    html += '<h3>Aerial Performance</h3>';
    html += row('Stall speed', a.stallSpeed === 0 ? '0 (can hover)' : `${a.stallSpeed} mph`);
    html += row('Top speed', `${a.topSpeed} mph`);
    html += row('aAccel / aDecel', `${a.aAccel} / ${a.aDecel} mph/s`);
    html += row('aMR / aSR', `${a.aMR} / ${a.aSR}`);
    if (a.takeoffRun) html += row('Takeoff run', `${fmt(a.takeoffRun)} yds`);
    if (a.withStores) html += row('With stores', `stall ${a.withStores.stallSpeed}, top ${a.withStores.topSpeed} mph, aAccel ${a.withStores.aAccel}`);
    if (!a.canFly) html += row('Flight', '⚠️ cannot take off unaided');
  }
  if (r.perf.space) {
    const s = r.perf.space;
    html += '<h3>Space Performance</h3>';
    html += row('sAccel', `${s.sAccelG} G (${s.sAccel} mph/s)`);
    html += row('sMR', s.sMR);
  }

  $('sheet-body').innerHTML = html;

  const probs = $('problems');
  probs.innerHTML =
    r.errors.map((e) => `<li class="err">⛔ ${esc(e)}</li>`).join('') +
    r.warnings.map((w) => `<li class="warn">⚠️ ${esc(w)}</li>`).join('');
  $('problems-card').style.display = (r.errors.length || r.warnings.length) ? '' : 'none';
}

function formatDuration(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m === 60 ? `${h + 1}h 0m` : `${h}h ${m}m`;
}

function volumeLabel(key) {
  const m = key.match(/^(turret|super|open)(\d+)$/);
  if (m) {
    const kind = { turret: 'Turret', super: 'Superstructure', open: 'Open mount' }[m[1]];
    return `${kind} ${Number(m[2]) + 1}`;
  }
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function prettyKey(s) {
  const spaced = s.replace(/openMount/, 'open mount').replace(/(\d+)$/, ' $1');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// --- Toolbar ---------------------------------------------------------------
const KEY = 'gvb.ve2designs.v1';
const readAll = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };

function refreshSaved() {
  const names = Object.keys(readAll()).sort();
  fillSelect($('saved-select'), [['', names.length ? '— Saved designs —' : '— No saved designs —'], ...names.map((n) => [n, n])], '');
}

function replaceDesign(next) {
  next = migrateVe2Design(next);
  const base = defaultVe2Design();
  design = { ...base, ...structuredClone(next) };
  design.features = { ...base.features, ...(next.features || {}) };
  design.structure = { ...base.structure, ...(next.structure || {}) };
  design.armor = { ...base.armor, ...(next.armor || {}) };
  if (!design.armor.faces) design.armor.faces = base.armor.faces;
  design.options = { ...base.options, ...(next.options || {}) };
  design.fuel = { ...base.fuel, ...(next.fuel || {}) };
  design.hardpoints = { ...base.hardpoints, ...(next.hardpoints || {}) };
  design.subassemblies = Object.fromEntries(
    Object.entries(base.subassemblies).map(([k, v]) => {
      const incoming = (next.subassemblies || {})[k];
      if (Array.isArray(v)) return [k, structuredClone(incoming || [])];
      return [k, { ...v, ...(incoming || {}) }];
    })
  );
  design.components = structuredClone(next.components || []);
  syncForm();
  render();
}

function initToolbar() {
  $('preset-select').addEventListener('change', (e) => {
    if (e.target.value === '') return;
    replaceDesign(VE2_PRESETS[Number(e.target.value)]);
    e.target.value = '';
    flash(`Loaded “${design.name}”.`);
  });
  $('btn-new').addEventListener('click', () => {
    if (confirm('Start a new design?')) replaceDesign(defaultVe2Design());
  });
  $('btn-save').addEventListener('click', () => {
    const map = readAll();
    map[design.name] = design;
    localStorage.setItem(KEY, JSON.stringify(map));
    refreshSaved();
    flash(`Saved “${design.name}”.`);
  });
  $('saved-select').addEventListener('change', (e) => {
    const d = readAll()[e.target.value];
    if (d) replaceDesign(d);
    e.target.value = '';
  });
  $('btn-export-json').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(design, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${design.name.replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '-').toLowerCase() || 'vehicle'}.ve2.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $('btn-import-json').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    file.text().then((text) => {
      try {
        replaceDesign(JSON.parse(text));
        flash(`Imported “${design.name}”.`);
      } catch {
        alert('Not a valid design JSON.');
      }
      e.target.value = '';
    });
  });
  $('btn-export-md').addEventListener('click', () => {
    $('md-output').value = toVe2Markdown(design, lastResult || computeVe2(design));
    $('md-modal').showModal();
  });
  $('md-copy').addEventListener('click', () => {
    navigator.clipboard.writeText($('md-output').value).then(() => flash('Copied to clipboard.'));
  });
  $('md-close').addEventListener('click', () => $('md-modal').close());
  $('btn-print').addEventListener('click', () => window.print());
}

let flashTimer = null;
function flash(msg) {
  const el = $('flash');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// --- Boot ------------------------------------------------------------------
initStatic();
bindAll();
initComponentAdder();
initSubassemblyAdders();
initGvbLibrary({ vehicleTl: () => design.tl, addEquipment: prefillFromGvb });
initToolbar();
refreshSaved();
syncForm();
render();
