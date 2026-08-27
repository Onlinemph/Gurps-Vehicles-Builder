// ---------------------------------------------------------------------------
// GURPS Spaceships combat tracker — UI. Drives js/ss/combat.js: fleet
// roster with live damage diagrams, an attack console, and a combat log.
// ---------------------------------------------------------------------------

import { SECTIONS } from './tables.js';
import { SYSTEMS } from './systems.js';
import { computeShip } from './ship.js';
import { SS_PRESETS } from './presets.js';
import { PSIWARS_PRESETS } from './presets-psiwars.js';
import {
  BASE_VELOCITY, BEAM_TYPES, GUN_TYPES, NUKES,
  PSI_CATEGORIES, PSI_MANEUVERS, PSI_MISSILES, PSI_RANGES,
  RANGE_LABELS, ROF, SCALES, SCALE_LABELS, SITUATIONS,
  TURN_LABELS, TURN_LENGTHS,
  CREW_QUALITY,
  applyHit, ballisticAttackMods, beamAttackMods, beamRangeCheck, beamStats,
  combatantWeapons, conventionalWarhead, createCombatant, damageSystem,
  dodgeScore, effectiveStats, fmtDice, missileSAcc, parseDice, psiAccelBonus,
  psiBeamMods, psiCategory, psiCollisionDice, psiHasArmorGap,
  psiInspire, psiManeuverContest, psiMissileMods, psiPointDefenseMods,
  psiRepairRoll, psiTacticsContest, psiThreat, psiTurnOrder, rangeBand,
  rollDice, squadronDamage, successRoll,
} from './combat.js';
import { initExplain, refreshExplain } from '../help-core.js';
import { COMBAT_FIELD_HELP, COMBAT_OPTION_HELP, COMBAT_SECTION_HELP } from './help-combat.js';

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
// Psi-Wars dogfighting state per combatant.
const psiState = (c) => (c.psi ||= { engagedWith: null, advOver: null, adv: 0, formation: '', morale: 'steady' });
// Advantage carries across a formation: the whole wing benefits from the
// best tail position any member holds on this target.
function psiAdvantageVs(a, t) {
  const f = psiState(a).formation;
  const members = f ? enc.combatants.filter((x) => !x.destroyed && psiState(x).formation === f) : [a];
  return members.reduce((best, m) => psiState(m).advOver === t.id ? Math.max(best, psiState(m).adv) : best, 0);
}
let attack = null; // pending attack state
let fleshWound = null; // snapshot for the cinematic damage undo

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
            <button class="btn" data-crew="${ci}:10" title="Green crews: skill 10, Will 10, half cost">G</button>
            <button class="btn" data-crew="${ci}:12" title="Basic crews: skill 12, Will 11, standard">B</button>
            <button class="btn" data-crew="${ci}:15" title="Superior training: skill 15, Will 12, double cost">S</button>
            <button class="btn" data-crew="${ci}:18" title="Elite: skill 18, Will 14, five times cost">E</button>
          </span>
        </label>
        <label>Squadron (${PSI_CATEGORIES[psiCategory(c.design.sm)]})
          <input type="number" data-squad="${ci}" value="${c.squadron?.size || 1}" min="1" max="40"
            title="Mook fighter wings act as one body: 1 = a single ship; 5 = a wing; 20 = a squadron">
        </label>
        <label>&nbsp;<small class="muted">${c.squadron?.size > 1 ? `${c.squadron.size} fighters — damage pools; every ${Math.ceil(c.dhp / 2)} penetration downs one` : `${PSI_CATEGORIES[psiCategory(c.design.sm)]}: ${psiCategory(c.design.sm) >= 1 ? 'halves all penetrating damage (DR 2)' : 'full damage; goes first in the round'}`}</small></label>
        <label>Formation
          <input type="text" data-formation="${ci}" value="${esc(psiState(c).formation || '')}" placeholder="— flying solo —"
            title="Ships sharing a formation name fly as one wing: Advantage over a target is shared, and engaging one means engaging all">
        </label>
        ${repairControls(c, ci)}
      </div>
      <p class="muted">Dogfight: accel bonus +${psiAccelBonus(s.accelG)}${psiState(c).engagedWith ? ` · engaged with ${esc(psiState(c).engagedWith)}` : ' · not engaged'}${psiState(c).advOver ? ` · <b>Advantaged +${psiState(c).adv} over ${esc(psiState(c).advOver)}</b>` : ''}${psiState(c).morale === 'cowed' ? ' · <b>cowed: fights defensively</b>' : psiState(c).morale === 'fleeing' ? ' · <b>FLEEING the battle</b>' : ''}${psiState(c).tacticsPool > 0 ? ` · tactics pool ${psiState(c).tacticsPool} <button class="btn" data-pool="${ci}" title="Spend one +1 from the commander's plan on any roll this ship makes">spend +1</button>` : ''}${psiState(c).inspired ? ` · <b>inspired: crew at +1 this turn</b> <button class="btn" data-uninspire="${ci}" title="The turn ends: the rousing speech wears off">end</button>` : ''}</p>` : ''}
      <div class="dmg-grid">${SECTIONS.map((sec) => dmgRow(c, ci, sec)).join('')}</div>
      <p class="muted dmg-hint">Click a system to cycle OK → disabled → destroyed. ⚠ = volatile.${psi() ? ' ° = has an armor gap (can be targeted at -10, ignoring armor; disables at half damage).' : ''}</p>
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
    c.crewWill = CREW_QUALITY[skill]?.will ?? 11;
    log(`${c.id} crew set to ${CREW_QUALITY[skill]?.label ?? ''} (skill ${skill}, Will ${c.crewWill}).`);
    renderAll();
  }));
  host.querySelectorAll('[data-squad]').forEach((el) => el.addEventListener('change', () => {
    const c = enc.combatants[Number(el.dataset.squad)];
    const n = Math.max(1, Math.floor(Number(el.value) || 1));
    c.squadron = n > 1 ? { size: n, pool: 0, lost: 0 } : null;
    renderFleet();
  }));
  host.querySelectorAll('[data-pool]').forEach((b) => b.addEventListener('click', () => {
    const c = enc.combatants[Number(b.dataset.pool)];
    psiState(c).tacticsPool -= 1;
    log(`${c.id} spends +1 from the tactics pool (${psiState(c).tacticsPool} left) — apply it to any one roll.`);
    renderFleet();
  }));
  host.querySelectorAll('[data-uninspire]').forEach((b) => b.addEventListener('click', () => {
    const c = enc.combatants[Number(b.dataset.uninspire)];
    psiState(c).inspired = false;
    renderFleet();
  }));
  host.querySelectorAll('[data-formation]').forEach((el) => el.addEventListener('change', () => {
    const c = enc.combatants[Number(el.dataset.formation)];
    psiState(c).formation = el.value.trim();
    if (psiState(c).formation) log(`${c.id} joins formation "${psiState(c).formation}" — shared Advantage; engaging one member engages them all.`);
    renderFleet();
  }));
  host.querySelectorAll('[data-repair]').forEach((b) => b.addEventListener('click', () => {
    const ci = Number(b.dataset.repair);
    const c = enc.combatants[ci];
    const sel = host.querySelector(`[data-repair-sel="${ci}"]`);
    if (!sel?.value) return;
    const [sec, idx] = sel.value.split(':');
    const st = c.slots[sec][Number(idx)];
    if (!st || st.state !== 'disabled') return;
    const sup = psiState(c).supervised || 0;
    const r = psiRepairRoll(c.gunnerSkill + sup);
    const supNote = sup ? ` +${sup} supervised` : '';
    if (sup) psiState(c).supervised = 0; // the commander's coordination is spent
    if (r.success) {
      st.state = 'ok';
      log(`${c.id} jury-rigs ${st.name} (skill ${c.gunnerSkill}-8${supNote}, rolled ${r.dice}): back online after 3 turns of work!`);
    } else {
      st.norepair = true;
      log(`${c.id} fails to jury-rig ${st.name} (skill ${c.gunnerSkill}-8${supNote}, rolled ${r.dice}): it stays down for the rest of the fight.`);
    }
    renderAll();
  }));
  host.querySelectorAll('[data-slot]').forEach((el) => el.addEventListener('click', () => {
    const [ci, sec, i] = el.dataset.slot.split(':');
    const st = enc.combatants[Number(ci)].slots[sec][Number(i)];
    if (!st) return;
    st.state = st.state === 'ok' ? 'disabled' : st.state === 'disabled' ? 'destroyed' : 'ok';
    if (st.state === 'ok') delete st.norepair;
    renderAll();
  }));
}

function dmgRow(c, ci, sec) {
  const cells = c.slots[sec].map((st, i) => {
    if (!st) return `<span class="dmg-cell empty" title="no core system">·</span>`;
    const label = i === 6 ? 'C' : String(i + 1);
    const gap = psi() && st.sys && psiHasArmorGap(SYSTEMS[st.sys]);
    const title = `${sec} ${i === 6 ? '[core]' : `[${i + 1}]`} ${st.name}${st.volatile ? ' (volatile)' : ''}${gap ? ' (armor gap: can be hit through a gap at -10, ignoring armor)' : ''} — ${st.state}`;
    return `<span class="dmg-cell ${st.state}${st.sys ? '' : ' empty'}" data-slot="${ci}:${sec}:${i}" title="${esc(title)}">${label}${st.volatile ? '⚠' : ''}${gap ? '°' : ''}</span>`;
  }).join('');
  return `<div class="dmg-section"><span class="dmg-label">${sec[0].toUpperCase()}</span>${cells}</div>`;
}

// Jury-rig repairs (Psi-Wars): pick a disabled system, roll crew skill -8.
function disabledSystems(c) {
  const out = [];
  for (const sec of SECTIONS) {
    c.slots[sec].forEach((st, i) => {
      if (st && st.sys && st.state === 'disabled' && !st.norepair) out.push({ sec, i, name: st.name });
    });
  }
  return out;
}
function repairControls(c, ci) {
  const down = disabledSystems(c);
  if (!down.length) return '<label>&nbsp;<small class="muted">no disabled systems to jury-rig</small></label>';
  return `<label>Jury-rig repair (3 turns, skill-8)
    <span class="skill-pair">
      <select data-repair-sel="${ci}">${down.map((d) => `<option value="${d.sec}:${d.i}">${esc(`${d.sec} [${d.i === 6 ? 'core' : d.i + 1}] ${d.name}`)}</option>`).join('')}</select>
      <button class="btn" data-repair="${ci}" title="One attempt per system: a failure means it stays down for the rest of the fight">Roll</button>
    </span>
  </label>`;
}

// --- Psi-Wars dogfight card ----------------------------------------------------
function renderDogfight() {
  const host = $('dogfight');
  if (!host) return;
  if (!psi() || enc.combatants.length < 2) { host.innerHTML = ''; return; }
  const prev = {
    m: $('df-mover')?.value, o: $('df-opponent')?.value, man: $('df-maneuver')?.value,
    s: $('df-stunt')?.value, intim: $('df-intim')?.value, will: $('df-will')?.value,
  };
  const names = enc.combatants.map((c, i) => [String(i), c.id]);
  host.innerHTML = `
    <div class="card">
      <h2>Dogfight (Psi-Wars)</h2>
      <div class="grid2">
        <label>Mover <select id="df-mover"></select></label>
        <label>Against <select id="df-opponent"></select></label>
        <label>Maneuver <select id="df-maneuver"></select></label>
        <label>Stunt <select id="df-stunt"></select></label>
      </div>
      <div class="modal-actions" style="justify-content:flex-start">
        <span id="df-note" class="muted" style="font-size:12.5px"></span>
        <button class="btn primary" id="btn-contest">Roll the contest</button>
      </div>
      <div class="grid3" style="margin-top:6px">
        <label>Commander's Intimidation <input type="number" id="df-intim" min="3" max="25" value="12"></label>
        <label>Target crew's Will <input type="number" id="df-will" min="3" max="25" value="10"></label>
        <label>&nbsp;<span class="skill-pair">
          <button class="btn" id="btn-threat" title="Utter a threat over the comms: quick contest of Intimidation (+1 per size category you outclass them by) vs their Will">Issue threat</button>
          <button class="btn" id="btn-ram" title="Deliberate collision: lowest dST in dice, each die at (-2 + best accel bonus, max +5); both ships take it, screens don't help">Ram!</button>
        </span></label>
      </div>
    </div>`;
  fillSelect($('df-mover'), names, prev.m ?? '0');
  fillSelect($('df-opponent'), names, prev.o ?? '1');
  fillSelect($('df-maneuver'), Object.entries(PSI_MANEUVERS).map(([k, v]) => [k, v.name]), prev.man ?? 'close');
  fillSelect($('df-stunt'), [['0', 'None'], ['-2', 'Stunt -2 (+1)'], ['-4', 'Stunt -4 (+2)'], ['-6', 'Stunt -6 (+3)'], ['-8', 'Stunt -8 (+4)'], ['-10', 'Stunt -10 (+5)']], prev.s ?? '0');
  const note = () => {
    const m = enc.combatants[Number($('df-mover').value)];
    const o = enc.combatants[Number($('df-opponent').value)];
    if (!m || !o || m === o) { $('df-note').textContent = 'Pick two different ships.'; return; }
    const man = $('df-maneuver').value;
    const mb = psiAccelBonus(effectiveStats(m).accelG) * (man === 'evade' ? 2 : 1);
    $('df-note').textContent = `${m.id} Pilot ${m.pilotSkill}+${mb} vs ${o.id} Pilot ${o.pilotSkill}+${psiAccelBonus(effectiveStats(o).accelG)} — ${PSI_MANEUVERS[man].desc}.`;
  };
  if (prev.intim) $('df-intim').value = prev.intim;
  if (prev.will) $('df-will').value = prev.will;
  ['df-mover', 'df-opponent', 'df-maneuver', 'df-stunt'].forEach((id) => $(id).addEventListener('change', () => { note(); refreshExplain(); }));
  // Threats resist with the target crew's Will — follow the crew quality.
  $('df-opponent').addEventListener('change', () => {
    const o = enc.combatants[Number($('df-opponent').value)];
    if (o) $('df-will').value = o.crewWill ?? 11;
  });
  $('btn-contest').addEventListener('click', resolveDogfight);
  $('btn-threat').addEventListener('click', resolveThreat);
  $('btn-ram').addEventListener('click', resolveRam);
  note();
}

// Uttering Threats: a successful contest cows the target's crew; by 5+ they run.
function resolveThreat() {
  const m = enc.combatants[Number($('df-mover').value)];
  const t = enc.combatants[Number($('df-opponent').value)];
  if (!m || !t || m === t) return;
  const r = psiThreat({
    intimidation: Number($('df-intim').value) || 12,
    moverSM: m.design.sm,
    targetSM: t.design.sm,
    targetWill: Number($('df-will').value) || 10,
  });
  log(`— ${m.id}'s commander hails ${t.id} with a threat: Intimidation ${$('df-intim').value}${r.sizeBonus ? `+${r.sizeBonus} (looming ${r.sizeBonus} size categor${r.sizeBonus > 1 ? 'ies' : 'y'} over them)` : ''} rolls ${r.atk.dice} vs Will ${$('df-will').value} rolls ${r.def.dice}.`);
  if (r.result === 'fleeing') {
    psiState(t).morale = 'fleeing';
    log(`  ${t.id}'s crew breaks (beaten by ${r.by}): they turn and run for the jump point!`);
  } else if (r.result === 'cowed') {
    psiState(t).morale = 'cowed';
    log(`  ${t.id}'s crew is cowed: they won't close or take offensive action this fight.`);
  } else {
    log(`  ${t.id}'s crew holds firm — the threat falls flat.`);
  }
  renderFleet();
  refreshExplain();
}

