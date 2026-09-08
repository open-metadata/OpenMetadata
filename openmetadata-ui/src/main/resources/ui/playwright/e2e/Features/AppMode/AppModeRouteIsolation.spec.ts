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

/**
 * AI mode keeps every visited cacheable route mounted, so a page outlives the
 * URL it was opened with. Pages that derive state from the query string — which
 * is global — must stop reading it once another route owns it, or a
 * backgrounded page refetches with a foreign page's params.
 *
 * The Data Quality dashboard and the Test Library are the pair that exposed
 * this: their filter keys overlap (`testPlatforms`, `tags`, `serviceName`, …),
 * so a Test Library filter used to drive a hidden Data Quality page into
 * refetching with the Test Library's values.
 *
 * Both directions matter, so both are asserted: a backgrounded route must go
 * quiet, and it must still revalidate when it comes back.
 */

import { Page } from '@playwright/test';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { enableAiAppMode } from '../../Utils/appMode';
import { expect, test } from './fixtures';

const DQ_REPORT_API = '/dataQuality/testSuites/dataQualityReport';

const openDataQualityThenTestLibrary = async (page: Page) => {
  await enableAiAppMode(page);

  await page.goto('/observability/data-quality', {
    waitUntil: 'domcontentloaded',
  });
  await waitForAllLoadersToDisappear(page);

  await expect(page.getByTestId('dq-filter-bar')).toBeVisible();

  // In-app navigation, so the Data Quality route stays in the keep-alive cache.
  await page.locator('a[href="/observability/test-library"]').click();

  await expect(
    page.getByRole('button', { name: 'Test Platforms' })
  ).toBeVisible();

  // Attached, not visible — the cache hides inactive routes rather than
  // unmounting them, which is the precondition for this whole class of bug.
  await expect(page.getByTestId('dq-filter-bar')).toBeAttached();
};

test.describe(
  'AppMode — kept-alive route isolation',
  { tag: ['@Observability'] },
  () => {
    test('a backgrounded route does not fetch when another route changes the URL', async ({
      page,
    }) => {
      await openDataQualityThenTestLibrary(page);

      const dataQualityCalls: string[] = [];
      page.on('request', (request) => {
        if (request.url().includes(DQ_REPORT_API)) {
          dataQualityCalls.push(request.url());
        }
      });

      const testDefinitionsResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/dataQuality/testDefinitions') &&
          response.url().includes('testPlatform=')
      );

      await page.getByRole('button', { name: 'Test Platforms' }).click();
      await page.getByRole('option', { name: 'Deequ', exact: true }).click();

      await testDefinitionsResponse;
      await expect(page).toHaveURL(/testPlatforms=Deequ/);

      // A regressed page fetches from the effect that reacts to the URL change,
      // so it would already have fired by the time the Test Library's own
      // request resolved — no sleep needed to assert the absence.
      expect(dataQualityCalls).toEqual([]);
    });

    test('returning to a backgrounded route revalidates it', async ({
      page,
    }) => {
      await openDataQualityThenTestLibrary(page);

      const dataQualityReport = page.waitForResponse((response) =>
        response.url().includes(DQ_REPORT_API)
      );

      await page.locator('a[href="/observability/data-quality"]').click();

      // Going quiet while hidden must not turn into showing stale data on
      // return.
      await dataQualityReport;

      await expect(page.getByTestId('dq-filter-bar')).toBeVisible();
    });
  }
);
