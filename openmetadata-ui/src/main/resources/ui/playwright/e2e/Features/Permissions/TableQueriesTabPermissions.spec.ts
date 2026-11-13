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
import { Page } from '@playwright/test';
import { DATA_CONSUMER_RULES } from '../../../constant/permission';
import {
  PolicyClass,
  PolicyRulesType,
} from '../../../support/access-control/PoliciesClass';
import { RolesClass } from '../../../support/access-control/RolesClass';
import { TableClass } from '../../../support/entity/TableClass';
import { expect, test } from '../../../support/fixtures/isolatedUser';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { getWorkerAdminAPIContext, uuid } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';

type ScenarioName =
  | 'queryDenied'
  | 'queryViewBasicDenied'
  | 'queryViewConditional'
  | 'tableViewQueriesDenied'
  | 'allowed';

const scenarioRules: Record<ScenarioName, PolicyRulesType[]> = {
  queryDenied: [
    ...DATA_CONSUMER_RULES,
    {
      name: `pw-deny-query-view-${uuid()}`,
      resources: ['query'],
      operations: ['ViewAll', 'ViewBasic'],
      effect: 'deny',
    },
  ],
  queryViewBasicDenied: [
    ...DATA_CONSUMER_RULES,
    {
      name: `pw-deny-query-view-basic-${uuid()}`,
      resources: ['query'],
      operations: ['ViewBasic'],
      effect: 'deny',
    },
  ],
  queryViewConditional: [
    {
      name: `pw-allow-table-view-${uuid()}`,
      resources: ['table'],
      operations: ['ViewAll'],
      effect: 'allow',
    },
    {
      name: `pw-allow-query-view-if-owner-${uuid()}`,
      resources: ['query'],
      operations: ['ViewAll', 'ViewBasic'],
      effect: 'allow',
      condition: 'isOwner()',
    },
  ],
  tableViewQueriesDenied: [
    ...DATA_CONSUMER_RULES,
    {
      name: `pw-deny-table-view-queries-${uuid()}`,
      resources: ['table'],
      operations: ['ViewQueries'],
      effect: 'deny',
    },
  ],
  allowed: DATA_CONSUMER_RULES,
};

const queryText = `select id from pw_queries_tab_${uuid()}`;

// Created in beforeAll: under fullyParallel the hook can run more than once per worker.
let table: TableClass;
let scenarios: Record<ScenarioName, { policy: PolicyClass; role: RolesClass }>;

const isTableQueryCountRequest = (url: string) => {
  const { pathname, searchParams } = new URL(url);

  return (
    pathname === '/api/v1/queries' &&
    searchParams.get('entityId') === table.entityResponseData.id
  );
};

/**
 * Gives `user` only `role`, opens the table page and resolves once its tabs have rendered.
 * Returns the Query resource access the page was served and every query-count request it made.
 */
const openTableWithRole = async (
  page: Page,
  user: UserClass,
  role: RolesClass
) => {
  const apiContext = await getWorkerAdminAPIContext();
  await user.patch({
    apiContext,
    patchData: [
      {
        op: 'replace',
        path: '/roles',
        value: [
          {
            id: role.responseData.id,
            type: 'role',
            name: role.responseData.name,
          },
        ],
      },
    ],
  });

  const countRequests: string[] = [];
  page.on('request', (request) => {
    if (isTableQueryCountRequest(request.url())) {
      countRequests.push(request.url());
    }
  });

  const queryPermissionResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/v1/permissions/query'
  );
  await page.goto(
    `/table/${encodeURIComponent(
      table.entityResponseData.fullyQualifiedName ?? ''
    )}`
  );
  const queryPermission = await queryPermissionResponse;
  expect(queryPermission.status()).toBe(200);
  const { permissions } = (await queryPermission.json()) as {
    permissions: { operation: string; access: string }[];
  };

  await expect(page.getByTestId('sample_data')).toBeVisible();
  await waitForAllLoadersToDisappear(page);

  return {
    countRequests,
    queryAccess: Object.fromEntries(
      permissions.map(({ operation, access }) => [operation, access])
    ),
  };
};

