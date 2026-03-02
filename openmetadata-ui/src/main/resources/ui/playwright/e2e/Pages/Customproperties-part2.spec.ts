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
import { UserClass } from '../../support/user/UserClass';
import { test } from '../../support/fixtures/userPages';
import {
  clickOutside,
  createNewPage,
  redirectToHomePage,
} from '../../utils/common';
import {
  addCustomPropertiesForEntity,
  deleteCreatedProperty,
  editCreatedProperty,
  fillTableColumnInputDetails,
  verifyCustomPropertyInAdvancedSearch,
  verifyTableColumnCustomPropertyPersistence,
} from '../../utils/customProperty';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { settingClick, SettingOptionsType } from '../../utils/sidebar';

const TABLE_COLUMN_ENTITY_NAME = 'tableColumn';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Custom properties with custom property config', () => {
  const adminTestEntity = new TableClass();
  const users: UserClass[] = [];

  test.describe('Custom properties with custom property config', () => {
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

    test.afterAll('Cleanup users', async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      for (const user of users) {
        await user.delete(apiContext);
      }
      await afterAction();
    });

    test.beforeEach('Visit Home Page', async ({ page }) => {
      await redirectToHomePage(page);
    });

    test.describe('Add update and delete Enum custom properties', () => {
      Object.values(CUSTOM_PROPERTIES_ENTITIES).forEach(async (entity) => {
        test(`Add Enum custom property for ${entity.name}`, async ({
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
        test(`Add Table custom property for ${entity.name}`, async ({
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
        test(`Add Date custom property for ${entity.name}`, async ({
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
        test(`Add Time custom property for ${entity.name}`, async ({
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

    test.describe.serial('Custom property layout, scroll and count', () => {
      const entity = CUSTOM_PROPERTIES_ENTITIES['entity_table'];

      test('entityReferenceList shows item count, scrollable list, no expand toggle', async ({
        page,
      }) => {
        test.slow();
        const propertyName = `pwcp${Date.now()}entityRefListLayout`;

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

          const container = page.locator(
            `[data-testid="custom-property-${propertyName}-card"]`
          );
          const editButton = container.getByTestId('edit-icon');
          await editButton.scrollIntoViewIfNeeded();
          await expect(editButton).toBeVisible();
          await expect(editButton).toBeEnabled();
          await editButton.click();

          for (const user of users) {
            const searchApi = `**/api/v1/search/query?q=*${encodeURIComponent(
              user.getUserName()
            )}*`;
            const searchResponse = page.waitForResponse(searchApi);
            await page.locator('#entityReference').clear();
            await page.locator('#entityReference').fill(user.getUserName());
            await searchResponse;
            await page
              .locator(`[data-testid="${user.getUserDisplayName()}"]`)
              .click();
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
        const propertyName = `pwcp${Date.now()}tableCpLayout`;

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

        await test.step(
          'Verify .custom-property-scrollable-container is scrollable',
          async () => {
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
          }
        );

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
});
