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
import { Page, test as base } from '@playwright/test';
import { Operation } from 'fast-json-patch';
import { PolicyClass } from '../../support/access-control/PoliciesClass';
import { RolesClass } from '../../support/access-control/RolesClass';
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { getApiContext, redirectToHomePage, uuid } from '../../utils/common';
import { validateViewPermissions } from '../../utils/permission';

const policy = new PolicyClass();
const policy2 = new PolicyClass();
const role = new RolesClass();
const role2 = new RolesClass();
const user = new UserClass();
const table = new TableClass();

const viewPermissionsData = [
  {
    title: 'ViewBasic, ViewSampleData & ViewQueries permission',
    data: {
      patch: [
        { op: 'add', path: '/rules/0/operations/1', value: 'ViewSampleData' },
        { op: 'add', path: '/rules/0/operations/2', value: 'ViewQueries' },
      ],
      permission: { viewSampleData: true, viewQueries: true },
    },
  },
  {
    title: 'ViewBasic, ViewSampleData, ViewQueries & ViewTests permission',
    data: {
      patch: [{ op: 'add', path: '/rules/0/operations/3', value: 'ViewTests' }],
      permission: {
        viewSampleData: true,
        viewQueries: true,
        viewTests: true,
      },
    },
  },
  {
    title: 'EditDisplayName permission',
    data: {
      patch: [
        { op: 'add', path: '/rules/0/operations/4', value: 'EditDisplayName' },
      ],
      permission: {
        viewSampleData: true,
        viewQueries: true,
        viewTests: true,
        editDisplayName: true,
      },
    },
  },
];

const test = base.extend<{
  adminPage: Page;
  userPage: Page;
}>({
  adminPage: async ({ browser }, use) => {
    const { page } = await performAdminLogin(browser);
    await use(page);
    await page.close();
  },
  userPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await user.login(page);
    await use(page);
    await page.close();
  },
});

test.beforeAll(async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await user.create(apiContext);
  const policyResponse = await policy.create(apiContext, [
    {
      name: `pw-permission-rule-${uuid()}`,
      resources: ['All'],
      operations: ['ViewBasic'],
      effect: 'allow',
    },
  ]);
  const policyResponse2 = await policy2.create(apiContext, [
    {
      name: `pw-permission-rule-${uuid()}`,
      resources: ['All'],
      operations: ['EditOwners'],
      effect: 'deny',
    },
  ]);
  await table.create(apiContext);
  await table.createTestCase(apiContext);
  await table.createQuery(apiContext);
  const roleResponse = await role.create(apiContext, [
    policyResponse.fullyQualifiedName,
  ]);
  const roleResponse2 = await role2.create(apiContext, [
    policyResponse2.fullyQualifiedName,
  ]);
  await user.patch({
    apiContext,
    patchData: [
      {
        op: 'replace',
        path: '/roles',
        value: [
          {
            id: roleResponse.id,
            type: 'role',
            name: roleResponse.name,
          },
          {
            id: roleResponse2.id,
            type: 'role',
            name: roleResponse2.name,
          },
        ],
      },
    ],
  });
  await afterAction();
});

test('Permissions', async ({ userPage, adminPage }) => {
  test.slow();

  await redirectToHomePage(userPage);

  await test.step('ViewBasic permission', async () => {
    await table.visitEntityPage(userPage);
    await userPage.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });
    await validateViewPermissions(userPage);
  });

  for (const viewPermission of viewPermissionsData) {
    await test.step(viewPermission.title, async () => {
      const { apiContext, afterAction } = await getApiContext(adminPage);
      await policy.patch(apiContext, viewPermission.data.patch as Operation[]);
      await afterAction();
      await redirectToHomePage(userPage);
      await userPage.reload();
      const permissionResponse = userPage.waitForResponse(
        `/api/v1/permissions/table/name/${encodeURIComponent(
          table.entityResponseData?.['fullyQualifiedName']
        )}`
      );
      await table.visitEntityPage(userPage);
      await permissionResponse;
      await userPage.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });
      await validateViewPermissions(userPage, viewPermission.data.permission);
    });
  }

  await test.step('EditQuery permission', async () => {
    const { apiContext, afterAction } = await getApiContext(adminPage);
    await policy.patch(apiContext, [
      {
        op: 'add',
        path: '/rules/1',
        value: {
          name: `pw-edit-query-rule-${uuid()}`,
          resources: ['query'],
          operations: ['ViewAll', 'EditAll'],
          effect: 'allow',
        },
      },
      { op: 'add', path: '/rules/0/operations/5', value: 'EditQueries' },
    ]);
    await afterAction();
    await redirectToHomePage(userPage);
    await userPage.reload();
    const permissionResponse = userPage.waitForResponse(
      `/api/v1/permissions/table/name/${encodeURIComponent(
        table.entityResponseData?.['fullyQualifiedName']
      )}`
    );
    await table.visitEntityPage(userPage);
    await permissionResponse;
    await userPage.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });
    const queryListResponse = userPage.waitForResponse(
      '/api/v1/search/query?q=*&index=query_search_index*'
    );
    await userPage.click('[data-testid="table_queries"]');
    await queryListResponse;
    await userPage.click('[data-testid="query-btn"]');
    await userPage.click('[data-menu-id*="edit-query"]');
    await userPage.locator('.CodeMirror-line').click();
    await userPage.keyboard.type('updated');
    const saveQueryResponse = userPage.waitForResponse('/api/v1/queries/*');
    await userPage.click('[data-testid="save-query-btn"]');
    await saveQueryResponse;
  });

  await test.step('EditTest permission', async () => {
    const testCaseName = table.testCasesResponseData[0]?.['name'];
    const { apiContext, afterAction } = await getApiContext(adminPage);
    await policy.patch(apiContext, [
      { op: 'add', path: '/rules/1/operations/6', value: 'EditTests' },
      {
        op: 'add',
        path: '/rules/2',
        value: {
          name: `cy-edit-test-case-rule-${uuid()}`,
          resources: ['testCase'],
          operations: ['ViewAll', 'EditAll'],
          effect: 'allow',
        },
      },
    ]);
    await afterAction();
    await redirectToHomePage(userPage);
    await userPage.reload();
    const permissionResponse = userPage.waitForResponse(
      `/api/v1/permissions/table/name/${encodeURIComponent(
        table.entityResponseData?.['fullyQualifiedName']
      )}`
    );
    await table.visitEntityPage(userPage);
    await permissionResponse;
    await userPage.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    await userPage.getByTestId('profiler').click();
    const testCaseResponse = userPage.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/dataQuality/testCases/') &&
        response.request().method() === 'GET'
    );
    await userPage
      .getByTestId('profiler-tab-left-panel')
      .getByText('Data Quality')
      .click();
    await testCaseResponse;

    await userPage.getByTestId(`edit-${testCaseName}`).click();
    await userPage.locator('#tableTestForm_displayName').clear();
    await userPage.fill('#tableTestForm_displayName', 'Update_display_name');
    const saveTestResponse = userPage.waitForResponse(
      '/api/v1/dataQuality/testCases/*'
    );
    await userPage.locator('.ant-modal-footer').getByText('Submit').click();
    await saveTestResponse;
  });
});
