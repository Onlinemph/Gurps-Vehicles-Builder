// ---------------------------------------------------------------------------
// GURPS Vehicles Builder — UI
// Binds the form to a design object, recomputes on every change, and renders
// the live stat block, weight/cost breakdowns, and warnings.
// ---------------------------------------------------------------------------

import {
  ACCESSORIES, ARMOR_MATERIALS, CAB_TYPES, CHASSIS, ENGINES, FACINGS,
  FRAME_QUALITIES, LOCATION_LEGEND, MOUNTS, STREAMLINING, TLS, WEAPONS,
} from './data.js';
import {
  accessoryAllowed, computeStats, defaultDesign, fmtCost, fmtLbs,
} from './engine.js';
import { downloadText, safeFilename, toMarkdown } from './export.js';
import { PRESETS } from './presets.js';
import { deleteDesign, listSaved, loadDesign, saveDesign } from './storage.js';
import { initGvbLibrary } from './gvb/ui-library.js';

let design = defaultDesign();
let lastResult = null;

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// Static form population
// ---------------------------------------------------------------------------
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

function initStaticControls() {
  fillSelect($('f-tl'), TLS.map((t) => [String(t), `TL ${t}`]), design.tl);
  fillSelect($('f-chassis'), Object.entries(CHASSIS).map(([k, v]) => [k, v.name]), design.chassis);
  fillSelect($('f-quality'), Object.entries(FRAME_QUALITIES).map(([k, v]) => [k, v.name]), design.quality);
  fillSelect($('f-streamlining'), Object.entries(STREAMLINING).map(([k, v]) => [k, v.name]), design.streamlining);
  fillSelect($('f-cab'), Object.entries(CAB_TYPES).map(([k, v]) => [k, v.name]), design.cab);
  fillSelect($('f-engine'), Object.entries(ENGINES).map(([k, v]) => [k, v.name]), design.engine);
  fillSelect($('f-armor-material'), Object.entries(ARMOR_MATERIALS).map(([k, v]) => [k, v.name]), design.armor.material);

  const presetSel = $('preset-select');
  fillSelect(presetSel, [['', '— Load a sample design —'], ...PRESETS.map((p, i) => [String(i), p.name])], '');

  // Location legend in help panel
  $('loc-legend').innerHTML = LOCATION_LEGEND
    .map(([c, d]) => `<li><b>${c}</b> — ${d}</li>`) .join('');
}

// ---------------------------------------------------------------------------
// Form <-> design syncing
// ---------------------------------------------------------------------------
const numberFields = [
  ['f-maxlwt', 'maxLWt'], ['f-power', 'power'], ['f-fuel', 'fuelLbs'],
  ['f-crew', 'crew'], ['f-passengers', 'passengers'], ['f-cargo', 'cargoLbs'],
  ['f-wheels', 'wheels'], ['f-length', 'lengthYds'],
];
const selectFields = [
  ['f-chassis', 'chassis'], ['f-quality', 'quality'],
  ['f-streamlining', 'streamlining'], ['f-cab', 'cab'], ['f-engine', 'engine'],
];

function bindInputs() {
  $('f-name').addEventListener('input', (e) => { design.name = e.target.value || 'Unnamed'; render(); });
  $('f-tl').addEventListener('change', (e) => { design.tl = Number(e.target.value); refreshDynamicForm(); render(); });

  for (const [id, key] of numberFields) {
    $(id).addEventListener('input', (e) => { design[key] = Number(e.target.value); render(); });
  }
  for (const [id, key] of selectFields) {
    $(id).addEventListener('change', (e) => {
      design[key] = e.target.value;
      if (key === 'chassis') applyChassisDefaults();
      refreshDynamicForm();
      render();
    });
  }
  $('f-armor-material').addEventListener('change', (e) => { design.armor.material = e.target.value; render(); });
  for (const f of FACINGS) {
    $(`f-dr-${f.key}`).addEventListener('input', (e) => { design.armor[f.key] = Number(e.target.value); render(); });
  }
  $('f-dr-all').addEventListener('input', (e) => {
    const v = Number(e.target.value) || 0;
    for (const f of FACINGS) {
      design.armor[f.key] = v;
      $(`f-dr-${f.key}`).value = v;
    }
    render();
  });
  $('f-length-auto').addEventListener('change', (e) => {
    design.lengthAuto = e.target.checked;
    $('f-length').disabled = design.lengthAuto;
    render();
  });
}

