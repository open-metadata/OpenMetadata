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
import { createNewPage, redirectToHomePage } from '../../utils/common';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const pipeline = new PipelineClass();

test.describe('Pipeline Execution Tab', () => {
  test.beforeAll('Setup pipeline with executions', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await pipeline.create(apiContext);

    const fqn = pipeline.entityResponseData?.fullyQualifiedName;
    const now = Date.now();

    const executions = [
      {
        executionId: 'exec_001',
        timestamp: now - 3000000,
        executionStatus: 'Successful',
        taskStatus: pipeline.children.map((task) => ({
          name: task.name,
          executionStatus: 'Successful',
          startTime: now - 3600000,
          endTime: now - 3000000,
        })),
      }
    ];

    for (const execution of executions) {
      await apiContext.put(`/api/v1/pipelines/${fqn}/status`, {
        data: execution,
      });
    }

    await afterAction();
  });

  test.afterAll('Cleanup pipeline', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await pipeline.delete(apiContext);
    await afterAction();
  });

  test('Execution tab should display start time, end time, and duration columns', async ({
    page,
  }) => {
    await test.step('Navigate to pipeline entity page', async () => {
      await redirectToHomePage(page);
      await pipeline.visitEntityPage(page);
    });

    await test.step('Navigate to Executions tab', async () => {
      await page.getByTestId('executions').click();
      await expect(page.getByTestId('execution-tab')).toBeVisible();
    });

    await test.step('Verify ListView displays timing columns', async () => {
      await expect(page.getByTestId('list-view-table')).toBeVisible();

      await expect(page.getByText('Start Time')).toBeVisible();
      await expect(page.getByText('End Time')).toBeVisible();
      await expect(page.getByText('Duration')).toBeVisible();
    });

    await test.step('Verify execution data rows are present', async () => {
      const tableRows = page.locator(
        '[data-testid="list-view-table"] tbody tr'
      );
      await expect(tableRows).toHaveCount(2);
    });

    await test.step('Verify duration is 10 minutes for both tasks', async () => {
      const snowflakeTaskDuration = page.getByTestId('duration-snowflake_task');
      const prestoTaskDuration = page.getByTestId('duration-presto_task');

      await expect(snowflakeTaskDuration).toHaveText('10.00 minutes');
      await expect(prestoTaskDuration).toHaveText('10.00 minutes');
    });
  });
});
