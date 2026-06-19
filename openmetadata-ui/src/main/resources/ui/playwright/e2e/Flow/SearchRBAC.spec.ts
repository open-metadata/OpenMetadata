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
import test, { APIRequestContext } from '@playwright/test';
import { searchRBACEntities } from '../../constant/searchRBAC';
import { PolicyClass } from '../../support/access-control/PoliciesClass';
import { RolesClass } from '../../support/access-control/RolesClass';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { uuid } from '../../utils/common';
import {
  enableDisableSearchRBAC,
  exploreShouldShowEntity,
  searchForEntityShouldWork,
  searchForEntityShouldWorkShowNoResult,
} from '../../utils/searchRBAC';

for (const entity of searchRBACEntities) {
  const entityObj = new entity.class();

  test.describe(entity.name, () => {
    const user1 = new UserClass();
    const user2 = new UserClass();
    const policy1 = new PolicyClass();
    const policy2 = new PolicyClass();
    const role1 = new RolesClass();
    const role2 = new RolesClass();

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await entityObj.create(apiContext);

      await enableDisableSearchRBAC(apiContext, true);

      const promises = [user1.create(apiContext), user2.create(apiContext)];

      await Promise.all(promises);

      const policy1Response = await policy1.create(apiContext, [
        {
          name: `pw-permission-rule-${uuid()}`,
          resources: [entity.resource],
          operations: ['ViewBasic'],
          effect: 'allow',
        },
      ]);
      const policy2Response = await policy2.create(apiContext, [
        {
          name: `pw-permission-rule-${uuid()}`,
          resources: [entity.resource],
          operations: ['All'],
          effect: 'deny',
        },
      ]);

      const role1Response = await role1.create(apiContext, [
        policy1Response.fullyQualifiedName,
      ]);
      const role2Response = await role2.create(apiContext, [
        policy2Response.fullyQualifiedName,
      ]);

      await user1.patch({
        apiContext,
        patchData: [
          {
            op: 'replace',
            path: '/roles',
            value: [
              {
                id: role1Response.id,
                type: 'role',
                name: role1Response.name,
              },
            ],
          },
        ],
      });
      await user2.patch({
        apiContext,
        patchData: [
          {
            op: 'replace',
            path: '/roles',
            value: [
              {
                id: role2Response.id,
                type: 'role',
                name: role2Response.name,
              },
            ],
          },
        ],
      });
      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await enableDisableSearchRBAC(apiContext, false);

      await afterAction();
    });

    test(`User with permission`, async ({ browser }) => {
      const userWithPermissionPage = await browser.newPage();

      await user1.login(userWithPermissionPage);

      await searchForEntityShouldWork(
        entityObj.entityResponseData?.fullyQualifiedName ?? '',
        entityObj.entityResponseData?.displayName ?? '',
        userWithPermissionPage
      );
    });

    test(`User without permission`, async ({ browser }) => {
      const userWithoutPermissionPage = await browser.newPage();

      await user2.login(userWithoutPermissionPage);

      await searchForEntityShouldWorkShowNoResult(
        entityObj.entityResponseData?.fullyQualifiedName ?? '',
        entityObj.entityResponseData?.displayName ?? '',
        userWithoutPermissionPage
      );
    });
  });
}

// unskip test once the backend issue get fixed #3289
test.describe.skip(`Table Column`, () => {
  const table = new TableClass();
  const user1 = new UserClass();
  const user2 = new UserClass();
  const policy1 = new PolicyClass();
  const policy2 = new PolicyClass();
  const role1 = new RolesClass();
  const role2 = new RolesClass();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await table.create(apiContext);

    const promises = [user1.create(apiContext), user2.create(apiContext)];

    await Promise.all(promises);

    const policy1Response = await policy1.create(apiContext, [
      {
        name: `pw-permission-rule-${uuid()}`,
        resources: ['table'],
        operations: ['ViewBasic'],
        effect: 'allow',
      },
    ]);
    const policy2Response = await policy2.create(apiContext, [
      {
        name: `pw-permission-rule-${uuid()}`,
        resources: ['table'],
        operations: ['All'],
        effect: 'deny',
      },
    ]);

    const role1Response = await role1.create(apiContext, [
      policy1Response.fullyQualifiedName,
    ]);
    const role2Response = await role2.create(apiContext, [
      policy2Response.fullyQualifiedName,
    ]);

    await user1.patch({
      apiContext,
      patchData: [
        {
          op: 'replace',
          path: '/roles',
          value: [
            {
              id: role1Response.id,
              type: 'role',
              name: role1Response.name,
            },
          ],
        },
      ],
    });
    await user2.patch({
      apiContext,
      patchData: [
        {
          op: 'replace',
          path: '/roles',
          value: [
            {
              id: role2Response.id,
              type: 'role',
              name: role2Response.name,
            },
          ],
        },
      ],
    });
    await afterAction();
  });

  test(`User with permission`, async ({ browser }) => {
    const userWithPermissionPage = await browser.newPage();
    const column = table.entityResponseData?.columns?.[0];

    await user1.login(userWithPermissionPage);

    await searchForEntityShouldWork(
      column.fullyQualifiedName ?? '',
      column.displayName ?? '',
      userWithPermissionPage
    );
  });

  test(`User without permission`, async ({ browser }) => {
    const userWithoutPermissionPage = await browser.newPage();
    const column = table.entityResponseData?.columns?.[0];

    await user2.login(userWithoutPermissionPage);

    await searchForEntityShouldWorkShowNoResult(
      column.fullyQualifiedName ?? '',
      column.displayName ?? '',
      userWithoutPermissionPage
    );
  });
});

