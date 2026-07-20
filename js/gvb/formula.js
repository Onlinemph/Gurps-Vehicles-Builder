// ---------------------------------------------------------------------------
// Evaluator for GVB's component formula language.
//
// Example formula:
//   vQuantity * IIF(Checkbox(1) {AWD}, 1.5, 1) *
//   DECODE(RANGE(vTL,6,8), 6, 10, 7, 7.5, 8, 5, 0)
//
// Supported: numbers; + - * / ^; parentheses; comparisons (< <= > >= = <>);
// {comments}; case-insensitive identifiers (vQuantity, vRating, vUnits, vTL,
// vTotal_Weight, ...); functions IIF, DECODE, RANGE, ROUND, INT, TRUNC,
// FLOOR, CEIL, SQRT, ABS, MIN, MAX, POWER, LOG, LOG10, EXP, AND, OR, NOT,
// RADIO(n), CHECKBOX(n)/CHECK(n).
//
// env = { vars: {vquantity: 1, ...}, radio: 2, checks: Set([1,3]) }
// Unknown variables evaluate to 0 and are recorded in env.unknown.
// ---------------------------------------------------------------------------

export function evalFormula(src, env = {}) {
  if (!src || !String(src).trim()) return 0;
  const text = String(src).replace(/\{[^}]*\}/g, ' '); // strip {comments}
  const tokens = tokenize(text);
  const state = {
    tokens,
    pos: 0,
    vars: lowerKeys(env.vars || {}),
    radio: env.radio ?? 0,
    checks: env.checks || new Set(),
    unknown: env.unknown || new Set(),
  };
  const value = parseLogical(state);
  if (state.pos < tokens.length) {
    throw new Error(`Unexpected "${tokens[state.pos].text}" in formula`);
  }
  if (env.unknown === undefined && state.unknown.size) env.unknownOut = state.unknown;
  return value;
}

function lowerKeys(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k.toLowerCase()] = v;
  return out;
}

