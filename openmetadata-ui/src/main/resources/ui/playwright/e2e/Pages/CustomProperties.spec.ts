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

/**
 * Consolidated custom property tests for all entity types:
 *   Table, Container, Dashboard, Topic, Pipeline,
 *   Database, DatabaseSchema, GlossaryTerm, MlModel, SearchIndex,
 *   StoredProcedure, DashboardDataModel, Metric, Chart,
 *   ApiCollection, ApiEndpoint, DataProduct, Domain, TableColumn.
 *
 * Each entity type has ONE describe.serial block so no two workers can ever run
 * CP create/edit/delete operations for the same entity type simultaneously.
 *
 * Entity setup (prepareCustomProperty) is done in beforeAll, not inside tests,
 * so cleanup always runs in afterAll even when a test fails mid-way.
 */

import { expect, test } from '@playwright/test';
import { CUSTOM_PROPERTIES_ENTITIES } from '../../constant/customProperty';
import {
  CP_BASE_VALUES,
  CP_PARTIAL_SEARCH_VALUES,
  CP_RANGE_VALUES,
} from '../../constant/customPropertyAdvancedSearch';
import { ENDPOINT_TO_EXPLORE_TAB_MAP } from '../../constant/explore';
import { GlobalSettingOptions } from '../../constant/settings';
import { SidebarItem } from '../../constant/sidebar';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { ApiCollectionClass } from '../../support/entity/ApiCollectionClass';
import { ApiEndpointClass } from '../../support/entity/ApiEndpointClass';
import { ChartClass } from '../../support/entity/ChartClass';
import { ContainerClass } from '../../support/entity/ContainerClass';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../../support/entity/DashboardDataModelClass';
import { DatabaseClass } from '../../support/entity/DatabaseClass';
import { DatabaseSchemaClass } from '../../support/entity/DatabaseSchemaClass';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { MetricClass } from '../../support/entity/MetricClass';
import { MlModelClass } from '../../support/entity/MlModelClass';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { SearchIndexClass } from '../../support/entity/SearchIndexClass';
import { StoredProcedureClass } from '../../support/entity/StoredProcedureClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { UserClass } from '../../support/user/UserClass';
import {
  CONDITIONS_MUST,
  selectOption,
  showAdvancedSearchDialog,
} from '../../utils/advancedSearch';
import { advanceSearchSaveFilter } from '../../utils/advancedSearchCustomProperty';
import {
  clickOutside,
  createNewPage,
  getApiContext,
  redirectToHomePage,
  uuid,
} from '../../utils/common';
import {
  addCustomPropertiesForEntity,
  createCustomPropertyForEntity,
  CustomPropertyTypeByName,
  deleteCreatedProperty,
  editCreatedProperty,
  fillTableColumnInputDetails,
  setValueForProperty,
  updateCustomPropertyInRightPanel,
  validateValueForProperty,
  verifyCustomPropertyInAdvancedSearch,
  verifyTableColumnCustomPropertyPersistence,
} from '../../utils/customProperty';
import {
  applyCustomPropertyFilter,
  clearAdvancedSearchFilters,
  CPASTestData,
  setupCustomPropertyAdvancedSearchTest,
  verifySearchResults,
} from '../../utils/customPropertyAdvancedSearchUtils';
import {
  getEntityDisplayName,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';
import { getEntityFqn } from '../../utils/entityPanel';
import { navigateToExploreAndSelectEntity } from '../../utils/explore';
import { setSliderValue } from '../../utils/searchSettingUtils';
import {
  settingClick,
  SettingOptionsType,
  sidebarClick,
} from '../../utils/sidebar';
import { CustomPropertiesPageObject } from '../PageObject/Explore/CustomPropertiesPageObject';
import { RightPanelPageObject } from '../PageObject/Explore/RightPanelPageObject';

test.use({ storageState: 'playwright/.auth/admin.json' });

type CustomPropertyEntity =
  (typeof CUSTOM_PROPERTIES_ENTITIES)[keyof typeof CUSTOM_PROPERTIES_ENTITIES];

type AssetTypes =
  | TableClass
  | ContainerClass
  | DashboardClass
  | TopicClass
  | PipelineClass
  | DatabaseClass
  | DatabaseSchemaClass
  | MlModelClass
  | SearchIndexClass
  | StoredProcedureClass
  | DashboardDataModelClass
  | MetricClass
  | ChartClass
  | ApiCollectionClass
  | ApiEndpointClass;

type OtherTypes = GlossaryTerm | Domain | DataProduct;

type CRUDEntity = {
  key: keyof typeof CUSTOM_PROPERTIES_ENTITIES;
  makeInstance: (() => AssetTypes | OtherTypes) | null;
};

const BASIC_PROPERTIES = [
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

const CONFIG_PROPERTIES: Array<{
  name: string;
  getConfig: (e: CustomPropertyEntity) => Record<string, unknown>;
  editPropertyType?: string;
  verifyAdvancedSearch: boolean;
  searchTableColumns?: boolean;
}> = [
  {
    name: 'Enum',
    getConfig: (e) => ({ enumConfig: e.enumConfig }),
    editPropertyType: 'Enum',
    verifyAdvancedSearch: true,
  },
  {
    name: 'Table',
    getConfig: (e) => ({ tableConfig: e.tableConfig }),
    editPropertyType: 'Table',
    verifyAdvancedSearch: true,
    searchTableColumns: true,
  },
  {
    name: 'Entity Reference',
    getConfig: (e) => ({ entityReferenceConfig: e.entityReferenceConfig }),
    editPropertyType: 'Entity Reference',
    verifyAdvancedSearch: true,
  },
  {
    name: 'Entity Reference List',
    getConfig: (e) => ({ entityReferenceConfig: e.entityReferenceConfig }),
    editPropertyType: 'Entity Reference List',
    verifyAdvancedSearch: true,
  },
  {
    name: 'Date',
    getConfig: (e) => ({ formatConfig: e.dateFormatConfig }),
    verifyAdvancedSearch: false,
  },
  {
    name: 'Time',
    getConfig: (e) => ({ formatConfig: e.timeFormatConfig }),
    verifyAdvancedSearch: true,
  },
  {
    name: 'Date Time',
    getConfig: (e) => ({ formatConfig: e.dateTimeFormatConfig }),
    verifyAdvancedSearch: true,
  },
];

const ALL_ENTITIES: CRUDEntity[] = [
  // Part-1 entities
  { key: 'entity_table', makeInstance: () => new TableClass() },
  { key: 'entity_container', makeInstance: () => new ContainerClass() },
  { key: 'entity_dashboard', makeInstance: () => new DashboardClass() },
  { key: 'entity_topic', makeInstance: () => new TopicClass() },
  { key: 'entity_pipeline', makeInstance: () => new PipelineClass() },
  // Part-2 entities
  { key: 'entity_database', makeInstance: () => new DatabaseClass() },
  {
    key: 'entity_databaseSchema',
    makeInstance: () => new DatabaseSchemaClass(),
  },
  { key: 'entity_glossaryTerm', makeInstance: () => new GlossaryTerm() },
  { key: 'entity_mlmodel', makeInstance: () => new MlModelClass() },
  { key: 'entity_searchIndex', makeInstance: () => new SearchIndexClass() },
  {
    key: 'entity_storedProcedure',
    makeInstance: () => new StoredProcedureClass(),
  },
  {
    key: 'entity_dashboardDataModel',
    makeInstance: () => new DashboardDataModelClass(),
  },
  { key: 'entity_metric', makeInstance: () => new MetricClass() },
  { key: 'entity_chart', makeInstance: () => new ChartClass() },
  // Part-3 entities
  { key: 'entity_apiCollection', makeInstance: () => new ApiCollectionClass() },
  { key: 'entity_apiEndpoint', makeInstance: () => new ApiEndpointClass() },
  { key: 'entity_dataProduct', makeInstance: () => new DataProduct() },
  { key: 'entity_domain', makeInstance: null },
  { key: 'entity_tableColumn', makeInstance: null },
];

ALL_ENTITIES.forEach(({ key, makeInstance }) => {
  const entity = CUSTOM_PROPERTIES_ENTITIES[key];

  test.describe
    .serial(`Add update and delete custom properties for ${entity.name}`, () => {
    let mainEntity: AssetTypes | OtherTypes = {} as AssetTypes | OtherTypes;
    let responseData:
      | AssetTypes['entityResponseData']
      | OtherTypes['responseData'];

    let tableForColumnTest: TableClass | null = null;
    const users: UserClass[] = [];

    // Dashboard-specific state
    let dashboardTopic1: TopicClass;
    let dashboardTopic2: TopicClass;
    const cpasTestData: CPASTestData = {
      types: [],
      cpMetadataType: { name: '', id: '' },
      createdCPData: [],
    };
    const propertyNames: Record<string, string> = {};
    const dashboardSearchPropertyName = `cp-${uuid()}-${entity.name}`;
    const dashboardPropertyValue = `EXECUTIVE_DASHBOARD_${uuid()}`;

    // Pipeline-specific state
    const pipelineSearchPropertyName = `cp-${uuid()}-${entity.name}`;
    const pipelinePropertyValue = `ETL_PRODUCTION_${uuid()}`;

    test.beforeAll(async ({ browser }) => {
      const { page, apiContext, afterAction } = await createNewPage(browser);

      if (key === 'entity_tableColumn') {
        tableForColumnTest = new TableClass();
        await tableForColumnTest.create(apiContext);
      } else if (makeInstance !== null) {
        mainEntity = makeInstance();
        await mainEntity.create(apiContext);
        await mainEntity.prepareCustomProperty(apiContext);

        if (key === 'entity_table') {
          for (let i = 0; i < 5; i++) {
            const user = new UserClass();
            await user.create(apiContext);
            users.push(user);
          }
        } else if (key === 'entity_dashboard') {
          dashboardTopic1 = new TopicClass();
          dashboardTopic2 = new TopicClass();
          await dashboardTopic1.create(apiContext);
          await dashboardTopic2.create(apiContext);
          await setupCustomPropertyAdvancedSearchTest(
            page,
            cpasTestData,
            mainEntity as DashboardClass,
            dashboardTopic1,
            dashboardTopic2
          );
          cpasTestData.createdCPData.forEach((cp) => {
            propertyNames[cp.propertyType.name] = cp.name;
          });
        }
      }
      responseData =
        (mainEntity as AssetTypes).entityResponseData ??
        (mainEntity as OtherTypes).responseData;

      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      if (makeInstance !== null) {
        await mainEntity.cleanupCustomProperty(apiContext);
        await mainEntity.delete(apiContext);
        if (key === 'entity_dataProduct') {
          for (const domain of (mainEntity as DataProduct).getDomains()) {
            await domain.delete(apiContext);
          }
        }
      } else if (tableForColumnTest !== null) {
        await tableForColumnTest.delete(apiContext);
      }
      if (users.length) {
        for (const user of users) {
          await user.delete(apiContext);
        }
      }
      if (dashboardTopic1) {
        await dashboardTopic1.delete(apiContext);
      }
      if (dashboardTopic2) {
        await dashboardTopic2.delete(apiContext);
      }

      await afterAction();
    });

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
    });

    // ── 17 CRUD tests ──────────────────────────────────────────────────────

    BASIC_PROPERTIES.forEach((property) => {
      test(property, async ({ page }) => {
        const propertyName = `cp-${uuid()}-${entity.name}`;

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
          propertyName.toUpperCase(),
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

    CONFIG_PROPERTIES.forEach((propertyConfig) => {
      test(propertyConfig.name, async ({ page }) => {
        test.slow();
        const propertyName = `cp-${uuid()}-${entity.name}`;

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

    // ── Set & Update all CP types (entities with a UI entity page) ──────────

    if (makeInstance !== null) {
      test(`Set & Update all CP types on ${entity.name}`, async ({ page }) => {
        test.slow(true);
        const properties = Object.values(CustomPropertyTypeByName);

        await test.step('Set all CP types', async () => {
          await mainEntity.visitEntityPage(page);
          for (const type of properties) {
            await mainEntity.updateCustomProperty(
              page,
              mainEntity.customPropertyValue[type].property,
              mainEntity.customPropertyValue[type].value
            );
          }
        });

        await test.step('Update all CP types', async () => {
          await mainEntity.visitEntityPage(page);
          for (const type of properties) {
            await mainEntity.updateCustomProperty(
              page,
              mainEntity.customPropertyValue[type].property,
              mainEntity.customPropertyValue[type].newValue
            );
          }
        });

        await test.step('Update all CP types in Right Panel', async () => {
          for (const [index, type] of properties.entries()) {
            await updateCustomPropertyInRightPanel({
              page,
              entityName: getEntityDisplayName(responseData),
              propertyDetails: mainEntity.customPropertyValue[type].property,
              value: mainEntity.customPropertyValue[type].value,
              endpoint: mainEntity.endpoint,
              skipNavigation: index > 0,
              exploreTab: ENDPOINT_TO_EXPLORE_TAB_MAP[mainEntity.endpoint],
              entityFQN: responseData.fullyQualifiedName,
            });
          }
        });
      });
    }

    // ── Table-specific extra tests ──────────────────────────────────────────

    if (key === 'entity_table') {
      test('sqlQuery shows scrollable CodeMirror container and no expand toggle', async ({
        page,
      }) => {
        test.slow();
        const propertyName =
          mainEntity.customPropertyValue[CustomPropertyTypeByName.SQL_QUERY]
            .property.name;

        await test.step('Set multi-line SQL value', async () => {
          await mainEntity.visitEntityPage(page);
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
      });

      test('entityReferenceList shows item count, scrollable list, no expand toggle', async ({
        page,
      }) => {
        test.slow();
        const propertyName =
          mainEntity.customPropertyValue[
            CustomPropertyTypeByName.ENTITY_REFERENCE_LIST
          ].property.name;

        await test.step('Set 5 user references as value', async () => {
          await redirectToHomePage(page);
          await mainEntity.visitEntityPage(page);
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

        await test.step('Verify item count (7) in property name', async () => {
          const container = page.locator(
            `[data-testid="custom-property-${propertyName}-card"]`
          );
          await expect(container.getByTestId('property-name')).toContainText(
            '(7)'
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
      });

      test('User visible in right panel when added as entityReferenceList custom property', async ({
        page,
      }) => {
        const { apiContext, afterAction } = await getApiContext(page);
        const propertyName =
          mainEntity.customPropertyValue[
            CustomPropertyTypeByName.ENTITY_REFERENCE_LIST
          ].property.name;
        const testUser = users[0];
        const userName = testUser.responseData.name;
        const userDisplayName = testUser.responseData.displayName ?? userName;

        await (mainEntity as TableClass).patch({
          apiContext,
          patchData: [
            {
              op: 'add',
              path: '/extension',
              value: {
                [propertyName]: [
                  {
                    id: testUser.responseData.id,
                    type: 'user',
                    name: userName,
                    fullyQualifiedName:
                      testUser.responseData.fullyQualifiedName,
                  },
                ],
              },
            },
          ],
        });

        await mainEntity.visitEntityPage(page);

        const userElement = page.getByTestId(userName);
        const isUserVisible = await userElement.isVisible();
        if (!isUserVisible) {
          await page.getByTestId('custom_properties').click();
        }

        const rightPanelSection = page.getByTestId(propertyName);
        await expect(rightPanelSection).toBeVisible();

        const userLink = page.getByTestId(userName).getByRole('link');
        await expect(userLink).toContainText(userName);

        const userDetailsResponse = page.waitForResponse(
          '/api/v1/users/name/*'
        );
        await userLink.click();
        await userDetailsResponse;

        await expect(page).toHaveURL(
          new RegExp(`/users/(%22)?${userName}(%22)?`, 'i')
        );
        await expect(page.getByTestId('user-display-name')).toHaveText(
          userDisplayName
        );

        await (mainEntity as TableClass).patch({
          apiContext,
          patchData: [
            {
              op: 'add',
              path: `/extension/${propertyName}`,
              value: [],
            },
          ],
        });

        await afterAction();
      });

      test('table-cp shows row count, scrollable container, no expand toggle', async ({
        page,
      }) => {
        test.slow();
        const propertyName =
          mainEntity.customPropertyValue[CustomPropertyTypeByName.TABLE_CP]
            .property.name;

        await test.step('Add 5 rows of data to table property', async () => {
          await redirectToHomePage(page);
          await mainEntity.visitEntityPage(page);
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
      });

      test('Enum: Set Value, Verify, Remove Value', async ({ page }) => {
        test.slow();
        const propertyName =
          mainEntity.customPropertyValue[CustomPropertyTypeByName.ENUM].property
            .name;

        await mainEntity.visitEntityPage(page);

        await page.locator('[data-testid="custom_properties"]').waitFor({
          state: 'visible',
        });

        const getCustomPropertiesResponse = page.waitForResponse(
          'api/v1/metadata/types/name/table?fields=customProperties*'
        );
        await page.getByTestId('custom_properties').click();
        await getCustomPropertiesResponse;

        const propertyCard = page.getByTestId(
          `custom-property-${propertyName}-card`
        );
        await propertyCard.getByTestId('edit-icon').click();

        const enumSelect = page.locator('[data-testid="enum-select"]');
        await expect(enumSelect).toBeVisible();
        await enumSelect.click();

        await page
          .locator('.ant-select-item-option-content')
          .getByText('medium', { exact: true })
          .click();

        const saveButton = page.locator('[data-testid="inline-save-btn"]');
        const patchValue1 = page.waitForResponse(
          (resp) =>
            resp.url().includes('/api/v1/tables/') &&
            resp.request().method() === 'PATCH'
        );
        await saveButton.click();
        await patchValue1;

        await expect(propertyCard.getByTestId('enum-value')).toContainText(
          'medium'
        );

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

      test('Duration: advanced search equalTo and Contains operators', async ({
        page,
      }) => {
        test.slow();
        const durationPropertyName =
          mainEntity.customPropertyValue[CustomPropertyTypeByName.DURATION]
            .property.name;
        const durationPropertyValue = 'PT1H30M';

        await test.step('Assign Custom Property Value', async () => {
          await mainEntity.visitEntityPage(page);

          const customPropertyResponse = page.waitForResponse(
            '/api/v1/metadata/types/name/table?fields=customProperties'
          );
          await page.getByTestId('custom_properties').click();
          await customPropertyResponse;

          await page.locator('.ant-skeleton-active').waitFor({
            state: 'detached',
          });

          await page
            .getByTestId(`custom-property-${durationPropertyName}-card`)
            .getByTestId('edit-icon')
            .click();

          await page.getByTestId('duration-input').fill(durationPropertyValue);

          const saveResponse = page.waitForResponse('/api/v1/tables/*');
          await page.getByTestId('inline-save-btn').click();
          await saveResponse;
        });

        await test.step('Verify Duration Type in Advance Search', async () => {
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
            durationPropertyName,
            true
          );

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
              `table-data-card_${responseData.fullyQualifiedName ?? ''}`
            )
          ).toBeVisible();

          const partialSearchValue = durationPropertyValue.slice(0, 3);
          await page.getByTestId('advance-search-filter-btn').click();
          await expect(page.locator('[role="dialog"].ant-modal')).toBeVisible();

          await selectOption(
            page,
            ruleLocator.locator('.rule--operator .ant-select'),
            'Contains'
          );
          await inputElement.fill(partialSearchValue);

          await advanceSearchSaveFilter(page, partialSearchValue);

          await expect(
            page.getByTestId(
              `table-data-card_${responseData.fullyQualifiedName ?? ''}`
            )
          ).toBeVisible();
        });
      });
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
          await mainEntity.visitEntityPage(page);
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
              `table-data-card_${
                (mainEntity as TableClass).entityResponseData.fullyQualifiedName
              }`
            )
          ).toBeVisible();
        });
      });
    }

    // ── Container-specific extra tests ─────────────────────────────────────

    if (key === 'entity_container') {
      test('should show No Data placeholder when hyperlink has no value', async ({
        page,
      }) => {
        const propertyName =
          mainEntity.customPropertyValue[CustomPropertyTypeByName.HYPERLINK_CP]
            .property.name;

        await EntityDataClass.container1.visitEntityPage(page);
        await page.click('[data-testid="custom_properties"]');

        const containerLocator = page.locator(
          `[data-testid="custom-property-${propertyName}-card"]`
        );

        await expect(containerLocator.getByTestId('no-data')).toBeVisible();
        await expect(containerLocator.getByTestId('no-data')).toContainText(
          'Not set'
        );
      });

      test('should reject javascript: protocol URLs for XSS protection', async ({
        page,
      }) => {
        const propertyName =
          mainEntity.customPropertyValue[CustomPropertyTypeByName.HYPERLINK_CP]
            .property.name;

        await EntityDataClass.container1.visitEntityPage(page);
        await page.click('[data-testid="custom_properties"]');

        const editButton = page.locator(
          `[data-testid="custom-property-${propertyName}-card"] [data-testid="edit-icon"]`
        );
        await editButton.scrollIntoViewIfNeeded();
        await editButton.click();

        await page
          .locator('[data-testid="hyperlink-url-input"]')
          .fill('javascript:alert("XSS")');

        await expect(
          page.locator('.ant-form-item-explain-error')
        ).toContainText('URL must use http or https protocol');

        await page.locator('[data-testid="inline-cancel-btn"]').click();
      });

      test('should accept valid http and https URLs', async ({ page }) => {
        const propertyName =
          mainEntity.customPropertyValue[CustomPropertyTypeByName.HYPERLINK_CP]
            .property.name;

        await EntityDataClass.container1.visitEntityPage(page);

        await setValueForProperty({
          page,
          propertyName,
          value: 'https://openmetadata.io,OpenMetadata Docs',
          propertyType: 'hyperlink-cp',
          endpoint: EntityTypeEndpoint.Container,
        });

        await validateValueForProperty({
          page,
          propertyName,
          value: 'https://openmetadata.io,OpenMetadata Docs',
          propertyType: 'hyperlink-cp',
        });

        const hyperlinkElement = page
          .locator(`[data-testid="custom-property-${propertyName}-card"]`)
          .getByTestId('hyperlink-value');

        await expect(hyperlinkElement).toHaveAttribute(
          'href',
          'https://openmetadata.io'
        );
        await expect(hyperlinkElement).toHaveAttribute('target', '_blank');
        await expect(hyperlinkElement).toHaveAttribute(
          'rel',
          'noopener noreferrer'
        );
      });

      test('should display URL when no display text is provided', async ({
        page,
      }) => {
        const propertyName =
          mainEntity.customPropertyValue[CustomPropertyTypeByName.HYPERLINK_CP]
            .property.name;
        const propertyValue =
          mainEntity.customPropertyValue[CustomPropertyTypeByName.HYPERLINK_CP]
            .value;

        await EntityDataClass.container1.visitEntityPage(page);

        await setValueForProperty({
          page,
          propertyName,
          value: propertyValue,
          propertyType: 'hyperlink-cp',
          endpoint: EntityTypeEndpoint.Container,
        });

        await validateValueForProperty({
          page,
          propertyName,
          value: propertyValue,
          propertyType: 'hyperlink-cp',
        });
      });
    }

    // ── Dashboard-specific extra tests ─────────────────────────────────────

    if (key === 'entity_dashboard') {
      test.describe('Dashboard CP Advanced Search - Text Fields', () => {
        test.beforeEach(async ({ page }) => {
          await sidebarClick(page, SidebarItem.EXPLORE);
        });

        test('String CP with all operators', async ({ page }) => {
          test.slow();
          const propertyName = propertyNames['string'];

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'equal',
            CP_BASE_VALUES.string
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true,
            CP_BASE_VALUES.string
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'not_equal',
            CP_BASE_VALUES.string
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false,
            CP_BASE_VALUES.string
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'like',
            CP_PARTIAL_SEARCH_VALUES.string
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true,
            CP_PARTIAL_SEARCH_VALUES.string
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'not_like',
            CP_BASE_VALUES.string
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false,
            CP_BASE_VALUES.string
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(page, propertyName, 'is_null', '');
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'is_not_null',
            ''
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);
        });

        test('String CP with numeric-like string value', async ({
          browser,
          page,
        }) => {
          test.slow();
          const numericStringDashboard = new DashboardClass();

          await test.step('Setup dashboard with numeric-like string value', async () => {
            const { apiContext, afterAction } = await createNewPage(browser);

            await numericStringDashboard.create(apiContext);

            await apiContext.patch(
              `/api/v1/dashboards/${numericStringDashboard.entityResponseData.id}`,
              {
                data: [
                  {
                    op: 'add',
                    path: '/extension',
                    value: { [propertyNames['string']]: '100' },
                  },
                ],
                headers: {
                  'Content-Type': 'application/json-patch+json',
                },
              }
            );

            await afterAction();
          });

          await test.step('Equal operator finds dashboard with string value "100"', async () => {
            await showAdvancedSearchDialog(page);
            await applyCustomPropertyFilter(
              page,
              propertyNames['string'],
              'equal',
              '100'
            );
            await verifySearchResults(
              page,
              numericStringDashboard.entityResponseData.fullyQualifiedName,
              true,
              '100'
            );
            await clearAdvancedSearchFilters(page);
          });

          await test.step('Not_equal operator excludes dashboard with string value "100"', async () => {
            await showAdvancedSearchDialog(page);
            await applyCustomPropertyFilter(
              page,
              propertyNames['string'],
              'not_equal',
              '100'
            );
            await verifySearchResults(
              page,
              numericStringDashboard.entityResponseData.fullyQualifiedName,
              false,
              '100'
            );
            await clearAdvancedSearchFilters(page);
          });

          await test.step('Contains operator finds dashboard with partial numeric-like string "10"', async () => {
            await showAdvancedSearchDialog(page);
            await applyCustomPropertyFilter(
              page,
              propertyNames['string'],
              'like',
              '10'
            );
            await verifySearchResults(
              page,
              numericStringDashboard.entityResponseData.fullyQualifiedName,
              true,
              '10'
            );
            await clearAdvancedSearchFilters(page);
          });

          await test.step('Not contains operator excludes dashboard with partial numeric-like string "10"', async () => {
            await showAdvancedSearchDialog(page);
            await applyCustomPropertyFilter(
              page,
              propertyNames['string'],
              'not_like',
              '10'
            );
            await verifySearchResults(
              page,
              numericStringDashboard.entityResponseData.fullyQualifiedName,
              false,
              '10'
            );
            await clearAdvancedSearchFilters(page);
          });

          await test.step('Is not null operator finds dashboard with numeric-like string value', async () => {
            await showAdvancedSearchDialog(page);
            await applyCustomPropertyFilter(
              page,
              propertyNames['string'],
              'is_not_null',
              ''
            );
            await verifySearchResults(
              page,
              numericStringDashboard.entityResponseData.fullyQualifiedName,
              true
            );
            await clearAdvancedSearchFilters(page);
          });
        });

        test('Email CP with all operators', async ({ page }) => {
          test.slow();
          const propertyName = propertyNames['email'];

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'equal',
            CP_BASE_VALUES.email
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true,
            CP_BASE_VALUES.email
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'not_equal',
            CP_BASE_VALUES.email
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'like',
            CP_PARTIAL_SEARCH_VALUES.email
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(page, propertyName, 'is_null', '');
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'is_not_null',
            ''
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);
        });

        test('Markdown CP with all operators', async ({ page }) => {
          test.slow();
          const propertyName = propertyNames['markdown'];

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'like',
            CP_PARTIAL_SEARCH_VALUES.markdown
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'not_like',
            CP_BASE_VALUES.markdown
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(page, propertyName, 'is_null', '');
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'is_not_null',
            ''
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);
        });

        test('SQL Query CP with all operators', async ({ page }) => {
          test.slow();
          const propertyName = propertyNames['sqlQuery'];

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'like',
            CP_PARTIAL_SEARCH_VALUES.sqlQuery
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(page, propertyName, 'is_null', '');
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'is_not_null',
            ''
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);
        });

        test('Duration CP with all operators', async ({ page }) => {
          test.slow();
          const propertyName = propertyNames['duration'];

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'equal',
            CP_BASE_VALUES.duration
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'like',
            CP_PARTIAL_SEARCH_VALUES.duration
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(page, propertyName, 'is_null', '');
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'is_not_null',
            ''
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);
        });

        test('Time CP with all operators', async ({ page }) => {
          test.slow();
          const propertyName = propertyNames['time-cp'];

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'equal',
            CP_BASE_VALUES.timeCp
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'like',
            CP_PARTIAL_SEARCH_VALUES.timeCp
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(page, propertyName, 'is_null', '');
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'is_not_null',
            ''
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);
        });
      });

      test.describe('Dashboard CP Advanced Search - Number Fields', () => {
        test.beforeEach(async ({ page }) => {
          await sidebarClick(page, SidebarItem.EXPLORE);
        });

        test('Integer CP with all operators', async ({ page }) => {
          test.slow();
          const propertyName = propertyNames['integer'];

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'equal',
            CP_BASE_VALUES.integer
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'not_equal',
            CP_BASE_VALUES.integer
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'between',
            CP_RANGE_VALUES.integer
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(page, propertyName, 'not_between', {
            start: CP_BASE_VALUES.integer - 2,
            end: CP_BASE_VALUES.integer + 4,
          });
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(page, propertyName, 'is_null', '');
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'is_not_null',
            ''
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);
        });

        test('Number CP with all operators', async ({ page }) => {
          test.slow();
          const propertyName = propertyNames['number'];

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'equal',
            CP_BASE_VALUES.number
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'not_equal',
            CP_BASE_VALUES.number
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'between',
            CP_RANGE_VALUES.number
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(page, propertyName, 'is_null', '');
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'is_not_null',
            ''
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);
        });

        test('Timestamp CP with all operators', async ({ page }) => {
          test.slow();
          const propertyName = propertyNames['timestamp'];

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'equal',
            CP_BASE_VALUES.timestamp
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'not_equal',
            CP_BASE_VALUES.timestamp
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(page, propertyName, 'is_null', '');
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'is_not_null',
            ''
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);
        });
      });

      test.describe('Dashboard CP Advanced Search - Entity References', () => {
        test.beforeEach(async ({ page }) => {
          await sidebarClick(page, SidebarItem.EXPLORE);
        });

        test('Entity Reference CP with all operators', async ({ page }) => {
          test.slow();
          const propertyName = propertyNames['entityReference'];
          const containsText =
            dashboardTopic1.entityResponseData.displayName?.substring(1, 5);
          const regexpText = `${dashboardTopic1.entityResponseData.displayName?.substring(
            0,
            2
          )}.*${dashboardTopic1.entityResponseData.displayName?.substring(
            5,
            7
          )}.*`;

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'select_equals',
            dashboardTopic1.entityResponseData.displayName ?? '',
            'Dashboard',
            'entityReference'
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'select_not_equals',
            dashboardTopic1.entityResponseData.displayName ?? '',
            'Dashboard',
            'entityReference'
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'like',
            containsText ?? ''
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true,
            containsText
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'not_like',
            containsText ?? ''
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false,
            containsText
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'regexp',
            regexpText
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true,
            regexpText
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(page, propertyName, 'is_null', '');
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'is_not_null',
            ''
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);
        });

        test('Entity Reference List CP with all operators', async ({
          page,
        }) => {
          test.slow();
          const propertyName = propertyNames['entityReferenceList'];
          const containsText =
            dashboardTopic1.entityResponseData.displayName?.substring(1, 5);
          const regexpText = `${dashboardTopic1.entityResponseData.displayName?.substring(
            0,
            2
          )}.*${dashboardTopic1.entityResponseData.displayName?.substring(
            5,
            7
          )}.*`;

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'select_equals',
            dashboardTopic1.entityResponseData.displayName ?? '',
            'Dashboard',
            'entityReferenceList'
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'select_equals',
            dashboardTopic2.entityResponseData.displayName ?? '',
            'Dashboard',
            'entityReferenceList'
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'select_not_equals',
            dashboardTopic2.entityResponseData.displayName ?? '',
            'Dashboard',
            'entityReferenceList'
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'like',
            containsText ?? ''
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true,
            containsText
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'not_like',
            containsText ?? ''
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false,
            containsText
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'regexp',
            regexpText
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true,
            regexpText
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(page, propertyName, 'is_null', '');
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'is_not_null',
            ''
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);
        });
      });

      test.describe('Dashboard CP Advanced Search - Date/Time Fields', () => {
        test.beforeEach(async ({ page }) => {
          await sidebarClick(page, SidebarItem.EXPLORE);
        });

        test('DateTime CP with all operators', async ({ page }) => {
          test.slow();
          const propertyName = propertyNames['dateTime-cp'];

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'equal',
            CP_BASE_VALUES.dateTimeCp,
            undefined,
            'dateTime-cp'
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'not_equal',
            CP_BASE_VALUES.dateTimeCp,
            undefined,
            'dateTime-cp'
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'between',
            CP_RANGE_VALUES.dateTimeCp
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'not_between',
            CP_RANGE_VALUES.dateTimeCp
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(page, propertyName, 'is_null', '');
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'is_not_null',
            ''
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);
        });

        test('Date CP with all operators', async ({ page }) => {
          test.slow();
          const propertyName = propertyNames['date-cp'];

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'equal',
            CP_BASE_VALUES.dateCp,
            undefined,
            'date-cp'
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'not_equal',
            CP_BASE_VALUES.dateCp,
            undefined,
            'date-cp'
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'between',
            CP_RANGE_VALUES.dateCp
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'not_between',
            CP_RANGE_VALUES.dateCp
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(page, propertyName, 'is_null', '');
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'is_not_null',
            ''
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);
        });
      });

      test.describe('Dashboard CP Advanced Search - Enum Fields', () => {
        test.beforeEach(async ({ page }) => {
          await sidebarClick(page, SidebarItem.EXPLORE);
        });

        test('Enum CP with all operators', async ({ page }) => {
          test.slow();
          const propertyName = propertyNames['enum'];

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'multiselect_equals',
            CP_BASE_VALUES.enum[0]
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'multiselect_contains',
            CP_BASE_VALUES.enum[0]
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'multiselect_not_equals',
            CP_BASE_VALUES.enum[0]
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'multiselect_not_contains',
            CP_BASE_VALUES.enum[0]
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(page, propertyName, 'is_null', '');
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            propertyName,
            'is_not_null',
            ''
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);
        });
      });

      test.describe('Dashboard CP Advanced Search - Special Types', () => {
        test.beforeEach(async ({ page }) => {
          await sidebarClick(page, SidebarItem.EXPLORE);
        });

        test('Time Interval CP with operators', async ({ page }) => {
          test.slow();
          const propertyName = propertyNames['timeInterval'];
          const startPropertyName = `${propertyName} (Start)`;
          const endPropertyName = `${propertyName} (End)`;

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            startPropertyName,
            'equal',
            CP_BASE_VALUES.timeInterval.start
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true,
            String(CP_BASE_VALUES.timeInterval.start)
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            startPropertyName,
            'not_equal',
            CP_BASE_VALUES.timeInterval.start
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false,
            String(CP_BASE_VALUES.timeInterval.start)
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(page, startPropertyName, 'between', {
            start: CP_BASE_VALUES.timeInterval.start - 2,
            end: CP_BASE_VALUES.timeInterval.start + 4,
          });
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            startPropertyName,
            'not_between',
            {
              start: CP_BASE_VALUES.timeInterval.start - 2,
              end: CP_BASE_VALUES.timeInterval.start + 4,
            }
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            startPropertyName,
            'is_not_null',
            ''
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            startPropertyName,
            'is_null',
            ''
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            endPropertyName,
            'equal',
            CP_BASE_VALUES.timeInterval.end
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true,
            String(CP_BASE_VALUES.timeInterval.end)
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            endPropertyName,
            'not_equal',
            CP_BASE_VALUES.timeInterval.end
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false,
            String(CP_BASE_VALUES.timeInterval.end)
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(page, endPropertyName, 'between', {
            start: CP_BASE_VALUES.timeInterval.end - 2,
            end: CP_BASE_VALUES.timeInterval.end + 4,
          });
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            endPropertyName,
            'not_between',
            {
              start: CP_BASE_VALUES.timeInterval.end - 2,
              end: CP_BASE_VALUES.timeInterval.end + 4,
            }
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            endPropertyName,
            'is_not_null',
            ''
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(page, endPropertyName, 'is_null', '');
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);
        });

        test('Hyperlink CP with operators', async ({ page }) => {
          test.slow();
          const propertyName = propertyNames['hyperlink-cp'];
          const urlProperty = `${propertyName} URL`;
          const displayTextProperty = `${propertyName} Display Text`;
          const urlPartialValue = CP_BASE_VALUES.hyperlinkCp.url.substring(
            3,
            9
          );
          const displayTextPartialValue =
            CP_BASE_VALUES.hyperlinkCp.displayText.substring(2, 6);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            urlProperty,
            'equal',
            CP_BASE_VALUES.hyperlinkCp.url
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true,
            String(CP_BASE_VALUES.hyperlinkCp.url)
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            urlProperty,
            'not_equal',
            CP_BASE_VALUES.hyperlinkCp.url
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false,
            String(CP_BASE_VALUES.hyperlinkCp.url)
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            urlProperty,
            'like',
            urlPartialValue
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true,
            urlPartialValue
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            urlProperty,
            'not_like',
            urlPartialValue
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false,
            urlPartialValue
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(page, urlProperty, 'is_not_null', '');
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(page, urlProperty, 'is_null', '');
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            displayTextProperty,
            'equal',
            CP_BASE_VALUES.hyperlinkCp.displayText
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true,
            String(CP_BASE_VALUES.hyperlinkCp.displayText)
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            displayTextProperty,
            'not_equal',
            CP_BASE_VALUES.hyperlinkCp.displayText
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false,
            String(CP_BASE_VALUES.hyperlinkCp.displayText)
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            displayTextProperty,
            'like',
            displayTextPartialValue
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true,
            displayTextPartialValue
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            displayTextProperty,
            'not_like',
            displayTextPartialValue
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false,
            displayTextPartialValue
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            displayTextProperty,
            'is_not_null',
            ''
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            displayTextProperty,
            'is_null',
            ''
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);
        });
      });

      test.describe('Dashboard CP Advanced Search - Table CP', () => {
        test.beforeEach(async ({ page }) => {
          await sidebarClick(page, SidebarItem.EXPLORE);
        });

        test('Table CP - Name column with all operators', async ({ page }) => {
          const value = CP_BASE_VALUES.tableCp.rows[0]['Name'];
          const partialValue = value.substring(1, 4);
          const basePropertyName = propertyNames['table-cp'];
          const columnPropertyName = `${basePropertyName} - Name`;

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            columnPropertyName,
            'equal',
            value
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true,
            value
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            columnPropertyName,
            'not_equal',
            value
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            columnPropertyName,
            'like',
            partialValue
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true,
            partialValue
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            columnPropertyName,
            'not_like',
            partialValue
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false,
            partialValue
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            columnPropertyName,
            'is_null',
            ''
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            columnPropertyName,
            'is_not_null',
            ''
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);
        });

        test('Table CP - Role column with all operators', async ({ page }) => {
          const value = CP_BASE_VALUES.tableCp.rows[0]['Role'];
          const partialValue = value.substring(1, 4);
          const basePropertyName = propertyNames['table-cp'];
          const columnPropertyName = `${basePropertyName} - Role`;

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            columnPropertyName,
            'equal',
            value
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true,
            value
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            columnPropertyName,
            'not_equal',
            value
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            columnPropertyName,
            'like',
            partialValue
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true,
            partialValue
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            columnPropertyName,
            'not_like',
            partialValue
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false,
            partialValue
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            columnPropertyName,
            'is_null',
            ''
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            columnPropertyName,
            'is_not_null',
            ''
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);
        });

        test('Table CP - Sr No column with all operators', async ({ page }) => {
          const value = CP_BASE_VALUES.tableCp.rows[1]['Sr No'];
          const basePropertyName = propertyNames['table-cp'];
          const columnPropertyName = `${basePropertyName} - Sr No`;

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            columnPropertyName,
            'equal',
            value
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true,
            value
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            columnPropertyName,
            'not_equal',
            value
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false,
            value
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            columnPropertyName,
            'like',
            value
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true,
            value
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            columnPropertyName,
            'not_like',
            value
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false,
            value
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            columnPropertyName,
            'is_null',
            ''
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            false
          );
          await clearAdvancedSearchFilters(page);

          await showAdvancedSearchDialog(page);
          await applyCustomPropertyFilter(
            page,
            columnPropertyName,
            'is_not_null',
            ''
          );
          await verifySearchResults(
            page,
            responseData.fullyQualifiedName ?? '',
            true
          );
          await clearAdvancedSearchFilters(page);
        });
      });

      test('Create custom property and configure search for Dashboard', async ({
        page,
      }) => {
        test.slow(true);

        await test.step('Create and assign custom property to Dashboard', async () => {
          await settingClick(page, GlobalSettingOptions.DASHBOARDS, true);
          await addCustomPropertiesForEntity({
            page,
            propertyName: dashboardSearchPropertyName,
            customPropertyData: CUSTOM_PROPERTIES_ENTITIES['entity_dashboard'],
            customType: 'String',
          });

          await mainEntity.visitEntityPage(page);

          const customPropertyResponse = page.waitForResponse(
            '/api/v1/metadata/types/name/dashboard?fields=customProperties'
          );
          await page.getByTestId('custom_properties').click();
          await customPropertyResponse;

          await page.locator('.ant-skeleton-active').waitFor({
            state: 'detached',
          });

          await setValueForProperty({
            page,
            propertyName: dashboardSearchPropertyName,
            value: dashboardPropertyValue,
            propertyType: 'string',
            endpoint: EntityTypeEndpoint.Dashboard,
          });

          await page.reload();

          const customPropertiesTab = page.getByTestId('custom_properties');
          await customPropertiesTab.click();
          await page.locator('.ant-skeleton-active').waitFor({
            state: 'detached',
          });

          await expect(page.getByText(dashboardPropertyValue)).toBeVisible();
        });

        await test.step('Configure search settings for Dashboard custom property', async () => {
          await settingClick(page, GlobalSettingOptions.SEARCH_SETTINGS);

          const dashboardCard = page.getByTestId(
            'preferences.search-settings.dashboards'
          );
          await dashboardCard.click();

          await expect(page).toHaveURL(
            /settings\/preferences\/search-settings\/dashboards$/
          );

          await waitForAllLoadersToDisappear(page);
          await page.locator('[data-testid="loader"]').waitFor({
            state: 'detached',
          });

          await page.getByTestId('add-field-btn').click();

          const customPropertyOption = page.getByText(
            `extension.${dashboardSearchPropertyName}`,
            { exact: true }
          );
          await customPropertyOption.click();

          const fieldPanel = page.getByTestId(
            `field-configuration-panel-extension.${dashboardSearchPropertyName}`
          );
          await expect(fieldPanel).toBeVisible();

          const customPropertyBadge = fieldPanel.getByTestId(
            'custom-property-badge'
          );
          await expect(customPropertyBadge).toBeVisible();

          await fieldPanel.click();
          await setSliderValue(page, 'field-weight-slider', 20);

          const matchTypeSelect = page.getByTestId('match-type-select');
          await matchTypeSelect.click();
          await page
            .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
            .waitFor({ state: 'visible' });
          await page
            .locator('.ant-select-item-option[title="Standard Match"]')
            .click();

          const searchSettingsSaveResponse = page.waitForResponse(
            '/api/v1/system/settings'
          );

          await page.getByTestId('save-btn').click();

          await searchSettingsSaveResponse;

          await expect(
            page.getByTestId(
              `field-configuration-panel-extension.${dashboardSearchPropertyName}`
            )
          ).toBeVisible();
        });

        await test.step('Search for Dashboard using custom property value', async () => {
          await redirectToHomePage(page);

          const searchInput = page.getByTestId('searchBox');
          await searchInput.click();
          await searchInput.fill(dashboardPropertyValue);
          await searchInput.press('Enter');

          await page.getByTestId('dashboards-tab').click();

          await waitForAllLoadersToDisappear(page);

          const searchResults = page.getByTestId('search-results');
          const dashboardCard = searchResults.getByTestId(
            `table-data-card_${responseData.fullyQualifiedName ?? ''}`
          );
          await expect(dashboardCard).toBeVisible();
        });
      });

      test('Verify Dashboard custom property persists in search settings', async ({
        page,
      }) => {
        await settingClick(page, GlobalSettingOptions.SEARCH_SETTINGS);

        const dashboardCard = page.getByTestId(
          'preferences.search-settings.dashboards'
        );
        await dashboardCard.click();

        await waitForAllLoadersToDisappear(page);

        const customPropertyField = page.getByTestId(
          `field-configuration-panel-extension.${dashboardSearchPropertyName}`
        );
        await expect(customPropertyField).toBeVisible();
      });
    }

    // ── Pipeline-specific extra tests ──────────────────────────────────────

    if (key === 'entity_pipeline') {
      test('Create custom property and configure search for Pipeline', async ({
        page,
      }) => {
        test.slow(true);

        await test.step('Create and assign custom property to Pipeline', async () => {
          await settingClick(page, GlobalSettingOptions.PIPELINES, true);
          await addCustomPropertiesForEntity({
            page,
            propertyName: pipelineSearchPropertyName,
            customPropertyData: CUSTOM_PROPERTIES_ENTITIES['entity_pipeline'],
            customType: 'String',
          });

          await mainEntity.visitEntityPage(page);

          const customPropertyResponse = page.waitForResponse(
            '/api/v1/metadata/types/name/pipeline?fields=customProperties'
          );
          await page.getByTestId('custom_properties').click();
          await customPropertyResponse;

          await page.locator('.ant-skeleton-active').waitFor({
            state: 'detached',
          });

          await setValueForProperty({
            page,
            propertyName: pipelineSearchPropertyName,
            value: pipelinePropertyValue,
            propertyType: 'string',
            endpoint: EntityTypeEndpoint.Pipeline,
          });
        });

        await test.step('Configure search settings for Pipeline custom property', async () => {
          await settingClick(page, GlobalSettingOptions.SEARCH_SETTINGS);

          const pipelineCard = page.getByTestId(
            'preferences.search-settings.pipelines'
          );
          await pipelineCard.click();

          await expect(page).toHaveURL(
            /settings\/preferences\/search-settings\/pipelines$/
          );

          await waitForAllLoadersToDisappear(page);

          await page.getByTestId('add-field-btn').click();

          const customPropertyOption = page.getByText(
            `extension.${pipelineSearchPropertyName}`,
            { exact: true }
          );
          await customPropertyOption.click();

          const fieldPanel = page.getByTestId(
            `field-configuration-panel-extension.${pipelineSearchPropertyName}`
          );
          await expect(fieldPanel).toBeVisible();

          const customPropertyBadge = fieldPanel.getByTestId(
            'custom-property-badge'
          );
          await expect(customPropertyBadge).toBeVisible();

          await fieldPanel.click();
          await setSliderValue(page, 'field-weight-slider', 12);

          const matchTypeSelect = page.getByTestId('match-type-select');
          await matchTypeSelect.click();
          await page
            .locator('.ant-select-item-option[title="Phrase Match"]')
            .click();

          const searchSettingsSaveResponse = page.waitForResponse(
            '/api/v1/system/settings'
          );

          await page.getByTestId('save-btn').click();
          await searchSettingsSaveResponse;
        });

        await test.step('Search for Pipeline using custom property value', async () => {
          await redirectToHomePage(page);

          const searchInput = page.getByTestId('searchBox');
          await searchInput.click();
          await searchInput.clear();
          await searchInput.fill(pipelinePropertyValue);
          await searchInput.press('Enter');

          await page.getByTestId('pipelines-tab').click();

          await waitForAllLoadersToDisappear(page);

          const searchResults = page.getByTestId('search-results');
          const pipelineCard = searchResults.getByTestId(
            `table-data-card_${responseData.fullyQualifiedName ?? ''}`
          );
          await expect(pipelineCard).toBeVisible();
        });
      });

      test('Verify Pipeline custom property persists in search settings', async ({
        page,
      }) => {
        await settingClick(page, GlobalSettingOptions.SEARCH_SETTINGS);

        const pipelineCard = page.getByTestId(
          'preferences.search-settings.pipelines'
        );
        await pipelineCard.click();

        await waitForAllLoadersToDisappear(page);

        const customPropertyField = page.getByTestId(
          `field-configuration-panel-extension.${pipelineSearchPropertyName}`
        );
        await expect(customPropertyField).toBeVisible();
      });
    }

    // ── TableColumn-specific extra test ────────────────────────────────────

    if (key === 'entity_tableColumn') {
      test('Set & update column-level custom property', async ({ page }) => {
        // 5 minutes timeout for this test since it handles all cp types
        test.setTimeout(300000);

        const { apiContext, afterAction } = await getApiContext(page);

        const data = await createCustomPropertyForEntity(
          apiContext,
          EntityTypeEndpoint.TableColumn
        );
        const customPropertyValue = data.customProperties;
        const cleanupUser = data.cleanupUser;
        const users = data.userNames;

        const columnFqn =
          tableForColumnTest?.entityResponseData.columns[0]
            .fullyQualifiedName ?? '';
        const tableFqn =
          tableForColumnTest?.entityResponseData.fullyQualifiedName ?? '';

        const properties = Object.values(CustomPropertyTypeByName);

        for (const type of properties) {
          await test.step(`Set ${type} custom property on column and verify in UI`, async () => {
            await verifyTableColumnCustomPropertyPersistence({
              page,
              columnFqn,
              tableFqn,
              propertyName: customPropertyValue[type].property.name,
              propertyType: type,
              users,
            });
          });
        }

        await cleanupUser(apiContext);
        await afterAction();
      });
    }

    // ── Explore right-panel CP tab tests ───────────────────────────────────

    if (makeInstance !== null) {
      test(`Should display custom properties for ${entity.name} in right panel`, async ({
        page,
      }) => {
        const rightPanel = new RightPanelPageObject(page);
        const customProperties = new CustomPropertiesPageObject(rightPanel);
        rightPanel.setEntityConfig(mainEntity);
        // eslint-disable-next-line playwright/no-skipped-test -- conditional skip based on entity type
        test.skip(
          !rightPanel.isTabAvailable('custom property'),
          `Custom Property tab not available for ${entity.name}`
        );
        const fqn = getEntityFqn(mainEntity);
        await navigateToExploreAndSelectEntity({
          page,
          entityName: getEntityDisplayName(responseData),
          endpoint: mainEntity.endpoint,
          fullyQualifiedName: fqn,
          exploreTab: ENDPOINT_TO_EXPLORE_TAB_MAP[mainEntity.endpoint],
        });
        await rightPanel.waitForPanelVisible();
        await customProperties.navigateToCustomPropertiesTab();
        await customProperties.shouldShowCustomPropertiesContainer();
        const propertyName = Object.values(mainEntity.customPropertyValue)[0]
          ?.property?.name;
        if (propertyName) {
          await customProperties.shouldShowCustomProperty(propertyName);
        }
      });

      test(`Should search custom properties for ${entity.name} in right panel`, async ({
        page,
      }) => {
        const rightPanel = new RightPanelPageObject(page);
        const customProperties = new CustomPropertiesPageObject(rightPanel);
        rightPanel.setEntityConfig(mainEntity);
        // eslint-disable-next-line playwright/no-skipped-test -- conditional skip based on entity type
        test.skip(
          !rightPanel.isTabAvailable('custom property'),
          `Custom Property tab not available for ${entity.name}`
        );
        const fqn = getEntityFqn(mainEntity);
        await navigateToExploreAndSelectEntity({
          page,
          entityName: getEntityDisplayName(responseData),
          endpoint: mainEntity.endpoint,
          fullyQualifiedName: fqn,
          exploreTab: ENDPOINT_TO_EXPLORE_TAB_MAP[mainEntity.endpoint],
        });
        await rightPanel.waitForPanelVisible();
        await customProperties.navigateToCustomPropertiesTab();
        await customProperties.shouldShowCustomPropertiesContainer();
        const propertyName = Object.values(mainEntity.customPropertyValue)[0]
          ?.property?.name;
        if (propertyName) {
          await customProperties.searchCustomProperties(propertyName);
          await customProperties.shouldShowCustomProperty(propertyName);
        }
      });

      test(`Should clear search and show all properties for ${entity.name} in right panel`, async ({
        page,
      }) => {
        const rightPanel = new RightPanelPageObject(page);
        const customProperties = new CustomPropertiesPageObject(rightPanel);
        rightPanel.setEntityConfig(mainEntity);
        // eslint-disable-next-line playwright/no-skipped-test -- conditional skip based on entity type
        test.skip(
          !rightPanel.isTabAvailable('custom property'),
          `Custom Property tab not available for ${entity.name}`
        );
        const fqn = getEntityFqn(mainEntity);
        await navigateToExploreAndSelectEntity({
          page,
          entityName: getEntityDisplayName(responseData),
          endpoint: mainEntity.endpoint,
          fullyQualifiedName: fqn,
          exploreTab: ENDPOINT_TO_EXPLORE_TAB_MAP[mainEntity.endpoint],
        });
        await rightPanel.waitForPanelVisible();
        await customProperties.navigateToCustomPropertiesTab();
        await customProperties.shouldShowCustomPropertiesContainer();
        const propertyName = Object.values(mainEntity.customPropertyValue)[0]
          ?.property?.name;
        if (propertyName) {
          await customProperties.searchCustomProperties(propertyName);
          await customProperties.shouldShowCustomProperty(propertyName);
          await customProperties.clearSearch();
          await customProperties.shouldShowCustomPropertiesContainer();
        }
      });

      test(`Should verify property name is visible for ${entity.name} in right panel`, async ({
        page,
      }) => {
        const rightPanel = new RightPanelPageObject(page);
        const customProperties = new CustomPropertiesPageObject(rightPanel);
        rightPanel.setEntityConfig(mainEntity);
        // eslint-disable-next-line playwright/no-skipped-test -- conditional skip based on entity type
        test.skip(
          !rightPanel.isTabAvailable('custom property'),
          `Custom Property tab not available for ${entity.name}`
        );
        const fqn = getEntityFqn(mainEntity);
        await navigateToExploreAndSelectEntity({
          page,
          entityName: getEntityDisplayName(responseData),
          endpoint: mainEntity.endpoint,
          fullyQualifiedName: fqn,
          exploreTab: ENDPOINT_TO_EXPLORE_TAB_MAP[mainEntity.endpoint],
        });
        await rightPanel.waitForPanelVisible();
        await customProperties.navigateToCustomPropertiesTab();
        await customProperties.shouldShowCustomPropertiesContainer();
        const propertyName = Object.values(mainEntity.customPropertyValue)[0]
          ?.property?.name;
        if (propertyName) {
          await customProperties.verifyPropertyType(propertyName);
        }
      });
    }
  });
});
