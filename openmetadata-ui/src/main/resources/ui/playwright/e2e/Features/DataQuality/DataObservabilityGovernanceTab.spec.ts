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

import { expect, Page, test } from '@playwright/test';
import { getCurrentMillis } from '../../../../src/utils/date-time/DateTimeUtils';
import { Domain } from '../../../support/domain/Domain';
import { TableClass } from '../../../support/entity/TableClass';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { ClassificationClass } from '../../../support/tag/ClassificationClass';
import { TagClass } from '../../../support/tag/TagClass';
import { createNewPage } from '../../../utils/common';
import {
  DATA_ASSETS_COVERAGE_PIE_CHART_TEST_ID,
  ENTITY_HEALTH_PIE_CHART_TEST_ID,
  goToDataQualityDashboard,
  TEST_CASE_STATUS_PIE_CHART_TEST_ID,
} from '../../../utils/dataQuality';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';

test.use({ storageState: 'playwright/.auth/admin.json' });

let classification: ClassificationClass;
let tag: TagClass;
let glossary: Glossary;
let glossaryTerm: GlossaryTerm;
let domain: Domain;
let table: TableClass;

const testCaseResult = {
  result: 'Found value outside expected range.',
  testResultValue: [{ name: 'value', value: '5' }],
  timestamp: getCurrentMillis(),
  testCaseStatus: 'Failed' as const,
};

/**
 * Registers a single waitForResponse promise that matches any DQ aggregation
 * API call containing the given filter key.
 */
const watchDashboardResponse = (page: Page, filterKey: string) =>
  page.waitForResponse(
    (r) =>
      r.url().includes('/api/v1/dataQuality/testSuites/dataQualityReport') &&
      r.url().includes(filterKey)
  );

test.beforeAll('setup', async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);

  classification = new ClassificationClass();
  tag = new TagClass({ classification: classification.data.name });
  glossary = new Glossary();
  glossaryTerm = new GlossaryTerm(glossary);
  domain = new Domain();
  table = new TableClass();

  await classification.create(apiContext);
  await tag.create(apiContext);
  await glossary.create(apiContext);
  await glossaryTerm.create(apiContext);
  await domain.create(apiContext);
  await table.create(apiContext);

  await table.patch({
    apiContext,
    patchData: [
      {
        op: 'add',
        path: '/tags/0',
        value: {
          name: tag.data.name,
          tagFQN: tag.responseData.fullyQualifiedName,
          labelType: 'Manual',
          state: 'Confirmed',
        },
      },
      {
        op: 'add',
        path: '/tags/1',
        value: {
          name: glossaryTerm.data.name,
          tagFQN: glossaryTerm.responseData.fullyQualifiedName,
          labelType: 'Manual',
          state: 'Confirmed',
          source: 'Glossary',
        },
      },
      {
        op: 'add',
        path: '/domains/0',
        value: {
          id: domain.responseData.id,
          type: 'domain',
          name: domain.responseData.name,
          displayName: domain.responseData.displayName,
        },
      },
    ],
  });

  await table.createTestSuiteAndPipelines(apiContext);
  const testCase = await table.createTestCase(apiContext);
  await table.addTestCaseResult(
    apiContext,
    testCase.fullyQualifiedName,
    testCaseResult
  );

  await afterAction();
});

test.afterAll('cleanup', async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);

  await table.delete(apiContext);
  await domain.delete(apiContext);
  await glossaryTerm.delete(apiContext);
  await glossary.delete(apiContext);
  await tag.delete(apiContext);
  await classification.delete(apiContext);

  await afterAction();
});

// ---------------------------------------------------------------------------
// 1. Tag detail page
// ---------------------------------------------------------------------------

