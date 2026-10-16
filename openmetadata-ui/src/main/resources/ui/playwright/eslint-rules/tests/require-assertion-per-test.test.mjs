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
import rule from '../require-assertion-per-test.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parser: tsParser,
  },
});

ruleTester.run('require-assertion-per-test', rule, {
  valid: [
    `test('has an assertion', async ({ page }) => {
       await expect(page.getByTestId('x')).toBeVisible();
     });`,
    // Assertion nested inside a test.step still counts.
    `test('nested', async ({ page }) => {
       await test.step('s', async () => { await expect(page).toHaveURL('/x'); });
     });`,
    // Assertion delegated to a helper that itself asserts.
    `test('delegated', async ({ page }) => { await verifyRow(page, expect); });`,
    // Hooks are not tests.
    `test.beforeAll(async () => { await seed(); });`,
    // Page-object delegation: `entity.descriptionUpdate` may assert
    // internally — the rule can't see through it, so it must not guess.
    `test('delegates', async ({ page }) => { await entity.descriptionUpdate(page); });`,
    // A bare identifier call (imported or local helper) may also assert
    // internally.
    `test('local helper', async ({ page }) => { await verifyThing(page); });`,
    // Any single non-page call anywhere in the body exempts the whole test,
    // even alongside plain page interactions.
    `test('mixed', async ({ page }) => {
       await page.getByTestId('x').click();
       await addUser(page);
     });`,
    // test.step's callback is inline and fully visible, so an assertion
    // inside it still counts — same as the 'nested' case above, restated
    // with an explicit name per the test.* transparency fix.
    `test('step with assertion', async ({ page }) => {
       await test.step('s', async () => { await expect(page.getByTestId('x')).toBeVisible(); });
     });`,
    // test.slow() is transparent, not exempting: it can't assert, but a
    // real delegated assertion elsewhere in the body still exempts the test.
    `test('slow but delegates', async ({ page }) => {
       test.slow(true);
       await entity.descriptionUpdate(page);
     });`,
  ],
  invalid: [
    {
      code: `test('clicks but never asserts', async ({ page }) => {
               await page.getByTestId('save').click();
             });`,
      errors: [{ messageId: 'pageInteractionsOnly' }],
    },
    // Only page/locator-chain calls, no expect anywhere: provably
    // assertion-free.
    {
      code: `test('pure interaction', async ({ page }) => {
               await page.getByTestId('save').click();
             });`,
      errors: [{ messageId: 'pageInteractionsOnly' }],
    },
    {
      code: `test('multi interaction', async ({ page }) => {
               await page.goto('/x');
               await page.getByTestId('y').click();
             });`,
      errors: [{ messageId: 'pageInteractionsOnly' }],
    },
    // test.slow() can't assert, so it must not shield a purely-interacting
    // test from being flagged.
    {
      code: `test('slow but empty', async ({ page }) => {
               test.slow(true);
               await page.getByTestId('x').click();
             });`,
      errors: [{ messageId: 'pageInteractionsOnly' }],
    },
    {
      code: `test('timeout then click', async ({ page }) => {
               test.setTimeout(60000);
               await page.goto('/x');
               await page.getByTestId('y').click();
             });`,
      errors: [{ messageId: 'pageInteractionsOnly' }],
    },
    // test.step's callback is inline and fully visible; calls inside it are
    // checked on their own merits, same as calls anywhere else in the body.
    {
      code: `test('step of clicks', async ({ page }) => {
               await test.step('s', async () => { await page.getByTestId('x').click(); });
             });`,
      errors: [{ messageId: 'pageInteractionsOnly' }],
    },
  ],
});
