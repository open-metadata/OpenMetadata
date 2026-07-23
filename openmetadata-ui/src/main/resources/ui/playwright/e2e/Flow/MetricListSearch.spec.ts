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
import test, { expect, Page } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { MetricClass } from '../../support/entity/MetricClass';
import {
  createNewPage,
  redirectToHomePage,
  uuid,
  waitForMetricsSearchResponse,
} from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { sidebarClick } from '../../utils/sidebar';

// Two metrics with fully disjoint, globally-unique names: searching one must
// never surface the other, so the assertions are unambiguous.
const matchName = `alphahit${uuid()}`;
const otherName = `betamiss${uuid()}`;

const matchMetric = new MetricClass();
const otherMetric = new MetricClass();

matchMetric.entity = {
  ...matchMetric.entity,
  name: matchName,
  displayName: matchName,
};
otherMetric.entity = {
  ...otherMetric.entity,
  name: otherName,
  displayName: otherName,
};

const waitForMetricIndexed = async (
  apiContext: Awaited<ReturnType<typeof createNewPage>>['apiContext'],
  name: string
) => {
  await expect(async () => {
    const response = await apiContext.get(
      `/api/v1/search/query?q=${name}&index=metric&from=0&size=10`
    );
    const data = await response.json();

    expect(data.hits.total.value).toBeGreaterThan(0);
  }).toPass({ timeout: 90_000, intervals: [2_000] });
};

const goToMetricList = async (page: Page) => {
  await redirectToHomePage(page);

  const listResponse = waitForMetricsSearchResponse(page);
  await sidebarClick(page, SidebarItem.METRICS);
  await listResponse;

  await page.locator('table').waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);
};

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Metric List Page - Search', { tag: ['@Discovery'] }, () => {
  test.beforeAll('Setup metrics', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await matchMetric.create(apiContext);
    await otherMetric.create(apiContext);

    await waitForMetricIndexed(apiContext, matchName);
    await waitForMetricIndexed(apiContext, otherName);

    await afterAction();
  });

  test.afterAll('Cleanup metrics', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await matchMetric.delete(apiContext);
    await otherMetric.delete(apiContext);

    await afterAction();
  });

  test('typing in the search box filters the metric list server-side', async ({
    page,
  }) => {
    test.slow();

    await goToMetricList(page);

    const searchInput = page.getByTestId('metric-search').getByRole('textbox');
    await expect(searchInput).toBeVisible();

    const initialCount = await page.getByTestId('metric-name').count();

    await test.step('search fires a scoped metric query and narrows the results', async () => {
      // The debounced search must actually reach the API. Regression #29538
      // cancelled this request on the re-render that typing triggered, so the
      // list never filtered — this waitForResponse would then time out.
      const searchResponse = page.waitForResponse((response) => {
        const url = new URL(response.url());

        return (
          response.request().method() === 'GET' &&
          url.pathname.endsWith('/api/v1/search/query') &&
          url.searchParams.get('index') === 'metric' &&
          url.searchParams.get('q') === matchName
        );
      });

      await searchInput.fill(matchName);

      const response = await searchResponse;
      expect(response.status()).toBe(200);

      await waitForAllLoadersToDisappear(page);

      await expect(
        page.getByTestId('metric-name').filter({ hasText: matchName })
      ).toBeVisible();
      await expect(page.getByText(otherName)).not.toBeVisible();
    });

    await test.step('clearing the search restores the full list', async () => {
      const clearResponse = waitForMetricsSearchResponse(page);

      await searchInput.fill('');

      await clearResponse;
      await waitForAllLoadersToDisappear(page);

      // The list is paginated — specific names may not be on page 1 after
      // the full list is restored. Verify restoration by checking the visible
      // row count on the current page is back to the pre-search count.
      await expect(page.getByTestId('metric-name')).toHaveCount(initialCount);
    });
  });
});
