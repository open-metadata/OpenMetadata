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

test('suppressions baseline only ever shrinks', () => {
  const suppressions = JSON.parse(fs.readFileSync(SUPPRESSIONS, 'utf8'));

  let total = 0;
  for (const file of Object.values(suppressions)) {
    for (const rule of Object.values(file)) {
      total += rule.count;
    }
  }

  // The ratchet's starting notch, set once when this gate lands, then only
  // ever moved downward as violations are fixed. Once the gate is live a rise
  // means new violations were suppressed instead of fixed, and is never
  // acceptable.
  //
  // The initial value is not a budget — it is simply what an unlinted corpus
  // accumulated. None of these rules has ever been enforced on `main`, so
  // nothing has been holding the count down, and it drifts upward with every
  // test written against no linter. Re-measure with
  // `yarn lint:playwright --suppress-all` if the corpus moves again
  // before this lands; the burn-down PRs take it apart from here.
  const CEILING = Number(process.env.PW_SUPPRESSION_CEILING ?? 1520);

  assert.ok(
    total <= CEILING,
    `suppression total ${total} exceeds ceiling ${CEILING} — fix the violations rather than suppressing them`
  );
});

// The 18 guardrail rules are scoped to `**/playwright/**/*.{ts,tsx}` in
// eslint.config.mjs, deliberately: the local plugin under `eslint-rules/` is
// CommonJS `.js` and is not a Playwright test, so applying test rules to it is
// meaningless. That scoping only holds as a guardrail while the test corpus
// really is TypeScript-only — Playwright's default `testMatch` DOES collect
// `*.spec.js`, so a JavaScript spec would run with none of the rules applied.
// This test makes the TypeScript-only invariant explicit rather than assumed.
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
