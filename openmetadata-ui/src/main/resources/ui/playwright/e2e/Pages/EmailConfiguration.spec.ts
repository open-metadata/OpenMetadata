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
import { expect, Page, test } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { GlobalSettingOptions } from '../../constant/settings';
import {
  getAuthContext,
  getSavedAdminToken,
  redirectToHomePage,
  toastNotification,
} from '../../utils/common';
import { settingClick } from '../../utils/sidebar';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });
test.describe.configure({ mode: 'serial' });

const PASSWORD_MASK = '*********';

const SMTP_CONFIG = {
  username: 'test-smtp-user',
  password: 'test-smtp-secret-password',
  senderMail: 'sender@example.com',
  serverEndpoint: 'smtp.example.com',
  serverPort: 587,
  emailingEntity: 'OpenMetadata',
  enableSmtpServer: false,
  transportationStrategy: 'SMTP_TLS',
};

const UPDATED_SENDER_EMAIL = 'updated-sender@example.com';

const waitForSettingsSave = (page: Page) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      response.url().includes('/api/v1/system/settings') &&
      response.status() === 200
  );

test.describe(
  'Email Configuration — masked password preservation',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    let originalEmailConfig: Record<string, unknown> | null = null;

    test.beforeAll(async () => {
      const apiContext = await getAuthContext(await getSavedAdminToken());

      // Capture the existing email config so we can restore it after the test suite
      const getRes = await apiContext.get(
        '/api/v1/system/settings/emailConfiguration'
      );
      if (getRes.ok()) {
        const body = await getRes.json();
        originalEmailConfig = body.config_value ?? null;
      }

      // Seed a known SMTP config (with a real password)
      await apiContext.put('/api/v1/system/settings', {
        data: {
          config_type: 'emailConfiguration',
          config_value: SMTP_CONFIG,
        },
      });

      await apiContext.dispose();
    });

    test.afterAll(async () => {
      const apiContext = await getAuthContext(await getSavedAdminToken());

      // Restore the original email config (or clear with a harmless default)
      const restoreValue = originalEmailConfig ?? {
        enableSmtpServer: false,
        senderMail: 'no-reply@example.com',
        serverEndpoint: 'smtp.example.com',
        serverPort: 465,
        transportationStrategy: 'SMTP_TLS',
      };
      await apiContext.put('/api/v1/system/settings', {
        data: {
          config_type: 'emailConfiguration',
          config_value: restoreValue,
        },
      });

      await apiContext.dispose();
    });

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
      await settingClick(page, GlobalSettingOptions.EMAIL);
    });

    test('editing a non-password field does not overwrite the stored SMTP password with the mask', async ({
      page,
    }) => {
      // Navigate to the edit form
      await page.getByTestId('edit-button').click();
      await expect(page.getByTestId('email-config-form')).toBeVisible();

      // Verify the password field shows the mask (not the real password)
      const passwordInput = page.getByTestId('password-input');
      await expect(passwordInput).toHaveValue(PASSWORD_MASK);

      // Change only the sender email — do NOT touch the password field
      const senderInput = page.getByTestId('sender-email-input');
      await senderInput.clear();
      await senderInput.fill(UPDATED_SENDER_EMAIL);

      // Intercept the PUT request and its response
      const saveResponsePromise = waitForSettingsSave(page);

      await page.getByRole('button', { name: /save/i }).click();

      const saveResponse = await saveResponsePromise;
      const body = await saveResponse.json();

      // The PUT request body sent the mask — verify the backend did NOT persist it
      // In environments without Fernet, the stored password is plaintext and must not be "*********"
      // In environments with Fernet, the stored password is a token (also not "*********")
      const storedPassword = body?.config_value?.password as string | undefined;
      expect(storedPassword).toBeDefined();
      expect(storedPassword).not.toBe(PASSWORD_MASK);

      // The sender email should have been updated
      expect(body?.config_value?.senderMail).toBe(UPDATED_SENDER_EMAIL);

      await toastNotification(page, /Email Configuration updated successfully/);
    });

    test('explicitly updating the password field stores the new password', async ({
      page,
    }) => {
      const newPassword = 'brand-new-smtp-password';

      await page.getByTestId('edit-button').click();
      await expect(page.getByTestId('email-config-form')).toBeVisible();

      // Clear the password field and type a new password
      const passwordInput = page.getByTestId('password-input');
      await passwordInput.clear();
      await passwordInput.fill(newPassword);

      const saveResponsePromise = waitForSettingsSave(page);
      await page.getByRole('button', { name: /save/i }).click();

      const saveResponse = await saveResponsePromise;
      const body = await saveResponse.json();

      // The new password (or its encrypted form) should be stored — never the mask
      const storedPassword = body?.config_value?.password as string | undefined;
      expect(storedPassword).toBeDefined();
      expect(storedPassword).not.toBe(PASSWORD_MASK);

      await toastNotification(page, /Email Configuration updated successfully/);
    });
  }
);
