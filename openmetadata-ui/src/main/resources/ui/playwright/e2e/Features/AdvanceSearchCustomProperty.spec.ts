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
import test, { expect } from '@playwright/test';
import { CUSTOM_PROPERTIES_ENTITIES } from '../../constant/customProperty';
import { GlobalSettingOptions } from '../../constant/settings';
import { SidebarItem } from '../../constant/sidebar';
import { TableClass } from '../../support/entity/TableClass';
import {
  CONDITIONS_MUST,
  selectOption,
  showAdvancedSearchDialog,
} from '../../utils/advancedSearch';
import { advanceSearchSaveFilter } from '../../utils/advancedSearchCustomProperty';
import { createNewPage, redirectToHomePage, uuid } from '../../utils/common';
import { addCustomPropertiesForEntity } from '../../utils/customProperty';
import { settingClick, sidebarClick } from '../../utils/sidebar';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Advanced Search Custom Property', () => {
  const table = new TableClass();
  const durationPropertyName = `pwCustomPropertyDurationTest${uuid()}`;
  const durationPropertyValue = 'PT1H30M';

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await table.create(apiContext);
    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await table.delete(apiContext);
    await afterAction();
  });

  test('Create, Assign and Test Advance Search for Duration', async ({
    page,
  }) => {
    test.slow(true);

    await redirectToHomePage(page);

    await test.step('Create and Assign Custom Property Value', async () => {
      await settingClick(page, GlobalSettingOptions.TABLES, true);

      await addCustomPropertiesForEntity({
        page,
        propertyName: durationPropertyName,
        customPropertyData: CUSTOM_PROPERTIES_ENTITIES['entity_table'],
        customType: 'Duration',
      });

      await table.visitEntityPage(page);

      const customPropertyResponse = page.waitForResponse(
        '/api/v1/metadata/types/name/table?fields=customProperties'
      );
      await page.getByTestId('custom_properties').click(); // Tab Click

      await customPropertyResponse;

      await page.waitForSelector('.ant-skeleton-active', {
        state: 'detached',
      });

      await page
        .getByTestId(`custom-property-${durationPropertyName}-card`)
        .locator('svg')
        .click(); // Add Custom Property Value

      await page.getByTestId('duration-input').fill(durationPropertyValue);

      const saveResponse = page.waitForResponse('/api/v1/tables/*');
      await page.getByTestId('inline-save-btn').click();
      await saveResponse;
    });

    await test.step('Verify Duration Type in Advance Search ', async () => {
      await sidebarClick(page, SidebarItem.EXPLORE);

      await showAdvancedSearchDialog(page);

      const ruleLocator = page.locator('.rule').nth(0);

      // Perform click on rule field
      await selectOption(
        page,
        ruleLocator.locator('.rule--field .ant-select'),
        'Custom Properties'
      );

      await selectOption(
        page,
        ruleLocator.locator('.rule--field .ant-select'),
        'Table'
      );

      // Perform click on custom property type to filter
      await selectOption(
        page,
        ruleLocator.locator('.rule--field .ant-select'),
        durationPropertyName
      );

      // Perform click on operator
      await selectOption(
        page,
        ruleLocator.locator('.rule--operator .ant-select'),
        CONDITIONS_MUST.equalTo.name
      );

      const inputElement = ruleLocator.locator(
        '.rule--widget--TEXT input[type="text"]'
      );

      await inputElement.fill(durationPropertyValue);

      await advanceSearchSaveFilter(page, durationPropertyValue);

      await expect(
        page.getByTestId(
          `table-data-card_${table.entityResponseData.fullyQualifiedName}`
        )
      ).toBeVisible();

      // Check around the Partial Search Value
      const partialSearchValue = durationPropertyValue.slice(0, 3);

      await page.getByTestId('advance-search-filter-btn').click();

      await expect(page.locator('[role="dialog"].ant-modal')).toBeVisible();

      // Perform click on operator
      await selectOption(
        page,
        ruleLocator.locator('.rule--operator .ant-select'),
        'Contains'
      );

      await inputElement.fill(partialSearchValue);

      await advanceSearchSaveFilter(page, partialSearchValue);

      await expect(
        page.getByTestId(
          `table-data-card_${table.entityResponseData.fullyQualifiedName}`
        )
      ).toBeVisible();
    });
  });
});
