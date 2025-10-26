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
  supersetFormDetails1,
  supersetFormDetails2,
  supersetFormDetails3,
  supersetFormDetails4,
} from '../../constant/serviceForm';
import { redirectToHomePage, uuid } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { fillSupersetFormDetails } from '../../utils/serviceFormUtils';
import { test } from '../fixtures/pages';

const NEW_SERVICE = {
  name: `PlaywrightService_${uuid()}`,
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
      await page.getByTestId('service-name').fill(`${NEW_SERVICE.name}`);
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
      await page.getByTestId('service-name').fill(`${NEW_SERVICE.name}`);
      await page.waitForLoadState('networkidle');

      await expect(page.locator('#name_help')).toContainText(
        'Name already exists.'
      );

      await page.getByRole('link', { name: 'Database Services' }).click();
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);
      await page.getByTestId(`service-name-${NEW_SERVICE.name}`).click();
      await page.waitForLoadState('networkidle');
      await page.getByTestId('manage-button').click();
      await page.getByTestId('delete-button-title').click();
      await page.getByTestId('confirmation-text-input').fill('DELETE');
      await page.getByTestId('confirm-button').click();
      await page.waitForLoadState('networkidle');

      await expect(page.getByTestId('alert-message')).toContainText(
        `Delete operation initiated for ${NEW_SERVICE.name}`
      );
    });
  });
});
