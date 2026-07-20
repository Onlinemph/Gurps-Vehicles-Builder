#!/usr/bin/env node
// CLI wrapper around js/gvb/parser.js — dumps GVB .rep/.gvv files as JSON.
//
// Usage:
//   node tools/parse-rep.mjs <file.rep|file.gvv> [more files...] > out.json
//
// The interesting payload for repositories is each template's Name1, TL, and
// the *Formula properties, written in GVB's expression language (see
// js/gvb/formula.js for the evaluator).
//
// This tool only reads files the user already owns — it ships no game data.

import { readFileSync } from 'node:fs';
import { parseTpf0 } from '../js/gvb/parser.js';

export { parseTpf0 };

const files = process.argv.slice(2);
if (files.length && import.meta.url === `file://${process.argv[1]}`) {
  const out = {};
  for (const f of files) {
    try {
      out[f] = parseTpf0(new Uint8Array(readFileSync(f)));
    } catch (e) {
      out[f] = { error: e.message };
    }
  }
  const result = files.length === 1 ? out[files[0]] : out;
  console.log(JSON.stringify(result, null, 2));
}
