// ---------------------------------------------------------------------------
// GURPS Vehicles 2e designer — UI. Binds ve2.html to a design object and
// renders the full computed sheet on every change.
// ---------------------------------------------------------------------------

import {
  ARMOR_TYPES, FRAME_STRENGTHS, FUELS, HYDRO_LINES, MATERIALS,
  SPECIAL_STRUCTURES, STREAMLINING,
} from './tables.js';
import { computeVe2, defaultVe2Design } from './vehicle.js';
import { initGvbLibrary } from '../gvb/ui-library.js';

let design = defaultVe2Design();

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
  fillSelect($('s-turretrot'), [
    ['full', 'Full rotation'], ['limited', 'Limited rotation'],
    ['popFull', 'Pop turret, full rotation'], ['popLimited', 'Pop turret, limited'],
  ], design.subassemblies.turret.rotation);
  fillSelect($('f-fueltype'), Object.entries(FUELS).map(([k, v]) => [k, v.name]), design.fuel.type);
}

// --- Binding ---------------------------------------------------------------
const getPath = (obj, path) => path.split('.').reduce((o, k) => o[k], obj);
function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => o[k], obj)[last] = value;
}

const BINDINGS = [
  // [element id, design path, kind]
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
  ['f-bodyslope', 'bodySlopeDegrees', 'num'],
  ['f-frame', 'structure.frame', 'text'],
  ['f-material', 'structure.material', 'text'],
  ['f-special', 'structure.special', 'text'],
  ['f-armortype', 'armor.type', 'text'],
  ['f-dr', 'armor.dr', 'num'],
  ['s-wheels', 'subassemblies.wheels.present', 'bool'],
  ['s-wheeltype', 'subassemblies.wheels.type', 'text'],
  ['s-wheelcount', 'subassemblies.wheels.count', 'num'],
  ['s-wheelretract', 'subassemblies.wheels.retractable', 'bool'],
  ['s-tracks', 'subassemblies.tracks.present', 'bool'],
  ['s-halftracks', 'subassemblies.halftracks.present', 'bool'],
  ['s-skids', 'subassemblies.skids.present', 'bool'],
  ['s-wings', 'subassemblies.wings.present', 'bool'],
  ['s-wingtype', 'subassemblies.wings.type', 'text'],
  ['s-wingfrac', 'subassemblies.wings.volumeFrac', 'num'],
  ['s-rotors', 'subassemblies.rotors.present', 'bool'],
  ['s-turret', 'subassemblies.turret.present', 'bool'],
  ['s-turretvol', 'subassemblies.turret.volumeCf', 'num'],
  ['s-turretrot', 'subassemblies.turret.rotation', 'text'],
  ['s-masts', 'subassemblies.masts.present', 'bool'],
  ['s-mastheight', 'subassemblies.masts.heightFt', 'num'],
  ['s-gasbag', 'subassemblies.gasbag.present', 'bool'],
  ['s-gasbagcf', 'subassemblies.gasbag.cf', 'num'],
  ['f-crew', 'crew', 'num'],
  ['f-passengers', 'passengers', 'num'],
  ['f-cargocf', 'cargoCf', 'num'],
  ['f-emptycf', 'emptySpaceCf', 'num'],
  ['f-fueltype', 'fuel.type', 'text'],
  ['f-fuelgal', 'fuel.gallons', 'num'],
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
    const event = kind === 'bool' || el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(event, () => {
      const value = kind === 'bool' ? el.checked : kind === 'num' ? Number(el.value) || 0 : el.value;
      setPath(design, path, value);
      render();
    });
  }
}

function syncForm() {
  for (const [id, path, kind] of BINDINGS) {
    const el = $(id);
    const value = getPath(design, path);
    if (kind === 'bool') el.checked = !!value;
    else el.value = value;
  }
  renderComponents();
}

