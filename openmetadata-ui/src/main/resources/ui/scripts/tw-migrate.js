#!/usr/bin/env node
/*
 *  Copyright 2025 Collate.
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
 * Codemod for the safe, mechanical subset of the Tailwind migration: arbitrary
 * Tailwind values inside class strings that map EXACTLY to a design-system
 * utility (tw:bg-[#2e90fa] -> tw:bg-brand-500, tw:p-[8px] -> tw:p-2,
 * tw:rounded-[8px] -> tw:rounded-lg).
 *
 * It ONLY touches arbitrary values that resolve exactly (the audit's "error"
 * set). Raw hex in chart configs / SVG props / style objects and unresolved
 * arbitraries are left for human/semantic migration — they are not mechanical.
 *
 *   node scripts/tw-migrate.js            # dry run
 *   node scripts/tw-migrate.js --write    # apply
 *   node scripts/tw-migrate.js --write <files...>
 */
const fs = require('fs');
const path = require('path');
const { classifyArbitrary, ARBITRARY_RE, SEVERITY } = require('./design-tokens/tw-scanner');

const SRC = path.resolve(__dirname, '../src');
const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', 'target', 'output', 'generated', 'antlr', 'jsons',
]);

function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) {
        walk(full, acc);
      }
    } else if (/\.(tsx|ts|jsx|js)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function transform(text) {
  let edits = 0;
  const out = text.replace(ARBITRARY_RE, (whole, prefix, value) => {
    const f = classifyArbitrary(prefix, value);
    let replacement = whole;
    if (f && f.severity === SEVERITY.ERROR && f.suggestion) {
      replacement = f.suggestion;
      edits++;
    }
    return replacement;
  });
  return { out, edits };
}

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const explicit = args.filter((a) => !a.startsWith('-'));
  const files = explicit.length
    ? explicit.map((f) => path.resolve(process.cwd(), f)).filter((f) => fs.existsSync(f))
    : walk(SRC, []);

  let changed = 0;
  let total = 0;
  const list = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const { out, edits } = transform(text);
    if (edits > 0 && out !== text) {
      changed++;
      total += edits;
      list.push({ rel: path.relative(SRC, file), edits });
      if (write) {
        fs.writeFileSync(file, out);
      }
    }
  }

  process.stdout.write(`\nTailwind arbitrary-value codemod — ${write ? 'WROTE' : 'DRY RUN (pass --write)'}\n`);
  process.stdout.write(`  files changed: ${changed}\n  values rewritten: ${total}\n`);
  list.sort((a, b) => b.edits - a.edits).forEach((c) => process.stdout.write(`    ${String(c.edits).padStart(3)}  ${c.rel}\n`));
}

main();
