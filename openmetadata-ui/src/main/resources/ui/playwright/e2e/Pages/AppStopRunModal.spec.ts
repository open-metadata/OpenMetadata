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
import { expect, test } from '@playwright/test';
import { GlobalSettingOptions } from '../../constant/settings';
import { redirectToHomePage } from '../../utils/common';
import { settingClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

const MOCK_APP_NAME = 'DataInsightsApplication';
const MOCK_RUN_ID = 'mock-pipeline-run-id-123';

const MOCK_APP = {
  id: 'app-id-123',
  name: MOCK_APP_NAME,
  displayName: 'Data Insights Application',
  fullyQualifiedName: MOCK_APP_NAME,
  appType: 'Internal',
  supportsInterrupt: true,
  deleted: false,
};

const MOCK_RUNNING_RUN = {
  appId: 'app-id-123',
  appName: MOCK_APP_NAME,
  runType: 'Scheduled',
  status: 'running',
  timestamp: Date.now() - 60000,
  startTime: Date.now() - 60000,
  properties: {
    pipelineRunId: MOCK_RUN_ID,
  },
};

test.describe('App Stop Run Modal', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should show stop button for running app runs with supportsInterrupt=true', async ({
    page,
  }) => {
    await page.route(`**/api/v1/apps/name/${MOCK_APP_NAME}*`, async (route) => {
      await route.fulfill({ json: MOCK_APP });
    });

    await page.route(
      `**/api/v1/apps/name/${MOCK_APP_NAME}/status*`,
      async (route) => {
        await route.fulfill({
          json: {
            data: [
              {
                ...MOCK_RUNNING_RUN,
                id: `${MOCK_RUNNING_RUN.appId}-${MOCK_RUNNING_RUN.runType}-${MOCK_RUNNING_RUN.timestamp}`,
              },
            ],
            paging: { total: 1 },
          },
        });
      }
    );

    await page.route(/\/api\/v1\/apps\?/, async (route) => {
      await route.fulfill({
        json: {
          data: [MOCK_APP],
          paging: { total: 1 },
        },
      });
    });

    const appsResponse = page.waitForResponse(
      `**/api/v1/apps?limit=15&include=non-deleted`
    );
    await settingClick(page, GlobalSettingOptions.APPLICATIONS);
    await appsResponse;

    await page.click(
      `[data-testid="data-insights-application-card"] [data-testid="config-btn"]`
    );

    await page.getByRole('tab', { name: 'Recent Runs' }).click();

    await expect(page.getByTestId('stop-button')).toBeVisible();
  });

  test('should open stop modal when stop button is clicked and call stop API with runId', async ({
    page,
  }) => {
    let stopApiCalled = false;
    let stopApiUrl = '';

    await page.route(`**/api/v1/apps/name/${MOCK_APP_NAME}*`, async (route) => {
      await route.fulfill({ json: MOCK_APP });
    });

    await page.route(
      `**/api/v1/apps/stop/${MOCK_APP_NAME}**`,
      async (route) => {
        stopApiCalled = true;
        stopApiUrl = route.request().url();
        await route.fulfill({ status: 200, json: {} });
      }
    );

    await page.route(
      `**/api/v1/apps/name/${MOCK_APP_NAME}/status*`,
      async (route) => {
        await route.fulfill({
          json: {
            data: [
              {
                ...MOCK_RUNNING_RUN,
                id: `${MOCK_RUNNING_RUN.appId}-${MOCK_RUNNING_RUN.runType}-${MOCK_RUNNING_RUN.timestamp}`,
              },
            ],
            paging: { total: 1 },
          },
        });
      }
    );

    await page.route(/\/api\/v1\/apps\?/, async (route) => {
      await route.fulfill({
        json: {
          data: [MOCK_APP],
          paging: { total: 1 },
        },
      });
    });

    const appsResponse = page.waitForResponse(
      `**/api/v1/apps?limit=15&include=non-deleted`
    );
    await settingClick(page, GlobalSettingOptions.APPLICATIONS);
    await appsResponse;

    await page.click(
      `[data-testid="data-insights-application-card"] [data-testid="config-btn"]`
    );

    await page.getByRole('tab', { name: 'Recent Runs' }).click();

    await page.click('[data-testid="stop-button"]');

    await expect(page.getByTestId('stop-modal')).toBeVisible();

    await page.getByRole('button', { name: 'Confirm' }).click();

    await expect.poll(() => stopApiCalled, { timeout: 5000 }).toBe(true);

    expect(stopApiUrl).toContain(`runId=${MOCK_RUN_ID}`);
  });

  test('should close stop modal when cancel is clicked', async ({ page }) => {
    await page.route(`**/api/v1/apps/name/${MOCK_APP_NAME}*`, async (route) => {
      await route.fulfill({ json: MOCK_APP });
    });

    await page.route(
      `**/api/v1/apps/name/${MOCK_APP_NAME}/status*`,
      async (route) => {
        await route.fulfill({
          json: {
            data: [
              {
                ...MOCK_RUNNING_RUN,
                id: `${MOCK_RUNNING_RUN.appId}-${MOCK_RUNNING_RUN.runType}-${MOCK_RUNNING_RUN.timestamp}`,
              },
            ],
            paging: { total: 1 },
          },
        });
      }
    );

    await page.route(/\/api\/v1\/apps\?/, async (route) => {
      await route.fulfill({
        json: {
          data: [MOCK_APP],
          paging: { total: 1 },
        },
      });
    });

    const appsResponse = page.waitForResponse(
      `**/api/v1/apps?limit=15&include=non-deleted`
    );
    await settingClick(page, GlobalSettingOptions.APPLICATIONS);
    await appsResponse;

    await page.click(
      `[data-testid="data-insights-application-card"] [data-testid="config-btn"]`
    );

    await page.getByRole('tab', { name: 'Recent Runs' }).click();

    await page.click('[data-testid="stop-button"]');

    await expect(page.getByTestId('stop-modal')).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByTestId('stop-modal')).not.toBeVisible();
  });
});
