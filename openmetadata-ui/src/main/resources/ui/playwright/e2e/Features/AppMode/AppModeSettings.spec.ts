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

import { Browser, Page } from '@playwright/test';
import {
  getApiContext,
  getDefaultAdminAPIContext,
} from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { clickAndWaitFor } from '../../../utils/waitHelpers';
import { withAppConfigLock } from '../../Utils/appConfigMutex';
import { expect, test } from './fixtures';

// Admin UI page under Settings → Preferences → App Mode (the OSS
// `DefaultAppModePage`). Route + testids: the category "Preferences" and the
// "App Mode" item are both OSS (`GlobalSettingsMenuCategory.PREFERENCES`,
// `GlobalSettingOptions.APP_MODE = 'appMode'`), so the resolved path and the
// settings-card testid are both `preferences.appMode`.
const APP_MODE_SETTINGS_URL = '/settings/preferences/appMode';
const APP_MODE_PREFERENCES_URL = '/settings/preferences';
const APP_MODE_MENU_TESTID = 'preferences.appMode';

// Matches only the `PUT /api/v1/system/settings` write — the boot-time
// `GET /system/settings/appConfiguration` has a trailing segment the `($|?)`
// anchor excludes.
const SYSTEM_SETTINGS_PUT_URL = /\/api\/v1\/system\/settings(\?|$)/;

/**
 * Restores the tenant-wide app-mode default to "no default" via the same
 * generic settings PUT the Admin UI page uses. Every test in the "as admin"
 * block below can leave `appConfiguration.defaultAppMode` mutated — without
 * this, later tests here would see a polluted tenant default.
 */
const resetAppConfigurationToNoDefault = async (page: Page) => {
  const { apiContext, afterAction } = await getApiContext(page);
  await apiContext.put('/api/v1/system/settings', {
    data: {
      config_type: 'appConfiguration',
      config_value: { defaultAppMode: null },
    },
  });
  await afterAction();
};

/**
 * `getApiContext(page)` reads the token off the page's storage — which is
 * empty on a brand-new page in `beforeEach` (nothing has navigated yet). Use
 * the browser-scoped admin context instead so the reset is safe to call from
 * `beforeEach` too.
 */
const resetAppConfigurationToNoDefaultViaBrowser = async (browser: Browser) => {
  const { apiContext, afterAction } = await getDefaultAdminAPIContext(browser);
  try {
    await apiContext.put('/api/v1/system/settings', {
      data: {
        config_type: 'appConfiguration',
        config_value: { defaultAppMode: null },
      },
    });
  } finally {
    await afterAction();
  }
};

/**
 * Intercepts BOTH halves of the settings round-trip on this page's context:
 * the boot-time `GET /system/settings/appConfiguration` and the admin
 * `PUT /system/settings`. Nothing reaches the server, so the tenant-wide row —
 * a single global value every browser context reads at boot — is never
 * mutated, this test needs no cross-worker mutex, and its starting value is
 * deterministic instead of whatever a sibling worker last left behind.
 *
 * The PUT handler writes into the same in-memory value the GET serves, so a
 * reload genuinely re-reads what the UI saved. What stays under test is the
 * UI contract this spec owns: Save issues the right PUT, and boot renders
 * whatever the settings GET reports. Server-side persistence is the backend's
 * contract, covered by `AppModeAuthGating.spec.ts` hitting the real endpoint.
 *
 * Returns a handle whose `puts` array records every intercepted PUT body, so
 * callers can assert WHAT the UI sent rather than only that it sent something.
 */
const stubSettingsRoundTrip = async (
  page: Page,
  initial: 'ai' | 'classic' | null
) => {
  const state: {
    value: 'ai' | 'classic' | null;
    puts: Record<string, unknown>[];
  } = { value: initial, puts: [] };

  await page.route(
    '**/api/v1/system/settings/appConfiguration',
    async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();

        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        json: {
          config_type: 'appConfiguration',
          config_value: { defaultAppMode: state.value },
        },
      });
    }
  );

  await page.route('**/api/v1/system/settings', async (route) => {
    if (route.request().method() !== 'PUT') {
      await route.fallback();

      return;
    }
    const body = route.request().postDataJSON() as Record<string, unknown>;
    state.puts.push(body);
    const configValue = (body?.config_value ?? {}) as {
      defaultAppMode?: 'ai' | 'classic' | null;
    };
    state.value = configValue.defaultAppMode ?? null;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      json: body,
    });
  });

  return state;
};

