// Markdown stat block for VE2 designs, loosely following the book's
// vehicle-description format.

import { ARMOR_TYPES, FRAME_STRENGTHS, FUELS, MATERIALS, STREAMLINING } from './tables.js';
import { BODY_FACE_KEYS } from './vehicle.js';

const fmt = (x, d = 0) => (Math.round(x * 10 ** d) / 10 ** d).toLocaleString('en-US');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function toVe2Markdown(design, r) {
  const d = design;
  const lines = [];
  lines.push(`## ${d.name}${d.name.includes(`TL${d.tl}`) ? '' : ` (TL${d.tl})`}`);
  lines.push('');

  // Subassemblies summary
  const sub = d.subassemblies;
  const subs = [];
  if (sub.wheels.present) subs.push(`${sub.wheels.count} ${sub.wheels.type} wheels${sub.wheels.retractable ? ' (retractable)' : ''}`);
  if (sub.tracks.present) subs.push('tracks');
  if (sub.halftracks.present) subs.push('halftracks');
  if (sub.skids.present) subs.push('skids');
  if (sub.legs?.present) subs.push(`${sub.legs.count} legs`);
  if (sub.wings.present) subs.push(`${sub.wings.type} wings`);
  if (sub.rotors.present) subs.push('rotors');
  (sub.turrets || []).forEach((t, i) => subs.push(`turret ${i + 1} (${fmt(t.volumeCf)} cf, ${t.rotation})`));
  (sub.superstructures || []).forEach((s, i) => subs.push(`superstructure ${i + 1} (${fmt(s.volumeCf)} cf)`));
  (sub.openMounts || []).forEach((m, i) => subs.push(`open mount ${i + 1} (${m.rotation} rotation)`));
  if (sub.masts.present) subs.push(`mast (${fmt(sub.masts.heightFt)} ft)`);
  if (sub.gasbag.present) subs.push(`gasbag (${fmt(sub.gasbag.cf)} cf)`);

  lines.push(`**Subassemblies:** ${subs.join('; ') || 'body only'}.`);
  lines.push(`**Powertrain:** ${powertrainSummary(d, r)}.`);
  lines.push('');

  lines.push(`**Structure:** ${FRAME_STRENGTHS[d.structure.frame].name} frame, ` +
    `${MATERIALS[d.structure.material].name.toLowerCase()} materials` +
    (d.streamlining !== 'none' ? `, ${STREAMLINING[d.streamlining].name} streamlining` : '') +
    ` (${fmt(r.structure.weight)} lbs., $${fmt(r.structure.cost)}).`);

  // Armor
  const at = ARMOR_TYPES[d.armor.type];
  if (r.armor.mode === 'overall' && r.armor.dr > 0) {
    lines.push(`**Armor:** ${at.name}, PD ${r.armor.pd}, DR ${r.armor.dr} overall (${fmt(r.armor.weight)} lbs., $${fmt(r.armor.cost)}).`);
  } else if (r.armor.mode === 'facing' && r.armor.faces) {
    const parts = BODY_FACE_KEYS
      .filter((f) => r.armor.faces[f]?.dr > 0)
      .map((f) => {
        const face = r.armor.faces[f];
        return `${cap(f)} PD ${face.pd}/DR ${face.effDR}${face.slope ? ` (${face.slope}° slope)` : ''}`;
      });
    lines.push(`**Armor:** ${at.name} — ${parts.join(', ') || 'none'} (${fmt(r.armor.weight)} lbs., $${fmt(r.armor.cost)}).`);
  }

  // Hit points
  lines.push(`**Hit Points:** ${Object.entries(r.hp).map(([k, v]) => `${cap(k.replace('per', ''))} ${v}`).join('; ')}.`);
  lines.push('');

  // Statistics table
  lines.push('### Statistics');
  lines.push('');
  lines.push(`| Empty Wt. | Loaded Wt. | Volume | Size Mod. | Price | HT |`);
  lines.push(`|-----------|------------|--------|-----------|-------|----|`);
  lines.push(`| ${fmt(r.weights.empty)} lbs. | ${fmt(r.weights.loaded)} lbs. | ${fmt(r.totalVolume)} cf ` +
    `| ${r.stats.sm >= 0 ? '+' : ''}${r.stats.sm} | $${fmt(r.stats.price)} | ${r.stats.ht} |`);
  lines.push('');
  if (r.flotation > 0) lines.push(`Flotation ${fmt(r.flotation)} lbs.${r.floats ? '' : ' — **overloaded, it sinks!**'}`);
  if (r.weights.loadedWithStores) lines.push(`Weight with hardpoints loaded: ${fmt(r.weights.loadedWithStores)} lbs.`);
  lines.push('');

  // Performance
  if (r.perf.ground) {
    const g = r.perf.ground;
    lines.push(`**Ground Performance:** Speed ${g.topSpeed} mph` +
      (g.topSpeedWithStores ? ` (${g.topSpeedWithStores} with stores)` : '') +
      `, gAccel ${g.gAccel}, gDecel ${g.gDecel}, gMR ${g.gMR}, gSR ${g.gSR}, ` +
      `${g.gpLabel} GP ${fmt(g.groundPressure)}, ${offRoadText(g.offRoad)} off-road.`);
  }
  if (r.perf.water) {
    const w = r.perf.water;
    lines.push(`**Water Performance:** Speed ${w.topSpeed} mph${w.planing ? ' (planing)' : ''}, ` +
      `wAccel ${w.wAccel}, wDecel ${w.wDecel} (${w.wDecelPowered}), wMR ${w.wMR}, wSR ${w.wSR}, Draft ${w.draft} ft.`);
  }
  if (r.perf.submerged) {
    const u = r.perf.submerged;
    lines.push(`**Submerged Performance:** Speed ${u.topSpeed} mph, uAccel ${u.uAccel}, ` +
      `Draft ${u.draft} ft, Crush depth ${fmt(u.crushDepth)} yds.`);
  }
  if (r.perf.space) {
    lines.push(`**Space Performance:** sAccel ${r.perf.space.sAccelG} G (${r.perf.space.sAccel} mph/s), sMR ${r.perf.space.sMR}.`);
  }
  if (r.perf.aerial) {
    const a = r.perf.aerial;
    lines.push(`**Aerial Performance:** ${a.stallSpeed === 0 ? 'Stall 0 (VTOL/hover)' : `Stall ${a.stallSpeed} mph`}, ` +
      `Speed ${a.topSpeed} mph, aAccel ${a.aAccel}, aDecel ${a.aDecel}, aMR ${a.aMR}, aSR ${a.aSR}` +
      (a.takeoffRun ? `, takeoff run ${fmt(a.takeoffRun)} yds` : '') + '.');
    if (a.withStores) {
      lines.push(`*With hardpoints loaded:* Stall ${a.withStores.stallSpeed} mph, Speed ${a.withStores.topSpeed} mph, aAccel ${a.withStores.aAccel}.`);
    }
  }
  lines.push('');

  // Components
  if (d.components.length) {
    lines.push('### Components');
    lines.push('');
    for (const c of d.components) {
      const where = (c.location && c.location !== 'body') ? `, in ${c.location}` : '';
      lines.push(`- ${c.name} (${fmt(c.weight)} lbs., ${fmt(c.volume, 2)} cf, $${fmt(c.cost)}${where})`);
    }
    lines.push('');
  }
  const fuel = FUELS[d.fuel.type];
  if (d.fuel.gallons > 0) {
    const dur = r.fuelUse?.durationHours;
    lines.push(`Fuel: ${fmt(d.fuel.gallons)} gallons of ${fuel.name.toLowerCase()} (${fmt(r.weights.fuel)} lbs.)` +
      (dur ? `; endurance ${Math.floor(dur)}h ${Math.round((dur - Math.floor(dur)) * 60)}m at ${fmt(r.fuelUse.gph, 2)} gph` : '') + '.');
  }
  lines.push(`Occupancy: ${d.crew} crew, ${d.passengers} passengers; ${fmt(d.cargoCf)} cf cargo.`);
  return lines.join('\n');
}

function powertrainSummary(d, r) {
  const p = r.propulsion;
  const bits = [];
  if (p.groundKw) bits.push(`${fmt(p.groundKw, 1)} kW ground drivetrain`);
  if (p.aquaticThrust) bits.push(`${fmt(p.aquaticThrust)} lbs. aquatic thrust`);
  if (p.airThrust) bits.push(`${fmt(p.airThrust)} lbs. aerial thrust`);
  if (p.staticLift) bits.push(`${fmt(p.staticLift)} lbs. static lift`);
  if (p.contragravLift) bits.push(`${fmt(p.contragravLift)} lbs. contragravity`);
  if (r.power.available) bits.push(`${fmt(r.power.available, 1)} kW power`);
  return bits.join(', ') || 'unpowered';
}

function offRoadText(frac) {
  if (frac === 0) return 'no';
  if (frac === 1) return 'full-speed';
  return `${Math.round(frac * 100)}%-speed`;
}
