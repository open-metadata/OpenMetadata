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
import { test as base, expect, Page } from '@playwright/test';
import { DOMAIN_TAGS } from '../../../constant/config';
import { PolicyClass } from '../../../support/access-control/PoliciesClass';
import { RolesClass } from '../../../support/access-control/RolesClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { getApiContext, redirectToHomePage, uuid } from '../../../utils/common';
import { findSystemTestDefinition } from '../../../utils/testCases';

const actionNotAllowed = async (page: Page) => {
  // Verify "Add Test Definition" button is NOT visible (no Create permission)
  const addButton = page.getByTestId('add-test-definition-button');

  await expect(addButton).not.toBeVisible();

  // Verify edit buttons are NOT visible for user test definitions
  const editButtons = page.getByTestId(/edit-test-definition-/).first();
  await expect(editButtons).toBeDisabled();

  // Verify delete buttons are NOT visible
  const deleteButtons = page.getByTestId(/delete-test-definition-/).first();
  await expect(deleteButtons).toBeDisabled();

  // Verify enabled/disabled switches are NOT interactive (no EditAll permission)
  const firstSwitch = page.getByRole('switch').first();
  await expect(firstSwitch).toBeDisabled();
};

// Define permission policies for different roles
const TEST_DEFINITION_VIEW_ONLY_RULES = [
  {
    name: `test-definition-view-only-${uuid()}`,
    resources: ['testDefinition'],
    operations: ['ViewAll', 'ViewBasic'],
    effect: 'allow',
  },
];

const TEST_DEFINITION_DATA_CONSUMER_RULES = [
  {
    name: `test-definition-data-consumer-${uuid()}`,
    resources: ['testDefinition'],
    operations: ['ViewAll', 'ViewBasic'],
    effect: 'allow',
  },
];

const TEST_DEFINITION_DATA_STEWARD_RULES = [
  {
    name: `test-definition-data-steward-${uuid()}`,
    resources: ['testDefinition'],
    operations: ['ViewAll', 'ViewBasic', 'EditAll'],
    effect: 'allow',
  },
];

// Create policy and role instances
const dataConsumerPolicy = new PolicyClass();
const dataConsumerRole = new RolesClass();
const dataConsumerUser = new UserClass();

const dataStewardPolicy = new PolicyClass();
const dataStewardRole = new RolesClass();
const dataStewardUser = new UserClass();

const viewOnlyPolicy = new PolicyClass();
const viewOnlyRole = new RolesClass();
const viewOnlyUser = new UserClass();

const test = base.extend<{
  adminPage: Page;
  dataConsumerPage: Page;
  dataStewardPage: Page;
  viewOnlyPage: Page;
}>({
  adminPage: async ({ browser }, use) => {
    const { page } = await performAdminLogin(browser);
    await use(page);
    await page.close();
  },
  dataConsumerPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await dataConsumerUser.login(page);
    await use(page);
    await page.close();
  },
  dataStewardPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await dataStewardUser.login(page);
    await use(page);
    await page.close();
  },
  viewOnlyPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await viewOnlyUser.login(page);
    await use(page);
    await page.close();
  },
});

test.beforeAll(async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);

  // Create view-only user with policy and role
  await viewOnlyUser.create(apiContext, false);
  const viewOnlyPolicyResponse = await viewOnlyPolicy.create(
    apiContext,
    TEST_DEFINITION_VIEW_ONLY_RULES
  );
  const viewOnlyRoleResponse = await viewOnlyRole.create(apiContext, [
    viewOnlyPolicyResponse.fullyQualifiedName,
  ]);
  await viewOnlyUser.patch({
    apiContext,
    patchData: [
      {
        op: 'add',
        path: '/roles/0',
        value: {
          id: viewOnlyRoleResponse.id,
          type: 'role',
          name: viewOnlyRoleResponse.name,
        },
      },
    ],
  });

  // Create data consumer user with policy and role
  await dataConsumerUser.create(apiContext, false);
  const dataConsumerPolicyResponse = await dataConsumerPolicy.create(
    apiContext,
    TEST_DEFINITION_DATA_CONSUMER_RULES
  );
  const dataConsumerRoleResponse = await dataConsumerRole.create(apiContext, [
    dataConsumerPolicyResponse.fullyQualifiedName,
  ]);
  await dataConsumerUser.patch({
    apiContext,
    patchData: [
      {
        op: 'add',
        path: '/roles/0',
        value: {
          id: dataConsumerRoleResponse.id,
          type: 'role',
          name: dataConsumerRoleResponse.name,
        },
      },
    ],
  });

  // Create data steward user with policy and role
  await dataStewardUser.create(apiContext, false);
  const dataStewardPolicyResponse = await dataStewardPolicy.create(
    apiContext,
    TEST_DEFINITION_DATA_STEWARD_RULES
  );
  const dataStewardRoleResponse = await dataStewardRole.create(apiContext, [
    dataStewardPolicyResponse.fullyQualifiedName,
  ]);
  await dataStewardUser.patch({
    apiContext,
    patchData: [
      {
        op: 'add',
        path: '/roles/0',
        value: {
          id: dataStewardRoleResponse.id,
          type: 'role',
          name: dataStewardRoleResponse.name,
        },
      },
    ],
  });

  await afterAction();
});

