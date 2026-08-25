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
import { Linter, RuleTester } from 'eslint';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import rule from '../justified-rule-disable.ts';

// ESLint 9's own linter validates that every rule id referenced in an
// eslint-disable comment is a rule known to *this* config, independent of
// the rule under test — an unrelated "Definition for rule 'X' was not
// found" error otherwise drowns out what these fixtures are meant to check.
// Stub rules for the ids the fixtures reference so justified-rule-disable's
// own logic is what's on trial.
const STUB_RULE = { create: () => ({}) };

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parser: tsParser,
  },
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
    // A bare `-next-line` directive with no rule list disables every active
    // rule on the following line, not just playwright rules — always
    // invalid. (The report lands on the comment, which is on the *prior*
    // line to the disabled range, so ESLint's own disable-comment filtering
    // does not swallow it — see the Linter-level test below for the block
    // form, where it does.)
    {
      code: `// eslint-disable-next-line
             const b = 1;`,
      errors: [{ messageId: 'blanketDisable' }],
    },
    // Design decision: a blanket disable stays invalid even with a
    // justification. `-- <why>` justifies disabling a *named* rule; it
    // cannot justify disabling every rule in the file, which is what a bare
    // directive does regardless of the comment attached to it. A blanket
    // disable of everything is never acceptable, reasoned or not.
    {
      code: `// eslint-disable-next-line -- turning everything off on purpose
             const c = 1;`,
      errors: [{ messageId: 'blanketDisable' }],
    },
  ],
});

// The bare *block* form, `/* eslint-disable */`, cannot be asserted through
// RuleTester as an 'invalid' case: ESLint's own disable-comment filtering
// treats a block-form disable as covering its own line, so it swallows this
// rule's report about itself before RuleTester (or a real lint run) ever
// sees it — the same self-referential blind spot documented for
// `/* eslint-disable om-playwright/justified-rule-disable */` in Fix 2(b) of
// the review, just via the unnamed form instead of the self-named one. This
// test pins that ESLint behaviour (zero messages) so a future ESLint upgrade
// that changes it doesn't silently invalidate the CI-level grep guard that
// exists precisely because this case can't be caught here.
test('bare block-form eslint-disable self-suppresses this rule (pinned; enforcement is the CI grep guard, not this rule)', () => {
  const linter = new Linter();
  const messages = linter.verify('/* eslint-disable */\nconst a = 1;', {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: tsParser,
    },
    plugins: { 'om-playwright': { rules: { 'justified-rule-disable': rule } } },
    rules: { 'om-playwright/justified-rule-disable': 'error' },
  });

  assert.deepEqual(messages, []);
});
