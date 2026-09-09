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

import { Page } from '@playwright/test';
import { PLAYWRIGHT_INGESTION_TAG_OBJ } from '../../constant/config';
import { SERVICE_TYPE } from '../../constant/service';
import { DashboardServiceClass } from '../../support/entity/service/DashboardServiceClass';
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import { MessagingServiceClass } from '../../support/entity/service/MessagingServiceClass';
import { expect, test } from '../../support/fixtures/base';
import { createNewPage, redirectToHomePage, uuid } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { visitServiceDetailsPage } from '../../utils/service';

// The masked sentinel the API returns for stored password fields.
const MASKED_PASSWORD = '*********';

// Inline equivalent of waitForServiceConnectionForm (not available in 1.13).
const waitForConnectionForm = async (page: Page) => {
  await page.getByTestId('next-button').waitFor({ state: 'visible' });
};

const navigateToEditConnection = async (
  page: Parameters<typeof visitServiceDetailsPage>[0],
  serviceName: string,
  serviceType: SERVICE_TYPE = SERVICE_TYPE.Messaging
) => {
  await visitServiceDetailsPage(
    page,
    { name: serviceName, type: serviceType },
    false,
    false
  );
  await page.getByRole('tab', { name: 'Connection' }).click();
  await page.getByTestId('edit-connection-button').click();
  await waitForAllLoadersToDisappear(page);
  await waitForConnectionForm(page);
};

test.describe(
  'Password field clear — masked value UX',
  PLAYWRIGHT_INGESTION_TAG_OBJ,
  () => {
    const kafkaService = new MessagingServiceClass(
      `pw-password-clear-${uuid()}`
    );

    test.use({ storageState: 'playwright/.auth/admin.json' });

    test.beforeAll(
      'Create Kafka service with SASL password',
      async ({ browser }) => {
        const { apiContext, afterAction } = await createNewPage(browser);
        await kafkaService.create(apiContext);
        await afterAction();
      }
    );

    test.afterAll('Delete Kafka service', async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await kafkaService.delete(apiContext);
      await afterAction();
    });

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
    });

    test('masked password shows as dots in the edit form', async ({ page }) => {
      await navigateToEditConnection(page, kafkaService.entity.name);

      // saslPassword was set when the service was created — the API returns it
      // as '*********'. The form must display this masked value as dots (not an
      // empty field) so the user knows a secret is stored.
      await expect(page.locator(String.raw`#root\/saslPassword`)).toHaveValue(
        MASKED_PASSWORD
      );
    });

    test("saving after clearing does not send replace/'' for the password field", async ({
      page,
    }) => {
      await navigateToEditConnection(page, kafkaService.entity.name);

      // Clear the password field.
      await page.locator(String.raw`#root\/saslPassword`).fill('');

      // Also change another field so the form is dirty and triggers a PATCH.
      await page
        .locator(String.raw`#root\/bootstrapServers`)
        .fill('updated-broker:9092');

      await page.getByTestId('next-button').click();
      await waitForAllLoadersToDisappear(page);

      // Hoist the response listener immediately before the Save click so no
      // intermediate navigation response from next-button can resolve it early.
      const patchResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/services/messagingServices') &&
          response.request().method() === 'PATCH'
      );

      await page.getByRole('button', { name: 'Save' }).click();

      const patch = await patchResponse;
      const patchBody = patch.request().postDataJSON() as Array<{
        op: string;
        path: string;
        value?: unknown;
      }>;

      // Guard against the 1.13 regression: clearing the password must not
      // produce replace/'' in the PATCH. An empty string would cause the
      // backend to store '' instead of properly removing the secret.
      // This assertion is unconditional — it fails whether the bad op is
      // present or absent-but-expected, so it cannot pass vacuously.
      const badPasswordOp = patchBody.find(
        (op) =>
          op.path.endsWith('/saslPassword') &&
          op.op === 'replace' &&
          op.value === ''
      );

      expect(badPasswordOp).toBeUndefined();

      await waitForAllLoadersToDisappear(page);
    });

    test('after save, re-opening the form shows the empty password field', async ({
      page,
    }) => {
      await navigateToEditConnection(page, kafkaService.entity.name);

      // Clear the password field and change another field to ensure a PATCH.
      const saslPasswordInput = page.locator(String.raw`#root\/saslPassword`);
      await saslPasswordInput.fill('');
      await expect(saslPasswordInput).toHaveValue('');
      await page
        .locator(String.raw`#root\/bootstrapServers`)
        .fill('roundtrip-broker:9092');

      await page.getByTestId('next-button').click();
      await waitForAllLoadersToDisappear(page);

      // Hoist the listener right before Save so no intermediate response races.
      const patchResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/services/messagingServices') &&
          response.request().method() === 'PATCH'
      );

      await page.getByRole('button', { name: 'Save' }).click();
      await patchResponse;

      // After save, the page navigates back to the service details page.
      await waitForAllLoadersToDisappear(page);

      // Re-open the edit connection form.
      await page.getByRole('tab', { name: 'Connection' }).click();
      await page.getByTestId('edit-connection-button').click();
      await waitForAllLoadersToDisappear(page);
      await waitForConnectionForm(page);

      // The password was cleared and saved. Re-opening the edit form must show
      // an empty field — not the old masked sentinel — confirming the secret
      // was removed.
      await expect(page.locator(String.raw`#root\/saslPassword`)).toHaveValue(
        ''
      );
    });

    test('saving without clearing preserves the masked password — regression guard', async ({
      page,
    }) => {
      await navigateToEditConnection(page, kafkaService.entity.name);

      // Change a non-password field so the form is dirty and produces a PATCH.
      await page
        .locator(String.raw`#root\/bootstrapServers`)
        .fill('regression-broker:9092');

      await page.getByTestId('next-button').click();
      await waitForAllLoadersToDisappear(page);

      // Hoist the listener right before Save.
      const patchResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/services/messagingServices') &&
          response.request().method() === 'PATCH'
      );

      await page.getByRole('button', { name: 'Save' }).click();

      const patch = await patchResponse;
      const patchBody = patch.request().postDataJSON() as Array<{
        op: string;
        path: string;
        value?: unknown;
      }>;

      // When the password is not touched, no patch op should be generated for
      // it — the unchanged masked value means compare() sees no diff.
      const passwordOp = patchBody.find((op) =>
        op.path.endsWith('/saslPassword')
      );

      expect(passwordOp).toBeUndefined();
    });
  }
);

