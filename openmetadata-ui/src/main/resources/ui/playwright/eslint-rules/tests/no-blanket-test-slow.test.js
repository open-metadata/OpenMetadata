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

const { RuleTester } = require('eslint');
const rule = require('../no-blanket-test-slow.js');

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

ruleTester.run('no-blanket-test-slow', rule, {
  valid: [
    // Inside a single test body — legal, scoped to one slow scenario.
    `test('a slow one', async ({ page }) => { test.slow(); await page.goto('/'); });`,
    // Inside a hook belonging to one test.
    `test('x', async ({ page }) => { if (isCI) { test.slow(); } });`,
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
  ],
});
