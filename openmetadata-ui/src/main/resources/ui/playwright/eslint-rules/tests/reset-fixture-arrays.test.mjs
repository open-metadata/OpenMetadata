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
import rule from '../reset-fixture-arrays.mjs';

const tester = new RuleTester({ languageOptions: { parser: tsParser } });
tester.run('reset-fixture-arrays', rule, {
  valid: [
    `test.beforeAll(() => { const entities = []; entities.push(create()); });`,
    `const entities = []; test.beforeAll(() => { entities.length = 0; entities.push(create()); });`,
    `let entities = []; test.beforeAll(() => { entities = []; entities.push(create()); });`,
    `const entities = []; test.beforeEach(() => { entities.push(create()); });`,
    `const entities = []; test.beforeAll(() => { const entities = []; entities.push(create()); });`,
    `const entities = []; test.beforeAll(() => { entities.length = 0; types.forEach(type => entities.push(create(type))); });`,
  ],
  invalid: [
    {
      code: `const entities = []; test.beforeAll(() => entities.push(create()));`,
      errors: [{ messageId: 'staleFixtures' }],
    },
    {
      code: `const entities: Entity[] = []; test.beforeAll(() => { entities.push(create()); });`,
      errors: [{ messageId: 'staleFixtures' }],
    },
    {
      code: `const entities = []; test.beforeAll(() => { types.forEach(type => entities.push(create(type))); });`,
      errors: [{ messageId: 'staleFixtures' }],
    },
    {
      code: `const entities = []; test.beforeAll(() => { entities.push(create()); entities.length = 0; });`,
      errors: [{ messageId: 'staleFixtures' }],
    },
    {
      code: `const entities = []; test.beforeAll(() => { if (condition) entities.length = 0; entities.push(create()); });`,
      errors: [{ messageId: 'staleFixtures' }],
    },
  ],
});
