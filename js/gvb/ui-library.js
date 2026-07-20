// ---------------------------------------------------------------------------
// "GVB Library" modal: import repository (.rep) files from the official
// GURPS Vehicle Builder program (which the user owns), browse the component
// templates, configure one, and add its computed weight/cost to the design
// as an equipment line.
// ---------------------------------------------------------------------------

import { parseTpf0 } from './parser.js';
import { defaultInputs, evaluateTemplate, normalizeRepository } from './library.js';

let templates = [];        // all imported templates
let selected = null;       // currently selected template
let inputs = null;         // current inputs for the selected template
let getVehicleTl = () => 8;
let onAddEquipment = () => {};

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function initGvbLibrary({ vehicleTl, addEquipment }) {
  getVehicleTl = vehicleTl;
  onAddEquipment = addEquipment;

  $('btn-gvb').addEventListener('click', () => {
    $('gvb-modal').showModal();
    renderList();
  });
  $('gvb-close').addEventListener('click', () => $('gvb-modal').close());

  $('gvb-files').addEventListener('change', async (e) => {
    await importFiles([...e.target.files]);
    e.target.value = '';
  });
  $('gvb-search').addEventListener('input', renderList);
}

async function importFiles(files) {
  const failures = [];
  for (const file of files) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const root = parseTpf0(bytes);
      const source = file.name.replace(/\.rep$/i, '');
      // Replace any previous import of the same file.
      templates = templates.filter((t) => t.source !== source);
      templates.push(...normalizeRepository(root, source));
    } catch (err) {
      failures.push(`${file.name}: ${err.message}`);
    }
  }
  templates.sort((a, b) => a.source.localeCompare(b.source) || a.name.localeCompare(b.name) || a.tl - b.tl);
  $('gvb-status').textContent =
    `${templates.length} components loaded` + (failures.length ? ` — failed: ${failures.join('; ')}` : '');
  renderList();
}

function renderList() {
  const list = $('gvb-list');
  const q = $('gvb-search').value.trim().toLowerCase();
  const shown = templates.filter((t) => !q || t.name.toLowerCase().includes(q) || t.source.toLowerCase().includes(q));

  if (!templates.length) {
    list.innerHTML = '<p class="muted">No data loaded yet. Use “Load .rep files…” above and pick the files from your GVB <code>repositories</code> folder (you can select them all at once).</p>';
    return;
  }
  let html = '';
  let lastSource = null;
  for (const [i, t] of shown.entries()) {
    if (t.source !== lastSource) {
      lastSource = t.source;
      html += `<div class="gvb-group">${esc(t.source)}</div>`;
    }
    const idx = templates.indexOf(t);
    html += `<button type="button" class="gvb-item${t === selected ? ' sel' : ''}" data-idx="${idx}">` +
      `${esc(t.name)} <small>TL${t.tl}</small></button>`;
    if (i > 800) { html += '<p class="muted">…more matches — narrow the search.</p>'; break; }
  }
  list.innerHTML = html || '<p class="muted">No matches.</p>';
  list.querySelectorAll('.gvb-item').forEach((el) => {
    el.addEventListener('click', () => selectTemplate(templates[Number(el.dataset.idx)]));
  });
}

function selectTemplate(tpl) {
  selected = tpl;
  inputs = defaultInputs(tpl, getVehicleTl());
  inputs.context = {};
  renderList();
  renderDetail();
}

function usesVar(tpl, name) {
  const re = new RegExp(name, 'i');
  return Object.entries(tpl.props).some(([k, v]) => k.endsWith('Formula') && typeof v === 'string' && re.test(v));
}

