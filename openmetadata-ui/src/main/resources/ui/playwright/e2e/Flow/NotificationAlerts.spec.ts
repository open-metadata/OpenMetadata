/*
 *  Copyright 2022 Collate.
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
import { Domain } from '../../support/domain/Domain';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { TableClass } from '../../support/entity/TableClass';
import { AdminClass } from '../../support/user/AdminClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  commonCleanup,
  commonPrerequisites,
  createAlert,
  deleteAlert,
  generateAlertName,
  inputBasicAlertInformation,
  verifyAlertDetails,
  visitAlertDetailsPage,
  visitEditAlertPage,
} from '../../utils/alert';
import { descriptionBox, getApiContext } from '../../utils/common';
import {
  addFilterWithUsersListInput,
  addInternalDestination,
  checkAlertDetailsForWithPermissionUser,
  checkAlertFlowForWithoutPermissionUser,
  createAlertForRecentEventsCheck,
  createAlertWithMultipleFilters,
  createConversationAlert,
  createTaskAlert,
  editSingleFilterAlert,
  visitNotificationAlertPage,
} from '../../utils/notificationAlert';
import { addExternalDestination } from '../../utils/observabilityAlert';

const dashboard = new DashboardClass();
const table = new TableClass();
const admin = new AdminClass();
const user1 = new UserClass();
const user2 = new UserClass();
const domain = new Domain();

const SOURCE_NAME_1 = 'all';
const SOURCE_DISPLAY_NAME_1 = 'All';
const SOURCE_NAME_2 = 'dashboard';
const SOURCE_DISPLAY_NAME_2 = 'Dashboard';
const SOURCE_NAME_3 = 'task';
const SOURCE_DISPLAY_NAME_3 = 'Task';
const SOURCE_NAME_4 = 'conversation';
const SOURCE_DISPLAY_NAME_4 = 'Conversation';
const SOURCE_NAME_5 = 'table';
const SOURCE_DISPLAY_NAME_5 = 'Table';

// Create 3 page and authenticate 1 with admin and others with normal user
const test = base.extend<{
  page: Page;
  userWithPermissionsPage: Page;
  userWithoutPermissionsPage: Page;
}>({
  page: async ({ browser }, use) => {
    const page = await browser.newPage();
    await admin.login(page);
    await use(page);
    await page.close();
  },
  userWithPermissionsPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await user1.login(page);
    await use(page);
    await page.close();
  },
  userWithoutPermissionsPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await user2.login(page);
    await use(page);
    await page.close();
  },
});

const data = {
  alertDetails: {
    id: '',
    name: '',
    displayName: '',
    description: '',
    filteringRules: { resources: [] },
    input: { filters: [], actions: [] },
    destinations: [],
  },
};

test.beforeAll(async ({ browser }) => {
  test.slow();

  const { afterAction, apiContext } = await performAdminLogin(browser);
  await commonPrerequisites({
    apiContext,
    table,
    user1,
    user2,
    domain,
  });
  await dashboard.create(apiContext);

  await afterAction();
});

test.afterAll('Cleanup', async ({ browser }) => {
  test.slow();

  const { afterAction, apiContext } = await performAdminLogin(browser);
  await commonCleanup({
    apiContext,
    table,
    user1,
    user2,
    domain,
  });
  await dashboard.delete(apiContext);

  await afterAction();
});

/**
 * Notification Alerts — End-to-End Coverage
 * @description Exercises alert creation, editing, destinations, permissions, and recent events verification across
 * multiple alert sources (All, Dashboard, Task, Conversation, Table).
 *
 * Preconditions
 * - Admin session and two user accounts with differing permissions.
 * - Domain, table, and dashboard entities exist.
 *
 * Coverage
 * - Create/Edit/Delete: Single-filter and multi-filter alert flows; internal and external destinations.
 * - Source-specific flows: Task, Conversation, Table with mentions and recent events.
 * - Permissions: Validates behavior for users with/without alert permissions.
 * - Test Destination: Confirms destination test API success and UI status reporting.
 *
 * API Interactions
 * - POST/PATCH `/api/v1/events/subscriptions` for alert management.
 * - POST `/api/v1/events/subscriptions/testDestination` to validate destination config.
 * - Search endpoints for user/test case selectors.
 */

/**
 * Single Filter Alert
 * @description Creates an alert with a single filter and verifies alert details; edits by adding filters and destinations,
 * then deletes the alert.
 */
