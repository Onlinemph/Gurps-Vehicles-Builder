// ---------------------------------------------------------------------------
// GURPS Spaceships designer — UI. Binds spaceships.html to a design object
// and renders the computed stat block on every change.
// ---------------------------------------------------------------------------

import { BOOKS, FEATURES, HULLS, SECTIONS, SMS, fmtCost } from './tables.js';
import { SYSTEMS } from './systems.js';
import './systems-books.js';
import { computeShip, defaultShip } from './ship.js';
import { toSsMarkdown } from './export.js';
import { SS_PRESETS } from './presets.js';
import { initExplain, refreshExplain } from '../help-core.js';
import { FIELD_HELP, SECTION_HELP, STAT_HELP } from './help.js';

let design = defaultShip();

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (x, d = 0) => (Math.round(x * 10 ** d) / 10 ** d).toLocaleString('en-US');

// Option controls per system. type: 'int', 'choice' or 'check'.
const WEAPON_TYPE = { key: 'weaponType', label: 'type', type: 'choice', choices: [['beam', 'beam'], ['gun', 'gun'], ['missile', 'missile launcher']] };
const OPT_DEFS = {
  habitat: [
    { key: 'luxury', label: 'luxury', type: 'int' },
    { key: 'bunkrooms', label: 'bunkrooms', type: 'int' },
    { key: 'cells', label: 'cells', type: 'int' },
    { key: 'sickbay', label: 'sickbay beds', type: 'int' },
    { key: 'automed', label: 'automed beds', type: 'int' },
    { key: 'steerage', label: 'steerage', type: 'int' },
    { key: 'hibernation', label: 'hibernation', type: 'int' },
    { key: 'growthTanks', label: 'growth tanks', type: 'int' },
    { key: 'offices', label: 'offices', type: 'int' },
    { key: 'briefing', label: 'briefing', type: 'int' },
    { key: 'labs', label: 'labs', type: 'int' },
    { key: 'establishments', label: 'establishments', type: 'int' },
    { key: 'tlsCabins', label: 'total-LS cabins', type: 'int' },
  ],
  cargoHold: [{ key: 'reactionMass', label: 'reaction mass (counts as fuel tank)', type: 'check' }],
  battery_spinal: [WEAPON_TYPE],
  controlRoom: [{ key: 'removeStations', label: 'stations removed', type: 'int' }],
  gasbag: [{ key: 'gas', label: 'gas', type: 'choice', choices: [['lifting', 'lifting gas'], ['antigravity', 'antigravity gas (×5)']] }],
  digestiveSystem: [{ key: 'damageType', label: 'digests by', type: 'choice', choices: [['crushing', 'crushing (½ cost)'], ['burning', 'burning'], ['cutting', 'cutting'], ['corrosion', 'corrosion']] }],
  parachronicFlux: [
    { key: 'timeFlux', label: 'time travel (×10)', type: 'check' },
    { key: 'anywhere', label: 'anywhere (×25)', type: 'check' },
    { key: 'speedLimited', label: 'speed-limited (×½)', type: 'check' },
  ],
  tachyonSail: [{ key: 'hypersail', label: 'hypersail (×2)', type: 'check' }],
  sapientBrain: [{ key: 'psionic', label: 'psionic (×4)', type: 'check' }],
  turbofan: [{ key: 'afterburning', label: 'afterburning (×1.5)', type: 'check' }],
  maw: [{ key: 'cutting', label: 'cutting (×1.5)', type: 'check' }],
  tail: [{ key: 'tailType', label: 'variant', type: 'choice', choices: [['striking', 'striking'], ['impaling', 'impaling'], ['prehensile', 'prehensile'], ['weapon', 'weapon tail']] }],
  fusionPulse: [{ key: 'amAugmented', label: 'antimatter-augmented (SS8)', type: 'check' }],
  advFusionPulse: [{ key: 'amAugmented', label: 'antimatter-augmented (SS8)', type: 'check' }],
};
for (const key of ['battery_major', 'battery_medium', 'battery_secondary', 'battery_tertiary']) {
  OPT_DEFS[key] = [
    { key: 'count', label: 'weapons', type: 'int', min: 1 },
    WEAPON_TYPE,
    { key: 'mount', label: 'mount', type: 'choice', choices: [['turret', 'turrets'], ['fixed', 'fixed']] },
  ];
}
for (const key of ['fusionReactor', 'antimatterReactor', 'superFusionReactor', 'vacuumEnergy']) {
  OPT_DEFS[key] = [{ key: 'deRate', label: 'de-rate (-PP)', type: 'int' }];
}

