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

  // Update this ceiling downward as violations are fixed. It must never rise:
  // a rise means new violations were suppressed instead of fixed.
  const CEILING = Number(process.env.PW_SUPPRESSION_CEILING ?? 1446);

  assert.ok(
    total <= CEILING,
    `suppression total ${total} exceeds ceiling ${CEILING} — fix the violations rather than suppressing them`
  );
});
