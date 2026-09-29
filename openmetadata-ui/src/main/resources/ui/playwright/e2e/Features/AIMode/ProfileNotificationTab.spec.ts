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

/**
 * Notification Alerts — Profile Page E2E Coverage (AI Mode)
 *
 * Exercises alert CRUD, source-specific flows, destination config, permissions,
 * and recent-events verification through the AI-mode Profile → Notification tab.
 *
 * Replaces the old Settings-based `NotificationAlerts.spec.ts`.
 */

import { Page } from '@playwright/test';
import { ALERT_UPDATED_DESCRIPTION } from '../../../constant/alert';
import { AlertDetails } from '../../../constant/alert.interface';
import { Domain } from '../../../support/domain/Domain';
import { DashboardClass } from '../../../support/entity/DashboardClass';
import { TableClass } from '../../../support/entity/TableClass';
import { expect, test as base } from '../../../support/fixtures/base';
import { AdminClass } from '../../../support/user/AdminClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import {
  commonCleanup,
  commonPrerequisites,
  generateAlertName,
  waitForRecentEventsToFinishExecution,
} from '../../../utils/alert';
import { getApiContext } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import {
  addEntityFQNFilterProfile,
  addEventTypeFilterProfile,
  addExternalDestinationProfile,
  addInternalDestinationProfile,
  addMentionedUsersFilterProfile,
  addMultipleFiltersProfile,
  addOwnerFilterProfile,
  checkRecentEventDetailsProfile,
  deleteAlertFromList,
  inputAlertInformation,
  navigateToAlertDetail,
  navigateToAlertsList,
  navigateToEditAlert,
  saveNewAlertAndVerify,
} from '../../../utils/profileNotificationAlert';

// ── Test entities (instantiated in beforeAll) ────────────────────────────────

let dashboard: DashboardClass;
let table: TableClass;
let admin: AdminClass;
let user1: UserClass;
let user2: UserClass;
let domain: Domain;

const SOURCE_NAME_1 = 'all';
const SOURCE_NAME_3 = 'task';
const SOURCE_NAME_4 = 'conversation';
const SOURCE_NAME_5 = 'table';

// Admin page fixture — tests call getApiContext(page) for backend operations
// (delete/restore table), which reads the OIDC token from IndexedDB. storageState
// only restores cookies/localStorage, not IndexedDB, so we need a real login.
const test = base.extend<{ page: Page }>({
  page: async ({ browser }, use) => {
    // eslint-disable-next-line no-restricted-syntax -- getApiContext reads OIDC token from IndexedDB; storageState does not restore it
    const page = await browser.newPage();
    await admin.login(page);
    await use(page);
    await page.close();
  },
});

const data: { alertDetails: AlertDetails } = {
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
  dashboard = new DashboardClass();
  table = new TableClass();
  admin = new AdminClass();
  user1 = new UserClass();
  user2 = new UserClass();
  domain = new Domain();

  const { afterAction, apiContext } = await performAdminLogin(browser);
  await commonPrerequisites({ apiContext, table, user1, user2, domain });
  await dashboard.create(apiContext);
  await afterAction();
});

