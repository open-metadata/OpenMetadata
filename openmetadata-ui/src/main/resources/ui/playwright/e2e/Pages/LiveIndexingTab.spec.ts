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
import test, { expect } from '@playwright/test';
import { GlobalSettingOptions } from '../../constant/settings';
import { getApiContext, redirectToHomePage } from '../../utils/common';
import { settingClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

const RETRY_QUEUE_API =
  '/api/v1/apps/name/SearchIndexingApplication/live-indexing-queue*';

const SAMPLE_RETRY_RECORDS = [
  {
    entityId: 'e2e-test-0001-0000-000000000001',
    entityFqn: 'e2e-test-service.db.schema.failed_table_1',
    failureReason: 'Connection refused: search cluster unavailable',
    status: 'PENDING',
    entityType: 'table',
  },
  {
    entityId: 'e2e-test-0002-0000-000000000002',
    entityFqn: 'e2e-test-service.db.schema.failed_table_2',
    failureReason: 'Bulk request timeout after 60s',
    status: 'FAILED',
    entityType: 'table',
  },
  {
    entityId: 'e2e-test-0003-0000-000000000003',
    entityFqn: 'e2e-test-dashboard.retry_dashboard',
    failureReason: 'mapper type conflict on field newValue',
    status: 'PENDING_RETRY_1',
    entityType: 'dashboard',
  },
];

test.describe(
  'Search Index Application - Live Indexing Tab',
  { tag: ['@Platform'] },
  () => {
    test.beforeAll('Seed retry queue records', async ({ browser }) => {
      const { apiContext, afterAction } = await getApiContext(
        await browser.newPage()
      );

      for (const record of SAMPLE_RETRY_RECORDS) {
        await apiContext
          .post('/api/v1/databases/searchIndexRetryQueue/upsert', {
            data: record,
          })
          .catch(() => {
            // If direct API doesn't exist, insert via SQL or skip gracefully
          });
      }

      await afterAction();
    });

    test.afterAll('Clean up retry queue records', async ({ browser }) => {
      const { apiContext, afterAction } = await getApiContext(
        await browser.newPage()
      );

      for (const record of SAMPLE_RETRY_RECORDS) {
        await apiContext
          .delete(
            `/api/v1/databases/searchIndexRetryQueue/${
              record.entityId
            }/${encodeURIComponent(record.entityFqn)}`
          )
          .catch(() => {
            // Clean up best-effort
          });
      }

      await afterAction();
    });

    test('Live Indexing tab is visible and loads data', async ({ page }) => {
      test.slow();

      await test.step('Navigate to SearchIndexingApplication', async () => {
        await redirectToHomePage(page);
        await settingClick(page, GlobalSettingOptions.APPLICATIONS);

        await page
          .locator(
            '[data-testid="search-indexing-application-card"] [data-testid="config-btn"]'
          )
          .click();
      });

      await test.step('Click Live Indexing tab', async () => {
        const liveIndexingTab = page.getByRole('tab', {
          name: 'Live Indexing',
        });

        await expect(liveIndexingTab).toBeVisible();

        const retryQueueResponse = page.waitForResponse(RETRY_QUEUE_API);
        await liveIndexingTab.click();
        const response = await retryQueueResponse;

        expect(response.status()).toBe(200);
      });

      await test.step('Verify table structure', async () => {
        const table = page.locator('.ant-table');

        await expect(table).toBeVisible();

        await expect(
          table.locator('th').filter({ hasText: 'Entity Type' })
        ).toBeVisible();
        await expect(
          table.locator('th').filter({ hasText: 'Entity FQN' })
        ).toBeVisible();
        await expect(
          table.locator('th').filter({ hasText: 'Status' })
        ).toBeVisible();
        await expect(
          table.locator('th').filter({ hasText: 'Retry Count' })
        ).toBeVisible();
        await expect(
          table.locator('th').filter({ hasText: 'Failure Reason' })
        ).toBeVisible();
      });
    });

    test('Live Indexing tab shows empty state when no records', async ({
      page,
    }) => {
      await test.step('Navigate to SearchIndexingApplication', async () => {
        await redirectToHomePage(page);
        await settingClick(page, GlobalSettingOptions.APPLICATIONS);

        await page
          .locator(
            '[data-testid="search-indexing-application-card"] [data-testid="config-btn"]'
          )
          .click();
      });

      await test.step('Verify empty state message when queue is empty', async () => {
        // Mock empty response
        await page.route(RETRY_QUEUE_API, (route) =>
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: [],
              paging: { total: 0 },
            }),
          })
        );

        const liveIndexingTab = page.getByRole('tab', {
          name: 'Live Indexing',
        });
        await liveIndexingTab.click();

        await expect(
          page.getByText(
            'No live indexing retry records found. All entities are indexed successfully.'
          )
        ).toBeVisible();
      });
    });

    test('Live Indexing tab displays records with correct status badges', async ({
      page,
    }) => {
      const mockRecords = [
        {
          entityId: 'mock-id-1',
          entityFqn: 'service.db.schema.pending_table',
          failureReason: 'Connection timeout',
          status: 'PENDING',
          entityType: 'table',
          retryCount: 0,
          claimedAt: null,
        },
        {
          entityId: 'mock-id-2',
          entityFqn: 'service.db.schema.failed_table',
          failureReason: 'Mapper conflict',
          status: 'FAILED',
          entityType: 'table',
          retryCount: 3,
          claimedAt: null,
        },
        {
          entityId: 'mock-id-3',
          entityFqn: 'service.topic_retry',
          failureReason: 'Bulk queue full',
          status: 'PENDING_RETRY_1',
          entityType: 'topic',
          retryCount: 1,
          claimedAt: null,
        },
      ];

      await test.step('Navigate to SearchIndexingApplication', async () => {
        await redirectToHomePage(page);
        await settingClick(page, GlobalSettingOptions.APPLICATIONS);

        await page
          .locator(
            '[data-testid="search-indexing-application-card"] [data-testid="config-btn"]'
          )
          .click();
      });

      await test.step('Mock and verify retry queue data', async () => {
        await page.route(RETRY_QUEUE_API, (route) =>
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: mockRecords,
              paging: { total: 3 },
            }),
          })
        );

        const liveIndexingTab = page.getByRole('tab', {
          name: 'Live Indexing',
        });
        await liveIndexingTab.click();

        const table = page.locator('.ant-table');

        await expect(table).toBeVisible();

        // Verify record content
        await expect(
          table.getByText('service.db.schema.pending_table')
        ).toBeVisible();
        await expect(
          table.getByText('service.db.schema.failed_table')
        ).toBeVisible();
        await expect(table.getByText('service.topic_retry')).toBeVisible();

        // Verify entity types
        await expect(
          table.getByText('table', { exact: true }).first()
        ).toBeVisible();
        await expect(table.getByText('topic', { exact: true })).toBeVisible();

        // Verify status badges via data-testid
        const statusBadges = table.getByTestId('retry-status');

        await expect(statusBadges.first()).toBeVisible();
        expect(await statusBadges.count()).toBe(3);

        // Verify failure reasons
        await expect(table.getByText('Connection timeout')).toBeVisible();
        await expect(table.getByText('Mapper conflict')).toBeVisible();
      });
    });

    test('Live Indexing tab is not visible for other applications', async ({
      page,
    }) => {
      await test.step('Navigate to Applications', async () => {
        await redirectToHomePage(page);
        await settingClick(page, GlobalSettingOptions.APPLICATIONS);
      });

      await test.step('Verify Live Indexing tab is absent on non-search apps', async () => {
        // Check if DataInsightsReportApplication card exists
        const diCard = page.locator(
          '[data-testid="data-insights-report-application-card"] [data-testid="config-btn"]'
        );

        if (await diCard.isVisible()) {
          await diCard.click();

          const liveIndexingTab = page.getByRole('tab', {
            name: 'Live Indexing',
          });

          await expect(liveIndexingTab).not.toBeVisible();
        }
      });
    });
  }
);
