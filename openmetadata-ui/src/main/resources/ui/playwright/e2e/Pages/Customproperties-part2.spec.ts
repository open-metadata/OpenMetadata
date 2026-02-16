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

const TABLE_COLUMN_ENTITY_NAME = 'tableColumn';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const adminTestEntity = new TableClass();

test.describe('Custom properties with custom property config', () => {
  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await adminTestEntity.create(apiContext);
    await afterAction();
  });

  test.beforeEach('Visit Home Page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  test.describe('Add update and delete Enum custom properties', () => {
    Object.values(CUSTOM_PROPERTIES_ENTITIES).forEach(async (entity) => {
      test(`Add Enum custom property for ${entity.name}`, async ({ page }) => {
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
          customType: 'Enum',
          enumConfig: entity.enumConfig,
        });

        await editCreatedProperty(page, propertyName, 'Enum');

        await verifyCustomPropertyInAdvancedSearch(
          page,
          propertyName.toUpperCase(), // displayName is in uppercase
          entity.name.charAt(0).toUpperCase() + entity.name.slice(1)
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
                propertyType: 'Enum',
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

  test.describe('Add update and delete Table custom properties', () => {
    Object.values(CUSTOM_PROPERTIES_ENTITIES).forEach(async (entity) => {
      test(`Add Table custom property for ${entity.name}`, async ({ page }) => {
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
          customType: 'Table',
          tableConfig: entity.tableConfig,
        });

        await editCreatedProperty(page, propertyName, 'Table');

        await verifyCustomPropertyInAdvancedSearch(
          page,
          propertyName.toUpperCase(), // displayName is in uppercase
          entity.name.charAt(0).toUpperCase() + entity.name.slice(1),
          'Table',
          entity.tableConfig.columns
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
                propertyType: 'Table',
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

  test.describe(
    'Add update and delete Entity Reference custom properties',
    () => {
      Object.values(CUSTOM_PROPERTIES_ENTITIES).forEach(async (entity) => {
        test(`Add Entity Reference custom property for ${entity.name}`, async ({
          page,
        }) => {
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
            customType: 'Entity Reference',
            entityReferenceConfig: entity.entityReferenceConfig,
          });

          await editCreatedProperty(page, propertyName, 'Entity Reference');

          await verifyCustomPropertyInAdvancedSearch(
            page,
            propertyName.toUpperCase(), // displayName is in uppercase
            entity.name.charAt(0).toUpperCase() + entity.name.slice(1)
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
                  propertyType: 'Entity Reference',
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
    }
  );

  test.describe(
    'Add update and delete Entity Reference List custom properties',
    () => {
      Object.values(CUSTOM_PROPERTIES_ENTITIES).forEach(async (entity) => {
        test(`Add Entity Reference list custom property for ${entity.name}`, async ({
          page,
        }) => {
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
            customType: 'Entity Reference List',
            entityReferenceConfig: entity.entityReferenceConfig,
          });

          await editCreatedProperty(
            page,
            propertyName,
            'Entity Reference List'
          );

          await verifyCustomPropertyInAdvancedSearch(
            page,
            propertyName.toUpperCase(), // displayName is in uppercase
            entity.name.charAt(0).toUpperCase() + entity.name.slice(1)
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
                  propertyType: 'Entity Reference List',
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
    }
  );

  test.describe('Add update and delete Date custom properties', () => {
    Object.values(CUSTOM_PROPERTIES_ENTITIES).forEach(async (entity) => {
      test(`Add Date custom property for ${entity.name}`, async ({ page }) => {
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
          customType: 'Date',
          formatConfig: entity.dateFormatConfig,
        });

        await editCreatedProperty(page, propertyName);

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
                propertyType: 'Date',
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

  test.describe('Add update and delete Time custom properties', () => {
    Object.values(CUSTOM_PROPERTIES_ENTITIES).forEach(async (entity) => {
      test(`Add Time custom property for ${entity.name}`, async ({ page }) => {
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
          customType: 'Time',
          formatConfig: entity.timeFormatConfig,
        });

        await editCreatedProperty(page, propertyName);

        await verifyCustomPropertyInAdvancedSearch(
          page,
          propertyName.toUpperCase(), // displayName is in uppercase
          entity.name.charAt(0).toUpperCase() + entity.name.slice(1)
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
                propertyType: 'Time',
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

  test.describe('Add update and delete DateTime custom properties', () => {
    Object.values(CUSTOM_PROPERTIES_ENTITIES).forEach(async (entity) => {
      test(`Add DateTime custom property for ${entity.name}`, async ({
        page,
      }) => {
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
          customType: 'Date Time',
          formatConfig: entity.dateTimeFormatConfig,
        });

        await editCreatedProperty(page, propertyName);

        await verifyCustomPropertyInAdvancedSearch(
          page,
          propertyName.toUpperCase(), // displayName is in uppercase
          entity.name.charAt(0).toUpperCase() + entity.name.slice(1)
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
                propertyType: 'Date Time',
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
