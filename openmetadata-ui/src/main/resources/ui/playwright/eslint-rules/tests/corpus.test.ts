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

  const actual: Record<string, number> = {};
  for (const file of Object.values(suppressions) as Record<
    string,
    { count: number }
  >[]) {
    for (const [ruleId, entry] of Object.entries(file)) {
      actual[ruleId] = (actual[ruleId] ?? 0) + entry.count;
    }
  }

  // The ratchet's recorded state, per rule. Exact equality rather than a
  // ceiling, deliberately: a `total <= CEILING` bound accumulates headroom as
  // the burn-down PRs land. Drop the total to 200 against a 1,520 bound and
  // 1,320 units of free space open up, into which a new violation can be
  // suppressed with CI fully green — and nothing recomputes the bound.
  //
  // Lower a number when you fix violations, and commit the pruned
  // eslint-suppressions.json in the same change. Raising one is almost always
  // wrong: a new violation should be fixed, not suppressed. Either direction
  // is now an explicit edit here that a reviewer sees.
  //
  // Known gap: counts are per file+rule, so swapping one violation for another
  // of the same rule in the same file stays invisible to this check.
  const EXPECTED: Record<string, number> = {
    'om-playwright/justified-rule-disable': 12,
    'om-playwright/no-blanket-test-slow': 83,
    'om-playwright/no-positional-locator': 1339,
    'om-playwright/require-assertion-per-test': 1,
    'playwright/no-force-option': 11,
    'playwright/no-skipped-test': 4,
    'playwright/no-wait-for-selector': 35,
    'playwright/no-wait-for-timeout': 31,
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
  // eslint-rules/ is the CommonJS plugin itself; doc-generator/ is lint-ignored
  // tooling. Neither is a test, and neither is collected by Playwright.
  const EXEMPT = new Set([
    'eslint-rules',
    'doc-generator',
    'output',
    'test-data',
  ]);

  const offenders = [];
  const walk = (dir, relative) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = relative ? `${relative}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        if (!EXEMPT.has(rel)) {
          walk(path.join(dir, entry.name), rel);
        }
      } else if (/\.(js|jsx)$/.test(entry.name)) {
        offenders.push(rel);
      }
    }
  };

  walk(ROOT, '');

  assert.deepStrictEqual(
    offenders,
    [],
    `JavaScript files found in the Playwright corpus: ${offenders.join(
      ', '
    )}. ` +
      'Playwright collects *.spec.js but eslint.config.mjs scopes the guardrail ' +
      'rules to .ts/.tsx, so these would run unlinted. Convert them to TypeScript.'
  );
});
