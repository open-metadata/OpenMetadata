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
import assert from 'node:assert/strict';
import test, { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';

RuleTester.describe = describe;
RuleTester.it = it;

const playwrightPlugin = (await import('./openmetadata-playwright.mjs'))
  .default;

test('exports the aggregation wait helper rule', () => {
  assert.ok(playwrightPlugin.rules['require-aggregation-wait-helper']);
});

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    parser: tseslint.parser,
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
    sourceType: 'module',
  },
});

ruleTester.run(
  'require-aggregation-wait-helper',
  playwrightPlugin.rules['require-aggregation-wait-helper'],
  {
    valid: [
      {
        code: "const res = waitForAggregation(page, { field: 'domains.displayName.keyword', value: 'sales' });",
        filename: 'playwright/e2e/Flow/Example.spec.ts',
      },
      {
        code: "const res = page.waitForResponse('/api/v1/search/query?*deleted=true*');",
        filename: 'playwright/e2e/Flow/Example.spec.ts',
      },
      {
        code: "const res = page.waitForResponse((response) => response.url().includes('/api/v1/tables'));",
        filename: 'playwright/e2e/Flow/Example.spec.ts',
      },
      {
        // The helper itself owns the only raw wait on the endpoint.
        code: "const res = page.waitForResponse((response) => response.url().includes('/api/v1/search/aggregate'));",
        filename: 'playwright/utils/searchAggregation.ts',
      },
      {
        code: `
          const queryUrl = '/api/v1/search/query?*index=dataAsset*';
          const res = page.waitForResponse(queryUrl);
        `,
        filename: 'playwright/e2e/Flow/Example.spec.ts',
      },
    ],
    invalid: [
      {
        code: "const res = page.waitForResponse('/api/v1/search/aggregate?*');",
        errors: [{ messageId: 'rawAggregationWait' }],
        filename: 'playwright/e2e/Flow/Example.spec.ts',
      },
      {
        code: 'const res = page.waitForResponse(`/api/v1/search/aggregate?index=dataAsset&field=${field}*`);',
        errors: [{ messageId: 'rawAggregationWait' }],
        filename: 'playwright/e2e/Flow/Example.spec.ts',
      },
      {
        code: "const res = page.waitForResponse((response) => response.url().includes('/api/v1/search/aggregate') && response.url().includes(field));",
        errors: [{ messageId: 'rawAggregationWait' }],
        filename: 'playwright/utils/glossary.ts',
      },
      {
        // Hoisting the URL to a local const is the realistic accidental evasion.
        code: `
          const aggregateUrl = '/api/v1/search/aggregate?*';
          const res = page.waitForResponse(aggregateUrl);
        `,
        errors: [{ messageId: 'rawAggregationWait' }],
        filename: 'playwright/e2e/Flow/Example.spec.ts',
      },
      {
        code: `
          const aggregateUrl = \`/api/v1/search/aggregate?index=dataAsset&field=\${field}*\`;
          const res = page.waitForResponse(aggregateUrl);
        `,
        errors: [{ messageId: 'rawAggregationWait' }],
        filename: 'playwright/utils/explore.ts',
      },
      {
        // Declared at module scope, used inside a test callback.
        code: `
          const aggregateUrl = '/api/v1/search/aggregate?*';
          test('example', async ({ page }) => {
            const res = page.waitForResponse(aggregateUrl);
          });
        `,
        errors: [{ messageId: 'rawAggregationWait' }],
        filename: 'playwright/e2e/Flow/Example.spec.ts',
      },
      {
        // Assigned after declaration, so the variable has no initialiser.
        code: `
          let aggregateUrl;
          aggregateUrl = '/api/v1/search/aggregate?*';
          const res = page.waitForResponse(aggregateUrl);
        `,
        errors: [{ messageId: 'rawAggregationWait' }],
        filename: 'playwright/e2e/Flow/Example.spec.ts',
      },
      {
        // Path split across concatenated literals.
        code: "const res = page.waitForResponse('/api/v1/search/' + 'aggregate?*');",
        errors: [{ messageId: 'rawAggregationWait' }],
        filename: 'playwright/e2e/Flow/Example.spec.ts',
      },
    ],
  }
);
