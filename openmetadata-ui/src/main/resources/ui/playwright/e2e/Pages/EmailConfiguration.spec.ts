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

import { expect, test } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { GlobalSettingOptions } from '../../constant/settings';
import { redirectToHomePage, toastNotification } from '../../utils/common';
import { settingClick } from '../../utils/sidebar';

// Playwright keeps non-generated app constants local to avoid importing the app dependency graph.
const MASKED_PASSWORD_VALUE = '*********';
const EMAIL_SETTING = {
  config_type: 'emailConfiguration',
  config_value: {
    emailingEntity: 'OpenMetadata',
    enableSmtpServer: false,
    password: MASKED_PASSWORD_VALUE,
    senderMail: 'sender@example.com',
    serverEndpoint: 'smtp.example.com',
    serverPort: 587,
    supportUrl: 'https://slack.open-metadata.org',
    transportationStrategy: 'SMTP',
    username: 'mailer',
  },
};

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Email configuration', PLAYWRIGHT_BASIC_TEST_TAG_OBJ, () => {
  test('does not submit an unchanged masked password', async ({ page }) => {
    await page.route('**/api/v1/system/settings/emailConfiguration', (route) =>
      route.fulfill({ json: EMAIL_SETTING })
    );
    await page.route('**/api/v1/system/settings', async (route) => {
      await route.fulfill({
        json: route.request().postDataJSON(),
        status: 200,
      });
    });

    await redirectToHomePage(page);
    await settingClick(page, GlobalSettingOptions.EMAIL);
    await page.getByRole('button', { exact: true, name: 'Edit' }).click();

    await expect(page.getByTestId('password-input')).toHaveValue(
      MASKED_PASSWORD_VALUE
    );
    await page.getByTestId('emailing-entity-input').fill('Metadata Team');

    const updateResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        response.url().endsWith('/api/v1/system/settings')
    );
    await page.getByRole('button', { exact: true, name: 'Save' }).click();

    const response = await updateResponse;
    expect(response.status()).toBe(200);
    const payload = response.request().postDataJSON();

    expect(payload.config_value.emailingEntity).toBe('Metadata Team');
    expect(payload.config_value).not.toHaveProperty('password');
    await toastNotification(page, 'Email Configuration updated successfully.');
  });
});
