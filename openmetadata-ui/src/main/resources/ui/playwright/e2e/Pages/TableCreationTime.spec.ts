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
import { expect } from '@playwright/test';
import { TableClass } from '../../support/entity/TableClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import { test } from '../fixtures/pages';

// 2021-01-01T00:00:00Z — fixed so the rendered string is deterministic.
const CREATED_TIMESTAMP = 1609459200000;

const tableWithCreationTime = new TableClass();
const tableWithoutCreationTime = new TableClass();

test.describe('Table source creation time in the entity header', () => {
  test.beforeAll('Create the tables under test', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await tableWithCreationTime.create(apiContext);
    await tableWithoutCreationTime.create(apiContext);

    // Connectors populate lifeCycle.created from the source system (e.g. BigQuery
    // INFORMATION_SCHEMA.TABLES.creation_time); patch it directly here.
    await tableWithCreationTime.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/lifeCycle',
          value: { created: { timestamp: CREATED_TIMESTAMP } },
        },
      ],
    });
    await afterAction();
  });

  test.afterAll('Remove the tables under test', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await tableWithCreationTime.delete(apiContext);
    await tableWithoutCreationTime.delete(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('shows the created time when the source reported one', async ({
    page,
  }) => {
    await tableWithCreationTime.visitEntityPage(page);

    await expect(page.getByTestId('data-assets-header')).toBeVisible();
    await expect(page.getByTestId('table-created-time-label')).toBeVisible();
    await expect(page.getByTestId('table-created-time')).toContainText('2021');
  });

  test('omits the created time when the source reported none', async ({
    page,
  }) => {
    await tableWithoutCreationTime.visitEntityPage(page);

    await expect(page.getByTestId('data-assets-header')).toBeVisible();
    await expect(page.getByTestId('table-created-time')).toHaveCount(0);
  });
});
