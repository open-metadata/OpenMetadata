#!/usr/bin/env node
/*
 *  Copyright 2024 Collate.
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

/**
 * Integrity check: every var(--om-*) / var(--ds-*) referenced by a component
 * style or a spec file must be defined in tokens.css. Fails (exit 1) on any
 * undefined token reference — catches a migration or a hand-written spec that
 * points at a token that does not exist.
 *
 * Run: node scripts/design-tokens/validate-tokens.js
 */
const fs = require('fs');
const path = require('path');

const UI = path.resolve(__dirname, '../..');
const SRC = path.join(UI, 'src');
const SPECS = path.join(UI, 'specs');
const TOKENS = path.join(SRC, 'styles/tokens.css');
const SKIP = new Set(['node_modules', 'dist', 'build', 'target', 'output']);

function walk(dir, exts, acc) {
  if (!fs.existsSync(dir)) {
    return acc;
  }
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP.has(e.name)) {
        walk(full, exts, acc);
      }
    } else if (exts.some((x) => e.name.endsWith(x))) {
      acc.push(full);
    }
  }
  return acc;
}

function definedTokens(css) {
  const set = new Set();
  const re = /(--(?:om|ds)-[\w-]+)\s*:/g;
  let m;
  while ((m = re.exec(css))) {
    set.add(m[1]);
  }
  return set;
}

function main() {
  const defined = definedTokens(fs.readFileSync(TOKENS, 'utf8'));
  const files = [
    ...walk(SRC, ['.less', '.css'], []),
    ...walk(SPECS, ['.md'], []),
  ].filter((f) => f !== TOKENS);

  const missing = new Map(); // token -> Set(files)
  // Only count complete references: the token must be immediately followed by
  // `)`, `,`, or whitespace. This skips doc-prose placeholders such as
  // `var(--ds-space-<n>, ...)` or `var(--ds-radius-*, ...)`.
  const re = /var\(\s*(--(?:om|ds)-[\w-]+)\s*(?=[),\s])/g;
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = re.exec(text))) {
      if (!defined.has(m[1])) {
        const rel = path.relative(UI, file);
        if (!missing.has(m[1])) {
          missing.set(m[1], new Set());
        }
        missing.get(m[1]).add(rel);
      }
    }
  }

  process.stdout.write(
    `Defined tokens: ${defined.size} | files scanned: ${files.length}\n`
  );
  if (missing.size) {
    process.stdout.write(`\n\x1b[31mUndefined token references: ${missing.size}\x1b[0m\n`);
    for (const [tok, set] of missing) {
      process.stdout.write(`  ${tok}\n    ${[...set].slice(0, 5).join('\n    ')}\n`);
    }
    process.exit(1);
  }
  process.stdout.write('\x1b[32m✔ Every var(--om-*/--ds-*) reference is defined in tokens.css.\x1b[0m\n');
}

main();
