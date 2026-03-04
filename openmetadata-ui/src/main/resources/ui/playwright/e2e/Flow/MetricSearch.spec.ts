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
import { MetricClass } from '../../support/entity/MetricClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import { sidebarClick } from '../../utils/sidebar';
import { SidebarItem } from '../../constant/sidebar';

const metric = new MetricClass();

test.describe(
  'Metric Search - Clause Explosion Prevention',
  { tag: ['@Discovery'] },
  () => {
    test.beforeAll('Setup metric with long name', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

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
      await afterAction();
    });

    test.afterAll('Cleanup metric', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
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

      await test.step('Select Metric search index and search', async () => {
        await page.getByTestId('global-search-selector').click();
        await page
          .getByTestId('global-search-select-option-Metric')
          .click();

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

          await expect(page.getByTestId('alert-bar')).not.toBeVisible();

          await expect(
            page.getByTestId('search-results')
          ).toBeVisible();
        }
      );
    });
  }
);