// SS7's magic/psi power option applies to any high-energy system.
const POWERED_OPT = { key: 'powered', label: 'powered by', type: 'choice', choices: [['normal', 'normal PP'], ['magic', 'magic PP (½ cost)'], ['psi', 'psi PP (½ cost)']] };

function bookOn(source) {
  if (!source) return true;
  return source.split('/').some((b) => design.books?.[b] !== false);
}

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

function sysLabel(s) {
  const bang = s.he ? ' [!]' : '';
  const tl = s.tl ? `TL${s.tl}${s.superscience ? '^' : ''}` : (s.superscience ? 'TL^' : 'TL0');
  const book = s.source ? ` · ${s.source}` : '';
  return `${s.name}${bang} (${tl}${book})`;
}

function systemSelect(current, { coreOnly = false } = {}) {
  const sel = document.createElement('select');
  const none = document.createElement('option');
  none.value = '';
  none.textContent = '— empty —';
  sel.appendChild(none);
  const byCat = {};
  for (const s of Object.values(SYSTEMS)) {
    if (coreOnly && !s.core) continue;
    if (!bookOn(s.source) && s.key !== current) continue;
    (byCat[s.category] ||= []).push(s);
  }
  for (const [cat, list] of Object.entries(byCat)) {
    const og = document.createElement('optgroup');
    og.label = cat;
    for (const s of list) {
      const opt = document.createElement('option');
      opt.value = s.key;
      opt.textContent = sysLabel(s);
      if (s.key === current) opt.selected = true;
      og.appendChild(opt);
    }
    sel.appendChild(og);
  }
  return sel;
}

// --- Sections & cores ------------------------------------------------------
function renderSections() {
  const host = $('sections');
  host.innerHTML = '';
  for (const section of SECTIONS) {
    const h3 = document.createElement('h3');
    h3.textContent = `${section[0].toUpperCase()}${section.slice(1)} hull`;
    host.appendChild(h3);
    design.sections[section].forEach((slotDef, i) => {
      host.appendChild(slotRow(slotDef, `[${i + 1}]`, () => {}, { section, index: i }));
    });
  }
}

function renderCores() {
  const host = $('cores');
  host.innerHTML = '';
  design.cores.forEach((core, i) => {
    const row = document.createElement('div');
    row.className = 'slot-row';
    const num = document.createElement('span');
    num.className = 'slot-num';
    num.textContent = '[core]';
    row.appendChild(num);

    const secSel = document.createElement('select');
    secSel.className = 'slot-section';
    fillSelect(secSel, SECTIONS.map((s) => [s, `${s} hull`]), core.section);
    secSel.addEventListener('change', () => {
      core.section = secSel.value;
      update();
    });
    row.appendChild(secSel);

    const sysSel = systemSelect(core.sys, { coreOnly: true });
    sysSel.addEventListener('change', () => {
      core.sys = sysSel.value || null;
      core.opts = {};
      update();
    });
    row.appendChild(sysSel);

    row.appendChild(optControls(core));
    row.appendChild(descSpan(core, core.section, true));
    host.appendChild(row);
  });
}

