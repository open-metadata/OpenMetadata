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
import { TableClass } from '../../support/entity/TableClass';
import { test } from '../../support/fixtures/userPages';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import {
  addCustomPropertiesForEntity,
  deleteCreatedProperty,
  editCreatedProperty,
  verifyCustomPropertyInAdvancedSearch,
} from '../../utils/customProperty';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { settingClick, SettingOptionsType } from '../../utils/sidebar';

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

    test.beforeEach('Visit Home Page', async ({ page }) => {
      await redirectToHomePage(page);
    });

    Object.values(CUSTOM_PROPERTIES_ENTITIES).forEach(async (entity) => {
      test.describe
        .serial(`Add update and delete custom properties for ${entity.name}`, () => {
        propertiesList.forEach((property) => {
          test(property, async ({ page }) => {
            // Using Date.now() to generate property names in a way that new property will always be
            // added after existing properties to avoid conflicts due to parallel test executions
            const propertyName = `pwcp${Date.now()}test${entity.name}`;
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

    test.describe.serial('Sql Query custom property layout and scroll', () => {
      const entity = CUSTOM_PROPERTIES_ENTITIES['entity_table'];

      test('sqlQuery shows scrollable CodeMirror container and no expand toggle', async ({
        page,
      }) => {
        test.slow();
        const propertyName = `pwcp${Date.now()}sqlQueryLayout`;

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
            "SELECT id, name, email\nFROM users\nWHERE active = true\nAND department = 'engineering'\nORDER BY created_at DESC\nLIMIT 100"
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
