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
const rule = require('../no-positional-locator.js');

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

ruleTester.run('no-positional-locator', rule, {
  valid: [
    `await page.getByTestId('row').filter({ hasText: name }).click();`,
    `await getRowByName(page, name).click();`,
    // Array methods of the same name are not locator positional selectors.
    `const x = [1, 2, 3].at(0);`,
    // .first on a non-call member expression is a property, not a locator call.
    `const y = obj.first;`,
  ],
  invalid: [
    {
      code: `await page.getByTestId('row').first().click();`,
      errors: [{ messageId: 'positional' }],
    },
    {
      code: `await page.locator('.row').nth(2).click();`,
      errors: [{ messageId: 'positional' }],
    },
    {
      code: `await page.locator('.row').last().click();`,
      errors: [{ messageId: 'positional' }],
    },
  ],
});