function renderDetail() {
  const box = $('gvb-detail');
  if (!selected) {
    box.innerHTML = '<p class="muted">Select a component on the left.</p>';
    return;
  }
  const t = selected;
  const showRating = !!t.ratingName || usesVar(t, 'vrating');
  const showUnits = !!t.unitsName || usesVar(t, 'vunits');

  let html = `<h3>${esc(t.name)} <small>TL${t.tl} · ${esc(t.class)} · ${esc(t.source)}</small></h3>`;
  html += '<div class="gvb-inputs">';
  html += `<label>TL <input type="number" id="gvb-in-tl" min="0" max="16" value="${inputs.tl}"></label>`;
  html += `<label>${esc(t.quantityName)} <input type="number" id="gvb-in-qty" min="${t.quantityMin}" max="${t.quantityMax}" value="${inputs.quantity}"></label>`;
  if (showRating) html += `<label>${esc(t.ratingName || 'Rating')} <input type="number" id="gvb-in-rating" step="any" value="${inputs.rating}"></label>`;
  if (showUnits) html += `<label>${esc(t.unitsName || 'Units')} <input type="number" id="gvb-in-units" step="any" value="${inputs.units}"></label>`;
  html += '</div>';

  if (t.radios.length) {
    html += `<p class="gvb-opt-head">${esc(t.radioDesc)}</p><div class="gvb-opts">` + t.radios
      .map((r) => `<label class="inline"><input type="radio" name="gvb-radio" value="${r.n}" ${inputs.radio === r.n ? 'checked' : ''}> ${esc(r.label)}</label>`)
      .join('') + '</div>';
  }
  if (t.checks.length) {
    html += `<p class="gvb-opt-head">${esc(t.checkDesc)}</p><div class="gvb-opts">` + t.checks
      .map((c) => `<label class="inline"><input type="checkbox" class="gvb-check" value="${c.n}" ${inputs.checks.has(c.n) ? 'checked' : ''}> ${esc(c.label)}</label>`)
      .join('') + '</div>';
  }

  html += '<div id="gvb-context"></div>';
  html += '<div id="gvb-outputs" class="gvb-outputs"></div>';
  html += `<div class="modal-actions"><button type="button" class="btn primary" id="gvb-add">Add to design</button></div>`;
  if (t.description) html += `<p class="muted gvb-desc">${esc(t.description)}</p>`;
  box.innerHTML = html;

  const bindNum = (id, key) => {
    const el = $(id);
    if (el) el.addEventListener('input', () => { inputs[key] = Number(el.value) || 0; renderOutputs(); });
  };
  bindNum('gvb-in-tl', 'tl');
  bindNum('gvb-in-qty', 'quantity');
  bindNum('gvb-in-rating', 'rating');
  bindNum('gvb-in-units', 'units');
  box.querySelectorAll('input[name="gvb-radio"]').forEach((el) => {
    el.addEventListener('change', () => { inputs.radio = Number(el.value); renderOutputs(); });
  });
  box.querySelectorAll('.gvb-check').forEach((el) => {
    el.addEventListener('change', () => {
      const n = Number(el.value);
      if (el.checked) inputs.checks.add(n); else inputs.checks.delete(n);
      renderOutputs();
    });
  });
  $('gvb-add').addEventListener('click', addToDesign);
  renderOutputs();
}

const OUTPUT_LABELS = [
  ['weight', 'Weight', (v) => `${fmt(v)} lb`],
  ['cost', 'Cost', (v) => `$${fmt(v)}`],
  ['volume', 'Volume', (v) => `${fmt(v)} cf`],
  ['powerIn', 'Power required', (v) => `${fmt(v)} kW`],
  ['powerOut', 'Power output', (v) => `${fmt(v)} kW`],
  ['fuelConsumption', 'Fuel use', (v, u) => `${fmt(v)} ${u || 'gph'}`],
  ['motivePower', 'Motive power', (v) => `${fmt(v)} kW`],
  ['motiveThrust', 'Motive thrust', (v) => `${fmt(v)} lb`],
  ['lift', 'Lift', (v) => `${fmt(v)} lb`],
  ['crew', 'Maintenance crew', (v) => fmt(v)],
];

function fmt(v) {
  const r = Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 100) / 100;
  return r.toLocaleString('en-US');
}

let lastResult = null;

function renderOutputs() {
  if (!selected) return;
  const result = evaluateTemplate(selected, inputs);
  lastResult = result;

  // Prompt for any vehicle-level variables the formulas want.
  const ctxBox = $('gvb-context');
  const unknowns = [...result.unknown];
  if (unknowns.length) {
    ctxBox.innerHTML = '<p class="gvb-opt-head">This component needs vehicle values:</p><div class="gvb-inputs">' +
      unknowns.map((u) => {
        const key = u.toLowerCase();
        const val = inputs.context[key] ?? '';
        return `<label>${esc(u.replace(/^v/i, '').replace(/_/g, ' '))} <input type="number" step="any" class="gvb-ctx" data-key="${esc(key)}" value="${val}"></label>`;
      }).join('') + '</div>';
    ctxBox.querySelectorAll('.gvb-ctx').forEach((el) => {
      el.addEventListener('input', () => {
        inputs.context[el.dataset.key] = Number(el.value) || 0;
        renderOutputs();
      });
    });
  } else {
    ctxBox.innerHTML = '';
  }

  const rows = OUTPUT_LABELS
    .filter(([k]) => result[k] !== 0 || k === 'weight' || k === 'cost')
    .map(([k, label, f]) => `<div class="bd-row"><span>${label}</span><span>${f(result[k], selected.fuelUnit)}</span></div>`)
    .join('');
  const errs = result.errors.map((e) => `<p class="muted">⚠️ ${esc(e)}</p>`).join('');
  $('gvb-outputs').innerHTML = rows + errs;
}

function addToDesign() {
  if (!selected || !lastResult) return;
  const t = selected;
  const qty = inputs.quantity;
  const ratingStr = (t.ratingName && inputs.rating !== 1) ? ` ${inputs.rating} ${t.ratingName}` : '';
  onAddEquipment({
    name: `${qty > 1 ? `${qty}× ` : ''}${t.name}${ratingStr} (TL${inputs.tl})`,
    weight: lastResult.weight,
    cost: lastResult.cost,
    note: `GVB ${t.source}` +
      (lastResult.powerIn ? ` · needs ${fmt(lastResult.powerIn)} kW` : '') +
      (lastResult.powerOut ? ` · provides ${fmt(lastResult.powerOut)} kW` : ''),
  }, { template: t, inputs, result: lastResult });
  $('gvb-modal').close();
}
