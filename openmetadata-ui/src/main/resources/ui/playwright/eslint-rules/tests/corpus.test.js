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

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SUPPRESSIONS = path.join(__dirname, '../../../eslint-suppressions.json');

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
  // `yarn lint:playwright:full --suppress-all` if the corpus moves again
  // before this lands; the burn-down PRs take it apart from here.
  const CEILING = Number(process.env.PW_SUPPRESSION_CEILING ?? 1520);

  assert.ok(
    total <= CEILING,
    `suppression total ${total} exceeds ceiling ${CEILING} — fix the violations rather than suppressing them`
  );
});
