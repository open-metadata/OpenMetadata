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
import { expect, Page } from '@playwright/test';
import { redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { test } from '../fixtures/pages';

// These specs drive the real app against the demo `sample_data` tables (no seeded
// fixtures, no response mocking), so coverage is limited to the states sample data
// actually exhibits: the unconfigured setup-CTA rows + their navigation, and the
// one sample table that has a real test suite. Exhaustive per-tone, transient,
// loading and error states are covered by AssetHealthWidget.utils.test.ts.

// sample_data table with no test suite and no contract -> those rows show setup CTAs
const EMPTY_TABLE_FQN = 'sample_data.ecommerce_db.shopify.fact_sale';
// the one sample_data table that ships with a native test suite + test cases
const TEST_SUITE_TABLE_FQN = 'sample_data.ecommerce_db.shopify.dim_address';

const visitTable = async (page: Page, fqn: string) => {
  await page.goto(`/table/${fqn}`);
  await waitForAllLoadersToDisappear(page);
};

test.describe('Asset Health widget', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('renders the widget with all four category rows', async ({ page }) => {
    await visitTable(page, TEST_SUITE_TABLE_FQN);

    await expect(page.getByTestId('asset-health-widget')).toBeVisible();
    await expect(page.getByTestId('asset-health-row-pipeline')).toBeVisible();
    await expect(
      page.getByTestId('asset-health-row-dataQuality')
    ).toBeVisible();
    await expect(
      page.getByTestId('asset-health-row-dataObservability')
    ).toBeVisible();
    await expect(page.getByTestId('asset-health-row-contract')).toBeVisible();
  });

  test('shows setup CTAs for unconfigured categories', async ({ page }) => {
    await visitTable(page, EMPTY_TABLE_FQN);

    await expect(page.getByTestId('asset-health-widget')).toBeVisible();
    await expect(
      page.getByTestId('asset-health-cta-dataQuality')
    ).toBeVisible();
    await expect(
      page.getByTestId('asset-health-cta-dataObservability')
    ).toBeVisible();
    await expect(page.getByTestId('asset-health-cta-contract')).toBeVisible();
  });

  test('Add tests CTA navigates to the Profiler tab', async ({ page }) => {
    await visitTable(page, EMPTY_TABLE_FQN);

    await page.getByTestId('asset-health-cta-dataQuality').click();

    await expect(page).toHaveURL(/\/table\/.*\/profiler/);
  });

  test('Enable observability CTA navigates to the Profiler tab', async ({
    page,
  }) => {
    await visitTable(page, EMPTY_TABLE_FQN);

    await page.getByTestId('asset-health-cta-dataObservability').click();

    await expect(page).toHaveURL(/\/table\/.*\/profiler/);
  });

  test('Create contract CTA navigates to the Contract tab', async ({
    page,
  }) => {
    await visitTable(page, EMPTY_TABLE_FQN);

    await page.getByTestId('asset-health-cta-contract').click();

    await expect(page).toHaveURL(/\/table\/.*\/contract/);
  });

  test('reflects a configured test suite via the data observability row', async ({
    page,
  }) => {
    await visitTable(page, TEST_SUITE_TABLE_FQN);

    // dim_address has a real test suite, so the observability row is driven by
    // testSuite presence and renders a status badge rather than the setup CTA.
    await expect(
      page.getByTestId('asset-health-row-dataObservability')
    ).toBeVisible();
    await expect(
      page.getByTestId('asset-health-cta-dataObservability')
    ).toBeHidden();
  });
});
