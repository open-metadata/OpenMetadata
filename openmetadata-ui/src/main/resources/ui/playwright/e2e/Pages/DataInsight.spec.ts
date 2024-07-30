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
import test, { expect, Page } from '@playwright/test';
import { KPI_DATA } from '../../constant/dataInsight';
import { GlobalSettingOptions } from '../../constant/settings';
import { SidebarItem } from '../../constant/sidebar';
import { EXPLORE_PAGE_TABS } from '../../support/entity/Entity.interface';
import {
  createNewPage,
  descriptionBox,
  getApiContext,
  redirectToHomePage,
} from '../../utils/common';
import { deleteKpiRequest } from '../../utils/dataInsight';
import { settingClick, sidebarClick } from '../../utils/sidebar';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const addKpi = async (page: Page, data) => {
  const currentDate = new Date();
  const month =
    currentDate.getMonth() + 1 < 10
      ? `0${currentDate.getMonth() + 1}`
      : currentDate.getMonth() + 1;
  const startDate = `${currentDate.getFullYear()}-${month}-${currentDate.getDate()}`;
  currentDate.setDate(currentDate.getDate() + 1);
  const endDate = `${currentDate.getFullYear()}-${month}-${currentDate.getDate()}`;

  await page.click('#chartType');
  await page.click(`.ant-select-dropdown [title="${data.dataInsightChart}"]`);
  await page.getByTestId('displayName').fill(data.displayName);
  await page.getByTestId('metricType').click();
  await page.click(`.ant-select-dropdown [title="${data.metricType}"]`);
  await page.locator('.ant-slider-mark-text', { hasText: '100%' }).click();

  await page.getByTestId('start-date').click();
  await page.getByTestId('start-date').fill(startDate);
  await page.getByTestId('start-date').press('Enter');
  await page.getByTestId('end-date').click();
  await page.getByTestId('end-date').fill(endDate);
  await page.getByTestId('end-date').press('Enter');

  await page.locator(descriptionBox).fill('Playwright KPI test description');

  await page.getByTestId('submit-btn').click();
  await page.waitForURL('**/data-insights/kpi');
};

test.describe.configure({ mode: 'serial' });

