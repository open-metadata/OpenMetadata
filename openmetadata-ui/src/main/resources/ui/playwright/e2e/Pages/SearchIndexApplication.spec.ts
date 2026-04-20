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
import test, { expect, Page, Response } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { GlobalSettingOptions } from '../../constant/settings';
import {
  clickOutside,
  getApiContext,
  redirectToHomePage,
  toastNotification,
} from '../../utils/common';
import { settingClick } from '../../utils/sidebar';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

/**
 * Installs the Search Indexing Application from the marketplace.
 * Shared by the "Install application" step and the self-healing guard
 * that recovers from a previous retry leaving the app uninstalled.
 */
const installSearchIndexApplication = async (page: Page) => {
  const getMarketPlaceResponse = page.waitForResponse(
    '/api/v1/apps/marketplace?limit=15'
  );
  await page.click('[data-testid="add-application"]');

  const response = await getMarketPlaceResponse;

  expect(response.status()).toBe(200);

  // Wait for at least one app card to be rendered before polling.
  await page
    .locator('[data-testid$="-application-card"]')
    .first()
    .waitFor({ state: 'visible' });

  // Paginate through marketplace pages until the card is found.
  let cardFound = await page
    .locator('[data-testid="search-indexing-application-card"]')
    .isVisible();

  while (!cardFound) {
    const nextButton = page.locator('[data-testid="next"]');

    const isNextButtonVisible = await nextButton.isVisible();

    if (!isNextButtonVisible || (await nextButton.isDisabled())) {
      throw new Error(
        'search-indexing-application-card not found in marketplace and next button is disabled'
      );
    }

    const nextPageResponse = page.waitForResponse('/api/v1/apps/marketplace*');
    await nextButton.click();
    await nextPageResponse;

    // Wait for the next page's cards to render before re-checking.
    await page
      .locator('[data-testid$="-application-card"]')
      .first()
      .waitFor({ state: 'visible' });

    cardFound = await page
      .locator('[data-testid="search-indexing-application-card"]')
      .isVisible();
  }

  await page
    .getByTestId('search-indexing-application-card')
    .getByTestId('config-btn')
    .click();

  await page.getByTestId('install-application').waitFor({ state: 'visible' });
  await page.getByTestId('install-application').click();

  await page.getByTestId('save-button').waitFor({ state: 'visible' });
  await page.getByTestId('save-button').click();

  await page.getByTestId('submit-btn').waitFor({ state: 'visible' });
  await page.getByTestId('submit-btn').click();
  await page.getByTestId('schedular-card-container').waitFor();
  await page
    .getByTestId('schedular-card-container')
    .getByText('On Demand')
    .click();

  await expect(page.locator('[data-testid="cron-type"]')).not.toBeVisible();

  const installApplicationResponse = page.waitForResponse('api/v1/apps');
  const getApplications = page.waitForRequest(
    (request) =>
      request.url().includes('/api/v1/apps?limit') && request.method() === 'GET'
  );
  await page.click('[data-testid="deploy-button"]');
  await installApplicationResponse;

  await toastNotification(page, 'Application installed successfully');

  await getApplications;

  await expect(
    page.getByTestId('search-indexing-application-card')
  ).toBeVisible();
};

const verifyLastExecutionStatus = async (page: Page) => {
  const { apiContext } = await getApiContext(page);

  await expect
    .poll(
      async () => {
        const response = await apiContext
          .get(
            '/api/v1/apps/name/SearchIndexingApplication/status?offset=0&limit=1'
          )
          .then((res) => res.json());

        return response.data[0]?.status;
      },
      {
        // Custom expect message for reporting, optional.
        message:
          'To get the last run execution status as success or active with error',
        intervals: [5_000, 10_000, 15_000, 30_000],
        timeout: 300_000,
      }
    )
    .toEqual(expect.stringMatching(/success|activeError/g));

  await page.reload();

  await page.getByTestId('app-run-history-table').waitFor();

  await expect(page.getByTestId('pipeline-status')).toContainText('Success');
};

const verifyLastExecutionRun = async (page: Page, response: Response) => {
  const responseData = await response.json();
  if (responseData.data.length > 0) {
    expect(responseData.data).toHaveLength(1);

    if (responseData.data[0].status === 'running') {
      // wait for success status
      await verifyLastExecutionStatus(page);
    } else {
      expect(responseData.data[0].status).toEqual(
        expect.stringMatching(/success|activeError/g)
      );
    }
  }
};