// Deliberate collision: both ships take (lowest dST)d, screens bypassed.
function resolveRam() {
  const m = enc.combatants[Number($('df-mover').value)];
  const t = enc.combatants[Number($('df-opponent').value)];
  if (!m || !t || m === t) return;
  const accel = Math.max(psiAccelBonus(effectiveStats(m).accelG), psiAccelBonus(effectiveStats(t).accelG));
  const dice = psiCollisionDice(Math.min(m.dhp, t.dhp), accel);
  const dmg = rollDice(dice);
  log(`— ${m.id} RAMS ${t.id}: lowest dST ${Math.min(m.dhp, t.dhp)}, best accel bonus +${accel} → ${fmtDice(dice)} = ${dmg} to BOTH ships, straight through the force screens.`);
  for (const ship of [t, m]) {
    const dr = psi() && psiCategory(ship.design.sm) >= 1 ? 2 : 1;
    const res = applyHit(ship, {
      section: ship === m ? 'front' : ship.facing,
      basicDamage: dmg, div: 1, damageReduction: dr, ignoreScreen: true,
    });
    log(`  ${ship.id}:`);
    res.log.forEach((l) => log(`    ${l}`));
    if (ship.destroyed) log(`  💥 ${ship.id} is destroyed in the collision!`);
  }
  renderFleet();
  refreshExplain();
}

