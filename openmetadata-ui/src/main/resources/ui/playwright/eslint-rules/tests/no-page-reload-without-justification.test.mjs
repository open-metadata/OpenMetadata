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
import rule from '../no-page-reload-without-justification.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parser: tsParser,
  },
});

ruleTester.run('no-page-reload-without-justification', rule, {
  valid: [
    // Justification comment on the line above passes.
    `// TEST_KEEP_RELOAD: verifying that the setting persists across reload
     await page.reload();`,

    // Trailing comment on the same statement passes.
    `await page.reload(); // TEST_KEEP_RELOAD: SSO callback returns to /`,

    // Justification with reason text longer than one word also passes.
    `// TEST_KEEP_RELOAD: service worker must upgrade before the next test.
     await page.reload();`,

    // A reload on a non-page receiver is out of scope — this is a store
    // method, not the Playwright API.
    `store.reload();`,

    // A reload with more than one argument is not the Playwright signature.
    `page.reload(a, b);`,

    // Static usage that shares the name is not a Playwright call.
    `const x = obj.reload;`,
  ],
  invalid: [
    // Bare reload — the common case.
    {
      code: `await page.reload();`,
      errors: [{ messageId: 'unjustifiedReload' }],
    },
    // Non-null-asserted receiver must not evade.
    {
      code: `await page!.reload();`,
      errors: [{ messageId: 'unjustifiedReload' }],
    },
    // TS `as` cast must not evade.
    {
      code: `await (page as Page).reload();`,
      errors: [{ messageId: 'unjustifiedReload' }],
    },
    // Reload with an options object (still no justification).
    {
      code: `await page.reload({ waitUntil: 'load' });`,
      errors: [{ messageId: 'unjustifiedReload' }],
    },
    // A comment that is NOT the justification marker doesn't count —
    // otherwise "add any comment" would defeat the rule.
    {
      code: `// something else
       await page.reload();`,
      errors: [{ messageId: 'unjustifiedReload' }],
    },
    // A justification-marker-shaped comment without any reason text is
    // rejected — the regex requires at least one non-space character after
    // the colon.
    {
      code: `// TEST_KEEP_RELOAD:
       await page.reload();`,
      errors: [{ messageId: 'unjustifiedReload' }],
    },
    // Reload on a locator-hoisted page reference is the same evasion the
    // positional-locator rule already had to defend against.
    {
      code: `const p = pages[0]; await p.reload();`,
      errors: [{ messageId: 'unjustifiedReload' }],
    },
  ],
});
