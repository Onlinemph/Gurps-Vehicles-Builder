// ---------------------------------------------------------------------------
// GURPS Spaceships tactical map — UI. An SVG hex map driving the SS3 engine
// (js/ss/tactical.js) with the SS1 damage pipeline (js/ss/combat.js).
// ---------------------------------------------------------------------------

import { SECTIONS } from './tables.js';
import { SS_PRESETS } from './presets.js';
import { PSIWARS_PRESETS } from './presets-psiwars.js';
import { initExplain } from '../help-core.js';
import { TAC_FIELD_HELP, TAC_OPTION_HELP, TAC_SECTION_HELP } from './help-combat.js';
import {
  BEAM_TYPES, GUN_TYPES, NUKES,
  applyHit, beamStats, combatantWeapons, conventionalWarhead, createCombatant,
  dodgeScore, effectiveStats, missileSAcc, parseDice,
  rapidFireBonus, rollDice, successRoll,
} from './combat.js';
import {
  HEX_DIRS, TURN_LENGTH_MOD, arcAllows, beamHexRange, bearingArc, burnPoints,
  coast, facingSteps, hexAdd, hexDistance, hexEq, hexLength, hexSub,
  hexesToMps, maxFacingChange, missilePerformance, missileSeek, mpsToHexes,
  scaleFactor, tacticalRangeMod, tacticalVelocityMod, thrustRating,
} from './tactical.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const SIDE_COLORS = ['#2b6cb0', '#b03a2b', '#2b8a4b', '#8a2bb0'];
const R = 26; // hex radius, px
const SQ3 = Math.sqrt(3);

const battle = {
  scaleIdx: 1,
  turn: '3m',
  round: 1,
  ships: [],
  missiles: [],
  nextId: 1,
};
let selId = null;
let targetId = null;
let view = { x: -400, y: -300, w: 1100 };

// --- Geometry ----------------------------------------------------------------
const toPx = (h) => ({ x: 1.5 * R * h.q, y: SQ3 * R * (h.r + h.q / 2) });
function pxToHex(x, y) {
  const q = x / (1.5 * R);
  const r = y / (SQ3 * R) - q / 2;
  // cube round
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(-q - r);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - (-q - r));
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return { q: rq, r: rr };
}
const hexPoints = (cx, cy) => {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    pts.push(`${cx + R * Math.cos(a)},${cy + R * Math.sin(a)}`);
  }
  return pts.join(' ');
};
// Direction index → angle (flat-top; dir 0 = up).
const dirAngle = (d) => [270, 330, 30, 90, 150, 210][d];

// --- State helpers -------------------------------------------------------------
const ship = (id) => battle.ships.find((s) => s.id === id) || null;
const sel = () => ship(selId);
const target = () => ship(targetId);

function isReactionless(s) {
  return effectiveStats(s.c).move.includes('G/c');
}
function shipTR(s) {
  return thrustRating(effectiveStats(s.c).accelG, battle.scaleIdx, battle.turn);
}
function computeEcm(c) {
  let n = 0;
  for (const sec of SECTIONS) c.slots[sec].forEach((st) => { if (st && st.sys === 'defensiveECM' && st.state === 'ok') n += 1; });
  return Math.min(n, 3);
}

function addShip(design, side) {
  const c = createCombatant(JSON.parse(JSON.stringify(design)), { id: `${design.name}-${battle.nextId}` });
  const n = battle.ships.filter((s) => s.side === side).length;
  const s = {
    id: battle.nextId++,
    name: design.name,
    side,
    c,
    pos: side === 0 ? { q: -6, r: n * 2 + 3 } : { q: 6, r: n * 2 - 3 - n },
    vel: { q: 0, r: 0 },
    facing: side === 0 ? 1 : 4,
    bank: 0,
    facingLeft: 0,
    active: false,
    moved: false,
    deltaVLeft: c.result.stats.deltaV || 0,
  };
  battle.ships.push(s);
  log(`${s.name} deploys (side ${side + 1}).`);
  renderAll();
}

