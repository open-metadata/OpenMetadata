/*
 *  Copyright 2024 Collate.
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
import { APIRequestContext, expect, Page } from '@playwright/test';
import {
  PolicyClass,
  PolicyRulesType,
} from '../../support/access-control/PoliciesClass';
import { RolesClass } from '../../support/access-control/RolesClass';
import { TableClass } from '../../support/entity/TableClass';
import { test as base } from '../../support/fixtures/base';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { okJson } from '../../utils/apiResponse';
import { uuid } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { validateViewPermissions } from '../../utils/permission';
import { waitForResponseWithStatus } from '../../utils/waitHelpers';

const viewPermissionsData = [
  {
    title: 'ViewBasic permission',
    operations: ['ViewBasic'],
    permission: {},
  },
  {
    title: 'ViewBasic, ViewSampleData & ViewQueries permission',
    operations: ['ViewBasic', 'ViewSampleData', 'ViewQueries'],
    permission: { viewSampleData: true, viewQueries: true },
  },
  {
    title: 'ViewBasic, ViewSampleData, ViewQueries & ViewTests permission',
    operations: ['ViewBasic', 'ViewSampleData', 'ViewQueries', 'ViewTests'],
    permission: { viewSampleData: true, viewQueries: true, viewTests: true },
  },
  {
    title: 'EditDisplayName permission',
    operations: [
      'ViewBasic',
      'ViewSampleData',
      'ViewQueries',
      'ViewTests',
      'EditDisplayName',
    ],
    permission: {
      viewSampleData: true,
      viewQueries: true,
      viewTests: true,
      editDisplayName: true,
    },
  },
];

const test = base.extend<{
  permissionFixture: {
    apiContext: APIRequestContext;
    table: TableClass;
    policy: PolicyClass;
    user: UserClass;
  };
  userPage: Page;
}>({
  permissionFixture: async ({ browser }, use) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const policy = new PolicyClass();
    const denyPolicy = new PolicyClass();
    const role = new RolesClass();
    const denyRole = new RolesClass();
    const user = new UserClass();
    const table = new TableClass();

    try {
      await user.create(apiContext);
      await policy.create(apiContext, [
        {
          name: `pw-permission-rule-${uuid()}`,
          resources: ['All'],
          operations: ['ViewBasic'],
          effect: 'allow',
        },
      ]);
      await denyPolicy.create(apiContext, [
        {
          name: `pw-deny-owner-rule-${uuid()}`,
          resources: ['All'],
          operations: ['EditOwners'],
          effect: 'deny',
        },
      ]);
      await role.create(apiContext, [policy.responseData.fullyQualifiedName!]);
      await denyRole.create(apiContext, [
        denyPolicy.responseData.fullyQualifiedName!,
      ]);
      await user.patch({
        apiContext,
        patchData: [
          {
            op: 'replace',
            path: '/roles',
            value: [role, denyRole].map(({ responseData }) => ({
              id: responseData.id,
              type: 'role',
              name: responseData.name,
            })),
          },
        ],
      });
      await table.create(apiContext);
      await table.createTestCase(apiContext);
      await table.createQuery(apiContext);
      await use({ apiContext, table, policy, user });
    } finally {
      if (user.responseData.id) {
        await user.delete(apiContext);
      }
      if (role.responseData.id) {
        await role.delete(apiContext);
      }
      if (denyRole.responseData.id) {
        await denyRole.delete(apiContext);
      }
      if (policy.responseData.id) {
        await policy.delete(apiContext);
      }
      if (denyPolicy.responseData.id) {
        await denyPolicy.delete(apiContext);
      }
      if (table.entityResponseData.id) {
        await table.delete(apiContext);
      }
      await afterAction();
    }
  },
  userPage: async ({ page, permissionFixture }, use) => {
    await permissionFixture.user.login(page);
    await use(page);
  },
});

const updatePermissionsAndVisit = async (
  page: Page,
  fixture: {
    apiContext: APIRequestContext;
    table: TableClass;
    policy: PolicyClass;
  },
  operations: string[],
  additionalRules: PolicyRulesType[] = []
) => {
  await fixture.policy.patch(fixture.apiContext, [
    { op: 'replace', path: '/rules/0/operations', value: operations },
    ...additionalRules.map((rule) => ({
      op: 'add' as const,
      path: '/rules/-',
      value: rule,
    })),
  ]);
  const permissionResponse = waitForResponseWithStatus(
    page,
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname ===
        `/api/v1/permissions/table/name/${encodeURIComponent(
          fixture.table.entityResponseData.fullyQualifiedName
        )}`,
    200
  );
  // Direct navigation reloads permissions for the already authenticated user.
  await fixture.table.visitEntityPage(page);
  await permissionResponse;
};

for (const scenario of viewPermissionsData) {
  test(scenario.title, async ({ userPage, permissionFixture }) => {
    await updatePermissionsAndVisit(
      userPage,
      permissionFixture,
      scenario.operations
    );
    await validateViewPermissions(userPage, scenario.permission);
  });
}

test('EditQuery permission', async ({ userPage, permissionFixture }) => {
  const { apiContext, table } = permissionFixture;
  await updatePermissionsAndVisit(
    userPage,
    permissionFixture,
    ['ViewBasic', 'ViewQueries', 'EditQueries'],
    [
      {
        name: `pw-edit-query-rule-${uuid()}`,
        resources: ['query'],
        operations: ['ViewAll', 'EditAll'],
        effect: 'allow',
      },
    ]
  );
  const queryListResponse = waitForResponseWithStatus(
    userPage,
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname === '/api/v1/search/query' &&
      new URL(response.url()).searchParams.get('index') === 'query' &&
      Number(new URL(response.url()).searchParams.get('size')) > 0 &&
      (new URL(response.url()).searchParams.get('query_filter') ?? '').includes(
        table.entityResponseData.id
      ),
    200
  );
  await userPage.getByTestId('table_queries').click();
  await queryListResponse;
  await userPage.getByTestId('query-btn').click();
  await userPage.locator('[data-menu-id*="edit-query"]').click();
  await userPage.locator('.CodeMirror-line').click();
  await userPage.keyboard.type('updated');
  const queryId = table.queryResponseData[0].id;
  const saveQueryResponse = waitForResponseWithStatus(
    userPage,
    (response) =>
      response.request().method() === 'PATCH' &&
      new URL(response.url()).pathname === `/api/v1/queries/${queryId}`,
    200
  );
  await userPage.getByTestId('save-query-btn').click();
  const savedQuery = await (await saveQueryResponse).json();
  expect(savedQuery.query).toContain('updated');
  const persistedQuery = await okJson(
    await apiContext.get(`/api/v1/queries/${queryId}`),
    'Read edited query'
  );
  expect(persistedQuery.query).toBe(savedQuery.query);
});

test('EditTest permission', async ({ userPage, permissionFixture }) => {
  const { apiContext, table } = permissionFixture;
  const testCase = table.testCasesResponseData[0];
  await updatePermissionsAndVisit(
    userPage,
    permissionFixture,
    ['ViewBasic', 'ViewTests', 'EditTests'],
    [
      {
        name: `pw-edit-test-case-rule-${uuid()}`,
        resources: ['testCase'],
        operations: ['ViewAll', 'EditAll'],
        effect: 'allow',
      },
    ]
  );
  await userPage.getByTestId('profiler').click();
  await waitForAllLoadersToDisappear(userPage);
  const testCaseResponse = waitForResponseWithStatus(
    userPage,
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname ===
        '/api/v1/dataQuality/testCases/search/list',
    200
  );
  await userPage.getByRole('tab', { name: 'Data Quality' }).click();
  await testCaseResponse;
  await userPage.getByTestId(`action-dropdown-${testCase.name}`).click();
  const testDefinitionResponse = waitForResponseWithStatus(
    userPage,
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname.startsWith(
        '/api/v1/dataQuality/testDefinitions/'
      ),
    200
  );
  await userPage.getByTestId(`edit-${testCase.name}`).click();
  await testDefinitionResponse;
  await userPage
    .locator('[id="root\\/displayName"]')
    .fill('Update_display_name');
  const saveTestResponse = waitForResponseWithStatus(
    userPage,
    (response) =>
      response.request().method() === 'PATCH' &&
      new URL(response.url()).pathname ===
        `/api/v1/dataQuality/testCases/${testCase.id}`,
    200
  );
  await userPage.getByTestId('create-btn').click();
  await saveTestResponse;
  const persistedTest = await okJson(
    await apiContext.get(`/api/v1/dataQuality/testCases/${testCase.id}`),
    'Read edited test case'
  );
  expect(persistedTest.displayName).toBe('Update_display_name');
});
