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
import { ApiServiceClass } from '../../../support/entity/service/ApiServiceClass';
import { DashboardServiceClass } from '../../../support/entity/service/DashboardServiceClass';
import { DatabaseServiceClass } from '../../../support/entity/service/DatabaseServiceClass';
import { MessagingServiceClass } from '../../../support/entity/service/MessagingServiceClass';
import { MlmodelServiceClass } from '../../../support/entity/service/MlmodelServiceClass';
import { PipelineServiceClass } from '../../../support/entity/service/PipelineServiceClass';
import { SearchIndexServiceClass } from '../../../support/entity/service/SearchIndexServiceClass';
import { StorageServiceClass } from '../../../support/entity/service/StorageServiceClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { getApiContext } from '../../../utils/common';
import {
  ALL_OPERATIONS,
  runCommonPermissionTests,
} from '../../../utils/entityPermissionUtils';
import {
  assignRoleToUser,
  cleanupPermissions,
  initializePermissions,
} from '../../../utils/permission';

const adminUser = new UserClass();
const testUser = new UserClass();

// Service entity classes
const serviceEntities = {
  'Api Service': ApiServiceClass,
  'Dashboard Service': DashboardServiceClass,
  'Database Service': DatabaseServiceClass,
  'Messaging Service': MessagingServiceClass,
  'Mlmodel Service': MlmodelServiceClass,
  'Pipeline Service': PipelineServiceClass,
  'SearchIndex Service': SearchIndexServiceClass,
  'Storage Service': StorageServiceClass,
} as const;

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

Object.entries(serviceEntities).forEach(([key, EntityClass]) => {
  const entity = new EntityClass();

  test.describe(`${key} Permissions`, () => {
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

    test.describe('Allow permissions', () => {
      test.beforeAll('Initialize allow permissions', async ({ browser }) => {
        const page = await browser.newPage();
        await adminUser.login(page);
        await initializePermissions(page, 'allow', ALL_OPERATIONS);
        await assignRoleToUser(page, testUser);
        await page.close();
      });

      /**
       * Tests allow permissions for common service operations
       * @description Verifies that a user with allow permissions can perform all common operations on the service,
       * including EditDescription, EditOwners, EditTier, EditDisplayName, EditTags, EditGlossaryTerms,
       * EditCustomFields, and Delete operations
       */
      test(`${key} allow common operations permissions`, async ({
        testUserPage,
      }) => {
        test.slow(true);

        await runCommonPermissionTests(testUserPage, entity, 'allow');
      });

      test.afterAll('Cleanup allow permissions', async ({ browser }) => {
        const page = await browser.newPage();
        await adminUser.login(page);
        const { apiContext } = await getApiContext(page);
        await cleanupPermissions(apiContext);
        await page.close();
      });
    });

    test.describe('Deny permissions', () => {
      test.beforeAll('Initialize deny permissions', async ({ browser }) => {
        const page = await browser.newPage();
        await adminUser.login(page);
        await initializePermissions(page, 'deny', ALL_OPERATIONS);
        await assignRoleToUser(page, testUser);
        await page.close();
      });

      /**
       * Tests deny permissions for common service operations
       * @description Verifies that a user with deny permissions cannot perform common operations on the service,
       * including EditDescription, EditOwners, EditTier, EditDisplayName, EditTags, EditGlossaryTerms,
       * EditCustomFields, and Delete operations. UI elements for these actions should be hidden or disabled
       */
      test(`${key} deny common operations permissions`, async ({
        testUserPage,
      }) => {
        test.slow(true);

        await runCommonPermissionTests(testUserPage, entity, 'deny');
      });

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
