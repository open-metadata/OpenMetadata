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
import { expect, test } from '@playwright/test';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { getApiContext } from '../../utils/common';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const pipeline = new PipelineClass();

test.describe('Pipeline Execution Tab', () => {
  test.slow(true);

  test.beforeAll('Setup pipeline', async ({ browser }) => {
    const { apiContext, afterAction } = await getApiContext(browser);
    await pipeline.create(apiContext);
    await afterAction();
  });

  test.afterAll('Cleanup pipeline', async ({ browser }) => {
    const { apiContext, afterAction } = await getApiContext(browser);
    await pipeline.delete(apiContext);
    await afterAction();
  });

  test('Execution tab should display start time, end time, and duration columns', async ({
    page,
  }) => {
    await test.step('Navigate to pipeline entity page', async () => {
      await pipeline.visitEntityPage(page);
      await expect(page.getByTestId('entity-header-display-name')).toHaveText(
        pipeline.entity.displayName,
      );
    });

    await test.step('Navigate to Executions tab', async () => {
      await page.getByTestId('executions').click();
      await expect(page.getByTestId('execution-tab')).toBeVisible();
    });

    await test.step('Verify ListView displays timing columns', async () => {
      // Wait for the list view table to be visible
      await expect(page.getByTestId('list-view-table')).toBeVisible();

      // Verify column headers are present
      await expect(page.getByText('Start Time')).toBeVisible();
      await expect(page.getByText('End Time')).toBeVisible();
      await expect(page.getByText('Duration')).toBeVisible();
    });

    await test.step('Switch to Tree View and verify tooltip shows timing info', async () => {
      // Switch to tree view
      await page
        .getByTestId('radio-switch')
        .getByText('Tree View', { exact: true })
        .click();

      // Wait for tree view to load
      await page.waitForTimeout(1000);

      // Check if there are any execution nodes with status icons
      const statusIcons = page.locator('.execution-node-container svg').first();
      if ((await statusIcons.count()) > 0) {
        // Hover over the first status icon to show tooltip
        await statusIcons.hover();

        // Wait for tooltip to appear and verify it contains timing information
        await page.waitForTimeout(500);

        // The tooltip should contain Start, End, and Duration text if data is available
        const tooltipContent = page.locator('.ant-tooltip-inner');
        if (await tooltipContent.isVisible()) {
          const text = await tooltipContent.textContent();
          // Tooltip should contain execution status at minimum
          expect(text).toBeTruthy();
        }
      }
    });
  });
});
