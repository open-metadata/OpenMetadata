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
import { CUSTOM_PROPERTIES_ENTITIES } from '../../constant/customProperty';
import { TableClass } from '../../support/entity/TableClass';
import { test } from '../../support/fixtures/userPages';
import { UserClass } from '../../support/user/UserClass';
import {
  clickOutside,
  createNewPage,
  redirectToHomePage,
  uuid,
} from '../../utils/common';
import {
  addCustomPropertiesForEntity,
  deleteCreatedProperty,
  editCreatedProperty,
  fillTableColumnInputDetails,
  verifyCustomPropertyInAdvancedSearch,
} from '../../utils/customProperty';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { settingClick, SettingOptionsType } from '../../utils/sidebar';

type CustomPropertyEntity =
  (typeof CUSTOM_PROPERTIES_ENTITIES)[keyof typeof CUSTOM_PROPERTIES_ENTITIES];

const propertiesWithConfigList = [
  {
    name: 'Enum',
    getConfig: (entity: CustomPropertyEntity) => ({
      enumConfig: entity.enumConfig,
    }),
    editPropertyType: 'Enum',
    verifyAdvancedSearch: true,
  },
  {
    name: 'Table',
    getConfig: (entity: CustomPropertyEntity) => ({
      tableConfig: entity.tableConfig,
    }),
    editPropertyType: 'Table',
    verifyAdvancedSearch: true,
    searchTableColumns: true,
  },
  {
    name: 'Entity Reference',
    getConfig: (entity: CustomPropertyEntity) => ({
      entityReferenceConfig: entity.entityReferenceConfig,
    }),
    editPropertyType: 'Entity Reference',
    verifyAdvancedSearch: true,
  },
  {
    name: 'Entity Reference List',
    getConfig: (entity: CustomPropertyEntity) => ({
      entityReferenceConfig: entity.entityReferenceConfig,
    }),
    editPropertyType: 'Entity Reference List',
    verifyAdvancedSearch: true,
  },
  {
    name: 'Date',
    getConfig: (entity: CustomPropertyEntity) => ({
      formatConfig: entity.dateFormatConfig,
    }),
    verifyAdvancedSearch: false,
  },
  {
    name: 'Time',
    getConfig: (entity: CustomPropertyEntity) => ({
      formatConfig: entity.timeFormatConfig,
    }),
    verifyAdvancedSearch: true,
  },
  {
    name: 'Date Time',
    getConfig: (entity: CustomPropertyEntity) => ({
      formatConfig: entity.dateTimeFormatConfig,
    }),
    verifyAdvancedSearch: true,
  },
];

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Custom properties with custom property config', () => {
  const adminTestEntity = new TableClass();
  const users: UserClass[] = [];

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await adminTestEntity.create(apiContext);
    for (let i = 0; i < 5; i++) {
      const user = new UserClass();
      await user.create(apiContext);
      users.push(user);
    }
    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await adminTestEntity.delete(apiContext);
    for (const user of users) {
      await user.delete(apiContext);
    }
    await afterAction();
  });

  test.beforeEach('Visit Home Page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  Object.values(CUSTOM_PROPERTIES_ENTITIES).forEach(async (entity) => {
    test.describe
      .serial(`Add update and delete custom properties for ${entity.name}`, () => {
      propertiesWithConfigList.forEach((propertyConfig) => {
        test(propertyConfig.name, async ({ page }) => {
          test.slow();
          const propertyName = `pwcp${uuid()}${uuid()}test${entity.name}`;
          await settingClick(
            page,
            entity.entityApiType as SettingOptionsType,
            true
          );

          await addCustomPropertiesForEntity({
            page,
            propertyName,
            customPropertyData: entity,
            customType: propertyConfig.name,
            ...propertyConfig.getConfig(entity),
          });

          if (propertyConfig.editPropertyType) {
            await editCreatedProperty(
              page,
              propertyName,
              propertyConfig.editPropertyType
            );
          } else {
            await editCreatedProperty(page, propertyName);
          }

          if (propertyConfig.verifyAdvancedSearch) {
            if (propertyConfig.searchTableColumns) {
              await verifyCustomPropertyInAdvancedSearch(
                page,
                propertyName.toUpperCase(),
                entity.name.charAt(0).toUpperCase() + entity.name.slice(1),
                propertyConfig.name,
                entity.tableConfig.columns
              );
            } else {
              await verifyCustomPropertyInAdvancedSearch(
                page,
                propertyName.toUpperCase(),
                entity.name.charAt(0).toUpperCase() + entity.name.slice(1)
              );
            }
          }

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

  test.describe.serial('Custom property layout, scroll and count', () => {
    const entity = CUSTOM_PROPERTIES_ENTITIES['entity_table'];

    test('entityReferenceList shows item count, scrollable list, no expand toggle', async ({
      page,
    }) => {
      test.slow();
      const propertyName = `pwcp${uuid()}${uuid()}entityRefListLayout`;

      await test.step('Create entityReferenceList property', async () => {
        await settingClick(
          page,
          entity.entityApiType as SettingOptionsType,
          true
        );
        await addCustomPropertiesForEntity({
          page,
          propertyName,
          customPropertyData: entity,
          customType: 'Entity Reference List',
          entityReferenceConfig: entity.entityReferenceConfig,
        });
      });

      await test.step('Set 5 user references as value', async () => {
        await redirectToHomePage(page);
        await adminTestEntity.visitEntityPage(page);
        await waitForAllLoadersToDisappear(page);
        await page.getByTestId('custom_properties').click();
        await waitForAllLoadersToDisappear(page);

        const container = page.locator(
          `[data-testid="custom-property-${propertyName}-card"]`
        );
        const editButton = container.getByTestId('edit-icon');
        await editButton.scrollIntoViewIfNeeded();
        await expect(editButton).toBeVisible();
        await expect(editButton).toBeEnabled();
        await editButton.click();

        for (const user of users) {
          const userName = user.getUserName();
          const displayName = user.getUserDisplayName();
          const resultLocator = page.locator(`[data-testid="${displayName}"]`);

          await expect(async () => {
            const searchApi = `**/api/v1/search/query?q=*${encodeURIComponent(
              userName
            )}*`;
            const searchResponse = page.waitForResponse(searchApi);
            await page.locator('#entityReference').clear();
            await page.locator('#entityReference').fill(userName);
            await searchResponse;
            await expect(resultLocator).toBeVisible({ timeout: 5_000 });
          }).toPass({ timeout: 30_000, intervals: [1_000, 2_000, 5_000] });

          await resultLocator.click();
        }
        await clickOutside(page);
        const patchResponse = page.waitForResponse(
          `/api/v1/${entity.entityApiType}/*`
        );
        await container.getByTestId('inline-save-btn').click();
        expect((await patchResponse).status()).toBe(200);
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Verify item count (5) in property name', async () => {
        const container = page.locator(
          `[data-testid="custom-property-${propertyName}-card"]`
        );
        await expect(container.getByTestId('property-name')).toContainText(
          '(5)'
        );
      });

      await test.step('Verify .entity-list-body is scrollable', async () => {
        const container = page.locator(
          `[data-testid="custom-property-${propertyName}-card"]`
        );
        const listBody = container.locator('.entity-list-body');
        await expect(listBody).toBeVisible();
        const isScrollable = await listBody.evaluate(
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

    test('table-cp shows row count, scrollable container, no expand toggle', async ({
      page,
    }) => {
      test.slow();
      const propertyName = `pwcp${uuid()}${uuid()}tableCpLayout`;

      await test.step('Create table-cp property', async () => {
        await settingClick(
          page,
          entity.entityApiType as SettingOptionsType,
          true
        );
        await addCustomPropertiesForEntity({
          page,
          propertyName,
          customPropertyData: entity,
          customType: 'Table',
          tableConfig: entity.tableConfig,
        });
      });

      await test.step('Add 5 rows of data to table property', async () => {
        await redirectToHomePage(page);
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

        for (let i = 0; i < 5; i++) {
          await page.getByTestId('add-new-row').click();
          await expect(page.locator('.om-rdg')).toBeVisible();
          await fillTableColumnInputDetails(
            page,
            `row${i + 1}-col1`,
            entity.tableConfig.columns[0]
          );
          await fillTableColumnInputDetails(
            page,
            `row${i + 1}-col2`,
            entity.tableConfig.columns[1]
          );
        }

        const patchResponse = page.waitForResponse(
          `/api/v1/${entity.entityApiType}/*`
        );
        await page.getByTestId('update-table-type-property').click();
        expect((await patchResponse).status()).toBe(200);
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Verify row count (5) in property name', async () => {
        const container = page.locator(
          `[data-testid="custom-property-${propertyName}-card"]`
        );
        await expect(container.getByTestId('property-name')).toContainText(
          '(5)'
        );
      });

      await test.step('Verify .custom-property-scrollable-container is scrollable', async () => {
        const container = page.locator(
          `[data-testid="custom-property-${propertyName}-card"]`
        );
        const scrollContainer = container.locator(
          '.custom-property-scrollable-container'
        );
        await expect(scrollContainer).toBeVisible();
        const isScrollable = await scrollContainer.evaluate(
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
});
