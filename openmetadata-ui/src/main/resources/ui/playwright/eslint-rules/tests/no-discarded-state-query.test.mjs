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
import rule from '../no-discarded-state-query.mjs';

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parser: tsParser,
  },
});
tester.run('no-discarded-state-query', rule, {
  valid: [
    'await expect(locator).toBeVisible();',
    'if (await locator.isVisible()) { await locator.click(); }',
    'const visible = await locator.isVisible();',
    'async function state() { return locator.isVisible(); }',
    'await expect(locator.isVisible()).resolves.toBe(true);',
  ],
  invalid: [
    'isVisible',
    'isHidden',
    'isEnabled',
    'isDisabled',
    'isChecked',
    'isEditable',
  ].flatMap((method) => [
    {
      code: 'await locator.' + method + '();',
      errors: [{ messageId: 'discarded' }],
    },
    { code: 'locator.' + method + '();', errors: [{ messageId: 'discarded' }] },
  ]),
});
