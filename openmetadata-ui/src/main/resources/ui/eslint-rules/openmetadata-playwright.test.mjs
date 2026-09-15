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
import { RuleTester } from 'eslint';
import assert from 'node:assert/strict';
import test, { describe, it } from 'node:test';
import tseslint from 'typescript-eslint';

RuleTester.describe = describe;
RuleTester.it = it;

const playwrightPlugin = (await import('./openmetadata-playwright.mjs'))
  .default;

test('exports the aggregation wait helper rule', () => {
  assert.ok(playwrightPlugin.rules['require-aggregation-wait-helper']);
});

test('exports the role page fixture rule', () => {
  assert.ok(playwrightPlugin.rules['prefer-role-page-fixture']);
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

ruleTester.run(
  'prefer-role-page-fixture',
  playwrightPlugin.rules['prefer-role-page-fixture'],
  {
    valid: [
      {
        // Taking a role page is the point of the rule.
        code: "test('x', async ({ dataConsumerPage }) => { await dataConsumerPage.goto('/'); });",
        filename: 'playwright/e2e/Flow/Example.spec.ts',
      },
      {
        // Creating a user as *test data* — an owner, a reviewer, an assignee —
        // has nothing to do with authenticating as one.
        code: 'const owner = new UserClass(); await owner.create(apiContext);',
        filename: 'playwright/e2e/Flow/Example.spec.ts',
      },
      {
        // auth.setup.ts is what mints the storage states the fixtures reuse.
        code: 'await dataConsumer.login(dataConsumerPage);',
        filename: 'playwright/e2e/auth.setup.ts',
      },
      {
        // The fixture modules and the login helper itself are the implementation.
        code: 'await user.login(page);',
        filename: 'playwright/utils/user.ts',
      },
      {
        // performUserLogin signs in through the API and owns the page, the
        // context and their teardown — it is a sanctioned path, not a
        // hand-rolled login.
        code: 'const { page, afterAction } = await performUserLogin(browser, user);',
        filename: 'playwright/e2e/Flow/Example.spec.ts',
      },
      {
        // The migrated shape.
        code: 'await user.signIn(page);',
        filename: 'playwright/e2e/Flow/Example.spec.ts',
      },
      {
        // The isolated-user fixtures are the sanctioned bespoke-account path,
        // so they are the one place that legitimately drives the sign-in form.
        code: 'await user.login(loginPage);',
        filename: 'playwright/support/fixtures/isolatedUser.ts',
      },
      {
        // Taking the sanctioned bespoke-account fixture.
        code: "test('x', async ({ isolatedUserPage }) => { await isolatedUserPage.goto('/'); });",
        filename: 'playwright/e2e/Flow/Example.spec.ts',
      },
      {
        // A method that merely shares the name on an unrelated object.
        code: "await ssoProvider.login({ user: 'x' });",
        filename: 'playwright/e2e/Flow/Example.spec.ts',
      },
    ],
    invalid: [
      {
        code: 'await regularUser.login(page);',
        errors: [{ messageId: 'preferRolePageFixture' }],
        filename: 'playwright/e2e/Pages/Example.spec.ts',
      },
      {
        code: 'await user.login(await browser.newPage());',
        errors: [{ messageId: 'preferRolePageFixture' }],
        filename: 'playwright/e2e/Pages/Example.spec.ts',
      },
      {
        // Trailing options do not make it any less a bespoke login.
        code: 'await user.login(page, undefined, undefined, { skipTour: true });',
        errors: [{ messageId: 'preferRolePageFixture' }],
        filename: 'playwright/e2e/Flow/Example.spec.ts',
      },
    ],
  }
);