// --- Map rendering ---------------------------------------------------------------
function render() {
  const svg = $('map');
  const vh = view.w * (svg.clientHeight / Math.max(svg.clientWidth, 1) || 0.7);
  svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${vh}`);
  const parts = [];

  // grid over the visible area (cap the count)
  const q0 = Math.floor((view.x - R) / (1.5 * R)) - 1;
  const q1 = Math.ceil((view.x + view.w + R) / (1.5 * R)) + 1;
  if ((q1 - q0) < 80) {
    for (let q = q0; q <= q1; q++) {
      const r0 = Math.floor((view.y - R) / (SQ3 * R) - q / 2) - 1;
      const r1 = Math.ceil((view.y + vh + R) / (SQ3 * R) - q / 2) + 1;
      for (let r = r0; r <= r1; r++) {
        const p = toPx({ q, r });
        parts.push(`<polygon points="${hexPoints(p.x, p.y)}" class="hex${(q === 0 && r === 0) ? ' origin' : ''}"/>`);
      }
    }
  }

  // velocity ghosts and vectors
  for (const s of battle.ships) {
    const p = toPx(s.pos);
    if (hexLength(s.vel) > 0) {
      const g = toPx(coast(s.pos, s.vel));
      parts.push(`<line x1="${p.x}" y1="${p.y}" x2="${g.x}" y2="${g.y}" class="vel-line" style="stroke:${SIDE_COLORS[s.side]}"/>`);
      parts.push(`<circle cx="${g.x}" cy="${g.y}" r="${R * 0.45}" class="ghost" style="stroke:${SIDE_COLORS[s.side]}"/>`);
    }
  }
  // range line
  if (sel() && target()) {
    const a = toPx(sel().pos);
    const b = toPx(target().pos);
    parts.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="range-line"/>`);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const d = hexDistance(sel().pos, target().pos);
    parts.push(`<text x="${mid.x}" y="${mid.y - 6}" class="range-label">${d} hex${d === 1 ? '' : 'es'} (${fmtMod(tacticalRangeMod(d, battle.scaleIdx))})</text>`);
  }

  // missiles
  for (const m of battle.missiles) {
    const p = toPx(m.pos);
    if (hexLength(m.vel) > 0) {
      const g = toPx(coast(m.pos, m.vel));
      parts.push(`<line x1="${p.x}" y1="${p.y}" x2="${g.x}" y2="${g.y}" class="vel-line missile"/>`);
    }
    parts.push(`<rect x="${p.x - 7}" y="${p.y - 7}" width="14" height="14" transform="rotate(45 ${p.x} ${p.y})" class="missile-token"/>`);
    parts.push(`<text x="${p.x}" y="${p.y - 12}" class="token-label">${m.salvo}× ${m.cal}cm</text>`);
  }

  // ships
  for (const s of battle.ships) {
    const p = toPx(s.pos);
    const selCls = s.id === selId ? ' selected' : s.id === targetId ? ' targeted' : '';
    const dead = s.c.destroyed ? ' dead' : '';
    parts.push(`<g class="ship${selCls}${dead}" data-ship="${s.id}" transform="translate(${p.x} ${p.y})">
      <circle r="${R * 0.78}" class="ship-ring" style="stroke:${SIDE_COLORS[s.side]}"/>
      <polygon points="0,-${R * 0.62} ${R * 0.42},${R * 0.45} -${R * 0.42},${R * 0.45}" transform="rotate(${dirAngle(s.facing) + 90})" style="fill:${SIDE_COLORS[s.side]}"/>
      <text y="${R + 12}" class="token-label">${esc(s.name)}${s.moved ? ' ✓' : ''}</text>
    </g>`);
  }

  svg.innerHTML = parts.join('');
  svg.querySelectorAll('[data-ship]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = Number(el.dataset.ship);
      if (selId !== null && id !== selId && ship(id).side !== sel()?.side) {
        targetId = id;
      } else {
        selId = id;
        targetId = null;
      }
      renderAll();
    });
  });
}

const fmtMod = (v) => `${v >= 0 ? '+' : ''}${v}`;

// pan/zoom
function initMap() {
  const svg = $('map');
  let drag = null;
  svg.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false }; });
  svg.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const k = view.w / svg.clientWidth;
    const dx = (e.clientX - drag.x) * k;
    const dy = (e.clientY - drag.y) * k;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    view.x = drag.vx - dx;
    view.y = drag.vy - dy;
    render();
  });
  svg.addEventListener('pointerup', () => { drag = null; });
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const k = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    const rect = svg.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    const vh = view.w * (rect.height / rect.width);
    view.x += view.w * (1 - k) * fx;
    view.y += vh * (1 - k) * fy;
    view.w *= k;
    render();
  }, { passive: false });
}

