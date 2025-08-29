/*
 *  Copyright 2025 Collate.
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
import { expect, Page, test as base } from '@playwright/test';
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
import { MetricClass } from '../../support/entity/MetricClass';
import { MlModelClass } from '../../support/entity/MlModelClass';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { SearchIndexClass } from '../../support/entity/SearchIndexClass';
import { StoredProcedureClass } from '../../support/entity/StoredProcedureClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { selectOption } from '../../utils/advancedSearch';
import { redirectToHomePage, removeLandingBanner } from '../../utils/common';
import {
  addCuratedAssetPlaceholder,
  ENTITY_TYPE_CONFIGS,
  navigateToCustomizeLandingPage,
  removeAndCheckWidget,
  saveCustomizeLayoutPage,
  selectAssetTypes,
  setUserDefaultPersona,
} from '../../utils/customizeLandingPage';
import { getEntityDisplayName } from '../../utils/entity';

const adminUser = new UserClass();
const persona = new PersonaClass();

// Create helper entities for DataProduct and GlossaryTerm
const domain = new Domain();
const glossary = new Glossary();

// Create test entities - covering all entity types from CURATED_ASSETS_LIST
const testEntities = {
  apiCollection: new ApiCollectionClass(),
  apiEndpoint: new ApiEndpointClass(),
  chart: new ChartClass(),
  container: new ContainerClass(),
  dashboard: new DashboardClass(),
  dashboardDataModel: new DashboardDataModelClass(),
  database: new DatabaseClass(),
  databaseSchema: new DatabaseSchemaClass(),
  metric: new MetricClass(),
  mlModel: new MlModelClass(),
  pipeline: new PipelineClass(),
  searchIndex: new SearchIndexClass(),
  storedProcedure: new StoredProcedureClass(),
  table: new TableClass(),
  topic: new TopicClass(),
};

// These entities need special initialization
const dataProduct = new DataProduct([domain]);
const glossaryTerm = new GlossaryTerm(glossary);

// Define the type for test entities
type TestEntity =
  | TableClass
  | DashboardClass
  | PipelineClass
  | TopicClass
  | MlModelClass
  | ContainerClass
  | SearchIndexClass
  | ChartClass
  | StoredProcedureClass
  | DashboardDataModelClass
  | GlossaryTerm
  | MetricClass
  | DatabaseClass
  | DatabaseSchemaClass
  | ApiCollectionClass
  | ApiEndpointClass
  | DataProduct
  | null;

// Map entity types to their created test entities
const entityTypeToTestEntity: Record<string, TestEntity> = {
  Table: testEntities.table,
  Dashboard: testEntities.dashboard,
  Pipeline: testEntities.pipeline,
  Topic: testEntities.topic,
  'ML Model': testEntities.mlModel,
  Container: testEntities.container,
  'Search Index': testEntities.searchIndex,
  Chart: testEntities.chart,
  'Stored Procedure': testEntities.storedProcedure,
  'Data Model': testEntities.dashboardDataModel,
  'Glossary Term': glossaryTerm,
  Metric: testEntities.metric,
  Database: testEntities.database,
  'Database Schema': testEntities.databaseSchema,
  'API Collection': testEntities.apiCollection,
  'API Endpoint': testEntities.apiEndpoint,
  'Data Product': dataProduct,
  'Knowledge Page': null, // Knowledge Page entity does not have a display name field
};

function toNameableEntity(
  entity: TestEntity
): { name?: string; displayName?: string } | undefined {
  const holder = entity as unknown as {
    entity?: { name?: string; displayName?: string };
  };

  return holder?.entity;
}

const test = base.extend<{ page: Page }>({
  page: async ({ browser }, use) => {
    const page = await browser.newPage();
    await adminUser.login(page);
    await use(page);
    await page.close();
  },
});

base.beforeAll('Setup pre-requests', async ({ browser }) => {
  test.slow(true);

  const { afterAction, apiContext } = await performAdminLogin(browser);

  // Create admin user and persona
  await adminUser.create(apiContext);
  await adminUser.setAdminRole(apiContext);
  await persona.create(apiContext, [adminUser.responseData.id]);

  // Create helper entities first
  await domain.create(apiContext);
  await glossary.create(apiContext);

  // Create all test entities
  for (const entity of Object.values(testEntities)) {
    await entity.create(apiContext);
  }

  // Create entities with dependencies
  await dataProduct.create(apiContext);
  await glossaryTerm.create(apiContext);

  await afterAction();
});

base.afterAll('Cleanup', async ({ browser }) => {
  test.slow(true);

  const { afterAction, apiContext } = await performAdminLogin(browser);

  // Delete entities with dependencies first
  await glossaryTerm.delete(apiContext);
  await dataProduct.delete(apiContext);

  // Delete all test entities
  for (const entity of Object.values(testEntities)) {
    await entity.delete(apiContext);
  }

  // Delete helper entities
  await glossary.delete(apiContext);
  await domain.delete(apiContext);

  // Delete user and persona
  await adminUser.delete(apiContext);
  await persona.delete(apiContext);

  await afterAction();
});

test.describe('Curated Assets Widget - Comprehensive Tests', () => {
  test.beforeAll(async ({ page }) => {
    test.slow(true);

    await redirectToHomePage(page);
    await removeLandingBanner(page);

    await page.getByTestId('sidebar-toggle').click();
    await setUserDefaultPersona(page, persona.responseData.displayName);
  });

  test('Individual entity types with display name filter 1-6', async ({
    page,
  }) => {
    test.slow(true);

    for (const entityType of ENTITY_TYPE_CONFIGS.slice(0, 6)) {
      await test.step(
        `Test ${entityType.displayName} with display name filter`,
        async () => {
          // Get the corresponding test entity
          const testEntity = entityTypeToTestEntity[entityType.name];
          if (!testEntity) {
            return;
          }

          // Add a new curated asset placeholder
          await addCuratedAssetPlaceholder({
            page,
            personaName: persona.responseData.name,
          });

          await page
            .getByTestId('KnowledgePanel.CuratedAssets')
            .getByText('Create')
            .click();

          await page.waitForTimeout(1000);

          // Update widget name
          await page.locator('[data-testid="title-input"]').clear();
          await page
            .locator('[data-testid="title-input"]')
            .fill(`${entityType.displayName} - Display Name Filter`);

          // Select specific entity type
          await selectAssetTypes(page, [entityType.name]);

          // Apply Display Name filter with the actual entity's display name
          const ruleLocator = page.locator('.rule').nth(0);

          await selectOption(
            page,
            ruleLocator.locator('.rule--field .ant-select'),
            'Display Name'
          );

          await selectOption(
            page,
            ruleLocator.locator('.rule--operator .ant-select'),
            'Contains'
          );

          const entityDisplayName =
            getEntityDisplayName(toNameableEntity(testEntity)) || 'pw';
          await ruleLocator.locator('.rule--value input').clear();
          await ruleLocator
            .locator('.rule--value input')
            .fill(entityDisplayName);

          const queryResponse = page.waitForResponse(
            (response) =>
              response.url().includes('/api/v1/search/query') &&
              response.url().includes(`index=${entityType.index}`)
          );

          await page.locator('[data-testid="saveButton"]').click();
          await queryResponse;

          await page.waitForLoadState('networkidle');

          await expect(
            page
              .getByTestId('KnowledgePanel.CuratedAssets')
              .locator('.entity-list-item-title')
              .filter({ hasText: entityDisplayName })
          ).toBeVisible();

          await saveCustomizeLayoutPage(page);

          await redirectToHomePage(page);
          await removeLandingBanner(page);

          await page.waitForLoadState('networkidle');

          await expect(
            page.getByTestId('KnowledgePanel.CuratedAssets')
          ).toBeVisible();

          await expect(
            page
              .getByTestId('KnowledgePanel.CuratedAssets')
              .getByText(`${entityType.displayName} - Display Name Filter`)
          ).toBeVisible();

          await page.waitForLoadState('networkidle');

          await expect(
            page
              .getByTestId('KnowledgePanel.CuratedAssets')
              .locator('.entity-list-item-title')
              .filter({ hasText: entityDisplayName })
              .first()
          ).toBeVisible();

          await navigateToCustomizeLandingPage(page, {
            personaName: persona.responseData.name,
          });

          await removeAndCheckWidget(page, {
            widgetKey: 'KnowledgePanel.CuratedAssets',
          });

          await saveCustomizeLayoutPage(page);
        }
      );
    }
  });

  test('Individual entity types with display name filter 7-12', async ({
    page,
  }) => {
    test.slow(true);

    for (const entityType of ENTITY_TYPE_CONFIGS.slice(6, 12)) {
      await test.step(
        `Test ${entityType.displayName} with display name filter`,
        async () => {
          // Get the corresponding test entity
          const testEntity = entityTypeToTestEntity[entityType.name];
          if (!testEntity) {
            return;
          }

          // Add a new curated asset placeholder
          await addCuratedAssetPlaceholder({
            page,
            personaName: persona.responseData.name,
          });

          await page
            .getByTestId('KnowledgePanel.CuratedAssets')
            .getByText('Create')
            .click();

          await page.waitForTimeout(1000);

          // Update widget name
          await page.locator('[data-testid="title-input"]').clear();
          await page
            .locator('[data-testid="title-input"]')
            .fill(`${entityType.displayName} - Display Name Filter`);

          // Select specific entity type
          await selectAssetTypes(page, [entityType.name]);

          // Apply Display Name filter with the actual entity's display name
          const ruleLocator = page.locator('.rule').nth(0);

          await selectOption(
            page,
            ruleLocator.locator('.rule--field .ant-select'),
            'Display Name'
          );

          await selectOption(
            page,
            ruleLocator.locator('.rule--operator .ant-select'),
            'Contains'
          );

          const entityDisplayName =
            getEntityDisplayName(toNameableEntity(testEntity)) || 'pw';
          await ruleLocator.locator('.rule--value input').clear();
          await ruleLocator
            .locator('.rule--value input')
            .fill(entityDisplayName);

          const queryResponse = page.waitForResponse(
            (response) =>
              response.url().includes('/api/v1/search/query') &&
              response.url().includes(`index=${entityType.index}`)
          );

          await page.waitForLoadState('networkidle');

          await page.locator('[data-testid="saveButton"]').click();
          await queryResponse;

          await page.waitForLoadState('networkidle');

          await expect(
            page
              .getByTestId('KnowledgePanel.CuratedAssets')
              .locator('.entity-list-item-title')
              .filter({ hasText: entityDisplayName })
              .first()
          ).toBeVisible();

          await saveCustomizeLayoutPage(page);

          await redirectToHomePage(page);
          await removeLandingBanner(page);

          await page.waitForLoadState('networkidle');

          await expect(
            page.getByTestId('KnowledgePanel.CuratedAssets')
          ).toBeVisible();

          await expect(
            page
              .getByTestId('KnowledgePanel.CuratedAssets')
              .getByText(`${entityType.displayName} - Display Name Filter`)
          ).toBeVisible();

          await page.waitForLoadState('networkidle');

          await expect(
            page
              .getByTestId('KnowledgePanel.CuratedAssets')
              .locator('.entity-list-item-title')
              .filter({ hasText: entityDisplayName })
              .first()
          ).toBeVisible();

          await navigateToCustomizeLandingPage(page, {
            personaName: persona.responseData.name,
          });

          await removeAndCheckWidget(page, {
            widgetKey: 'KnowledgePanel.CuratedAssets',
          });

          await saveCustomizeLayoutPage(page);
        }
      );
    }
  });

  test('Individual entity types with display name filter 13-18', async ({
    page,
  }) => {
    test.slow(true);

    for (const entityType of ENTITY_TYPE_CONFIGS.slice(12)) {
      await test.step(
        `Test ${entityType.displayName} with display name filter`,
        async () => {
          const testEntity = entityTypeToTestEntity[entityType.name];
          if (!testEntity) {
            return;
          }

          await addCuratedAssetPlaceholder({
            page,
            personaName: persona.responseData.name,
          });

          await page
            .getByTestId('KnowledgePanel.CuratedAssets')
            .getByText('Create')
            .click();

          await page.waitForTimeout(1000);

          await page.locator('[data-testid="title-input"]').clear();
          await page
            .locator('[data-testid="title-input"]')
            .fill(`${entityType.displayName} - Display Name Filter`);

          await selectAssetTypes(page, [entityType.name]);

          const ruleLocator = page.locator('.rule').nth(0);

          await selectOption(
            page,
            ruleLocator.locator('.rule--field .ant-select'),
            'Display Name'
          );

          await selectOption(
            page,
            ruleLocator.locator('.rule--operator .ant-select'),
            'Contains'
          );
          // Use the actual display name from the created entity
          const entityDisplayName =
            getEntityDisplayName(toNameableEntity(testEntity)) || 'pw';
          await ruleLocator.locator('.rule--value input').clear();
          await ruleLocator
            .locator('.rule--value input')
            .fill(entityDisplayName);

          const queryResponse = page.waitForResponse(
            (response) =>
              response.url().includes('/api/v1/search/query') &&
              response.url().includes(`index=${entityType.index}`)
          );

          await page.waitForLoadState('networkidle');

          await page.locator('[data-testid="saveButton"]').click();
          await queryResponse;

          await page.waitForLoadState('networkidle');

          // Verify the widget shows the filtered entity in the title
          await expect(
            page
              .getByTestId('KnowledgePanel.CuratedAssets')
              .locator('.entity-list-item-title')
              .filter({ hasText: entityDisplayName })
              .first()
          ).toBeVisible();

          await saveCustomizeLayoutPage(page);

          // Navigate home to verify the entity appears in the widget
          await redirectToHomePage(page);
          await removeLandingBanner(page);

          // Wait for widget to load
          await page.waitForLoadState('networkidle');

          // Verify the curated asset widget shows our entity
          await expect(
            page.getByTestId('KnowledgePanel.CuratedAssets')
          ).toBeVisible();

          // Verify the widget title
          await expect(
            page
              .getByTestId('KnowledgePanel.CuratedAssets')
              .getByText(`${entityType.displayName} - Display Name Filter`)
          ).toBeVisible();

          // Wait for widgets data to load
          await page.waitForLoadState('networkidle');

          // Verify the entity appears in the widget title
          await expect(
            page
              .getByTestId('KnowledgePanel.CuratedAssets')
              .locator('.entity-list-item-title')
              .filter({ hasText: entityDisplayName })
              .first()
          ).toBeVisible();

          //   Go back to customize page for next iteration
          await navigateToCustomizeLandingPage(page, {
            personaName: persona.responseData.name,
          });

          //   Delete the curated asset widget to reset for next entity type
          await removeAndCheckWidget(page, {
            widgetKey: 'KnowledgePanel.CuratedAssets',
          });

          await saveCustomizeLayoutPage(page);
        }
      );
    }
  });

  test('Entity type "ALL" with basic filter', async ({ page }) => {
    test.slow(true);

    // Add curated asset widget placeholder
    await addCuratedAssetPlaceholder({
      page,
      personaName: persona.responseData.name,
    });

    await page
      .getByTestId('KnowledgePanel.CuratedAssets')
      .getByText('Create')
      .click();

    await page.waitForTimeout(1000);

    await expect(page.locator('[role="dialog"].ant-modal')).toBeVisible();

    // Configure widget with ALL entity types
    // Fill widget name
    await page
      .locator('[data-testid="title-input"]')
      .fill('All Entity Types - Initial');

    // Select ALL asset types
    await selectAssetTypes(page, 'all');

    // Add a simple filter condition
    const ruleLocator = page.locator('.rule').nth(0);
    await selectOption(
      page,
      ruleLocator.locator('.rule--field .ant-select'),
      'Deleted'
    );

    await selectOption(
      page,
      ruleLocator.locator('.rule--operator .ant-select'),
      '=='
    );

    await ruleLocator
      .locator('.rule--value .rule--widget--BOOLEAN .ant-switch')
      .click();

    await expect(page.locator('[data-testid="saveButton"]')).toBeEnabled();

    const queryResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/query') &&
        response.url().includes('index=all')
    );

    await page.waitForLoadState('networkidle');

    await page.locator('[data-testid="saveButton"]').click();
    await queryResponse;

    await page.waitForLoadState('networkidle');

    // Save and verify widget creation
    await expect(
      page.locator('[data-testid="KnowledgePanel.CuratedAssets"]')
    ).toBeVisible();

    await expect(
      page
        .getByTestId('KnowledgePanel.CuratedAssets')
        .getByText('All Entity Types - Initial')
    ).toBeVisible();

    await saveCustomizeLayoutPage(page);

    // Delete the widget at the end
    await removeAndCheckWidget(page, {
      widgetKey: 'KnowledgePanel.CuratedAssets',
    });

    await saveCustomizeLayoutPage(page);
  });

  test('Multiple entity types with OR conditions', async ({ page }) => {
    test.slow(true);

    // Create a new curated asset widget
    await addCuratedAssetPlaceholder({
      page,
      personaName: persona.responseData.name,
    });

    await page
      .getByTestId('KnowledgePanel.CuratedAssets')
      .getByText('Create')
      .click();

    await page.waitForTimeout(1000);

    // Configure widget name
    await page.locator('[data-testid="title-input"]').clear();
    await page
      .locator('[data-testid="title-input"]')
      .fill('Charts and Dashboards Bundle');

    // Select Chart and Dashboard
    await selectAssetTypes(page, ['Chart', 'Dashboard']);

    // Add OR conditions
    const ruleLocator1 = page.locator('.rule').nth(0);
    await selectOption(
      page,
      ruleLocator1.locator('.rule--field .ant-select'),
      'Owners'
    );
    await selectOption(
      page,
      ruleLocator1.locator('.rule--operator .ant-select'),
      'Is not null'
    );

    await page.getByRole('button', { name: 'Add Condition' }).click();

    // Switch to OR condition (AND is selected by default, click OR button)
    await page.locator('.group--conjunctions button:has-text("OR")').click();

    const ruleLocator2 = page.locator('.rule').nth(1);
    await selectOption(
      page,
      ruleLocator2.locator('.rule--field .ant-select'),
      'Tier'
    );
    await selectOption(
      page,
      ruleLocator2.locator('.rule--operator .ant-select'),
      '=='
    );
    await selectOption(
      page,
      ruleLocator2.locator('.rule--value .ant-select'),
      'Tier.Tier1'
    );

    const queryResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/query') &&
        response.url().includes('index=chart,dashboard')
    );

    await page.waitForLoadState('networkidle');

    await page.locator('[data-testid="saveButton"]').click();
    await queryResponse;

    // Verify on customize page: widget and at least one entity item
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByTestId('KnowledgePanel.CuratedAssets')
    ).toBeVisible();

    await page.waitForLoadState('networkidle');

    await expect(
      page
        .getByTestId('KnowledgePanel.CuratedAssets')
        .locator('.entity-list-item-title')
        .first()
    ).toBeVisible();

    // Save and verify on landing page
    await saveCustomizeLayoutPage(page);
    await redirectToHomePage(page);
    await removeLandingBanner(page);

    await page.waitForLoadState('networkidle');

    await expect(
      page.getByTestId('KnowledgePanel.CuratedAssets')
    ).toBeVisible();

    await page.waitForLoadState('networkidle');

    await expect(
      page
        .getByTestId('KnowledgePanel.CuratedAssets')
        .locator('.entity-list-item-title')
        .first()
    ).toBeVisible();

    // Navigate back, delete the widget and save at the end
    await navigateToCustomizeLandingPage(page, {
      personaName: persona.responseData.name,
    });
    await removeAndCheckWidget(page, {
      widgetKey: 'KnowledgePanel.CuratedAssets',
    });
    await saveCustomizeLayoutPage(page);
  });

  test('Multiple entity types with AND conditions', async ({ page }) => {
    test.slow(true);

    // Create a new curated asset widget
    await addCuratedAssetPlaceholder({
      page,
      personaName: persona.responseData.name,
    });

    await page
      .getByTestId('KnowledgePanel.CuratedAssets')
      .getByText('Create')
      .click();

    await page.waitForTimeout(1000);

    // Configure widget name
    await page.locator('[data-testid="title-input"]').clear();
    await page
      .locator('[data-testid="title-input"]')
      .fill('Data Processing Assets');

    // Select Pipeline, Topic, and ML Model
    await selectAssetTypes(page, ['Pipeline', 'Topic', 'ML Model']);

    // Configure conditions
    const ruleLocator1 = page.locator('.rule').nth(0);
    await selectOption(
      page,
      ruleLocator1.locator('.rule--field .ant-select'),
      'Description'
    );
    await selectOption(
      page,
      ruleLocator1.locator('.rule--operator .ant-select'),
      '=='
    );
    await selectOption(
      page,
      ruleLocator1.locator('.rule--value .ant-select'),
      'Incomplete'
    );

    await page.getByRole('button', { name: 'Add Condition' }).click();
    await page.locator('.group--conjunctions button:has-text("AND")').click();

    const ruleLocator2 = page.locator('.rule').nth(1);
    await selectOption(
      page,
      ruleLocator2.locator('.rule--field .ant-select'),
      'Display Name'
    );
    await selectOption(
      page,
      ruleLocator2.locator('.rule--operator .ant-select'),
      'Contains'
    );

    const entityDisplayName =
      getEntityDisplayName(toNameableEntity(entityTypeToTestEntity.Pipeline)) ||
      'pw';
    await ruleLocator2.locator('.rule--value input').clear();
    await ruleLocator2.locator('.rule--value input').fill(entityDisplayName);

    const queryResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/query') &&
        response.url().includes('index=pipeline,topic,mlmodel')
    );

    await page.waitForLoadState('networkidle');

    await page.locator('[data-testid="saveButton"]').click();
    await queryResponse;

    // Verify on customize page
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByTestId('KnowledgePanel.CuratedAssets')
    ).toBeVisible();

    await page.waitForLoadState('networkidle');

    await expect(
      page
        .getByTestId('KnowledgePanel.CuratedAssets')
        .locator('.entity-list-item-title')
        .first()
    ).toBeVisible();

    // Save and verify on landing page
    await saveCustomizeLayoutPage(page);
    await redirectToHomePage(page);
    await removeLandingBanner(page);

    await page.waitForLoadState('networkidle');

    await expect(
      page.getByTestId('KnowledgePanel.CuratedAssets')
    ).toBeVisible();

    await page.waitForLoadState('networkidle');

    await expect(
      page
        .getByTestId('KnowledgePanel.CuratedAssets')
        .locator('.entity-list-item-title')
        .first()
    ).toBeVisible();

    // Navigate back, delete the widget and save at the end
    await navigateToCustomizeLandingPage(page, {
      personaName: persona.responseData.name,
    });
    await removeAndCheckWidget(page, {
      widgetKey: 'KnowledgePanel.CuratedAssets',
    });
    await saveCustomizeLayoutPage(page);
  });

  test('Complex nested groups', async ({ page }) => {
    test.slow(true);

    // Create a new curated asset widget
    await addCuratedAssetPlaceholder({
      page,
      personaName: persona.responseData.name,
    });

    await page
      .getByTestId('KnowledgePanel.CuratedAssets')
      .getByText('Create')
      .click();

    await page.waitForTimeout(1000);

    // Configure widget name
    await page.locator('[data-testid="title-input"]').clear();
    await page
      .locator('[data-testid="title-input"]')
      .fill('Complex Nested Conditions');

    // Select all entity types
    await selectAssetTypes(page, 'all');

    // Create first group with OR conditions
    const ruleLocator1 = page.locator('.rule').nth(0);
    await selectOption(
      page,
      ruleLocator1.locator('.rule--field .ant-select'),
      'Owners'
    );
    await selectOption(
      page,
      ruleLocator1.locator('.rule--operator .ant-select'),
      'Any in'
    );
    await selectOption(
      page,
      ruleLocator1.locator('.rule--value .ant-select'),
      'admin'
    );

    await page.getByRole('button', { name: 'Add Condition' }).click();

    // Switch first group to OR condition (AND is default)
    await page.locator('.group--conjunctions button:has-text("OR")').click();

    const ruleLocator2 = page.locator('.rule').nth(1);
    await selectOption(
      page,
      ruleLocator2.locator('.rule--field .ant-select'),
      'Description'
    );
    await selectOption(
      page,
      ruleLocator2.locator('.rule--operator .ant-select'),
      '=='
    );
    await selectOption(
      page,
      ruleLocator2.locator('.rule--value .ant-select'),
      'Incomplete'
    );
    await ruleLocator2.locator('.rule--value input').fill('production');

    // Add another condition
    await page.getByRole('button', { name: 'Add Condition' }).click();

    const ruleLocator3 = page.locator('.rule').nth(2);
    await selectOption(
      page,
      ruleLocator3.locator('.rule--field .ant-select'),
      'Tier'
    );
    await selectOption(
      page,
      ruleLocator3.locator('.rule--operator .ant-select'),
      '!='
    );
    await selectOption(
      page,
      ruleLocator3.locator('.rule--value .ant-select'),
      'Tier.Tier5'
    );

    const queryResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/query') &&
        response.url().includes('index=all')
    );

    await page.waitForLoadState('networkidle');

    await page.locator('[data-testid="saveButton"]').click();
    await queryResponse;

    // Verify on customize page
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByTestId('KnowledgePanel.CuratedAssets')
    ).toBeVisible();

    await page.waitForLoadState('networkidle');

    await expect(
      page
        .getByTestId('KnowledgePanel.CuratedAssets')
        .locator('.entity-list-item-title')
        .first()
    ).toBeVisible();

    // Save and verify on landing page
    await saveCustomizeLayoutPage(page);
    await redirectToHomePage(page);
    await removeLandingBanner(page);

    await page.waitForLoadState('networkidle');

    await expect(
      page.getByTestId('KnowledgePanel.CuratedAssets')
    ).toBeVisible();

    await page.waitForLoadState('networkidle');

    await expect(
      page
        .getByTestId('KnowledgePanel.CuratedAssets')
        .locator('.entity-list-item-title')
        .first()
    ).toBeVisible();

    // Navigate back, delete the widget and save at the end
    await navigateToCustomizeLandingPage(page, {
      personaName: persona.responseData.name,
    });
    await removeAndCheckWidget(page, {
      widgetKey: 'KnowledgePanel.CuratedAssets',
    });
    await saveCustomizeLayoutPage(page);
  });
});

test('Placeholder validation - widget not visible without configuration', async ({
  page,
}) => {
  test.slow(true);

  await addCuratedAssetPlaceholder({
    page,
    personaName: persona.responseData.name,
  });

  // Save without creating any widget configuration
  await page.locator('[data-testid="save-button"]').click();
  await page.waitForLoadState('load');

  await redirectToHomePage(page);
  await removeLandingBanner(page);

  // Verify placeholder is not visible when no widget is configured
  await expect(
    page.locator('[data-testid="KnowledgePanel.CuratedAssets"]')
  ).not.toBeVisible();
});
