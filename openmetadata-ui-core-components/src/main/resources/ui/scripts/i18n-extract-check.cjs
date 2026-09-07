#!/usr/bin/env node
/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

// Gate 1: every `t('key')` in library source resolves to a key in en-us.json.
// Walks src/**/*.{ts,tsx} (excluding locale/, stories/, and *.test.*), collects
// literal-string first args to `t()` calls, checks each against en-us.json.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const EN_US_PATH = path.join(SRC, 'locale', 'languages', 'en-us.json');

// -- Walk source files (skip locale/, stories, tests, node_modules)
const SKIP_DIR = new Set(['locale', 'node_modules', 'dist']);
const SKIP_FILE = /(\.stories\.|\.test\.|\.spec\.)/;

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIR.has(entry.name)) {
        yield* walk(full);
      }
    } else if (/\.(ts|tsx)$/.test(entry.name) && !SKIP_FILE.test(entry.name)) {
      yield full;
    }
  }
}

// -- Extract t('...') keys via regex. Dynamic keys (variables) are ignored;
//    add an ESLint rule later if we want to ban them.
//    Matches: t('literal'), t("literal"), t(`literal`) — with the opening
//    paren, quote, and key possibly split across lines (Prettier's default
//    for long calls). `\s` covers all whitespace including newlines. `s`
//    (dotall) flag lets us tolerate anything between `t(` and the string.
const T_CALL = /\bt\s*\(\s*(['"`])((?:core:)?[a-zA-Z0-9_.\-]+)\1/gs;

const usedKeys = new Map();  // key -> [file:line]

for (const file of walk(SRC)) {
  const rel = path.relative(ROOT, file);
  const text = fs.readFileSync(file, 'utf8');
  let m;
  T_CALL.lastIndex = 0;
  while ((m = T_CALL.exec(text)) !== null) {
    const key = m[2].startsWith('core:') ? m[2].slice(5) : m[2];
    // Convert byte offset to 1-indexed line number.
    const line = text.slice(0, m.index).split('\n').length;
    if (!usedKeys.has(key)) usedKeys.set(key, []);
    usedKeys.get(key).push(`${rel}:${line}`);
  }
}

// -- Load en-us.json and flatten to a Set of dotted keys
const enUs = JSON.parse(fs.readFileSync(EN_US_PATH, 'utf8'));
const definedKeys = new Set();
function flatten(obj, prefix) {
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v, full);
    } else {
      definedKeys.add(full);
    }
  }
}
flatten(enUs, '');

// Keys intentionally resolved from the HOST app's default i18n namespace rather
// than the library's `core` namespace, so they are not (and must not be) defined
// in this library's en-us.json. Example: the brand name, which the consuming app
// owns and populates from its `BRAND_NAME` env var.
const HOST_NS_KEYS = new Set(['label.brand-name']);

// -- Diff
const missing = [];
for (const [key, locs] of usedKeys) {
  if (!definedKeys.has(key) && !HOST_NS_KEYS.has(key)) {
    missing.push({ key, locs });
  }
}

if (missing.length === 0) {
  console.log(`OK: ${usedKeys.size} t() keys, all resolve in en-us.json`);
  process.exit(0);
}

console.error(`ERROR: ${missing.length} t() key(s) missing from en-us.json:\n`);
for (const { key, locs } of missing) {
  console.error(`  ${key}`);
  for (const loc of locs) {
    console.error(`    at ${loc}`);
  }
}
console.error(`\nAdd these keys to src/locale/languages/en-us.json, then run \`yarn i18n\`.`);
process.exit(1);