// --- Turn order / movement --------------------------------------------------------
function renderTurnOrder() {
  $('round-no').textContent = battle.round;
  const host = $('turn-order');
  host.innerHTML = '';
  battle.ships.forEach((s) => {
    const row = document.createElement('div');
    row.className = `turn-row${s.id === selId ? ' sel' : ''}${s.c.destroyed ? ' dead' : ''}`;
    row.innerHTML = `<span class="side-dot" style="background:${SIDE_COLORS[s.side]}"></span>
      <b>${esc(s.name)}</b>
      <small>dHP ${s.c.curDhp}/${s.c.dhp} · v ${hexLength(s.vel)}</small>
      <span class="turn-btns">
        <button class="btn" data-act="${s.id}" ${s.moved || s.c.destroyed ? 'disabled' : ''}>${s.active ? 'moving…' : s.moved ? 'moved' : 'move'}</button>
        <button class="btn" data-side="${s.id}" title="switch side">⇄</button>
        <button class="btn" data-del="${s.id}">✕</button>
      </span>`;
    host.appendChild(row);
  });
  host.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => activate(Number(b.dataset.act))));
  host.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    battle.ships = battle.ships.filter((s) => s.id !== Number(b.dataset.del));
    if (selId === Number(b.dataset.del)) selId = null;
    renderAll();
  }));
  host.querySelectorAll('[data-side]').forEach((b) => b.addEventListener('click', () => {
    const s = ship(Number(b.dataset.side));
    s.side = (s.side + 1) % 2;
    renderAll();
  }));
}

function activate(id) {
  const s = ship(id);
  if (!s || s.moved) return;
  selId = id;
  targetId = null;
  s.active = true;
  s.pos = coast(s.pos, s.vel);
  s.bank = Math.min(s.bank + shipTR(s), Math.max(shipTR(s) * 2, 3));
  s.facingLeft = maxFacingChange(s.c.design.sm, battle.turn);
  log(`${s.name} coasts to (${s.pos.q},${s.pos.r})${hexLength(s.vel) ? ` at ${hexLength(s.vel)} hexes/turn` : ''}. Thrust available: ${Math.floor(s.bank)}.`);
  renderAll();
}

