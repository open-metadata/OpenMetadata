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

import { expect, Page, test } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  advanceToServiceConnectionStep,
  selectServiceConnector,
} from '../../utils/serviceIngestion';

const MOCK_WORKFLOW_ID = 'mock-test-workflow-id';

const MOCK_STEPS = [
  {
    name: 'CheckAccess',
    mandatory: true,
    description: 'Check database connectivity',
  },
  {
    name: 'GetDatabases',
    mandatory: true,
    description: 'Get list of databases',
  },
];

async function setupWorkflowApiMocks(page: Page, workflowGetResponse: object) {
  // Mock the test connection step definitions
  await page.route(
    '**/api/v1/services/testConnectionDefinitions/name/**',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ steps: MOCK_STEPS }),
      });
    }
  );

  // Mock create + delete workflow
  await page.route('**/api/v1/automations/workflows', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: MOCK_WORKFLOW_ID,
          name: 'TestConnection.Mysql.localhost',
          workflowType: 'TestConnection',
          status: 'Pending',
          request: {
            connection: { config: {} },
            serviceType: 'Database',
            connectionType: 'Mysql',
          },
        }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock trigger workflow
  await page.route(
    `**/api/v1/automations/workflows/trigger/${MOCK_WORKFLOW_ID}`,
    async (route) => {
      await route.fulfill({ status: 200, body: '' });
    }
  );

  // Mock get workflow (polling)
  await page.route(
    `**/api/v1/automations/workflows/${MOCK_WORKFLOW_ID}**`,
    async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(workflowGetResponse),
        });
      } else {
        // DELETE - workflow cleanup
        await route.fulfill({ status: 200, body: '' });
      }
    }
  );
}

async function navigateToMysqlConnectionForm(page: Page) {
  await page.goto('/databaseServices/add-service');
  await waitForAllLoadersToDisappear(page);
  await selectServiceConnector(page, 'Mysql');
  await page.fill('#service-name', `pw-tc-modal-test`);
  await advanceToServiceConnectionStep(page);
  await page.fill('[id="root\\/username"]', 'test-user');
  await page.fill('[id="root\\/hostPort"]', 'localhost:3306');
}

async function navigateToMysqlFormWithoutFilling(page: Page) {
  await page.goto('/databaseServices/add-service');
  await waitForAllLoadersToDisappear(page);
  await selectServiceConnector(page, 'Mysql');
  await advanceToServiceConnectionStep(page);
}

