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
import rule from '../require-response-listener-before-action.ts';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parser: tsParser,
  },
});

ruleTester.run('require-response-listener-before-action', rule, {
  valid: [
    // Assigned before the action — the correct pattern.
    `const res = page.waitForResponse('/api/v1/tables');
     await button.click();
     await res;`,
    // Inside Promise.all — also correct, listener registered synchronously.
    `await Promise.all([page.waitForResponse('/api/v1/tables'), button.click()]);`,
    // Non-awaited call assigned to a variable.
    `const p = somePage.waitForResponse(/tables/);`,
  ],
  invalid: [
    {
      code: `await button.click();
             await page.waitForResponse('/api/v1/tables');`,
      errors: [{ messageId: 'listenerAfterAction' }],
    },
    {
      code: `await page.waitForResponse(/tables/);`,
      errors: [{ messageId: 'listenerAfterAction' }],
    },
  ],
});