function renderSelected() {
  const s = sel();
  const card = $('sel-card');
  if (!s) { card.style.display = 'none'; renderAttack(); return; }
  card.style.display = '';
  $('sel-name').textContent = s.name;
  const st = effectiveStats(s.c);
  const rless = isReactionless(s);
  $('sel-stats').innerHTML = `${esc(st.move)} · Hnd ${st.hnd ?? '—'} · dDR ${esc(st.ddr)} · dHP ${s.c.curDhp}/${s.c.dhp}
    <br>TR ${Math.round(shipTR(s) * 100) / 100}/turn · vel ${hexLength(s.vel)} hexes · facing ${s.facing}
    ${rless ? ' · reactionless' : ` · Δv left ${Math.round(s.deltaVLeft * 100) / 100} mps (${Math.floor(burnPoints(s.deltaVLeft, battle.scaleIdx, battle.turn))} BP)`}`;

  const mv = $('sel-move');
  if (s.active && !s.moved) {
    mv.innerHTML = `
      <p class="muted" style="margin:6px 0 2px">Thrust (bank ${Math.floor(s.bank)}): </p>
      <div class="thrust-pad">${HEX_DIRS.map((d, i) => `<button class="btn" data-thrust="${i}" style="transform:rotate(0deg)">${['↑', '↗', '↘', '↓', '↙', '↖'][i]}</button>`).join('')}</div>
      <p class="muted" style="margin:6px 0 2px">Facing (${s.facingLeft === 3 ? 'any' : `${s.facingLeft} left`}):
        <button class="btn" data-rot="-1">⟲</button>
        <button class="btn" data-rot="1">⟳</button>
        <button class="btn primary" id="btn-done-move" style="margin-left:12px">End move</button></p>`;
    mv.querySelectorAll('[data-thrust]').forEach((b) => b.addEventListener('click', () => {
      const dir = HEX_DIRS[Number(b.dataset.thrust)];
      if (Math.floor(s.bank) < 1) { flash('No thrust left this turn.'); return; }
      if (!rless) {
        const mps = hexesToMps(1, battle.scaleIdx, battle.turn);
        if (s.deltaVLeft < mps) { flash('Out of delta-V!'); return; }
        s.deltaVLeft -= mps;
      }
      s.bank -= 1;
      s.vel = hexAdd(s.vel, dir);
      renderAll();
    }));
    mv.querySelectorAll('[data-rot]').forEach((b) => b.addEventListener('click', () => {
      if (s.facingLeft <= 0) { flash('No facing changes left.'); return; }
      s.facing = (s.facing + Number(b.dataset.rot) + 6) % 6;
      if (s.facingLeft < 3) s.facingLeft -= 1;
      renderAll();
    }));
    mv.querySelector('#btn-done-move').addEventListener('click', () => {
      s.active = false;
      s.moved = true;
      log(`${s.name} ends its move: velocity ${hexLength(s.vel)} hexes/turn, facing ${s.facing}.`);
      renderAll();
    });
  } else {
    mv.innerHTML = `<p class="muted">${s.moved ? 'Already moved this round.' : 'Press "move" in the round list to take this ship’s movement.'}</p>`;
  }

  // damage grid (click to cycle, same as the tracker)
  const dmg = $('sel-dmg');
  dmg.innerHTML = SECTIONS.map((sec) => {
    const cells = s.c.slots[sec].map((stt, i) => {
      if (!stt) return `<span class="dmg-cell empty">·</span>`;
      const label = i === 6 ? 'C' : String(i + 1);
      return `<span class="dmg-cell ${stt.state}${stt.sys ? '' : ' empty'}" data-slot="${sec}:${i}" title="${esc(stt.name)} — ${stt.state}">${label}${stt.volatile ? '⚠' : ''}</span>`;
    }).join('');
    return `<div class="dmg-section"><span class="dmg-label">${sec[0].toUpperCase()}</span>${cells}</div>`;
  }).join('');
  dmg.querySelectorAll('[data-slot]').forEach((el) => el.addEventListener('click', () => {
    const [sec, i] = el.dataset.slot.split(':');
    const stt = s.c.slots[sec][Number(i)];
    stt.state = stt.state === 'ok' ? 'disabled' : stt.state === 'disabled' ? 'destroyed' : 'ok';
    renderAll();
  }));
  renderAttack();
}

// --- Attacks -----------------------------------------------------------------------
function weaponChoices(s, t) {
  const arc = bearingArc(s.pos, s.facing, t.pos);
  return combatantWeapons(s.c).map((w, i) => {
    const mount = w.entry.spinal ? 'spinal' : (w.opts.mount || 'turret');
    const ok = arcAllows(w.section, mount, arc);
    return { ...w, i, arcOk: ok, label: `${ok ? '' : '⛔ '}${w.label}` };
  });
}

