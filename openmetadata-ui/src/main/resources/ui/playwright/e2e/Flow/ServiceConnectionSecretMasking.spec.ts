/*
 *  Copyright 2026 Collate.
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

/**
 * A stored connection secret must stay masked wherever a saved service on a real server shows it.
 *
 * A Redshift password once rendered as readable text on the Connection tab: the secret sits
 * inside the `authType` oneOf, and the read-only view only looked for `format: password` on
 * direct properties (#28299). One connector per secret shape — an `authType` oneOf, a flat
 * field the form folds into a synthesized `authType`, a top-level field, a non-database
 * service. Every connector's schema is covered by ServiceConnectionDetails.browser.test.tsx.
 */

import { Page } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { expect, test } from '../../support/fixtures/base';
import { createNewPage, redirectToHomePage, uuid } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { waitForServiceConnectionForm } from '../../utils/serviceIngestion';

const SECRET = 'pw-Plaintext-Secret-123';

interface ConnectorCase {
  serviceType: string;
  category: 'databaseServices' | 'dashboardServices' | 'messagingServices';
  // RJSF field id of the secret in the edit form.
  secretFieldId: string;
  // Key the read-only Connection tab labels the secret with.
  secretKey: string;
  config: Record<string, unknown>;
}

const CONNECTORS: ConnectorCase[] = [
  {
    serviceType: 'Redshift',
    category: 'databaseServices',
    secretFieldId: 'root/authType/password',
    secretKey: 'password',
    config: {
      type: 'Redshift',
      username: 'pw_user',
      hostPort: 'pw-redshift.example.com:5439',
      database: 'dev',
      authType: { password: SECRET },
    },
  },
  {
    serviceType: 'Snowflake',
    category: 'databaseServices',
    // Stored flat, but the form synthesizes an `authType` oneOf for the Password / Key pair tabs.
    secretFieldId: 'root/authType/password',
    secretKey: 'password',
    config: {
      type: 'Snowflake',
      username: 'pw_user',
      account: 'pw-account',
      warehouse: 'COMPUTE_WH',
      password: SECRET,
    },
  },
  {
    serviceType: 'Tableau',
    category: 'dashboardServices',
    secretFieldId: 'root/authType/password',
    secretKey: 'password',
    config: {
      type: 'Tableau',
      hostPort: 'http://localhost:8080',
      authType: { username: 'pw_user', password: SECRET },
    },
  },
  {
    serviceType: 'Kafka',
    category: 'messagingServices',
    secretFieldId: 'root/saslPassword',
    secretKey: 'saslPassword',
    config: {
      type: 'Kafka',
      bootstrapServers: 'localhost:9092',
      saslUsername: 'pw_user',
      saslPassword: SECRET,
    },
  },
];

const openConnectionTab = async (
  page: Page,
  { category }: ConnectorCase,
  serviceName: string
) => {
  const serviceResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().includes(`/api/v1/services/${category}/name/`)
  );
  await page.goto(`/service/${category}/${serviceName}/connection`);
  await serviceResponse;
  await waitForAllLoadersToDisappear(page);
};

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe(
  'Service connection secret masking',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    for (const connectorCase of CONNECTORS) {
      test.describe(connectorCase.serviceType, () => {
        const serviceName = `pw-secret-mask-${connectorCase.serviceType.toLowerCase()}-${uuid()}`;

        test.beforeAll('Create service via API', async ({ browser }) => {
          const { apiContext, afterAction } = await createNewPage(browser);
          const response = await apiContext.post(
            `/api/v1/services/${connectorCase.category}`,
            {
              data: {
                name: serviceName,
                serviceType: connectorCase.serviceType,
                connection: { config: connectorCase.config },
              },
            }
          );
          expect(response.status()).toBe(201);
          await afterAction();
        });

        test.afterAll('Delete service', async ({ browser }) => {
          const { apiContext, afterAction } = await createNewPage(browser);
          await apiContext.delete(
            `/api/v1/services/${connectorCase.category}/name/${serviceName}?hardDelete=true&recursive=true`
          );
          await afterAction();
        });

        test.beforeEach(async ({ page }) => {
          await redirectToHomePage(page);
        });

        test('masks the stored secret on the Connection tab and in the edit form', async ({
          page,
        }) => {
          await openConnectionTab(page, connectorCase, serviceName);

          await test.step('Connection tab renders the secret as a password input', async () => {
            const storedSecret = page
              .getByTestId('service-connection-details')
              .getByLabel(connectorCase.secretKey, { exact: true });

            await expect(storedSecret).toHaveAttribute('type', 'password');
            await expect(storedSecret).not.toHaveValue(SECRET);
          });

          await test.step('Edit connection form keeps the secret masked', async () => {
            await page.getByTestId('edit-connection-button').click();
            await waitForAllLoadersToDisappear(page);
            await waitForServiceConnectionForm(page);

            const secret = page.locator(
              `[id="${connectorCase.secretFieldId}"]`
            );

            await expect(secret).toHaveAttribute('type', 'password');
            await expect(secret).not.toHaveValue(SECRET);
          });
        });
      });
    }
  }
);
