// ---------------------------------------------------------------------------
// GURPS Spaceships combat tracker — UI. Drives js/ss/combat.js: fleet
// roster with live damage diagrams, an attack console, and a combat log.
// ---------------------------------------------------------------------------

import { SECTIONS } from './tables.js';
import { computeShip } from './ship.js';
import { SS_PRESETS } from './presets.js';
import { PSIWARS_PRESETS } from './presets-psiwars.js';
import {
  BASE_VELOCITY, BEAM_TYPES, GUN_TYPES, NUKES,
  PSI_CATEGORIES, PSI_MISSILES, PSI_RANGES,
  RANGE_LABELS, ROF, SCALES, SCALE_LABELS, SITUATIONS,
  TURN_LABELS, TURN_LENGTHS,
  applyHit, ballisticAttackMods, beamAttackMods, beamRangeCheck, beamStats,
  combatantWeapons, conventionalWarhead, createCombatant, dodgeScore,
  effectiveStats, fmtDice, missileSAcc, parseDice, psiBeamMods, psiCategory,
  psiMissileMods, rangeBand, rollDice, squadronDamage, successRoll,
} from './combat.js';
import { initExplain, refreshExplain } from '../help-core.js';
import { COMBAT_FIELD_HELP, COMBAT_SECTION_HELP } from './help-combat.js';

const ALL_PRESETS = [...SS_PRESETS.filter((p) => !p.name.startsWith('Empty')), ...PSIWARS_PRESETS];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (x, d = 0) => (Math.round(x * 10 ** d) / 10 ** d).toLocaleString('en-US');

const enc = {
  scale: 'standard',
  turn: '3m',
  ruleset: 'standard', // 'standard' (SS1) or 'psiwars' (Mailanka's layer)
  combatants: [],
};
const psi = () => enc.ruleset === 'psiwars';
let attack = null; // pending attack state

// --- Fleet management --------------------------------------------------------
function addShip(design) {
  const r = computeShip(design);
  if (!r.stats) { flash('That design has no stats.'); return; }
  const base = design.name || 'Ship';
  let name = base;
  let n = 2;
  while (enc.combatants.some((c) => c.id === name)) name = `${base} ${n++}`;
  const c = createCombatant(JSON.parse(JSON.stringify(design)), { id: name });
  enc.combatants.push(c);
  renderAll();
  log(`— ${name} joins the battle (${r.stats.move}, dDR ${r.stats.ddr}, dHP ${r.stats.dstHp}).`);
}

const MANEUVERS = {
  closing: 'Closing',
  closingDedicated: 'Closing (Dedicated, +3, no dodge)',
  evasive: 'Evasive Action (+1 dodge)',
  holdCourse: 'Hold Course',
  retreat: 'Retreat',
  controlledDrift: 'Controlled Drift (no dodge)',
  uncontrolledDrift: 'Uncontrolled Drift (no dodge)',
};
const canDodge = (c) => !['controlledDrift', 'uncontrolledDrift', 'closingDedicated'].includes(c.maneuver);

