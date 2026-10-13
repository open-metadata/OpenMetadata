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
 * Every widget on the DQ dashboard is an aggregation over test-case docs, so the charts render
 * empty — not broken — when a rebuild drops a field they group by. An empty dashboard is a
 * plausible state for a fresh instance, which is why this asserts against a seeded failing
 * cohort: the widgets must still have data to draw after the rebuild.
 *
 * DataQualityDashboard.spec.ts covers the widgets and their drill-downs against live-written
 * docs. Ported from the deleted DataQualityDashboardDimensionAndPieReindexUIIT and
 * StandaloneDQDashboardFiltersReindexUIIT.
 */

import test, { expect } from '@playwright/test';
import { TableClass } from '../../../support/entity/TableClass';
import { createNewPage } from '../../../utils/common';
import {
  DATA_ASSETS_COVERAGE_PIE_CHART_TEST_ID,
  ENTITY_HEALTH_PIE_CHART_TEST_ID,
  goToDataQualityDashboard,
  TEST_CASE_STATUS_PIE_CHART_TEST_ID,
} from '../../../utils/dataQuality';
import { seedFailedIncidents } from '../../../utils/incidentManager';
import { reindexEntities } from '../../../utils/reindex';

test.use({ storageState: 'playwright/.auth/admin.json' });

const SEEDED_INCIDENTS = 3;

test('DQ dashboard widgets and filter bar still render after a reindex', async ({
  browser,
}) => {
  test.slow();

  const { page, apiContext, afterAction } = await createNewPage(browser, {
    navigate: true,
  });
  const table = new TableClass();

  try {
    const testCases = await seedFailedIncidents({
      apiContext,
      table,
      count: SEEDED_INCIDENTS,
    });

    await reindexEntities(
      apiContext,
      testCases.map((testCase) => ({
        id: testCase['id'] as string,
        type: 'testCase',
        fullyQualifiedName: testCase['fullyQualifiedName'] as string,
      }))
    );

    await goToDataQualityDashboard(page);

    await expect(
      page.locator(`#${TEST_CASE_STATUS_PIE_CHART_TEST_ID}`)
    ).toBeVisible();
    await expect(
      page.locator(`#${ENTITY_HEALTH_PIE_CHART_TEST_ID}`)
    ).toBeVisible();
    await expect(
      page.locator(`#${DATA_ASSETS_COVERAGE_PIE_CHART_TEST_ID}`)
    ).toBeVisible();

    // The standalone dashboard keeps its filter bar (unlike the per-entity Data
    // Observability tabs, which hide the filter they are already scoped by).
    await expect(page.getByTestId('search-dropdown-owner')).toBeVisible();
    await expect(page.getByTestId('search-dropdown-Tag')).toBeVisible();
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});