function resolveDogfight() {
  const m = enc.combatants[Number($('df-mover').value)];
  const o = enc.combatants[Number($('df-opponent').value)];
  if (!m || !o || m === o) return;
  const man = $('df-maneuver').value;
  const ms = psiState(m);
  const os = psiState(o);
  if (man === 'retreat' && enc.combatants.some((x) => x !== m && psiState(x).engagedWith === m.id && !x.destroyed)) {
    log(`${m.id} cannot retreat: someone is still engaged with them (break the engagement with Evasive Action first).`);
    return;
  }
  if (man === 'evade' && ms.advOver) {
    log(`${m.id} gives up Advantage over ${ms.advOver} to go evasive.`);
    ms.advOver = null; ms.adv = 0;
  }
  const res = psiManeuverContest({
    moverSkill: m.pilotSkill,
    moverAccel: effectiveStats(m).accelG,
    opponentSkill: o.pilotSkill,
    opponentAccel: effectiveStats(o).accelG,
    maneuver: man,
    stuntPenalty: Number($('df-stunt').value) || 0,
    moverSR: effectiveStats(m).sr ?? 4,
  });
  log(`— ${m.id} ${PSI_MANEUVERS[man].name} vs ${o.id}:`);
  res.log.forEach((l) => log(`  ${l}`));
  if (res.failedStunt) {
    m.maneuver = 'uncontrolledDrift';
    log(`  ${m.id} tumbles into an uncontrolled drift${res.wrecked ? ' — mark the engines disabled on their card!' : ''} (no dodge until they recover).`);
  } else if (res.won) {
    if (man === 'close') {
      if (ms.engagedWith === o.id || res.by >= 10) {
        ms.adv = Math.min(4, (ms.advOver === o.id ? ms.adv : 0) + 1);
        ms.advOver = o.id;
        log(`  ${m.id} is on ${o.id}'s tail: Advantaged +${ms.adv} to hit (cumulative, max +4).`);
      }
      ms.engagedWith = o.id;
      log(`  ${m.id} is now engaged with ${o.id} — Close range (Engaged, -4).`);
      if (psiState(o).formation) log(`  ${o.id} flies in formation "${psiState(o).formation}": engaging one member means ${m.id} is engaged with them all.`);
    } else if (man === 'evade') {
      if (ms.engagedWith === o.id) ms.engagedWith = null;
      if (os.engagedWith === m.id) { os.engagedWith = null; log(`  ${o.id} loses the engagement.`); }
      if (os.advOver === m.id) { os.advOver = null; os.adv = 0; log(`  ${o.id}'s Advantage is shaken off.`); }
      log(`  ${m.id} breaks away clean.`);
    } else if (man === 'hold') {
      if (os.advOver === m.id) { os.advOver = null; os.adv = 0; log(`  ${m.id} shakes ${o.id} off their tail.`); }
      else log(`  ${m.id} holds course.`);
    } else if (man === 'retreat') {
      ms.engagedWith = null;
      log(`  ${m.id} escapes the battle — back to Neutral range (or gone entirely).`);
    }
  } else {
    log(`  No change: ${o.id} matches the move.`);
  }
  renderFleet();
  renderDogfight();
  refreshExplain();
}

