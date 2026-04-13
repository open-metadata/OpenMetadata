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

import { expect, Page } from '@playwright/test';
import { redirectToHomePage } from '../../utils/common';
import { test } from '../fixtures/pages';

const navigateToExplorePage = async (page: Page) => {
  await redirectToHomePage(page);
  await page.getByTestId('app-bar-item-explore').click();
  await expect(page.getByTestId('explore-page')).toBeVisible();
};

const getExportModalContent = (page: Page) =>
  page.getByTestId('export-scope-modal').locator('.ant-modal-content');

const openExportScopeModal = async (page: Page) => {
  await page.getByTestId('export-search-results-button').click();
  await expect(getExportModalContent(page)).toBeVisible();
  await expect(
    getExportModalContent(page).getByRole('button', { name: 'Export' })
  ).toBeEnabled();
};

test.describe('Search Export', { tag: ['@Features', '@Discovery'] }, () => {
  test.beforeEach(async ({ page }) => {
    await navigateToExplorePage(page);
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

    await test.step('Modal shows Visible results and All matching assets options', async () => {
      const modalContent = getExportModalContent(page);

      await expect(modalContent.getByText('Visible results')).toBeVisible();
      await expect(modalContent.getByText('All matching assets')).toBeVisible();
    });

    await test.step('All matching assets is selected by default', async () => {
      await expect(
        getExportModalContent(page).locator('input[value="all"]')
      ).toBeChecked();
    });

    await test.step('Selecting Visible results checks the visible radio', async () => {
      const modalContent = getExportModalContent(page);

      await modalContent.getByText('Visible results').click();
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

  test('All matching assets export calls API with dataAsset index', async ({
    page,
  }) => {
    await openExportScopeModal(page);

    await test.step('All matching assets radio is pre-selected', async () => {
      await expect(
        getExportModalContent(page).locator('input[value="all"]')
      ).toBeChecked();
    });

    await test.step('Clicking Export calls /search/export with index=dataAsset', async () => {
      const exportApiPromise = page.waitForRequest(
        (req) =>
          req.url().includes('/api/v1/search/export') && req.method() === 'GET'
      );

      await getExportModalContent(page)
        .getByRole('button', { name: 'Export' })
        .click();

      const request = await exportApiPromise;

      expect(request.url()).toContain('index=dataAsset');
    });
  });

  test('Visible results export calls API with size param', async ({ page }) => {
    await openExportScopeModal(page);

    await test.step('Select Visible results scope', async () => {
      const modalContent = getExportModalContent(page);

      await modalContent.getByText('Visible results').click();
      await expect(
        modalContent.locator('input[value="visible"]')
      ).toBeChecked();
    });

    await test.step('Clicking Export calls /search/export with size param', async () => {
      const exportApiPromise = page.waitForRequest(
        (req) =>
          req.url().includes('/api/v1/search/export') && req.method() === 'GET'
      );

      await getExportModalContent(page)
        .getByRole('button', { name: 'Export' })
        .click();

      const request = await exportApiPromise;
      const url = request.url();

      expect(url).toContain('index=');
      expect(url).toContain('size=');
    });
  });

  test('Visible results export on page 2 sends correct from offset', async ({
    page,
  }) => {
    test.slow();

    // Navigate to page 2 via URL so parsedSearch.page = 2
    await page.goto(`${page.url().replace(/\?.*/, '')}?page=2&size=15`);
    await expect(page.getByTestId('explore-page')).toBeVisible();

    await openExportScopeModal(page);
    await getExportModalContent(page).getByText('Visible results').click();

    await test.step('Export request includes from= offset matching page 2', async () => {
      const exportApiPromise = page.waitForRequest(
        (req) =>
          req.url().includes('/api/v1/search/export') && req.method() === 'GET'
      );

      await getExportModalContent(page)
        .getByRole('button', { name: 'Export' })
        .click();

      const request = await exportApiPromise;
      const url = request.url();

      // page=2, size=15 → from=15
      expect(url).toContain('from=15');
      expect(url).toContain('size=');
    });
  });

  test('Export button is disabled while export is in progress', async ({
    page,
  }) => {
    test.slow();

    await page.route('**/api/v1/search/export?*', async (route) => {
      await new Promise<void>((resolve) => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 200,
        contentType: 'text/csv',
        body: 'Entity Type\ntable',
      });
    });

    await openExportScopeModal(page);

    await test.step('Export button becomes disabled and shows loading after click', async () => {
      const exportButton = getExportModalContent(page).getByRole('button', {
        name: 'Export',
      });

      await exportButton.click();

      await expect(exportButton).toBeDisabled();
      await expect(exportButton).toHaveClass(/ant-btn-loading/);
    });
  });

  test('Export API error is shown inside the modal', async ({ page }) => {
    const errorMessage = 'Export failed due to a server error.';

    await page.route('**/api/v1/search/export?*', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'text/plain',
        body: errorMessage,
      });
    });

    await openExportScopeModal(page);

    await getExportModalContent(page)
      .getByRole('button', { name: 'Export' })
      .click();

    await test.step('Error message is visible inside the modal', async () => {
      await expect(
        getExportModalContent(page).getByText(errorMessage)
      ).toBeVisible();
    });

    await test.step('Modal remains open after error', async () => {
      await expect(getExportModalContent(page)).toBeVisible();
    });
  });

  test('Export is disabled when all matching assets exceed limit', async ({
    page,
  }) => {
    await page.route('**/api/v1/search/query?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          took: 1,
          hits: {
            total: { value: 200001, relation: 'eq' },
            hits: [],
          },
          aggregations: {},
        }),
      });
    });

    await page.getByTestId('export-search-results-button').click();

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

  test('Export downloads CSV and closes modal', async ({ page }) => {
    test.slow();

    await page.route('**/api/v1/search/export?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/csv',
        headers: {
          'Content-Disposition': 'attachment; filename="search_export.csv"',
        },
        body: 'Entity Type,Service Name,Service Type,FQN,Name,Display Name,Description,Owners,Tags,Glossary Terms,Domains,Tier\ntable,mysql,Mysql,sample_data.ecommerce_db.shopify.dim_address,dim_address,dim_address,,,,,,',
      });
    });

    await openExportScopeModal(page);

    await test.step('Export button shows loading state while downloading', async () => {
      await page.route('**/api/v1/search/export?*', async (route) => {
        await new Promise<void>((resolve) => setTimeout(resolve, 1500));
        await route.fulfill({
          status: 200,
          contentType: 'text/csv',
          body: 'Entity Type\ntable',
        });
      });

      const exportButton = getExportModalContent(page).getByRole('button', {
        name: 'Export',
      });

      await exportButton.click();
      await expect(exportButton).toHaveClass(/ant-btn-loading/);
    });

    // Re-open modal for download verification after loading state test
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