test.afterAll('Cleanup', async ({ browser }) => {
  const { afterAction, apiContext } = await performAdminLogin(browser);
  await commonCleanup({ apiContext, table, user1, user2, domain });
  await dashboard.delete(apiContext);
  await afterAction();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

test('Single Filter Alert', async ({ page }) => {
  test.slow();
  const ALERT_NAME = generateAlertName();
  await navigateToAlertsList(page);

  await test.step('Create alert', async () => {
    await page.getByTestId('add-alert').click();
    await inputAlertInformation({
      page,
      name: ALERT_NAME,
      sourceName: SOURCE_NAME_1,
    });

    await page.getByTestId('add-filters').click();
    await addOwnerFilterProfile({
      page,
      filterNumber: 0,
      ownerName: user1.getUserDisplayName(),
    });

    await page.click('[data-testid="add-destination-button"]');
    await addInternalDestinationProfile({
      page,
      destinationNumber: 0,
      category: 'Admins',
      type: 'Email',
    });

    data.alertDetails = await saveNewAlertAndVerify(page);
  });

  await test.step('Check created alert details', async () => {
    await navigateToAlertsList(page);
    await navigateToAlertDetail(page, data.alertDetails);
    await expect(page.getByTestId('edit-description-btn')).toBeVisible();
  });

  await test.step('Edit alert by adding multiple filters and destinations', async () => {
    await navigateToAlertsList(page);
    await navigateToEditAlert(page, data.alertDetails);

    const nameInput = page.getByTestId('alert-name-input').getByRole('textbox');
    await expect(nameInput).toBeVisible();

    const descriptionTextArea = page
      .getByTestId('description')
      .getByRole('textbox');
    await descriptionTextArea.clear();
    await descriptionTextArea.fill(ALERT_UPDATED_DESCRIPTION);

    // Remove existing filter from creation before adding new ones
    await page.click('[data-testid="remove-filters-0"]');
    await expect(page.getByTestId('filters-0')).toHaveCount(0);

    await addMultipleFiltersProfile({ page, user1, user2, domain, dashboard });

    // Remove existing destination from creation before adding new ones
    await page.click('[data-testid="remove-destination-0"]');
    await page.getByTestId('destination-0').waitFor({ state: 'detached' });

    await page.click('[data-testid="add-destination-button"]');
    await addInternalDestinationProfile({
      page,
      destinationNumber: 0,
      category: 'Owners',
      type: 'Email',
    });

    await page.click('[data-testid="add-destination-button"]');
    await addInternalDestinationProfile({
      page,
      destinationNumber: 1,
      category: 'Followers',
      type: 'Email',
    });

    await page.click('[data-testid="add-destination-button"]');
    await addInternalDestinationProfile({
      page,
      destinationNumber: 2,
      category: 'Admins',
      type: 'Email',
    });

    const updateAlert = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/events/subscriptions') &&
        response.request().method() === 'PATCH'
    );
    await page.getByTestId('save-btn').click();
    const patchResponse = await updateAlert;
    expect(patchResponse.status()).toBe(200);
    data.alertDetails = await patchResponse.json();

    await waitForAllLoadersToDisappear(page);
  });

  await test.step('Delete alert', async () => {
    await navigateToAlertsList(page);
    await deleteAlertFromList(page, data.alertDetails);
  });
});

test('Multiple Filters Alert', async ({ page }) => {
  test.slow();
  const ALERT_NAME = generateAlertName();
  await navigateToAlertsList(page);

  await test.step('Create alert', async () => {
    await page.getByTestId('add-alert').click();
    await inputAlertInformation({
      page,
      name: ALERT_NAME,
      sourceName: SOURCE_NAME_1,
    });

    await addMultipleFiltersProfile({ page, user1, user2, domain, dashboard });

    await page.click('[data-testid="add-destination-button"]');
    await addInternalDestinationProfile({
      page,
      destinationNumber: 0,
      category: 'Followers',
      type: 'Email',
    });
    await page.click('[data-testid="add-destination-button"]');
    await addExternalDestinationProfile({
      page,
      destinationNumber: 1,
      category: 'Email',
      input: 'test@example.com',
    });
    await page.click('[data-testid="add-destination-button"]');
    await addExternalDestinationProfile({
      page,
      destinationNumber: 2,
      category: 'G Chat',
      input: 'https://gchat.com',
    });
    await page.click('[data-testid="add-destination-button"]');
    await addExternalDestinationProfile({
      page,
      destinationNumber: 3,
      category: 'Webhook',
      input: 'https://webhook.com',
    });
    await page.click('[data-testid="add-destination-button"]');
    await addExternalDestinationProfile({
      page,
      destinationNumber: 4,
      category: 'Ms Teams',
      input: 'https://msteams.com',
    });
    await page.click('[data-testid="add-destination-button"]');
    await addExternalDestinationProfile({
      page,
      destinationNumber: 5,
      category: 'Slack',
      input: 'https://slack.com',
    });

    data.alertDetails = await saveNewAlertAndVerify(page);
  });

  await test.step('Edit alert by removing filters and destinations', async () => {
    await navigateToAlertsList(page);
    await navigateToEditAlert(page, data.alertDetails);

    const nameInput = page.getByTestId('alert-name-input').getByRole('textbox');
    await expect(nameInput).toBeVisible();

    const descriptionTextArea = page
      .getByTestId('description')
      .getByRole('textbox');
    await descriptionTextArea.clear();

    for (let i = 5; i >= 0; i--) {
      await page.click(`[data-testid="remove-filters-${i}"]`);
      await expect(page.getByTestId(`filters-${i}`)).toHaveCount(0);
    }

    for (let i = 5; i > 0; i--) {
      await page.click(`[data-testid="remove-destination-${i}"]`);
      await page.getByTestId(`destination-${i}`).waitFor({ state: 'detached' });
    }

    const updateAlert = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/events/subscriptions') &&
        response.request().method() === 'PATCH'
    );
    await page.getByTestId('save-btn').click();
    const patchResponse = await updateAlert;
    expect(patchResponse.status()).toBe(200);
    data.alertDetails = await patchResponse.json();

    await waitForAllLoadersToDisappear(page);
  });

  await test.step('Delete alert', async () => {
    await navigateToAlertsList(page);
    await deleteAlertFromList(page, data.alertDetails);
  });
});