test.describe('Data Insight Page', () => {
  test.beforeAll(async ({ browser }) => {
    const { apiContext } = await createNewPage(browser);

    await deleteKpiRequest(apiContext);
  });

  test.beforeEach('Visit Data Insight Page', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.DATA_INSIGHT);
  });

  test('Create description and owner KPI', async ({ page }) => {
    // await page.getByTestId('loader').waitFor({ state: 'detached' });

    await page.getByRole('menuitem', { name: 'KPIs' }).click();

    for (const data of KPI_DATA) {
      await page.getByTestId('add-kpi-btn').click();

      await addKpi(page, data);
    }
  });

  test('Run DataInsight Application', async ({ page }) => {
    await settingClick(page, GlobalSettingOptions.APPLICATIONS);

    await page.click(
      '[data-testid="data-insights-application-card"] [data-testid="config-btn"]'
    );
    await page.waitForResponse('**/api/v1/apps/name/DataInsightsApplication?*');

    await page.click('[data-testid="run-now-button"]');
    await page.waitForResponse(
      '**/api/v1/apps/trigger/DataInsightsApplication'
    );

    const { apiContext } = await getApiContext(page);

    await expect
      .poll(
        async () => {
          const response = await apiContext
            .get(
              '/api/v1/apps/name/DataInsightsApplication/status?offset=0&limit=1'
            )
            .then((res) => res.json());

          return response.data[0].status;
        },
        {
          // Custom expect message for reporting, optional.
          message: 'Wait for the pipeline to be successful',
          timeout: 60_000,
          intervals: [5_000, 10_000],
        }
      )
      .toBe('success');

    // Verify KPI

    await sidebarClick(page, SidebarItem.DATA_INSIGHT);

    await page.waitForSelector('[data-testid="search-dropdown-Team"]');
    await page.waitForSelector('[data-testid="search-dropdown-Tier"]');
    await page.waitForSelector('[data-testid="summary-card"]');
    await page.waitForSelector('[data-testid="kpi-card"]');
  });

  test('Verifying Data assets tab', async ({ page }) => {
    await page.waitForResponse(
      '/api/v1/kpi/playwright-owner-with-percentage-percentage/latestKpiResult'
    );
    await page.getByTestId('date-picker-menu').click();
    await page.getByRole('menuitem', { name: 'Last 60 days' }).click();

    await page
      .getByTestId('search-dropdown-Team')
      .waitFor({ state: 'visible' });
    await page
      .getByTestId('search-dropdown-Tier')
      .waitFor({ state: 'visible' });
    await page.getByTestId('summary-card').waitFor({ state: 'visible' });
    await page.getByTestId('kpi-card').waitFor({ state: 'visible' });
    await page
      .getByTestId('total_data_assets-graph')
      .waitFor({ state: 'visible' });
    await page
      .getByTestId('percentage_of_data_asset_with_description-graph')
      .waitFor({ state: 'visible' });
    await page
      .getByTestId('percentage_of_data_asset_with_owner-graph')
      .waitFor({ state: 'visible' });
    await page
      .getByTestId('percentage_of_service_with_description-graph')
      .waitFor({ state: 'visible' });
    await page
      .getByTestId('percentage_of_service_with_owner-graph')
      .waitFor({ state: 'visible' });
    await page
      .getByTestId('total_data_assets_by_tier-graph')
      .waitFor({ state: 'visible' });
  });

  test('Verify No owner and description redirection to explore page', async ({
    page,
  }) => {
    await page.waitForResponse(
      '/api/v1/kpi/playwright-owner-with-percentage-percentage/latestKpiResult'
    );
    await page.getByTestId('explore-asset-with-no-description').click();

    for (const tab of Object.values(EXPLORE_PAGE_TABS)) {
      await page.getByTestId(`${tab}-tab`).click();

      await expect(
        page.getByTestId('advance-search-filter-text')
      ).toContainText("descriptionStatus = 'INCOMPLETE'");
    }

    await sidebarClick(page, SidebarItem.DATA_INSIGHT);

    await page.getByTestId('explore-asset-with-no-owner').click();

    for (const tab of Object.values(EXPLORE_PAGE_TABS)) {
      await page.getByTestId(`${tab}-tab`).click();

      await expect(
        page.getByTestId('advance-search-filter-text')
      ).toContainText('owner.displayName.keyword IS NULL');
    }
  });

  test('Verifying App analytics tab', async ({ page }) => {
    await page.waitForResponse(
      '/api/v1/kpi/playwright-owner-with-percentage-percentage/latestKpiResult'
    );
    await page.getByTestId('date-picker-menu').click();
    await page.getByRole('menuitem', { name: 'Last 60 days' }).click();

    await page.getByTestId('app-analytics').click();

    await page
      .getByTestId('summary-card-content')
      .waitFor({ state: 'visible' });
    await page
      .locator('[data-testid="entity-summary-card-percentage"]', {
        hasText: 'Most Viewed Data Assets',
      })
      .waitFor({ state: 'visible' });
    await page
      .getByTestId('entity-page-views-card')
      .waitFor({ state: 'visible' });
    await page
      .getByTestId('entity-active-user-card')
      .waitFor({ state: 'visible' });
    await page
      .locator('[data-testid="entity-summary-card-percentage"]', {
        hasText: 'Most Viewed Services',
      })
      .waitFor({ state: 'visible' });
  });

  test('Verifying KPI tab', async ({ page }) => {
    await page.waitForResponse(
      '/api/v1/kpi/playwright-owner-with-percentage-percentage/latestKpiResult'
    );

    await page.getByTestId('date-picker-menu').click();
    await page.getByRole('menuitem', { name: 'Last 60 days' }).click();
    await page.getByTestId('kpi').click();

    await page.getByTestId('kpi-card').waitFor({ state: 'visible' });
    await page
      .locator(
        '[data-row-key="playwright-description-with-percentage-percentage"]'
      )
      .waitFor({ state: 'visible' });
    await page
      .locator('[data-row-key="playwright-owner-with-percentage-percentage"]')
      .waitFor({ state: 'visible' });
  });

  test('Update KPI', async ({ page }) => {
    await page.waitForResponse(
      '/api/v1/kpi/playwright-owner-with-percentage-percentage/latestKpiResult'
    );
    await page.getByTestId('kpi').click();

    for (const data of KPI_DATA) {
      await page.getByTestId(`edit-action-${data.displayName}`).click();

      await page
        .getByTestId('metric-percentage-input')
        .getByRole('spinbutton')
        .fill('50');
      await page.getByTestId('submit-btn').click();
    }
  });

  test('Delete Kpi', async ({ page }) => {
    await page.waitForResponse(
      '/api/v1/kpi/playwright-owner-with-percentage-percentage/latestKpiResult'
    );
    await page.getByTestId('kpi').click();

    for (const data of KPI_DATA) {
      await page.getByTestId(`delete-action-${data.displayName}`).click();
      await page.getByTestId('confirmation-text-input').type('DELETE');
      await page.getByTestId('confirm-button').click();
    }
  });
});
