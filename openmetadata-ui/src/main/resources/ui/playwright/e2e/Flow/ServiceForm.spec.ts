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

import { expect } from '@playwright/test';
import {
  lookerFormDetails,
  supersetFormDetails1,
  supersetFormDetails2,
  supersetFormDetails3,
  supersetFormDetails4,
} from '../../constant/serviceForm';
import { redirectToHomePage, uuid } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { fillSupersetFormDetails } from '../../utils/serviceFormUtils';
import { test } from '../fixtures/pages';

const SERVICE_NAMES = {
  service1: `PlaywrightService_${uuid()}`,
  service2: `PlaywrightService_${uuid()}`,
};

test.describe('Service form functionality', async () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test.describe('Superset', () => {
    test('Verify form selects are working properly', async ({ page }) => {
      test.slow();

      await page.goto('/dashboardServices/add-service');
      await waitForAllLoadersToDisappear(page);
      await page.click(`[data-testid="Superset"]`);
      await page.click('[data-testid="next-button"]');

      await page.fill('[data-testid="service-name"]', 'test-superset');
      await page.click('[data-testid="next-button"]');

      // Fill superset form details - 1
      await fillSupersetFormDetails({ page, ...supersetFormDetails1 });

      const testConnectionResponse1 = page.waitForResponse(
        'api/v1/automations/workflows'
      );

      await page.getByTestId('test-connection-btn').click();

      const testConnection1 = await (await testConnectionResponse1).json();

      // Verify form details submission - 1
      expect(testConnection1.request.connection.config.hostPort).toEqual(
        supersetFormDetails1.hostPort
      );
      expect(
        testConnection1.request.connection.config.connection.username
      ).toEqual(supersetFormDetails1.connection.username);
      expect(
        testConnection1.request.connection.config.connection.provider
      ).toEqual(supersetFormDetails1.connection.provider);

      await page
        .getByTestId('test-connection-modal')
        .getByRole('button', { name: 'OK' })
        .click();

      await page.waitForSelector(
        '[data-testid="test-connection-modal"] .ant-modal-mask',
        {
          state: 'detached',
        }
      );

      // Fill superset form details - 2
      await fillSupersetFormDetails({ page, ...supersetFormDetails2 });

      const testConnectionResponse2 = page.waitForResponse(
        'api/v1/automations/workflows'
      );

      await page.getByTestId('test-connection-btn').click();

      const testConnection2 = await (await testConnectionResponse2).json();

      // Verify form details submission - 2
      expect(testConnection2.request.connection.config.hostPort).toEqual(
        supersetFormDetails2.hostPort
      );
      expect(
        testConnection2.request.connection.config.connection.username
      ).toEqual(supersetFormDetails2.connection.username);
      expect(
        testConnection2.request.connection.config.connection.provider
      ).toEqual(supersetFormDetails2.connection.provider);

      await page
        .getByTestId('test-connection-modal')
        .getByRole('button', { name: 'OK' })
        .click();

      await page.waitForSelector(
        '[data-testid="test-connection-modal"] .ant-modal-mask',
        {
          state: 'detached',
        }
      );

      // Fill superset form details - 3
      await fillSupersetFormDetails({ page, ...supersetFormDetails3 });

      const testConnectionResponse3 = page.waitForResponse(
        'api/v1/automations/workflows'
      );

      await page.getByTestId('test-connection-btn').click();

      const testConnection3 = await (await testConnectionResponse3).json();

      // Verify form details submission - 3
      expect(testConnection3.request.connection.config.hostPort).toEqual(
        supersetFormDetails3.hostPort
      );
      expect(
        testConnection3.request.connection.config.connection.username
      ).toEqual(supersetFormDetails3.connection.username);
      expect(
        testConnection3.request.connection.config.connection.hostPort
      ).toEqual(supersetFormDetails3.connection.hostPort);
      expect(
        testConnection3.request.connection.config.connection.database
      ).toEqual(supersetFormDetails3.connection.database);
      expect(
        testConnection3.request.connection.config.connection.scheme
      ).toEqual(supersetFormDetails3.connection.scheme);

      await page
        .getByTestId('test-connection-modal')
        .getByRole('button', { name: 'OK' })
        .click();

      await page.waitForSelector(
        '[data-testid="test-connection-modal"] .ant-modal-mask',
        {
          state: 'detached',
        }
      );

      // Fill superset form details - 4
      await fillSupersetFormDetails({ page, ...supersetFormDetails4 });

      const testConnectionResponse4 = page.waitForResponse(
        'api/v1/automations/workflows'
      );

      await page.getByTestId('test-connection-btn').click();

      const testConnection4 = await (await testConnectionResponse4).json();

      // Verify form details submission - 4
      expect(testConnection4.request.connection.config.hostPort).toEqual(
        supersetFormDetails4.hostPort
      );
      expect(
        testConnection4.request.connection.config.connection.username
      ).toEqual(supersetFormDetails4.connection.username);
      expect(
        testConnection4.request.connection.config.connection.hostPort
      ).toEqual(supersetFormDetails4.connection.hostPort);
      expect(
        testConnection4.request.connection.config.connection.scheme
      ).toEqual(supersetFormDetails4.connection.scheme);
    });
  });

  test.describe('Database service', () => {
    test('Verify service name field validation errors', async ({ page }) => {
      test.slow();

      await page.goto('/databaseServices/add-service');
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await page.getByTestId('BigQuery').click();
      await page.getByTestId('next-button').click();
      await page.getByTestId('next-button').click();

      await expect(page.locator('#name_help')).toContainText(
        'Name is required'
      );

      await page.getByTestId('service-name').click();
      await page.getByTestId('service-name').fill(`${SERVICE_NAMES.service1}`);
      await page.getByTestId('next-button').click();
      await page.getByTestId('submit-btn').click();
      await page.getByTestId('submit-btn').click();
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await expect(page.getByTestId('entity-header-title')).toBeVisible();

      await page.getByRole('link', { name: 'Database Services' }).click();
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);
      await page.getByTestId('add-service-button').click();
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);
      await page.getByTestId('Databricks').click();
      await page.getByTestId('next-button').click();

      await page.getByTestId('service-name').click();
      await page.getByTestId('service-name').fill(`${SERVICE_NAMES.service1}`);
      await page.waitForLoadState('networkidle');

      await expect(page.locator('#name_help')).toContainText(
        'Name already exists.'
      );

      await page.getByRole('link', { name: 'Database Services' }).click();
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);
      await page.getByTestId(`service-name-${SERVICE_NAMES.service1}`).click();
      await page.waitForLoadState('networkidle');
      await page.getByTestId('manage-button').click();
      await page.getByTestId('delete-button-title').click();
      await page.getByTestId('confirmation-text-input').fill('DELETE');
      await page.getByTestId('confirm-button').click();
      await page.waitForLoadState('networkidle');

      await expect(page.getByTestId('alert-message')).toContainText(
        `Delete operation initiated for ${SERVICE_NAMES.service1}`
      );
    });
  });

  test.describe('Looker', () => {
    test('Verify if string input inside oneOf config works properly', async ({
      page,
    }) => {
      await page.goto('/dashboardServices/add-service');
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await page.getByTestId('Looker').click();
      await page.getByTestId('next-button').click();
      await page.getByTestId('next-button').click();

      await page.getByTestId('service-name').click();
      await page.getByTestId('service-name').fill(`${SERVICE_NAMES.service2}`);
      await page.getByTestId('next-button').click();

      await page.locator('#root\\/clientId').clear();
      await page.fill('#root\\/clientId', lookerFormDetails.clientId);

      await page.locator('#root\\/clientSecret').clear();
      await page.fill('#root\\/clientSecret', lookerFormDetails.clientSecret);

      await page.locator('#root\\/hostPort').clear();
      await page.fill('#root\\/hostPort', lookerFormDetails.hostPort);

      await page
        .getByTestId('select-widget-root/gitCredentials__oneof_select')
        .click();
      await page.click(`.ant-select-dropdown:visible [title="Local Path"]`);

      await page.waitForSelector('#root\\/gitCredentials', {
        state: 'visible',
      });

      await page.locator('#root\\/gitCredentials').clear();
      await page.fill(
        '#root\\/gitCredentials',
        lookerFormDetails.gitCredentials
      );

      const testConnectionResponse = page.waitForResponse(
        'api/v1/automations/workflows'
      );

      await page.getByTestId('test-connection-btn').click();

      const testConnection = await (await testConnectionResponse).json();

      // Verify form details submission
      expect(testConnection.request.connection.config.clientId).toEqual(
        lookerFormDetails.clientId
      );
      expect(testConnection.request.connection.config.hostPort).toEqual(
        lookerFormDetails.hostPort
      );
      expect(testConnection.request.connection.config.type).toEqual(
        lookerFormDetails.type
      );
      expect(testConnection.request.connection.config.gitCredentials).toEqual(
        lookerFormDetails.gitCredentials
      );
    });
  });
});