function slotRow(slotDef, label, _onChange, pos) {
  const row = document.createElement('div');
  row.className = 'slot-row';
  const num = document.createElement('span');
  num.className = 'slot-num';
  num.textContent = label;
  row.appendChild(num);

  const sel = systemSelect(slotDef.sys);
  sel.addEventListener('change', () => {
    slotDef.sys = sel.value || null;
    slotDef.opts = {};
    slotDef.sub = undefined;
    update();
  });
  row.appendChild(sel);

  // SS7/SS8 scaling: half size, three one-SM-smaller systems, or one
  // SM-larger system spanning three slots.
  if (slotDef.sys && (bookOn('SS7') || bookOn('SS8') || slotDef.scale)) {
    const scaleSel = document.createElement('select');
    scaleSel.className = 'slot-scale';
    fillSelect(scaleSel, [
      ['normal', 'full size'], ['half', 'half (½ cost)'],
      ['smaller', 'smaller ×3 (one slot)'], ['larger', 'larger (3 slots)'],
    ], slotDef.scale || 'normal');
    scaleSel.addEventListener('change', () => {
      slotDef.scale = scaleSel.value === 'normal' ? undefined : scaleSel.value;
      if (slotDef.scale === 'smaller' && !slotDef.sub) {
        slotDef.sub = [0, 1, 2].map(() => ({ sys: slotDef.sys, opts: {} }));
      }
      if (slotDef.scale !== 'smaller') slotDef.sub = undefined;
      update();
    });
    row.appendChild(scaleSel);
  }

  if (slotDef.scale !== 'smaller') row.appendChild(optControls(slotDef));
  row.appendChild(descSpan(slotDef, pos.section, false));

  if (slotDef.scale === 'smaller') {
    slotDef.sub ||= [0, 1, 2].map(() => ({ sys: slotDef.sys, opts: {} }));
    const subWrap = document.createElement('div');
    subWrap.className = 'slot-subs';
    slotDef.sub.forEach((sub, j) => {
      const subRow = document.createElement('div');
      subRow.className = 'slot-row slot-sub';
      const tag = document.createElement('span');
      tag.className = 'slot-num';
      tag.textContent = `· ${'abc'[j]}`;
      subRow.appendChild(tag);
      const subSel = systemSelect(sub.sys);
      subSel.addEventListener('change', () => {
        sub.sys = subSel.value || null;
        sub.opts = {};
        update();
      });
      subRow.appendChild(subSel);
      subRow.appendChild(optControls(sub));
      subRow.appendChild(subDesc(sub));
      subWrap.appendChild(subRow);
    });
    row.appendChild(subWrap);
  }
  return row;
}

function subDesc(sub) {
  const span = document.createElement('small');
  span.className = 'slot-desc';
  if (sub.sys) {
    const entry = SYSTEMS[sub.sys];
    const sm = design.sm - 1;
    if (sm < 4) { span.textContent = 'no SM+3 systems exist'; span.classList.add('slot-bad'); return span; }
    const info = entry.info(sm, design.tl, sub.opts, { streamlined: design.streamlined }) || {};
    const cost = entry.cost(sm, design.tl, sub.opts) || 0;
    span.textContent = `at SM+${sm}: ${info.desc || ''} · ${fmtCost(cost)}`;
    if (info.invalid) span.classList.add('slot-bad');
  }
  return span;
}

function optControls(slotDef) {
  const wrap = document.createElement('span');
  wrap.className = 'slot-opts';
  if (!slotDef.sys) return wrap;
  const defs = [...(OPT_DEFS[slotDef.sys] || [])];
  const entry = SYSTEMS[slotDef.sys];
  if (entry?.he > 0 && bookOn('SS7')) defs.push(POWERED_OPT);
  for (const def of defs) {
    const lab = document.createElement('label');
    if (def.type === 'check') {
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!slotDef.opts[def.key];
      cb.addEventListener('change', () => {
        slotDef.opts[def.key] = cb.checked;
        update();
      });
      lab.append(cb, ` ${def.label}`);
      wrap.appendChild(lab);
      continue;
    }
    lab.append(`${def.label} `);
    if (def.type === 'choice') {
      const sel = document.createElement('select');
      fillSelect(sel, def.choices, slotDef.opts[def.key] ?? def.choices[0][0]);
      sel.addEventListener('change', () => {
        slotDef.opts[def.key] = sel.value;
        update();
      });
      lab.appendChild(sel);
    } else {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.min = String(def.min ?? 0);
      inp.step = '1';
      inp.value = String(slotDef.opts[def.key] ?? def.min ?? 0);
      inp.addEventListener('change', () => {
        slotDef.opts[def.key] = Math.max(def.min ?? 0, Math.floor(Number(inp.value) || 0));
        update();
      });
      lab.appendChild(inp);
    }
    wrap.appendChild(lab);
  }
  return wrap;
}

