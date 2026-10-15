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

import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { GlobalSettingOptions } from '../../constant/settings';
import { expect, test } from '../../support/fixtures/base';
import { redirectToHomePage, toastNotification } from '../../utils/common';
import { mockSettingsSource } from '../../utils/settingsSource';
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

const EDIT_EMAIL_CONFIG_ROUTE =
  '/settings/OpenMetadata/email/edit-email-configuration';
// Every field conf/operations.yaml sets for email, as the server reports them in ENV mode.
const DEPLOYMENT_EMAIL_FIELDS = [
  '/emailingEntity',
  '/supportUrl',
  '/enableSmtpServer',
  '/senderMail',
  '/serverEndpoint',
  '/serverPort',
  '/username',
  '/password',
  '/transportationStrategy',
  '/templates',
];

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

test.describe(
  'Email configuration source',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    test.beforeEach(async ({ page }) => {
      await page.route(
        '**/api/v1/system/settings/emailConfiguration',
        (route) => route.fulfill({ json: EMAIL_SETTING })
      );
    });

    test('is read-only when the deployment configuration owns it', async ({
      page,
    }) => {
      await mockSettingsSource(page, [
        {
          configType: 'emailConfiguration',
          source: 'ENV',
          sourceVariable: 'EMAIL_CONFIG_SOURCE',
          editable: false,
          managedPaths: DEPLOYMENT_EMAIL_FIELDS,
        },
      ]);

      await redirectToHomePage(page);
      await settingClick(page, GlobalSettingOptions.EMAIL);

      await test.step('The settings page explains why and offers no edit', async () => {
        await expect(
          page.getByTestId('settings-source-env-alert')
        ).toContainText('EMAIL_CONFIG_SOURCE=ENV');
        await expect(page.getByText('sender@example.com')).toBeVisible();
        await expect(
          page.getByTestId('edit-email-configuration')
        ).not.toBeVisible();
      });

      await test.step('The edit page shows every field read-only', async () => {
        await page.goto(EDIT_EMAIL_CONFIG_ROUTE, {
          waitUntil: 'domcontentloaded',
        });

        await expect(page.getByTestId('sender-email-input')).toHaveValue(
          'sender@example.com'
        );
        await expect(page.getByTestId('sender-email-input')).toBeDisabled();
        await expect(page.getByTestId('server-port-input')).toBeDisabled();
        await expect(
          page.getByRole('button', { exact: true, name: 'Cancel' })
        ).toBeVisible();
        await expect(
          page.getByRole('button', { exact: true, name: 'Save' })
        ).not.toBeVisible();
      });
    });

    test('replaces a saved value with the deployment value on request', async ({
      page,
    }) => {
      const adoptRequests = await mockSettingsSource(page, [
        {
          configType: 'emailConfiguration',
          source: 'AUTO',
          sourceVariable: 'EMAIL_CONFIG_SOURCE',
          editable: true,
          overriddenFields: [
            { path: '/serverPort', envVariable: 'SMTP_SERVER_PORT' },
          ],
        },
      ]);

      await redirectToHomePage(page);
      await settingClick(page, GlobalSettingOptions.EMAIL);

      const overriddenAlert = page.getByTestId(
        'settings-source-overridden-alert'
      );

      await expect(overriddenAlert).toContainText(
        '/serverPort (set by SMTP_SERVER_PORT)'
      );
      await expect(page.getByTestId('edit-email-configuration')).toBeVisible();

      await overriddenAlert
        .getByRole('button', { name: 'Use deployment value' })
        .click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toContainText(
        '/serverPort (set by SMTP_SERVER_PORT)'
      );

      const settingReload = page.waitForResponse(
        (response) =>
          response.request().method() === 'GET' &&
          response.url().endsWith('/api/v1/system/settings/emailConfiguration')
      );
      await dialog
        .getByRole('button', { name: 'Use deployment value' })
        .click();
      await settingReload;

      await expect
        .poll(() => adoptRequests)
        .toEqual([
          { configType: 'emailConfiguration', paths: ['/serverPort'] },
        ]);
      await expect(overriddenAlert).not.toBeVisible();
    });
  }
);
