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
import { settingClick, SettingOptionsType } from '../../utils/sidebar';

type CustomPropertyEntity =
  typeof CUSTOM_PROPERTIES_ENTITIES[keyof typeof CUSTOM_PROPERTIES_ENTITIES];

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

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await adminTestEntity.create(apiContext);
    await afterAction();
  });

  test.beforeEach('Visit Home Page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  Object.values(CUSTOM_PROPERTIES_ENTITIES).forEach(async (entity) => {
    test.describe.serial(
      `Add update and delete custom properties for ${entity.name}`,
      () => {
        propertiesWithConfigList.forEach((propertyConfig) => {
          test(propertyConfig.name, async ({ page }) => {
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
      }
    );
  });
});
