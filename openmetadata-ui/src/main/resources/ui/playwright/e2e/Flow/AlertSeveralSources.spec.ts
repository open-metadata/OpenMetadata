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

import { DataContract } from '../../../src/generated/entity/data/dataContract';
import { TableClass } from '../../support/entity/TableClass';
import { expect, test } from '../../support/fixtures/base';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  addAlertSource,
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
import { waitForSearchIndexed } from '../../utils/polling';

const owner = new UserClass();

test.use({ storageState: 'playwright/.auth/admin.json' });

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
    await addAlertSource(page, 'dashboard', ['table']);

    await test.step('A source of another kind cannot join, and says why', async () => {
      const input = page.getByTestId('source-select').getByRole('combobox');
      await input.fill('conv');
      const conversation = page
        .getByRole('listbox')
        .getByRole('option')
        .filter({ has: page.getByTestId('conversation-option') });

      await expect(conversation).toHaveAttribute('aria-disabled', 'true');
      await expect(conversation).toContainText('different kinds');
      // Sources are listed under the kind they belong to.
      await expect(
        page.getByRole('listbox').getByTestId('header-activity-option')
      ).toBeVisible();

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
    await addAlertSource(page, 'topic', ['table']);

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
    // Contract names are read from the database; table names from the search index.
    await waitForSearchIndexed(
      apiContext,
      table.entityResponseData.fullyQualifiedName,
      'table'
    );

    try {
      await visitObservabilityAlertPage(page);
      await inputBasicAlertInformation({
        page,
        name: generateAlertName(),
        sourceName: 'table',
        sourceDisplayName: 'Table',
        createButtonId: 'create-observability',
      });
      await addAlertSource(page, 'dataContract', ['table']);

      await page.getByTestId('add-filters').click();
      await page.getByTestId('filter-select-0').click();
      await page
        .locator('.ant-select-dropdown:visible')
        .getByTestId('Table Name-filter-option')
        .click();

      const names = page.getByTestId('fqn-list-select').getByRole('combobox');
      const found = page.locator('.ant-select-dropdown:visible');
      await names.click();
      await names.fill(tableName);

      await expect(
        found.getByTitle(table.entityResponseData.fullyQualifiedName ?? '', {
          exact: true,
        })
      ).toBeVisible();
      await expect(
        found.getByTitle(contract.fullyQualifiedName ?? '', { exact: true })
      ).toBeVisible();
    } finally {
      await apiContext.delete(
        `/api/v1/dataContracts/${contract.id}?hardDelete=true&recursive=true`
      );
      await table.delete(apiContext);
      await afterAction();
    }
  });
});