test.afterAll(async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);

  // Cleanup users, roles, and policies
  await viewOnlyUser.delete(apiContext);
  await viewOnlyRole.delete(apiContext);
  await viewOnlyPolicy.delete(apiContext);

  await dataConsumerUser.delete(apiContext);
  await dataConsumerRole.delete(apiContext);
  await dataConsumerPolicy.delete(apiContext);

  await dataStewardUser.delete(apiContext);
  await dataStewardRole.delete(apiContext);
  await dataStewardPolicy.delete(apiContext);

  await afterAction();
});

test.describe(
  'Test Definition Permissions - View Only User',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Rules_Library` },
  () => {
    test('should allow viewing test definitions but not create, edit, or delete', async ({
      viewOnlyPage,
    }) => {
      await redirectToHomePage(viewOnlyPage);

      // Navigate to Rules Library
      await viewOnlyPage.goto('/rules-library');

      // Wait for table to load
      await viewOnlyPage.waitForSelector(
        '[data-testid="test-definition-table"]',
        {
          state: 'visible',
        }
      );

      // Verify user can view the table
      await expect(
        viewOnlyPage.getByTestId('test-definition-table')
      ).toBeVisible();

      await actionNotAllowed(viewOnlyPage);
    });
  }
);

test.describe(
  'Test Definition Permissions - Data Consumer',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Rules_Library` },
  () => {
    test('should allow viewing test definitions but not create, edit, or delete', async ({
      dataConsumerPage,
    }) => {
      await redirectToHomePage(dataConsumerPage);

      // Navigate to Rules Library
      await dataConsumerPage.goto('/rules-library');

      // Wait for table to load
      await dataConsumerPage.waitForSelector(
        '[data-testid="test-definition-table"]',
        {
          state: 'visible',
        }
      );

      // Verify user can view the table
      await expect(
        dataConsumerPage.getByTestId('test-definition-table')
      ).toBeVisible();

      await actionNotAllowed(dataConsumerPage);
    });
  }
);

