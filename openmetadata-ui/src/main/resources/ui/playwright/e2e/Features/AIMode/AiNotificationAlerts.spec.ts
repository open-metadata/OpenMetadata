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

import { expect, test } from '@playwright/test';
import { AlertClass } from '../../../support/entity/AlertClass';
import { performAdminLogin } from '../../../utils/admin';
import { getApiContext, uuid } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import {
  addFilter,
  dismissPopover,
  fillAlertName,
  getDestinationCategoryOptions,
  getFilterArgumentOptions,
  getFilterSelectOptions,
  openAddAlertModal,
  saveAlertModal,
  selectAlertSource,
  selectDestinationCategory,
} from '../../Utils/aiAlertModal';
import { enableAiAppMode, redirectToAiModeHomePage } from '../../Utils/appMode';
import {
  expectSurfaceTheme,
  expectTheme,
  seedTheme,
  UiTheme,
} from '../../Utils/theme';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

const THEMES: UiTheme[] = ['light', 'dark'];
const NOTIFICATION_ALERTS_PATH = '/settings/notifications/alerts';

test.describe('AI mode — Settings notification alerts use the AI alert pages', () => {
  let alert: AlertClass;
  // Alerts created inside tests; afterAll removes any a failed test left behind
  // (already-deleted ones answer 404, which is fine).
  const testAlerts: AlertClass[] = [];

  test.beforeAll(async ({ browser }) => {
    const setupPage = await browser.newPage();
    await redirectToAiModeHomePage(setupPage);
    const { apiContext, afterAction } = await getApiContext(setupPage);

    // The list is name-sorted and cursor-paged; this prefix keeps the alert on page 1.
    alert = new AlertClass({
      alertType: 'Notification',
      name: `0%0-pw-ai-notification-${uuid()}`,
    });
    await alert.create(apiContext);

    await afterAction();
    await setupPage.close();
  });

  test.afterAll(async ({ browser }) => {
    const teardownPage = await browser.newPage();
    const { apiContext, afterAction } = await getApiContext(teardownPage);

    await alert?.delete(apiContext);
    for (const testAlert of testAlerts) {
      await testAlert.delete(apiContext);
    }

    await afterAction();
    await teardownPage.close();
  });

  test.beforeEach(async ({ page }) => {
    await enableAiAppMode(page);
  });

  for (const theme of THEMES) {
    test(`notification list renders the AI alerts table (${theme})`, async ({
      page,
    }) => {
      await seedTheme(page, theme);

      await page.goto(NOTIFICATION_ALERTS_PATH, {
        waitUntil: 'domcontentloaded',
      });
      await waitForAllLoadersToDisappear(page);

      const shell = page.getByTestId('observability-page-shell');

      await expect(shell).toBeVisible();
      await expect(page.getByTestId('add-alert-button')).toBeVisible();
      // Page 1 always starts with the system alert; user alerts follow it.
      await expect(
        shell.getByRole('link', { name: 'Activity Feed Alerts' })
      ).toBeVisible();
      await expect(
        page.getByTestId(`alert-delete-${alert.responseData.name}`)
      ).toBeEnabled();

      // The system activity feed alert is listed but read-only.
      await expect(
        page.getByTestId('alert-edit-ActivityFeedAlert')
      ).toBeDisabled();
      await expect(
        page.getByTestId('alert-delete-ActivityFeedAlert')
      ).toBeDisabled();

      await expectTheme(page, theme);
      await expectSurfaceTheme(shell, theme);
    });

    test(`notification alert details render the AI details page under settings (${theme})`, async ({
      page,
    }) => {
      await seedTheme(page, theme);

      await page.goto(
        `${NOTIFICATION_ALERTS_PATH}/${encodeURIComponent(
          alert.responseData.fullyQualifiedName
        )}/configuration`,
        { waitUntil: 'domcontentloaded' }
      );
      await waitForAllLoadersToDisappear(page);

      const detailsPage = page.getByTestId('alert-details-ai-page');

      await expect(detailsPage).toBeVisible();
      await expect(page).toHaveURL(
        /\/settings\/notifications\/alerts\/[^/]+\/configuration$/
      );
      await expect(
        page.getByRole('link', { name: 'Notifications' })
      ).toBeVisible();

      await page.getByTestId('edit-button').click();
      const dialog = page.getByRole('dialog');

      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('textbox', { name: /name/i })).toHaveValue(
        alert.responseData.displayName
      );

      await expectTheme(page, theme);
      await expectSurfaceTheme(detailsPage, theme);
      await expectSurfaceTheme(dialog, theme);
    });
  }

  test('deletes a notification alert from the AI details page', async ({
    browser,
    page,
  }) => {
    // Created per test so repeated runs in one worker each have an alert to delete.
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const deletableAlert = new AlertClass({ alertType: 'Notification' });
    await deletableAlert.create(apiContext);
    await afterAction();
    testAlerts.push(deletableAlert);

    await page.goto(
      `${NOTIFICATION_ALERTS_PATH}/${encodeURIComponent(
        deletableAlert.responseData.fullyQualifiedName
      )}/configuration`,
      { waitUntil: 'domcontentloaded' }
    );
    await waitForAllLoadersToDisappear(page);

    await page.getByTestId('delete-button').click();

    const deleteResponse = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes(
            `/api/v1/events/subscriptions/${deletableAlert.responseData.id}`
          ) && response.request().method() === 'DELETE'
    );
    await page
      .getByTestId('delete-modal')
      .getByTestId('confirm-button')
      .click();

    expect((await deleteResponse).status()).toBe(200);
    await expect(page).toHaveURL(/\/settings\/notifications\/alerts$/);
  });
});