// --- Psi-Wars command & initiative card ----------------------------------------
function renderCommand() {
  const host = $('command');
  if (!host) return;
  if (!psi() || enc.combatants.length < 2) { host.innerHTML = ''; return; }
  const prev = {
    a: $('cmd-a')?.value, b: $('cmd-b')?.value,
    at: $('cmd-a-skill')?.value, bt: $('cmd-b-skill')?.value,
    am: $('cmd-a-mode')?.value, bm: $('cmd-b-mode')?.value,
    lead: $('cmd-lead')?.value,
    precog: $('cmd-precog')?.checked, telepath: $('cmd-telepath')?.checked,
  };
  const order = psiTurnOrder(enc.combatants.filter((c) => !c.destroyed).map((c) => ({ id: c.id, sm: c.design.sm, pilotSkill: c.pilotSkill })));
  const names = enc.combatants.map((c, i) => [String(i), c.id]);
  const modes = [['normal', 'Straight Tactics'], ['desperate', 'Desperate (+2, weaker defenses)'], ['cunning', 'Cunning (-3, double winnings)']];
  host.innerHTML = `
    <div class="card">
      <h2>Command (Psi-Wars)</h2>
      <p class="muted">Turn order: ${order.map((s, i) => `${i + 1}. ${esc(s.id)} (${PSI_CATEGORIES[psiCategory(s.sm)]})`).join(' · ')}</p>
      <div class="grid2">
        <label>Your commander's ship <select id="cmd-a"></select></label>
        <label>Enemy commander's ship <select id="cmd-b"></select></label>
        <label>Your Tactics
          <span class="skill-pair">
            <input type="number" id="cmd-a-skill" min="3" max="25" value="${prev.at ?? 12}">
            <select id="cmd-a-mode"></select>
          </span>
        </label>
        <label>Enemy Tactics
          <span class="skill-pair">
            <input type="number" id="cmd-b-skill" min="3" max="25" value="${prev.bt ?? 12}">
            <select id="cmd-b-mode"></select>
          </span>
        </label>
      </div>
      <div class="acc-list">
        <label class="acc-row"><input type="checkbox" id="cmd-precog" ${prev.precog ? 'checked' : ''}> <span><small>Precognitive commander (+4 Tactics: Prognostication or Visions of the battle)</small></span></label>
        <label class="acc-row"><input type="checkbox" id="cmd-telepath" ${prev.telepath ? 'checked' : ''}> <span><small>Telepath reading the enemy commander (+2 Tactics via Telereceive)</small></span></label>
      </div>
      <div class="modal-actions" style="justify-content:flex-start">
        <button class="btn primary" id="btn-tactics">Contest of Tactics</button>
        <label style="display:inline-flex; align-items:center; gap:6px">Leadership
          <input type="number" id="cmd-lead" min="3" max="25" value="${prev.lead ?? 12}" style="width:56px"></label>
        <button class="btn" id="btn-inspire">Inspire the crew</button>
        <button class="btn" id="btn-supervise">Supervise damage control</button>
      </div>
    </div>`;
  fillSelect($('cmd-a'), names, prev.a ?? '0');
  fillSelect($('cmd-b'), names, prev.b ?? '1');
  fillSelect($('cmd-a-mode'), modes, prev.am ?? 'normal');
  fillSelect($('cmd-b-mode'), modes, prev.bm ?? 'normal');
  $('btn-tactics').addEventListener('click', resolveTactics);
  $('btn-inspire').addEventListener('click', () => {
    const c = enc.combatants[Number($('cmd-a').value)];
    if (!c) return;
    const r = psiInspire(Number($('cmd-lead').value) || 12);
    if (r.inspired) {
      psiState(c).inspired = true;
      log(`— ${c.id}'s commander rallies the crew (Leadership, rolled ${r.roll.dice}, made it by ${r.roll.margin}): every nameless crewman fights at +1 this turn!`);
    } else {
      log(`— ${c.id}'s commander tries a rousing speech (Leadership, rolled ${r.roll.dice}): ${r.roll.success ? 'a solid effort, but it takes success by 5+ to lift the whole crew' : 'it falls flat'}.`);
    }
    renderFleet();
    refreshExplain();
  });
  $('btn-supervise').addEventListener('click', () => {
    const c = enc.combatants[Number($('cmd-a').value)];
    if (!c) return;
    const r = successRoll(Number($('cmd-lead').value) || 12);
    if (r.success) {
      psiState(c).supervised = r.critSuccess ? 2 : 1;
      log(`— ${c.id}'s commander coordinates damage control (Leadership, rolled ${r.dice})${r.critSuccess ? ' critically' : ''}: the next jury-rig roll is at +${psiState(c).supervised}.`);
    } else {
      log(`— ${c.id}'s commander gets underfoot in engineering (Leadership, rolled ${r.dice}): no bonus.`);
    }
    renderFleet();
    refreshExplain();
  });
}

