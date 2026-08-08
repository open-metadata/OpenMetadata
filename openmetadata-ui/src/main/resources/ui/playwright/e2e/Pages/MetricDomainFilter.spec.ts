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
import { expect, Page, test as base } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { Domain } from '../../support/domain/Domain';
import { MetricClass } from '../../support/entity/MetricClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import { assignDomainToEntity, selectDomainFromNavbar } from '../../utils/domain';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { sidebarClick } from '../../utils/sidebar';

// The Metrics list page (GET /api/v1/metrics) did not honour the `domain` query param
// that the global (navbar) domain filter appends, so metrics from every domain were
// listed regardless of the selected domain. Same gap as the reported glossary case.
const domainA = new Domain();
const domainB = new Domain();
const metricA = new MetricClass();
const metricB = new MetricClass();

const test = base.extend<{ page: Page }>({
  page: async ({ browser }, use) => {
    const { page, afterAction } = await performAdminLogin(browser, {
      navigate: true,
    });
    await use(page);
    await afterAction();
  },
});

const waitForMetricList = (page: Page) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().includes('/api/v1/metrics?') &&
      response.status() === 200
  );

const openMetricList = async (page: Page) => {
  const listResponse = waitForMetricList(page);
  await sidebarClick(page, SidebarItem.METRICS);
  await listResponse;
  await waitForAllLoadersToDisappear(page);
};

const metricItem = (page: Page, metric: MetricClass) =>
  page
    .getByTestId('metric-name')
    .filter({ hasText: metric.entity.displayName });

test.describe('Metric global domain filter', () => {
  test.slow(true);

  test.beforeAll('Setup domains and metrics', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await domainA.create(apiContext);
    await domainB.create(apiContext);
    await metricA.create(apiContext);
    await metricB.create(apiContext);

    await assignDomainToEntity(apiContext, metricA, domainA);
    await assignDomainToEntity(apiContext, metricB, domainB);

    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await metricA.delete(apiContext);
    await metricB.delete(apiContext);
    await domainA.delete(apiContext);
    await domainB.delete(apiContext);

    await afterAction();
  });

  test('Admin: navbar domain selector filters the metrics list', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await openMetricList(page);

    await test.step('Domain A lists only the Domain A metric', async () => {
      await selectDomainFromNavbar(page, domainA.responseData);
      const listResponse = waitForMetricList(page);
      await page.reload();
      await listResponse;
      await waitForAllLoadersToDisappear(page);

      await expect(metricItem(page, metricA)).toBeVisible();
      await expect(metricItem(page, metricB)).toHaveCount(0);
    });

    await test.step('Domain B lists only the Domain B metric', async () => {
      await selectDomainFromNavbar(page, domainB.responseData);
      const listResponse = waitForMetricList(page);
      await page.reload();
      await listResponse;
      await waitForAllLoadersToDisappear(page);

      await expect(metricItem(page, metricB)).toBeVisible();
      await expect(metricItem(page, metricA)).toHaveCount(0);
    });
  });
});
