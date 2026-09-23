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
import { DataContract } from '../../../src/generated/entity/data/dataContract';
import { TableClass } from '../../support/entity/TableClass';
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
  await page.getByTestId('source-select').getByRole('combobox').click();
  await page.getByRole('listbox').getByTestId(`${sourceName}-option`).click();
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
      const input = page.getByTestId('source-select').getByRole('combobox');
      await input.fill('conv');
      const conversation = page
        .getByRole('listbox')
        .getByRole('option')
        .filter({ has: page.getByTestId('conversation-option') });

      await expect(conversation).toHaveAttribute('aria-disabled', 'true');
      await expect(conversation).toContainText('different kinds');

      await input.fill('');
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

  test('A name filter over table and data contract searches both', async ({
    page,
    browser,
  }) => {
    test.slow();
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const table = new TableClass();
    await table.create(apiContext);
    const tableName = table.entityResponseData.name;
    const created = await apiContext.post('/api/v1/dataContracts', {
      data: {
        name: `${tableName}-contract`,
        entity: { id: table.entityResponseData.id, type: 'table' },
      },
    });
    expect(created.ok()).toBeTruthy();
    const contract: DataContract = await created.json();

    try {
      await visitObservabilityAlertPage(page);
      await inputBasicAlertInformation({
        page,
        name: generateAlertName(),
        sourceName: 'table',
        sourceDisplayName: 'Table',
        createButtonId: 'create-observability',
      });
      await addSource(page, 'dataContract');

      await page.getByTestId('add-filters').click();
      await page.getByTestId('filter-select-0').click();
      await page
        .locator('.ant-select-dropdown:visible')
        .getByTestId('Table Name-filter-option')
        .click();

      const names = page.getByTestId('fqn-list-select').getByRole('combobox');
      const found = page.locator('.ant-select-dropdown:visible');

      // Both are found by one search; the search index may take a moment to hold them.
      await expect(async () => {
        await names.click();
        await names.fill(tableName);
        await expect(
          found.getByTitle(table.entityResponseData.fullyQualifiedName ?? '', {
            exact: true,
          })
        ).toBeVisible({ timeout: 3_000 });
        await expect(
          found.getByTitle(contract.fullyQualifiedName ?? '', { exact: true })
        ).toBeVisible({ timeout: 3_000 });
      }).toPass({ timeout: 60_000 });
    } finally {
      await apiContext.delete(
        `/api/v1/dataContracts/${contract.id}?hardDelete=true&recursive=true`
      );
      await table.delete(apiContext);
      await afterAction();
    }
  });
});
