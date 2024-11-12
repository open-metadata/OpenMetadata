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

import test, { expect } from '@playwright/test';
import { ALERT_UPDATED_DESCRIPTION } from '../../constant/alert';
import { Domain } from '../../support/domain/Domain';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { UserClass } from '../../support/user/UserClass';
import {
  addExternalDestination,
  addFilterWithUsersListInput,
  addInternalDestination,
  addMultipleFilters,
  addOwnerFilter,
  deleteAlert,
  generateAlertName,
  inputBasicAlertInformation,
  saveAlertAndVerifyResponse,
  verifyAlertDetails,
  visitAlertDetailsPage,
  visitEditAlertPage,
  visitNotificationAlertPage,
} from '../../utils/alert';
import { createNewPage, descriptionBox } from '../../utils/common';

const dashboard = new DashboardClass();
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

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Notification Alert Flow', () => {
  const data = {
    alertDetails: {
      id: '',
      name: '',
      description: '',
      filteringRules: { resources: [] },
      input: { filters: [], actions: [] },
      destinations: [],
    },
  };

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await dashboard.create(apiContext);
    await user1.create(apiContext);
    await user2.create(apiContext);
    await domain.create(apiContext);
    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await dashboard.delete(apiContext);
    await user1.delete(apiContext);
    await user2.delete(apiContext);
    await domain.delete(apiContext);
    await afterAction();
  });

  test.beforeEach('Visit entity details page', async ({ page }) => {
    await visitNotificationAlertPage(page);
  });

  test('Single Filter Alert', async ({ page }) => {
    test.slow();

    const ALERT_NAME = generateAlertName();

    await test.step('Create alert', async () => {
      await inputBasicAlertInformation({
        page,
        name: ALERT_NAME,
        sourceName: SOURCE_NAME_1,
        sourceDisplayName: SOURCE_DISPLAY_NAME_1,
      });

      // Select filters
      await page.click('[data-testid="add-filters"]');

      await addOwnerFilter({
        page,
        filterNumber: 0,
        ownerName: user1.getUserName(),
      });

      // Select Destination
      await page.click('[data-testid="add-destination-button"]');

      await addInternalDestination({
        page,
        destinationNumber: 0,
        category: 'Admins',
        type: 'Email',
      });

      data.alertDetails = await saveAlertAndVerifyResponse(page);
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
        await visitEditAlertPage(page, data.alertDetails);

        // Update description
        await page.locator(descriptionBox).clear();
        await page.locator(descriptionBox).fill(ALERT_UPDATED_DESCRIPTION);

        // Update source
        await page.click('[data-testid="source-select"]');
        await page
          .getByTestId(`${SOURCE_NAME_2}-option`)
          .getByText(SOURCE_DISPLAY_NAME_2)
          .click();

        // Filters should reset after source change
        await expect(page.getByTestId('filter-select-0')).not.toBeAttached();

        await addMultipleFilters({
          page,
          user1,
          user2,
          domain,
          dashboard,
        });

        await page.getByTestId('connection-timeout-input').clear();
        await page.fill('[data-testid="connection-timeout-input"]', '26');

        // Add owner GChat destination
        await page.click('[data-testid="add-destination-button"]');
        await addInternalDestination({
          page,
          destinationNumber: 0,
          category: 'Owners',
          type: 'G Chat',
        });

        // Add team Slack destination
        await page.click('[data-testid="add-destination-button"]');
        await addInternalDestination({
          page,
          destinationNumber: 1,
          category: 'Teams',
          type: 'Slack',
          typeId: 'Team-select',
          searchText: 'Organization',
        });

        // Add user email destination
        await page.click('[data-testid="add-destination-button"]');
        await addInternalDestination({
          page,
          destinationNumber: 2,
          category: 'Users',
          type: 'Email',
          typeId: 'User-select',
          searchText: user1.getUserName(),
        });

        // Click save
        const updateAlert = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/events/subscriptions') &&
            response.request().method() === 'PUT' &&
            response.status() === 200
        );
        await page.click('[data-testid="save-button"]');
        await updateAlert.then(async (response) => {
          data.alertDetails = await response.json();

          expect(response.status()).toEqual(200);

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

    await test.step('Create alert', async () => {
      await inputBasicAlertInformation({
        page,
        name: ALERT_NAME,
        sourceName: SOURCE_NAME_1,
        sourceDisplayName: SOURCE_DISPLAY_NAME_1,
      });

      await addMultipleFilters({
        page,
        user1,
        user2,
        domain,
        dashboard,
      });

      await page.click('[data-testid="add-destination-button"]');
      await addInternalDestination({
        page,
        destinationNumber: 0,
        category: 'Followers',
        type: 'Email',
      });
      await page.click('[data-testid="add-destination-button"]');
      await addExternalDestination({
        page,
        destinationNumber: 1,
        category: 'Email',
        input: 'test@example.com',
      });
      await page.click('[data-testid="add-destination-button"]');
      await addExternalDestination({
        page,
        destinationNumber: 2,
        category: 'G Chat',
        input: 'https://gchat.com',
      });
      await page.click('[data-testid="add-destination-button"]');
      await addExternalDestination({
        page,
        destinationNumber: 3,
        category: 'Webhook',
        input: 'https://webhook.com',
      });
      await page.click('[data-testid="add-destination-button"]');
      await addExternalDestination({
        page,
        destinationNumber: 4,
        category: 'Ms Teams',
        input: 'https://msteams.com',
      });
      await page.click('[data-testid="add-destination-button"]');
      await addExternalDestination({
        page,
        destinationNumber: 5,
        category: 'Slack',
        input: 'https://slack.com',
      });

      data.alertDetails = await saveAlertAndVerifyResponse(page);
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
            response.request().method() === 'PUT' &&
            response.status() === 200
        );
        await page.click('[data-testid="save-button"]');
        await updateAlert.then(async (response) => {
          data.alertDetails = await response.json();

          expect(response.status()).toEqual(200);

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

    await test.step('Create alert', async () => {
      await inputBasicAlertInformation({
        page,
        name: ALERT_NAME,
        sourceName: SOURCE_NAME_3,
        sourceDisplayName: SOURCE_DISPLAY_NAME_3,
      });

      // Select Destination
      await page.click('[data-testid="add-destination-button"]');
      await addInternalDestination({
        page,
        destinationNumber: 0,
        category: 'Owners',
        type: 'Email',
      });
      await page.click('[data-testid="add-destination-button"]');
      await addInternalDestination({
        page,
        destinationNumber: 1,
        category: 'Assignees',
        type: 'Email',
      });
      data.alertDetails = await saveAlertAndVerifyResponse(page);
    });

    await test.step('Delete alert', async () => {
      await deleteAlert(page, data.alertDetails);
    });
  });

  test('Conversation source alert', async ({ page }) => {
    const ALERT_NAME = generateAlertName();

    await test.step('Create alert', async () => {
      await inputBasicAlertInformation({
        page,
        name: ALERT_NAME,
        sourceName: SOURCE_NAME_4,
        sourceDisplayName: SOURCE_DISPLAY_NAME_4,
      });

      // Select Destination
      await page.click('[data-testid="add-destination-button"]');
      await addInternalDestination({
        page,
        destinationNumber: 0,
        category: 'Owners',
        type: 'Email',
      });

      data.alertDetails = await saveAlertAndVerifyResponse(page);
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
          response.request().method() === 'PUT' &&
          response.status() === 200
      );
      await page.click('[data-testid="save-button"]');
      await updateAlert.then(async (response) => {
        data.alertDetails = await response.json();

        expect(response.status()).toEqual(200);

        // Verify the edited alert changes
        await verifyAlertDetails({ page, alertDetails: data.alertDetails });
      });
    });

    await test.step('Delete alert', async () => {
      await deleteAlert(page, data.alertDetails);
    });
  });
});
