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
import { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import uiPatternsPlugin from './openmetadata-ui-patterns.mjs';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    parser: tseslint.parser,
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
    sourceType: 'module',
  },
});

ruleTester.run(
  'no-raw-title-attribute',
  uiPatternsPlugin.rules['no-raw-title-attribute'],
  {
    valid: [
      { code: '<PageHeader title="Explore" />;' },
      { code: '<PageLayout.PageHeader title="Explore" />;' },
      { code: '<title>Explore</title>;' },
    ],
    invalid: [
      {
        code: '<div title="Explore" />;',
        errors: [{ messageId: 'noRawTitle' }],
      },
    ],
  }
);

ruleTester.run(
  'no-non-adaptive-palette',
  uiPatternsPlugin.rules['no-non-adaptive-palette'],
  {
    valid: [
      { code: "const a = 'tw:bg-surface tw:text-primary';" },
      { code: "const a = 'tw:bg-utility-blue-50';" },
      { code: "const a = 'tw:dark:bg-blue-500';" },
      { code: "const a = 'tw:bg-primary';" },
      { code: "const a = 'flex items-center';" },
      { code: 'const a = `tw:bg-utility-blue-50`;' },
      // Semantic tokens (no numeric shade) are fine.
      { code: "const a = 'tw:bg-error-primary tw:text-brand-secondary';" },
      // Non-color utilities with a numeric segment must not false-positive.
      { code: "const a = 'tw:divide-x-2 tw:ring-offset-2 tw:border-t-2';" },
    ],
    invalid: [
      {
        code: "const a = 'tw:bg-blue-50';",
        errors: [{ messageId: 'rawPalette' }],
      },
      {
        code: "const a = 'tw:text-gray-500 tw:bg-yellow-50';",
        errors: [{ messageId: 'rawPalette' }],
      },
      {
        code: "const a = 'tw:hover:bg-brand-100';",
        errors: [{ messageId: 'rawPalette' }],
      },
      {
        code: "const a = 'tw:border-gray-blue-200 tw:p-2';",
        errors: [{ messageId: 'rawPalette' }],
      },
      {
        code: 'const a = `tw:bg-blue-50 ${x}`;',
        errors: [{ messageId: 'rawPalette' }],
      },
      // Non-utility family (no utility- ramp) — still flagged, report-only.
      {
        code: "const a = 'tw:bg-cyan-50 tw:text-teal-600';",
        errors: [{ messageId: 'rawPalette' }],
      },
      // Opacity modifier must not evade detection.
      {
        code: "const a = 'tw:bg-brand-900/20';",
        errors: [{ messageId: 'rawPalette' }],
      },
    ],
  }
);