function descSpan(slotDef, section, isCore) {
  const span = document.createElement('small');
  span.className = 'slot-desc';
  if (slotDef.sys) {
    const entry = SYSTEMS[slotDef.sys];
    const info = entry.info(design.sm, design.tl, slotDef.opts, { streamlined: design.streamlined }) || {};
    const cost = entry.cost(design.sm, design.tl, slotDef.opts) || 0;
    const bits = [];
    if (info.desc) bits.push(info.desc);
    if (info.note) bits.push(info.note);
    bits.push(fmtCost(cost));
    span.textContent = bits.join(' · ');
    if (info.invalid) span.classList.add('slot-bad');
  }
  return span;
}

// --- Features --------------------------------------------------------------
function renderFeatures() {
  const host = $('features');
  host.innerHTML = '';
  for (const [key, f] of Object.entries(FEATURES)) {
    if (!bookOn(f.source) && !design.features[key]) continue;
    const label = document.createElement('label');
    label.className = 'acc-row';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!design.features[key];
    cb.addEventListener('change', () => {
      design.features[key] = cb.checked;
      update();
    });
    const span = document.createElement('span');
    const cost = featureCostStr(key, f);
    const book = f.source ? ` · ${f.source}` : '';
    span.innerHTML = `<b>${esc(f.name)}</b> <small>TL${f.tl}${book}${cost ? ` · ${cost}` : ''}${f.help ? ` — ${esc(f.help)}` : ''}</small>`;
    label.append(cb, ' ', span);
    host.appendChild(label);
  }
}

function featureCostStr(key, f) {
  const smI = design.sm - 4;
  if (f.cost) {
    const c = f.cost[smI];
    return c == null ? 'n/a at this SM' : fmtCost(c);
  }
  if (f.flatCost) return fmtCost(f.flatCost);
  if (f.table) {
    const row = f.table[design.sm];
    return row ? `${fmtCost(row[1])} (max ${row[0]}G)` : 'n/a at this SM';
  }
  if (f.costPerWorkspace) return `${fmtCost(f.costPerWorkspace)}/workspace`;
  if (f.costPerTon) return `${fmtCost(f.costPerTon * (HULLS[design.sm]?.tons || 0))} (${fmtCost(f.costPerTon)}/ton)`;
  if (f.costMult) return `armor ×${f.costMult}`;
  if (f.ramFeature) return '50% of front armor cost';
  return 'free';
}

function renderBooks() {
  const host = $('books');
  host.innerHTML = '';
  for (const [key, name] of Object.entries(BOOKS)) {
    const label = document.createElement('label');
    label.className = 'acc-row';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = design.books?.[key] !== false;
    cb.addEventListener('change', () => {
      design.books ||= {};
      design.books[key] = cb.checked;
      syncBasics();
      update();
    });
    const span = document.createElement('span');
    span.innerHTML = `<b>${esc(key)}</b> <small>${esc(name)}</small>`;
    label.append(cb, ' ', span);
    host.appendChild(label);
  }
}

// --- Stat sheet ------------------------------------------------------------
function statRow(label, value) {
  const help = STAT_HELP[label];
  const lab = help ? `<span class="stat-help" title="${esc(help)}">${esc(label)}</span>` : esc(label);
  return `<div class="bd-row"><span>${lab}</span><span>${value}</span></div>`;
}

