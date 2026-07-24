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
 * Design-token codemod — rewrites hardcoded CSS/LESS values to var(--om-*)
 * tokens using the exact same engine the audit uses.
 *
 *   node scripts/token-migrate.js            # dry run (report only)
 *   node scripts/token-migrate.js --write    # apply changes in place
 *   node scripts/token-migrate.js --write <files...>
 *
 * Safe by construction: colors map to an exact palette or legacy token (no
 * colour shift), px only changes inside the property that owns that meaning,
 * and comments / url() / LESS colour functions / @variables are never touched.
 * Token-definition and vendored files are skipped.
 */
const fs = require('fs');
const path = require('path');
const { processText, isExempt } = require('./design-tokens/scanner');

const STYLES_ROOT = path.resolve(__dirname, '../src');
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'target', 'output']);

function walk(dir, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        walk(full, acc);
      }
    } else if (/\.(less|css)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function collectFiles(explicit) {
  let files;
  if (explicit.length) {
    files = explicit
      .map((f) => path.resolve(process.cwd(), f))
      .filter((f) => /\.(less|css)$/.test(f) && fs.existsSync(f));
  } else {
    files = walk(STYLES_ROOT, []);
  }
  return files;
}

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const explicit = args.filter((a) => !a.startsWith('-'));
  const files = collectFiles(explicit);

  let changedFiles = 0;
  let totalEdits = 0;
  const changed = [];

  for (const file of files) {
    if (isExempt(file)) {
      continue;
    }
    const text = fs.readFileSync(file, 'utf8');
    const rel = path.relative(STYLES_ROOT, file);
    const { newText, findings } = processText(text, rel);
    const edits = findings.filter((f) => true).length;
    if (newText !== text) {
      changedFiles++;
      totalEdits += edits;
      changed.push({ rel, edits });
      if (write) {
        fs.writeFileSync(file, newText);
      }
    }
  }

  const mode = write ? 'WROTE' : 'DRY RUN (no files written; pass --write)';
  process.stdout.write(`\nToken migration — ${mode}\n`);
  process.stdout.write(
    `  files changed: ${changedFiles}\n  values rewritten: ${totalEdits}\n`
  );
  changed
    .sort((a, b) => b.edits - a.edits)
    .slice(0, 15)
    .forEach((c) =>
      process.stdout.write(`    ${String(c.edits).padStart(5)}  ${c.rel}\n`)
    );
  if (!write && changedFiles) {
    process.stdout.write('\nRe-run with --write to apply.\n');
  }
}

main();