function applyChassisDefaults() {
  const c = CHASSIS[design.chassis];
  if (c.defaultCab) design.cab = c.defaultCab;
  if (c.defaultWheels) design.wheels = c.defaultWheels;
  $('f-cab').value = design.cab;
  $('f-wheels').value = design.wheels;
}

// Push the design's values into the form (used on load/import/preset).
function syncFormFromDesign() {
  $('f-name').value = design.name;
  $('f-tl').value = String(design.tl);
  for (const [id, key] of numberFields) $(id).value = design[key];
  for (const [id, key] of selectFields) $(id).value = design[key];
  $('f-armor-material').value = design.armor.material;
  for (const f of FACINGS) $(`f-dr-${f.key}`).value = design.armor[f.key];
  $('f-dr-all').value = '';
  $('f-length-auto').checked = design.lengthAuto;
  $('f-length').disabled = design.lengthAuto;
  refreshDynamicForm();
}

// Parts of the form whose contents depend on chassis/TL/engine choices.
function refreshDynamicForm() {
  const chassis = CHASSIS[design.chassis];
  const engine = ENGINES[design.engine];

  $('row-wheels').style.display = chassis.hasWheels ? '' : 'none';

  // Power & fuel labels
  const powerRow = $('row-power');
  powerRow.style.display = (engine.sail || engine.pedal) ? 'none' : '';
  const fuelLabel = $('label-fuel');
  const fuelRow = $('row-fuel');
  if (engine.electric) {
    fuelRow.style.display = '';
    fuelLabel.textContent = 'Battery weight (lbs)';
  } else if (engine.unlimited || engine.sail || engine.pedal) {
    fuelRow.style.display = 'none';
  } else {
    fuelRow.style.display = '';
    const f = engine.fuel;
    fuelLabel.textContent = f.lbPerGal
      ? `Fuel carried (lbs of ${f.label.toLowerCase()}; ${f.lbPerGal} lb/gal)`
      : `Fuel carried (lbs of ${f.label.toLowerCase()})`;
  }
  $('note-chassis').textContent = chassis.note || '';
  $('note-engine').textContent = engine.note || '';

  renderAccessories();
  renderWeapons();
  renderEquipment();
}

// ---------------------------------------------------------------------------
// Accessories
// ---------------------------------------------------------------------------
function renderAccessories() {
  const wrap = $('accessory-list');
  wrap.innerHTML = '';
  for (const [key, acc] of Object.entries(ACCESSORIES)) {
    if (!accessoryAllowed(acc, design)) continue;
    const disabled = design.tl < acc.minTL;
    const row = document.createElement('label');
    row.className = 'acc-row' + (disabled ? ' disabled' : '');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = design.accessories.includes(key);
    cb.disabled = disabled;
    cb.addEventListener('change', () => {
      if (cb.checked) design.accessories.push(key);
      else design.accessories = design.accessories.filter((k) => k !== key);
      render();
    });
    const info = document.createElement('span');
    info.innerHTML = `<b>${acc.name}</b> <small>TL${acc.minTL}+ · $${acc.cost.toLocaleString('en-US')}${acc.note ? ' · ' + acc.note : ''}</small>`;
    row.append(cb, info);
    wrap.appendChild(row);
  }
  // Drop selected accessories that no longer apply to this chassis.
  design.accessories = design.accessories.filter((k) => ACCESSORIES[k] && accessoryAllowed(ACCESSORIES[k], design));
}

