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
import test, { APIResponse, expect, Page, Response } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { GlobalSettingOptions } from '../../constant/settings';
import {
  APPLICATION_LIST,
  expectApplicationInstalled,
  expectApplicationNotInstalled,
  findApplicationCard,
  openApplicationDetails,
} from '../../utils/applications';
import {
  clickOutside,
  getApiContext,
  redirectToHomePage,
  toastNotification,
} from '../../utils/common';
import { selectOnDemandSchedule } from '../../utils/scheduleInterval';
import { settingClick } from '../../utils/sidebar';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const SEARCH_INDEX_APP_NAME = 'SearchIndexingApplication';
const SUCCESSFUL_RUN_STATUS = /success|completed|activeError/i;

interface AppRunRecordResponse {
  startTime?: number;
  status?: string;
}

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

  const marketplaceCard = await findApplicationCard(
    page,
    'search-indexing-application-card',
    APPLICATION_LIST.marketplace
  );

  await marketplaceCard.getByTestId('config-btn').click();

  await page.getByTestId('install-application').waitFor({ state: 'visible' });
  await page.getByTestId('install-application').click();

  await page.getByTestId('save-button').waitFor({ state: 'visible' });
  await page.getByTestId('save-button').click();

  await page.getByTestId('submit-btn').waitFor({ state: 'visible' });
  await page.getByTestId('submit-btn').click();
  await selectOnDemandSchedule(page);

  const installApplicationResponse = page.waitForResponse('api/v1/apps');
  const getApplications = page.waitForRequest(
    (request) =>
      request.url().includes('/api/v1/apps?limit') && request.method() === 'GET'
  );
  await page.click('[data-testid="deploy-button"]');
  await installApplicationResponse;

  await toastNotification(page, 'Application installed successfully');

  await getApplications;

  await expectApplicationInstalled(page, 'search-indexing-application-card');
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
    .toEqual(expect.stringMatching(SUCCESSFUL_RUN_STATUS));

  await page.reload({ waitUntil: 'domcontentloaded' });

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
        expect.stringMatching(SUCCESSFUL_RUN_STATUS)
      );
    }
  }
};

const getLatestRunStartTime = async (page: Page) => {
  const { apiContext } = await getApiContext(page);
  const response = await apiContext.get(
    `/api/v1/apps/name/${SEARCH_INDEX_APP_NAME}/runs/latest`
  );
  const run = await getAppRunRecord(response);

  return run?.startTime;
};

const getAppRunRecord = async (response: Response | APIResponse) => {
  if (!response.ok() || response.status() === 204) {
    return undefined;
  }

  const body = await response.text();

  return body ? (JSON.parse(body) as AppRunRecordResponse) : undefined;
};

const waitForNewSuccessfulRun = async (
  page: Page,
  previousRunStartTime?: number
) => {
  const { apiContext } = await getApiContext(page);
  let completedRunStartTime: number | undefined;

  await expect
    .poll(
      async () => {
        const response = await apiContext.get(
          `/api/v1/apps/name/${SEARCH_INDEX_APP_NAME}/runs/latest`
        );
        const run = await getAppRunRecord(response);

        if (run?.startTime === undefined) {
          return undefined;
        }

        if (
          previousRunStartTime !== undefined &&
          run.startTime <= previousRunStartTime
        ) {
          return undefined;
        }

        if (run.status && SUCCESSFUL_RUN_STATUS.test(run.status)) {
          completedRunStartTime = run.startTime;
        }

        return run.status;
      },
      {
        message: 'Wait for a new successful SearchIndexingApplication run',
        intervals: [5_000, 10_000, 15_000, 30_000],
        timeout: 300_000,
      }
    )
    .toEqual(expect.stringMatching(SUCCESSFUL_RUN_STATUS));

  expect(completedRunStartTime).toBeDefined();

  return completedRunStartTime;
};

