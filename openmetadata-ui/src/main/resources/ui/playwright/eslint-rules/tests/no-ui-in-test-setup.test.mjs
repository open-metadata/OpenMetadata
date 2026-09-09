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
import rule from '../no-ui-in-test-setup.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parser: tsParser,
  },
});

ruleTester.run('no-ui-in-test-setup', rule, {
  valid: [
    // The canonical shape — API-driven setup. Sampled from
    // e2e/VersionPages/ClassificationVersionPage.spec.ts and every other
    // healthy suite in this codebase.
    `test.beforeAll(async ({ browser }) => {
       const { apiContext, afterAction } = await createNewPage(browser);
       await classification.create(apiContext);
       await afterAction();
     });`,

    // API + REST helpers inside beforeAll — no UI actions, all allowed.
    `test.beforeAll(async ({ browser }) => {
       const { apiContext } = await performAdminLogin(browser);
       await adminUser.create(apiContext);
       await adminUser.setAdminRole(apiContext);
     });`,

    // page.goto in beforeEach is intentionally NOT banned — navigating to
    // the URL under test is legitimate setup. Only click/fill/etc are.
    `test.beforeEach(async ({ page }) => {
       await page.goto('/glossary');
     });`,

    // Test-body clicks and fills are exactly where UI actions belong.
    `test('creates a glossary', async ({ page }) => {
       await page.click(createBtn);
       await page.fill(nameInput, 'g1');
     });`,

    // afterEach without any UI action is fine.
    `test.afterEach(async ({ apiContext }) => {
       await cleanupEntities(apiContext);
     });`,

    // Nested test() inside describe() must not confuse the hook tracker —
    // the click is inside the test body, not any hook.
    `test.describe('glossary', () => {
       test.beforeAll(async ({ browser }) => {
         const { apiContext } = await performAdminLogin(browser);
         await glossary.create(apiContext);
       });
       test('shows the term', async ({ page }) => {
         await page.click(termLink);
       });
     });`,
  ],
  invalid: [
    // The core case: UI action in beforeAll.
    {
      code: `test.beforeAll(async ({ browser }) => {
        const page = await browser.newPage();
        await page.goto('/settings/users');
        await page.click(createUserBtn);
      });`,
      errors: [{ messageId: 'uiInSetup', data: { method: 'click', hook: 'beforeAll' } }],
    },
    // Fill in beforeEach — same violation shape.
    {
      code: `test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.fill(searchInput, 'query');
      });`,
      errors: [{ messageId: 'uiInSetup', data: { method: 'fill', hook: 'beforeEach' } }],
    },
    // Cleanup via UI is even worse — UI cleanup runs after assertions and
    // can pollute the next test.
    {
      code: `test.afterAll(async ({ page }) => {
        await page.click(deleteEntityBtn);
      });`,
      errors: [{ messageId: 'uiInSetup', data: { method: 'click', hook: 'afterAll' } }],
    },
    // A Locator variable click is the same violation with a hoisted receiver.
    {
      code: `test.beforeAll(async ({ page }) => {
        const btn = page.getByRole('button', { name: 'Create' });
        await btn.click();
      });`,
      errors: [{ messageId: 'uiInSetup', data: { method: 'click', hook: 'beforeAll' } }],
    },
    // TypeScript wrappers must not silently erase the violation.
    {
      code: `test.beforeAll(async ({ page }) => {
        await (page as Page).selectOption(dropdown, 'value');
      });`,
      errors: [{ messageId: 'uiInSetup', data: { method: 'selectOption', hook: 'beforeAll' } }],
    },
    // Multiple UI actions in one hook — all reported.
    {
      code: `test.beforeEach(async ({ page }) => {
        await page.fill(nameInput, 'x');
        await page.press(nameInput, 'Enter');
      });`,
      errors: [
        { messageId: 'uiInSetup', data: { method: 'fill', hook: 'beforeEach' } },
        { messageId: 'uiInSetup', data: { method: 'press', hook: 'beforeEach' } },
      ],
    },
    // Nested describe.beforeAll — the tracker must still see it as a hook.
    {
      code: `test.describe('users', () => {
        test.beforeAll(async ({ page }) => {
          await page.click(loginBtn);
        });
      });`,
      errors: [{ messageId: 'uiInSetup', data: { method: 'click', hook: 'beforeAll' } }],
    },
  ],
});