test.describe('Search Index Application', PLAYWRIGHT_BASIC_TEST_TAG_OBJ, () => {
  test('Search Index Application', async ({ page }) => {
    test.slow();

    await test.step('Visit Application page', async () => {
      await redirectToHomePage(page);

      // If a previous retry left the app uninstalled, reinstall via API.
      const { apiContext } = await getApiContext(page);
      const appCheckResponse = await apiContext.get(
        '/api/v1/apps/name/SearchIndexingApplication'
      );

      if (appCheckResponse.status() === 404) {
        // appConfiguration must be passed so the Configuration tab renders in the UI.
        const marketplaceResponse = await apiContext.get(
          '/api/v1/apps/marketplace/name/SearchIndexingApplication'
        );
        const { appConfiguration } = await marketplaceResponse.json();

        await apiContext.post('/api/v1/apps', {
          data: {
            name: 'SearchIndexingApplication',
            displayName: 'Search Indexing',
            appConfiguration,
            appSchedule: { scheduleTimeline: 'None' },
          },
        });
      }

      await settingClick(page, GlobalSettingOptions.APPLICATIONS);
    });

    await test.step('Verify last execution run', async () => {
      const statusAPI = page.waitForResponse(
        '/api/v1/apps/name/SearchIndexingApplication/status?offset=0&limit=1'
      );
      await page
        .locator(
          '[data-testid="search-indexing-application-card"] [data-testid="config-btn"]'
        )
        .click();
      const statusResponse = await statusAPI;

      expect(statusResponse.status()).toBe(200);

      await verifyLastExecutionRun(page, statusResponse);
    });

    await test.step('View App Run Config', async () => {
      await page.getByTestId('app-historical-config').click();
      await page.locator('[role="dialog"].ant-modal').waitFor();

      await expect(page.locator('[role="dialog"].ant-modal')).toBeVisible();

      await expect(page.locator('.ant-modal-title')).toContainText(
        'Search Indexing Configuration'
      );

      await page.click('[data-testid="app-run-config-close"]');
      await page.locator('[role="dialog"].ant-modal').waitFor({
        state: 'detached',
      });
    });

    await test.step('Edit application', async () => {
      await page.click('[data-testid="edit-button"]');
      await page.getByTestId('schedular-card-container').waitFor();
      await page
        .getByTestId('schedular-card-container')
        .getByText('On Demand')
        .click();

      const deployResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/apps') &&
          !response.url().includes('/status') &&
          response.request().method() !== 'GET'
      );
      await page.click('.ant-modal-body [data-testid="deploy-button"]');
      await deployResponse;

      await toastNotification(page, 'Schedule saved successfully');

      expect(await page.innerText('[data-testid="schedule-type"]')).toContain(
        'None'
      );

      await page.click('[data-testid="configuration"]');

      await expect(page.locator('#search-indexing-application')).toContainText(
        'Search Indexing Application'
      );

      await expect(page.locator('form')).toContainText('Auto Tune');

      await page.fill('#root\\/batchSize', '100');

      await page.getByTestId('tree-select-widget').click();

      // Bring table option to view in dropdown via searching for it
      await page
        .getByTestId('tree-select-widget')
        .getByRole('combobox')
        .fill('Table');

      const tableTitle = page.getByRole('tree').getByTitle('Table');

      // Wait for the filtered tree result to render
      await tableTitle.waitFor({ state: 'visible' });

      // Uncheck Table only if it is currently checked
      const isTableChecked = await tableTitle.evaluate((el) => {
        let node = el.parentElement;
        while (node) {
          if (node.getAttribute('role') === 'treeitem') {
            return node.getAttribute('aria-checked') === 'true';
          }
          node = node.parentElement;
        }

        return false;
      });

      if (isTableChecked) {
        await tableTitle.click();
      }

      // Need an outside click to close the dropdown
      await clickOutside(page);
      await page.locator('[for="root/searchIndexMappingLanguage"]').click();

      await page
        .getByTestId('select-widget-root/searchIndexMappingLanguage')
        .click();

      await expect(page.getByTestId('select-option-JP')).toBeVisible();

      await page.getByTestId('select-option-JP').click();

      const responseAfterSubmit = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/apps') &&
          !response.url().includes('/status') &&
          response.request().method() !== 'GET'
      );
      await page.click('[data-testid="submit-btn"]');
      await responseAfterSubmit;

      await toastNotification(page, 'Configuration saved successfully');
    });

    await test.step('Uninstall application', async () => {
      // The config edit creates a new app instance server-side.
      // Reload to pick up the current instance ID before attempting delete.
      const appResponse = page.waitForResponse(
        (response) =>
          response
            .url()
            .includes('/api/v1/apps/name/SearchIndexingApplication') &&
          !response.url().includes('/status') &&
          response.request().method() === 'GET'
      );
      await page.reload();
      await appResponse;

      await page.click('[data-testid="manage-button"]');
      await page.click('[data-testid="uninstall-button-title"]');

      const deleteRequest = page.waitForResponse(
        '/api/v1/apps/name/SearchIndexingApplication?hardDelete=true'
      );
      await page.click('[data-testid="save-button"]');
      await deleteRequest;

      await toastNotification(page, 'Application uninstalled successfully');

      const card1 = page.locator(
        '[data-testid="search-indexing-application-card"]'
      );

      await expect(card1).toBeHidden();
    });

    await test.step('Install application', async () => {
      await installSearchIndexApplication(page);
    });

    if (process.env.PLAYWRIGHT_IS_OSS) {
      await test.step('Run application', async () => {
        test.slow(true); // Test time shouldn't exceed while re-fetching the history API.

        await page.click(
          '[data-testid="search-indexing-application-card"] [data-testid="config-btn"]'
        );

        const triggerPipelineResponse = page.waitForResponse(
          '/api/v1/apps/trigger/SearchIndexingApplication'
        );
        await page.click('[data-testid="run-now-button"]');

        await triggerPipelineResponse;

        await toastNotification(page, 'Application triggered successfully');

        const statusAPI = page.waitForResponse(
          '/api/v1/apps/name/SearchIndexingApplication/status?offset=0&limit=1'
        );
        await page.reload();
        const statusResponse = await statusAPI;

        expect(statusResponse.status()).toBe(200);

        await verifyLastExecutionRun(page, statusResponse);
      });
    }
  });
});