// ---------------------------------------------------------------------------
// Equipment (custom gear and GVB library components)
// ---------------------------------------------------------------------------
function renderEquipment() {
  const wrap = $('equipment-list');
  wrap.innerHTML = '';
  (design.equipment || []).forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'weapon-row';
    row.innerHTML = `
      <span class="weapon-name">${escapeHtml(item.name)}</span>
      <span class="weapon-detail">${fmtLbs(item.weight)} · ${fmtCost(item.cost)}${item.note ? ' · ' + escapeHtml(item.note) : ''}</span>`;
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn small danger';
    del.textContent = '✕';
    del.title = 'Remove item';
    del.addEventListener('click', () => { design.equipment.splice(i, 1); renderEquipment(); render(); });
    row.appendChild(del);
    wrap.appendChild(row);
  });
  if (!design.equipment || !design.equipment.length) {
    wrap.innerHTML = '<p class="muted">No extra equipment.</p>';
  }
}

function addEquipment(item) {
  if (!design.equipment) design.equipment = [];
  design.equipment.push(item);
  renderEquipment();
  render();
  flash(`Added “${item.name}”.`);
}

function initEquipmentAdder() {
  $('equip-add').addEventListener('click', () => {
    const name = $('equip-name').value.trim() || 'Custom equipment';
    addEquipment({
      name,
      weight: Number($('equip-weight').value) || 0,
      cost: Number($('equip-cost').value) || 0,
      note: '',
    });
    $('equip-name').value = '';
    $('equip-weight').value = '';
    $('equip-cost').value = '';
  });
}

// ---------------------------------------------------------------------------
// Weapons
// ---------------------------------------------------------------------------
function renderWeapons() {
  const wrap = $('weapon-list');
  wrap.innerHTML = '';
  design.weapons.forEach((w, i) => {
    const row = document.createElement('div');
    row.className = 'weapon-row';
    row.innerHTML = `
      <span class="weapon-name">${w.qty > 1 ? w.qty + '× ' : ''}${escapeHtml(w.name)}</span>
      <span class="weapon-detail">${MOUNTS[w.mount].name} · ${fmtLbs(w.weight * MOUNTS[w.mount].weightMult * w.qty)} · ${fmtCost(w.cost * MOUNTS[w.mount].costMult * w.qty)}${w.dmg ? ' · ' + escapeHtml(w.dmg) : ''}</span>`;
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn small danger';
    del.textContent = '✕';
    del.title = 'Remove weapon';
    del.addEventListener('click', () => { design.weapons.splice(i, 1); renderWeapons(); render(); });
    row.appendChild(del);
    wrap.appendChild(row);
  });
  if (!design.weapons.length) {
    wrap.innerHTML = '<p class="muted">No weapons mounted.</p>';
  }
}

function initWeaponAdder() {
  const sel = $('weapon-select');
  fillSelect(sel, [
    ...WEAPONS.map((w) => [w.key, `${w.name} (TL${w.minTL}, ${w.weight} lb, $${w.cost.toLocaleString('en-US')})`]),
    ['custom', 'Custom weapon…'],
  ], WEAPONS[0].key);
  fillSelect($('weapon-mount'), Object.entries(MOUNTS).map(([k, v]) => [k, v.name]), 'fixed');

  sel.addEventListener('change', () => {
    $('weapon-custom').style.display = sel.value === 'custom' ? '' : 'none';
  });

  $('weapon-add').addEventListener('click', () => {
    const mount = $('weapon-mount').value;
    const qty = Math.max(Number($('weapon-qty').value) || 1, 1);
    let entry;
    if (sel.value === 'custom') {
      entry = {
        name: $('weapon-c-name').value || 'Custom weapon',
        weight: Number($('weapon-c-weight').value) || 0,
        cost: Number($('weapon-c-cost').value) || 0,
        dmg: $('weapon-c-dmg').value || '',
        mount, qty,
      };
    } else {
      const preset = WEAPONS.find((w) => w.key === sel.value);
      entry = { name: preset.name, weight: preset.weight, cost: preset.cost, dmg: preset.dmg, minTL: preset.minTL, mount, qty };
    }
    design.weapons.push(entry);
    renderWeapons();
    render();
  });
}

