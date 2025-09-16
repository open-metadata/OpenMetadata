/*
 *  Copyright 2025 Collate.
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
import { TableClass } from '../../support/entity/TableClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { getJsonTreeObject } from '../../utils/exploreDiscovery';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const table = new TableClass();
const table1 = new TableClass();

test.describe('Explore Assets Discovery', () => {
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await table.create(apiContext);
    await table1.create(apiContext);
    await table.delete(apiContext, false);
    // await table1.delete(apiContext, false);

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await table.delete(apiContext);
    await table1.delete(apiContext);

    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Should not display deleted assets when showDeleted is not checked and deleted is not present in queryFilter', async ({
    page,
  }) => {
    const queryFilter = getJsonTreeObject(
      table.entityResponseData.name,
      table.schemaResponseData.name,
      false
    );
    await page.goto(
      `/explore?page=1&size=10&queryFilter=${JSON.stringify(queryFilter)}`
    );

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await expect(
      page.locator(
        `[data-testid="table-data-card_${table.entityResponseData.fullyQualifiedName}"]`
      )
    ).not.toBeAttached();
  });

  test('Should display deleted assets when showDeleted is not checked but deleted is true in queryFilter', async ({
    page,
  }) => {
    const queryFilter = getJsonTreeObject(
      table.entityResponseData.name,
      table.schemaResponseData.name,
      true,
      true
    );
    await page.goto(
      `/explore?page=1&size=10&queryFilter=${JSON.stringify(queryFilter)}`
    );

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await expect(
      page.locator(
        `[data-testid="table-data-card_${table.entityResponseData.fullyQualifiedName}"]`
      )
    ).toBeAttached();
  });

  test('Should not display deleted assets when showDeleted is not checked but deleted is false in queryFilter', async ({
    page,
  }) => {
    const queryFilter = getJsonTreeObject(
      table.entityResponseData.name,
      table.schemaResponseData.name,
      true,
      false
    );
    await page.goto(
      `/explore?page=1&size=10&queryFilter=${JSON.stringify(queryFilter)}`
    );

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await expect(
      page.locator(
        `[data-testid="table-data-card_${table.entityResponseData.fullyQualifiedName}"]`
      )
    ).not.toBeAttached();
  });

  test('Should display deleted assets when showDeleted is checked and deleted is not present in queryFilter', async ({
    page,
  }) => {
    const queryFilter = getJsonTreeObject(
      table.entityResponseData.name,
      table.schemaResponseData.name,
      false
    );
    await page.goto(
      `/explore?page=1&size=10&showDeleted=true&queryFilter=${JSON.stringify(
        queryFilter
      )}`
    );

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await expect(
      page.locator(
        `[data-testid="table-data-card_${table.entityResponseData.fullyQualifiedName}"]`
      )
    ).toBeAttached();
  });

  test('Should display deleted assets when showDeleted is checked and deleted is true in queryFilter', async ({
    page,
  }) => {
    const queryFilter = getJsonTreeObject(
      table.entityResponseData.name,
      table.schemaResponseData.name,
      true,
      true
    );
    await page.goto(
      `/explore?page=1&size=10&showDeleted=true&queryFilter=${JSON.stringify(
        queryFilter
      )}`
    );

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await expect(
      page.locator(
        `[data-testid="table-data-card_${table.entityResponseData.fullyQualifiedName}"]`
      )
    ).toBeAttached();
  });

  test('Should not display deleted assets when showDeleted is checked but deleted is false in queryFilter', async ({
    page,
  }) => {
    const queryFilter = getJsonTreeObject(
      table.entityResponseData.name,
      table.schemaResponseData.name,
      true,
      false
    );
    await page.goto(
      `/explore?page=1&size=10&showDeleted=true&queryFilter=${JSON.stringify(
        queryFilter
      )}`
    );

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await expect(
      page.locator(
        `[data-testid="table-data-card_${table.entityResponseData.fullyQualifiedName}"]`
      )
    ).not.toBeAttached();
  });

  test('Should not display soft deleted assets in search suggestions', async ({
    page,
  }) => {
    await table1.visitEntityPage(page);
    await page.waitForLoadState('networkidle');

    await page.getByTestId('manage-button').click();
    await page.getByTestId('delete-button').click();

    await expect(
      page
        .locator('.ant-modal-title')
        .getByText(
          `Delete table "${
            table1.entityResponseData.displayName ??
            table1.entityResponseData.name
          }"`
        )
    ).toBeVisible();

    await page.getByTestId('confirmation-text-input').click();
    await page.getByTestId('confirmation-text-input').fill('DELETE');

    await expect(page.getByTestId('confirm-button')).toBeEnabled();

    await page.getByTestId('confirm-button').click();

    await page.reload();

    await expect(page.getByTestId('deleted-badge')).toBeVisible();

    await redirectToHomePage(page);
    await page.waitForLoadState('networkidle');

    await page.getByTestId('searchBox').click();
    await page.getByTestId('searchBox').fill(table1.entityResponseData.name);

    expect(
      page.locator('.ant-popover-inner-content').textContent()
    ).not.toContain(table1.entityResponseData.name);
  });
});
