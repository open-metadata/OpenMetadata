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

import { test } from '../../../support/fixtures/userPages';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';

import {
  ALL_OPERATIONS,
  runCommonPermissionTests,
} from '../../../utils/entityPermissionUtils';
import {
  assignRoleToUser,
  initializePermissions,
} from '../../../utils/permission';
import { SERVICE_ENTITIES } from '../../../constant/service';

const testUser = new UserClass();

test.beforeAll('Setup pre-requests', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await testUser.create(apiContext);
  await afterAction();
});

Object.entries(SERVICE_ENTITIES).forEach(([entityType, EntityClass]) => {
  test.describe(`${entityType} Permissions`, () => {
    const entity = new EntityClass();
    test.beforeAll('Setup entity', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await entity.create(apiContext);
      await afterAction();
    });

    test.describe('Allow permissions', () => {
      test.beforeAll('Initialize allow permissions', async ({ browser }) => {
        const { page, afterAction } = await performAdminLogin(browser);
        await initializePermissions(page, 'allow', ALL_OPERATIONS);
        await assignRoleToUser(page, testUser);
        await afterAction();
      });

      /**
       * Tests allow permissions for common service operations
       * @description Verifies that a user with allow permissions can perform all common operations on the service,
       * including EditDescription, EditOwners, EditTier, EditDisplayName, EditTags, EditGlossaryTerms,
       * EditCustomFields, and Delete operations
       */
      test(`${entityType} allow common operations permissions`, async ({
        browser,
      }) => {
        test.slow(true);

        // Create a fresh page and log in as test user to get updated permissions
        const testUserPage = await browser.newPage();
        try {
          await testUser.login(testUserPage);
          await runCommonPermissionTests(testUserPage, entity, 'allow');
        } finally {
          await testUserPage.close();
        }
      });
    });

    test.describe('Deny permissions', () => {
      test.beforeAll('Initialize deny permissions', async ({ browser }) => {
        const { page, afterAction } = await performAdminLogin(browser);
        await initializePermissions(page, 'deny', ALL_OPERATIONS);
        await assignRoleToUser(page, testUser);
        await afterAction();
      });

      /**
       * Tests deny permissions for common service operations
       * @description Verifies that a user with deny permissions cannot perform common operations on the service,
       * including EditDescription, EditOwners, EditTier, EditDisplayName, EditTags, EditGlossaryTerms,
       * EditCustomFields, and Delete operations. UI elements for these actions should be hidden or disabled
       */
      test(`${entityType} deny common operations permissions`, async ({
        browser,
      }) => {
        test.slow(true);
        const testUserPage = await browser.newPage();
        try {
          await testUser.login(testUserPage);
          await runCommonPermissionTests(testUserPage, entity, 'deny');
        } finally {
          await testUserPage.close();
        }
      });
    });
  });
});
