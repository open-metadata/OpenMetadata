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
import rule from '../no-accumulating-before-all.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parser: tsParser,
  },
});

ruleTester.run('no-accumulating-before-all', rule, {
  valid: [
    // Reassigned at the top of the hook, so a second run starts clean.
    `let entities = [];
     test.beforeAll(async () => {
       entities = [];
       for (const config of CONFIGS) {
         entities.push(config.create());
       }
     });`,
    // Built and assigned in one go.
    `let entities = [];
     test.beforeAll(async () => {
       entities = CONFIGS.map((config) => config.create());
     });`,
    // Declared inside the hook — cannot leak across runs.
    `test.beforeAll(async () => {
       const entities = [];
       entities.push(new TableClass());
       await use(entities);
     });`,
    // Pushing in beforeEach is fine: it is per test, not per group.
    `const entities = [];
     test.beforeEach(async () => {
       entities.push(new TableClass());
     });`,
    // Not a push.
    `const entities = [];
     test.beforeAll(async () => {
       entities.length = 0;
     });`,
  ],
  invalid: [
    {
      code: `const entities = [];
             test.beforeAll(async () => {
               for (const config of CONFIGS) {
                 entities.push(config.create());
               }
             });`,
      errors: [
        { messageId: 'accumulatingBeforeAll', data: { name: 'entities' } },
      ],
    },
    {
      // `let` without a reset is just as broken as `const`.
      code: `let created = [];
             test.beforeAll(async () => {
               created.push(new TableClass());
             });`,
      errors: [
        { messageId: 'accumulatingBeforeAll', data: { name: 'created' } },
      ],
    },
    {
      // A reset *after* the push does not help the reads that already happened.
      code: `let entities = [];
             test.beforeAll(async () => {
               entities.push(new TableClass());
               entities = [];
             });`,
      errors: [
        { messageId: 'accumulatingBeforeAll', data: { name: 'entities' } },
      ],
    },
    {
      // beforeAll registered without the `test.` prefix.
      code: `const entities = [];
             beforeAll(async () => {
               entities.push(new TableClass());
             });`,
      errors: [
        { messageId: 'accumulatingBeforeAll', data: { name: 'entities' } },
      ],
    },
    {
      // Nested inside a describe, which is where this actually happens.
      code: `test.describe('suite', () => {
               const entities = [];
               test.beforeAll(async () => {
                 entities.push(new TableClass());
               });
             });`,
      errors: [
        { messageId: 'accumulatingBeforeAll', data: { name: 'entities' } },
      ],
    },
  ],
});
