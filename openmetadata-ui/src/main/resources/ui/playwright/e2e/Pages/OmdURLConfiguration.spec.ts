/*
 *  Copyright 2025 Collate.
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
import { GlobalSettingOptions } from '../../constant/settings';
import { expect, test } from '../../support/fixtures/base';
import { redirectToHomePage, toastNotification } from '../../utils/common';
import { mockSettingsSource } from '../../utils/settingsSource';
import { settingClick } from '../../utils/sidebar';

const URL_SETTING = {
  config_type: 'openMetadataBaseUrlConfiguration',
  config_value: { openMetadataUrl: 'https://metadata.example.com' },
};

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('OM URL configuration', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await settingClick(page, GlobalSettingOptions.OM_URL_CONFIG);
  });

  test('update om url configuration should work', async ({ page }) => {
    // Click the edit button
    await page.click('[data-testid="edit-button"]');

    // Update OM URL
    await page.fill(
      '[data-testid="open-metadata-url-input"]',
      'http://localhost:8080'
    );

    const res = page.waitForResponse('/api/v1/system/settings');
    await page.click('[data-testid="save-button"]');
    await res;

    await toastNotification(
      page,
      /(OpenMetadata|Collate) URL Configuration updated successfully./
    );

    await expect(page.locator('[data-testid="open-metadata-url"]')).toHaveText(
      'http://localhost:8080'
    );
  });

  test('url without a scheme is rejected before saving', async ({ page }) => {
    await page.click('[data-testid="edit-button"]');

    let settingsUpdated = false;
    page.on('request', (request) => {
      settingsUpdated =
        settingsUpdated ||
        (request.method() === 'PUT' &&
          request.url().includes('/api/v1/system/settings'));
    });

    await page.fill('[data-testid="open-metadata-url-input"]', 'example.org');
    await page.click('[data-testid="save-button"]');

    await expect(page.getByText('Invalid URL format')).toBeVisible();
    expect(settingsUpdated).toBe(false);
  });
});

test.describe('OM URL configuration source', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(
      '**/api/v1/system/settings/openMetadataBaseUrlConfiguration',
      (route) => route.fulfill({ json: URL_SETTING })
    );
  });

  test('cannot be edited when the deployment configuration sets it', async ({
    page,
  }) => {
    await mockSettingsSource(page, [
      {
        configType: 'openMetadataBaseUrlConfiguration',
        source: 'ENV',
        sourceVariable: 'SERVER_URL_CONFIG_SOURCE',
        editable: false,
        managedPaths: ['/openMetadataUrl'],
      },
    ]);

    await redirectToHomePage(page);
    await settingClick(page, GlobalSettingOptions.OM_URL_CONFIG);

    await expect(page.getByTestId('settings-source-env-alert')).toContainText(
      'SERVER_URL_CONFIG_SOURCE=ENV'
    );
    await expect(page.getByTestId('open-metadata-url')).toHaveText(
      'https://metadata.example.com'
    );
    await expect(page.getByTestId('edit-button')).not.toBeVisible();
  });

  test('takes the deployment value when the saved one overrides it', async ({
    page,
  }) => {
    const adoptRequests = await mockSettingsSource(page, [
      {
        configType: 'openMetadataBaseUrlConfiguration',
        source: 'AUTO',
        sourceVariable: 'SERVER_URL_CONFIG_SOURCE',
        editable: true,
        overriddenFields: [
          { path: '/openMetadataUrl', envVariable: 'OPENMETADATA_SERVER_URL' },
        ],
      },
    ]);

    await redirectToHomePage(page);
    await settingClick(page, GlobalSettingOptions.OM_URL_CONFIG);

    const overriddenAlert = page.getByTestId(
      'settings-source-overridden-alert'
    );

    await expect(overriddenAlert).toContainText(
      '/openMetadataUrl (set by OPENMETADATA_SERVER_URL)'
    );
    await expect(page.getByTestId('edit-button')).toBeVisible();

    await overriddenAlert
      .getByRole('button', { name: 'Use deployment value' })
      .click();

    const settingReload = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        response
          .url()
          .endsWith('/api/v1/system/settings/openMetadataBaseUrlConfiguration')
    );
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Use deployment value' })
      .click();
    await settingReload;

    await expect
      .poll(() => adoptRequests)
      .toEqual([
        {
          configType: 'openMetadataBaseUrlConfiguration',
          paths: ['/openMetadataUrl'],
        },
      ]);
    await expect(page.getByTestId('open-metadata-url')).toHaveText(
      'https://metadata.example.com'
    );
    await expect(overriddenAlert).not.toBeVisible();
  });
});
