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
import { PolicyClass } from '../../../support/access-control/PoliciesClass';
import { RolesClass } from '../../../support/access-control/RolesClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage, uuid } from '../../../utils/common';

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

/* eslint-disable react-hooks/rules-of-hooks */
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
/* eslint-enable react-hooks/rules-of-hooks */

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

test.describe('Test Definition Permissions - View Only User', () => {
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

    // Verify "Add Test Definition" button is NOT visible (no Create permission)
    const addButton = viewOnlyPage.getByTestId('add-test-definition-button');

    await expect(addButton).not.toBeVisible();

    // Verify edit buttons are NOT visible for user test definitions
    const editButtons = viewOnlyPage.getByTestId(/edit-test-definition-/);
    await expect(editButtons.first()).not.toBeVisible();

    // Verify delete buttons are NOT visible
    const deleteButtons = viewOnlyPage.getByTestId(/delete-test-definition-/);
    await expect(deleteButtons.first()).not.toBeVisible();

    // Verify enabled/disabled switches are NOT interactive (no EditAll permission)
    const firstSwitch = viewOnlyPage.getByRole('switch').first();
    if (await firstSwitch.isVisible()) {
      await expect(firstSwitch).toBeDisabled();
    }
  });
});

test.describe('Test Definition Permissions - Data Consumer', () => {
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

    // Data Consumer should NOT have create permission
    const addButton = dataConsumerPage.getByTestId(
      'add-test-definition-button'
    );

    await expect(addButton).not.toBeVisible();

    // Data Consumer should NOT see edit buttons for user test definitions
    const editButtons = dataConsumerPage.getByTestId(/edit-test-definition-/);
    await expect(editButtons.first()).not.toBeVisible();

    // Data Consumer should NOT see delete buttons
    const deleteButtons = dataConsumerPage.getByTestId(
      /delete-test-definition-/
    );
    await expect(deleteButtons.first()).not.toBeVisible();
  });
});

test.describe('Test Definition Permissions - Data Steward', () => {
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
    const addButton = dataStewardPage.getByTestId('add-test-definition-button');

    await expect(addButton).not.toBeVisible();

    // Data Steward should be able to toggle enabled/disabled switches (EditAll permission)
    const firstSwitch = dataStewardPage.getByRole('switch').first();
    if (await firstSwitch.isVisible()) {
      await expect(firstSwitch).toBeEnabled();

      const initialState = await firstSwitch.isChecked();

      // Try to toggle the switch
      await firstSwitch.click();

      // Wait for API call
      await dataStewardPage.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/dataQuality/testDefinitions/') &&
          response.request().method() === 'PATCH'
      );

      // Verify switch state changed
      await expect(firstSwitch).toHaveAttribute(
        'aria-checked',
        String(!initialState)
      );

      // Toggle back to original state
      await firstSwitch.click();
      await dataStewardPage.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/dataQuality/testDefinitions/') &&
          response.request().method() === 'PATCH'
      );
    }

    // Data Steward should NOT see delete buttons (no Delete permission)
    const deleteButtons = dataStewardPage.getByTestId(
      /delete-test-definition-/
    );
    await expect(deleteButtons.first()).not.toBeVisible();
  });

  test('should not be able to edit system test definitions', async ({
    dataStewardPage,
  }) => {
    await redirectToHomePage(dataStewardPage);

    // Navigate to Rules Library
    await dataStewardPage.goto('/rules-library');

    // Wait for API response to get test definitions
    const response = await dataStewardPage.waitForResponse((response) =>
      response.url().includes('/api/v1/dataQuality/testDefinitions')
    );

    const data = await response.json();

    // Find a system test definition
    const systemTestDef = data.data.find(
      (def: { provider: string }) => def.provider === 'system'
    );

    if (systemTestDef) {
      // Verify edit button does not exist for system test definition
      const editButton = dataStewardPage.getByTestId(
        `edit-test-definition-${systemTestDef.name}`
      );

      await expect(editButton).not.toBeVisible();

      // Verify enabled switch exists and can be toggled
      const row = dataStewardPage.locator(
        `[data-row-key="${systemTestDef.id}"]`
      );
      const enabledSwitch = row.getByRole('switch');

      await expect(enabledSwitch).toBeVisible();
      await expect(enabledSwitch).toBeEnabled();
    }
  });
});

