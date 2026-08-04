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
const rule = require('../no-unscoped-count-assertion.js');

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

ruleTester.run('no-unscoped-count-assertion', rule, {
  valid: [
    // Absence assertions are safe regardless of other data.
    `await expect(page.locator('.rdg-row')).toHaveCount(0);`,
    // Relative to a measured baseline — immune to accumulated data.
    `await expect(page.locator('.rdg-row')).toHaveCount(rowsBefore + 1);`,
    // Scoped by the test's own entity name.
    `await expect(page.locator('.rdg-row').filter({ hasText: name })).toHaveCount(1);`,
  ],
  invalid: [
    {
      code: `await expect(page.locator('.rdg-row')).toHaveCount(2);`,
      errors: [{ messageId: 'unscopedCount' }],
    },
  ],
});
