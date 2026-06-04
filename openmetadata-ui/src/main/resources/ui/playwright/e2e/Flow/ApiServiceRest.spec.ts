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
import { PLAYWRIGHT_INGESTION_TAG_OBJ } from '../../constant/config';
import { BIG_ENTITY_DELETE_TIMEOUT } from '../../constant/delete';
import { GlobalSettingOptions } from '../../constant/settings';
import {
  redirectToHomePage,
  toastNotification,
  uuid,
} from '../../utils/common';
import { testConnection } from '../../utils/serviceIngestion';
import { settingClick } from '../../utils/sidebar';

const apiServiceConfig = {
  name: `pw-api-service-${uuid()}`,
  displayName: `API Service-${uuid()}`,
  description: 'Testing API service',
  openAPISchemaConnection: {
    openAPISchemaURL: 'https://example.com/swagger.json',
  },
  token: '********',
};

const mockSuccessfulRestTestConnection = async (page: Page) => {
  const workflowId = 'pw-rest-test-workflow';

  await page.route(
    '**/api/v1/services/testConnectionDefinitions/name/**',
    (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          name: 'Rest.testConnectionDefinition',
          steps: [
            {
              name: 'CheckAccess',
              mandatory: true,
              description: 'Validate REST API access',
            },
          ],
        }),
      })
  );
  await page.route('**/api/v1/automations/workflows', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();

      return;
    }

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        id: workflowId,
        name: workflowId,
        status: 'Running',
        workflowType: 'TEST_CONNECTION',
      }),
    });
  });
  await page.route('**/api/v1/automations/workflows/trigger/**', (route) =>
    route.fulfill({ status: 200, body: '{}' })
  );
  await page.route(
    `**/api/v1/automations/workflows/${workflowId}**`,
    (route) => {
      if (route.request().method() === 'DELETE') {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ id: workflowId }),
        });
      }

      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          id: workflowId,
          name: workflowId,
          status: 'Successful',
          workflowType: 'TEST_CONNECTION',
          response: {
            status: 'Successful',
            steps: [
              {
                name: 'CheckAccess',
                mandatory: true,
                passed: true,
                message: 'Connected',
              },
            ],
          },
        }),
      });
    }
  );
};

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('API service', PLAYWRIGHT_INGESTION_TAG_OBJ, () => {
  test.beforeEach('Visit entity details page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('add update and delete api service type REST', async ({ page }) => {
    await mockSuccessfulRestTestConnection(page);
    await settingClick(page, GlobalSettingOptions.APIS);

    await page.getByTestId('add-service-button').click();
    await page.getByTestId('Rest').click();
    await page.locator('#service-name').waitFor();

    await page.locator('#service-name').fill(apiServiceConfig.name);
    await page.getByTestId('add-description-button').click();
    await page
      .getByTestId('service-description')
      .fill(apiServiceConfig.description);

    await page
      .locator('#root\\/openAPISchemaConnection\\/openAPISchemaURL')
      .fill(apiServiceConfig.openAPISchemaConnection.openAPISchemaURL);

    await page.locator('#root\\/token').fill(apiServiceConfig.token);

    await testConnection(page);

    await page.getByTestId('submit-btn').click();

    const autoPilotApplicationRequest = page.waitForRequest(
      (request) =>
        request.url().includes('/api/v1/apps/trigger/AutoPilotApplication') &&
        request.method() === 'POST'
    );

    await page.getByRole('button', { name: 'Create & Deploy' }).click();

    await autoPilotApplicationRequest;

    await expect(page.getByTestId('entity-header-name')).toHaveText(
      apiServiceConfig.name
    );

    // update display name
    await page.getByTestId('manage-button').click();
    await page.getByTestId('rename-button').click();

    await page.locator('#displayName').fill(apiServiceConfig.displayName);
    await page.getByTestId('save-button').click();

    await expect(page.getByTestId('entity-header-display-name')).toHaveText(
      apiServiceConfig.displayName
    );

    // delete the entity
    await page.getByTestId('manage-button').click();
    await page.getByTestId('delete-button').click();

    await page.locator('[role="dialog"].ant-modal').waitFor();

    await expect(page.locator('[role="dialog"].ant-modal')).toBeVisible();

    await page.click('[data-testid="hard-delete-option"]');
    await page.check('[data-testid="hard-delete"]');
    await page.fill('[data-testid="confirmation-text-input"]', 'DELETE');

    const deleteResponse = page.waitForResponse(
      '/api/v1/services/apiServices/async/*?hardDelete=true&recursive=true'
    );

    await page.click('[data-testid="confirm-button"]');

    await deleteResponse;

    await toastNotification(
      page,
      /deleted successfully!/,
      BIG_ENTITY_DELETE_TIMEOUT
    );
  });
});