test('Single Filter Alert', async ({ page }) => {
  test.slow();

  const ALERT_NAME = generateAlertName();
  await visitNotificationAlertPage(page);

  /**
   * Step: Create alert
   * @description Creates an alert under All source with a single filter and captures details.
   */
  await test.step('Create alert', async () => {
    data.alertDetails = await createAlert({
      page,
      alertName: ALERT_NAME,
      sourceName: SOURCE_NAME_1,
      sourceDisplayName: SOURCE_DISPLAY_NAME_1,
      user: user1,
    });
  });

  /**
   * Step: Verify alert details
   * @description Navigates to alert details and verifies created configuration.
   */
  await test.step('Check created alert details', async () => {
    await visitNotificationAlertPage(page);
    await visitAlertDetailsPage(page, data.alertDetails);

    // Verify alert details
    await verifyAlertDetails({ page, alertDetails: data.alertDetails });
  });

  /**
   * Step: Edit alert (add filters and destinations)
   * @description Adds multiple filters and internal destinations; saves and verifies updated alert.
   */
  await test.step(
    'Edit alert by adding multiple filters and internal destinations',
    async () => {
      await editSingleFilterAlert({
        page,
        sourceName: SOURCE_NAME_2,
        sourceDisplayName: SOURCE_DISPLAY_NAME_2,
        user1,
        user2,
        domain,
        dashboard,
        alertDetails: data.alertDetails,
      });

      // Click save
      const updateAlert = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/events/subscriptions') &&
          response.request().method() === 'PATCH' &&
          response.status() === 200
      );
      await page.click('[data-testid="save-button"]');
      await updateAlert.then(async (response) => {
        data.alertDetails = await response.json();

        test.expect(response.status()).toEqual(200);

        // Verify the edited alert changes
        await verifyAlertDetails({ page, alertDetails: data.alertDetails });
      });
    }
  );

  /**
   * Step: Delete alert
   * @description Deletes the created alert and confirms cleanup.
   */
  await test.step('Delete alert', async () => {
    await deleteAlert(page, data.alertDetails);
  });
});

/**
 * Multiple Filters Alert
 * @description Creates an alert with multiple filters and destinations; edits by removing filters/destinations,
 * verifies changes, then deletes the alert.
 */
test('Multiple Filters Alert', async ({ page }) => {
  test.slow();

  const ALERT_NAME = generateAlertName();
  await visitNotificationAlertPage(page);

  await test.step('Create alert', async () => {
    data.alertDetails = await createAlertWithMultipleFilters({
      page,
      alertName: ALERT_NAME,
      sourceName: SOURCE_NAME_1,
      sourceDisplayName: SOURCE_DISPLAY_NAME_1,
      user1,
      user2,
      domain,
      dashboard,
    });
  });

  /**
   * Step: Edit alert (remove filters and destinations)
   * @description Removes description, filters, and extra destinations; saves and verifies updated alert.
   */
  await test.step(
    'Edit alert by removing added filters and internal destinations',
    async () => {
      await visitEditAlertPage(page, data.alertDetails);

      // Remove description
      await page.locator(descriptionBox).clear();

      // Remove all filters
      for (let i = 0; i < 6; i++) {
        await page.click('[data-testid="remove-filter-0"]');
      }

      // Remove all destinations except one
      for (let i = 0; i < 5; i++) {
        await page.click('[data-testid="remove-destination-0"]');
      }

      // Click save
      const updateAlert = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/events/subscriptions') &&
          response.request().method() === 'PATCH' &&
          response.status() === 200
      );
      await page.click('[data-testid="save-button"]');
      await updateAlert.then(async (response) => {
        data.alertDetails = await response.json();

        test.expect(response.status()).toEqual(200);

        // Verify the edited alert changes
        await verifyAlertDetails({ page, alertDetails: data.alertDetails });
      });
    }
  );

  /**
   * Step: Delete alert
   * @description Deletes the edited alert and confirms cleanup.
   */
  await test.step('Delete alert', async () => {
    await deleteAlert(page, data.alertDetails);
  });
});

/**
 * Task Source Alert
 * @description Creates an alert scoped to Task source and then deletes it.
 */
test('Task source alert', async ({ page }) => {
  const ALERT_NAME = generateAlertName();
  await visitNotificationAlertPage(page);

  /**
   * Step: Create alert
   * @description Creates a Task source alert.
   */
  await test.step('Create alert', async () => {
    data.alertDetails = await createTaskAlert({
      page,
      alertName: ALERT_NAME,
      sourceName: SOURCE_NAME_3,
      sourceDisplayName: SOURCE_DISPLAY_NAME_3,
    });
  });

  /**
   * Step: Delete alert
   * @description Deletes the Task alert.
   */
  await test.step('Delete alert', async () => {
    await deleteAlert(page, data.alertDetails);
  });
});

/**
 * Conversation Source Alert
 * @description Creates a Conversation source alert, adds a mentions filter and Slack destination, then deletes it.
 */