test.describe(
  'TestConnectionModal UI states',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  async () => {
    test.use({ storageState: 'playwright/.auth/admin.json' });

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
    });

    test('validation shows all required field errors on first click when all fields are empty', async ({
      page,
    }) => {
      await navigateToMysqlFormWithoutFilling(page);

      await page.getByTestId('test-connection-btn').click();

      await expect(page.getByText('Service Name is required.')).toBeVisible();
      await expect(page.getByText('Username is required.')).toBeVisible();
      await expect(page.getByText('Host Port is required.')).toBeVisible();
    });

    test('validation shows RJSF field errors on first click when only service name is filled', async ({
      page,
    }) => {
      await navigateToMysqlFormWithoutFilling(page);
      await page.fill('#service-name', 'pw-validation-test');

      await page.getByTestId('test-connection-btn').click();

      await expect(page.getByText('Username is required.')).toBeVisible();
      await expect(page.getByText('Host Port is required.')).toBeVisible();
    });

    test('modal opens with gate card and capability checks sections', async ({
      page,
    }) => {
      const successResponse = {
        id: MOCK_WORKFLOW_ID,
        status: 'Successful',
        response: {
          status: 'Successful',
          steps: [
            { name: 'CheckAccess', passed: true, mandatory: true },
            { name: 'GetDatabases', passed: true, mandatory: true },
          ],
        },
      };

      await navigateToMysqlConnectionForm(page);
      await setupWorkflowApiMocks(page, successResponse);

      await page.getByTestId('test-connection-btn').click();

      await expect(page.getByTestId('connection-gate-phase')).toBeVisible();
      await expect(page.getByTestId('capability-checks-phase')).toBeVisible();
    });

    test('success state shows Done button and hides Edit Connection and Retry Test', async ({
      page,
    }) => {
      const successResponse = {
        id: MOCK_WORKFLOW_ID,
        status: 'Successful',
        response: {
          status: 'Successful',
          steps: [
            { name: 'CheckAccess', passed: true, mandatory: true },
            { name: 'GetDatabases', passed: true, mandatory: true },
          ],
        },
      };

      await navigateToMysqlConnectionForm(page);
      await setupWorkflowApiMocks(page, successResponse);

      await page.getByTestId('test-connection-btn').click();

      await expect(page.getByRole('button', { name: /done/i })).toBeVisible({
        timeout: 30000,
      });
      await expect(
        page.getByTestId('edit-connection-button')
      ).not.toBeVisible();
      await expect(page.getByTestId('retry-test-button')).not.toBeVisible();
    });

    test('failure state shows Edit Connection button and Retry Test button', async ({
      page,
    }) => {
      const failureResponse = {
        id: MOCK_WORKFLOW_ID,
        status: 'Failed',
        response: {
          status: 'Failed',
          steps: [
            {
              name: 'CheckAccess',
              passed: false,
              mandatory: true,
              errorLog: 'Connection refused: localhost:3306',
            },
          ],
        },
      };

      await navigateToMysqlConnectionForm(page);
      await setupWorkflowApiMocks(page, failureResponse);

      await page.getByTestId('test-connection-btn').click();

      await expect(page.getByTestId('edit-connection-button')).toBeVisible({
        timeout: 30000,
      });
      await expect(page.getByTestId('retry-test-button')).toBeVisible();
    });

    test('failure state shows remediation card with error content', async ({
      page,
    }) => {
      const failureResponse = {
        id: MOCK_WORKFLOW_ID,
        status: 'Failed',
        response: {
          status: 'Failed',
          steps: [
            {
              name: 'CheckAccess',
              passed: false,
              mandatory: true,
              errorLog: 'Connection refused: localhost:3306',
            },
          ],
        },
      };

      await navigateToMysqlConnectionForm(page);
      await setupWorkflowApiMocks(page, failureResponse);

      await page.getByTestId('test-connection-btn').click();

      await expect(page.getByTestId('connection-remediation-card')).toBeVisible(
        { timeout: 30000 }
      );
    });

    test('Edit Connection click dismisses the modal', async ({ page }) => {
      const failureResponse = {
        id: MOCK_WORKFLOW_ID,
        status: 'Failed',
        response: {
          status: 'Failed',
          steps: [
            {
              name: 'CheckAccess',
              passed: false,
              mandatory: true,
              errorLog: 'Auth failed',
            },
          ],
        },
      };

      await navigateToMysqlConnectionForm(page);
      await setupWorkflowApiMocks(page, failureResponse);

      await page.getByTestId('test-connection-btn').click();

      await expect(page.getByTestId('edit-connection-button')).toBeVisible({
        timeout: 30000,
      });

      await page.getByTestId('edit-connection-button').click();

      await expect(page.getByTestId('connection-gate-phase')).not.toBeVisible();
    });

    test('raw log toggle shows and hides connection log', async ({ page }) => {
      const failureResponse = {
        id: MOCK_WORKFLOW_ID,
        status: 'Failed',
        response: {
          status: 'Failed',
          steps: [
            {
              name: 'CheckAccess',
              passed: false,
              mandatory: true,
              message: 'Connection failed',
              errorLog: 'Connection refused: localhost:3306',
            },
          ],
        },
      };

      await navigateToMysqlConnectionForm(page);
      await setupWorkflowApiMocks(page, failureResponse);

      await page.getByTestId('test-connection-btn').click();

      await expect(page.getByText(/show.*raw.*connection.*log/i)).toBeVisible({
        timeout: 30000,
      });

      await page.getByText(/show.*raw.*connection.*log/i).click();

      await expect(page.getByTestId('raw-connection-log')).toBeVisible();

      await page.getByText(/hide.*raw.*connection.*log/i).click();

      await expect(page.getByTestId('raw-connection-log')).not.toBeVisible();
    });
  }
);