function tokenize(text) {
  const tokens = [];
  const re = /\s*(?:((?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(<=|>=|<>|[-+*/^(),<>=|&!]))/y;
  let pos = 0;
  while (pos < text.length) {
    re.lastIndex = pos;
    const m = re.exec(text);
    if (!m) {
      if (!text.slice(pos).trim()) break;
      throw new Error(`Bad character in formula near "${text.slice(pos, pos + 12)}"`);
    }
    pos = re.lastIndex;
    if (m[1] !== undefined) tokens.push({ type: 'num', value: Number(m[1]), text: m[1] });
    else if (m[2] !== undefined) tokens.push({ type: 'ident', value: m[2].toLowerCase(), text: m[2] });
    else tokens.push({ type: 'op', value: m[3], text: m[3] });
  }
  return tokens;
}

const peek = (s) => s.tokens[s.pos];
const isOp = (s, ...ops) => peek(s)?.type === 'op' && ops.includes(peek(s).value);
const eat = (s) => s.tokens[s.pos++];
function expectOp(s, op) {
  if (!isOp(s, op)) throw new Error(`Expected "${op}" in formula`);
  s.pos++;
}

// logical -> comparison ((| or &) comparison)*
function parseLogical(s) {
  let left = parseComparison(s);
  while (isOp(s, '|', '&')) {
    const op = eat(s).value;
    const right = parseComparison(s);
    left = op === '|' ? (left !== 0 || right !== 0 ? 1 : 0) : (left !== 0 && right !== 0 ? 1 : 0);
  }
  return left;
}

// comparison -> additive ((<|<=|>|>=|=|<>) additive)*
function parseComparison(s) {
  let left = parseAdditive(s);
  while (isOp(s, '<', '<=', '>', '>=', '=', '<>')) {
    const op = eat(s).value;
    const right = parseAdditive(s);
    switch (op) {
      case '<': left = left < right ? 1 : 0; break;
      case '<=': left = left <= right ? 1 : 0; break;
      case '>': left = left > right ? 1 : 0; break;
      case '>=': left = left >= right ? 1 : 0; break;
      case '=': left = left === right ? 1 : 0; break;
      case '<>': left = left !== right ? 1 : 0; break;
    }
  }
  return left;
}

function parseAdditive(s) {
  let left = parseMultiplicative(s);
  while (isOp(s, '+', '-')) {
    const op = eat(s).value;
    const right = parseMultiplicative(s);
    left = op === '+' ? left + right : left - right;
  }
  return left;
}

function parseMultiplicative(s) {
  let left = parsePower(s);
  while (isOp(s, '*', '/')) {
    const op = eat(s).value;
    const right = parsePower(s);
    left = op === '*' ? left * right : (right === 0 ? 0 : left / right);
  }
  return left;
}

function parsePower(s) {
  const left = parseUnary(s);
  if (isOp(s, '^')) {
    eat(s);
    return left ** parsePower(s);
  }
  return left;
}

function parseUnary(s) {
  if (isOp(s, '-')) { eat(s); return -parseUnary(s); }
  if (isOp(s, '+')) { eat(s); return parseUnary(s); }
  if (isOp(s, '!')) { eat(s); return parseUnary(s) !== 0 ? 0 : 1; }
  return parsePrimary(s);
}

function parsePrimary(s) {
  const tok = peek(s);
  if (!tok) throw new Error('Formula ended unexpectedly');
  if (tok.type === 'num') { eat(s); return tok.value; }
  if (tok.type === 'op' && tok.value === '(') {
    eat(s);
    const v = parseLogical(s);
    expectOp(s, ')');
    return v;
  }
  if (tok.type === 'ident') {
    eat(s);
    if (isOp(s, '(')) return callFunction(s, tok.value);
    if (tok.value in s.vars) return Number(s.vars[tok.value]) || 0;
    s.unknown.add(tok.text);
    return 0;
  }
  throw new Error(`Unexpected "${tok.text}" in formula`);
}

function parseArgs(s) {
  expectOp(s, '(');
  const args = [];
  if (!isOp(s, ')')) {
    args.push(parseLogical(s));
    while (isOp(s, ',')) { eat(s); args.push(parseLogical(s)); }
  }
  expectOp(s, ')');
  return args;
}

function callFunction(s, name) {
  const a = parseArgs(s);
  const truthy = (x) => x !== 0;
  switch (name) {
    case 'iif': return truthy(a[0]) ? (a[1] ?? 0) : (a[2] ?? 0);
    case 'decode': {
      // DECODE(x, k1, v1, k2, v2, ..., [default])
      const x = a[0];
      let i = 1;
      for (; i + 1 < a.length; i += 2) if (a[i] === x) return a[i + 1];
      return i < a.length ? a[i] : 0; // trailing odd arg = default
    }
    case 'range': return Math.min(Math.max(a[0], a[1]), a[2]);
    case 'round': return Math.round(a[0]);
    case 'int': case 'trunc': return Math.trunc(a[0]);
    case 'floor': return Math.floor(a[0]);
    case 'ceil': case 'ceiling': return Math.ceil(a[0]);
    case 'sqrt': return Math.sqrt(Math.max(a[0], 0));
    case 'sqr': return a[0] * a[0];
    case 'cube': return a[0] ** 3;
    case 'crt': case 'cbrt': return Math.cbrt(a[0]);
    case 'roundn': { const m = 10 ** (a[1] ?? 0); return Math.round(a[0] * m) / m; }
    case 'select': { const i = Math.trunc(a[0]); return i >= 1 && i < a.length ? a[i] : 0; }
    case 'abs': return Math.abs(a[0]);
    case 'min': return Math.min(...a);
    case 'max': return Math.max(...a);
    case 'power': case 'pow': return a[0] ** a[1];
    case 'log': case 'ln': return a[0] > 0 ? Math.log(a[0]) : 0;
    case 'log10': return a[0] > 0 ? Math.log10(a[0]) : 0;
    case 'exp': return Math.exp(a[0]);
    case 'and': return a.every(truthy) ? 1 : 0;
    case 'or': return a.some(truthy) ? 1 : 0;
    case 'not': return truthy(a[0]) ? 0 : 1;
    case 'radio': return s.radio === a[0] ? 1 : 0;
    case 'checkbox': case 'check': return s.checks.has(a[0]) ? 1 : 0;
    default:
      s.unknown.add(`${name}()`);
      return 0;
  }
}