function resolveTactics() {
  const a = enc.combatants[Number($('cmd-a').value)];
  const b = enc.combatants[Number($('cmd-b').value)];
  if (!a || !b || a === b) return;
  const sa = psiState(a);
  const sb = psiState(b);
  const aMode = $('cmd-a-mode').value;
  const bMode = $('cmd-b-mode').value;
  const res = psiTacticsContest({
    aSkill: Number($('cmd-a-skill').value) || 12,
    bSkill: Number($('cmd-b-skill').value) || 12,
    aMode, bMode,
    aCunningUses: sa.cunningUses || 0,
    bCunningUses: sb.cunningUses || 0,
    aPrecog: $('cmd-precog').checked,
    aTelepath: $('cmd-telepath').checked,
  });
  if (aMode === 'cunning') sa.cunningUses = (sa.cunningUses || 0) + 1;
  if (bMode === 'cunning') sb.cunningUses = (sb.cunningUses || 0) + 1;
  log(`— Contest of Tactics: ${a.id} at ${res.aEff} rolls ${res.a.dice} vs ${b.id} at ${res.bEff} rolls ${res.b.dice}.`);
  if (res.winner) {
    const w = res.winner === 'a' ? a : b;
    psiState(w).tacticsPool = (psiState(w).tacticsPool || 0) + res.pool;
    log(`  ${w.id}'s commander out-thinks the enemy: banks ${res.pool} point(s) of tactical advantage (+1 each, spend from the ship card).${(res.winner === 'a' ? aMode : bMode) === 'cunning' ? ' Cunning Tactics doubled the winnings.' : ''}`);
    if ((res.winner === 'a' ? aMode : bMode) === 'desperate') log(`  Desperate Offense: ${w.id} defends at -1 this turn.`);
  } else {
    log('  Neither commander gains the upper hand.');
  }
  renderFleet();
  refreshExplain();
}