test.describe(
  'Password field clear — database service (MySQL authType/password)',
  PLAYWRIGHT_INGESTION_TAG_OBJ,
  () => {
    const mysqlService = new DatabaseServiceClass(
      `pw-db-password-clear-${uuid()}`
    );

    test.use({ storageState: 'playwright/.auth/admin.json' });

    test.beforeAll(
      'Create MySQL service with password',
      async ({ browser }) => {
        const { apiContext, afterAction } = await createNewPage(browser);
        await mysqlService.create(apiContext);
        await afterAction();
      }
    );

    test.afterAll('Delete MySQL service', async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await mysqlService.delete(apiContext);
      await afterAction();
    });

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
    });

    test('masked password shows as dots in the database connection edit form', async ({
      page,
    }) => {
      await navigateToEditConnection(
        page,
        mysqlService.entity.name,
        SERVICE_TYPE.Database
      );

      // authType.password was set when the service was created — the API
      // returns it as '*********'. The form must display it as dots so the
      // user knows a secret is stored.
      await expect(
        page.locator(String.raw`#root\/authType\/password`)
      ).toHaveValue(MASKED_PASSWORD);
    });

    test('saving without clearing preserves the database password — regression guard', async ({
      page,
    }) => {
      await navigateToEditConnection(
        page,
        mysqlService.entity.name,
        SERVICE_TYPE.Database
      );

      // Change only a non-password field so the form is dirty.
      // The password is still the masked sentinel — no patch op must be generated for it.
      await page.locator(String.raw`#root\/hostPort`).fill('mysql:3307');

      await page.getByTestId('next-button').click();
      await waitForAllLoadersToDisappear(page);

      const patchResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/services/databaseServices') &&
          response.request().method() === 'PATCH'
      );

      await page.getByRole('button', { name: 'Save' }).click();

      const patch = await patchResponse;
      const patchBody = patch.request().postDataJSON() as Array<{
        op: string;
        path: string;
        value?: unknown;
      }>;

      const passwordOp = patchBody.find((op) => op.path.endsWith('/password'));

      expect(passwordOp).toBeUndefined();
    });

    test("saving after clearing does not send replace/'' for the database password field", async ({
      page,
    }) => {
      await navigateToEditConnection(
        page,
        mysqlService.entity.name,
        SERVICE_TYPE.Database
      );

      await page.locator(String.raw`#root\/authType\/password`).fill('');

      // Change hostPort so the form is dirty and triggers a PATCH.
      await page.locator(String.raw`#root\/hostPort`).fill('mysql:3308');

      await page.getByTestId('next-button').click();
      await waitForAllLoadersToDisappear(page);

      const patchResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/services/databaseServices') &&
          response.request().method() === 'PATCH'
      );

      await page.getByRole('button', { name: 'Save' }).click();

      const patch = await patchResponse;
      const patchBody = patch.request().postDataJSON() as Array<{
        op: string;
        path: string;
        value?: unknown;
      }>;

      const badPasswordOp = patchBody.find(
        (op) =>
          op.path.endsWith('/password') &&
          op.op === 'replace' &&
          op.value === ''
      );

      expect(badPasswordOp).toBeUndefined();

      await waitForAllLoadersToDisappear(page);
    });
  }
);

