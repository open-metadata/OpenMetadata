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
        intervals: [30_000],
        timeout: 300_000,
      }
    )
    .toEqual(expect.stringMatching(/success|activeError/g));

  await page.reload();

  await page.waitForSelector('[data-testid="app-run-history-table"]');

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

test('Search Index Application', async ({ page }) => {
  await test.step('Visit Application page', async () => {
    await redirectToHomePage(page);
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
    await page.waitForSelector('[role="dialog"].ant-modal');

    await expect(page.locator('[role="dialog"].ant-modal')).toBeVisible();

    await expect(page.locator('.ant-modal-title')).toContainText(
      'Search Indexing Configuration'
    );

    await page.click('[data-testid="app-run-config-close"]');
    await page.waitForSelector('[role="dialog"].ant-modal', {
      state: 'detached',
    });
  });

  await test.step('Edit application', async () => {
    await page.click('[data-testid="edit-button"]');
    await page.waitForSelector('[data-testid="schedular-card-container"]');
    await page
      .getByTestId('schedular-card-container')
      .getByText('On Demand')
      .click();

    const deployResponse = page.waitForResponse('/api/v1/apps/*');
    await page.click('.ant-modal-body [data-testid="deploy-button"]');
    await deployResponse;

    await toastNotification(page, 'Schedule saved successfully');

    expect(await page.innerText('[data-testid="schedule-type"]')).toContain(
      'None'
    );

    await page.click('[data-testid="configuration"]');
    await page.waitForLoadState('networkidle');

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

    // uncheck the entity
    await page.getByRole('tree').getByTitle('Table').click();

    // Need an outside click to close the dropdown
    await clickOutside(page);
    await page.locator('[for="root/searchIndexMappingLanguage"]').click();

    await page.getByTestId('select-widget').click();

    await expect(page.getByTestId('select-option-JP')).toBeVisible();

    await page.getByTestId('select-option-JP').click();

    const responseAfterSubmit = page.waitForResponse('/api/v1/apps/*');
    await page.click('[data-testid="submit-btn"]');
    await responseAfterSubmit;

    await toastNotification(page, 'Configuration saved successfully');
  });

  await test.step('Uninstall application', async () => {
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

    expect(await card1.isVisible()).toBe(false);
  });

  await test.step('Install application', async () => {
    await page.click('[data-testid="add-application"]');

    // Verify response status code
    const getMarketPlaceResponse = await page.waitForResponse(
      '/api/v1/apps/marketplace?limit=*'
    );

    expect(getMarketPlaceResponse.status()).toBe(200);

    await page.click(
      '[data-testid="search-indexing-application-card"] [data-testid="config-btn"]'
    );
    await page.click('[data-testid="install-application"]');
    await page.click('[data-testid="save-button"]');
    await page.click('[data-testid="submit-btn"]');
    await page.waitForSelector('[data-testid="schedular-card-container"]');
    await page
      .getByTestId('schedular-card-container')
      .getByText('On Demand')
      .click();

    await expect(page.locator('[data-testid="cron-type"]')).not.toBeVisible();

    const installApplicationResponse = page.waitForResponse('api/v1/apps');
    const getApplications = page.waitForRequest(
      (request) =>
        request.url().includes('/api/v1/apps?limit') &&
        request.method() === 'GET'
    );
    await page.click('[data-testid="deploy-button"]');
    await installApplicationResponse;

    await toastNotification(page, 'Application installed successfully');

    await getApplications;

    await expect(
      page.getByTestId('search-indexing-application-card')
    ).toBeVisible();
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
