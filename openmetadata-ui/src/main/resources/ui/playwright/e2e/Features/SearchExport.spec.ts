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

import { expect } from '@playwright/test';
import { performAdminLogin } from '../../utils/admin';
import { redirectToExplorePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  countCsvResponseRows,
  getExportCountFromModal,
  getExportModalContent,
  openExportScopeModal,
} from '../../utils/explore';
import { test } from '../fixtures/pages';

test.describe('Search Export', { tag: ['@Features', '@Discovery'] }, () => {
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    const serviceRes = await apiContext.get(
      '/api/v1/services/databaseServices/name/sample_data'
    );
    const service = await serviceRes.json();
    if (service.displayName) {
      await apiContext.patch(
        `/api/v1/services/databaseServices/${service.id}`,
        {
          data: [{ op: 'replace', path: '/displayName', value: 'sample_data' }],
          headers: { 'Content-Type': 'application/json-patch+json' },
        }
      );

      await afterAction();
    }
  });

  test.beforeEach(async ({ page }) => {
    await redirectToExplorePage(page);
  });

  test('Export button opens scope modal with correct options', async ({
    page,
  }) => {
    await test.step('Export button is visible', async () => {
      const exportButton = page.getByTestId('export-search-results-button');

      await expect(exportButton).toBeVisible();
      await expect(exportButton).toContainText('Export');
    });

    await test.step('Clicking Export opens scope modal with title and scope label', async () => {
      await openExportScopeModal(page);

      const modalContent = getExportModalContent(page);

      await expect(modalContent.locator('.ant-modal-title')).toContainText(
        'Export'
      );
      await expect(modalContent.getByText('Export Scope')).toBeVisible();
    });

    await test.step('Modal shows tab-specific scope and All matching assets options', async () => {
      const modalContent = getExportModalContent(page);

      await expect(
        modalContent.getByTestId('export-scope-visible-card')
      ).toBeVisible();
      await expect(
        modalContent.getByTestId('export-scope-all-card')
      ).toBeVisible();
    });

    await test.step('All matching assets is selected by default', async () => {
      await expect(
        getExportModalContent(page).locator('input[value="all"]')
      ).toBeChecked();
    });

    await test.step('Selecting the tab-scope card checks the visible radio', async () => {
      const modalContent = getExportModalContent(page);

      await modalContent.locator('input[value="visible"]').click();
      await expect(
        modalContent.locator('input[value="visible"]')
      ).toBeChecked();
    });

    await test.step('Cancel button closes the modal', async () => {
      await getExportModalContent(page)
        .getByRole('button', { name: 'Cancel' })
        .click();

      await expect(getExportModalContent(page)).not.toBeVisible();
    });
  });

  test('Search mode visible export downloads CSV with tab-specific row count', async ({
    page,
  }) => {
    test.slow();

    await page.goto('/explore/tables?search=sample_data');
    await expect(page.getByTestId('explore-page')).toBeVisible();

    const countApiPromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/query') &&
        response.status() === 200
    );

    await openExportScopeModal(page);
    await countApiPromise;

    const modalContent = getExportModalContent(page);

    await modalContent.locator('input[value="visible"]').click();

    const expectedCount =
      await test.step('Read displayed count from Visible Results card', () =>
        getExportCountFromModal(modalContent, 'export-scope-visible-count'));

    const exportResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/export') &&
        response.status() === 200
    );

    await modalContent.getByRole('button', { name: 'Export' }).click();

    await test.step('CSV row count matches the displayed tab count', async () => {
      const csvText = await (await exportResponsePromise).text();

      expect(countCsvResponseRows(csvText)).toBe(expectedCount);
    });
  });

  test('Search mode visible export count matches the first result tab count', async ({
    page,
  }) => {
    const countApiPromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/query') &&
        response.status() === 200
    );

    await page.goto(
      '/explore/tables?search=sample_data.ecommerce_db.shopify.dim_customer'
    );
    await expect(page.getByTestId('explore-page')).toBeVisible();
    await countApiPromise;

    const firstTabCount =
      await test.step('Read the count from the first left panel result tab', async () => {
        const firstTabCountText = await page
          .getByTestId('explore-left-panel')
          .locator('[role="menuitem"]')
          .first()
          .getByTestId('filter-count')
          .textContent();

        return parseInt(firstTabCountText?.trim() ?? '0', 10);
      });

    await openExportScopeModal(page);

    const visibleExportCount =
      await test.step('Read the visible results count from the export modal', () =>
        getExportCountFromModal(
          getExportModalContent(page),
          'export-scope-visible-count'
        ));

    await test.step('Visible export count matches the first result tab count', async () => {
      expect(visibleExportCount).toBe(firstTabCount);
    });
  });

  test('Filtered search visible export downloads CSV with the filtered record count', async ({
    page,
  }) => {
    test.slow();

    const searchResultsPromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/query') &&
        response.status() === 200
    );

    await page.goto('/explore/tables?search=sample_data');
    await expect(page.getByTestId('explore-page')).toBeVisible();
    await searchResultsPromise;
    await waitForAllLoadersToDisappear(page);

    await test.step('Apply Service filter from the Explore page', async () => {
      await page.getByTestId('search-dropdown-Service').click();

      const serviceAggregatePromise = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/aggregate') &&
          response.url().includes('sample_data') &&
          response.status() === 200
      );

      await page.getByTestId('search-input').fill('sample_data');
      await serviceAggregatePromise;
      await page.getByTestId('sample_data').click();
      await expect(page.getByTestId('sample_data-checkbox')).toBeChecked();

      const filteredQueryPromise = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.status() === 200
      );

      await page.getByTestId('update-btn').click();
      await filteredQueryPromise;
      await waitForAllLoadersToDisappear(page);
    });

    const filteredCount =
      await test.step('Read filtered count from the first left panel tab', async () => {
        const filteredCountText = await page
          .getByTestId('explore-left-panel')
          .locator('[role="menuitem"]')
          .first()
          .getByTestId('filter-count')
          .textContent();

        return parseInt(filteredCountText?.trim() ?? '0', 10);
      });

    await openExportScopeModal(page);

    const modalContent = getExportModalContent(page);
    await modalContent.locator('input[value="visible"]').click();

    const visibleExportCount =
      await test.step('Read filtered visible count from the export modal', () =>
        getExportCountFromModal(modalContent, 'export-scope-visible-count'));

    await test.step('Filtered page count matches the export modal count', async () => {
      expect(visibleExportCount).toBe(filteredCount);
    });

    const exportResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/export') &&
        response.status() === 200
    );

    await modalContent.getByRole('button', { name: 'Export' }).click();

    await test.step('CSV row count matches the filtered record count', async () => {
      const csvText = await (await exportResponsePromise).text();

      expect(countCsvResponseRows(csvText)).toBe(filteredCount);
    });
  });

  test('Browse mode visible export downloads CSV with current page row count', async ({
    page,
  }) => {
    test.slow();

    const topicsQueryPromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/query') &&
        response.url().includes('index=topic') &&
        response.status() === 200
    );

    await page.goto('/explore/topics');
    await expect(page.getByTestId('explore-page')).toBeVisible();
    await topicsQueryPromise;
    await waitForAllLoadersToDisappear(page);
    await expect(
      page.locator('[data-testid^="table-data-card_"]').first()
    ).toBeVisible();

    await openExportScopeModal(page);

    const modalContent = getExportModalContent(page);

    await modalContent.locator('input[value="visible"]').click();
    await expect(modalContent.locator('input[value="visible"]')).toBeChecked();

    const expectedCount =
      await test.step('Read displayed count from Visible Results card', () =>
        getExportCountFromModal(modalContent, 'export-scope-visible-count'));

    const exportResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/export') &&
        response.status() === 200
    );

    await modalContent.getByRole('button', { name: 'Export' }).click();

    await test.step('CSV row count matches the displayed page count', async () => {
      const csvText = await (await exportResponsePromise).text();

      expect(countCsvResponseRows(csvText)).toBe(expectedCount);
    });
  });

  test('Export is disabled when all matching assets exceed 200k', async ({
    page,
  }) => {
    await page.route('**/api/v1/search/query?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          took: 1,
          hits: {
            total: {
              value: 200001,
              relation: 'eq',
            },
            hits: [],
          },
          aggregations: {},
        }),
      });
    });

    await openExportScopeModal(page);

    const modalContent = getExportModalContent(page);
    const exportButton = modalContent.getByRole('button', { name: 'Export' });

    await test.step('Limit alert is shown in modal', async () => {
      await expect(
        modalContent.getByText(
          'Export is limited to 200000 assets. Please refine your filters or choose visible results.'
        )
      ).toBeVisible();
    });

    await test.step('Export button remains disabled', async () => {
      await expect(exportButton).toBeDisabled();
    });
  });

  test('Export downloads CSV with correct filename and closes modal', async ({
    page,
  }) => {
    test.slow();

    const countApiPromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/query') &&
        response.status() === 200
    );

    await page.goto('/explore/tables?search=sample_data');
    await expect(page.getByTestId('explore-page')).toBeVisible();
    await countApiPromise;

    await openExportScopeModal(page);

    await test.step('Clicking Export triggers CSV download with correct filename', async () => {
      const downloadPromise = page.waitForEvent('download');

      await getExportModalContent(page)
        .getByRole('button', { name: 'Export' })
        .click();

      const download = await downloadPromise;

      expect(download.suggestedFilename()).toContain('Search_Results_');
      expect(download.suggestedFilename()).toContain('.csv');
    });

    await test.step('Modal closes after successful export', async () => {
      await expect(getExportModalContent(page)).not.toBeVisible();
    });
  });
});