// --- Orbital bombardment (Psi-Wars) -------------------------------------------
function renderBombard() {
  const host = $('bombard');
  if (!host) return;
  if (!psi() || !enc.combatants.length) { host.innerHTML = ''; return; }
  const prev = { s: $('bb-ship')?.value, w: $('bb-weapon')?.value, b: $('bb-beamtype')?.value };
  host.innerHTML = `
    <div class="card">
      <h2>Orbital bombardment</h2>
      <div class="grid3">
        <label>Ship <select id="bb-ship"></select></label>
        <label>Battery <select id="bb-weapon"></select></label>
        <label>Beam type <select id="bb-beamtype"></select></label>
      </div>
      <div class="modal-actions" style="justify-content:flex-start">
        <span id="bb-note" class="muted" style="font-size:12.5px"></span>
        <button class="btn" id="btn-bombard">Fire at the surface</button>
      </div>
    </div>`;
  fillSelect($('bb-ship'), enc.combatants.map((c, i) => [String(i), c.id]), prev.s ?? '0');
  const wireWeapons = () => {
    const c = enc.combatants[Number($('bb-ship').value)];
    const beams = c ? combatantWeapons(c).filter((w) => (w.opts.weaponType || 'beam') === 'beam') : [];
    fillSelect($('bb-weapon'), beams.length ? beams.map((w, i) => [String(i), w.label]) : [['', '— no working beam batteries —']], prev.w);
    $('bb-note').textContent = c ? `Gunner ${c.gunnerSkill} at -4; 20 seconds to line up the shot. The weapon must reach Long range.` : '';
  };
  fillSelect($('bb-beamtype'), Object.entries(BEAM_TYPES).map(([k, v]) => [k, v.name]), prev.b ?? 'laser');
  wireWeapons();
  $('bb-ship').addEventListener('change', () => { wireWeapons(); refreshExplain(); });
  $('btn-bombard').addEventListener('click', () => {
    const c = enc.combatants[Number($('bb-ship').value)];
    if (!c) return;
    const beams = combatantWeapons(c).filter((w) => (w.opts.weaponType || 'beam') === 'beam');
    const w = beams[Number($('bb-weapon').value)];
    if (!w) return;
    const stats = beamStats(w.info.output, $('bb-beamtype').value);
    const eff = c.gunnerSkill - 4;
    const r = successRoll(eff);
    if (!r.success) {
      log(`— ${c.id} bombards the surface with ${w.entry.name} (Gunner ${c.gunnerSkill}-4): rolls ${r.dice}, misses by ${-r.margin} — the shot scatters ${-r.margin * 10} yards.`);
      return;
    }
    const dmg = rollDice(stats.dice);
    log(`— ${c.id} bombards the surface with ${w.entry.name} (Gunner ${c.gunnerSkill}-4): rolls ${r.dice}, HIT. ${fmtDice(stats.dice)} → ${dmg} dDamage = ${dmg * 5} HP of explosive damage on the ground (half the usual ×10 for punching down through atmosphere).`);
  });
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
        advantage: psiAdvantageVs(a, t),
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
      profile: { kind: 'psiMissile', mKey, section, shots: effShots, rcl: 1, firedFrom: range },
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
  refreshExplain(); // dynamic weapon controls get their Explain notes re-attached
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
  if (attack.profile.kind === 'psiMissile') {
    // Psi-Wars: missiles are shot down by point defense, not dodged.
    $('atk-status').textContent = `${hits} missile(s) inbound. The target's gunners may try point defense.`;
    $('btn-dodge').textContent = 'Point defense';
    $('btn-dodge').disabled = false;
  } else {
    $('atk-status').textContent = `${hits} hit(s) pending. ${r.critSuccess ? 'Critical: no dodge allowed.' : 'Target may dodge.'}`;
    $('btn-dodge').textContent = 'Target dodges';
    $('btn-dodge').disabled = r.critSuccess || !canDodge(attack.t);
  }
  $('btn-damage').disabled = false;
}

