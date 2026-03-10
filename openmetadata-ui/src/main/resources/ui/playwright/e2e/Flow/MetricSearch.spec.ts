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
import { SidebarItem } from '../../constant/sidebar';
import { MetricClass } from '../../support/entity/MetricClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { sidebarClick } from '../../utils/sidebar';

const metric = new MetricClass();

test.describe(
  'Metric Search - Clause Explosion Prevention',
  { tag: ['@Discovery'] },
  () => {
    test.beforeAll('Setup metric with long name', async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      // Override the metric entity with a long multi-word name
      metric.entity = {
        name: 'AcceleratedConnection_WBA_Ethernet_ServiceLevel',
        description: 'Metric with a long multi-word name for search testing',
        metricExpression: {
          code: 'SUM(accelerated_connection)',
          language: 'SQL',
        },
        granularity: 'QUARTER',
        metricType: 'SUM',
        displayName: 'AcceleratedConnection WBA Ethernet ServiceLevel',
        unitOfMeasurement: 'COUNT',
      };

      await metric.create(apiContext);

      // Wait for the metric to be indexed in OpenSearch
      await expect(async () => {
        const response = await apiContext.get(
          `/api/v1/search/query?q=${metric.entity.name}&index=metric_search_index&from=0&size=10`
        );
        const data = await response.json();

        expect(data.hits.total.value).toBeGreaterThan(0);
      }).toPass({ timeout: 90_000, intervals: [2_000] });

      await afterAction();
    });

    test.afterAll('Cleanup metric', async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await metric.delete(apiContext);
      await afterAction();
    });

    // use the admin user to login
    test.use({ storageState: 'playwright/.auth/admin.json' });

    test('searching for a metric with a long multi-word name should not cause clause explosion', async ({
      page,
    }) => {
      test.slow();

      await redirectToHomePage(page);

      await sidebarClick(page, SidebarItem.EXPLORE);
      await page.waitForLoadState('networkidle');

      await test.step('Select Metric search index and search', async () => {
        await page.getByTestId('global-search-selector').click();

        // Wait for dropdown to be visible
        await page.waitForSelector('[data-testid="global-search-select-dropdown"]', {
          state: 'visible',
        });

        // Scroll within the dropdown to find Metric option
        const dropdownMenu = page.locator('.global-search-select-menu .rc-virtual-list-holder');
        await dropdownMenu.evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        });

        // Wait a moment for the virtualized list to render
        await page.waitForTimeout(500);

        const metricOption = page.getByTestId('global-search-select-option-Metric');
        await metricOption.click();

        const searchQuery =
          'AcceleratedConnection WBA Ethernet ServiceLevel';

        const searchResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/search/query') &&
            response.url().includes('metric_search_index')
        );

        await page
          .getByTestId('navbar-search-container')
          .getByTestId('searchBox')
          .fill(searchQuery);

        await page.keyboard.press('Enter');

        const response = await searchResponse;

        expect(response.status()).toBe(200);
      });

      await test.step(
        'Verify no error toast and results are shown',
        async () => {
          await page.waitForSelector(
            '[data-testid="search-container"] [data-testid="loader"]',
            { state: 'detached', timeout: 30_000 }
          );

          await page.waitForSelector('[data-testid="search-results"]', {
            state: 'visible',
          });

          await expect(page.getByTestId('alert-bar')).not.toBeVisible();
        }
      );
    });
  }
);
