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

import { expect, Page, test as base } from '@playwright/test';
import { PolicyClass } from '../../../support/access-control/PoliciesClass';
import { RolesClass } from '../../../support/access-control/RolesClass';
import { EntityClass } from '../../../support/entity/EntityClass';
import { TableClass } from '../../../support/entity/TableClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { getApiContext } from '../../../utils/common';
import {
  ALL_OPERATIONS,
  entityConfig,
  runCommonPermissionTests,
  runEntitySpecificPermissionTests,
} from '../../../utils/entityPermissionUtils';
import {
  assignRoleToUser,
  cleanupPermissions,
  initializePermissions,
  setupUserWithPolicy,
} from '../../../utils/permission';

const EDIT_ALL_ALLOW_SPECIFIC_DENY_RULES = [
  {
    name: 'ViewAll-Rule',
    resources: ['All'],
    operations: ['ViewAll'],
    effect: 'allow',
  },
  {
    name: 'EditAll-Allow-Rule',
    resources: ['All'],
    operations: ['EditAll'],
    effect: 'allow',
  },
  {
    name: 'EditTier-Deny-Rule',
    resources: ['All'],
    operations: ['EditTier'],
    effect: 'deny',
  },
  {
    name: 'EditOwners-Deny-Rule',
    resources: ['All'],
    operations: ['EditOwners'],
    effect: 'deny',
  },
  {
    name: 'EditCertification-Deny-Rule',
    resources: ['All'],
    operations: ['EditCertification'],
    effect: 'deny',
  },
];

const SPECIFIC_ALLOW_EDIT_ALL_DENY_RULES = [
  {
    name: 'ViewAll-Rule',
    resources: ['All'],
    operations: ['ViewAll'],
    effect: 'allow',
  },
  {
    name: 'EditAll-Deny-Rule',
    resources: ['All'],
    operations: ['EditAll'],
    effect: 'deny',
  },
  {
    name: 'EditTier-Allow-Rule',
    resources: ['All'],
    operations: ['EditTier'],
    effect: 'allow',
  },
  {
    name: 'EditOwners-Allow-Rule',
    resources: ['All'],
    operations: ['EditOwners'],
    effect: 'allow',
  },
  {
    name: 'EditCertification-Allow-Rule',
    resources: ['All'],
    operations: ['EditCertification'],
    effect: 'allow',
  },
];

const adminUser = new UserClass();
const testUser = new UserClass();

const test = base.extend<{
  page: Page;
  testUserPage: Page;
}>({
  page: async ({ browser }, use) => {
    const adminPage = await browser.newPage();
    try {
      await adminUser.login(adminPage);
      await use(adminPage);
    } finally {
      await adminPage.close();
    }
  },
  testUserPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    try {
      await testUser.login(page);
      await use(page);
    } finally {
      await page.close();
    }
  },
});

test.beforeAll('Setup pre-requests', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await adminUser.create(apiContext);
  await adminUser.setAdminRole(apiContext);
  await testUser.create(apiContext);
  await afterAction();
});

test.afterAll('Cleanup pre-requests', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await adminUser.delete(apiContext);
  await testUser.delete(apiContext);
  await afterAction();
});

let editAllUser: UserClass;
let editAllPolicy: PolicyClass;
let editAllRole: RolesClass;

let specificEditsUser: UserClass;
let specificEditsPolicy: PolicyClass;
let specificEditsRole: RolesClass;

let headerPermTable: TableClass;

const headerPermTest = base.extend<{
  editAllPage: Page;
  specificEditsPage: Page;
  denyAllPage: Page;
}>({
  editAllPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    try {
      await editAllUser.login(page);
      await use(page);
    } finally {
      await page.close();
    }
  },
  specificEditsPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    try {
      await specificEditsUser.login(page);
      await use(page);
    } finally {
      await page.close();
    }
  },
});

