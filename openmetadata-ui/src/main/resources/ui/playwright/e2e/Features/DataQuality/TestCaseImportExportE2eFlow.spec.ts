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
import { DOMAIN_TAGS } from '../../../constant/config';
import { PolicyClass } from '../../../support/access-control/PoliciesClass';
import { RolesClass } from '../../../support/access-control/RolesClass';
import { TableClass } from '../../../support/entity/TableClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage, uuid } from '../../../utils/common';
import {
  cleanupDownloadedCSV,
  performE2EExportImportFlow
} from '../../../utils/testCases';
import { test as base } from '../../fixtures/pages';

// Policy rules for test case edit permissions
const TEST_CASE_EDIT_ALL_RULES = [
  {
    name: `test-case-e2e-edit-${uuid()}`,
    resources: ['testCase'],
    operations: ['ViewAll', 'ViewBasic', 'EditAll'],
    effect: 'allow',
  },
  {
    name: `test-case-e2e-view-${uuid()}`,
    resources: ['all'],
    operations: ['ViewAll'],
    effect: 'allow',
  },
];

// Setup user, role, and policy
const testCaseEditPolicy = new PolicyClass();
const testCaseEditRole = new RolesClass();
const testCaseEditUser = new UserClass();

// Extend test with custom user page
const test = base.extend<{
  testCaseEditPage: Page;
}>({
  testCaseEditPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await testCaseEditUser.login(page);
    await use(page);
    await page.close();
  },
});

test.describe(
  'Test Case Import/Export/Edit - End-to-End Flow with Admin',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Data_Quality` },
  () => {
    const table = new TableClass();

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table.create(apiContext);
      await table.createTestCase(apiContext)
      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table.delete(apiContext);
      cleanupDownloadedCSV(table.entity.name);
      await afterAction();
    });

    /**
     * @description Test Case Description:
     * 1. Export test cases to download folder
     * 2. Import CSV with new rows (Complete, Missing Name, Missing Definition, Missing EntityFQN)
     * 3. Validate import status and error messages
     * 4. Update and verify successful creation
     * 5. Verify Bulk Edit capabilities (Display Name, Tags)
     */
    test('Admin: Complete export-import-validate flow', async ({ page }) => {
      test.slow(true);
      await redirectToHomePage(page);
      await performE2EExportImportFlow(page, table, 'admin');
    });

  }
);

test.describe(
  'Test Case Import/Export/Edit - End-to-End Flow with EditAll User on TestCase resource',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Data_Quality` },
  () => {
    const table = new TableClass();

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      // Create user with EditAll and ViewAll permissions on testCase
      await testCaseEditUser.create(apiContext, false);
      const editPolicyResponse = await testCaseEditPolicy.create(
        apiContext,
        TEST_CASE_EDIT_ALL_RULES
      );
      const editRoleResponse = await testCaseEditRole.create(apiContext, [
        editPolicyResponse.fullyQualifiedName,
      ]);
      await testCaseEditUser.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/roles/0',
            value: {
              id: editRoleResponse.id,
              type: 'role',
              name: editRoleResponse.name,
            },
          },
        ],
      });

      await table.create(apiContext);
      await table.createTestCase(apiContext);
      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table.delete(apiContext);
      await testCaseEditUser.delete(apiContext);
      await testCaseEditRole.delete(apiContext);
      await testCaseEditPolicy.delete(apiContext);
      cleanupDownloadedCSV(table.entity.name);
      await afterAction();
    });

    /**
     * @description Test Case Description:
     * 1. Export test cases to download folder
     * 2. Import CSV with new rows (Complete, Missing Name, Missing Definition, Missing EntityFQN)
     * 3. Validate import status and error messages
     * 4. Update and verify successful creation
     * 5. Verify Bulk Edit capabilities (Display Name, Tags)
     */
    test('EditAll User: Complete export-import-validate flow', async ({
      testCaseEditPage,
    }) => {
      test.slow(true);
      await redirectToHomePage(testCaseEditPage);
      await performE2EExportImportFlow(testCaseEditPage, table, 'edituser');
    });
  }
);
