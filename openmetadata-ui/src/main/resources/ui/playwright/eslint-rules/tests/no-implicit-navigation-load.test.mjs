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
import rule from '../no-implicit-navigation-load.mjs';

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parser: tsParser,
  },
});
tester.run('no-implicit-navigation-load', rule, {
  valid: [
    "page.goto('/table/test', { waitUntil: 'domcontentloaded' });",
    "adminPage.reload({ waitUntil: 'domcontentloaded' });",
    "page.goBack({ waitUntil: 'commit' });",
    "page.waitForURL('**/table/test', { waitUntil: 'domcontentloaded', timeout: 1000 });",
    "page.waitForLoadState('domcontentloaded');",
    "page.getByRole('button').click();",
    "expect(page).toHaveURL('/table/test');",
    'expect(page).toHaveURL(/table/);',
    "expect.poll(() => new URL(page.url()).pathname).toBe('/table/test');",
  ],
  invalid: [
    "page.goto('/table/test');",
    'adminPage.reload();',
    'page.goBack();',
    'page.goForward();',
    "page.waitForURL('**/table/test');",
    "page.goto('/table/test', { timeout: 1000 });",
    "page.goto('/table/test', { waitUntil: 'load' });",
    "page.reload({ waitUntil: 'networkidle' });",
    'page.waitForLoadState();',
    "page.waitForLoadState('load');",
  ].map((code) => ({ code, errors: [{ messageId: 'navigationLoad' }] })),
});

tester.run('no-implicit-navigation-load URL predicates', rule, {
  valid: [],
  invalid: [
    "expect(page).toHaveURL((url) => url.pathname === '/table/test');",
    "expect(page).not.toHaveURL(function (url) { return url.pathname === '/signin'; });",
  ].map((code) => ({ code, errors: [{ messageId: 'urlPredicateLoad' }] })),
});