function renderAttack() {
  const s = sel();
  const t = target();
  const card = $('atk-card');
  if (!s || !t || s.c.destroyed) { card.style.display = 'none'; return; }
  card.style.display = '';
  $('atk-vs').textContent = `${s.name} → ${t.name}`;
  const weapons = weaponChoices(s, t);
  const wsel = $('atk-weapon');
  const prev = wsel.value;
  wsel.innerHTML = weapons.map((w) => `<option value="${w.i}">${esc(w.label)}</option>`).join('') || '<option value="">— no weapons —</option>';
  if ([...wsel.options].some((o) => o.value === prev)) wsel.value = prev;
  const w = weapons[Number(wsel.value)] || null;
  const kind = w ? (w.opts.weaponType || 'beam') : 'beam';

  const extra = $('atk-extra');
  if (kind === 'beam') {
    $('atk-extra-label').firstChild.textContent = 'Beam type ';
    const prevB = extra.value;
    extra.innerHTML = Object.entries(BEAM_TYPES).map(([k, v]) => `<option value="${k}">${esc(v.name)}</option>`).join('');
    if ([...extra.options].some((o) => o.value === prevB)) extra.value = prevB;
  } else {
    $('atk-extra-label').firstChild.textContent = 'Warhead ';
    const prevW = extra.value;
    extra.innerHTML = `<option value="conventional">Conventional</option>` + Object.entries(NUKES).map(([k, v]) => `<option value="${k}">${esc(v.name)}</option>`).join('');
    if ([...extra.options].some((o) => o.value === prevW)) extra.value = prevW;
  }
  $('btn-launch').style.display = kind === 'missile' ? '' : 'none';
  $('btn-fire').style.display = kind === 'missile' ? 'none' : '';

  if (!w) { $('atk-mods').textContent = ''; $('atk-eff').textContent = ''; return; }

  const dist = hexDistance(s.pos, t.pos);
  const shots = Math.max(1, Number($('atk-shots').value) || 1);
  const skill = Number($('atk-skill-in').value) || 12;
  const mods = [];
  const add = (v, l) => { if (v) mods.push([v, l]); };
  add(t.c.design.sm, `target SM +${t.c.design.sm}`);
  const incomingArc = bearingArc(t.pos, t.facing, s.pos);
  const section = incomingArc === 'own' ? 'central' : incomingArc;
  if (t.c.design.streamlined && (section === 'front' || section === 'rear')) add(-1, 'streamlined end-on');
  add(-(2 - (hasTacArray(s) ? 1 : 0)) * computeEcm(t.c), `ECM ×${computeEcm(t.c)}`);
  if (s.c.curDhp <= 0) add(-2, 'attacker at 0 dHP');
  if (shots >= 2) add(rapidFireBonus(shots), `${shots} shots`);

  let rangeNote = `${dist} hexes`;
  let outOfRange = false;
  if (kind === 'beam') {
    const bt = BEAM_TYPES[extra.value] || BEAM_TYPES.laser;
    const hr = beamHexRange(w.info.output, bt, battle.scaleIdx);
    add(bt.sAcc, `sAcc ${bt.sAcc}`);
    if (/GJ|TJ|PJ/.test(w.info.output)) add(1, '1 GJ+ beam');
    if ((w.opts.mount || 'turret') === 'fixed' || w.entry.spinal) add(2, 'fixed mount');
    add(tacticalRangeMod(dist, battle.scaleIdx), 'range');
    if (!hr || hr.max < dist) outOfRange = true;
    else rangeNote += dist > hr.half ? ` — HALF damage (½D ${hr.half}, max ${hr.max})` : ` (½D ${hr.half}, max ${hr.max})`;
  } else {
    const relVel = hexLength(hexSub(s.vel, t.vel));
    const gt = GUN_TYPES[kind === 'gun' ? 'conventional' : 'conventional'];
    const cal = parseFloat(kind === 'gun' ? w.info.gunCal : w.info.launcherCal);
    add(kind === 'gun' ? gt.sAcc(cal) : missileSAcc(s.c.design.tl, cal), 'sAcc');
    add(tacticalVelocityMod(relVel, battle.scaleIdx), `relative velocity ${relVel} hexes`);
    add(TURN_LENGTH_MOD[battle.turn], 'turn length');
    rangeNote += ` · rel. vel ${relVel} hexes/turn`;
  }
  $('atk-range').textContent = rangeNote;
  const total = mods.reduce((a, [v]) => a + v, 0);
  $('atk-mods').innerHTML = mods.map(([v, l]) => `<span class="mod">${fmtMod(v)} ${esc(l)}</span>`).join(' · ');
  $('atk-eff').textContent = outOfRange ? 'Out of range' : `Effective skill ${skill + total}`;
  $('btn-fire').disabled = outOfRange && kind === 'beam';
  card.dataset.eff = skill + total;
  card.dataset.kind = kind;
  card.dataset.widx = w.i;
}

function hasTacArray(s) {
  return s.c.result.placed.some((p) => ['tacticalArray', 'multipurposeArray'].includes(p.entry.key));
}