function renderFleet() {
  const host = $('fleet');
  host.innerHTML = '';
  enc.combatants.forEach((c, ci) => {
    const s = effectiveStats(c);
    const card = document.createElement('div');
    card.className = 'card combatant';
    const pct = Math.max(0, Math.min(100, (c.curDhp / c.dhp) * 100));
    card.innerHTML = `
      <div class="cmb-head">
        <h2>${esc(c.id)}${c.destroyed ? ' — DESTROYED' : ''}</h2>
        <button class="btn" data-del="${ci}">✕</button>
      </div>
      <p class="muted">${esc(s.move)} · Hnd/SR ${s.hnd === null ? '—' : `${s.hnd}/${s.sr}`} · HT ${s.ht}
        · dDR ${esc(s.ddr)}${c.screen ? ` · screen ${c.screen}` : ''} · SM +${c.design.sm}
        ${s.beamPenalty ? ` · <b>0 dHP: Hnd -2, beams -2, arrays -1</b>` : ''}</p>
      <div class="dhp-row">
        <div class="weight-bar"><div class="weight-fill${c.curDhp <= 0 ? ' over' : ''}" style="width:${pct}%"></div></div>
        <span class="dhp-label">dHP ${c.curDhp}/${c.dhp}</span>
        <button class="btn" data-dhp="${ci}:-1">-1</button>
        <button class="btn" data-dhp="${ci}:1">+1</button>
        ${c.screen ? `<span class="dhp-label">screen</span><button class="btn" data-scr="${ci}:-1">-1</button><button class="btn" data-scr="${ci}:1">+1</button>` : ''}
      </div>
      <div class="grid3">
        <label>Facing <select data-facing="${ci}">
          ${SECTIONS.map((x) => `<option value="${x}" ${c.facing === x ? 'selected' : ''}>${x}</option>`).join('')}
        </select></label>
        <label>Maneuver <select data-maneuver="${ci}">
          ${Object.entries(MANEUVERS).map(([k, v]) => `<option value="${k}" ${c.maneuver === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select></label>
        <label>Pilot / Gunner skill
          <span class="skill-pair">
            <input type="number" data-pilot="${ci}" value="${c.pilotSkill}" min="3" max="25">
            <input type="number" data-gunner="${ci}" value="${c.gunnerSkill}" min="3" max="25">
          </span>
        </label>
      </div>
      ${psi() ? `
      <div class="grid3" style="margin-top:6px">
        <label>Crew quality
          <span class="skill-pair">
            <button class="btn" data-crew="${ci}:10" title="Green crews: skill 10, half cost">G</button>
            <button class="btn" data-crew="${ci}:12" title="Basic crews: skill 12, standard">B</button>
            <button class="btn" data-crew="${ci}:15" title="Superior training: skill 15, double cost">S</button>
            <button class="btn" data-crew="${ci}:18" title="Elite: skill 18, five times cost">E</button>
          </span>
        </label>
        <label>Squadron (${PSI_CATEGORIES[psiCategory(c.design.sm)]})
          <input type="number" data-squad="${ci}" value="${c.squadron?.size || 1}" min="1" max="40"
            title="Mook fighter wings act as one body: 1 = a single ship; 5 = a wing; 20 = a squadron">
        </label>
        <label>&nbsp;<small class="muted">${c.squadron?.size > 1 ? `${c.squadron.size} fighters — damage pools; every ${Math.ceil(c.dhp / 2)} penetration downs one` : `${PSI_CATEGORIES[psiCategory(c.design.sm)]}: ${psiCategory(c.design.sm) >= 1 ? 'halves all penetrating damage (DR 2)' : 'full damage; goes first in the round'}`}</small></label>
      </div>` : ''}
      <div class="dmg-grid">${SECTIONS.map((sec) => dmgRow(c, ci, sec)).join('')}</div>
      <p class="muted dmg-hint">Click a system to cycle OK → disabled → destroyed. ⚠ = volatile.</p>
    `;
    host.appendChild(card);
  });

  // wire events
  host.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    enc.combatants.splice(Number(b.dataset.del), 1);
    renderAll();
  }));
  host.querySelectorAll('[data-dhp]').forEach((b) => b.addEventListener('click', () => {
    const [ci, d] = b.dataset.dhp.split(':').map(Number);
    enc.combatants[ci].curDhp += d;
    renderFleet();
  }));
  host.querySelectorAll('[data-scr]').forEach((b) => b.addEventListener('click', () => {
    const [ci, d] = b.dataset.scr.split(':').map(Number);
    enc.combatants[ci].screen = Math.max(0, enc.combatants[ci].screen + d);
    renderFleet();
  }));
  host.querySelectorAll('[data-facing]').forEach((el) => el.addEventListener('change', () => {
    enc.combatants[Number(el.dataset.facing)].facing = el.value;
  }));
  host.querySelectorAll('[data-maneuver]').forEach((el) => el.addEventListener('change', () => {
    enc.combatants[Number(el.dataset.maneuver)].maneuver = el.value;
  }));
  host.querySelectorAll('[data-pilot]').forEach((el) => el.addEventListener('change', () => {
    enc.combatants[Number(el.dataset.pilot)].pilotSkill = Number(el.value) || 10;
  }));
  host.querySelectorAll('[data-gunner]').forEach((el) => el.addEventListener('change', () => {
    enc.combatants[Number(el.dataset.gunner)].gunnerSkill = Number(el.value) || 10;
  }));
  host.querySelectorAll('[data-crew]').forEach((b) => b.addEventListener('click', () => {
    const [ci, skill] = b.dataset.crew.split(':').map(Number);
    const c = enc.combatants[ci];
    c.pilotSkill = skill;
    c.gunnerSkill = skill;
    log(`${c.id} crew set to skill ${skill}.`);
    renderFleet();
  }));
  host.querySelectorAll('[data-squad]').forEach((el) => el.addEventListener('change', () => {
    const c = enc.combatants[Number(el.dataset.squad)];
    const n = Math.max(1, Math.floor(Number(el.value) || 1));
    c.squadron = n > 1 ? { size: n, pool: 0, lost: 0 } : null;
    renderFleet();
  }));
  host.querySelectorAll('[data-slot]').forEach((el) => el.addEventListener('click', () => {
    const [ci, sec, i] = el.dataset.slot.split(':');
    const st = enc.combatants[Number(ci)].slots[sec][Number(i)];
    if (!st) return;
    st.state = st.state === 'ok' ? 'disabled' : st.state === 'disabled' ? 'destroyed' : 'ok';
    renderAll();
  }));
}

function dmgRow(c, ci, sec) {
  const cells = c.slots[sec].map((st, i) => {
    if (!st) return `<span class="dmg-cell empty" title="no core system">·</span>`;
    const label = i === 6 ? 'C' : String(i + 1);
    const title = `${sec} ${i === 6 ? '[core]' : `[${i + 1}]`} ${st.name}${st.volatile ? ' (volatile)' : ''} — ${st.state}`;
    return `<span class="dmg-cell ${st.state}${st.sys ? '' : ' empty'}" data-slot="${ci}:${sec}:${i}" title="${esc(title)}">${label}${st.volatile ? '⚠' : ''}</span>`;
  }).join('');
  return `<div class="dmg-section"><span class="dmg-label">${sec[0].toUpperCase()}</span>${cells}</div>`;
}

// --- Attack console ------------------------------------------------------------
function fillSelect(el, entries, selected) {
  el.innerHTML = '';
  for (const [value, label] of entries) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    if (String(selected) === value) opt.selected = true;
    el.appendChild(opt);
  }
}

function renderAttackSelectors() {
  const names = enc.combatants.map((c, i) => [String(i), c.id]);
  fillSelect($('atk-ship'), names.length ? names : [['', '— add ships —']], $('atk-ship').value);
  fillSelect($('atk-target'), names.length ? names : [['', '— add ships —']], $('atk-target').value);
  if (psi()) {
    fillSelect($('atk-situation'), Object.entries(PSI_RANGES).map(([k, v]) => [k, `${v.name} (${v.mod})`]), ['neutral', 'engaged', 'hugging'].includes($('atk-situation').value) ? $('atk-situation').value : 'neutral');
  } else {
    fillSelect($('atk-situation'), Object.entries(SITUATIONS).map(([k, v]) => [k, `${v.name} (${RANGE_LABELS[rangeBand(k, enc.scale)]})`]), SITUATIONS[$('atk-situation').value] ? $('atk-situation').value : 'engaged');
  }
  renderWeaponSelect();
}

function attacker() { return enc.combatants[Number($('atk-ship').value)] || null; }
function target() { return enc.combatants[Number($('atk-target').value)] || null; }

function renderWeaponSelect() {
  const a = attacker();
  const weapons = a ? combatantWeapons(a) : [];
  fillSelect($('atk-weapon'), weapons.length ? weapons.map((w, i) => [String(i), w.label]) : [['', '— no functional weapons —']], $('atk-weapon').value);
  renderWeaponParams();
}

function currentWeapon() {
  const a = attacker();
  if (!a) return null;
  return combatantWeapons(a)[Number($('atk-weapon').value)] || null;
}

function renderWeaponParams() {
  const host = $('atk-params');
  host.innerHTML = '';
  const w = currentWeapon();
  if (!w) { renderMods(); return; }
  const kind = w.opts.weaponType || 'beam';
  const mk = (label, inner) => {
    const lab = document.createElement('label');
    lab.innerHTML = `${label} `;
    lab.appendChild(inner);
    host.appendChild(lab);
    return inner;
  };
  const sel = (id, entries, val) => {
    const s = document.createElement('select');
    s.id = id;
    fillSelect(s, entries, val);
    s.addEventListener('change', renderMods);
    return s;
  };
  const num = (id, val, min = 0) => {
    const i = document.createElement('input');
    i.type = 'number'; i.id = id; i.value = val; i.min = min; i.step = 'any';
    i.addEventListener('change', renderMods);
    return i;
  };

  if (kind === 'beam') {
    mk('Beam type', sel('w-beamtype', Object.entries(BEAM_TYPES).map(([k, v]) => [k, `${v.name} (sAcc ${v.sAcc}, ÷${v.div === Infinity ? '∞' : v.div})`]), 'laser'));
  } else if (kind === 'gun') {
    mk('Gun type', sel('w-guntype', Object.entries(GUN_TYPES).map(([k, v]) => [k, v.name]), 'conventional'));
    mk('Warhead', sel('w-warhead', [['conventional', 'Conventional'], ...Object.entries(NUKES).map(([k, v]) => [k, v.name])], 'conventional'));
  } else if (psi()) {
    // Psi-Wars uses a fixed missile/torpedo table instead of caliber math.
    mk('Munition (Psi-Wars)', sel('w-psimissile', Object.entries(PSI_MISSILES).map(([k, v]) => [k, `${v.name} — ${v.dice}${v.div !== 1 ? `(${v.div})` : ''}, PD ${v.pd}`]), 'lightMissile'));
  } else {
    mk('Warhead', sel('w-warhead', [['conventional', 'Conventional'], ...Object.entries(NUKES).map(([k, v]) => [k, v.name])], 'conventional'));
  }
  mk('Fire mode', sel('w-mode', [['single', 'Standard'], ['rapid', 'Rapid fire'], ['veryRapid', 'Very rapid fire']], 'single'));
  const rof = ROF.single[enc.turn] * (w.info.turrets ? 1 : w.weapons);
  const a = attacker();
  const sq = a?.squadron?.size > 1 ? ` × ${a.squadron.size} fighters` : '';
  mk(`Shots (RoF ${rof}/wpn${sq})`, num('w-shots', Math.min(rof * (a?.squadron?.size || 1), 20), 1));
  if (kind !== 'beam' && !psi()) {
    const base = BASE_VELOCITY[enc.scale][enc.turn];
    mk('Relative velocity (mps)', num('w-velocity', base, 0));
  }
  renderMods();
}

const TOGGLES = [
  ['t-cloaked', 'Target is cloaked'],
  ['t-detected', '…but already detected (-4 instead of -10)'],
  ['t-precision', 'Precision attack: pick the hit location (-5)'],
  ['t-weak', 'Target a weak point in the armor (-10, ignores armor)'],
  ['t-gap', 'Psi-Wars armor gap (-10; ignores armor, disables on half damage, excess lost)'],
  ['t-proximity', 'Proximity detonation (+4 to hit, weaker warhead)'],
];
function renderToggles() {
  const host = $('atk-toggles');
  host.innerHTML = TOGGLES.map(([id, label]) => `
    <label class="acc-row"><input type="checkbox" id="${id}"> <span><small>${label}</small></span></label>`).join('')
    + `<label class="acc-row">Hit section override
      <select id="t-section"><option value="">target's facing</option>
      ${SECTIONS.map((s) => `<option value="${s}">${s}</option>`).join('')}</select>
      <span style="margin-left:8px">slot (precision) <input type="number" id="t-slot" min="1" max="6" value="1" style="width:52px"></span>
    </label>`;
  host.querySelectorAll('input,select').forEach((el) => el.addEventListener('change', renderMods));
}

function gatherAttack() {
  const a = attacker();
  const t = target();
  const w = currentWeapon();
  if (!a || !t || !w || a === t) return null;
  const kind = w.opts.weaponType || 'beam';
  const shots = Math.max(1, Number($('w-shots')?.value || 1));
  const section = $('t-section')?.value || t.facing;
  const cloaked = $('t-cloaked')?.checked;
  const common = {
    targetSM: t.design.sm,
    cloaked, cloakDetected: $('t-detected')?.checked,
    precision: $('t-precision')?.checked,
    weakPoint: $('t-weak')?.checked,
    armorGap: $('t-gap')?.checked,
    ecm: computeEcm(t),
    tacticalArray: a.result.placed.some((p) => ['tacticalArray', 'multipurposeArray'].includes(p.entry.key) && slotOk(a, p)),
    streamlinedEnd: t.design.streamlined && (section === 'front' || section === 'rear'),
    shots,
  };

  // Psi-Wars simplified layer: size categories, three ranges, its own tables.
  if (psi()) {
    const range = PSI_RANGES[$('atk-situation').value] ? $('atk-situation').value : 'neutral';
    if (kind === 'beam') {
      const typeKey = $('w-beamtype')?.value || 'laser';
      const stats = beamStats(w.info.output, typeKey);
      const heavyWeapon = ['battery_major', 'battery_medium', 'battery_spinal'].includes(w.entry.key) && psiCategory(a.design.sm) >= 1;
      const mods = psiBeamMods({
        ...common, attackerSM: a.design.sm, sAcc: stats.sAcc, range, heavyWeapon,
        fixedMount: (w.opts.mount || 'turret') === 'fixed' || w.entry.spinal,
        attackerZeroHP: a.curDhp <= 0,
      });
      return { a, t, w, kind, band: range, section, mods, shots, profile: { kind, stats, reach: 'full', band: range, section, shots, rcl: stats.rcl } };
    }
    // Missiles/torpedoes from the fixed Psi-Wars table (guns fall back to it too).
    const mKey = $('w-psimissile')?.value || 'lightMissile';
    const m = PSI_MISSILES[mKey];
    const effShots = m.torpedo ? Math.max(1, Math.floor(shots / 2)) : shots;
    const mods = psiMissileMods({ ...common, attackerSM: a.design.sm, torpedo: m.torpedo, shots: effShots });
    return {
      a, t, w, kind: 'missile', band: 'incoming', section, mods, shots: effShots,
      profile: { kind: 'psiMissile', mKey, section, shots: effShots, rcl: 1 },
    };
  }

  const band = rangeBand($('atk-situation').value, enc.scale);
  let mods;
  let profile;
  if (kind === 'beam') {
    const typeKey = $('w-beamtype')?.value || 'laser';
    const stats = beamStats(w.info.output, typeKey);
    const reach = beamRangeCheck(stats, band);
    profile = { kind, stats, reach, band, section, shots, rcl: stats.rcl };
    mods = beamAttackMods({
      ...common, sAcc: stats.sAcc, band,
      bigBeam: /GJ|TJ|PJ/.test(w.info.output),
      fixedMount: (w.opts.mount || 'turret') === 'fixed' || w.entry.spinal,
      attackerZeroHP: a.curDhp <= 0,
    });
    if (a.curDhp <= 0) mods.push([0, '']); // already included via attackerZeroHP
  } else {
    const velocity = Math.max(0, Number($('w-velocity')?.value || 0));
    const warheadKey = $('w-warhead')?.value || 'conventional';
    const proximity = $('t-proximity')?.checked;
    let sAcc;
    let rcl = 1;
    let cal;
    if (kind === 'gun') {
      const gt = GUN_TYPES[$('w-guntype')?.value || 'conventional'];
      cal = parseFloat(w.info.gunCal);
      sAcc = gt.sAcc(cal);
      rcl = gt.rcl(cal);
    } else {
      cal = parseFloat(w.info.launcherCal);
      sAcc = missileSAcc(a.design.tl, cal);
    }
    profile = { kind, cal, velocity, warheadKey, proximity, band, section, shots, rcl };
    mods = ballisticAttackMods({ ...common, sAcc, velocity, proximity });
  }
  return { a, t, w, kind, band, section, mods, profile, shots };
}

function slotOk(c, p) {
  const list = c.slots[p.section];
  const idx = p.slotLabel === '[core]' ? 6 : Number(p.slotLabel.replace(/\D/g, '')) - 1;
  return list[idx] && list[idx].state === 'ok';
}
function computeEcm(c) {
  let n = 0;
  for (const sec of SECTIONS) {
    c.slots[sec].forEach((st) => { if (st && st.sys === 'defensiveECM' && st.state === 'ok') n += 1; });
  }
  return Math.min(n, 3);
}

function renderMods() {
  const g = gatherAttack();
  attack = null;
  $('btn-dodge').disabled = true;
  $('btn-damage').disabled = true;
  $('atk-status').textContent = '';
  if (!g) {
    $('atk-mods').textContent = 'Pick a different attacker and target.';
    $('atk-skill').textContent = '';
    return;
  }
  if (g.profile.kind === 'beam' && g.profile.reach === 'out') {
    $('atk-mods').textContent = `${BEAM_TYPES[$('w-beamtype')?.value || 'laser'].name} cannot reach ${RANGE_LABELS[g.band]} range.`;
    $('atk-skill').textContent = 'Out of range';
    return;
  }
  const total = g.mods.reduce((s, [v]) => s + v, 0);
  const eff = g.a.gunnerSkill + total;
  $('atk-mods').innerHTML = g.mods.filter(([v]) => v).map(([v, l]) => `<span class="mod">${v > 0 ? '+' : ''}${v} ${esc(l)}</span>`).join(' · ')
    + (g.profile.kind === 'beam' && g.profile.reach === 'half' ? ' · <b>half damage at this range</b>' : '');
  $('atk-skill').textContent = `Effective skill ${eff} (Gunner ${g.a.gunnerSkill} ${total >= 0 ? '+' : ''}${total})`;
  attack = { ...g, eff };
}

function doAttack() {
  if (!attack) renderMods();
  if (!attack) return;
  const r = successRoll(attack.eff);
  attack.roll = r;
  const hits = r.success ? Math.min(1 + Math.floor(r.margin / attack.profile.rcl), attack.shots) : 0;
  attack.hits = hits;
  log(`${attack.a.id} fires ${attack.w.entry.name} (${attack.kind}) at ${attack.t.id} — needs ${attack.eff}, rolls ${r.dice}: ${r.critSuccess ? 'CRITICAL SUCCESS' : r.critFailure ? 'CRITICAL FAILURE (weapon disabled!)' : r.success ? `success by ${r.margin}` : `failure by ${-r.margin}`}${hits ? ` — ${hits} hit(s)` : ''}.`);
  if (r.critFailure) { $('atk-status').textContent = 'Critical failure: treat the firing system as disabled.'; return; }
  if (!r.success) { $('atk-status').textContent = 'Miss.'; return; }
  $('atk-status').textContent = `${hits} hit(s) pending. ${r.critSuccess ? 'Critical: no dodge allowed.' : 'Target may dodge.'}`;
  $('btn-dodge').disabled = r.critSuccess || !canDodge(attack.t);
  $('btn-damage').disabled = false;
}

function doDodge() {
  if (!attack?.hits) return;
  const t = attack.t;
  const ds = dodgeScore({
    piloting: t.pilotSkill,
    hnd: effectiveStats(t).hnd ?? 0,
    turn: enc.turn,
    ecm: computeEcm(t),
    evasive: t.maneuver === 'evasive',
  });
  const r = successRoll(ds.score);
  if (r.success) {
    const dodged = Math.min(attack.hits, 1 + r.margin);
    attack.hits -= dodged;
    log(`${t.id} dodges (score ${ds.score}, rolled ${r.dice}): avoids ${dodged} hit(s); ${attack.hits} remain.`);
  } else {
    log(`${t.id} fails to dodge (score ${ds.score}, rolled ${r.dice}).`);
  }
  $('btn-dodge').disabled = true;
  if (!attack.hits) { $('btn-damage').disabled = true; $('atk-status').textContent = 'All hits dodged!'; }
  else $('atk-status').textContent = `${attack.hits} hit(s) to resolve.`;
}

function doDamage() {
  if (!attack?.hits) return;
  const { t, profile } = attack;
  // Psi-Wars: everything bigger than a fighter halves penetrating damage.
  const dr = psi() && psiCategory(t.design.sm) >= 1 && !(t.squadron?.size > 1) ? 2 : 1;
  for (let h = 1; h <= attack.hits; h++) {
    let dice;
    let div = 1;
    let half = false;
    let dmg;
    if (profile.kind === 'beam') {
      dice = profile.stats.dice;
      div = profile.stats.div;
      half = profile.reach === 'half';
      dmg = rollDice(dice);
    } else if (profile.kind === 'psiMissile') {
      const m = PSI_MISSILES[profile.mKey];
      dice = parseDice(m.dice);
      div = m.div;
      // Torpedoes lose half their effect against hardened armor.
      if (m.torpedo && t.design.features?.hardenedArmor) div = 0.5;
      dmg = rollDice(dice);
    } else if (profile.warheadKey === 'conventional') {
      dice = conventionalWarhead(profile.cal);
      div = profile.proximity ? 1 : 2;
      dmg = rollDice(dice, Math.random, Math.max(profile.velocity, 0.01));
    } else {
      dice = parseDice(NUKES[profile.warheadKey].dice);
      dmg = rollDice(dice, Math.random, profile.proximity ? 0.01 : 1);
    }
    log(`Hit ${h}/${attack.hits} on ${t.id} (${profile.section} hull): ${fmtDice(dice)}${profile.kind === 'gun' && profile.warheadKey === 'conventional' ? `×${profile.velocity} mps` : ''} → basic damage ${dmg}${div !== 1 ? ` (${div === Infinity ? '∞' : div})` : ''}.`);

    // Squadrons take damage as fighter attrition, not system damage.
    if (t.squadron?.size > 1) {
      const frontDDR = Number(String(t.result.stats.ddr).split('/')[0]) || 0;
      const eff = div === Infinity ? 0 : Math.floor(frontDDR / div);
      const pen = Math.max(0, (half ? Math.floor(dmg / 2) : dmg) - eff);
      const lost = squadronDamage(t.squadron, t.dhp, pen);
      log(`  squadron: ${pen} penetrating — ${lost ? `1 fighter destroyed (${t.squadron.size} left)` : `no fighter lost (${t.squadron.size} left, damage pooling)`}.`);
      if (t.squadron.size <= 0) { log(`💥 The last fighter of ${t.id} is destroyed!`); t.destroyed = true; break; }
      continue;
    }

    const res = applyHit(t, {
      section: profile.section,
      basicDamage: dmg,
      div,
      halfDamage: half,
      precisionSlot: $('t-precision')?.checked ? Number($('t-slot')?.value || 1) - 1 : null,
      weakPoint: $('t-weak')?.checked,
      armorGap: $('t-gap')?.checked,
      damageReduction: dr,
    });
    res.log.forEach((l) => log(`  ${l}`));
    if (t.destroyed) { log(`💥 ${t.id} is destroyed!`); break; }
  }
  attack.hits = 0;
  $('btn-damage').disabled = true;
  $('btn-dodge').disabled = true;
  $('atk-status').textContent = 'Damage applied.';
  renderFleet();
}

// --- Tactical calculator (SS3) -------------------------------------------------
function tacMod(hexes, scaleIdx) {
  if (hexes <= 0) return 12 - 6 * scaleIdx;
  const bands = [[1, 6], [2, 4], [4, 3], [6, 2], [9, 1], [14, 0], [19, -1], [29, -2], [49, -3], [69, -4], [99, -5], [149, -6], [199, -7], [299, -8]];
  let base = null;
  for (const [limit, mod] of bands) if (hexes <= limit) { base = mod; break; }
  if (base === null) {
    // -6 per ×10 beyond the table
    let h = hexes;
    let extra = 0;
    while (h > 299) { h /= 10; extra -= 6; }
    for (const [limit, mod] of bands) if (h <= limit) { base = mod + extra; break; }
  }
  return base - 6 * scaleIdx;
}
function renderTac() {
  const hexes = Number($('tac-hexes').value) || 0;
  const idx = Number($('tac-scale').value);
  $('tac-result').textContent = `Range modifier: ${tacMod(hexes, idx) >= 0 ? '+' : ''}${tacMod(hexes, idx)}`;
}

// --- Log, persistence, boot ------------------------------------------------------
function log(msg) {
  const el = $('log');
  const line = document.createElement('div');
  line.textContent = msg;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

const ENC_KEY = 'gvb.ss.encounter';
function saveEnc() {
  localStorage.setItem(ENC_KEY, JSON.stringify({
    scale: enc.scale, turn: enc.turn, ruleset: enc.ruleset,
    combatants: enc.combatants.map((c) => ({
      id: c.id, design: c.design, curDhp: c.curDhp, screen: c.screen,
      slots: c.slots, facing: c.facing, maneuver: c.maneuver,
      pilotSkill: c.pilotSkill, gunnerSkill: c.gunnerSkill, destroyed: c.destroyed,
      htChecksAt: c.htChecksAt,
    })),
  }));
  flash('Encounter saved.');
}
function loadEnc() {
  let data;
  try { data = JSON.parse(localStorage.getItem(ENC_KEY)); } catch { data = null; }
  if (!data) { flash('No saved encounter.'); return; }
  enc.scale = data.scale;
  enc.turn = data.turn;
  enc.ruleset = data.ruleset || 'standard';
  enc.combatants = data.combatants.map((d) => {
    const c = createCombatant(d.design, { id: d.id, pilotSkill: d.pilotSkill, gunnerSkill: d.gunnerSkill });
    Object.assign(c, {
      curDhp: d.curDhp, screen: d.screen, slots: d.slots, facing: d.facing,
      maneuver: d.maneuver, destroyed: d.destroyed, htChecksAt: d.htChecksAt,
      squadron: d.squadron || null,
    });
    return c;
  });
  $('enc-scale').value = enc.scale;
  $('enc-turn').value = enc.turn;
  $('enc-ruleset').value = enc.ruleset;
  renderAll();
  flash('Encounter loaded.');
}

let flashTimer = null;
function flash(msg) {
  const el = $('flash');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

function renderAll() {
  renderFleet();
  renderAttackSelectors();
  renderToggles();
  renderMods();
}

function initToolbar() {
  fillSelect($('add-preset'), [['', '— Add a sample ship —'], ...ALL_PRESETS.map((p, i) => [String(i), p.name])], '');
  $('add-preset').addEventListener('change', (e) => {
    if (e.target.value === '') return;
    addShip(ALL_PRESETS[Number(e.target.value)].design);
    e.target.value = '';
  });
  const saves = (() => { try { return JSON.parse(localStorage.getItem('gvb.ss.saves')) || {}; } catch { return {}; } })();
  const names = Object.keys(saves).sort();
  fillSelect($('add-saved'), [['', names.length ? '— Add a saved design —' : '— No saved designs —'], ...names.map((n) => [n, n])], '');
  $('add-saved').addEventListener('change', (e) => {
    if (!e.target.value) return;
    addShip(saves[e.target.value]);
    e.target.value = '';
  });
  $('btn-import').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!d.sections) throw new Error('not a spacecraft design');
      addShip(d);
    } catch (err) { flash(`Import failed: ${err.message}`); }
    e.target.value = '';
  });
  $('btn-save-enc').addEventListener('click', saveEnc);
  $('btn-load-enc').addEventListener('click', loadEnc);
  $('btn-clear').addEventListener('click', () => { enc.combatants = []; renderAll(); });

  fillSelect($('enc-scale'), SCALES.map((s) => [s, SCALE_LABELS[s]]), enc.scale);
  fillSelect($('enc-turn'), TURN_LENGTHS.map((t) => [t, TURN_LABELS[t]]), enc.turn);
  $('enc-scale').addEventListener('change', () => { enc.scale = $('enc-scale').value; renderAttackSelectors(); renderMods(); });
  $('enc-turn').addEventListener('change', () => { enc.turn = $('enc-turn').value; renderWeaponParams(); });
  $('enc-ruleset').addEventListener('change', () => {
    enc.ruleset = $('enc-ruleset').value;
    log(psi()
      ? '— Ruleset: Psi-Wars simplified space opera (size categories, three ranges, DR 2 for corvettes+, armor gaps, fixed missile table, squadrons).'
      : '— Ruleset: standard GURPS Spaceships basic combat.');
    renderAll();
    refreshExplain();
  });

  $('atk-ship').addEventListener('change', renderWeaponSelect);
  $('atk-weapon').addEventListener('change', renderWeaponParams);
  $('atk-target').addEventListener('change', renderMods);
  $('atk-situation').addEventListener('change', renderMods);
  $('btn-attack').addEventListener('click', doAttack);
  $('btn-dodge').addEventListener('click', doDodge);
  $('btn-damage').addEventListener('click', doDamage);
  $('btn-copy-log').addEventListener('click', () => {
    navigator.clipboard.writeText([...$('log').children].map((x) => x.textContent).join('\n')).then(() => flash('Log copied.'));
  });
  $('btn-clear-log').addEventListener('click', () => { $('log').innerHTML = ''; });
  $('tac-scale').addEventListener('change', renderTac);
  $('tac-hexes').addEventListener('input', renderTac);
}

initToolbar();
renderAll();
renderTac();
initExplain({
  toggleBtnId: 'btn-explain',
  storageKey: 'gvb.explain.combat',
  fieldHelp: COMBAT_FIELD_HELP,
  optionHelp: {},
  sectionHelp: COMBAT_SECTION_HELP,
});
log('Encounter ready. Add ships, set facings and maneuvers, then fire away.');
