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
  verifyTableColumnCustomPropertyPersistence,
} from '../../utils/customProperty';
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

const TABLE_COLUMN_ENTITY_NAME = 'tableColumn';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const adminTestEntity = new TableClass();

test.describe('Custom properties without custom property config', () => {
  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await adminTestEntity.create(apiContext);
    await afterAction();
  });

  test.beforeEach('Visit Home Page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  propertiesList.forEach((property) => {
    test.describe(`Add update and delete ${property} custom properties`, () => {
      Object.values(CUSTOM_PROPERTIES_ENTITIES).forEach(async (entity) => {
        // Using Date.now() to generate property names in a way that new property will always be
        // added after existing properties to avoid conflicts due to parallel test executions
        const propertyName = `pwcp${Date.now()}test${entity.name}`;

        test(`Add ${property} custom property for ${entity.name}`, async ({
          page,
        }) => {
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

          if (entity.name === TABLE_COLUMN_ENTITY_NAME) {
            await test.step(
              'Verify Custom Property Persistence on Reload',
              async () => {
                const tableName = adminTestEntity.entity.name ?? '';
                const tableFqn =
                  adminTestEntity.entityResponseData.fullyQualifiedName ?? '';

                await verifyTableColumnCustomPropertyPersistence({
                  page,
                  tableName,
                  tableFqn,
                  propertyName,
                  propertyType: property,
                });
              }
            );
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
});