test.describe(
  'Test Definition Permissions - Data Steward',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Rules_Library` },
  () => {
    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await apiContext.post('/api/v1/dataQuality/testDefinitions', {
        data: {
          name: `aaaColumnTestDefinition-${uuid()}`,
          description: `A Column test definition`,
          entityType: 'COLUMN',
          testPlatforms: ['OpenMetadata'],
        },
      });
      await afterAction();
    });

    test('should allow viewing and editing but not creating or deleting test definitions', async ({
      dataStewardPage,
    }) => {
      await redirectToHomePage(dataStewardPage);

      // Navigate to Rules Library
      await dataStewardPage.goto('/rules-library');

      // Wait for table to load
      await dataStewardPage.waitForSelector(
        '[data-testid="test-definition-table"]',
        {
          state: 'visible',
        }
      );

      // Verify user can view the table
      await expect(
        dataStewardPage.getByTestId('test-definition-table')
      ).toBeVisible();

      // Data Steward should NOT have Create permission
      const addButton = dataStewardPage.getByTestId(
        'add-test-definition-button'
      );

      await expect(addButton).not.toBeVisible();

      // Data Steward should be able to toggle enabled/disabled switches (EditAll permission)
      const firstSwitch = dataStewardPage.getByRole('switch').first();

      await expect(firstSwitch).toBeEnabled();

      // Wait for API call
      const response = dataStewardPage.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/dataQuality/testDefinitions/') &&
          response.request().method() === 'PATCH'
      );

      // Try to toggle the switch
      await firstSwitch.click();
      await response;

      // Verify switch state changed
      await expect(firstSwitch).toHaveAttribute(
        'aria-checked',
        String('false')
      );

      const response2 = dataStewardPage.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/dataQuality/testDefinitions/') &&
          response.request().method() === 'PATCH'
      );
      // Toggle back to original state
      await firstSwitch.click();
      await response2;

      await expect(firstSwitch).toHaveAttribute('aria-checked', String('true'));

      // Data Steward should NOT see delete buttons (no Delete permission)
      const deleteButtons = dataStewardPage.getByTestId(
        /delete-test-definition-/
      );
      await expect(deleteButtons.first()).toBeDisabled();
    });

    test('should not be able to edit system test definitions', async ({
      dataStewardPage,
    }) => {
      await redirectToHomePage(dataStewardPage);

      const systemTestDef = await findSystemTestDefinition(dataStewardPage);

      if (!systemTestDef) {
        throw new Error('System test definition not found');
      }

      // Verify edit button does not exist for system test definition
      const editButton = dataStewardPage.getByTestId(
        `edit-test-definition-${systemTestDef.name}`
      );

      await expect(editButton).toBeDisabled();

      // Verify enabled switch exists and can be toggled
      const row = dataStewardPage.locator(
        `[data-row-key="${systemTestDef.id}"]`
      );
      const enabledSwitch = row.getByRole('switch');

      await expect(enabledSwitch).toBeVisible();
      await expect(enabledSwitch).toBeEnabled();
    });
  }
);

test.describe(
  'Test Definition Permissions - API Level Validation',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Rules_Library` },
  () => {
    test('should prevent unauthorized users from creating test definitions via API', async ({
      dataConsumerPage,
    }) => {
      await redirectToHomePage(dataConsumerPage);
      const { apiContext } = await getApiContext(dataConsumerPage);

      // Try to create a test definition via API (should fail)
      const createResponse = await apiContext.post(
        '/api/v1/dataQuality/testDefinitions',
        {
          data: {
            name: 'unauthorizedTest',
            description: 'Should not be created',
            entityType: 'COLUMN',
            testPlatforms: ['OpenMetadata'],
          },
        }
      );

      // Verify the request failed with 403 Forbidden
      expect(createResponse.status()).toBe(403);
    });

    test('should prevent unauthorized users from deleting test definitions via API', async ({
      dataStewardPage,
      adminPage,
    }) => {
      await redirectToHomePage(dataStewardPage);
      await redirectToHomePage(adminPage);
      const { apiContext } = await getApiContext(dataStewardPage);
      const { apiContext: adminApiContext } = await getApiContext(adminPage);

      const createResponse = await adminApiContext.post(
        '/api/v1/dataQuality/testDefinitions',
        {
          data: {
            name: `unauthorizedTest${uuid()}`,
            description: `unauthorizedTest`,
            entityType: 'COLUMN',
            testPlatforms: ['OpenMetadata'],
          },
        }
      );

      const data = await createResponse.json();

      // Try to delete the test definition (should fail - no Delete permission)
      const deleteResponse = await apiContext.delete(
        `/api/v1/dataQuality/testDefinitions/${data.id}`
      );

      // Verify the request failed with 403 Forbidden
      expect(deleteResponse.status()).toBe(403);
    });

    test('should prevent all users from modifying system test definition entity type via API', async ({
      adminPage,
    }) => {
      await redirectToHomePage(adminPage);
      const { apiContext } = await getApiContext(adminPage);

      // Get a system test definition via API directly to ensure we find one
      const response = await apiContext.get(
        '/api/v1/dataQuality/testDefinitions?limit=100&testPlatform=OpenMetadata'
      );
      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      // Find a system test definition with COLUMN entity type
      const systemTestDef = data.data.find(
        (def: { provider: string; entityType: string }) =>
          def.provider === 'system' && def.entityType === 'COLUMN'
      );

      // Ensure we found one to test against
      if (!systemTestDef) {
        throw new Error(
          'System test definition with COLUMN entity type not found'
        );
      }

      const { id } = systemTestDef;

      // Try to patch the test definition to change entity type (should fail even for admin)
      const patchResponse = await apiContext.patch(
        `/api/v1/dataQuality/testDefinitions/${id}`,
        {
          data: [
            {
              op: 'replace',
              path: '/entityType',
              value: 'TABLE',
            },
          ],
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      );

      // Verify the request failed with 400 Bad Request
      expect(patchResponse.status()).toBe(400);

      const errorBody = await patchResponse.json();

      expect(errorBody.message).toContain(
        'System test definitions cannot have their entity type modified'
      );
    });
  }
);
