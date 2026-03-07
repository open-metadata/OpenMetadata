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
import test from '@playwright/test';
import { searchRBACEntities } from '../../constant/searchRBAC';
import { PolicyClass } from '../../support/access-control/PoliciesClass';
import { RolesClass } from '../../support/access-control/RolesClass';
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { uuid } from '../../utils/common';
import {
  enableDisableSearchRBAC,
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

test.describe(`Table Column`, () => {
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
