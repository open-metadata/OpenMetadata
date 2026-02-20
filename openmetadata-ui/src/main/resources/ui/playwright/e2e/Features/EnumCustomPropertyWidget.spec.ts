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
import { TableClass } from '../../support/entity/TableClass';
import { expect, test } from '../../support/fixtures/userPages';
import { createNewPage, redirectToHomePage, uuid } from '../../utils/common';
import { addCustomPropertiesForEntity } from '../../utils/customProperty';
import { settingClick, SettingOptionsType } from '../../utils/sidebar';

const adminTestEntity = new TableClass();
const propertyName = `pwcustomproperty${uuid()}`;
const customType = 'Enum';
const enumConfig = { values: ['enum1', 'enum2', 'enum3'], multiSelect: false };

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Enum Custom Property on Table Right Panel', () => {
  test.slow(true);
  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await adminTestEntity.create(apiContext);
    await afterAction();
  });

  test('Create Enum Property, Add Value, Verify, Remove Value', async ({
    page,
  }) => {
    await redirectToHomePage(page);

    await settingClick(page, 'tables' as SettingOptionsType, true);

    await addCustomPropertiesForEntity({
      page,
      propertyName,
      customPropertyData: { description: 'Test Enum Property' },
      customType,
      enumConfig,
    });

    await adminTestEntity.visitEntityPage(page);

    await page.waitForSelector('[data-testid="custom_properties"]', {
      state: 'visible',
    });

    const getCustomProperties = page.waitForResponse(
      'api/v1/metadata/types/name/table?fields=customProperties*'
    );

    await page.getByTestId('custom_properties').click();

    await getCustomProperties;

    const propertyCard = page.getByTestId(
      `custom-property-${propertyName}-card`
    );

    await propertyCard.getByTestId('edit-icon').click();

    const enumSelect = page.locator('[data-testid="enum-select"]');
    await expect(enumSelect).toBeVisible();
    await enumSelect.click();

    await page
      .locator('.ant-select-item-option-content')
      .getByText('enum1', { exact: true })
      .click();

    const saveButton = page.locator('[data-testid="inline-save-btn"]');

    const patchValue1 = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/v1/tables/') &&
        resp.request().method() === 'PATCH'
    );

    await saveButton.click();

    await patchValue1;

    await expect(propertyCard.getByTestId('enum-value')).toContainText('enum1');

    await propertyCard.locator('[data-testid="edit-icon"]').click();

    await enumSelect.hover();

    const clearIcon = enumSelect.locator('.ant-select-clear');
    if (await clearIcon.isVisible()) {
      await clearIcon.click();
    } else {
      const enumInput = page.locator('#enumValues');
      await enumInput.click();
      await enumInput.fill('');
    }

    const patchValue2 = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/v1/tables/') &&
        resp.request().method() === 'PATCH'
    );
    await saveButton.click();
    await patchValue2;

    await expect(propertyCard.getByTestId('no-data')).toBeVisible();
  });
});
