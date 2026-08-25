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

import { RuleTester } from 'eslint';
import rule from '../no-blanket-test-slow.ts';

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

ruleTester.run('no-blanket-test-slow', rule, {
  valid: [
    // Inside a single test body — legal, scoped to one slow scenario.
    `test('a slow one', async ({ page }) => { test.slow(); await page.goto('/'); });`,
    // A conditional nested inside a test body — still per-test scope.
    `test('x', async ({ page }) => { if (isCI) { test.slow(); } });`,
    // beforeAll runs on its own timeout slot, not any test's.
    `test.beforeAll(async () => { test.slow(); });`,
    // afterEach also runs on its own timeout slot, not any test's.
    `test.afterEach(async () => { test.slow(); });`,
    // test.step's callback runs once per test, same as the test body itself.
    `test('a', async () => { await test.step('step1', async () => { test.slow(); }); });`,
  ],
  invalid: [
    {
      // File scope — applies to every test in the file.
      code: `test.slow();`,
      errors: [{ messageId: 'blanketSlow' }],
    },
    {
      // Describe scope — applies to every test in the block.
      code: `test.describe('suite', () => { test.slow(); test('a', async () => {}); });`,
      errors: [{ messageId: 'blanketSlow' }],
    },
    {
      // beforeEach runs on the test's own default timeout slot before every
      // test in scope — same blast radius as a describe-scope call.
      code: `test.describe('suite', () => { test.beforeEach(async () => { test.slow(); }); test('a', async () => {}); });`,
      errors: [{ messageId: 'blanketSlow' }],
    },
    {
      // Aliased test object (e.g. `const base = test.extend(...)`) — still
      // describe scope, still blanket.
      code: `base.describe('suite', () => { base.slow(true); base('a', async () => {}); });`,
      errors: [{ messageId: 'blanketSlow' }],
    },
    {
      // A variable bound directly to the `describe` function (e.g.
      // `const describeInParallel = test.describe;`, seen in
      // TagsSuggestion.spec.ts) called directly — structurally identical to
      // a per-test invocation, but it's still a describe call. Must not be
      // mistaken for a legal per-test scope.
      code: `const describeInParallel = test.describe; describeInParallel('suite', () => { test.slow(); test('a', async () => {}); });`,
      errors: [{ messageId: 'blanketSlow' }],
    },
  ],
});