// Browse/Explore RBAC: with access control on, the Explore page must only show
// each user the asset types their policies permit — no cross-user/-type leakage.
test.describe('Explore browse respects search RBAC across users', () => {
  const table = new TableClass();
  const dashboard = new DashboardClass();
  const userAll = new UserClass();
  const userTableOnly = new UserClass();
  const userDashboardOnly = new UserClass();
  const userDenied = new UserClass();
  const policyAll = new PolicyClass();
  const policyTable = new PolicyClass();
  const policyDashboard = new PolicyClass();
  const policyDeny = new PolicyClass();
  const roleAll = new RolesClass();
  const roleTable = new RolesClass();
  const roleDashboard = new RolesClass();
  const roleDeny = new RolesClass();

  const allowView = (resources: string[]) => ({
    name: `pw-rbac-allow-${uuid()}`,
    resources,
    operations: ['ViewBasic'],
    effect: 'allow' as const,
  });
  const denyAll = (resources: string[]) => ({
    name: `pw-rbac-deny-${uuid()}`,
    resources,
    operations: ['All'],
    effect: 'deny' as const,
  });

  const assignRole = (
    apiContext: APIRequestContext,
    user: UserClass,
    role: { id: string; name: string }
  ) =>
    user.patch({
      apiContext,
      patchData: [
        {
          op: 'replace',
          path: '/roles',
          value: [{ id: role.id, type: 'role', name: role.name }],
        },
      ],
    });

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await table.create(apiContext);
    await dashboard.create(apiContext);
    await enableDisableSearchRBAC(apiContext, true);

    await Promise.all([
      userAll.create(apiContext),
      userTableOnly.create(apiContext),
      userDashboardOnly.create(apiContext),
      userDenied.create(apiContext),
    ]);

    const [pAll, pTable, pDashboard, pDeny] = await Promise.all([
      policyAll.create(apiContext, [allowView(['table', 'dashboard'])]),
      policyTable.create(apiContext, [allowView(['table'])]),
      policyDashboard.create(apiContext, [allowView(['dashboard'])]),
      policyDeny.create(apiContext, [denyAll(['table', 'dashboard'])]),
    ]);

    const [rAll, rTable, rDashboard, rDeny] = await Promise.all([
      roleAll.create(apiContext, [pAll.fullyQualifiedName]),
      roleTable.create(apiContext, [pTable.fullyQualifiedName]),
      roleDashboard.create(apiContext, [pDashboard.fullyQualifiedName]),
      roleDeny.create(apiContext, [pDeny.fullyQualifiedName]),
    ]);

    await Promise.all([
      assignRole(apiContext, userAll, rAll),
      assignRole(apiContext, userTableOnly, rTable),
      assignRole(apiContext, userDashboardOnly, rDashboard),
      assignRole(apiContext, userDenied, rDeny),
    ]);

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await enableDisableSearchRBAC(apiContext, false);
    await Promise.all([
      table.delete(apiContext),
      dashboard.delete(apiContext),
      userAll.delete(apiContext),
      userTableOnly.delete(apiContext),
      userDashboardOnly.delete(apiContext),
      userDenied.delete(apiContext),
    ]);

    await afterAction();
  });

  const tableFqn = () => table.entityResponseData?.fullyQualifiedName ?? '';
  const tableName = () => table.entityResponseData?.displayName ?? '';
  const dashboardFqn = () =>
    dashboard.entityResponseData?.fullyQualifiedName ?? '';
  const dashboardName = () => dashboard.entityResponseData?.displayName ?? '';

  test('a user permitted on all asset types browses both', async ({
    browser,
  }) => {
    test.slow();
    const page = await browser.newPage();
    await userAll.login(page);

    await exploreShouldShowEntity(page, tableFqn(), tableName(), true);
    await exploreShouldShowEntity(page, dashboardFqn(), dashboardName(), true);

    await page.close();
  });

  test('a table-scoped user sees tables but never dashboards', async ({
    browser,
  }) => {
    test.slow();
    const page = await browser.newPage();
    await userTableOnly.login(page);

    await exploreShouldShowEntity(page, tableFqn(), tableName(), true);
    await exploreShouldShowEntity(page, dashboardFqn(), dashboardName(), false);

    await page.close();
  });

  test('a dashboard-scoped user sees dashboards but never tables', async ({
    browser,
  }) => {
    test.slow();
    const page = await browser.newPage();
    await userDashboardOnly.login(page);

    await exploreShouldShowEntity(page, dashboardFqn(), dashboardName(), true);
    await exploreShouldShowEntity(page, tableFqn(), tableName(), false);

    await page.close();
  });

  test('a fully denied user sees neither asset type when browsing', async ({
    browser,
  }) => {
    test.slow();
    const page = await browser.newPage();
    await userDenied.login(page);

    await exploreShouldShowEntity(page, tableFqn(), tableName(), false);
    await exploreShouldShowEntity(page, dashboardFqn(), dashboardName(), false);

    await page.close();
  });
});