test('Task source alert', async ({ page }) => {
  const ALERT_NAME = generateAlertName();
  await navigateToAlertsList(page);

  await test.step('Create alert', async () => {
    await page.getByTestId('add-alert').click();
    await inputAlertInformation({
      page,
      name: ALERT_NAME,
      sourceName: SOURCE_NAME_3,
    });

    await page.click('[data-testid="add-destination-button"]');
    await addInternalDestinationProfile({
      page,
      destinationNumber: 0,
      category: 'Owners',
      type: 'Email',
    });
    await page.click('[data-testid="add-destination-button"]');
    await addInternalDestinationProfile({
      page,
      destinationNumber: 1,
      category: 'Assignees',
      type: 'Email',
    });

    data.alertDetails = await saveNewAlertAndVerify(page);
  });

  await test.step('Delete alert', async () => {
    await navigateToAlertsList(page);
    await deleteAlertFromList(page, data.alertDetails);
  });
});

test('Conversation source alert', async ({ page }) => {
  const ALERT_NAME = generateAlertName();
  await navigateToAlertsList(page);

  await test.step('Create alert', async () => {
    await page.getByTestId('add-alert').click();
    await inputAlertInformation({
      page,
      name: ALERT_NAME,
      sourceName: SOURCE_NAME_4,
    });

    await page.click('[data-testid="add-destination-button"]');
    await addInternalDestinationProfile({
      page,
      destinationNumber: 0,
      category: 'Owners',
      type: 'Email',
    });

    data.alertDetails = await saveNewAlertAndVerify(page);
  });

  await test.step('Edit alert by adding mentions filter', async () => {
    await navigateToAlertsList(page);
    await navigateToEditAlert(page, data.alertDetails);

    const nameInput = page.getByTestId('alert-name-input').getByRole('textbox');
    await expect(nameInput).toBeVisible();

    await page.getByTestId('add-filters').click();
    await addMentionedUsersFilterProfile({
      page,
      filterNumber: 0,
      userName: user1.getUserDisplayName(),
      exclude: true,
    });

    await page.click('[data-testid="add-destination-button"]');
    await addInternalDestinationProfile({
      page,
      destinationNumber: 1,
      category: 'Mentions',
      type: 'Slack',
    });

    const updateAlert = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/events/subscriptions') &&
        response.request().method() === 'PATCH'
    );
    await page.getByTestId('save-btn').click();
    const patchResponse = await updateAlert;
    expect(patchResponse.status()).toBe(200);
    data.alertDetails = await patchResponse.json();

    await waitForAllLoadersToDisappear(page);
  });

  await test.step('Delete alert', async () => {
    await navigateToAlertsList(page);
    await deleteAlertFromList(page, data.alertDetails);
  });
});

/**
 * Alert with recent events — admin-only (notification tab is admin-gated).
 * Creates a table-scoped alert, triggers via soft-delete/restore, verifies events.
 */
