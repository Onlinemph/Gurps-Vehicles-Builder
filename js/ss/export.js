// ---------------------------------------------------------------------------
// GURPS Spaceships designer — Markdown stat block export.
// ---------------------------------------------------------------------------

import { SECTIONS } from './tables.js';
import { computeShip } from './ship.js';

const fmt = (x, d = 0) => (Math.round(x * 10 ** d) / 10 ** d).toLocaleString('en-US');

export function toSsMarkdown(design) {
  const r = computeShip(design);
  const s = r.stats;
  const lines = [];
  const tlTag = `${design.tl}${anySuperscience(r) ? '^' : ''}`;

  lines.push(`# ${design.name} (TL${tlTag})`);
  lines.push('');
  lines.push(`SM+${s.sm} ${design.streamlined ? 'streamlined' : 'unstreamlined'} hull; ${fmt(s.lwt)} tons loaded, about ${fmt(s.lengthYds)} yards long.`);
  lines.push('');
  lines.push('| dST/HP | Hnd/SR | HT | Move | LWt. | Load | SM | Occ | dDR | Range | Cost |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|');
  lines.push(`| ${s.dstHp} | ${s.hnd === null ? '—' : `${s.hnd}/${s.sr}`} | ${s.ht} | ${s.move} | ${fmt(s.lwt)} | ${fmt(s.load, 1)} | +${s.sm} | ${s.occ} | ${s.ddr} | ${s.range ?? '—'} | ${s.costStr} |`);
  lines.push('');

  lines.push('## Systems');
  lines.push('');
  for (const section of SECTIONS) {
    lines.push(`**${section[0].toUpperCase()}${section.slice(1)} hull**`);
    lines.push('');
    design.sections[section].forEach((slotDef, i) => {
      lines.push(`- [${i + 1}${slotBang(r, section, i)}] ${slotText(r, section, `[${i + 1}]`)}`);
    });
    for (const core of design.cores) {
      if (core.section === section && core.sys) {
        lines.push(`- [core] ${slotText(r, section, '[core]')}`);
      }
    }
    lines.push('');
  }

  const notes = [];
  if (s.airSpeed) notes.push(`Top air speed ${fmt(s.airSpeed)} mph (air Hnd ${s.airHnd >= 0 ? '+' : ''}${s.airHnd}).`);
  if (s.deltaV) notes.push(`Delta-V ${s.deltaV} mps (${s.fuelNote}).`);
  if (s.ppNeeded) notes.push(`Power Points: needs ${s.ppNeeded}, provides ${s.ppProvided}.`);
  if (s.screenDDR) notes.push(`Force screen dDR ${s.screenDDR}.`);
  if (s.complexity) notes.push(`Complexity ${s.complexity} computer network; comm/sensor ${s.arrayLevel}.`);
  if (s.workspaces) notes.push(`${s.workspaces} workspace${s.workspaces > 1 ? 's' : ''}.`);
  if (s.spareCargo) notes.push(`${fmt(s.spareCargo, 1)} tons of spare battery space usable as cargo.`);
  const features = Object.entries(design.features || {}).filter(([, on]) => on).map(([k]) => k);
  if (features.length) notes.push(`Features: ${features.join(', ')}.`);
  if (notes.length) {
    lines.push('## Notes');
    lines.push('');
    for (const n of notes) lines.push(`- ${n}`);
    lines.push('');
  }

  if (r.errors.length) {
    lines.push('## Problems');
    lines.push('');
    for (const e of r.errors) lines.push(`- ⚠ ${e}`);
    lines.push('');
  }

  lines.push('*Built with the GURPS Spaceships Designer. GURPS is a trademark of Steve Jackson Games; this stat block is user-generated content.*');
  return lines.join('\n');
}

function findPlaced(r, section, slotLabel) {
  return r.placed.find((p) => p.section === section && p.slotLabel === slotLabel);
}

function slotText(r, section, slotLabel) {
  const p = findPlaced(r, section, slotLabel);
  if (!p) return 'Empty.';
  return `${p.entry.name} (${p.info.desc}).`;
}

function slotBang(r, section, i) {
  const p = findPlaced(r, section, `[${i + 1}]`);
  return p && (p.entry.he || p.info.ppNeed) ? '!' : '';
}

function anySuperscience(r) {
  return r.placed.some((p) => p.entry.superscience);
}
