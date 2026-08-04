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
const rule = require('../justified-rule-disable.js');

// ESLint 9's own linter validates that every rule id referenced in an
// eslint-disable comment is a rule known to *this* config, independent of
// the rule under test — an unrelated "Definition for rule 'X' was not
// found" error otherwise drowns out what these fixtures are meant to check.
// Stub rules for the ids the fixtures reference so justified-rule-disable's
// own logic is what's on trial.
const STUB_RULE = { create: () => ({}) };

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
  plugins: {
    playwright: { rules: { 'no-force-option': STUB_RULE } },
    'om-playwright': { rules: { 'no-positional-locator': STUB_RULE } },
    '@typescript-eslint': { rules: { 'no-explicit-any': STUB_RULE } },
  },
});

ruleTester.run('justified-rule-disable', rule, {
  valid: [
    // Justification follows on the same line after a dash.
    `// eslint-disable-next-line om-playwright/no-positional-locator -- the grid renders identical rows by design
     const x = 1;`,
    // Disables of non-playwright rules are out of scope for this rule.
    `// eslint-disable-next-line @typescript-eslint/no-explicit-any
     const y = 1;`,
  ],
  invalid: [
    {
      code: `// eslint-disable-next-line om-playwright/no-positional-locator
             const z = 1;`,
      errors: [{ messageId: 'unjustified' }],
    },
    {
      code: `// eslint-disable-next-line playwright/no-force-option
             const w = 1;`,
      errors: [{ messageId: 'unjustified' }],
    },
  ],
});