function doDodge() {
  if (!attack?.hits) return;
  const t = attack.t;
  if (attack.profile.kind === 'psiMissile') {
    // Point defense: a Gunner roll per the Psi-Wars table; margin downs extra missiles.
    const mods = psiPointDefenseMods({
      mKey: attack.profile.mKey,
      firedFrom: attack.profile.firedFrom,
      defenderSM: t.design.sm,
      heavyWeapon: false,
    });
    const total = mods.reduce((s, [v]) => s + v, 0);
    const eff = t.gunnerSkill + total;
    const r = successRoll(eff);
    const detail = mods.filter(([v]) => v).map(([v, l]) => `${v > 0 ? '+' : ''}${v} ${l}`).join(', ');
    if (r.success) {
      const downed = Math.min(attack.hits, 1 + r.margin);
      attack.hits -= downed;
      log(`${t.id} point defense (Gunner ${t.gunnerSkill}${total >= 0 ? '+' : ''}${total}: ${detail}) rolls ${r.dice}: shoots down ${downed} missile(s); ${attack.hits} still inbound.`);
    } else {
      log(`${t.id} point defense (needs ${eff}: ${detail}) rolls ${r.dice}: the missiles get through.`);
    }
    $('btn-dodge').disabled = true;
    if (!attack.hits) { $('btn-damage').disabled = true; $('atk-status').textContent = 'All missiles shot down!'; }
    else $('atk-status').textContent = `${attack.hits} missile(s) to resolve.`;
    return;
  }
  const ds = dodgeScore({
    piloting: t.pilotSkill,
    hnd: effectiveStats(t).hnd ?? 0,
    turn: enc.turn,
    // Psi-Wars: ECM only helps against missiles (which use point defense here).
    ecm: psi() ? 0 : computeEcm(t),
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
  // Torpedoes are too large to thread an armor gap.
  let gapAllowed = $('t-gap')?.checked;
  if (gapAllowed && profile.kind === 'psiMissile' && PSI_MISSILES[profile.mKey].torpedo) {
    gapAllowed = false;
    log('Torpedoes cannot target armor gaps — resolving as a normal hit.');
  }
  // Snapshot for the cinematic Flesh Wound undo (spend 1 CP).
  const snapshot = psi() ? JSON.stringify({
    curDhp: t.curDhp, screen: t.screen, slots: t.slots,
    destroyed: t.destroyed, htChecksAt: t.htChecksAt, squadron: t.squadron,
  }) : null;
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
      armorGap: gapAllowed,
      damageReduction: dr,
    });
    res.log.forEach((l) => log(`  ${l}`));
    if (t.destroyed) { log(`💥 ${t.id} is destroyed!`); break; }
  }
  attack.hits = 0;
  $('btn-damage').disabled = true;
  $('btn-dodge').disabled = true;
  $('atk-status').textContent = 'Damage applied.';
  // Offer the Flesh Wound undo if the target actually got hurt.
  if (snapshot && JSON.parse(snapshot).curDhp > t.curDhp) {
    fleshWound = { t, snapshot, section: profile.section };
    $('btn-flesh').style.display = '';
  } else {
    fleshWound = null;
    if ($('btn-flesh')) $('btn-flesh').style.display = 'none';
  }
  renderFleet();
}