function fire() {
  const s = sel();
  const t = target();
  if (!s || !t) return;
  const w = weaponChoices(s, t)[Number($('atk-card').dataset.widx)];
  if (!w) return;
  const kind = $('atk-card').dataset.kind;
  const eff = Number($('atk-card').dataset.eff);
  const shots = Math.max(1, Number($('atk-shots').value) || 1);
  const dist = hexDistance(s.pos, t.pos);
  const incomingArc = bearingArc(t.pos, t.facing, s.pos);
  const section = incomingArc === 'own' ? 'central' : incomingArc;
  if (!w.arcOk) log(`⚠ ${w.entry.name} is out of arc — firing anyway (GM override).`);

  const roll = successRoll(eff);
  const bt = BEAM_TYPES[$('atk-extra').value] || BEAM_TYPES.laser;
  const rcl = kind === 'beam' ? bt.rcl : 1;
  let hits = roll.success ? Math.min(1 + Math.floor(roll.margin / rcl), shots) : 0;
  log(`${s.name} fires ${w.entry.name} at ${t.name} — needs ${eff}, rolls ${roll.dice}: ${roll.success ? `success by ${roll.margin} (${hits} hit(s))` : 'miss'}${roll.critFailure ? ' — CRITICAL FAILURE, weapon disabled' : ''}.`);
  if (!hits) { renderAll(); return; }

  // auto-dodge
  const st = effectiveStats(t.c);
  if (st.hnd !== null && !roll.critSuccess) {
    const ds = dodgeScore({ piloting: t.c.pilotSkill, hnd: st.hnd, turn: battle.turn, ecm: computeEcm(t.c) });
    const dr = successRoll(ds.score);
    if (dr.success) {
      const dodged = Math.min(hits, 1 + dr.margin);
      hits -= dodged;
      log(`${t.name} dodges (score ${ds.score}, rolled ${dr.dice}): avoids ${dodged}.`);
    }
  }
  for (let h = 0; h < hits; h++) {
    let dice;
    let div = 1;
    let dmg;
    let half = false;
    if (kind === 'beam') {
      const hr = beamHexRange(w.info.output, bt, battle.scaleIdx);
      dice = beamStats(w.info.output, $('atk-extra').value).dice;
      div = bt.div;
      half = hr && dist > hr.half;
      dmg = rollDice(dice);
    } else {
      const cal = parseFloat(kind === 'gun' ? w.info.gunCal : w.info.launcherCal);
      const warheadKey = $('atk-extra').value;
      const relVel = hexLength(hexSub(s.vel, t.vel));
      if (warheadKey === 'conventional') {
        dice = conventionalWarhead(cal);
        div = 2;
        dmg = rollDice(dice, Math.random, Math.max(relVel * scaleFactor(battle.scaleIdx, battle.turn), 0.01));
      } else {
        dice = parseDice(NUKES[warheadKey].dice);
        dmg = rollDice(dice);
      }
    }
    log(`Hit ${h + 1}/${hits} (${section} hull): basic damage ${dmg}${div !== 1 ? ` (${div === Infinity ? '∞' : div})` : ''}${half ? ' [half range]' : ''}.`);
    const res = applyHit(t.c, { section, basicDamage: dmg, div, halfDamage: half });
    res.log.forEach((l) => log(`  ${l}`));
    if (t.c.destroyed) { log(`💥 ${t.name} is destroyed!`); break; }
  }
  renderAll();
}

// --- Missiles -----------------------------------------------------------------------
function launchSalvo() {
  const s = sel();
  const t = target();
  if (!s || !t) return;
  const w = weaponChoices(s, t)[Number($('atk-card').dataset.widx)];
  if (!w) return;
  const shots = Math.max(1, Number($('atk-shots').value) || 1);
  const cal = parseFloat(w.info.launcherCal);
  const kind = s.c.design.tl <= 8 ? 'standard78' : 'standard912';
  const perf = missilePerformance(kind, cal, battle.scaleIdx, battle.turn);
  battle.missiles.push({
    id: battle.nextId++,
    ownerId: s.id,
    targetId: t.id,
    salvo: shots,
    cal,
    kind,
    warhead: $('atk-extra').value,
    sAcc: missileSAcc(s.c.design.tl, cal),
    skill: Number($('atk-skill-in').value) || 12,
    pos: { ...s.pos },
    vel: { ...s.vel },
    bp: perf.bp,
  });
  log(`${s.name} launches a salvo of ${shots} × ${cal}cm missiles at ${t.name} (TR ${perf.tr}, BP ${perf.bp}).`);
  renderAll();
}

