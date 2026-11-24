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

import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';
import rule from '../no-blanket-test-slow.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parser: tsParser,
  },
});

ruleTester.run('no-blanket-test-slow', rule, {
  valid: [
    // Inside a single test body — legal, scoped to one slow scenario.
    `test('a slow one', async ({ page }) => { test.slow(); await page.goto('/'); });`,
    // A conditional nested inside a test body — still per-test scope.
    `test('x', async ({ page }) => { if (isCI) { test.slow(); } });`,
    // The fix for a slow beforeAll: extend the hook's own slot.
    `test.beforeAll(async () => { test.setTimeout(test.info().timeout * 3); });`,
    // afterEach's slot is max(project timeout, test timeout), so a slow test
    // has already tripled it.
    `test.afterEach(async () => { test.slow(); });`,
    `test.afterAll(async () => { test.setTimeout(test.info().timeout * 3); });`,
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
    {
      // Since Playwright 1.65 slow() takes effect once per test, and beforeAll
      // runs inside the first test of each worker, so this would cancel that
      // test's own test.slow().
      code: `test.beforeAll(async () => { test.slow(); });`,
      output: `test.beforeAll(async () => { test.setTimeout(test.info().timeout * 3); });`,
      errors: [{ messageId: 'slowInAllHook' }],
    },
    {
      // Same on an aliased test object, and for slow(true).
      code: `const base = test.extend({}); base.beforeAll(async () => { base.slow(true); }); base('a', async () => {});`,
      output: `const base = test.extend({}); base.beforeAll(async () => { base.setTimeout(base.info().timeout * 3); }); base('a', async () => {});`,
      errors: [{ messageId: 'slowInAllHook' }],
    },
    {
      // afterAll runs with the last test's TestInfo; once that test called
      // slow(), this slow() does nothing and the hook keeps the base timeout.
      code: `test.afterAll(async () => { test.slow(); });`,
      output: `test.afterAll(async () => { test.setTimeout(test.info().timeout * 3); });`,
      errors: [{ messageId: 'slowInAllHook' }],
    },
    {
      // A condition needs a human decision, so it is reported without a fix.
      code: `test.beforeAll(async () => { test.slow(isCI, 'seeds a lot'); });`,
      output: null,
      errors: [{ messageId: 'slowInAllHook' }],
    },
  ],
});
