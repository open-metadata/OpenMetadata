/*
 *  Copyright 2024 Collate.
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
import { expect } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { CUSTOM_PROPERTIES_ENTITIES } from '../../constant/customProperty';
import { SidebarItem } from '../../constant/sidebar';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { TableClass } from '../../support/entity/TableClass';
import { test } from '../../support/fixtures/userPages';
import {
  CONDITIONS_MUST,
  selectOption,
  showAdvancedSearchDialog,
} from '../../utils/advancedSearch';
import { advanceSearchSaveFilter } from '../../utils/advancedSearchCustomProperty';
import { createNewPage, redirectToHomePage, uuid } from '../../utils/common';
import {
  addCustomPropertiesForEntity,
  deleteCreatedProperty,
  editCreatedProperty,
  setValueForProperty,
  validateValueForProperty,
  verifyCustomPropertyInAdvancedSearch,
} from '../../utils/customProperty';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  settingClick,
  SettingOptionsType,
  sidebarClick,
} from '../../utils/sidebar';

const propertiesList = [
  'Integer',
  'String',
  'Markdown',
  'Duration',
  'Email',
  'Number',
  'Sql Query',
  'Time Interval',
  'Timestamp',
  'Hyperlink',
];

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const adminTestEntity = new TableClass();

test.describe(
  'Custom properties without custom property config',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    test.beforeAll('Setup test data', async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await adminTestEntity.create(apiContext);
      await afterAction();
    });

    test.afterAll('Cleanup', async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await adminTestEntity.delete(apiContext);
      await afterAction();
    });

    test.beforeEach('Visit Home Page', async ({ page }) => {
      await redirectToHomePage(page);
    });

    Object.values(CUSTOM_PROPERTIES_ENTITIES).forEach(async (entity) => {
      test.describe
        .serial(`Add update and delete custom properties for ${entity.name}`, () => {
        propertiesList.forEach((property) => {
          test(property, async ({ page }) => {
            const propertyName = `pw._CP-${uuid()} . ${entity.name}:/&^%$#@!`;
            await settingClick(
              page,
              entity.entityApiType as SettingOptionsType,
              true
            );

            await addCustomPropertiesForEntity({
              page,
              propertyName,
              customPropertyData: entity,
              customType: property,
            });

            await editCreatedProperty(page, propertyName);

            await verifyCustomPropertyInAdvancedSearch(
              page,
              propertyName.toUpperCase(), // displayName is in uppercase
              entity.name.charAt(0).toUpperCase() + entity.name.slice(1),
              property
            );

            await settingClick(
              page,
              entity.entityApiType as SettingOptionsType,
              true
            );

            await deleteCreatedProperty(page, propertyName);
          });
        });
      });
    });

    test.describe('Updating value of a special-character-name property does not duplicate the key', () => {
      const entity = CUSTOM_PROPERTIES_ENTITIES['entity_table'];

      test('no duplicate card after update', async ({ page }) => {
        test.slow();

        const propertyName = `\\ pw.edge.update.${uuid()} \\`;

        await test.step('Create property', async () => {
          await settingClick(
            page,
            entity.entityApiType as SettingOptionsType,
            true
          );
          await addCustomPropertiesForEntity({
            page,
            propertyName,
            customPropertyData: entity,
            customType: 'String',
          });
        });

        await test.step('Set initial value', async () => {
          await adminTestEntity.visitEntityPage(page);
          await waitForAllLoadersToDisappear(page);

          await setValueForProperty({
            page,
            propertyName,
            value: 'initial value',
            propertyType: 'string',
            endpoint: EntityTypeEndpoint.Table,
          });

          await validateValueForProperty({
            page,
            propertyName,
            value: 'initial value',
            propertyType: 'string',
          });
        });

        await test.step('Update value and verify only one card exists', async () => {
          await setValueForProperty({
            page,
            propertyName,
            value: 'updated value',
            propertyType: 'string',
            endpoint: EntityTypeEndpoint.Table,
          });

          await validateValueForProperty({
            page,
            propertyName,
            value: 'updated value',
            propertyType: 'string',
          });

          await expect(
            page.getByTestId(`custom-property-${propertyName}-card`)
          ).toHaveCount(1);
          await expect(
            page.getByTestId(`custom-property-"${propertyName}"-card`)
          ).toHaveCount(0);
        });

        await test.step('Value persists after reload', async () => {
          await page.reload();
          await waitForAllLoadersToDisappear(page);

          await validateValueForProperty({
            page,
            propertyName,
            value: 'updated value',
            propertyType: 'string',
          });

          await expect(
            page.getByTestId(`custom-property-${propertyName}-card`)
          ).toHaveCount(1);
          await expect(
            page.getByTestId(`custom-property-"${propertyName}"-card`)
          ).toHaveCount(0);
        });

        await test.step('Updated value is searchable via Advanced Search', async () => {
          await sidebarClick(page, SidebarItem.EXPLORE);

          await showAdvancedSearchDialog(page);

          const ruleLocator = page.locator('.rule').nth(0);

          await selectOption(
            page,
            ruleLocator.locator('.rule--field .ant-select'),
            'Custom Properties',
            true
          );

          await selectOption(
            page,
            ruleLocator.locator('.rule--field .ant-select'),
            'Table',
            true
          );

          await selectOption(
            page,
            ruleLocator.locator('.rule--field .ant-select'),
            propertyName,
            true
          );

          await selectOption(
            page,
            ruleLocator.locator('.rule--operator .ant-select'),
            CONDITIONS_MUST.equalTo.name
          );

          await ruleLocator
            .locator('.rule--widget--TEXT input[type="text"]')
            .fill('updated value');

          await advanceSearchSaveFilter(page, 'updated value');

          await expect(
            page.getByTestId(
              `table-data-card_${adminTestEntity.entityResponseData.fullyQualifiedName}`
            )
          ).toBeVisible();
        });
      });
    });

    test.describe.serial('Sql Query custom property layout and scroll', () => {
      const entity = CUSTOM_PROPERTIES_ENTITIES['entity_table'];

      test('sqlQuery shows scrollable CodeMirror container and no expand toggle', async ({
        page,
      }) => {
        test.slow();
        const propertyName = `pwcp${uuid()}${uuid()}sqlQueryLayout`;

        await test.step('Create sqlQuery property', async () => {
          await settingClick(
            page,
            entity.entityApiType as SettingOptionsType,
            true
          );
          await addCustomPropertiesForEntity({
            page,
            propertyName,
            customPropertyData: entity,
            customType: 'Sql Query',
          });
        });

        await test.step('Set multi-line SQL value', async () => {
          await adminTestEntity.visitEntityPage(page);
          await waitForAllLoadersToDisappear(page);
          await page.getByTestId('custom_properties').click();

          const container = page.locator(
            `[data-testid="custom-property-${propertyName}-card"]`
          );
          const editButton = container.getByTestId('edit-icon');
          await editButton.scrollIntoViewIfNeeded();
          await expect(editButton).toBeVisible();
          await expect(editButton).toBeEnabled();
          await editButton.click();

          await page.locator("pre[role='presentation']").last().click();
          await page.keyboard.type(
            "SELECT id, name, email\n\nFROM users\n\nWHERE active = true\n\nAND department = 'engineering'\n\nORDER BY created_at DESC\n\nLIMIT 100"
          );

          const patchResponse = page.waitForResponse(
            `/api/v1/${entity.entityApiType}/*`
          );
          await container.getByTestId('inline-save-btn').click();
          expect((await patchResponse).status()).toBe(200);
          await waitForAllLoadersToDisappear(page);
        });

        await test.step('Verify .CodeMirror-scroll is height-constrained and scrollable', async () => {
          const container = page.locator(
            `[data-testid="custom-property-${propertyName}-card"]`
          );
          const codeMirrorScroll = container.locator('.CodeMirror-scroll');
          await expect(codeMirrorScroll).toBeVisible();
          const isScrollable = await codeMirrorScroll.evaluate(
            (el) => el.scrollHeight > el.clientHeight
          );
          expect(isScrollable).toBeTruthy();
        });

        await test.step('Verify expand/collapse toggle is hidden', async () => {
          const container = page.locator(
            `[data-testid="custom-property-${propertyName}-card"]`
          );
          await expect(
            container.getByTestId(`toggle-${propertyName}`)
          ).not.toBeVisible();
        });

        await test.step('Cleanup property', async () => {
          await settingClick(
            page,
            entity.entityApiType as SettingOptionsType,
            true
          );
          await deleteCreatedProperty(page, propertyName);
        });
      });
    });
  }
);