test('Alert with recent events check', async ({ page }) => {
  test.slow();
  const ALERT_NAME = generateAlertName();
  const { apiContext } = await getApiContext(page);
  await navigateToAlertsList(page);

  await test.step('Create and trigger alert', async () => {
    await page.getByTestId('add-alert').click();
    await inputAlertInformation({
      page,
      name: ALERT_NAME,
      sourceName: SOURCE_NAME_5,
    });

    await page.getByTestId('add-filters').click();
    await addEntityFQNFilterProfile({
      page,
      filterNumber: 0,
      entityFQN: (table.entityResponseData as { fullyQualifiedName: string })
        .fullyQualifiedName,
    });

    await page.getByTestId('add-filters').click();
    await addEventTypeFilterProfile({
      page,
      filterNumber: 1,
      eventTypes: ['Entity Soft Deleted', 'Entity Restored'],
    });

    await page.click('[data-testid="add-destination-button"]');
    await addInternalDestinationProfile({
      page,
      destinationNumber: 0,
      category: 'Owners',
      type: 'Email',
    });

    data.alertDetails = await saveNewAlertAndVerify(page);

    await table.deleteTable(apiContext, false);
    await table.restore(apiContext);
  });

  await test.step('Check alert details and recent events', async () => {
    await navigateToAlertsList(page);

    await waitForRecentEventsToFinishExecution(page, data.alertDetails.name, 2);

    await navigateToAlertDetail(page, data.alertDetails);

    await expect(page.getByTestId('edit-description-btn')).toBeVisible();

    await checkRecentEventDetailsProfile({
      page,
      alertDetails: data.alertDetails,
      table,
      totalEventsCount: 2,
    });
  });

  await test.step('Delete alert', async () => {
    await navigateToAlertsList(page);
    await deleteAlertFromList(page, data.alertDetails);
  });
});

test('Destination should work properly', async ({ page }) => {
  await navigateToAlertsList(page);
  await page.getByTestId('add-alert').click();

  await inputAlertInformation({
    page,
    name: 'test-name',
    sourceName: SOURCE_NAME_1,
  });

  await page.click('[data-testid="add-destination-button"]');
  await addInternalDestinationProfile({
    page,
    destinationNumber: 0,
    category: 'Owners',
    type: 'G Chat',
  });

  await expect(page.getByTestId('test-destination-button')).toBeDisabled();

  await addExternalDestinationProfile({
    page,
    destinationNumber: 0,
    category: 'G Chat',
    input: 'https://google.com',
  });

  await page.click('[data-testid="add-destination-button"]');
  await addExternalDestinationProfile({
    page,
    destinationNumber: 1,
    category: 'Slack',
    input: 'https://slack.com',
    advancedConfig: {
      headers: [{ key: 'header1', value: 'value1' }],
      queryParams: [{ key: 'param1', value: 'value1' }],
    },
  });

  await page.click('[data-testid="add-destination-button"]');

  const testButton = page.getByTestId('test-destination-button');
  await expect(testButton).toBeVisible();
  await expect(testButton).toBeEnabled();

  const testDestinations = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/events/subscriptions/testDestination') &&
      response.request().method() === 'POST'
  );

  await testButton.click();

  const testResponse = await testDestinations;
  expect(testResponse.status()).toBe(200);
  await testResponse.json().then(async (testResults) => {
    expect(testResults).toHaveLength(2);

    for (const testResult of testResults) {
      const isGChat = testResult.type === 'GChat';

      await expect(
        page
          .getByTestId(`destination-${isGChat ? 0 : 1}`)
          .getByRole('alert')
          .getByText(testResult.statusDetails.status)
      ).toBeAttached();
    }
  });
});

test('System alert is read-only', async ({ page }) => {
  await navigateToAlertsList(page);

  await expect(
    page.getByTestId('alert-edit-Activity Feed Alerts')
  ).not.toBeAttached();
  await expect(
    page.getByTestId('alert-delete-Activity Feed Alerts')
  ).not.toBeAttached();

  const detailResponse = page.waitForResponse(
    (res) =>
      res.url().includes('/api/v1/events/subscriptions/name/') &&
      res.request().method() === 'GET'
  );
  await page
    .getByTestId('alert-Activity Feed Alerts')
    .getByTestId('alert-name')
    .click();
  await detailResponse;
  await waitForAllLoadersToDisappear(page);

  await expect(page.getByTestId('edit-alert-btn')).not.toBeAttached();
  await expect(page.getByTestId('delete-alert-btn')).not.toBeAttached();
});

test('Breadcrumb navigation', async ({ page }) => {
  await navigateToAlertsList(page);

  await page.getByTestId('add-alert').click();
  await expect(page.getByTestId('alert-name-input')).toBeVisible();

  await page.getByRole('link', { name: /alert/i }).click();
  await expect(page.getByTestId('alerts-list-container')).toBeVisible();

  await page.getByRole('link', { name: /notification/i }).click();
  await expect(page.getByTestId('notification-landing')).toBeVisible();
});
