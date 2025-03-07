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
import { redirectToHomePage } from '../../utils/common';
import {
  mockEntitySearchSettings,
  setSliderValue,
} from '../../utils/searchSettingUtils';
import { settingClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
});

test('Update global search settings', async ({ page }) => {
  test.slow(true);

  await settingClick(page, GlobalSettingOptions.SEARCH_SETTINGS);

  const enableRolesPolicesInSearchSwitch = page.getByTestId(
    'enable-roles-polices-in-search-switch'
  );
  const initialCheckedState =
    await enableRolesPolicesInSearchSwitch.isChecked();
  await enableRolesPolicesInSearchSwitch.click();

  await expect(enableRolesPolicesInSearchSwitch).toHaveAttribute(
    'aria-checked',
    (!initialCheckedState).toString()
  );

  await expect(
    page.getByText('Search Settings updated successfully')
  ).toBeVisible();

  const globalSettingEditIcon = page.getByTestId(
    'global-setting-edit-icon-Max Aggregate Size'
  );
  await globalSettingEditIcon.click();

  await page.getByTestId('value-input').fill('15000');

  await page.getByTestId('inline-save-btn').click();

  await expect(
    page.getByTestId(`global-setting-value-Max Aggregate Size`)
  ).toHaveText('15000');
});

test('Update entity search settings', async ({ page }) => {
  await settingClick(page, GlobalSettingOptions.SEARCH_SETTINGS);

  await page.waitForSelector('[data-testid^="search-settings-card-"]');
  const tableCard = page.getByTestId(
    `search-settings-card-${mockEntitySearchSettings.key}`
  );

  await tableCard.getByTestId('view-detail-button').click();

  await expect(page).toHaveURL(new RegExp(mockEntitySearchSettings.url + '$'));

  await expect(page.getByTestId('entity-search-settings-header')).toBeVisible();

  const fieldContainers = page.getByTestId('field-container-header');
  const firstFieldContainer = fieldContainers.first();
  await firstFieldContainer.click();

  // Highlight Field
  const highlightFieldToggle = page.getByTestId('highlight-field-switch');
  const initialCheckedState = await highlightFieldToggle.isChecked();
  await highlightFieldToggle.click();

  await expect(highlightFieldToggle).toHaveAttribute(
    'aria-checked',
    (!initialCheckedState).toString()
  );

  // Same for radio button
  const mustNotMatchRadio = page.getByTestId('must-not-match-radio');
  await mustNotMatchRadio.click();

  // Field Weight
  await setSliderValue(page, 'field-weight-slider', 8);

  // Add Boost
  const addBoostButton = page.getByTestId('add-boost');
  await addBoostButton.click();

  const fieldValueBoostSelect = page.getByTestId('value-boost-option');

  await expect(fieldValueBoostSelect).toBeVisible();

  await fieldValueBoostSelect.click();

  await setSliderValue(page, 'field-boost-slider', 4);

  // Switch to Boost tab
  const boostTab = page.getByRole('tab', { name: 'Boosts' });
  await boostTab.click();

  await expect(page.getByTestId('boost-configurations')).toBeVisible();

  // Score Mode
  const scoreModeSelect = page.getByTestId('score-mode-select');
  const currentScoreMode = await scoreModeSelect.textContent();
  const newScoreMode = currentScoreMode === 'max' ? 'sum' : 'max';

  await scoreModeSelect.click();
  await page.getByTitle(newScoreMode).click();

  // Boost Mode
  const boostModeSelect = page.getByTestId('boost-mode-select');
  const currentBoostMode = await boostModeSelect.textContent();
  const newBoostMode = currentBoostMode === 'multiply' ? 'replace' : 'multiply';

  await boostModeSelect.click();
  await page.getByTitle(newBoostMode).click();

  // Save
  await page.getByTestId('save-btn').click();

  await expect(
    page.getByText('Search Settings updated successfully')
  ).toBeVisible();
  await expect(highlightFieldToggle).toHaveAttribute('aria-checked', 'true');
  await expect(mustNotMatchRadio).toBeChecked();
  await expect(scoreModeSelect).toHaveText(newScoreMode);
  await expect(boostModeSelect).toHaveText(newBoostMode);
});