// Flesh Wound (Psi-Wars): spend a character point — the hit becomes a graze
// worth 10% of dHP and one disabled system, whatever the dice said.
function doFleshWound() {
  if (!fleshWound) return;
  const { t, snapshot, section } = fleshWound;
  Object.assign(t, JSON.parse(snapshot));
  const graze = Math.ceil(t.dhp * 0.1);
  t.curDhp -= graze;
  const lines = damageSystem(t, section, Math.floor(Math.random() * 6), 'disable');
  log(`— ${t.id} spends a character point: "just a flesh wound!" Damage rewound to ${graze} (10% of dHP).`);
  lines.forEach((l) => log(`  ${l}`));
  fleshWound = null;
  $('btn-flesh').style.display = 'none';
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
      htChecksAt: c.htChecksAt, squadron: c.squadron || null, psi: c.psi || null,
      crewWill: c.crewWill ?? 11,
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
      squadron: d.squadron || null, psi: d.psi || null, crewWill: d.crewWill ?? 11,
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
  renderDogfight();
  renderCommand();
  renderBombard();
  renderAttackSelectors();
  renderToggles();
  renderMods();
  refreshExplain();
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
  $('btn-flesh').addEventListener('click', doFleshWound);
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
  optionHelp: COMBAT_OPTION_HELP,
  sectionHelp: COMBAT_SECTION_HELP,
});
log('Encounter ready. Add ships, set facings and maneuvers, then fire away.');
