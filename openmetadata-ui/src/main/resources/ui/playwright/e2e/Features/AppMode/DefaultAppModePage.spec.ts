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
import { getApiContext, redirectToHomePage } from '../../../utils/common';

// The generic app-mode registry only ever carries runtime string keys — OSS's
// own AppRouter registers 'default' (see DEFAULT_APP_MODE), and a plugin
// (e.g. Collate's AI mode) would add its own key at runtime. The wire
// schema's `defaultAppMode` enum ('ai' | 'classic' | null) is a separate,
// fixed contract, so this test asserts on whatever value the page actually
// round-trips through the API rather than assuming a specific literal.
const NO_DEFAULT_OPTION_TEST_ID = 'default-app-mode-option-__no_default__';
const DEFAULT_MODE_OPTION_TEST_ID = 'default-app-mode-option-default';
const APP_CONFIGURATION_SETTING_PATH =
  '/api/v1/system/settings/appConfiguration';
const SYSTEM_SETTINGS_PATH = '/api/v1/system/settings';
const APP_CONFIGURATION_CONFIG_TYPE = 'appConfiguration';

interface AppConfigurationSetting {
  config_value?: { defaultAppMode?: string | null } | null;
}

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Settings > Preferences > App Mode (tenant default)', () => {
  test('admin round-trip: load, change, save reflects on GET', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);

    const initialResponse = await apiContext.get(
      APP_CONFIGURATION_SETTING_PATH
    );
    const initialSetting: AppConfigurationSetting =
      await initialResponse.json();
    const initialDefaultAppMode =
      initialSetting?.config_value?.defaultAppMode ?? null;

    // Toggle to whichever option differs from the current tenant default so
    // the round-trip is observable regardless of pre-existing state.
    const targetOptionTestId =
      initialDefaultAppMode === null
        ? DEFAULT_MODE_OPTION_TEST_ID
        : NO_DEFAULT_OPTION_TEST_ID;
    const expectedDefaultAppMode =
      targetOptionTestId === DEFAULT_MODE_OPTION_TEST_ID ? 'default' : null;

    try {
      await redirectToHomePage(page);
      await page.goto('/settings/preferences/appMode');

      await expect(page.getByTestId('default-app-mode-page')).toBeVisible();

      await page
        .getByTestId('default-app-mode-radio-group')
        .getByTestId(targetOptionTestId)
        .click();

      await page.getByTestId('save-default-app-mode').click();

      await expect(async () => {
        const response = await apiContext.get(APP_CONFIGURATION_SETTING_PATH);
        const setting: AppConfigurationSetting = await response.json();

        expect(setting?.config_value?.defaultAppMode ?? null).toBe(
          expectedDefaultAppMode
        );
      }).toPass({ timeout: 5000 });
    } finally {
      // Restore the tenant default to its pre-test value so other specs
      // that read appConfiguration don't observe this test's mutation.
      await apiContext.put(SYSTEM_SETTINGS_PATH, {
        data: {
          config_type: APP_CONFIGURATION_CONFIG_TYPE,
          config_value: { defaultAppMode: initialDefaultAppMode },
        },
      });
      await afterAction();
    }
  });
});
