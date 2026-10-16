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
import { expect, test } from '../../support/fixtures/base';
import { redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';

test.use({ storageState: 'playwright/.auth/admin.json' });

const PEM_CONTENT =
  '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkq\n-----END PRIVATE KEY-----\n';

/**
 * Snowflake's `privateKey` is annotated `uiFieldType: fileOrInput`, and it sits
 * behind the key-pair authentication method, so the drop zone only exists once
 * that method is selected.
 */
const openSnowflakePrivateKeyField = async (page: Page) => {
  await page.goto('/databaseServices/add-service', {
    waitUntil: 'domcontentloaded',
  });
  await waitForAllLoadersToDisappear(page);
  await page.getByTestId('Snowflake').click();
  await page.getByTestId('service-name').waitFor({ state: 'visible' });
  await expect(page.getByTestId('connection-schema-loader')).toBeHidden({
    timeout: 10000,
  });
  await expect(page.getByTestId('connection-grouped-form')).toBeVisible();

  await page.getByTestId('auth-method-1').click();

  const privateKeyField = page.locator('[data-field-name="privateKey"]');
  await expect(privateKeyField).toBeVisible();

  return privateKeyField;
};

/**
 * Playwright has no native drop helper: the `DataTransfer` has to be built in
 * page context and handed to a dispatched `drop` event.
 */
const dropFileOnZone = async (page: Page, name: string, content: string) => {
  const dataTransfer = await page.evaluateHandle(
    ({ fileName, fileContent }) => {
      const transfer = new DataTransfer();
      transfer.items.add(
        new File([fileContent], fileName, { type: 'application/x-pem-file' })
      );

      return transfer;
    },
    { fileName: name, fileContent: content }
  );

  await page
    .getByTestId('credential-file-dropzone')
    .dispatchEvent('drop', { dataTransfer });
};

test.describe(
  'Credential file upload',
  { tag: ['@Flow', '@Integration'] },
  () => {
    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
    });

    test('should attach a private key chosen with the file picker', async ({
      page,
    }) => {
      test.slow();

      const privateKeyField = await openSnowflakePrivateKeyField(page);

      await test.step('the field offers a drop zone and a paste box', async () => {
        await expect(
          privateKeyField.getByTestId('credential-file-dropzone')
        ).toBeVisible();
        await expect(privateKeyField.getByRole('textbox')).toBeVisible();
      });

      await test.step('choosing a file replaces both with its chip', async () => {
        await privateKeyField
          .getByTestId('credential-file-input')
          .setInputFiles({
            name: 'snowflake_key.pem',
            mimeType: 'application/x-pem-file',
            buffer: Buffer.from(PEM_CONTENT),
          });

        await expect(
          privateKeyField.getByTestId('credential-file-name')
        ).toHaveText('snowflake_key.pem');
        await expect(
          privateKeyField.getByTestId('credential-file-dropzone')
        ).toBeHidden();
        await expect(privateKeyField.getByRole('textbox')).toBeHidden();
      });
    });

    test('should attach a private key dropped onto the zone', async ({
      page,
    }) => {
      test.slow();

      const privateKeyField = await openSnowflakePrivateKeyField(page);

      await test.step('dropping a file attaches it', async () => {
        await dropFileOnZone(page, 'dropped_key.pem', PEM_CONTENT);

        await expect(
          privateKeyField.getByTestId('credential-file-name')
        ).toHaveText('dropped_key.pem');
      });

      await test.step('removing it restores the drop zone and paste box', async () => {
        await privateKeyField.getByTestId('credential-file-remove').click();

        await expect(
          privateKeyField.getByTestId('credential-file-dropzone')
        ).toBeVisible();
        await expect(privateKeyField.getByRole('textbox')).toBeVisible();
        await expect(privateKeyField.getByRole('textbox')).toHaveValue('');
      });
    });

    test('should reject a file that is not UTF-8 text', async ({ page }) => {
      test.slow();

      const privateKeyField = await openSnowflakePrivateKeyField(page);

      await test.step('a binary payload is refused', async () => {
        // Bytes that cannot decode as UTF-8 — a DER/PKCS#12 payload in miniature.
        await privateKeyField
          .getByTestId('credential-file-input')
          .setInputFiles({
            name: 'keystore.pem',
            mimeType: 'application/x-pem-file',
            buffer: Buffer.from([0x30, 0x82, 0xff, 0xfe, 0xff]),
          });

        await expect(privateKeyField.getByRole('alert')).toBeVisible();
      });

      await test.step('nothing is attached and the field stays usable', async () => {
        await expect(
          privateKeyField.getByTestId('credential-file-chip')
        ).toBeHidden();
        await expect(
          privateKeyField.getByTestId('credential-file-dropzone')
        ).toBeVisible();
        await expect(privateKeyField.getByRole('textbox')).toHaveValue('');
      });
    });
  }
);