function moveMissiles() {
  for (const m of [...battle.missiles]) {
    const t = ship(m.targetId);
    if (!t || t.c.destroyed) { battle.missiles = battle.missiles.filter((x) => x !== m); continue; }
    const perf = missilePerformance(m.kind, m.cal, battle.scaleIdx, battle.turn);
    m.tr = perf.tr;
    const thrust = missileSeek(m, t.pos, t.vel);
    const cost = hexLength(thrust);
    m.bp -= cost;
    m.vel = hexAdd(m.vel, thrust);
    m.pos = coast(m.pos, m.vel);
    if (hexEq(m.pos, t.pos) || hexDistance(m.pos, t.pos) === 0) {
      resolveMissileAttack(m, t);
      battle.missiles = battle.missiles.filter((x) => x !== m);
    } else if (m.bp <= 0 && hexDistance(m.pos, t.pos) > hexLength(hexSub(m.vel, t.vel)) * 3) {
      log(`A ${m.cal}cm salvo runs out of burn and drifts away.`);
      battle.missiles = battle.missiles.filter((x) => x !== m);
    }
  }
}

function resolveMissileAttack(m, t) {
  const relVel = Math.max(1, hexLength(hexSub(m.vel, t.vel)));
  const mods = [];
  const add = (v, l) => { if (v) mods.push([v, l]); };
  add(t.c.design.sm, 'target SM');
  add(m.sAcc, 'sAcc');
  add(tacticalVelocityMod(relVel, battle.scaleIdx), `rel. velocity ${relVel} hexes`);
  add(TURN_LENGTH_MOD[battle.turn], 'turn length');
  add(-2 * computeEcm(t.c), 'ECM');
  if (m.salvo >= 2) add(rapidFireBonus(m.salvo), `${m.salvo} incoming`);
  const eff = m.skill + mods.reduce((a, [v]) => a + v, 0);
  const roll = successRoll(eff);
  let hits = roll.success ? Math.min(1 + roll.margin, m.salvo) : 0;
  log(`Salvo of ${m.salvo} × ${m.cal}cm missiles attacks ${t.name} — needs ${eff}, rolls ${roll.dice}: ${hits ? `${hits} hit(s)` : 'all miss'}.`);
  if (!hits) return;
  const st = effectiveStats(t.c);
  if (st.hnd !== null && !roll.critSuccess) {
    const ds = dodgeScore({ piloting: t.c.pilotSkill, hnd: st.hnd, turn: battle.turn, ecm: computeEcm(t.c) });
    const dr = successRoll(ds.score);
    if (dr.success) {
      const dodged = Math.min(hits, 1 + dr.margin);
      hits -= dodged;
      log(`${t.name} dodges ${dodged}.`);
    }
  }
  const arc = bearingArc(t.pos, t.facing, m.pos);
  const section = arc === 'own' ? 'central' : arc;
  for (let h = 0; h < hits; h++) {
    let dice;
    let div = 1;
    let dmg;
    if (m.warhead === 'conventional') {
      dice = conventionalWarhead(m.cal);
      div = 2;
      dmg = rollDice(dice, Math.random, relVel * scaleFactor(battle.scaleIdx, battle.turn));
    } else {
      dice = parseDice(NUKES[m.warhead].dice);
      dmg = rollDice(dice);
    }
    log(`Missile hit ${h + 1}/${hits} (${section}): basic damage ${dmg}${div !== 1 ? ' (2)' : ''}.`);
    const res = applyHit(t.c, { section, basicDamage: dmg, div });
    res.log.forEach((l) => log(`  ${l}`));
    if (t.c.destroyed) { log(`💥 ${t.name} is destroyed!`); return; }
  }
}

function endRound() {
  moveMissiles();
  for (const s of battle.ships) { s.moved = false; s.active = false; }
  battle.round += 1;
  log(`— Round ${battle.round} begins.`);
  renderAll();
}

