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
import { PLAYWRIGHT_INGESTION_TAG_OBJ } from '../../constant/config';
import { TableClass } from '../../support/entity/TableClass';
import { getApiContext, redirectToHomePage, uuid } from '../../utils/common';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test(
  'TestSuite multi pipeline support',
  PLAYWRIGHT_INGESTION_TAG_OBJ,
  async ({ page }) => {
    test.slow(true);

    await redirectToHomePage(page);
    const { apiContext, afterAction } = await getApiContext(page);
    const table = new TableClass(`multi pipeline !@#$%^&*()_-+=test-${uuid()}`);
    await table.create(apiContext);
    await table.visitEntityPage(page, table.entity.name);
    const testCaseName = `multi-pipeline-test-${uuid()}`;
    const pipelineName = `test suite pipeline 2`;

    await test.step('Create a new pipeline', async () => {
      await page.getByText('Data Observability').click();
      await page
        .getByRole('menuitem', {
          name: 'Table Profile',
        })
        .click();
      await page.getByTestId('profiler-add-table-test-btn').click();
      await page.getByTestId('test-case').click();
      await page.getByTestId('test-case-name').clear();
      await page.getByTestId('test-case-name').fill(testCaseName);
      await page.getByTestId('test-type').locator('div').click();
      await page.getByText('Table Column Count To Equal').click();
      await page.getByPlaceholder('Enter a Count').fill('13');
      const createTestCaseResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/dataQuality/testCases') &&
          response.request().method() === 'POST'
      );
      await page.getByTestId('create-btn').click();
      await createTestCaseResponse;

      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await page.getByRole('menuitem', { name: 'Data Quality' }).click();
      await page.getByRole('tab', { name: 'Pipeline' }).click();
      await page.getByTestId('add-pipeline-button').click();

      await page.fill('[data-testid="pipeline-name"]', pipelineName);

      await page.getByTestId(testCaseName).click();

      await page.getByTestId('cron-type').locator('div').click();
      await page.getByTitle('Week').click();

      await expect(page.getByTestId('deploy-button')).toBeVisible();

      await page.getByTestId('deploy-button').click();

      await page.waitForSelector('[data-testid="body-text"]', {
        state: 'detached',
      });

      await expect(page.getByTestId('success-line')).toContainText(
        /has been created and deployed successfully/
      );
      await expect(page.getByTestId('view-service-button')).toContainText(
        'View Test Suite'
      );
      await expect(page.getByTestId('view-service-button')).toBeVisible();

      await page.getByTestId('view-service-button').click();
    });

    await test.step('Update the pipeline', async () => {
      await page.getByRole('tab', { name: 'Pipeline' }).click();
      await page
        .getByRole('row', {
          name: new RegExp(pipelineName),
        })
        .getByTestId('more-actions')
        .click();

      await page
        .locator(
          '[data-testid="actions-dropdown"]:visible [data-testid="edit-button"]'
        )
        .click();

      await expect(page.getByRole('checkbox').first()).toBeVisible();

      await page
        .getByTestId('week-segment-day-option-container')
        .getByText('W')
        .click();
      await page.getByTestId('deploy-button').click();
      await page.waitForSelector('[data-testid="body-text"]', {
        state: 'detached',
      });

      await expect(page.getByTestId('success-line')).toContainText(
        /has been updated and deployed successfully/
      );

      await page.getByTestId('view-service-button').click();
    });

    await test.step('Delete the pipeline', async () => {
      await page.getByRole('tab', { name: 'Pipeline' }).click();
      await page
        .getByRole('row', {
          name: new RegExp(pipelineName),
        })
        .getByTestId('more-actions')
        .click();

      await page
        .locator(
          '[data-testid="actions-dropdown"]:visible [data-testid="delete-button"]'
        )
        .click();

      await page.getByTestId('confirmation-text-input').fill('DELETE');
      const deleteRes = page.waitForResponse(
        '/api/v1/services/ingestionPipelines/*?hardDelete=true'
      );
      await page.getByTestId('confirm-button').click();
      await deleteRes;

      await page
        .getByTestId('ingestion-list-table')
        .getByTestId('more-actions')
        .click();

      await page
        .locator(
          '[data-testid="actions-dropdown"]:visible [data-testid="delete-button"]'
        )
        .click();
      await page.getByTestId('confirmation-text-input').fill('DELETE');
      await page.getByTestId('confirm-button').click();
      await deleteRes;

      await expect(
        page.getByTestId('assign-error-placeholder-Pipeline')
      ).toContainText(
        "Add a pipeline to automate the data quality tests at a regular schedule. It's advisable to align the schedule with the frequency of table loads for optimal results"
      );
      await expect(page.getByTestId('add-placeholder-button')).toBeVisible();
    });

    await table.delete(apiContext);
    await afterAction();
  }
);

test(
  "Edit the pipeline's test case",
  PLAYWRIGHT_INGESTION_TAG_OBJ,
  async ({ page }) => {
    test.slow(true);

    await redirectToHomePage(page);
    const { apiContext, afterAction } = await getApiContext(page);
    const table = new TableClass(`multi pipeline !@#$%^&*()_-+=test-${uuid()}`);
    await table.create(apiContext);
    for (let index = 0; index < 4; index++) {
      await table.createTestCase(apiContext);
    }
    const testCaseNames = [
      table.testCasesResponseData[0]?.['name'],
      table.testCasesResponseData[1]?.['name'],
    ];
    const pipeline = await table.createTestSuitePipeline(
      apiContext,
      testCaseNames
    );
    await table.visitEntityPage(page, table.entity.name);
    await page.getByText('Data Observability').click();
    await page.getByRole('menuitem', { name: 'Data Quality' }).click();

    await page.getByRole('tab', { name: 'Pipeline' }).click();
    await page
      .getByRole('row', {
        name: new RegExp(pipeline?.['name']),
      })
      .getByTestId('more-actions')
      .click({ force: true });

    await page
      .locator(
        '[data-testid="actions-dropdown"]:visible [data-testid="edit-button"]'
      )
      .click();

    for (const testCaseName of testCaseNames) {
      await expect(page.getByTestId(`checkbox-${testCaseName}`)).toBeChecked();
    }

    await page.getByTestId(`checkbox-${testCaseNames[0]}`).click();

    await expect(
      page.getByTestId(`checkbox-${testCaseNames[0]}`)
    ).not.toBeChecked();

    await page.getByTestId('deploy-button').click();
    await page.waitForSelector('[data-testid="body-text"]', {
      state: 'detached',
    });

    await expect(page.getByTestId('success-line')).toContainText(
      /has been updated and deployed successfully/
    );

    await page.getByTestId('view-service-button').click();

    await page.getByRole('tab', { name: 'Pipeline' }).click();
    await page
      .getByRole('row', {
        name: new RegExp(pipeline?.['name']),
      })
      .getByTestId('more-actions')
      .click();

    await page
      .locator(
        '[data-testid="actions-dropdown"]:visible [data-testid="edit-button"]'
      )
      .click();

    await expect(
      page.getByTestId(`checkbox-${testCaseNames[0]}`)
    ).not.toBeChecked();
    await expect(
      page.getByTestId(`checkbox-${testCaseNames[1]}`)
    ).toBeChecked();

    await table.delete(apiContext);
    await afterAction();
  }
);