function update() {
  const r = computeShip(design);
  const s = r.stats;

  $('hull-summary').textContent = s
    ? `SM+${design.sm}: ${fmt(s.lwt)} tons loaded, about ${fmt(s.lengthYds)} yards long, dST/HP ${s.dstHp}. `
      + `${s.slotsUsed}/20 slots filled.`
    : '';

  $('sheet-name').textContent = design.name || 'Spacecraft';
  const ss = r.placed.some((p) => p.entry.superscience);
  $('sheet-sub').textContent = `TL${design.tl}${ss ? '^' : ''} · SM+${design.sm} ${design.streamlined ? 'streamlined' : 'unstreamlined'} spacecraft`;

  if (s) {
    const rows = [
      statRow('dST/HP', s.dstHp),
      statRow('Hnd/SR', s.hnd === null ? '— (no maneuver drive)' : `${s.hnd}/${s.sr}`),
      statRow('HT', s.ht),
      statRow('Move', esc(s.move)),
      statRow('LWt.', `${fmt(s.lwt)} tons`),
      statRow('Load', `${fmt(s.load, 1)} tons`),
      statRow('SM', `+${s.sm}`),
      statRow('Occ', esc(s.occ) + (s.hibernation ? ` <small>+${s.hibernation} in hibernation</small>` : '')),
      statRow('dDR', esc(s.ddr)),
      statRow('Range', s.range ?? '—'),
      statRow('Cost', esc(s.costStr)),
    ];
    const extra = [];
    if (s.airSpeed) extra.push(statRow('Top air speed', `${fmt(s.airSpeed)} mph (air Hnd ${s.airHnd >= 0 ? '+' : ''}${s.airHnd})`));
    if (s.deltaV) extra.push(statRow('Delta-V', `${s.deltaV} mps — ${esc(s.fuelNote || '')}`));
    if (s.ppNeeded || s.ppProvided) extra.push(statRow('Power Points', `needs ${s.ppNeeded}, provides ${s.ppProvided}`));
    if (s.magicPP || s.magicPPNeeded) extra.push(statRow('Magic PP', `needs ${s.magicPPNeeded}, provides ${s.magicPP}`));
    if (s.psiPP || s.psiPPNeeded) extra.push(statRow('Psi PP', `needs ${s.psiPPNeeded}, provides ${s.psiPP}`));
    if (s.ground) extra.push(statRow('Ground', `Move ${s.ground.move}, Hnd/SR ${s.ground.hnd >= 0 ? '+' : ''}${s.ground.hnd}/${s.ground.sr} (${s.ground.legs} leg${s.ground.legs > 1 ? 's' : ''})`));
    if (s.liftNote) extra.push(statRow('Lift', esc(s.liftNote) + (s.aerostatic ? ' — floats in 1G' : '')));
    if (s.screenDDR) extra.push(statRow('dDR', `force screen ${s.screenDDR}`));
    if (s.complexity) extra.push(statRow('Complexity', s.complexity));
    if (s.arrayLevel !== null) extra.push(statRow('Comm/sensor', `Level ${s.arrayLevel}`));
    if (s.workspaces) extra.push(statRow('Workspaces', s.workspaces));
    if (s.cargo) extra.push(statRow('Cargo space', `${fmt(s.cargo, 1)} tons`));

    $('sheet-body').innerHTML = `
      ${rows.join('')}
      ${extra.length ? `<h3>Details</h3>${extra.join('')}` : ''}
      ${r.warnings.length ? `<h3>Warnings</h3><ul class="problems">${r.warnings.map((w) => `<li class="warn">${esc(w)}</li>`).join('')}</ul>` : ''}
    `;
  } else {
    $('sheet-body').innerHTML = '';
  }

  const problems = $('problems');
  problems.innerHTML = r.errors.map((e) => `<li>${esc(e)}</li>`).join('');
  $('problems-card').style.display = r.errors.length ? '' : 'none';

  // Refresh live slot descriptions (cost/dDR change with SM/TL/streamlining).
  renderSections();
  renderCores();
  renderFeatures();
  refreshExplain();
}