// ---------------------------------------------------------------------------
// Output rendering
// ---------------------------------------------------------------------------
function fmtSigned(n) { return n > 0 ? `+${n}` : String(n); }

function render() {
  lastResult = computeStats(design);
  const { stats: s, weights: w, costs: c, errors, warnings } = lastResult;

  $('sheet-name').textContent = design.name;
  $('sheet-sub').textContent =
    `TL${design.tl} ${CHASSIS[design.chassis].name} · ${ENGINES[design.engine].name}` +
    (s.power ? ` · ${s.power} hp` : '');

  const range = s.rangeMi === null ? '—' : `${s.rangeMi.toLocaleString('en-US')} mi`;
  const cells = [
    ['ST/HP', s.stHp],
    ['Hnd/SR', `${fmtSigned(s.hnd)}/${s.sr}`],
    ['HT', `${s.ht}${s.htSuffix}`],
    ['Move', s.moveStr],
    ['LWt.', s.lwtTons],
    ['Load', s.loadTons],
    ['SM', fmtSigned(s.sm)],
    ['Occ.', s.occ],
    ['DR', s.dr],
    ['Range', range],
    ['Cost', fmtCost(s.cost)],
    ['Locations', s.locations],
  ];
  $('stat-table').innerHTML =
    '<tr>' + cells.map(([h]) => `<th>${h}</th>`).join('') + '</tr>' +
    '<tr>' + cells.map(([, v]) => `<td>${v}</td>`).join('') + '</tr>';

  const extra = [];
  extra.push(`Top speed <b>${s.topMph} mph</b> (${s.topYps} yds/sec), cruise ${s.cruiseMph} mph.`);
  if (s.stallMph !== null) extra.push(`Stall speed <b>${s.stallMph} mph</b>.`);
  extra.push(`Length ~${s.lengthYds} yds · ${s.hpPerTon} hp/ton · hull area ~${s.areaSqFt.toLocaleString('en-US')} sq ft.`);
  $('sheet-extra').innerHTML = extra.map((t) => `<li>${t}</li>`).join('');

  // Weight budget
  const pct = Math.min((w.loaded / w.maxLWt) * 100, 100);
  const bar = $('weight-bar-fill');
  bar.style.width = `${pct}%`;
  bar.classList.toggle('over', w.loaded > w.maxLWt);
  $('weight-bar-label').textContent =
    `${Math.round(w.loaded).toLocaleString('en-US')} / ${Math.round(w.maxLWt).toLocaleString('en-US')} lb ` +
    (w.remaining >= 0 ? `(${Math.round(w.remaining).toLocaleString('en-US')} lb spare)` : `(over by ${Math.round(-w.remaining).toLocaleString('en-US')} lb!)`);

  $('weight-breakdown').innerHTML = breakdownRows([
    ['Structure', w.structure], ['Powerplant', w.engine],
    ['Batteries', w.battery], ['Fuel', w.fuel], ['Armor', w.armor],
    ['Seats & controls', w.seats], ['Accessories', w.accessories],
    ['Equipment', w.equipment], ['Weapons', w.weapons],
    ['Occupants', w.occupants], ['Cargo', w.cargo],
  ], fmtLbs, w.loaded);

  $('cost-breakdown').innerHTML = breakdownRows([
    ['Frame', c.frame], ['Powerplant', c.engine], ['Batteries', c.battery],
    ['Armor', c.armor], ['Seats & controls', c.seats],
    ['Accessories', c.accessories], ['Equipment', c.equipment],
    ['Weapons', c.weapons],
  ], fmtCost, c.subtotal) +
    `<div class="bd-row total"><span>Total (incl. 20% assembly)</span><span>${fmtCost(c.total)}</span></div>`;

  // Problems
  const probs = $('problems');
  probs.innerHTML =
    errors.map((e) => `<li class="err">⛔ ${e}</li>`).join('') +
    warnings.map((e) => `<li class="warn">⚠️ ${e}</li>`).join('');
  $('problems-card').style.display = (errors.length || warnings.length) ? '' : 'none';
}