test.describe('Tag detail page — Data Observability tab', () => {
  test('clicking Data Observability tab loads DQ dashboard widgets', async ({
    page,
  }) => {
    await test.step('Data Observability tab is visible', async () => {
      await page.goto(
        `/tag/${encodeURIComponent(tag.responseData.fullyQualifiedName)}`
      );
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.getByRole('tab', { name: /data observability/i })
      ).toBeVisible();
    });

    await test.step('clicking tab triggers DQ API with tag filter', async () => {
      const filterKey = encodeURIComponent(tag.responseData.fullyQualifiedName);
      const apiResponse = watchDashboardResponse(page, filterKey);
      await page.getByRole('tab', { name: /data observability/i }).click();
      expect((await apiResponse).ok()).toBeTruthy();
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('DQ dashboard widgets are visible', async () => {
      await expect(
        page.locator(`#${TEST_CASE_STATUS_PIE_CHART_TEST_ID}`)
      ).toBeVisible({ timeout: 15000 });
      await expect(
        page.locator(`#${ENTITY_HEALTH_PIE_CHART_TEST_ID}`)
      ).toBeVisible({ timeout: 15000 });
      await expect(
        page.locator(`#${DATA_ASSETS_COVERAGE_PIE_CHART_TEST_ID}`)
      ).toBeVisible({ timeout: 15000 });
    });
  });

  test('DQ dashboard API carries tag filter', async ({ page }) => {
    const filterKey = encodeURIComponent(tag.responseData.fullyQualifiedName);

    await test.step('navigate to tag page', async () => {
      await page.goto(
        `/tag/${encodeURIComponent(tag.responseData.fullyQualifiedName)}`
      );
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('DQ API response carries tag filter', async () => {
      const apiResponse = watchDashboardResponse(page, filterKey);
      await page.getByRole('tab', { name: /data observability/i }).click();
      const response = await apiResponse;
      expect(response.ok()).toBeTruthy();
      expect(response.url()).toContain(filterKey);
    });
  });

  test('tag filter is hidden on Tag Data Observability tab', async ({
    page,
  }) => {
    await test.step('navigate to tag Data Observability tab', async () => {
      await page.goto(
        `/tag/${encodeURIComponent(tag.responseData.fullyQualifiedName)}`
      );
      await waitForAllLoadersToDisappear(page);
      await page.getByRole('tab', { name: /data observability/i }).click();
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('pre-applied tag filter button is hidden; owner filter remains visible', async () => {
      await expect(page.getByTestId('search-dropdown-Tag')).not.toBeVisible();
      await expect(page.getByTestId('search-dropdown-owner')).toBeVisible();
    });
  });

  test('switching back to Overview tab hides the DQ dashboard', async ({
    page,
  }) => {
    await test.step('navigate to tag Data Observability tab', async () => {
      await page.goto(
        `/tag/${encodeURIComponent(tag.responseData.fullyQualifiedName)}`
      );
      await waitForAllLoadersToDisappear(page);
      await page.getByRole('tab', { name: /data observability/i }).click();
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('switching to Overview tab hides DQ dashboard', async () => {
      await page.getByRole('tab', { name: /^overview$/i }).click();
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.locator(`#${TEST_CASE_STATUS_PIE_CHART_TEST_ID}`)
      ).not.toBeVisible();
    });
  });
});

// ---------------------------------------------------------------------------
// 2. GlossaryTerm detail page
// ---------------------------------------------------------------------------

test.describe('GlossaryTerm detail page — Data Observability tab', () => {
  test('clicking Data Observability tab loads DQ dashboard widgets', async ({
    page,
  }) => {
    const anyDqResponse = page.waitForResponse((r) =>
      r.url().includes('/api/v1/dataQuality/testSuites/dataQualityReport')
    );

    await test.step('Data Observability tab is visible', async () => {
      await page.goto(
        `/glossary/${encodeURIComponent(
          glossaryTerm.responseData.fullyQualifiedName
        )}`
      );
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.getByRole('tab', { name: /data observability/i })
      ).toBeVisible();
    });

    await test.step('clicking tab triggers DQ API', async () => {
      await page.getByRole('tab', { name: /data observability/i }).click();
      expect((await anyDqResponse).ok()).toBeTruthy();
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('DQ dashboard widgets are visible', async () => {
      await expect(
        page.locator(`#${TEST_CASE_STATUS_PIE_CHART_TEST_ID}`)
      ).toBeVisible({ timeout: 15000 });
      await expect(
        page.locator(`#${ENTITY_HEALTH_PIE_CHART_TEST_ID}`)
      ).toBeVisible({ timeout: 15000 });
      await expect(
        page.locator(`#${DATA_ASSETS_COVERAGE_PIE_CHART_TEST_ID}`)
      ).toBeVisible({ timeout: 15000 });
    });
  });

  test('DQ dashboard API carries glossaryTerms filter', async ({ page }) => {
    const capturedDqUrls: string[] = [];
    page.on('response', (r) => {
      if (
        r.url().includes('/api/v1/dataQuality/testSuites/dataQualityReport')
      ) {
        capturedDqUrls.push(r.url());
      }
    });

    await test.step('navigate to glossary term Data Observability tab', async () => {
      await page.goto(
        `/glossary/${encodeURIComponent(
          glossaryTerm.responseData.fullyQualifiedName
        )}`
      );
      await waitForAllLoadersToDisappear(page);
      await page.getByRole('tab', { name: /data observability/i }).click();
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('DQ API carries glossaryTerms as tags filter', async () => {
      await expect
        .poll(() => capturedDqUrls.length, { timeout: 30000 })
        .toBeGreaterThan(0);
      expect(
        capturedDqUrls.some((url) =>
          decodeURIComponent(url).includes('tags.tagFQN')
        )
      ).toBeTruthy();
    });
  });

  test('glossaryTerms filter is hidden on GlossaryTerm Data Observability tab', async ({
    page,
  }) => {
    await test.step('navigate to glossary term Data Observability tab', async () => {
      await page.goto(
        `/glossary/${encodeURIComponent(
          glossaryTerm.responseData.fullyQualifiedName
        )}`
      );
      await waitForAllLoadersToDisappear(page);
      await page.getByRole('tab', { name: /data observability/i }).click();
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('pre-applied glossaryTerms filter button is hidden; owner filter remains visible', async () => {
      await expect(
        page.getByTestId('search-dropdown-Glossary Term')
      ).not.toBeVisible();
      await expect(page.getByTestId('search-dropdown-owner')).toBeVisible();
    });
  });

  test('Data Observability tab absent in version history view', async ({
    page,
  }) => {
    await test.step('navigate to glossary term page', async () => {
      await page.goto(
        `/glossary/${encodeURIComponent(
          glossaryTerm.responseData.fullyQualifiedName
        )}`
      );
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('open version history', async () => {
      const versionResponse = page.waitForResponse(
        `/api/v1/glossaryTerms/${glossaryTerm.responseData.id}/versions*`
      );
      await page.getByTestId('version-button').click();
      await versionResponse;
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('Data Observability tab is not visible in version history', async () => {
      await expect(
        page.getByRole('tab', { name: /data observability/i })
      ).not.toBeVisible();
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Domain detail page
// ---------------------------------------------------------------------------

test.describe('Domain detail page — Data Observability tab', () => {
  test('clicking Data Observability tab loads DQ dashboard widgets', async ({
    page,
  }) => {
    const domainFqn =
      domain.responseData.fullyQualifiedName ?? domain.data.name;

    await test.step('Data Observability tab is visible on domain page', async () => {
      await page.goto(`/domain/${encodeURIComponent(domainFqn)}`);
      await waitForAllLoadersToDisappear(page);
      await expect(
        page.getByRole('tab', { name: /data observability/i })
      ).toBeVisible({ timeout: 15000 });
    });

    await test.step('navigating to Data Observability tab loads DQ dashboard', async () => {
      const apiResponse = watchDashboardResponse(
        page,
        encodeURIComponent(domainFqn)
      );
      await page.goto(
        `/domain/${encodeURIComponent(domainFqn)}/data_observability`
      );
      expect((await apiResponse).ok()).toBeTruthy();
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('DQ dashboard widgets are visible', async () => {
      await expect(
        page.locator(`#${TEST_CASE_STATUS_PIE_CHART_TEST_ID}`)
      ).toBeVisible({ timeout: 15000 });
      await expect(
        page.locator(`#${ENTITY_HEALTH_PIE_CHART_TEST_ID}`)
      ).toBeVisible({ timeout: 15000 });
      await expect(
        page.locator(`#${DATA_ASSETS_COVERAGE_PIE_CHART_TEST_ID}`)
      ).toBeVisible({ timeout: 15000 });
    });
  });

  test('DQ dashboard API carries domainFqn filter', async ({ page }) => {
    const domainFqn =
      domain.responseData.fullyQualifiedName ?? domain.data.name;
    const filterKey = encodeURIComponent(domainFqn);
    const apiResponse = watchDashboardResponse(page, filterKey);

    await test.step('navigate to domain Data Observability tab', async () => {
      await page.goto(
        `/domain/${encodeURIComponent(domainFqn)}/data_observability`
      );
    });

    await test.step('DQ API response carries domainFqn filter', async () => {
      const response = await apiResponse;
      expect(response.ok()).toBeTruthy();
      expect(response.url()).toContain(filterKey);
    });
  });

  test('filter bar is visible on Domain Data Observability tab', async ({
    page,
  }) => {
    await test.step('navigate to domain Data Observability tab', async () => {
      const domainFqn =
        domain.responseData.fullyQualifiedName ?? domain.data.name;
      await page.goto(
        `/domain/${encodeURIComponent(domainFqn)}/data_observability`
      );
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('all filter bar buttons are visible for additional drill-down', async () => {
      await expect(page.getByTestId('search-dropdown-owner')).toBeVisible();
      await expect(page.getByRole('button', { name: /tier/i })).toBeVisible();
      await expect(page.getByTestId('search-dropdown-Tag')).toBeVisible();
      await expect(
        page.getByTestId('search-dropdown-Glossary Term')
      ).toBeVisible();
    });
  });

  test('Data Observability tab absent in version history view', async ({
    page,
  }) => {
    await test.step('navigate to domain page', async () => {
      await page.goto(
        `/domain/${encodeURIComponent(
          domain.responseData.fullyQualifiedName ?? domain.data.name
        )}`
      );
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('open version history', async () => {
      const versionResponse = page.waitForResponse(
        `/api/v1/domains/${domain.responseData.id}/versions*`
      );
      await page.getByTestId('version-button').click();
      await versionResponse;
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('Data Observability tab is not visible in version history', async () => {
      await expect(
        page.getByRole('tab', { name: /data observability/i })
      ).not.toBeVisible();
    });
  });
});

// ---------------------------------------------------------------------------
// 4. Regression — standalone DQ Dashboard still shows the filter bar
// ---------------------------------------------------------------------------

test.describe('Standalone DQ Dashboard — regression', () => {
  test('standalone DQ dashboard still shows the filter bar', async ({
    page,
  }) => {
    await test.step('navigate to standalone DQ dashboard', async () => {
      await goToDataQualityDashboard(page);
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('filter bar buttons are visible', async () => {
      await expect(page.getByRole('button', { name: /owner/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /tier/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /^tag$/i })).toBeVisible();
      await expect(
        page.getByRole('button', { name: /glossary term/i })
      ).toBeVisible();
    });
  });

  test('applying tag filter returns a successful DQ API response', async ({
    page,
  }) => {
    await test.step('navigate to standalone DQ dashboard', async () => {
      const tagListResponse = page.waitForResponse(
        '/api/v1/search/query?q=*index=tag*'
      );
      await goToDataQualityDashboard(page);
      await waitForAllLoadersToDisappear(page);
      await tagListResponse;
    });

    await test.step('open tag filter dropdown and select tag', async () => {
      await page.getByTestId('search-dropdown-Tag').click();

      const searchResponse = page.waitForResponse(
        `/api/v1/search/query?q=*${tag.data.name}*index=tag*`
      );
      await page
        .getByTestId('drop-down-menu')
        .getByTestId('search-input')
        .fill(tag.data.name);
      const tagResponse = await searchResponse;
      expect(tagResponse.ok()).toBeTruthy();

      const tagItem = page.getByTestId(tag.responseData.fullyQualifiedName);
      await tagItem.waitFor({ state: 'visible', timeout: 15000 });
      await tagItem.evaluate((el) =>
        el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      );
    });

    await test.step('applying tag filter returns successful DQ API responses', async () => {
      const apiResponse = page.waitForResponse(
        (r) =>
          r
            .url()
            .includes('/api/v1/dataQuality/testSuites/dataQualityReport') &&
          r.url().includes('tags.tagFQN')
      );
      await page.getByTestId('update-btn').click();
      expect((await apiResponse).ok()).toBeTruthy();
    });
  });
});