test.describe('Test Definition Permissions - Admin', () => {
  test('should allow admin to create, edit, and delete user test definitions', async ({
    adminPage,
  }) => {
    await redirectToHomePage(adminPage);

    // Navigate to Rules Library
    await adminPage.goto('/rules-library');

    // Wait for table to load
    await adminPage.waitForSelector('[data-testid="test-definition-table"]', {
      state: 'visible',
    });

    // Admin should see the "Add Test Definition" button
    const addButton = adminPage.getByTestId('add-test-definition-button');

    await expect(addButton).toBeVisible();

    // Create a new user test definition
    await addButton.click();

    // Wait for drawer to open
    await adminPage.waitForSelector('.ant-drawer', { state: 'visible' });

    // Fill in form fields
    const testName = `adminCreatedTest${Date.now()}`;
    await adminPage.getByLabel('Name').fill(testName);
    await adminPage.getByLabel('Display Name').fill('Admin Created Test');
    await adminPage
      .getByLabel('Description')
      .fill('Test created by admin for permission testing');

    // Select entity type
    await adminPage.getByLabel('Entity Type').click();
    await adminPage.getByText('COLUMN').first().click();

    // Select test platform
    await adminPage.getByLabel('Test Platform').click();
    await adminPage.getByText('OpenMetadata').first().click();

    // Click save
    await adminPage.getByTestId('save-test-definition').click();

    // Wait for success toast
    await expect(adminPage.getByText(/created successfully/i)).toBeVisible();

    // Verify edit button exists for user test definition
    const editButton = adminPage.getByTestId(
      `edit-test-definition-${testName}`
    );

    await expect(editButton).toBeVisible();

    // Verify delete button exists for user test definition
    const deleteButton = adminPage.getByTestId(
      `delete-test-definition-${testName}`
    );

    await expect(deleteButton).toBeVisible();

    // Edit the test definition
    await editButton.click();
    await adminPage.waitForSelector('.ant-drawer', { state: 'visible' });

    const displayNameInput = adminPage.getByLabel('Display Name');
    await displayNameInput.clear();
    await displayNameInput.fill('Updated Admin Test');

    await adminPage.getByTestId('save-test-definition').click();
    await expect(adminPage.getByText(/updated successfully/i)).toBeVisible();

    // Delete the test definition
    await deleteButton.click();
    await adminPage.waitForSelector('.ant-modal', { state: 'visible' });
    await adminPage.getByRole('button', { name: /Delete/i }).click();
    await expect(adminPage.getByText(/deleted successfully/i)).toBeVisible();
  });

  test('should allow admin to enable/disable system test definitions but not delete them', async ({
    adminPage,
  }) => {
    await redirectToHomePage(adminPage);

    // Navigate to Rules Library
    await adminPage.goto('/rules-library');

    // Wait for API response to get test definitions
    const response = await adminPage.waitForResponse((response) =>
      response.url().includes('/api/v1/dataQuality/testDefinitions')
    );

    const data = await response.json();

    // Find a system test definition
    const systemTestDef = data.data.find(
      (def: { provider: string }) => def.provider === 'system'
    );

    if (systemTestDef) {
      // Verify edit button does NOT exist for system test definition (even for admin)
      const editButton = adminPage.getByTestId(
        `edit-test-definition-${systemTestDef.name}`
      );

      await expect(editButton).not.toBeVisible();

      // Verify delete button does NOT exist for system test definition (even for admin)
      const deleteButton = adminPage.getByTestId(
        `delete-test-definition-${systemTestDef.name}`
      );

      await expect(deleteButton).not.toBeVisible();

      // Verify admin can toggle enabled/disabled switch
      const row = adminPage.locator(`[data-row-key="${systemTestDef.id}"]`);
      const enabledSwitch = row.getByRole('switch');

      await expect(enabledSwitch).toBeVisible();
      await expect(enabledSwitch).toBeEnabled();

      const initialState = await enabledSwitch.isChecked();

      // Toggle the switch
      await enabledSwitch.click();

      // Wait for API call
      await adminPage.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/dataQuality/testDefinitions/') &&
          response.request().method() === 'PATCH'
      );

      // Verify switch state changed
      await expect(enabledSwitch).toHaveAttribute(
        'aria-checked',
        String(!initialState)
      );

      // Toggle back to original state
      await enabledSwitch.click();
      await adminPage.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/dataQuality/testDefinitions/') &&
          response.request().method() === 'PATCH'
      );
    }
  });
});

test.describe('Test Definition Permissions - API Level Validation', () => {
  test('should prevent unauthorized users from creating test definitions via API', async ({
    dataConsumerPage,
  }) => {
    await redirectToHomePage(dataConsumerPage);

    // Try to create a test definition via API (should fail)
    const createResponse = await dataConsumerPage.request.post(
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
  }) => {
    await redirectToHomePage(dataStewardPage);

    // Navigate to Rules Library to get test definitions
    await dataStewardPage.goto('/rules-library');

    const response = await dataStewardPage.waitForResponse((response) =>
      response.url().includes('/api/v1/dataQuality/testDefinitions')
    );

    const data = await response.json();

    // Find a user test definition (if any)
    const userTestDef = data.data.find(
      (def: { provider: string }) => def.provider === 'user'
    );

    if (userTestDef) {
      // Try to delete the test definition (should fail - no Delete permission)
      const deleteResponse = await dataStewardPage.request.delete(
        `/api/v1/dataQuality/testDefinitions/${userTestDef.id}`
      );

      // Verify the request failed with 403 Forbidden
      expect(deleteResponse.status()).toBe(403);
    }
  });

  test('should prevent all users from modifying system test definition entity type via API', async ({
    adminPage,
  }) => {
    await redirectToHomePage(adminPage);

    // Navigate to Rules Library
    await adminPage.goto('/rules-library');

    const response = await adminPage.waitForResponse((response) =>
      response.url().includes('/api/v1/dataQuality/testDefinitions')
    );

    const data = await response.json();

    // Find a system test definition with COLUMN entity type
    const systemTestDef = data.data.find(
      (def: { provider: string; entityType: string }) =>
        def.provider === 'system' && def.entityType === 'COLUMN'
    );

    if (systemTestDef) {
      // Try to patch the test definition to change entity type (should fail even for admin)
      const patchResponse = await adminPage.request.patch(
        `/api/v1/dataQuality/testDefinitions/${systemTestDef.id}`,
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
    }
  });
});
