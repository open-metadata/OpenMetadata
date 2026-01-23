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
import {
    addCustomPropertiesForEntity
} from '../../utils/customProperty';
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


        const customPropsWidget = page.locator(
            '[data-testid="KnowledgePanel.CustomProperties"]'
        );
        await expect(customPropsWidget).toBeVisible();
        const propertyRow = customPropsWidget.locator('.ant-row').filter({ hasText: propertyName }).first();

        await customPropsWidget.scrollIntoViewIfNeeded();
        await customPropsWidget.hover();
        await page.mouse.wheel(0, 500);
        await expect(propertyRow).toBeVisible();
        await propertyRow.locator('[data-testid="edit-icon-right-panel"]').click();


        const enumSelect = page.locator('[data-testid="enum-select"]');
        await expect(enumSelect).toBeVisible();
        await enumSelect.click();

        await page
            .locator('.ant-select-item-option-content')
            .getByText('enum1', { exact: true })
            .click();

        const saveButton = page.locator('[data-testid="inline-save-btn"]');
        await saveButton.click();

        await expect(
            propertyRow.getByTestId('enum-value')
        ).toContainText('enum1');

        await propertyRow.locator('[data-testid="edit-icon-right-panel"]').click();

        await enumSelect.hover();

        const clearIcon = enumSelect.locator('.ant-select-clear');
        if (await clearIcon.isVisible()) {
            await clearIcon.click();
        } else {
            const enumInput = page.locator('#enumValues');
            await enumInput.click();
            await enumInput.fill('');
        }

        await saveButton.click();

        await expect(propertyRow.getByTestId('no-data')).toBeVisible();
    });
});