// --- Persistence, log, boot -----------------------------------------------------------
const KEY = 'gvb.ss.tactical';
function saveBattle() {
  localStorage.setItem(KEY, JSON.stringify({
    ...battle,
    ships: battle.ships.map((s) => ({
      ...s,
      c: {
        design: s.c.design, curDhp: s.c.curDhp, screen: s.c.screen, slots: s.c.slots,
        pilotSkill: s.c.pilotSkill, gunnerSkill: s.c.gunnerSkill, destroyed: s.c.destroyed, htChecksAt: s.c.htChecksAt,
      },
    })),
  }));
  flash('Battle saved.');
}
function loadBattle() {
  let data;
  try { data = JSON.parse(localStorage.getItem(KEY)); } catch { data = null; }
  if (!data) { flash('No saved battle.'); return; }
  battle.scaleIdx = data.scaleIdx;
  battle.turn = data.turn;
  battle.round = data.round;
  battle.nextId = data.nextId;
  battle.missiles = data.missiles || [];
  battle.ships = data.ships.map((s) => {
    const c = createCombatant(s.c.design, { pilotSkill: s.c.pilotSkill, gunnerSkill: s.c.gunnerSkill });
    Object.assign(c, { curDhp: s.c.curDhp, screen: s.c.screen, slots: s.c.slots, destroyed: s.c.destroyed, htChecksAt: s.c.htChecksAt });
    return { ...s, c };
  });
  $('tac-scale').value = String(battle.scaleIdx);
  $('tac-turn').value = battle.turn;
  selId = null;
  targetId = null;
  renderAll();
  flash('Battle loaded.');
}

function log(msg) {
  const el = $('log');
  const line = document.createElement('div');
  line.textContent = msg;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
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
  render();
  renderTurnOrder();
  renderSelected();
}

function boot() {
  const fill = (el, entries, val) => {
    el.innerHTML = entries.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
    el.value = val;
  };
  fill($('tac-scale'), [['0', '10-mile'], ['1', '100-mile'], ['2', '1,000-mile'], ['3', '10,000-mile']], String(battle.scaleIdx));
  fill($('tac-turn'), [['20s', '20-second'], ['1m', '1-minute'], ['3m', '3-minute'], ['10m', '10-minute']], battle.turn);
  $('tac-scale').addEventListener('change', () => { battle.scaleIdx = Number($('tac-scale').value); renderAll(); });
  $('tac-turn').addEventListener('change', () => { battle.turn = $('tac-turn').value; renderAll(); });

  const presets = [...SS_PRESETS.filter((p) => !p.name.startsWith('Empty')), ...PSIWARS_PRESETS];
  fill($('add-preset'), [['', '— Add a sample ship —'], ...presets.map((p, i) => [String(i), p.name])], '');
  $('add-preset').addEventListener('change', (e) => {
    if (e.target.value === '') return;
    addShip(presets[Number(e.target.value)].design, battle.ships.length % 2);
    e.target.value = '';
  });
  const saves = (() => { try { return JSON.parse(localStorage.getItem('gvb.ss.saves')) || {}; } catch { return {}; } })();
  const names = Object.keys(saves).sort();
  fill($('add-saved'), [['', names.length ? '— Add a saved design —' : '— No saved designs —'], ...names.map((n) => [n, n])], '');
  $('add-saved').addEventListener('change', (e) => {
    if (!e.target.value) return;
    addShip(saves[e.target.value], battle.ships.length % 2);
    e.target.value = '';
  });

  $('btn-save').addEventListener('click', saveBattle);
  $('btn-load').addEventListener('click', loadBattle);
  $('btn-clear').addEventListener('click', () => { battle.ships = []; battle.missiles = []; battle.round = 1; selId = null; targetId = null; renderAll(); });
  $('btn-end-round').addEventListener('click', endRound);
  $('btn-fire').addEventListener('click', fire);
  $('btn-launch').addEventListener('click', launchSalvo);
  $('atk-weapon').addEventListener('change', renderAttack);
  $('atk-extra').addEventListener('change', renderAttack);
  $('atk-shots').addEventListener('input', renderAttack);
  $('atk-skill-in').addEventListener('input', renderAttack);

  initMap();
  renderAll();
  initExplain({
    toggleBtnId: 'btn-explain',
    storageKey: 'gvb.explain.tactical',
    fieldHelp: TAC_FIELD_HELP,
    optionHelp: TAC_OPTION_HELP,
    sectionHelp: TAC_SECTION_HELP,
  });
  log('Tactical map ready. Add ships, press "move" on each in turn, then fire or launch salvos.');
}

boot();
