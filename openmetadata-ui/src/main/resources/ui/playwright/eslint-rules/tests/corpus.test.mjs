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

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const SUPPRESSIONS = path.join(
  import.meta.dirname,
  '../../../eslint-suppressions.json'
);

test('the suppressions baseline matches its recorded state exactly', () => {
  const suppressions = JSON.parse(fs.readFileSync(SUPPRESSIONS, 'utf8'));

  const actual = {};
  for (const file of Object.values(suppressions)) {
    for (const [ruleId, entry] of Object.entries(file)) {
      actual[ruleId] = (actual[ruleId] ?? 0) + entry.count;
    }
  }

  // Exact equality, not a ceiling: a `total <= CEILING` bound accumulates
  // headroom as burn-down PRs land, and that slack absorbs new suppressions
  // with CI green. Lower a number when you fix violations and commit the
  // pruned eslint-suppressions.json with it; raising one is almost always
  // wrong. Either direction is an explicit edit a reviewer sees.
  //
  // Known gap: counts are per file+rule, so swapping one violation for another
  // of the same rule in the same file stays invisible here.
  const EXPECTED = {
    'om-playwright/justified-rule-disable': 12,
    'om-playwright/no-positional-locator': 1310,
    'om-playwright/require-assertion-per-test': 1,
    'playwright/no-skipped-test': 4,
    'playwright/no-wait-for-selector': 35,
  };

  assert.deepStrictEqual(
    actual,
    EXPECTED,
    'The suppressions baseline no longer matches the counts recorded in this ' +
      'test. If you fixed violations, run `yarn lint:playwright:suppressions` ' +
      'and lower the matching numbers here. If a count went up, a new ' +
      'violation was suppressed instead of fixed — fix it.'
  );
});

test('the playwright corpus stays TypeScript-only', () => {
  const ROOT = path.join(import.meta.dirname, '../..');
  // eslint-rules/ is the linter plugin itself — plain ESM .mjs, matching the
  // repo's other rule plugins; doc-generator/ is lint-ignored tooling. Neither
  // is a test, and neither is collected by Playwright.
  const EXEMPT = new Set([
    'eslint-rules',
    'doc-generator',
    'output',
    'test-data',
  ]);

  // An allowlist, not a list of banned extensions: Playwright's default
  // testMatch collects .js/.jsx/.mjs/.cjs/.mts/.cts as well as .ts/.tsx, while
  // the guardrail globs cover only .js/.jsx/.ts/.tsx. So .mjs/.cjs/.mts/.cts
  // would run unlinted, and .js/.jsx are linted but still do not belong here.
  // Naming what is permitted keeps any future module extension closed too.
  const MODULE_EXTENSION = /\.[cm]?[jt]sx?$/;
  const ALLOWED_EXTENSION = /\.tsx?$/;

  const offenders = [];
  const walk = (dir, relative) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = relative ? `${relative}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        if (!EXEMPT.has(rel)) {
          walk(path.join(dir, entry.name), rel);
        }
      } else if (
        MODULE_EXTENSION.test(entry.name) &&
        !ALLOWED_EXTENSION.test(entry.name)
      ) {
        offenders.push(rel);
      }
    }
  };

  walk(ROOT, '');

  assert.deepStrictEqual(
    offenders,
    [],
    `Specs must be .ts/.tsx; found: ${offenders.join(', ')}. ` +
      'Playwright collects all of these. .mjs/.cjs/.mts/.cts fall outside the ' +
      'guardrail globs entirely and would run unlinted; .js/.jsx are linted but ' +
      'the corpus is TypeScript by convention. Convert them to .ts/.tsx.'
  );
});
