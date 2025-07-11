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

import { Page, test as base } from '@playwright/test';
import { Domain } from '../../support/domain/Domain';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { TableClass } from '../../support/entity/TableClass';
import { AdminClass } from '../../support/user/AdminClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
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

test('Single Filter Alert', async ({ page }) => {
  test.slow();

  const ALERT_NAME = generateAlertName();
  await visitNotificationAlertPage(page);

  await test.step('Create alert', async () => {
    data.alertDetails = await createAlert({
      page,
      alertName: ALERT_NAME,
      sourceName: SOURCE_NAME_1,
      sourceDisplayName: SOURCE_DISPLAY_NAME_1,
      user: user1,
    });
  });

  await test.step('Check created alert details', async () => {
    await visitNotificationAlertPage(page);
    await visitAlertDetailsPage(page, data.alertDetails);

    // Verify alert details
    await verifyAlertDetails({ page, alertDetails: data.alertDetails });
  });

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

  await test.step('Delete alert', async () => {
    await deleteAlert(page, data.alertDetails);
  });
});

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

  await test.step(
    'Edit alert by removing added filters and internal destinations',
    async () => {
      await visitEditAlertPage(page, data.alertDetails);

      // Remove description
      await page.locator(descriptionBox).clear();

      // Remove all filters
      for (const _ of Array(6).keys()) {
        await page.click('[data-testid="remove-filter-0"]');
      }

      // Remove all destinations except one
      for (const _ of Array(5).keys()) {
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

  await test.step('Delete alert', async () => {
    await deleteAlert(page, data.alertDetails);
  });
});

test('Task source alert', async ({ page }) => {
  const ALERT_NAME = generateAlertName();
  await visitNotificationAlertPage(page);

  await test.step('Create alert', async () => {
    data.alertDetails = await createTaskAlert({
      page,
      alertName: ALERT_NAME,
      sourceName: SOURCE_NAME_3,
      sourceDisplayName: SOURCE_DISPLAY_NAME_3,
    });
  });

  await test.step('Delete alert', async () => {
    await deleteAlert(page, data.alertDetails);
  });
});

test('Conversation source alert', async ({ page }) => {
  const ALERT_NAME = generateAlertName();
  await visitNotificationAlertPage(page);

  await test.step('Create alert', async () => {
    data.alertDetails = await createConversationAlert({
      page,
      alertName: ALERT_NAME,
      sourceName: SOURCE_NAME_4,
      sourceDisplayName: SOURCE_DISPLAY_NAME_4,
    });
  });

  await test.step('Edit alert by adding mentions filter', async () => {
    await visitEditAlertPage(page, data.alertDetails);

    // Add filter
    await page.click('[data-testid="add-filters"]');

    await addFilterWithUsersListInput({
      page,
      filterNumber: 0,
      updaterName: user1.getUserName(),
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

  await test.step('Delete alert', async () => {
    await deleteAlert(page, data.alertDetails);
  });
});

test('Alert operations for a user with and without permissions', async ({
  page,
  userWithPermissionsPage,
  userWithoutPermissionsPage,
}) => {
  test.slow();

  const ALERT_NAME = generateAlertName();
  const { apiContext } = await getApiContext(page);
  await visitNotificationAlertPage(userWithPermissionsPage);

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

  await test.step('Checks for user without permission', async () => {
    await checkAlertFlowForWithoutPermissionUser({
      page: userWithoutPermissionsPage,
      alertDetails: data.alertDetails,
      sourceName: SOURCE_NAME_5,
      table,
    });
  });

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

  await test.step('Delete alert', async () => {
    await deleteAlert(userWithPermissionsPage, data.alertDetails);
  });
});

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
  });

  const testDestinations = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/events/subscriptions/testDestination') &&
      response.request().method() === 'POST' &&
      response.status() === 200
  );

  await page.click('[data-testid="test-destination-button"]');

  await testDestinations.then(async (response) => {
    const testResults = await response.json();

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
