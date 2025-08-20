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
import { BIG_ENTITY_DELETE_TIMEOUT } from '../../constant/delete';
import { GlobalSettingOptions } from '../../constant/settings';
import {
  descriptionBox,
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
  openAPISchemaURL: 'https://example.com/swagger.json',
  token: '********',
};

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('API service', () => {
  test.beforeEach('Visit entity details page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('add update and delete api service type REST', async ({ page }) => {
    await settingClick(page, GlobalSettingOptions.APIS);

    await page.getByTestId('add-service-button').click();
    await page.getByTestId('Rest').click();
    await page.getByTestId('next-button').click();

    // step 1
    await page.getByTestId('service-name').fill(apiServiceConfig.name);
    await page.locator(descriptionBox).fill(apiServiceConfig.description);
    await page.getByTestId('next-button').click();

    // step 2
    await page
      .locator('#root\\/openAPISchemaURL')
      .fill(apiServiceConfig.openAPISchemaURL);

    await page.locator('#root\\/token').fill(apiServiceConfig.token);
    await testConnection(page);
    await page.getByTestId('submit-btn').click();

    const autoPilotApplicationRequest = page.waitForRequest(
      (request) =>
        request.url().includes('/api/v1/apps/trigger/AutoPilotApplication') &&
        request.method() === 'POST'
    );

    await page.getByTestId('submit-btn').getByText('Save').click();

    await autoPilotApplicationRequest;

    // step 3
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

    await page.waitForSelector('[role="dialog"].ant-modal');

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
