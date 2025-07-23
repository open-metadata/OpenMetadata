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
import { TableClass } from '../../support/entity/TableClass';
import {
  createNewPage,
  redirectToHomePage,
  toastNotification,
} from '../../utils/common';
import {
  mockEntitySearchSettings,
  restoreDefaultSearchSettings,
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

    await enableRolesPolicesInSearchSwitch.click();
    await toastNotification(page, /Search Settings updated successfully/);

    const globalSettingEditIcon = page.getByTestId(
      'global-setting-edit-icon-Max Aggregate Size'
    );
    await globalSettingEditIcon.click();

    await page.getByTestId('value-input').fill('2000');

    await page.getByTestId('inline-save-btn').click();
    await toastNotification(page, /Search Settings updated successfully/);

    await expect(
      page.getByTestId(`global-setting-value-Max Aggregate Size`)
    ).toHaveText('2000');
  });

  test('Update entity search settings', async ({ page }) => {
    await settingClick(page, GlobalSettingOptions.SEARCH_SETTINGS);

    const tableCard = page.getByTestId(mockEntitySearchSettings.key);

    await tableCard.click();

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

    // Match Type
    const matchTypeSelect = page.getByTestId('match-type-select');
    await matchTypeSelect.click();
    await page.getByTitle('Fuzzy Match').click();

    // Score Mode
    const scoreModeSelect = page.getByTestId('score-mode-select');
    await scoreModeSelect.click();
    await page.getByTitle('Max').click();

    // Boost Mode
    const boostModeSelect = page.getByTestId('boost-mode-select');
    await boostModeSelect.click();
    await page.getByTitle('Replace').click();

    // Save
    await page.getByTestId('save-btn').click();

    await toastNotification(page, /Search Settings updated successfully/);

    await expect(scoreModeSelect).toHaveText('Max');
    await expect(boostModeSelect).toHaveText('Replace');
  });

  test('Restore default search settings', async ({ page }) => {
    await settingClick(page, GlobalSettingOptions.SEARCH_SETTINGS);

    const tableCard = page.getByTestId(mockEntitySearchSettings.key);

    await tableCard.click();

    await expect(page).toHaveURL(
      new RegExp(mockEntitySearchSettings.url + '$')
    );

    const restoreDefaultsBtn = page.getByTestId('restore-defaults-btn');
    await restoreDefaultsBtn.click();

    await restoreDefaultSearchSettings(page);

    await toastNotification(page, /Search Settings restored successfully/);
  });
});

test.describe('Search Preview test', () => {
  const table1 = new TableClass();
  const table2 = new TableClass();
  // Override properties to include "ranking" keyword
  table1.entity.name = `${table1.entity.name}-ranking`;
  table1.entity.displayName = `${table1.entity.name}`;
  table2.entity.description = `This is a ${table1.entity.name} test table for search settings verification`;

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    // Create tables with the customized properties
    await table1.create(apiContext);
    await table2.create(apiContext);
    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await table1.delete(apiContext);
    await table2.delete(apiContext);
    await afterAction();
  });

  test('Search preview for searchable table', async ({ page }) => {
    await redirectToHomePage(page);
    await settingClick(page, GlobalSettingOptions.SEARCH_SETTINGS);

    const tableCard = page.getByTestId(mockEntitySearchSettings.key);
    await tableCard.click();

    await expect(page).toHaveURL(
      new RegExp(mockEntitySearchSettings.url + '$')
    );

    const searchInput = page.getByTestId('searchbar');
    await searchInput.fill(table1.entity.name);

    const descriptionField = page.getByTestId(
      `field-configuration-panel-description`
    );
    await descriptionField.click();
    await setSliderValue(page, 'field-weight-slider', 68);
    await descriptionField.click();

    await page.waitForLoadState('networkidle');

    const searchResultsContainer = page.locator('.search-results-container');

    // Get the search result cards
    const searchCards = searchResultsContainer.locator('.search-card');

    // Check the first card has table1's display name using data-testid
    const firstCard = searchCards.nth(0);

    await expect(
      firstCard.getByTestId('entity-header-display-name')
    ).toHaveText(table1.entity.name);

    // Check the second card has table2's description using data-testid
    const secondCard = searchCards.nth(1);

    await expect(secondCard.getByTestId('description-text')).toContainText(
      table2.entity.description
    );
  });
});
