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
const { aggregate } = require('./aggregate-flake-report.js');

const fixture = {
  suites: [
    {
      file: 'e2e/Pages/ExploreTree.spec.ts',
      specs: [
        {
          title: 'flaky one',
          tests: [{ status: 'flaky', results: [{}, {}] }],
        },
        {
          title: 'stable one',
          tests: [{ status: 'expected', results: [{}] }],
        },
      ],
    },
  ],
};

test('counts flaky specs and ignores stable ones', () => {
  const report = aggregate(fixture);

  assert.strictEqual(report.totals.tests, 2);
  assert.strictEqual(report.totals.flaky, 1);
  assert.strictEqual(report.flaky.length, 1);
  assert.strictEqual(report.flaky[0].title, 'flaky one');
  assert.strictEqual(report.flaky[0].file, 'e2e/Pages/ExploreTree.spec.ts');
});

test('handles nested suites', () => {
  const nested = {
    suites: [{ file: 'a.spec.ts', suites: [fixture.suites[0]] }],
  };

  assert.strictEqual(aggregate(nested).totals.flaky, 1);
});

test('empty input produces an empty report', () => {
  const report = aggregate({ suites: [] });

  assert.strictEqual(report.totals.tests, 0);
  assert.strictEqual(report.flaky.length, 0);
});
