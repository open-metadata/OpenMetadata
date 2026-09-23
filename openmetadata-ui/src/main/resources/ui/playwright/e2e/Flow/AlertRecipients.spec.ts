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
import { AlertDetails } from '../../constant/alert.interface';
import { expect, test } from '../../support/fixtures/base';
import { performAdminLogin } from '../../utils/admin';
import {
  generateAlertName,
  inputBasicAlertInformation,
  visitAlertDetailsPage,
  visitEditAlertPage,
} from '../../utils/alert';
import { visitNotificationAlertPage } from '../../utils/notificationAlert';

test.use({ storageState: 'playwright/.auth/admin.json' });

// The recipient categories the server says each selection reaches, in the order the form lists them.
const OFFERED: Array<{ sources: string[]; recipients: string[] }> = [
  { sources: ['task'], recipients: ['Assignees', 'Mentions', 'Owners'] },
  { sources: ['conversation'], recipients: ['Mentions', 'Owners'] },
  {
    sources: ['table'],
    recipients: ['Admins', 'Followers', 'Owners', 'Teams', 'Users'],
  },
  {
    sources: ['task', 'conversation'],
    recipients: ['Assignees', 'Mentions', 'Owners'],
  },
];

const DISPLAY_NAMES: Record<string, string> = {
  task: 'Task',
  conversation: 'Conversation',
  table: 'Table',
};

const addSource = async (page: Page, sourceName: string) => {
  const capabilities = page.waitForResponse(
    '/api/v1/events/subscriptions/capabilities'
  );
  await page.getByTestId('source-select').getByRole('combobox').click();
  await page.getByRole('listbox').getByTestId(`${sourceName}-option`).click();
  await capabilities;
  await page.keyboard.press('Escape');
};

// The options between the "Internal" and "External" headers of the first destination.
const offeredInsideThePlatform = async (page: Page) => {
  const input = page
    .getByTestId('destination-category-select-0')
    .getByRole('combobox');
  if ((await input.getAttribute('aria-expanded')) !== 'true') {
    await input.fill('');
    await input.press('ArrowDown');
  }
  const listboxId = await input.getAttribute('aria-controls');
  const names = await page
    .locator(`[role="listbox"][id="${listboxId}"]`)
    .getByRole('option')
    .allTextContents();
  await input.press('Escape');
  const trimmed = names.map((name) => name.trim());

  return trimmed.slice(
    trimmed.indexOf('Internal') + 1,
    trimmed.indexOf('External')
  );
};

test.describe('Recipients inside the platform', () => {
  for (const { sources, recipients } of OFFERED) {
    test(`follow what ${sources.join(' and ')} reach`, async ({ page }) => {
      const [first, ...others] = sources;
      await visitNotificationAlertPage(page);
      await inputBasicAlertInformation({
        page,
        name: generateAlertName(),
        sourceName: first,
        sourceDisplayName: DISPLAY_NAMES[first],
      });
      for (const source of others) {
        await addSource(page, source);
      }
      await page.getByTestId('add-destination-button').click();

      await expect
        .poll(() => offeredInsideThePlatform(page))
        .toEqual(recipients);
    });
  }

  test('a saved recipient the sources no longer reach still opens and saves', async ({
    page,
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const created = await apiContext.post('/api/v1/events/subscriptions', {
      data: {
        name: generateAlertName(),
        alertType: 'Notification',
        resources: ['task'],
        enabled: true,
        destinations: [{ category: 'Followers', type: 'Email' }],
      },
    });
    expect(created.ok()).toBeTruthy();
    const alert: AlertDetails = await created.json();
    const category = page
      .getByTestId('destination-category-select-0')
      .getByRole('combobox');

    try {
      await visitNotificationAlertPage(page);
      await visitAlertDetailsPage(page, alert);
      await expect(category).toHaveValue('Followers');

      await visitEditAlertPage(page, alert);
      await expect(category).toHaveValue('Followers');
      const saved = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/v1/events/subscriptions/${alert.id}`) &&
          response.request().method() === 'PATCH'
      );
      await page.getByTestId('save-button').click();
      const response = await saved;

      expect(response.status()).toBe(200);
      const body: AlertDetails = await response.json();
      expect(body.destinations[0].category).toBe('Followers');
    } finally {
      await apiContext.delete(
        `/api/v1/events/subscriptions/${alert.id}?hardDelete=true`
      );
      await afterAction();
    }
  });
});