test.describe('AI mode — notification alert form keeps the classic behaviour', () => {
  const createdAlertIds: string[] = [];

  test.beforeEach(async ({ page }) => {
    await enableAiAppMode(page);
    await page.goto(NOTIFICATION_ALERTS_PATH, {
      waitUntil: 'domcontentloaded',
    });
    await waitForAllLoadersToDisappear(page);
  });

  test.afterAll(async ({ browser }) => {
    const teardownPage = await browser.newPage();
    const { apiContext, afterAction } = await getApiContext(teardownPage);

    for (const id of createdAlertIds) {
      await apiContext.delete(
        `/api/v1/events/subscriptions/${id}?hardDelete=true`
      );
    }

    await afterAction();
    await teardownPage.close();
  });

  test('narrows destinations and event types to what the source supports', async ({
    page,
  }) => {
    const dialog = await openAddAlertModal(page);

    await selectAlertSource(page, 'Conversation');
    await dialog.getByTestId('add-destination-button').click();

    const conversationCategories = await getDestinationCategoryOptions(
      page,
      dialog
    );

    expect(conversationCategories).toEqual(
      expect.arrayContaining(['Mentions', 'Owners', 'Slack', 'Webhook'])
    );
    expect(conversationCategories).not.toEqual(
      expect.arrayContaining(['Followers'])
    );
    expect(conversationCategories).not.toEqual(
      expect.arrayContaining(['Admins'])
    );
    expect(conversationCategories).not.toEqual(
      expect.arrayContaining(['Users'])
    );
    expect(conversationCategories).not.toEqual(
      expect.arrayContaining(['Teams'])
    );

    // Notification alerts have no triggers; only observability alerts do.
    await expect(dialog.getByTestId('add-actions')).toHaveCount(0);

    await dialog.getByTestId('add-filters').click();

    expect(await getFilterSelectOptions(page, dialog)).toEqual([
      'Mentioned Users',
    ]);

    await selectAlertSource(page, 'Table');
    await dialog.getByTestId('add-destination-button').click();

    const tableCategories = await getDestinationCategoryOptions(page, dialog);

    expect(tableCategories).toEqual(
      expect.arrayContaining(['Admins', 'Followers', 'Owners', 'Teams'])
    );
    expect(tableCategories).not.toEqual(expect.arrayContaining(['Mentions']));
    expect(tableCategories).not.toEqual(expect.arrayContaining(['Assignees']));

    await addFilter(page, dialog, 'Event Type');

    // The table resource supports 9 event types; the full enum has more.
    const eventTypes = await getFilterArgumentOptions(page, dialog);

    expect(eventTypes).toContain('Entity Created');
    expect(eventTypes).toHaveLength(9);
  });

  test('rejects alert names the classic form rejects', async ({ page }) => {
    const dialog = await openAddAlertModal(page);

    await fillAlertName(dialog, 'bad::name');
    await dialog.getByTestId('save-button').click();

    await expect(
      dialog.getByText(
        'Name must contain only letters, numbers, underscores, hyphens, periods, parenthesis, and ampersands.'
      )
    ).toBeVisible();

    await fillAlertName(dialog, 'a'.repeat(129));
    await dialog.getByTestId('save-button').click();

    await expect(dialog.getByText(/between 1 and 128/)).toBeVisible();
  });

  test('creates a notification alert with a filter and an advanced webhook destination', async ({
    page,
  }) => {
    const alertName = `pw-ai-notification-${uuid()}`;
    const dialog = await openAddAlertModal(page);

    await fillAlertName(dialog, alertName);
    await selectAlertSource(page, 'Table');
    await addFilter(page, dialog, 'Event Type');
    await getFilterArgumentOptions(page, dialog);
    await page.getByRole('option', { name: 'Entity Created' }).click();
    await dismissPopover(dialog);

    await dialog.getByTestId('add-destination-button').click();
    await selectDestinationCategory(page, dialog, 'Webhook');
    await dialog
      .getByTestId('endpoint-input-0')
      .getByRole('textbox')
      .fill('https://example.com/hook');
    await dialog.getByText('Advanced Configuration').click();
    await dialog.getByTestId('add-header-button-0').click();
    await dialog
      .getByTestId('header-key-input-0-0')
      .getByRole('textbox')
      .fill('X-Source');
    await dialog
      .getByTestId('header-value-input-0-0')
      .getByRole('textbox')
      .fill('openmetadata');
    await dialog.getByTestId('http-method-0').getByText('PUT').click();

    const { request, response } = await saveAlertModal(page, dialog);
    const body = request.postDataJSON();

    expect(request.method()).toBe('POST');
    expect(response?.status()).toBe(201);

    const created = await response?.json();
    createdAlertIds.push(created.id);

    expect(created.displayName).toBe(alertName);

    expect(body).toMatchObject({
      alertType: 'Notification',
      resources: ['table'],
      input: {
        filters: [
          expect.objectContaining({
            name: 'filterByEventType',
            effect: 'include',
          }),
        ],
      },
      destinations: [
        expect.objectContaining({
          category: 'External',
          type: 'Webhook',
          config: expect.objectContaining({
            endpoint: 'https://example.com/hook',
            headers: { 'X-Source': 'openmetadata' },
            httpMethod: 'PUT',
          }),
        }),
      ],
    });

    await expect(page).toHaveURL(
      `${NOTIFICATION_ALERTS_PATH}/${created.fullyQualifiedName}/configuration`
    );
    await expect(page.getByTestId('alert-details-ai-page')).toBeVisible();
  });

  test('edits a notification alert and sends a PATCH', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const editable = new AlertClass({ alertType: 'Notification' });
    await editable.create(apiContext);
    await afterAction();
    createdAlertIds.push(editable.responseData.id);

    await page.goto(
      `${NOTIFICATION_ALERTS_PATH}/${encodeURIComponent(
        editable.responseData.fullyQualifiedName
      )}/configuration`,
      { waitUntil: 'domcontentloaded' }
    );
    await waitForAllLoadersToDisappear(page);

    await page.getByTestId('edit-button').click();
    const dialog = page.getByRole('dialog');
    const description = `edited from AI mode ${uuid()}`;
    await dialog
      .getByTestId('description')
      .getByRole('textbox')
      .fill(description);

    const { request, response } = await saveAlertModal(page, dialog);

    expect(request.method()).toBe('PATCH');
    expect(response?.status()).toBe(200);
    expect(request.postDataJSON()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/description', value: description }),
      ])
    );

    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('alert-details-ai-page')).toContainText(
      description
    );
  });
});
