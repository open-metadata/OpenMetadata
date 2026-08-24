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
  // ever moved downward as violations are fixed. After the gate is live a rise
  // means new violations were suppressed instead of fixed, and is never
  // acceptable.
  //
  // 1,521 rather than the 1,446 this PR was authored against: the gate sat
  // closed from 2026-08-13 until after the 2.0 release, and across those 509
  // commits of `main` nothing enforced these rules, so the corpus gained 88
  // no-positional-locator sites (four other rules shrank, for +75 net). That
  // drift is the argument for the gate, not a violation of it — the ratchet
  // cannot have been broken before it existed. The burn-down PRs that follow
  // this one take it back down.
  const CEILING = Number(process.env.PW_SUPPRESSION_CEILING ?? 1521);

  assert.ok(
    total <= CEILING,
    `suppression total ${total} exceeds ceiling ${CEILING} — fix the violations rather than suppressing them`
  );
});
