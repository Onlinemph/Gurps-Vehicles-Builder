import { test } from 'node:test';
import assert from 'node:assert/strict';

import { evalFormula } from '../js/gvb/formula.js';
import { parseTpf0 } from '../js/gvb/parser.js';
import { defaultInputs, evaluateTemplate, normalizeTemplate } from '../js/gvb/library.js';

// ---------------------------------------------------------------------------
// Formula evaluator
// ---------------------------------------------------------------------------
test('arithmetic, precedence, and comments', () => {
  assert.equal(evalFormula('1 + 2 * 3'), 7);
  assert.equal(evalFormula('(1 + 2) * 3'), 9);
  assert.equal(evalFormula('2 ^ 3 ^ 2'), 512); // right-associative
  assert.equal(evalFormula('10 / 4'), 2.5);
  assert.equal(evalFormula('-3 + 5 {a comment} + 2'), 4);
  assert.ok(Math.abs(evalFormula('3.7E-5 * 1E5') - 3.7) < 1e-9);
});

test('variables are case-insensitive; unknowns become 0 and are reported', () => {
  const env = { vars: { vRating: 40, vTL: 6 } };
  assert.equal(evalFormula('vrating * 2 + VTL', env), 86);
  const env2 = { vars: {}, unknown: new Set() };
  assert.equal(evalFormula('vMystery + 5', env2), 5);
  assert.deepEqual([...env2.unknown], ['vMystery']);
});

test('IIF / DECODE / RANGE match GVB semantics', () => {
  assert.equal(evalFormula('IIF(1 < 2, 10, 20)'), 10);
  assert.equal(evalFormula('IIF(1 > 2, 10, 20)'), 20);
  // DECODE with default
  assert.equal(evalFormula('DECODE(7, 6, 100, 7, 200, 0)'), 200);
  assert.equal(evalFormula('DECODE(9, 6, 100, 7, 200, 55)'), 55);
  // RANGE clamps
  assert.equal(evalFormula('RANGE(9, 6, 8)'), 8);
  assert.equal(evalFormula('RANGE(5, 6, 8)'), 6);
});

test('Radio and Checkbox read the option state', () => {
  const env = { radio: 2, checks: new Set([1, 3]) };
  assert.equal(evalFormula('IIF(Radio(2), 100, 1)', env), 100);
  assert.equal(evalFormula('IIF(Radio(1), 100, 1)', env), 1);
  assert.equal(evalFormula('IIF(Checkbox(1), 5, 0) + IIF(Checkbox(2), 7, 0)', env), 5);
  assert.equal(evalFormula('IIF(Checkbox(1) | Checkbox(2), 1, 0)', env), 1);
  assert.equal(evalFormula('IIF(Checkbox(1) & Checkbox(2), 1, 0)', env), 0);
  assert.equal(evalFormula('IIF(!Checkbox(2), 9, 0)', env), 9);
});

test('math function library', () => {
  assert.equal(evalFormula('SQRT(16) + SQR(3) + CUBE(2) + CRT(27)'), 4 + 9 + 8 + 3);
  assert.equal(evalFormula('ROUND(2.5) + INT(3.9) + FLOOR(3.9) + CEIL(3.1)'), 3 + 3 + 3 + 4);
  assert.equal(evalFormula('MIN(3, 1, 2) + MAX(3, 1, 2)'), 4);
  assert.equal(evalFormula('ROUNDN(3.14159, 2)'), 3.14);
  assert.equal(evalFormula('SELECT(2, 10, 20, 30)'), 20);
  assert.equal(evalFormula('POWER(2, 10)'), 1024);
});

// A realistic GVB-style formula (same shape as the gasoline engine's).
const ENGINE_WEIGHT =
  `vQuantity *
   IIF(Checkbox(3) {Propane}, 1.1, 1) *
   IIF(vRating < 5,
       decode(range(vTL,5,7), 5, 40, 6, 12, 7, 10, 0) * vRating,
       decode(range(vTL,5,7), 5, 20, 6, 6, 7, 5, 0) * vRating +
       Decode(Range(vTL,5,7), 5, 100, 6, 30, 7, 25, 0))`;