const rerunSearchIndexApplicationForTable = async (
  page: Page,
  previousRunStartTime?: number
) => {
  const { apiContext } = await getApiContext(page);
  const response = await apiContext.post(
    `/api/v1/apps/trigger/${SEARCH_INDEX_APP_NAME}`,
    {
      data: {
        batchSize: 100,
        entities: ['table'],
      },
    }
  );

  expect(response.status()).toBeLessThan(300);

  return waitForNewSuccessfulRun(page, previousRunStartTime);
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
      await openApplicationDetails(page, 'search-indexing-application-card');
      const statusResponse = await statusAPI;

      expect(statusResponse.status()).toBe(200);

      await verifyLastExecutionRun(page, statusResponse);
    });

    await test.step('View App Run Config', async () => {
      await page.getByTestId('app-historical-config').click();
      const configDialog = page.getByTestId('edit-table-type-property-modal');

      await expect(configDialog).toBeVisible();
      await expect(configDialog).toContainText('Search Indexing Configuration');

      await page.getByTestId('app-run-config-close').click();

      await expect(configDialog).not.toBeVisible();
    });

    await test.step('Edit application', async () => {
      await page.click('[data-testid="edit-button"]');
      await selectOnDemandSchedule(page);

      const deployResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/apps') &&
          !response.url().includes('/status') &&
          response.request().method() !== 'GET'
      );
      await page
        .getByTestId('update-schedule-modal')
        .getByTestId('deploy-button')
        .click();
      await deployResponse;

      await toastNotification(page, 'Schedule saved successfully');

      expect(await page.innerText('[data-testid="schedule-type"]')).toContain(
        'None'
      );

      await page.click('[data-testid="configuration"]');

      await expect(page.getByTestId('service-requirements')).toContainText(
        'Search Indexing Application'
      );

      await expect(page.locator('form')).toContainText('Auto Tune');

      await page.fill('#root\\/batchSize', '100');

      // Entities is an enum multi-select with an "All" option. Picking a specific entity replaces
      // "All", so the stored ["all"] becomes ["table"]. A retry may already have saved Table.
      const entitiesField = page.getByTestId('enum-multi-select-root/entities');
      const tableChip = entitiesField.getByText('Table', { exact: true });

      if (!(await tableChip.isVisible())) {
        // Search first: the list is server-driven, and "Table Column" also matches "table".
        await entitiesField.getByRole('combobox').fill('Table');
        await page
          .locator('[role="listbox"]:visible')
          .getByRole('option', { name: 'Table', exact: true })
          .click();
      }

      await expect(tableChip).toBeVisible();
      await expect(
        entitiesField.getByText('All', { exact: true })
      ).toBeHidden();

      // Need an outside click to close the dropdown
      await clickOutside(page);
      await expect(page.locator('[role="listbox"]:visible')).toHaveCount(0);

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
      await page.reload({ waitUntil: 'domcontentloaded' });
      await appResponse;

      await page.click('[data-testid="manage-button"]');
      await page.click('[data-testid="uninstall-button-title"]');

      const deleteRequest = page.waitForResponse(
        '/api/v1/apps/name/SearchIndexingApplication?hardDelete=true'
      );
      await page.click('[data-testid="save-button"]');
      await deleteRequest;

      await toastNotification(page, 'Application uninstalled successfully');

      await expectApplicationNotInstalled(
        page,
        'search-indexing-application-card'
      );
    });

    await test.step('Install application', async () => {
      await installSearchIndexApplication(page);
    });

    if (process.env.PLAYWRIGHT_IS_OSS) {
      await test.step('Run application and rerun with table-only config', async () => {
        test.slow(true); // Test time shouldn't exceed while re-fetching the history API.

        await openApplicationDetails(page, 'search-indexing-application-card');

        const previousRunStartTime = await getLatestRunStartTime(page);
        const triggerPipelineResponse = page.waitForResponse(
          '/api/v1/apps/trigger/SearchIndexingApplication'
        );
        await page.click('[data-testid="run-now-button"]');

        await triggerPipelineResponse;

        await toastNotification(page, 'Application triggered successfully');

        const statusAPI = page.waitForResponse(
          '/api/v1/apps/name/SearchIndexingApplication/status?offset=0&limit=1'
        );
        await page.reload({ waitUntil: 'domcontentloaded' });
        const statusResponse = await statusAPI;

        expect(statusResponse.status()).toBe(200);

        await verifyLastExecutionRun(page, statusResponse);
        const firstRunStartTime = await waitForNewSuccessfulRun(
          page,
          previousRunStartTime
        );

        await rerunSearchIndexApplicationForTable(page, firstRunStartTime);
      });
    }
  });
});