test.describe('AppMode — Admin Settings page', { tag: ['@Platform'] }, () => {
  test('Admin sees the "App Mode" entry under Settings → Preferences', async ({
    page,
  }) => {
    await page.goto(APP_MODE_PREFERENCES_URL, {
      waitUntil: 'domcontentloaded',
    });
    await waitForAllLoadersToDisappear(page);

    const menuEntry = page.getByTestId(APP_MODE_MENU_TESTID);

    await expect(menuEntry).toBeVisible();
    // Match the entry's label only, not the description below it — an exact
    // match on the OSS label ("Default App Mode") resolves to the single label
    // node, never the description string, keeping Playwright's strict-mode
    // single-match invariant.
    await expect(
      menuEntry.getByText('Default App Mode', { exact: true })
    ).toBeVisible();
  });

  test('Non-admin does not see the "App Mode" entry under Settings → Preferences', async ({
    dataConsumerPage,
  }) => {
    await dataConsumerPage.goto(APP_MODE_PREFERENCES_URL, {
      waitUntil: 'domcontentloaded',
    });
    await waitForAllLoadersToDisappear(dataConsumerPage);

    await expect(
      dataConsumerPage.getByTestId(APP_MODE_MENU_TESTID)
    ).toHaveCount(0);
  });

  test('Non-admin hitting the App Mode route directly is blocked', async ({
    dataConsumerPage,
  }) => {
    await dataConsumerPage.goto(APP_MODE_SETTINGS_URL, {
      waitUntil: 'domcontentloaded',
    });
    await waitForAllLoadersToDisappear(dataConsumerPage);

    // `AdminProtectedRoute` wraps `DefaultAppModePage` with no `hasPermission`
    // prop, so a non-admin falls into the `PermissionErrorPlaceholder` branch
    // (403-equivalent view), not a redirect to sign-in.
    await expect(
      dataConsumerPage.getByTestId('permission-error-placeholder')
    ).toBeVisible();
    await expect(
      dataConsumerPage.getByTestId('app-mode-radio-group')
    ).toHaveCount(0);
  });

  test.describe('as admin', () => {
    test.afterEach(async ({ page }) => {
      // After-lock cleanup only. Best-effort — the next test's own
      // reset-inside-lock is the real guarantee.
      await resetAppConfigurationToNoDefault(page);
    });

    // Every admin test in this block PUTs to `appConfiguration` and can race
    // with sibling workers. Hold the cross-worker mutex for the whole test
    // body so load-then-verify-then-click-save is atomic against sibling
    // flips.
    test('Save is disabled until the selection changes, then enables', async ({
      browser,
      page,
    }) => {
      await withAppConfigLock(async () => {
        // Reset inside the lock so the "initial radio = null" assertion below
        // is against a value no sibling worker can flip.
        await resetAppConfigurationToNoDefaultViaBrowser(browser);
        await page.goto(APP_MODE_SETTINGS_URL, {
          waitUntil: 'domcontentloaded',
        });
        await waitForAllLoadersToDisappear(page);

        const radioGroup = page.getByTestId('app-mode-radio-group');
        const saveButton = page.getByTestId('save-app-mode-settings');

        await expect(radioGroup).toBeVisible();
        await expect(
          page.getByTestId('app-mode-option-null').getByRole('radio')
        ).toBeChecked();
        await expect(saveButton).toBeDisabled();

        await page.getByTestId('app-mode-option-ai').click();

        await expect(
          page.getByTestId('app-mode-option-ai').getByRole('radio')
        ).toBeChecked();
        await expect(saveButton).toBeEnabled();
      });
    });

    // Fully stubbed — no real PUT, so no global mutation and no mutex. See
    // `stubSettingsRoundTrip`. Because the stub owns the starting value, this
    // test no longer depends on a reset landing before it, and 'ai' is safe to
    // save here: it never leaves this browser context.
    test('Saving fires the settings PUT and the selection persists on reload', async ({
      page,
    }) => {
      const settings = await stubSettingsRoundTrip(page, null);

      await page.goto(APP_MODE_SETTINGS_URL, {
        waitUntil: 'domcontentloaded',
      });
      await waitForAllLoadersToDisappear(page);

      await page.getByTestId('app-mode-option-ai').click();

      await clickAndWaitFor(
        page,
        page.getByTestId('save-app-mode-settings'),
        SYSTEM_SETTINGS_PUT_URL
      );

      // Stronger than asserting a PUT merely happened: pin the payload.
      expect(settings.puts).toHaveLength(1);
      expect(settings.puts[0]).toMatchObject({
        config_type: 'appConfiguration',
        config_value: { defaultAppMode: 'ai' },
      });

      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.getByTestId('app-mode-option-ai').getByRole('radio')
      ).toBeChecked();
    });

    test('"No default" clears the tenant-wide app mode default', async ({
      browser,
      page,
    }) => {
      await withAppConfigLock(async () => {
        await resetAppConfigurationToNoDefaultViaBrowser(browser);
        await page.goto(APP_MODE_SETTINGS_URL, {
          waitUntil: 'domcontentloaded',
        });
        await waitForAllLoadersToDisappear(page);

        // Start from a known non-null value so this test is meaningful even
        // if it happens to run first.
        await page.getByTestId('app-mode-option-classic').click();
        await clickAndWaitFor(
          page,
          page.getByTestId('save-app-mode-settings'),
          SYSTEM_SETTINGS_PUT_URL
        );

        await page.getByTestId('app-mode-option-null').click();
        const putResponse = await clickAndWaitFor(
          page,
          page.getByTestId('save-app-mode-settings'),
          SYSTEM_SETTINGS_PUT_URL
        );

        const putBody = await putResponse.json();

        expect(putBody?.config_value?.defaultAppMode ?? null).toBeNull();

        const { apiContext, afterAction } = await getApiContext(page);
        const configResponse = await apiContext.get(
          '/api/v1/system/settings/appConfiguration'
        );
        const config = await configResponse.json();
        await afterAction();

        expect(config?.config_value?.defaultAppMode ?? null).toBeNull();
      });
    });
  });
});