test.describe(
  'Table Queries tab follows Query resource permissions',
  { tag: ['@Features', '@Governance'] },
  () => {
    test.beforeAll('Create table, query and roles', async ({ browser }) => {
      table = new TableClass();
      scenarios = {} as typeof scenarios;

      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table.create(apiContext);
      await table.createQuery(apiContext, queryText);

      for (const [name, rules] of Object.entries(scenarioRules)) {
        const policy = new PolicyClass();
        const role = new RolesClass();
        await policy.create(apiContext, rules);
        await role.create(apiContext, [policy.responseData.name]);
        scenarios[name as ScenarioName] = { policy, role };
      }

      await afterAction();
    });

    test.afterAll('Delete table, query and roles', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      for (const { policy, role } of Object.values(scenarios)) {
        await role.delete(apiContext);
        await policy.delete(apiContext);
      }

      await table.delete(apiContext);
      await afterAction();
    });

    test('hides the Queries tab and skips the count when Query view is denied', async ({
      freshUserPage: { page, user },
    }) => {
      test.slow();

      const { countRequests, queryAccess } = await openTableWithRole(
        page,
        user,
        scenarios.queryDenied.role
      );

      expect(queryAccess.ViewBasic).toBe('deny');
      await expect(page.getByTestId('schema')).toBeVisible();
      await expect(page.getByTestId('lineage')).toBeVisible();
      await expect(page.getByTestId('table_queries')).toHaveCount(0);
      expect(countRequests).toHaveLength(0);
    });

    test('hides the Queries tab when only Query ViewBasic is denied and ViewAll is allowed', async ({
      freshUserPage: { page, user },
    }) => {
      test.slow();

      const { countRequests, queryAccess } = await openTableWithRole(
        page,
        user,
        scenarios.queryViewBasicDenied.role
      );

      expect(queryAccess.ViewBasic).toBe('deny');
      expect(queryAccess.ViewAll).toBe('allow');
      await expect(page.getByTestId('schema')).toBeVisible();
      await expect(page.getByTestId('table_queries')).toHaveCount(0);
      expect(countRequests).toHaveLength(0);
    });

    test('keeps the Queries tab when Query view is only conditionally allowed', async ({
      freshUserPage: { page, user },
    }) => {
      test.slow();

      const { queryAccess } = await openTableWithRole(
        page,
        user,
        scenarios.queryViewConditional.role
      );

      expect(queryAccess.ViewBasic).toBe('conditionalAllow');
      await expect(page.getByTestId('table_queries')).toBeVisible();
    });

    test('keeps the Queries tab with a permission placeholder and no count when table ViewQueries is denied', async ({
      freshUserPage: { page, user },
    }) => {
      test.slow();

      const { countRequests } = await openTableWithRole(
        page,
        user,
        scenarios.tableViewQueriesDenied.role
      );

      const queriesTab = page.getByTestId('table_queries');
      await expect(queriesTab).toBeVisible();
      await queriesTab.click();

      await expect(
        page
          .getByTestId('permission-error-placeholder')
          .getByText(
            "You don't have necessary permissions. Please check with the admin to get the View Queries permission."
          )
      ).toBeVisible();
      expect(countRequests).toHaveLength(0);
    });

    test('shows the Queries tab with its count and query when Query view is allowed', async ({
      freshUserPage: { page, user },
    }) => {
      test.slow();

      const { countRequests } = await openTableWithRole(
        page,
        user,
        scenarios.allowed.role
      );

      const queriesTab = page.getByTestId('table_queries');
      await expect(queriesTab.getByTestId('count')).toHaveText('1');
      expect(countRequests).not.toHaveLength(0);

      await queriesTab.click();
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.getByTestId('query-card').filter({ hasText: queryText })
      ).toBeVisible();
    });
  }
);
