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
import { EntityClass } from '../../../support/entity/EntityClass';
import { EntityDataClass } from '../../../support/entity/EntityDataClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { uuid } from '../../../utils/common';
import {
  ALL_OPERATIONS,
  createCustomPropertyForEntity,
  entityConfig,
  runCommonPermissionTests,
  runEntitySpecificPermissionTests,
} from '../../../utils/entityPermissionUtils';
import {
  assignRoleToUser,
  cleanupPermissions,
  initializePermissions,
} from '../../../utils/permission';

const adminUser = new UserClass();
const testUser = new UserClass();

const test = base.extend<{
  page: Page;
  testUserPage: Page;
}>({
  page: async ({ browser }, use) => {
    const adminPage = await browser.newPage();
    await adminUser.login(adminPage);
    await use(adminPage);
    await adminPage.close();
  },
  testUserPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await testUser.login(page);
    await use(page);
    await page.close();
  },
});

test.beforeAll('Setup pre-requests', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await adminUser.create(apiContext);
  await adminUser.setAdminRole(apiContext);
  await testUser.create(apiContext);
  await afterAction();
});

Object.entries(entityConfig).forEach(([, config]) => {
  const entity = new config.class();
  const entityType = entity.getType();

  test.describe(`${entityType} Permissions`, () => {
    const customPropertyName = `pw${entityType}CustomProperty${uuid()}`;

    test.beforeAll('Setup entity', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await EntityDataClass.preRequisitesForTests(apiContext);
      await entity.create(apiContext);

      // Create custom property for this entity type
      await createCustomPropertyForEntity(
        browser,
        entityType,
        customPropertyName,
        adminUser
      );

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
    });

    test.afterAll('Cleanup entity', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await entity.delete(apiContext);
      await EntityDataClass.postRequisitesForTests(apiContext);
      await cleanupPermissions(apiContext);
      await afterAction();
    });
  });
});

test.afterAll('Cleanup', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await adminUser.delete(apiContext);
  await testUser.delete(apiContext);
  await cleanupPermissions(apiContext);

  await afterAction();
});
