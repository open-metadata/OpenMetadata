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
const rule = require('../require-unique-entity-name.js');

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

ruleTester.run('require-unique-entity-name', rule, {
  valid: [
    "const e = { name: `pw-table-${uuid()}` };",
    "const e = { name: `0-pw-service-${uuid()}` };",
    // Non-name properties are untouched.
    "const e = { description: 'a fixed description' };",
  ],
  invalid: [
    {
      code: "const e = { name: 'pw-table-fixed' };",
      errors: [{ messageId: 'nonUniqueName' }],
    },
    {
      code: 'const e = { name: `pw-table-static` };',
      errors: [{ messageId: 'nonUniqueName' }],
    },
  ],
});
