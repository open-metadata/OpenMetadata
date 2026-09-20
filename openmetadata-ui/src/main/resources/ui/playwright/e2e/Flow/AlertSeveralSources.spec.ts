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
import { expect, test } from '../../support/fixtures/base';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  addOwnerFilter,
  deleteAlert,
  generateAlertName,
  inputBasicAlertInformation,
  saveAlertAndVerifyResponse,
} from '../../utils/alert';
import {
  addInternalDestination,
  visitNotificationAlertPage,
} from '../../utils/notificationAlert';
import { visitObservabilityAlertPage } from '../../utils/observabilityAlert';

const owner = new UserClass();

test.use({ storageState: 'playwright/.auth/admin.json' });

const addSource = async (page: Page, sourceName: string) => {
  const capabilities = page.waitForResponse(
    '/api/v1/events/subscriptions/capabilities'
  );
  await page.getByTestId('source-select').click();
  await page
    .locator('.ant-select-dropdown:visible')
    .getByTestId(`${sourceName}-option`)
    .click();
  await capabilities;
  await page.keyboard.press('Escape');
};

test.beforeAll(async ({ browser }) => {
  const { afterAction, apiContext } = await performAdminLogin(browser);
  await owner.create(apiContext);
  await afterAction();
});

test.afterAll(async ({ browser }) => {
  const { afterAction, apiContext } = await performAdminLogin(browser);
  await owner.delete(apiContext);
  await afterAction();
});

test.describe('Alerts with several sources', () => {
  test('Notification alert on table and dashboard with an owner filter', async ({
    page,
  }) => {
    test.slow();

    await visitNotificationAlertPage(page);
    await inputBasicAlertInformation({
      page,
      name: generateAlertName(),
      sourceName: 'table',
      sourceDisplayName: 'Table',
    });
    await addSource(page, 'dashboard');

    await test.step('A source of another kind cannot join, and says why', async () => {
      // The list is virtual, so an option far down exists only once it is searched for.
      await page.getByTestId('source-select').click();
      await page.getByTestId('source-select').locator('input').fill('conv');
      const conversation = page
        .locator('.ant-select-dropdown:visible')
        .getByTestId('conversation-option');

      await expect(conversation).toBeVisible();
      await expect(
        page
          .locator('.ant-select-dropdown:visible')
          .getByTestId('conversation-reason')
      ).toBeVisible();

      await expect(
        page
          .locator('.ant-select-dropdown:visible')
          .locator('.ant-select-item-option-disabled')
      ).toHaveCount(1);

      await page.getByTestId('source-select').locator('input').fill('');
      await page.keyboard.press('Escape');
    });

    await page.click('[data-testid="add-filters"]');
    await addOwnerFilter({
      page,
      filterNumber: 0,
      ownerName: owner.getUserDisplayName(),
    });
    await page.click('[data-testid="add-destination-button"]');
    await addInternalDestination({
      page,
      destinationNumber: 0,
      category: 'Admins',
      type: 'Email',
    });

    const alertDetails = await saveAlertAndVerifyResponse(page);

    expect(alertDetails.filteringRules.resources).toEqual([
      'table',
      'dashboard',
    ]);

    await deleteAlert(page, alertDetails);
  });

  test('Observability alert warns about a source its trigger never reaches', async ({
    page,
  }) => {
    test.slow();

    await visitObservabilityAlertPage(page);
    await inputBasicAlertInformation({
      page,
      name: generateAlertName(),
      sourceName: 'table',
      sourceDisplayName: 'Table',
      createButtonId: 'create-observability',
    });
    await addSource(page, 'topic');

    await page.click('[data-testid="add-trigger"]');
    const capabilities = page.waitForResponse(
      '/api/v1/events/subscriptions/capabilities'
    );
    await page.click('[data-testid="trigger-select-0"]');
    await page
      .locator('.ant-select-dropdown:visible')
      .getByTestId('Get Schema Changes (Table)-filter-option')
      .click();
    await capabilities;

    await expect(page.getByTestId('topic-warning')).toBeVisible();
    await expect(page.getByTestId('table-warning')).not.toBeAttached();
  });
});