test('Conversation source alert', async ({ page }) => {
  const ALERT_NAME = generateAlertName();
  await visitNotificationAlertPage(page);

  /**
   * Step: Create alert
   * @description Creates a Conversation source alert.
   */
  await test.step('Create alert', async () => {
    data.alertDetails = await createConversationAlert({
      page,
      alertName: ALERT_NAME,
      sourceName: SOURCE_NAME_4,
      sourceDisplayName: SOURCE_DISPLAY_NAME_4,
    });
  });

  /**
   * Step: Edit alert (mentions filter)
   * @description Adds a mentions-based filter and Slack destination; saves and verifies changes.
   */
  await test.step('Edit alert by adding mentions filter', async () => {
    await visitEditAlertPage(page, data.alertDetails);

    // Add filter
    await page.click('[data-testid="add-filters"]');

    await addFilterWithUsersListInput({
      page,
      filterNumber: 0,
      updaterName: user1.getUserDisplayName(),
      filterTestId: 'Mentioned Users-filter-option',
      exclude: true,
    });

    // Add Destination
    await page.click('[data-testid="add-destination-button"]');
    await addInternalDestination({
      page,
      destinationNumber: 1,
      category: 'Mentions',
      type: 'Slack',
    });

    // Click save
    const updateAlert = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/events/subscriptions') &&
        response.request().method() === 'PATCH' &&
        response.status() === 200
    );
    await page.click('[data-testid="save-button"]');
    await updateAlert.then(async (response) => {
      data.alertDetails = await response.json();

      test.expect(response.status()).toEqual(200);

      // Verify the edited alert changes
      await verifyAlertDetails({ page, alertDetails: data.alertDetails });
    });
  });

  /**
   * Step: Delete alert
   * @description Deletes the Conversation alert.
   */
  await test.step('Delete alert', async () => {
    await deleteAlert(page, data.alertDetails);
  });
});

/**
 * Alert operations with permissions
 * @description Creates and triggers a Table source alert; verifies alert details for permissive user and limited behavior
 * for a non-permissive user; deletes the alert.
 */
test('Alert operations for a user with and without permissions', async ({
  page,
  userWithPermissionsPage,
  userWithoutPermissionsPage,
}) => {
  test.slow();

  const ALERT_NAME = generateAlertName();
  const { apiContext } = await getApiContext(page);
  await visitNotificationAlertPage(userWithPermissionsPage);

  /**
   * Step: Create and trigger alert
   * @description Creates a Table source alert and triggers recent events via delete/restore.
   */
  await test.step('Create and trigger alert', async () => {
    data.alertDetails = await createAlertForRecentEventsCheck({
      page: userWithPermissionsPage,
      alertName: ALERT_NAME,
      sourceName: SOURCE_NAME_5,
      sourceDisplayName: SOURCE_DISPLAY_NAME_5,
      user: user1,
      table,
    });

    // Trigger alert
    await table.deleteTable(apiContext, false);
    await table.restore(apiContext);
  });

  /**
   * Step: Validate user without permission
   * @description Confirms restricted actions and views for a user without alert permissions.
   */
  await test.step('Checks for user without permission', async () => {
    await checkAlertFlowForWithoutPermissionUser({
      page: userWithoutPermissionsPage,
      alertDetails: data.alertDetails,
      sourceName: SOURCE_NAME_5,
      table,
    });
  });

  /**
   * Step: Verify details and Recent Events
   * @description Checks alert details and validates Recent Events for permissive user.
   */
  await test.step(
    'Check alert details page and Recent Events tab',
    async () => {
      await checkAlertDetailsForWithPermissionUser({
        page: userWithPermissionsPage,
        alertDetails: data.alertDetails,
        sourceName: SOURCE_NAME_5,
        table,
        user: user2,
      });
    }
  );

  /**
   * Step: Delete alert
   * @description Deletes the Table source alert.
   */
  await test.step('Delete alert', async () => {
    await deleteAlert(userWithPermissionsPage, data.alertDetails);
  });
});

/**
 * Destination test flow
 * @description Validates internal/external destination configuration, tests destinations, and verifies UI result statuses.
 */
test('destination should work properly', async ({ page }) => {
  await visitNotificationAlertPage(page);

  await inputBasicAlertInformation({
    page,
    name: 'test-name',
    sourceName: SOURCE_NAME_1,
    sourceDisplayName: SOURCE_DISPLAY_NAME_1,
  });

  await page.click('[data-testid="add-destination-button"]');
  await addInternalDestination({
    page,
    destinationNumber: 0,
    category: 'Owners',
    type: 'G Chat',
  });

  await test.expect(page.getByTestId('test-destination-button')).toBeDisabled();

  await addExternalDestination({
    page,
    destinationNumber: 0,
    category: 'G Chat',
    input: 'https://google.com',
  });

  await page.click('[data-testid="add-destination-button"]');
  await addExternalDestination({
    page,
    destinationNumber: 1,
    category: 'Slack',
    input: 'https://slack.com',
    advancedConfig: {
      headers: [{ key: 'header1', value: 'value1' }],
      queryParams: [{ key: 'param1', value: 'value1' }],
    },
  });
  // Click add destination, to validate value with empty config should not be sent in test destination API call
  await page.click('[data-testid="add-destination-button"]');

  const testDestinations = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/events/subscriptions/testDestination') &&
      response.request().method() === 'POST' &&
      response.status() === 200
  );

  await page.click('[data-testid="test-destination-button"]');

  await testDestinations.then(async (response) => {
    const testResults = await response.json();

    expect(testResults).toHaveLength(2);

    for (const testResult of testResults) {
      const isGChat = testResult.type === 'GChat';

      await test
        .expect(
          page
            .getByTestId(`destination-${isGChat ? 0 : 1}`)
            .getByRole('alert')
            .getByText(testResult.statusDetails.status)
        )
        .toBeAttached();
    }
  });
});
