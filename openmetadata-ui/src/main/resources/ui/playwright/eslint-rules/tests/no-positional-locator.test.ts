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
import rule from '../no-positional-locator.ts';

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

ruleTester.run('no-positional-locator', rule, {
  valid: [
    `await page.getByTestId('row').filter({ hasText: name }).click();`,
    `await getRowByName(page, name).click();`,
    // Array methods of the same name are not locator positional selectors.
    `const x = [1, 2, 3].at(0);`,
    `const x = [1, 2, 3].filter(Boolean).at(0);`,
    `const x = arr.slice().at(-1);`,
    // Static lodash-style helpers pass the collection explicitly — the
    // absence of Playwright's zero-argument .first()/.last() shape is what
    // distinguishes them from a positional locator call on the same name.
    `const x = lodash.first(arr);`,
    // .first on a non-call member expression is a property, not a locator call.
    `const y = obj.first;`,
    `const y = obj?.first;`,
    `const el = page.locator('.x').first;`,
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
    // Hoisting a locator into a variable before calling .first()/.nth() must
    // not evade the rule — it's the cheapest way around a call-only receiver
    // check.
    {
      code: `const rows = page.locator('.row'); await rows.first().click();`,
      errors: [{ messageId: 'positional' }],
    },
    {
      code: `const rows = page.locator('.row'); await rows.nth(i).click();`,
      errors: [{ messageId: 'positional' }],
    },
    // A locator stored as a property (`this.foo`, `page.foo`) is the same
    // evasion with a member-expression receiver instead of a bare identifier.
    {
      code: `await this.nameLink.first().click();`,
      errors: [{ messageId: 'positional' }],
    },
  ],
});
