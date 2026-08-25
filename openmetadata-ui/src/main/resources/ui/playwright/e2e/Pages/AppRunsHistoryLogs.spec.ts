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

import { expect, Page, test } from '@playwright/test';
import { redirectToHomePage } from '../../utils/common';
import {
  assertLogViewerShowsLogs,
  buildMarkerLogText,
} from '../../utils/logsViewer';

// The new LogViewerModal only opens from AppRunsHistory for an External-type
// app; internal apps take the legacy inline viewer. External apps aren't
// installable in CI, so the app entity, its run history, and the logs endpoint
// are mocked and the app details page is opened directly.
test.use({ storageState: 'playwright/.auth/admin.json' });

const appName = `ExternalLogsApp${Date.now()}`;
const runId = '33333333-3333-3333-3333-333333333333';
const logText = buildMarkerLogText();

const mockExternalApp = async (page: Page) => {
  const now = Date.now();

  await page.route('**/api/v1/apps/name/*/status*', async (route) => {
    await route.fulfill({
      json: {
        data: [
          {
            runId,
            appId: appName,
            status: 'success',
            timestamp: now - 60_000,
            startTime: now - 60_000,
            endTime: now,
            executionTime: 60_000,
          },
        ],
        paging: { total: 1 },
      },
    });
  });

  await page.route('**/api/v1/apps/name/*/logs*', async (route) => {
    await route.fulfill({
      json: { application_task: logText, total: 20 },
    });
  });

  await page.route('**/api/v1/apps/name/*', async (route) => {
    await route.fulfill({
      json: {
        id: '44444444-4444-4444-4444-444444444444',
        name: appName,
        fullyQualifiedName: appName,
        displayName: appName,
        appType: 'external',
        pipelineType: 'application',
        deleted: false,
        appConfiguration: {},
        appSchedule: { scheduleTimeline: 'Day' },
      },
    });
  });
};

test.describe('App Runs History logs viewer (mocked external app)', () => {
  test('External app run logs open in the LogViewerModal', async ({ page }) => {
    test.slow();

    await redirectToHomePage(page);
    await mockExternalApp(page);
    await page.goto(`/settings/apps/${appName}`);

    await test.step('Open the logs modal from the run row', async () => {
      const recentRunsTab = page.getByRole('tab', { name: /recent run/i });
      await expect(recentRunsTab).toBeVisible({ timeout: 30000 });
      await recentRunsTab.click();

      await expect(page.getByTestId('logs').first()).toBeVisible();
      await page.getByTestId('logs').first().click();
    });

    await test.step('The modal shows the application logs', async () => {
      await assertLogViewerShowsLogs(page);
    });

    await test.step('Closing the modal hides it', async () => {
      await page.getByTestId('log-viewer-close').click();
      await expect(page.getByTestId('log-viewer-title')).not.toBeVisible();
    });
  });
});