// --- Components ------------------------------------------------------------
function renderComponents() {
  const wrap = $('component-list');
  wrap.innerHTML = '';
  (design.components || []).forEach((c, i) => {
    const bits = [
      `${fmt(c.weight)} lb`, `$${fmt(c.cost)}`, `${fmt(c.volume, 2)} cf`,
      c.kwIn ? `needs ${fmt(c.kwIn, 1)} kW` : '',
      c.kwOut ? `puts out ${fmt(c.kwOut, 1)} kW` : '',
      c.groundKw ? `${fmt(c.groundKw, 1)} kW ground` : '',
      c.aquaticThrust ? `${fmt(c.aquaticThrust)} lb aquatic thrust` : '',
      c.airThrust ? `${fmt(c.airThrust)} lb aerial thrust` : '',
      c.staticLift ? `${fmt(c.staticLift)} lb lift` : '',
      c.contragravLift ? `${fmt(c.contragravLift)} lb contragrav` : '',
      c.airBreathing ? 'air-breathing' : '',
      c.location !== 'body' ? `in ${c.location}` : '',
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
  for (const id of ['c-name']) $(id).value = '';
  for (const id of ['c-weight', 'c-cost', 'c-volume', 'c-kwin', 'c-kwout', 'c-groundkw', 'c-aqua', 'c-air', 'c-lift', 'c-contragrav']) $(id).value = 0;
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

  $('sheet-name').textContent = design.name;
  $('sheet-sub').textContent = `TL${design.tl} · ${FRAME_STRENGTHS[design.structure.frame].name} frame, ${MATERIALS[design.structure.material].name.toLowerCase()} materials`;

  let html = '';

  html += '<h3>Size &amp; Structure</h3>';
  html += row('Body volume', `${fmt(r.volumes.body, 2)} cf`);
  for (const [k, v] of Object.entries(r.volumes)) {
    if (k !== 'body' && v > 0) html += row(`${cap(k)} volume`, `${fmt(v, 2)} cf`);
  }
  html += row('Total volume / Size Modifier', `${fmt(r.totalVolume, 1)} cf · SM ${r.stats.sm >= 0 ? '+' : ''}${r.stats.sm}`);
  html += row('Surface area (total / structural)', `${fmt(r.totalArea)} / ${fmt(r.structuralArea)} sf`);
  html += row('Structure', `${fmt(r.structure.weight)} lbs · $${fmt(r.structure.cost)}`);
  html += row('Armor', r.armor.dr > 0 ? `PD ${r.armor.pd}, DR ${r.armor.dr} · ${fmt(r.armor.weight)} lbs · $${fmt(r.armor.cost)}` : 'none');

  html += '<h3>Hit Points</h3>';
  const hpBits = Object.entries(r.hp).map(([k, v]) => `${cap(k.replace('per', ''))} ${v}`).join(' · ');
  html += `<p>${hpBits}</p>`;

  html += '<h3>Weights</h3>';
  html += row('Empty weight', `${fmt(r.weights.empty)} lbs`);
  html += row('Payload (people + cargo)', `${fmt(r.weights.payload)} lbs`);
  html += row('Fuel', `${fmt(r.weights.fuel)} lbs`);
  html += row('Loaded weight', `${fmt(r.weights.loaded)} lbs (${fmt(r.weights.loadedTons, 2)} tons)`);
  if (r.flotation > 0) html += row('Flotation', `${fmt(r.flotation)} lbs ${r.floats ? '— floats' : '— SINKS'}`);
  if (r.weights.submerged > 0) html += row('Submerged weight', `${fmt(r.weights.submerged)} lbs`);
  if (r.power.needed > 0 || r.power.available > 0) {
    html += row('Power', `${fmt(r.power.needed, 1)} kW needed / ${fmt(r.power.available, 1)} kW available`);
  }

  html += '<h3>Statistics</h3>';
  html += row('Health (HT)', r.stats.ht);
  html += row('Price', `$${fmt(r.stats.price)}`);

  if (r.perf.ground) {
    const g = r.perf.ground;
    html += '<h3>Ground Performance</h3>';
    html += row('Top speed', `${g.topSpeed} mph`);
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
    if (!a.canFly) html += row('Flight', '⚠️ cannot take off unaided');
  }

  $('sheet-body').innerHTML = html;

  const probs = $('problems');
  probs.innerHTML =
    r.errors.map((e) => `<li class="err">⛔ ${esc(e)}</li>`).join('') +
    r.warnings.map((w) => `<li class="warn">⚠️ ${esc(w)}</li>`).join('');
  $('problems-card').style.display = (r.errors.length || r.warnings.length) ? '' : 'none';
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// --- Toolbar ---------------------------------------------------------------
const KEY = 'gvb.ve2designs.v1';
const readAll = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };

function refreshSaved() {
  const names = Object.keys(readAll()).sort();
  fillSelect($('saved-select'), [['', names.length ? '— Saved designs —' : '— No saved designs —'], ...names.map((n) => [n, n])], '');
}

function replaceDesign(next) {
  design = { ...defaultVe2Design(), ...structuredClone(next) };
  design.features = { ...defaultVe2Design().features, ...(next.features || {}) };
  design.structure = { ...defaultVe2Design().structure, ...(next.structure || {}) };
  design.armor = { ...defaultVe2Design().armor, ...(next.armor || {}) };
  design.options = { ...defaultVe2Design().options, ...(next.options || {}) };
  design.fuel = { ...defaultVe2Design().fuel, ...(next.fuel || {}) };
  const subDefaults = defaultVe2Design().subassemblies;
  design.subassemblies = Object.fromEntries(
    Object.entries(subDefaults).map(([k, v]) => [k, { ...v, ...((next.subassemblies || {})[k] || {}) }])
  );
  design.components = structuredClone(next.components || []);
  syncForm();
  render();
}

function initToolbar() {
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
initGvbLibrary({ vehicleTl: () => design.tl, addEquipment: prefillFromGvb });
initToolbar();
refreshSaved();
syncForm();
render();
