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
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { TableClass } from '../../support/entity/TableClass';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

test.describe('Glossary Asset Management', () => {
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);
  const table = new TableClass();
  const dashboard = new DashboardClass();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    await table.create(apiContext);
    await dashboard.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossaryTerm.delete(apiContext);
    await glossary.delete(apiContext);
    await table.delete(apiContext);
    await dashboard.delete(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should add asset to glossary term via Assets tab', async ({ page }) => {
    await glossaryTerm.visitEntityPage(page);
    await page.waitForLoadState('networkidle');

    // Navigate to Assets tab
    await page.getByRole('tab', { name: 'Assets' }).click();
    await page.waitForLoadState('networkidle');

    // Click add assets button
    await page.getByTestId('glossary-term-add-button-menu').click();
    await page.getByRole('menuitem', { name: 'Assets' }).click();

    // Wait for asset selection modal
    await expect(page.locator('[role="dialog"].ant-modal')).toBeVisible();

    // Search for the table
    const entityName = table.entityResponseData?.displayName ?? table.entity.name;
    const searchResponse = page.waitForResponse('/api/v1/search/query*');
    await page
      .locator('[data-testid="asset-selection-modal"] [data-testid="searchbar"]')
      .fill(entityName);
    await searchResponse;

    // Select the table
    await page.click(
      `[data-testid="table-data-card_${table.entityResponseData.fullyQualifiedName}"] input[type="checkbox"]`
    );

    // Save
    await page.click('[data-testid="save-btn"]');

    // Wait for modal to close and verify asset is added
    await expect(page.locator('[role="dialog"].ant-modal')).not.toBeVisible();

    await expect(
      page.locator(
        `[data-testid="table-data-card_${table.entityResponseData.fullyQualifiedName}"]`
      )
    ).toBeVisible();

    // Verify assets count shows in tab badge
    const assetsTab = page.getByRole('tab', { name: /Assets/ });
    await expect(assetsTab).toContainText(/\d+/);
  });

  test('should add and remove asset from glossary term', async ({ page }) => {
    await glossaryTerm.visitEntityPage(page);
    await page.waitForLoadState('networkidle');

    // Navigate to Assets tab
    await page.getByRole('tab', { name: 'Assets' }).click();
    await page.waitForLoadState('networkidle');

    // Add dashboard asset
    await page.getByTestId('glossary-term-add-button-menu').click();
    await page.getByRole('menuitem', { name: 'Assets' }).click();

    await expect(page.locator('[role="dialog"].ant-modal')).toBeVisible();

    const entityName =
      dashboard.entityResponseData?.displayName ?? dashboard.entity.name;
    const searchResponse = page.waitForResponse('/api/v1/search/query*');
    await page
      .locator('[data-testid="asset-selection-modal"] [data-testid="searchbar"]')
      .fill(entityName);
    await searchResponse;

    await page.click(
      `[data-testid="table-data-card_${dashboard.entityResponseData.fullyQualifiedName}"] input[type="checkbox"]`
    );

    const addResponse = page.waitForResponse('/api/v1/glossaryTerms/*/assets/add');
    await page.click('[data-testid="save-btn"]');
    await addResponse;

    await expect(page.locator('[role="dialog"].ant-modal')).not.toBeVisible();

    // Verify asset is visible
    await expect(
      page.locator(
        `[data-testid="table-data-card_${dashboard.entityResponseData.fullyQualifiedName}"]`
      )
    ).toBeVisible();

    // Now remove the asset
    await page
      .locator(
        `[data-testid="table-data-card_${dashboard.entityResponseData.fullyQualifiedName}"] input[type="checkbox"]`
      )
      .check();

    const removeResponse = page.waitForResponse(
      '/api/v1/glossaryTerms/*/assets/remove'
    );
    await page.getByTestId('delete-all-button').click();
    await removeResponse;

    // Wait for removal to complete
    await page.waitForLoadState('networkidle');

    // Verify asset is removed
    await expect(
      page.locator(
        `[data-testid="table-data-card_${dashboard.entityResponseData.fullyQualifiedName}"]`
      )
    ).not.toBeVisible();
  });

});