test.describe(
  'Password field clear — dashboard service (Superset connection/password)',
  PLAYWRIGHT_INGESTION_TAG_OBJ,
  () => {
    const supersetService = new DashboardServiceClass(
      `pw-dashboard-password-clear-${uuid()}`
    );

    test.use({ storageState: 'playwright/.auth/admin.json' });

    test.beforeAll(
      'Create Superset service with password',
      async ({ browser }) => {
        const { apiContext, afterAction } = await createNewPage(browser);
        await supersetService.create(apiContext);
        await afterAction();
      }
    );

    test.afterAll('Delete Superset service', async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await supersetService.delete(apiContext);
      await afterAction();
    });

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
    });

    test('masked password shows as dots in the dashboard connection edit form', async ({
      page,
    }) => {
      await navigateToEditConnection(
        page,
        supersetService.entity.name,
        SERVICE_TYPE.Dashboard
      );

      // connection.password was set when the service was created — the API
      // returns it as '*********'. The form must display it as dots.
      await expect(
        page.locator(String.raw`#root\/connection\/password`)
      ).toHaveValue(MASKED_PASSWORD);
    });

    test('saving without clearing preserves the dashboard password — regression guard', async ({
      page,
    }) => {
      await navigateToEditConnection(
        page,
        supersetService.entity.name,
        SERVICE_TYPE.Dashboard
      );

      // Change only a non-password field so the form is dirty.
      // The password is still the masked sentinel — no patch op must be generated for it.
      await page
        .locator(String.raw`#root\/hostPort`)
        .fill('http://localhost:8089');

      await page.getByTestId('next-button').click();
      await waitForAllLoadersToDisappear(page);

      const patchResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/services/dashboardServices') &&
          response.request().method() === 'PATCH'
      );

      await page.getByRole('button', { name: 'Save' }).click();

      const patch = await patchResponse;
      const patchBody = patch.request().postDataJSON() as Array<{
        op: string;
        path: string;
        value?: unknown;
      }>;

      const passwordOp = patchBody.find((op) => op.path.endsWith('/password'));

      expect(passwordOp).toBeUndefined();
    });

    test("saving after clearing does not send replace/'' for the dashboard password field", async ({
      page,
    }) => {
      await navigateToEditConnection(
        page,
        supersetService.entity.name,
        SERVICE_TYPE.Dashboard
      );

      await page.locator(String.raw`#root\/connection\/password`).fill('');

      // Change hostPort so the form is dirty and triggers a PATCH.
      await page
        .locator(String.raw`#root\/hostPort`)
        .fill('http://localhost:8090');

      await page.getByTestId('next-button').click();
      await waitForAllLoadersToDisappear(page);

      const patchResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/services/dashboardServices') &&
          response.request().method() === 'PATCH'
      );

      await page.getByRole('button', { name: 'Save' }).click();

      const patch = await patchResponse;
      const patchBody = patch.request().postDataJSON() as Array<{
        op: string;
        path: string;
        value?: unknown;
      }>;

      const badPasswordOp = patchBody.find(
        (op) =>
          op.path.endsWith('/password') &&
          op.op === 'replace' &&
          op.value === ''
      );

      expect(badPasswordOp).toBeUndefined();

      await waitForAllLoadersToDisappear(page);
    });
  }
);
