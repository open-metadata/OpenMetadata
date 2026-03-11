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
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { GlobalSettingOptions } from '../../constant/settings';
import { TableClass } from '../../support/entity/TableClass';
import {
  createNewPage,
  getApiContext,
  redirectToHomePage,
  toastNotification,
} from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  mockEntitySearchSettings,
  restoreDefaultSearchSettings,
  setSliderValue,
} from '../../utils/searchSettingUtils';
import { settingClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Search Settings Tests', PLAYWRIGHT_BASIC_TEST_TAG_OBJ, () => {
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
    await page
      .locator('.ant-select-dropdown:visible')
      .getByTitle('Fuzzy Match')
      .click();

    // Score Mode
    const scoreModeSelect = page.getByTestId('score-mode-select');
    await scoreModeSelect.click();
    await page
      .locator('.ant-select-dropdown:visible')
      .getByTitle('Max')
      .click();

    // Boost Mode
    const boostModeSelect = page.getByTestId('boost-mode-select');
    await boostModeSelect.click();
    await page
      .locator('.ant-select-dropdown:visible')
      .getByTitle('Replace')
      .click();

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

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    const descriptionField = page.getByTestId(
      `field-configuration-panel-description`
    );
    await descriptionField.click();
    await setSliderValue(page, 'field-weight-slider', 68);

    const previewResponse = page.waitForResponse('/api/v1/search/preview');
    await page.getByTestId('highlight-field-switch').click();
    await previewResponse;

    await expect(page.getByTestId('highlight-field-switch')).toHaveAttribute(
      'aria-checked',
      'false'
    );

    const searchInput = page.getByTestId('searchbar');
    await searchInput.fill(table1.entity.name);
    await previewResponse;

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    const searchResultsContainer = page.locator('.search-results-container');

    // Get the search result cards
    const searchCards = searchResultsContainer.locator('.search-card');

    // Find the card where the title exactly matches the entity name
    const matchedCard = searchCards.filter({
      has: page.getByTestId('entity-header-display-name').filter({
        hasText: table1.entity.name,
      }),
    });

    // Assert that it exists
    await expect(matchedCard).toHaveCount(1);

    // Optionally, check the description inside that card
    await expect(
      matchedCard.getByTestId('entity-header-display-name')
    ).toHaveText(table1.entity.name);

    // Find the card where the description matches table2's entity description
    const cardWithDescription = searchCards.filter({
      has: page.getByTestId('description-text').filter({
        hasText: table2.entity.description,
      }),
    });

    // Assert that such a card exists
    await expect(cardWithDescription).toHaveCount(1);

    // Optionally, verify the description text
    await expect(
      cardWithDescription.getByTestId('description-text')
    ).toHaveText(table2.entity.description);
  });
});

test.describe('Column Search Settings Tests', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Configure column search field settings', async ({ page }) => {
    await settingClick(page, GlobalSettingOptions.SEARCH_SETTINGS);

    const columnCard = page.getByTestId('preferences.search-settings.column');
    await columnCard.click();

    await expect(page).toHaveURL(
      /settings\/preferences\/search-settings\/column$/
    );

    await page.waitForLoadState('networkidle');

    const fieldContainers = page.getByTestId('field-container-header');
    const firstFieldContainer = fieldContainers.first();
    await firstFieldContainer.click();

    const highlightToggle = page.getByTestId('highlight-field-switch');
    const wasHighlighted =
      (await highlightToggle.getAttribute('aria-checked')) === 'true';
    await highlightToggle.click();

    await setSliderValue(page, 'field-weight-slider', 15);

    const matchTypeSelect = page.getByTestId('match-type-select');
    await matchTypeSelect.click();
    await page
      .locator('.ant-select-dropdown:visible')
      .getByTitle('Exact Match')
      .click();

    const saveSettings = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/system/settings') &&
        response.request().method() === 'PUT'
    );

    await page.getByTestId('save-btn').click();
    await saveSettings;

    const previewResponse = page.waitForResponse('/api/v1/search/preview');
    await page.reload();
    await previewResponse;
    await waitForAllLoadersToDisappear(page);

    await firstFieldContainer.click();
    await expect(highlightToggle).toHaveAttribute(
      'aria-checked',
      String(!wasHighlighted)
    );
  });

  test('Search preview displays column results correctly', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const columnTable = new TableClass();
    const uniqueColumnName = `test_column_${Math.random()
      .toString(36)
      .substring(7)}`;

    columnTable.entity.columns[0].name = uniqueColumnName;
    columnTable.entity.columns[0].description = `Unique column for testing search preview`;

    try {
      await columnTable.create(apiContext);

      await redirectToHomePage(page);
      await settingClick(page, GlobalSettingOptions.SEARCH_SETTINGS);

      const columnCard = page.getByTestId('preferences.search-settings.column');
      await columnCard.click();

      await page.waitForLoadState('networkidle');

      const searchInput = page.getByTestId('searchbar');
      await searchInput.fill(uniqueColumnName);

      const previewResponse = page.waitForResponse('/api/v1/search/preview');
      await previewResponse;

      await page.waitForLoadState('networkidle');

      const searchResultsContainer = page.locator('.search-results-container');
      const matchedCard = searchResultsContainer
        .locator('.search-card')
        .filter({
          has: page.getByTestId('entity-header-display-name').filter({
            hasText: uniqueColumnName,
          }),
        });

      await expect(matchedCard).toHaveCount(1);
    } finally {
      await columnTable.delete(apiContext);
      await afterAction();
    }
  });
});