test('a GVB-style engine weight formula computes book values', () => {
  // TL6, 40 kW: 6*40 + 30 = 270 lbs (the Vehicles p. VE139 jeep engine).
  const w = evalFormula(ENGINE_WEIGHT, { vars: { vQuantity: 1, vRating: 40, vTL: 6 }, checks: new Set(), radio: 0 });
  assert.equal(w, 270);
});

// ---------------------------------------------------------------------------
// TPF0 parser (synthetic stream — no SJ Games data is shipped in this repo)
// ---------------------------------------------------------------------------
function buildSyntheticRep() {
  const bytes = [];
  const pushStr = (s) => { bytes.push(s.length); for (const ch of s) bytes.push(ch.charCodeAt(0)); };
  const pushLStr = (s) => {
    bytes.push(s.length & 0xff, (s.length >> 8) & 0xff, (s.length >> 16) & 0xff, (s.length >> 24) & 0xff);
    for (const ch of s) bytes.push(ch.charCodeAt(0));
  };
  for (const c of 'TPF0') bytes.push(c.charCodeAt(0));
  pushStr('TTestTemplates'); // root class
  pushStr('');               // root name
  bytes.push(0);             // end of root props
  // child object
  pushStr('TWidgetTemplate');
  pushStr('');
  pushStr('Name1'); bytes.push(6); pushStr('widget');          // vaString
  pushStr('TL'); bytes.push(2, 7);                             // vaInt8
  pushStr('Rating'); bytes.push(2, 10);                        // vaInt8
  pushStr('WeightFormula'); bytes.push(12); pushLStr('vQuantity * vRating * 2'); // vaLString
  pushStr('CostFormula'); bytes.push(12); pushLStr('vTotal_Weight * 5');
  pushStr('Radio1'); bytes.push(6); pushStr('basic');
  pushStr('Check1'); bytes.push(6); pushStr('deluxe');
  bytes.push(0); // end child props
  bytes.push(0); // end child children
  bytes.push(0); // end root children
  return new Uint8Array(bytes);
}

test('parses a TPF0 stream and evaluates its template', () => {
  const root = parseTpf0(buildSyntheticRep());
  assert.equal(root.class, 'TTestTemplates');
  assert.equal(root.children.length, 1);

  const tpl = normalizeTemplate(root.children[0], 'test.rep');
  assert.equal(tpl.name, 'widget');
  assert.equal(tpl.tl, 7);
  assert.deepEqual(tpl.radios, [{ n: 1, label: 'basic' }]);
  assert.deepEqual(tpl.checks, [{ n: 1, label: 'deluxe' }]);

  const out = evaluateTemplate(tpl, defaultInputs(tpl, 8));
  assert.equal(out.weight, 20);        // 1 * 10 * 2
  assert.equal(out.cost, 100);         // vTotal_Weight * 5
  assert.deepEqual(out.errors, []);
});

test('rejects non-TPF0 data', () => {
  assert.throws(() => parseTpf0(new Uint8Array([1, 2, 3, 4, 5])), /TPF0/);
});

// ---------------------------------------------------------------------------
// Engine integration: equipment lines add weight and cost
// ---------------------------------------------------------------------------
test('equipment contributes to weight and cost', async () => {
  const { computeStats, defaultDesign } = await import('../js/engine.js');
  const base = computeStats(defaultDesign());
  const d = defaultDesign();
  d.equipment = [{ name: 'GVB thing', weight: 100, cost: 5000, note: '' }];
  const r = computeStats(d);
  assert.equal(Math.round(r.weights.loaded - base.weights.loaded), 100);
  assert.ok(r.costs.subtotal - base.costs.subtotal === 5000);
});
