// Export helpers: GURPS-style Markdown stat block and JSON download.

import { CHASSIS, ENGINES, LOCATION_LEGEND } from './data.js';
import { fmtCost } from './engine.js';

export function toMarkdown(design, result) {
  const s = result.stats;
  const range = s.rangeMi === null ? '—' : `${s.rangeMi} mi`;
  const lines = [];
  const tlTag = design.name.includes(`TL${design.tl}`) ? '' : ` (TL${design.tl})`;
  lines.push(`## ${design.name}${tlTag}`);
  lines.push('');
  lines.push(`*${CHASSIS[design.chassis].name}; ${ENGINES[design.engine].name}, ${s.power} hp.*`);
  lines.push('');
  lines.push('| TL | ST/HP | Hnd/SR | HT | Move | LWt. | Load | SM | Occ. | DR | Range | Cost | Locations |');
  lines.push('|----|-------|--------|----|------|------|------|----|------|----|-------|------|-----------|');
  lines.push(
    `| ${design.tl} | ${s.stHp} | ${fmtSigned(s.hnd)}/${s.sr} | ${s.ht}${s.htSuffix} | ${s.moveStr} ` +
    `| ${s.lwtTons} | ${s.loadTons} | ${fmtSigned(s.sm)} | ${s.occ} | ${s.dr} | ${range} ` +
    `| ${fmtCost(s.cost)} | ${s.locations} |`
  );
  lines.push('');
  lines.push(`- Top speed ${s.topMph} mph (${s.topYps} yds/sec); cruise ${s.cruiseMph} mph.`);
  if (s.stallMph !== null) lines.push(`- Stall speed ${s.stallMph} mph.`);
  lines.push(`- Length ~${s.lengthYds} yds; power/weight ${s.hpPerTon} hp/ton.`);
  if (design.weapons.length) {
    lines.push('');
    lines.push('### Armament');
    lines.push('');
    for (const w of design.weapons) {
      lines.push(`- ${w.qty > 1 ? `${w.qty}× ` : ''}${w.name} (${w.mount} mount) — ${w.dmg || 'see notes'}`);
    }
  }
  if (result.warnings.length) {
    lines.push('');
    lines.push('### Notes');
    lines.push('');
    for (const w of result.warnings) lines.push(`- ${w}`);
  }
  lines.push('');
  lines.push('*Locations: ' + LOCATION_LEGEND.map(([c, d]) => `${c} = ${d}`).join('; ') + '.*');
  return lines.join('\n');
}

function fmtSigned(n) {
  return n > 0 ? `+${n}` : String(n);
}

export function downloadText(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function safeFilename(name) {
  return (name || 'vehicle').replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '-').toLowerCase() || 'vehicle';
}
