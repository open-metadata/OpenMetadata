/*
 *  Copyright 2024 Collate.
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
import { KPI_DATA } from '../../constant/dataInsight';
import { SidebarItem } from '../../constant/sidebar';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { addKpi, deleteKpiRequest } from '../../utils/dataInsight';
import { sidebarClick } from '../../utils/sidebar';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe.configure({ mode: 'serial' });

const DESCRIPTION_WITH_PERCENTAGE =
  'playwright-description-with-percentage-percentage';

const DESCRIPTION_WITH_OWNER = 'playwright-owner-with-percentage-percentage';

test.describe('Data Insight Page', { tag: '@data-insight' }, () => {
  test.beforeAll(async ({ browser }) => {
    const { apiContext } = await createNewPage(browser);

    // Delete all existing KPIs before running the test
    await deleteKpiRequest(apiContext);
  });

  test.beforeEach('Visit Data Insight Page', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.DATA_INSIGHT);
  });

  test('Create description and owner KPI', async ({ page }) => {
    await page.getByRole('menuitem', { name: 'KPIs' }).click();

    for (const data of KPI_DATA) {
      await page.getByTestId('add-kpi-btn').click();

      await addKpi(page, data);
    }
  });

  test('Verifying Data assets tab', async ({ page }) => {
    await page.waitForResponse(
      '/api/v1/kpi/playwright-owner-with-percentage-percentage/latestKpiResult'
    );
    await page.getByTestId('date-picker-menu').click();
    await page.getByRole('menuitem', { name: 'Last 60 days' }).click();

    await expect(page.getByTestId('search-dropdown-Team')).toBeVisible();

    await expect(page.getByTestId('search-dropdown-Tier')).toBeVisible();
    await expect(page.getByTestId('summary-card')).toBeVisible();
    await expect(page.getByTestId('kpi-card')).toBeVisible();
    await expect(page.getByTestId('total_data_assets-graph')).toBeVisible();
    await expect(
      page.getByTestId('percentage_of_data_asset_with_description-graph')
    ).toBeVisible();
    await expect(
      page.getByTestId('percentage_of_data_asset_with_owner-graph')
    ).toBeVisible();
    await expect(
      page.getByTestId('percentage_of_service_with_description-graph')
    ).toBeVisible();
    await expect(
      page.getByTestId('percentage_of_service_with_owner-graph')
    ).toBeVisible();
    await expect(
      page.getByTestId('total_data_assets_by_tier-graph')
    ).toBeVisible();
  });

  test('Verify No owner and description redirection to explore page', async ({
    page,
  }) => {
    await page.waitForResponse(
      '/api/v1/analytics/dataInsights/system/charts/name/percentage_of_service_with_description/data?**'
    );
    await page.getByTestId('explore-asset-with-no-description').click();

    await page.waitForURL('**/explore?**');

    await expect(page.getByTestId('advance-search-filter-text')).toContainText(
      "descriptionStatus = 'INCOMPLETE'"
    );

    await sidebarClick(page, SidebarItem.DATA_INSIGHT);
    await page.waitForResponse(
      '/api/v1/analytics/dataInsights/system/charts/name/percentage_of_service_with_description/data?**'
    );

    await page.getByTestId('explore-asset-with-no-owner').click();
    await page.waitForURL('**/explore?**');

    await expect(page.getByTestId('advance-search-filter-text')).toContainText(
      'owners.displayName.keyword IS NULL'
    );
  });

  test('Verifying App analytics tab', async ({ page }) => {
    await page.waitForResponse(
      '/api/v1/kpi/playwright-owner-with-percentage-percentage/latestKpiResult'
    );
    await page.getByTestId('date-picker-menu').click();
    await page.getByRole('menuitem', { name: 'Last 60 days' }).click();

    await page.getByRole('menuitem', { name: 'App Analytics' }).click();

    await expect(page.getByTestId('summary-card-content')).toBeVisible();
    await expect(
      page.locator('[data-testid="entity-summary-card-percentage"]', {
        hasText: 'Most Viewed Data Assets',
      })
    ).toBeVisible();
    await expect(page.getByTestId('entity-page-views-card')).toBeVisible();
    await expect(page.getByTestId('entity-active-user-card')).toBeVisible();
    await expect(
      page.locator('[data-testid="entity-summary-card-percentage"]', {
        hasText: 'Most Active Users',
      })
    ).toBeVisible();
  });

  test('Verifying KPI tab', async ({ page }) => {
    await page.waitForResponse(
      '/api/v1/kpi/playwright-owner-with-percentage-percentage/latestKpiResult'
    );

    await page.getByTestId('date-picker-menu').click();
    await page.getByRole('menuitem', { name: 'Last 60 days' }).click();
    await page.getByRole('menuitem', { name: 'KPIs' }).click();

    await expect(page.getByTestId('kpi-card')).toBeVisible();
    await expect(
      page.locator(`[data-row-key=${DESCRIPTION_WITH_PERCENTAGE}]`)
    ).toBeVisible();
    await expect(
      page.locator(`[data-row-key=${DESCRIPTION_WITH_OWNER}]`)
    ).toBeVisible();
  });

  test('Update KPI', async ({ page }) => {
    await page.waitForResponse(
      '/api/v1/kpi/playwright-owner-with-percentage-percentage/latestKpiResult'
    );
    await page.getByRole('menuitem', { name: 'KPIs' }).click();

    for (const data of KPI_DATA) {
      await page.getByTestId(`edit-action-${data.displayName}`).click();

      await page.getByRole('spinbutton').fill('50');
      await page.getByTestId('submit-btn').click();
    }
  });

  test('Verify KPI widget in Landing page', async ({ page }) => {
    const kpiResponse = page.waitForResponse(
      'api/v1/kpi?fields=dataInsightChart'
    );

    await redirectToHomePage(page);

    await kpiResponse;

    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await page.waitForLoadState('networkidle');

    expect(page.locator('[data-testid="kpi-widget"]')).toBeVisible();
  });

  test('Delete Kpi', async ({ page }) => {
    await page.waitForResponse(
      '/api/v1/kpi/playwright-owner-with-percentage-percentage/latestKpiResult'
    );
    await page.getByRole('menuitem', { name: 'KPIs' }).click();

    for (const data of KPI_DATA) {
      await page.getByTestId(`delete-action-${data.displayName}`).click();
      await page.getByTestId('confirmation-text-input').fill('DELETE');
      const deleteResponse = page.waitForResponse(
        `/api/v1/kpi/*?hardDelete=true&recursive=false`
      );
      await page.getByTestId('confirm-button').click();

      await deleteResponse;
    }
  });
});
