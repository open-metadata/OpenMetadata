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
import { expect, test } from '@playwright/test';
import { GlobalSettingOptions } from '../../constant/settings';
import { redirectToHomePage, toastNotification } from '../../utils/common';
import {
  mockEntitySearchSettings,
  setSliderValue,
} from '../../utils/searchSettingUtils';
import { settingClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Search Settings Tests', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Update global search settings', async ({ page }) => {
    test.slow(true);

    await settingClick(page, GlobalSettingOptions.SEARCH_SETTINGS);

    const enableRolesPolicesInSearchSwitch = page.getByTestId(
      'enable-roles-polices-in-search-switch'
    );
    const enableNaturalLanguageSearchSwitch = page.getByTestId(
      'use-natural-language-search-switch'
    );

    await enableRolesPolicesInSearchSwitch.click();
    await toastNotification(page, /Search Settings updated successfully/);

    await enableNaturalLanguageSearchSwitch.click();
    await toastNotification(page, /Search Settings updated successfully/);

    const globalSettingEditIcon = page.getByTestId(
      'global-setting-edit-icon-Max Aggregate Size'
    );
    await globalSettingEditIcon.click();

    await page.getByTestId('value-input').fill('15000');

    await page.getByTestId('inline-save-btn').click();
    await toastNotification(page, /Search Settings updated successfully/);

    await expect(
      page.getByTestId(`global-setting-value-Max Aggregate Size`)
    ).toHaveText('15000');
  });

  test('Update entity search settings', async ({ page }) => {
    await settingClick(page, GlobalSettingOptions.SEARCH_SETTINGS);

    const tableCard = page.getByTestId(mockEntitySearchSettings.key);

    await tableCard.getByTestId('view-detail-button').click();

    await expect(page).toHaveURL(
      new RegExp(mockEntitySearchSettings.url + '$')
    );

    await expect(
      page.getByTestId('entity-search-settings-header')
    ).toBeVisible();

    const fieldContainers = page.getByTestId('field-container-header');
    const firstFieldContainer = fieldContainers.first();
    await firstFieldContainer.click();

    // Highlight Field
    const highlightFieldToggle = page.getByTestId('highlight-field-switch');
    await highlightFieldToggle.click();

    // Field Weight
    await setSliderValue(page, 'field-weight-slider', 8);

    // Score Mode
    const scoreModeSelect = page.getByTestId('score-mode-select');
    await scoreModeSelect.click();
    await page.getByTitle('max').click();

    // Boost Mode
    const boostModeSelect = page.getByTestId('boost-mode-select');
    await boostModeSelect.click();
    await page.getByTitle('replace').click();

    // Save
    await page.getByTestId('save-btn').click();

    await toastNotification(page, /Search Settings updated successfully/);

    await expect(scoreModeSelect).toHaveText('max');
    await expect(boostModeSelect).toHaveText('replace');

    // Restore Defaults
    await page.getByTestId('restore-defaults-btn').click();
    await toastNotification(page, /Search Settings updated successfully/);
  });
});