function breakdownRows(rows, fmt, total) {
  return rows
    .filter(([, v]) => v > 0.5)
    .map(([label, v]) => {
      const pct = total > 0 ? Math.round((v / total) * 100) : 0;
      return `<div class="bd-row"><span>${label}</span><span>${fmt(v)} <small>(${pct}%)</small></span></div>`;
    })
    .join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// ---------------------------------------------------------------------------
// Toolbar: presets, save/load, import/export, print
// ---------------------------------------------------------------------------
function replaceDesign(next) {
  design = { ...defaultDesign(), ...structuredClone(next) };
  design.armor = { ...defaultDesign().armor, ...(next.armor || {}) };
  design.accessories = [...(next.accessories || [])];
  design.weapons = structuredClone(next.weapons || []);
  design.equipment = structuredClone(next.equipment || []);
  syncFormFromDesign();
  render();
}

function refreshSavedList() {
  const sel = $('saved-select');
  const names = listSaved();
  fillSelect(sel, [['', names.length ? '— Saved designs —' : '— No saved designs —'], ...names.map((n) => [n, n])], '');
}

function initToolbar() {
  $('preset-select').addEventListener('change', (e) => {
    const idx = e.target.value;
    if (idx === '') return;
    replaceDesign(PRESETS[Number(idx)]);
    e.target.value = '';
  });

  $('btn-new').addEventListener('click', () => {
    if (!confirm('Start a new design? Unsaved changes will be lost.')) return;
    replaceDesign(defaultDesign());
  });

  $('btn-save').addEventListener('click', () => {
    saveDesign(structuredClone(design));
    refreshSavedList();
    flash(`Saved “${design.name}” to this browser.`);
  });

  $('saved-select').addEventListener('change', (e) => {
    const name = e.target.value;
    if (!name) return;
    const d = loadDesign(name);
    if (d) replaceDesign(d);
    e.target.value = '';
  });

  $('btn-delete').addEventListener('click', () => {
    const names = listSaved();
    if (!names.length) return flash('Nothing saved yet.');
    const name = prompt(`Delete which design?\n${names.join('\n')}`, design.name);
    if (name && names.includes(name)) {
      deleteDesign(name);
      refreshSavedList();
      flash(`Deleted “${name}”.`);
    }
  });

  $('btn-export-json').addEventListener('click', () => {
    downloadText(`${safeFilename(design.name)}.gvb.json`, JSON.stringify(design, null, 2), 'application/json');
  });

  $('btn-import-json').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    file.text().then((text) => {
      try {
        const d = JSON.parse(text);
        if (!d || typeof d !== 'object' || !d.chassis) throw new Error('not a design');
        replaceDesign(d);
        flash(`Imported “${design.name}”.`);
      } catch {
        alert('That file is not a valid vehicle design JSON.');
      }
      e.target.value = '';
    });
  });

  $('btn-export-md').addEventListener('click', () => {
    const md = toMarkdown(design, lastResult);
    $('md-output').value = md;
    $('md-modal').showModal();
  });
  $('md-copy').addEventListener('click', () => {
    navigator.clipboard.writeText($('md-output').value).then(() => flash('Copied to clipboard.'));
  });
  $('md-download').addEventListener('click', () => {
    downloadText(`${safeFilename(design.name)}.md`, $('md-output').value, 'text/markdown');
  });
  $('md-close').addEventListener('click', () => $('md-modal').close());

  $('btn-print').addEventListener('click', () => window.print());

  $('btn-help').addEventListener('click', () => {
    $('help-panel').classList.toggle('open');
  });
}

let flashTimer = null;
function flash(msg) {
  const el = $('flash');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
initStaticControls();
bindInputs();
initWeaponAdder();
initEquipmentAdder();
initGvbLibrary({ vehicleTl: () => design.tl, addEquipment });
initToolbar();
refreshSavedList();
syncFormFromDesign();
render();