// --- Basics ----------------------------------------------------------------
function syncBasics() {
  fillSelect($('f-tl'), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((t) => [String(t), `TL${t}`]), design.tl);
  const sms = SMS.filter((sm) => sm !== 4 || bookOn('SS4') || design.sm === 4);
  fillSelect($('f-sm'), sms.map((sm) => [String(sm), `SM+${sm} (${fmt(HULLS[sm].tons)} tons)`]), design.sm);
  $('f-name').value = design.name;
  $('f-streamlined').checked = design.streamlined;
  $('f-quality').value = design.quality || 'normal';
  renderBooks();
}

function bindBasics() {
  $('f-name').addEventListener('input', () => { design.name = $('f-name').value; update(); });
  $('f-tl').addEventListener('change', () => { design.tl = Number($('f-tl').value); update(); });
  $('f-sm').addEventListener('change', () => { design.sm = Number($('f-sm').value); update(); });
  $('f-streamlined').addEventListener('change', () => { design.streamlined = $('f-streamlined').checked; update(); });
  $('f-quality').addEventListener('change', () => { design.quality = $('f-quality').value; update(); });
}

function loadDesign(d) {
  design = JSON.parse(JSON.stringify(d));
  syncBasics();
  update();
}

// --- Presets, saves, import/export ----------------------------------------
const KEY = 'gvb.ss.saves';
const readAll = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };

function refreshSavedSelect() {
  const names = Object.keys(readAll()).sort();
  fillSelect($('saved-select'), [['', names.length ? '— Saved designs —' : '— No saved designs —'], ...names.map((n) => [n, n])], '');
}

function initToolbar() {
  fillSelect($('preset-select'), [['', '— Load a sample design —'], ...SS_PRESETS.map((p, i) => [String(i), p.name])], '');
  $('preset-select').addEventListener('change', (e) => {
    const i = e.target.value;
    if (i === '') return;
    loadDesign(SS_PRESETS[Number(i)].design);
    flash(`Loaded “${design.name}”.`);
    e.target.value = '';
  });

  $('btn-new').addEventListener('click', () => {
    loadDesign(defaultShip());
    flash('New spacecraft.');
  });

  $('btn-save').addEventListener('click', () => {
    const map = readAll();
    map[design.name || 'Unnamed spacecraft'] = design;
    localStorage.setItem(KEY, JSON.stringify(map));
    refreshSavedSelect();
    flash(`Saved “${design.name}”.`);
  });

  $('saved-select').addEventListener('change', (e) => {
    const name = e.target.value;
    if (!name) return;
    const map = readAll();
    if (map[name]) {
      loadDesign(map[name]);
      flash(`Loaded “${design.name}”.`);
    }
    e.target.value = '';
  });

  $('btn-export-json').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(design, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(design.name || 'spacecraft').replace(/[^\w-]+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $('btn-import-json').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const d = JSON.parse(await file.text());
      if (!d.sections || !d.cores) throw new Error('not a spacecraft design');
      loadDesign(d);
      flash(`Imported “${design.name}”.`);
    } catch (err) {
      flash(`Import failed: ${err.message}`);
    }
    e.target.value = '';
  });

  $('btn-export-md').addEventListener('click', () => {
    $('md-output').value = toSsMarkdown(design);
    $('md-modal').showModal();
  });
  $('md-copy').addEventListener('click', () => {
    navigator.clipboard.writeText($('md-output').value).then(() => flash('Copied to clipboard.'));
  });
  $('md-close').addEventListener('click', () => $('md-modal').close());

  $('btn-print').addEventListener('click', () => window.print());
}

// --- Flash -----------------------------------------------------------------
let flashTimer = null;
function flash(msg) {
  const el = $('flash');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// --- Boot ------------------------------------------------------------------
bindBasics();
syncBasics();
initToolbar();
refreshSavedSelect();
update();
initExplain({
  toggleBtnId: 'btn-explain',
  storageKey: 'gvb.explain.ss',
  fieldHelp: FIELD_HELP,
  optionHelp: {},
  sectionHelp: SECTION_HELP,
});
