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
 * Spec drift guard (structural). Deterministically catches the drift that CAN
 * be proven mechanically:
 *   - every relative link in a spec resolves on disk (a renamed/deleted
 *     component or foundation leaves a spec pointing at a dead file) -> ERROR;
 *   - every component spec's "Styles" link points at a real .less -> ERROR;
 *   - component .less files with no spec are reported -> INFO (coverage gap,
 *     not a failure — we only spec major components).
 *
 * It does NOT verify prose correctness (anatomy/states/props); that is what the
 * "changed .less without changed .md" touch-coupling hook and human/LLM review
 * are for. Run: node scripts/design-tokens/check-coverage.js
 */
const fs = require('fs');
const path = require('path');

const UI = path.resolve(__dirname, '../..');
const SPECS = path.join(UI, 'specs');
const COMPONENT_LESS = path.join(UI, 'src/styles/components');

function walk(dir, acc) {
  if (!fs.existsSync(dir)) {
    return acc;
  }
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(full, acc);
    } else if (e.name.endsWith('.md')) {
      acc.push(full);
    }
  }
  return acc;
}

const LINK_RE = /\]\(([^)]+)\)/g;

function checkLinks(errors) {
  for (const spec of walk(SPECS, [])) {
    const text = fs.readFileSync(spec, 'utf8');
    let m;
    LINK_RE.lastIndex = 0;
    while ((m = LINK_RE.exec(text))) {
      const target = m[1].split('#')[0].trim();
      if (!target || /^(https?:|mailto:)/.test(target)) {
        continue;
      }
      const resolved = path.resolve(path.dirname(spec), target);
      if (!fs.existsSync(resolved)) {
        errors.push(
          `${path.relative(UI, spec)} → broken link: ${target}`
        );
      }
    }
  }
}

function coverage() {
  const specced = new Set(
    fs
      .readdirSync(path.join(SPECS, 'components'))
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, ''))
  );
  const components = fs.existsSync(COMPONENT_LESS)
    ? fs
        .readdirSync(COMPONENT_LESS)
        .filter((f) => f.endsWith('.less'))
        .map((f) => f.replace(/\.less$/, ''))
    : [];
  const missing = components.filter((c) => !specced.has(c));
  return { total: components.length, specced: specced.size, missing };
}

function main() {
  const errors = [];
  checkLinks(errors);
  const cov = coverage();

  process.stdout.write(
    `Component specs: ${cov.specced} / ${cov.total} component .less files.\n`
  );
  if (cov.missing.length) {
    process.stdout.write(
      `\x1b[90mUnspecced (coverage gap, not an error): ${cov.missing.join(
        ', '
      )}\x1b[0m\n`
    );
  }

  if (errors.length) {
    process.stderr.write(`\n\x1b[31m✖ ${errors.length} broken spec link(s):\x1b[0m\n`);
    errors.forEach((e) => process.stderr.write(`  ${e}\n`));
    process.exit(1);
  }
  process.stdout.write('\x1b[32m✔ All spec links resolve.\x1b[0m\n');
}

main();
