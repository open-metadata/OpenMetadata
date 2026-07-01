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
import * as fs from 'fs';
import * as path from 'path';
import { PLAYWRIGHT_INGESTION_TAG_OBJ } from '../../constant/config';
import { SERVICE_TYPE } from '../../constant/service';
import {
  CERT_FILE,
  lookerFormDetails,
  supersetFormDetails1,
  supersetFormDetails2,
  supersetFormDetails3,
  supersetFormDetails4,
} from '../../constant/serviceForm';
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import { MessagingServiceClass } from '../../support/entity/service/MessagingServiceClass';
import { UserClass } from '../../support/user/UserClass';
import { createNewPage, redirectToHomePage, uuid } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { visitServiceDetailsPage } from '../../utils/service';
import {
  fillSupersetFormDetails,
  selectOneOfOption,
} from '../../utils/serviceFormUtils';
import {
  advanceToServiceConnectionStep,
  selectServiceConnector,
  waitForServiceConnectionForm,
} from '../../utils/serviceIngestion';

const SERVICE_NAMES = {
  service1: `PlaywrightService_${uuid()}`,
  service2: `PlaywrightService_${uuid()}`,
};

const adminUser = new UserClass();

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe(
  'Service form functionality',
  PLAYWRIGHT_INGESTION_TAG_OBJ,
  async () => {
    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
    });

    test.beforeAll('Setup pre-requests', async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await afterAction();
    });

    test.afterAll('Cleanup admin user', async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await adminUser.delete(apiContext);
      await afterAction();
    });

    test.describe('Superset', () => {
      // Create the Certificate file for upload
      const testCertPath = path.join(__dirname, '..', 'output', CERT_FILE);

      test.beforeAll(() => {
        const fixturesDir = path.dirname(testCertPath);
        if (!fs.existsSync(fixturesDir)) {
          fs.mkdirSync(fixturesDir, { recursive: true });
        }

        fs.writeFileSync(testCertPath, CERT_FILE);
      });

      test.afterAll(() => {
        if (fs.existsSync(testCertPath)) {
          fs.unlinkSync(testCertPath);
        }
      });

      test('Verify form selects are working properly', async ({ page }) => {
        test.slow();

        await page.goto('/dashboardServices/add-service');
        await waitForAllLoadersToDisappear(page);
        await selectServiceConnector(page, 'Superset');

        await page.fill('#service-name', 'test-superset');
        await advanceToServiceConnectionStep(page);

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

        await page.getByTestId('test-connection-close').click();

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

        await page.getByTestId('test-connection-close').click();

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

        await page.getByTestId('test-connection-close').click();

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

      test('Verify SSL cert upload with long filename and UI overflow handling', async ({
        page,
      }) => {
        await page.goto('/dashboardServices/add-service');
        await waitForAllLoadersToDisappear(page);
        await selectServiceConnector(page, 'Superset');

        await page.fill('#service-name', 'test-superset');
        await advanceToServiceConnectionStep(page);

        await fillSupersetFormDetails({ page, ...supersetFormDetails1 });

        await page
          .getByRole('button', { name: 'Show advanced credential' })
          .click();

        // Upload the test certificate file
        const fileInput1 = page.locator(
          '[data-field-name="caCertificate"] input[type="file"]'
        );
        await fileInput1.setInputFiles(testCertPath);

        // Wait for file upload to complete
        await expect(
          page.locator('[id="root/connection/sslConfig/caCertificate"]')
        ).toHaveValue(CERT_FILE);

        // Verify the certificate content is sent correctly.
        const testConnectionResponse1 = page.waitForResponse(
          'api/v1/automations/workflows'
        );

        await page.getByTestId('test-connection-btn').click();

        const testConnection1 = await (await testConnectionResponse1).json();

        // Verify form details submission - 1
        expect(
          testConnection1.request.connection.config.connection.sslConfig
            .caCertificate
        ).toEqual(CERT_FILE);

        await page.getByTestId('test-connection-close').click();
      });
    });

    test.describe('Database service', () => {
      test('Verify service name field validation errors', async ({
        browser,
        page,
      }) => {
        test.slow();

        await page.goto('/databaseServices/add-service');
        await waitForAllLoadersToDisappear(page);

        await selectServiceConnector(page, 'BigQuery');

        await expect(page.getByTestId('next-button')).toBeDisabled();

        await page.locator('#service-name').click();
        await page.locator('#service-name').fill(`${SERVICE_NAMES.service1}`);
        await advanceToServiceConnectionStep(page);

        const { apiContext, afterAction } = await createNewPage(browser);
        const databaseService = new DatabaseServiceClass(
          SERVICE_NAMES.service1
        );
        await databaseService.create(apiContext);
        await afterAction();

        await page.goto('/databaseServices/add-service');
        await waitForAllLoadersToDisappear(page);
        await selectServiceConnector(page, 'Databricks');

        await page.locator('#service-name').click();
        await page.locator('#service-name').fill(`${SERVICE_NAMES.service1}`);

        await expect(
          page.getByTestId('service-name-card').locator('[slot="errorMessage"]')
        ).toContainText(
          `A database service named ${SERVICE_NAMES.service1} already exists. `
        );
      });

      test.afterAll(async ({ browser }) => {
        const { apiContext, afterAction } = await createNewPage(browser);

        // Cleanup the created service
        await apiContext.delete(
          `/api/v1/services/databaseServices/name/${encodeURIComponent(
            SERVICE_NAMES.service1
          )}?recursive=true&hardDelete=true`
        );

        await afterAction();
      });
    });

    test.describe('Looker', () => {
      test('Verify if string input inside oneOf config works properly', async ({
        page,
      }) => {
        await page.goto('/dashboardServices/add-service');
        await waitForAllLoadersToDisappear(page);

        await selectServiceConnector(page, 'Looker');

        await page.locator('#service-name').click();
        await page.locator('#service-name').fill(`${SERVICE_NAMES.service2}`);
        await advanceToServiceConnectionStep(page);

        await page.locator(String.raw`#root\/clientId`).clear();
        await page.fill(
          String.raw`#root\/clientId`,
          lookerFormDetails.clientId
        );

        await page.locator(String.raw`#root\/clientSecret`).clear();
        await page.fill(
          String.raw`#root\/clientSecret`,
          lookerFormDetails.clientSecret
        );

        await page.locator(String.raw`#root\/hostPort`).clear();
        await page.fill(
          String.raw`#root\/hostPort`,
          lookerFormDetails.hostPort
        );
        await page.getByTestId('connection-section-scope').click();

        await selectOneOfOption(
          page,
          'root/gitCredentials',
          'select-widget-root/gitCredentials__oneof_select',
          'Local Path'
        );

        await page.locator(String.raw`#root\/gitCredentials`).waitFor({
          state: 'visible',
        });

        await page.locator(String.raw`#root\/gitCredentials`).clear();
        await page.fill(
          String.raw`#root\/gitCredentials`,
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

    // Regression coverage for issue #25434:
    // Clearing `schemaRegistryTopicSuffixName` on a Kafka connection must
    // send an empty string to the backend instead of dropping the field,
    // so the cleared value is persisted on reload.
    test.describe('Kafka', () => {
      const kafkaService = new MessagingServiceClass(
        `pw-kafka-empty-suffix-${uuid()}`
      );

      test.beforeAll(
        'Create Kafka service with suffix set',
        async ({ browser }) => {
          const { apiContext, afterAction } = await createNewPage(browser);
          await kafkaService.create(apiContext);
          await kafkaService.patch(apiContext, [
            {
              op: 'add',
              path: '/connection/config/schemaRegistryURL',
              value: 'http://localhost:8081',
            },
            {
              op: 'add',
              path: '/connection/config/schemaRegistryTopicSuffixName',
              value: '-value',
            },
          ]);
          await afterAction();
        }
      );

      test.afterAll('Cleanup Kafka service', async ({ browser }) => {
        const { apiContext, afterAction } = await createNewPage(browser);
        await kafkaService.delete(apiContext);
        await afterAction();
      });

      test('should persist empty schemaRegistryTopicSuffixName when the field is cleared', async ({
        page,
      }) => {
        await visitServiceDetailsPage(
          page,
          {
            name: kafkaService.entity.name,
            type: SERVICE_TYPE.Messaging,
          },
          false,
          false
        );

        await page.getByRole('tab', { name: 'Connection' }).click();
        await page.getByTestId('edit-connection-button').click();
        await waitForAllLoadersToDisappear(page);
        await waitForServiceConnectionForm(page);

        await page.getByTestId('connection-section-scope').click();

        const suffixInput = page.locator(
          String.raw`#root\/schemaRegistryTopicSuffixName`
        );

        await expect(suffixInput).toHaveValue('-value');
        await suffixInput.clear();
        await expect(suffixInput).toHaveValue('');

        const patchResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/services/messagingServices') &&
            response.request().method() === 'PATCH'
        );

        await page.getByTestId('next-button').click();
        await page.getByRole('button', { name: 'Save' }).click();

        const patch = await patchResponse;
        const patchBody = patch.request().postDataJSON() as Array<{
          op: string;
          path: string;
          value?: unknown;
        }>;

        const suffixOp = patchBody.find(
          (op) => op.path === '/connection/config/schemaRegistryTopicSuffixName'
        );

        // The fix must send an explicit empty string, not drop the field
        // (which would leave the stale "-value" on the server).
        expect(suffixOp).toBeDefined();
        expect(suffixOp?.value).toBe('');

        await waitForAllLoadersToDisappear(page);

        // Reopen the edit form and verify the cleared value persisted.
        await page.getByTestId('edit-connection-button').click();
        await waitForAllLoadersToDisappear(page);
        await waitForServiceConnectionForm(page);

        await page.getByTestId('connection-section-scope').click();

        await expect(
          page.locator(String.raw`#root\/schemaRegistryTopicSuffixName`)
        ).toHaveValue('');
      });
    });

    test.describe('Test Connection service name validation', () => {
      test('should show service name error and not open modal when test connection clicked without service name', async ({
        page,
      }) => {
        await page.goto('/databaseServices/add-service');
        await waitForAllLoadersToDisappear(page);

        await selectServiceConnector(page, 'Mysql');
        await waitForServiceConnectionForm(page);

        // Click test connection without filling service name
        await page.getByTestId('test-connection-btn').click();

        // Service name error should appear on the name card
        await expect(
          page.getByTestId('service-name-card').locator('[slot="errorMessage"]')
        ).toContainText('Service Name is required.');

        // Test connection modal must NOT have opened
        await expect(
          page.locator('.test-connection-status-modal')
        ).not.toBeVisible();
      });

      test('should include service name in missing required field count shown on test connection card', async ({
        page,
      }) => {
        await page.goto('/databaseServices/add-service');
        await waitForAllLoadersToDisappear(page);

        await selectServiceConnector(page, 'Mysql');
        await waitForServiceConnectionForm(page);

        // The test connection description should warn about filling required fields
        // (service name counts as one of those required fields)
        await expect(page.getByTestId('message-container')).toContainText(
          'more required field'
        );
      });

      test('should focus the service name input when test connection is clicked without a name', async ({
        page,
      }) => {
        await page.goto('/databaseServices/add-service');
        await waitForAllLoadersToDisappear(page);

        await selectServiceConnector(page, 'Mysql');
        await waitForServiceConnectionForm(page);

        await page.getByTestId('test-connection-btn').click();

        await expect(page.getByTestId('service-name')).toBeFocused();
      });
    });
  }
);