headerPermTest.describe(
  'DataAsset Header – EditTier / EditOwners / EditCertification permissions',
  () => {
    headerPermTest.beforeAll(
      'Setup users, roles, and table',
      async ({ browser }) => {
        editAllUser = new UserClass();
        editAllPolicy = new PolicyClass();
        editAllRole = new RolesClass();

        specificEditsUser = new UserClass();
        specificEditsPolicy = new PolicyClass();
        specificEditsRole = new RolesClass();

        headerPermTable = new TableClass();

        const { apiContext, afterAction } = await performAdminLogin(browser);

        await headerPermTable.create(apiContext);

        await setupUserWithPolicy(
          apiContext,
          editAllUser,
          editAllPolicy,
          editAllRole,
          EDIT_ALL_ALLOW_SPECIFIC_DENY_RULES
        );
        await setupUserWithPolicy(
          apiContext,
          specificEditsUser,
          specificEditsPolicy,
          specificEditsRole,
          SPECIFIC_ALLOW_EDIT_ALL_DENY_RULES
        );
        await afterAction();
      }
    );

    headerPermTest(
      'EditAll allowed but EditTier, EditOwners, EditCertification denied – edit buttons not visible',
      async ({ editAllPage }) => {
        await headerPermTable.visitEntityPage(editAllPage);

        await expect(editAllPage.getByTestId('edit-tier')).not.toBeVisible();
        await expect(editAllPage.getByTestId('edit-owner')).not.toBeVisible();
        await expect(
          editAllPage.getByTestId('edit-certification')
        ).not.toBeVisible();
      }
    );

    headerPermTest.skip(
      'EditTier, EditOwners, EditCertification allowed but EditAll denied – edit buttons not visible',
      async ({ specificEditsPage }) => {
        await headerPermTable.visitEntityPage(specificEditsPage);

        await expect(specificEditsPage.getByTestId('edit-tier')).toBeVisible();
        await expect(specificEditsPage.getByTestId('edit-owner')).toBeVisible();
        await expect(
          specificEditsPage.getByTestId('edit-certification')
        ).toBeVisible();
      }
    );
  }
);

Object.entries(entityConfig).forEach(([, config]) => {
  const entity = new config.class();
  const entityType = entity.getType();

  test.describe(`${entityType} Permissions`, () => {
    test.beforeAll('Setup entity', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await entity.create(apiContext);

      await afterAction();
    });

    test.afterAll('Cleanup entity', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await entity.delete(apiContext);
      await afterAction();
    });

    // Allow permissions tests
    test.describe('Allow permissions', () => {
      test.beforeAll('Initialize allow permissions', async ({ browser }) => {
        const page = await browser.newPage();
        await adminUser.login(page);
        await initializePermissions(page, 'allow', ALL_OPERATIONS);
        await assignRoleToUser(page, testUser);
        await page.close();
      });

      test(`${entityType} allow common operations permissions`, async ({
        testUserPage,
      }) => {
        test.slow(true);

        await runCommonPermissionTests(testUserPage, entity, 'allow');
      });

      // Entity-specific tests
      if ('specificTest' in config && config.specificTest) {
        test(`${entityType} allow entity-specific permission operations`, async ({
          testUserPage,
        }) => {
          test.slow(true);

          await runEntitySpecificPermissionTests(
            testUserPage,
            entity,
            'allow',
            config.specificTest as (
              page: Page,
              entity: EntityClass,
              effect: 'allow' | 'deny'
            ) => Promise<void>
          );
        });
      }

      test.afterAll('Cleanup allow permissions', async ({ browser }) => {
        const page = await browser.newPage();
        await adminUser.login(page);
        const { apiContext } = await getApiContext(page);
        await cleanupPermissions(apiContext);
        await page.close();
      });
    });

    // Deny permissions tests
    test.describe('Deny permissions', () => {
      test.beforeAll('Initialize deny permissions', async ({ browser }) => {
        const page = await browser.newPage();
        await adminUser.login(page);
        await initializePermissions(page, 'deny', ALL_OPERATIONS);
        await assignRoleToUser(page, testUser);
        await page.close();
      });

      test(`${entityType} deny common operations permissions`, async ({
        testUserPage,
      }) => {
        test.slow(true);

        await runCommonPermissionTests(testUserPage, entity, 'deny');
      });

      // Entity-specific tests
      if ('specificTest' in config && config.specificTest) {
        test(`${entityType} deny entity-specific permission operations`, async ({
          testUserPage,
        }) => {
          test.slow(true);

          await runEntitySpecificPermissionTests(
            testUserPage,
            entity,
            'deny',
            config.specificTest as (
              page: Page,
              entity: EntityClass,
              effect: 'allow' | 'deny'
            ) => Promise<void>
          );
        });
      }

      test.afterAll('Cleanup deny permissions', async ({ browser }) => {
        const page = await browser.newPage();
        await adminUser.login(page);
        const { apiContext } = await getApiContext(page);
        await cleanupPermissions(apiContext);
        await page.close();
      });
    });
  });
});
