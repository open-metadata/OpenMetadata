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
import rule from '../no-status-filtered-response.mjs';

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parser: tsParser,
  },
});
tester.run('no-status-filtered-response', rule, {
  valid: [
    "page.waitForResponse(response => response.url().includes('/api/test'));",
    "const response = await page.waitForResponse('/api/test'); expect(response.status()).toBe(200);",
    "page.on('response', response => { statuses.push(response.status()); });",
    "waitForResponseWithStatus(page, response => response.request().method() === 'POST', 201);",
  ],
  invalid: [
    "page.waitForResponse(r => r.url().includes('/api/test') && r.ok());",
    "page.waitForResponse(response => response.url().includes('/api/test') && response.status() === 200);",
    'page.waitForResponse(r => { return r.status() === 500; });',
    'page.waitForResponse(function(r) { return r.status() !== 503; });',
  ].map((code) => ({ code, errors: [{ messageId: 'statusFilter' }] })),
});
