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
import { Page } from '@playwright/test';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { expect, test as base } from '../../support/fixtures/base';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { selectOption } from '../../utils/advancedSearch';
import { redirectToHomePage } from '../../utils/common';
import {
  createArticleViaApi,
  deleteArticleByFqn,
} from '../../utils/ContextCenterUtil';
import {
  addCuratedAssetPlaceholder,
  CURATED_ASSETS_WIDGET_KEY,
  ENTITY_TYPE_CONFIGS,
  NameableEntityResponse,
  navigateToCustomizeLandingPage,
  removeAndCheckWidget,
  saveCustomizeLayoutPage,
  selectAssetTypes,
  setUserDefaultPersona,
  waitForLandingPageWidget,
} from '../../utils/customizeLandingPage';
import {
  getEntityDisplayName,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';

const adminUser = new UserClass();
const persona = new PersonaClass();
let knowledgePage: Awaited<ReturnType<typeof createArticleViaApi>>;

const entityTypeToTestEntity: Record<string, () => NameableEntityResponse> = {
  'API Collection': () => EntityDataClass.apiCollection1.entityResponseData,
  'API Endpoint': () => EntityDataClass.apiEndpoint1.entityResponseData,
  'Data Model': () => EntityDataClass.dashboardDataModel1.entityResponseData,
  'Data Product': () => EntityDataClass.dataProduct1.responseData,
  'Database Schema': () => EntityDataClass.databaseSchema.entityResponseData,
  'Glossary Term': () => EntityDataClass.glossaryTerm1.responseData,
  'Knowledge Page': () => knowledgePage,
  'ML Model': () => EntityDataClass.mlModel1.entityResponseData,
  'Search Index': () => EntityDataClass.searchIndex1.entityResponseData,
  'Stored Procedure': () => EntityDataClass.storedProcedure1.entityResponseData,
  Chart: () => EntityDataClass.chart1.entityResponseData,
  Container: () => EntityDataClass.container1.entityResponseData,
  Dashboard: () => EntityDataClass.dashboard1.entityResponseData,
  Database: () => EntityDataClass.database.entityResponseData,
  Metric: () => EntityDataClass.metric1.entityResponseData,
  Pipeline: () => EntityDataClass.pipeline1.entityResponseData,
  Table: () => EntityDataClass.table1.entityResponseData,
  Topic: () => EntityDataClass.topic1.entityResponseData,
};

const test = base.extend<{ page: Page }>({
  page: async ({ browser }, use) => {
    const page = await browser.newPage();
    await adminUser.login(page);
    await use(page);
    await page.close();
  },
});

base.beforeAll('Setup pre-requests', async ({ browser }) => {
  const { afterAction, apiContext } = await performAdminLogin(browser);

  // Create admin user and persona
  await adminUser.create(apiContext);
  await adminUser.setAdminRole(apiContext);
  await persona.create(apiContext, [adminUser.responseData.id]);
  knowledgePage = await createArticleViaApi(apiContext);

  await afterAction();
});

base.afterAll('Cleanup', async ({ browser }) => {
  const { afterAction, apiContext } = await performAdminLogin(browser);

  // Delete user and persona
  await adminUser.delete(apiContext);
  await persona.delete(apiContext);
  await deleteArticleByFqn(apiContext, knowledgePage.fullyQualifiedName);

  await afterAction();
});

test.describe('Curated Assets Widget', () => {
  test.beforeAll(async ({ page }) => {
    test.slow(true);

    await setUserDefaultPersona(page, persona.responseData.displayName);
    await redirectToHomePage(page);

    await page.getByTestId('sidebar-toggle').click();
  });

  for (const entityType of ENTITY_TYPE_CONFIGS) {
    test(`Test ${entityType.displayName} with display name filter`, async ({
      page,
    }) => {
      test.slow(true);

      const testEntity = entityTypeToTestEntity[entityType.name]?.();
      expect(testEntity, `Seeded entity for ${entityType.name}`).toBeDefined();

      // Add a new curated asset placeholder
      await addCuratedAssetPlaceholder({
        page,
        personaName: persona.responseData.name,
      });

      let curatedAssetsWidget = await waitForLandingPageWidget(
        page,
        CURATED_ASSETS_WIDGET_KEY
      );

      await curatedAssetsWidget.getByText('Create').click();

      // Update widget name
      await page.locator('[data-testid="title-input"]').clear();
      await page
        .locator('[data-testid="title-input"]')
        .fill(`${entityType.displayName} - Display Name Filter`);

      // Select specific entity type
      await selectAssetTypes(page, [entityType.name]);

      // Apply Display Name filter with the actual entity's display name
      const ruleLocator = page.getByTestId('query-builder-rule-0');

      await selectOption(
        page,
        ruleLocator.getByTestId('advanced-search-field-select'),
        'Display Name',
        true
      );

      await selectOption(
        page,
        ruleLocator.getByTestId('advanced-search-operator-select'),
        'Contains'
      );

      // entityTypeToTestEntity already yields the nameable response, so do not
      // unwrap it again -- toNameableEntity would read .entityResponseData off
      // something that has no such field and hand back undefined. The old 'pw'
      // fallback then searched for a prefix every seeded entity shares, which
      // passed by accident for most types and failed for Metric and Knowledge
      // Page. Assert the name instead of guessing at it.
      const entityDisplayName = getEntityDisplayName(testEntity);
      expect(
        entityDisplayName,
        `Seeded display name for ${entityType.name}`
      ).toBeTruthy();
      await ruleLocator
        .getByTestId('advanced-search-value')
        .locator('input')
        .clear();
      await ruleLocator
        .getByTestId('advanced-search-value')
        .locator('input')
        .fill(entityDisplayName);

      // Wait for save button to be enabled
      await expect(page.locator('[data-testid="saveButton"]')).toBeEnabled();

      const queryResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.url().includes('index=dataAsset') &&
          response.url().includes(`entityType%22:%22${entityType.index}`)
      );

      await page.locator('[data-testid="saveButton"]').click();
      await queryResponse;

      await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');

      curatedAssetsWidget = await waitForLandingPageWidget(
        page,
        CURATED_ASSETS_WIDGET_KEY
      );

      await expect(
        curatedAssetsWidget
          .locator('.entity-list-item-title')
          .filter({ hasText: entityDisplayName })
          .first()
      ).toBeVisible();

      await redirectToHomePage(page);

      await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');

      curatedAssetsWidget = await waitForLandingPageWidget(
        page,
        CURATED_ASSETS_WIDGET_KEY
      );

      await expect(
        curatedAssetsWidget.getByText(
          `${entityType.displayName} - Display Name Filter`
        )
      ).toBeVisible();

      await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');

      curatedAssetsWidget = await waitForLandingPageWidget(
        page,
        CURATED_ASSETS_WIDGET_KEY
      );

      await expect(
        curatedAssetsWidget
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
    });
  }

  test('Entity type "ALL" with basic filter', async ({ page }) => {
    test.slow(true);

    // Add curated asset widget placeholder
    await addCuratedAssetPlaceholder({
      page,
      personaName: persona.responseData.name,
    });

    let curatedAssetsWidget = await waitForLandingPageWidget(
      page,
      CURATED_ASSETS_WIDGET_KEY
    );

    await curatedAssetsWidget.getByText('Create').click();

    await expect(page.locator('[role="dialog"].ant-modal')).toBeVisible();

    // Configure widget with ALL entity types
    // Fill widget name
    await page
      .locator('[data-testid="title-input"]')
      .fill('All Entity Types - Initial');

    // Select ALL asset types
    await selectAssetTypes(page, 'all');

    // Add a simple filter condition
    const ruleLocator = page.getByTestId('query-builder-rule-0');
    await selectOption(
      page,
      ruleLocator.getByTestId('advanced-search-field-select'),
      'Deleted',
      true
    );

    await selectOption(
      page,
      ruleLocator.getByTestId('advanced-search-operator-select'),
      'Is'
    );

    await ruleLocator
      .getByTestId('advanced-search-value')
      .locator('label')
      .click();

    await expect(page.locator('[data-testid="saveButton"]')).toBeEnabled();

    const queryResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/query') &&
        response.url().includes('index=all') &&
        response.url().includes('true')
    );

    await page.locator('[data-testid="saveButton"]').click();
    await queryResponse;

    await waitForAllLoadersToDisappear(page);

    // Save and verify widget creation
    curatedAssetsWidget = await waitForLandingPageWidget(
      page,
      CURATED_ASSETS_WIDGET_KEY
    );

    await expect(
      curatedAssetsWidget.getByText('All Entity Types - Initial')
    ).toBeVisible();

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

    let curatedAssetsWidget = await waitForLandingPageWidget(
      page,
      CURATED_ASSETS_WIDGET_KEY
    );

    await curatedAssetsWidget.getByText('Create').click();

    // Configure widget name
    await page.locator('[data-testid="title-input"]').clear();
    await page
      .locator('[data-testid="title-input"]')
      .fill('Charts and Dashboards Bundle');

    // Select Chart and Dashboard
    await selectAssetTypes(page, ['Chart', 'Dashboard']);

    // Add OR conditions
    const ruleLocator1 = page.getByTestId('query-builder-rule-0');
    await selectOption(
      page,
      ruleLocator1.getByTestId('advanced-search-field-select'),
      'Owners',
      true
    );
    await selectOption(
      page,
      ruleLocator1.getByTestId('advanced-search-operator-select'),
      'Is Set'
    );

    await page.getByRole('button', { name: 'Add New Field' }).click();

    // Switch to OR condition (AND is selected by default, click OR button)
    await page
      .getByTestId('advanced-search-conjunction')
      .getByTestId('advanced-search-conjunction-or')
      .click();

    const ruleLocator2 = page.getByTestId('query-builder-rule-1');
    await selectOption(
      page,
      ruleLocator2.getByTestId('advanced-search-field-select'),
      'Deleted',
      true
    );
    await selectOption(
      page,
      ruleLocator2.getByTestId('advanced-search-operator-select'),
      'Is'
    );
    await ruleLocator2
      .getByTestId('advanced-search-value')
      .locator('label')
      .click();

    const queryResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/query') &&
        response.url().includes('index=dataAsset') &&
        response.url().includes('entityType%22:%22chart') &&
        response.url().includes('entityType%22:%22dashboard')
    );

    // Wait for save button to be enabled
    await expect(page.locator('[data-testid="saveButton"]')).toBeEnabled();

    await page.locator('[data-testid="saveButton"]').click();

    await queryResponse;

    await waitForLandingPageWidget(page, CURATED_ASSETS_WIDGET_KEY);

    // Wait for auto-save to complete before navigating

    await redirectToHomePage(page);

    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');

    curatedAssetsWidget = await waitForLandingPageWidget(
      page,
      CURATED_ASSETS_WIDGET_KEY
    );

    await expect(
      curatedAssetsWidget.locator('.entity-list-item-title').first()
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

    let curatedAssetsWidget = await waitForLandingPageWidget(
      page,
      CURATED_ASSETS_WIDGET_KEY
    );

    await curatedAssetsWidget.getByText('Create').click();

    // Configure widget name
    await page.locator('[data-testid="title-input"]').clear();
    await page
      .locator('[data-testid="title-input"]')
      .fill('Data Processing Assets');

    // Select Pipeline, Topic, and ML Model
    await selectAssetTypes(page, ['Pipeline', 'Topic', 'ML Model']);

    // Configure conditions
    const ruleLocator1 = page.getByTestId('query-builder-rule-0');
    await selectOption(
      page,
      ruleLocator1.getByTestId('advanced-search-field-select'),
      'Deleted',
      true
    );
    await selectOption(
      page,
      ruleLocator1.getByTestId('advanced-search-operator-select'),
      'Is'
    );
    await ruleLocator1
      .getByTestId('advanced-search-value')
      .locator('label')
      .click();

    await page.getByRole('button', { name: 'Add New Field' }).click();
    await page
      .getByTestId('advanced-search-conjunction')
      .getByTestId('advanced-search-conjunction-and')
      .click();

    const ruleLocator2 = page.getByTestId('query-builder-rule-1');
    await selectOption(
      page,
      ruleLocator2.getByTestId('advanced-search-field-select'),
      'Display Name',
      true
    );
    await selectOption(
      page,
      ruleLocator2.getByTestId('advanced-search-operator-select'),
      'Contains'
    );

    // Use a common prefix that should match test entities
    await ruleLocator2
      .getByTestId('advanced-search-value')
      .locator('input')
      .clear();
    await ruleLocator2
      .getByTestId('advanced-search-value')
      .locator('input')
      .fill('pw');

    const queryResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/query') &&
        response.url().includes('index=dataAsset') &&
        response.url().includes('entityType%22:%22pipeline') &&
        response.url().includes('entityType%22:%22topic') &&
        response.url().includes('entityType%22:%22mlmodel')
    );

    // Wait for save button to be enabled
    await expect(page.locator('[data-testid="saveButton"]')).toBeEnabled();

    await page.locator('[data-testid="saveButton"]').click();
    await queryResponse;

    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');

    // Verify on customize page: widget and at least one entity item
    curatedAssetsWidget = await waitForLandingPageWidget(
      page,
      CURATED_ASSETS_WIDGET_KEY
    );

    await expect(
      curatedAssetsWidget.locator('.entity-list-item-title').first()
    ).toBeVisible();

    // Wait for auto-save to complete before navigating

    // Navigate to landing page to verify widget
    await redirectToHomePage(page);

    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');

    curatedAssetsWidget = await waitForLandingPageWidget(
      page,
      CURATED_ASSETS_WIDGET_KEY
    );

    await expect(
      curatedAssetsWidget.locator('.entity-list-item-title').first()
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

    let curatedAssetsWidget = await waitForLandingPageWidget(
      page,
      CURATED_ASSETS_WIDGET_KEY
    );

    await curatedAssetsWidget.getByText('Create').click();

    // Configure widget name
    await page.locator('[data-testid="title-input"]').clear();
    await page
      .locator('[data-testid="title-input"]')
      .fill('Complex Nested Conditions');

    // Select all entity types
    await selectAssetTypes(page, 'all');

    // Create first group with OR conditions
    const ruleLocator1 = page.getByTestId('query-builder-rule-0');
    await selectOption(
      page,
      ruleLocator1.getByTestId('advanced-search-field-select'),
      'Owners',
      true
    );
    await selectOption(
      page,
      ruleLocator1.getByTestId('advanced-search-operator-select'),
      'Any in'
    );
    await selectOption(
      page,
      ruleLocator1.getByTestId('advanced-search-value'),
      'admin',
      true
    );

    await page.getByRole('button', { name: 'Add New Field' }).click();

    // Switch first group to OR condition (AND is default)
    await page
      .getByTestId('advanced-search-conjunction')
      .getByTestId('advanced-search-conjunction-or')
      .click();

    const ruleLocator2 = page.getByTestId('query-builder-rule-1');
    await selectOption(
      page,
      ruleLocator2.getByTestId('advanced-search-field-select'),
      'Description Status',
      true
    );
    await selectOption(
      page,
      ruleLocator2.getByTestId('advanced-search-operator-select'),
      'Is'
    );
    await selectOption(
      page,
      ruleLocator2.getByTestId('advanced-search-value'),
      'Incomplete'
    );

    // Add another condition
    await page.getByRole('button', { name: 'Add New Field' }).click();

    const ruleLocator3 = page.getByTestId('query-builder-rule-2');
    await selectOption(
      page,
      ruleLocator3.getByTestId('advanced-search-field-select'),
      'Tier',
      true
    );
    await selectOption(
      page,
      ruleLocator3.getByTestId('advanced-search-operator-select'),
      'Is Not'
    );
    await selectOption(
      page,
      ruleLocator3.getByTestId('advanced-search-value'),
      'Tier.Tier5',
      true
    );

    // Wait for save button to be enabled
    await expect(page.locator('[data-testid="saveButton"]')).toBeEnabled();

    const queryResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/query') &&
        response.url().includes('index=all') &&
        response.url().toLowerCase().includes('tier.tier5')
    );

    await page.locator('[data-testid="saveButton"]').click();
    await queryResponse;

    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');

    // Verify on customize page: widget and at least one entity item
    curatedAssetsWidget = await waitForLandingPageWidget(
      page,
      CURATED_ASSETS_WIDGET_KEY
    );

    await expect(
      curatedAssetsWidget.locator('.entity-list-item-title').first()
    ).toBeVisible();

    // Wait for auto-save to complete before navigating

    // Navigate to landing page to verify widget
    await redirectToHomePage(page);

    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');

    curatedAssetsWidget = await waitForLandingPageWidget(
      page,
      CURATED_ASSETS_WIDGET_KEY
    );

    await expect(
      curatedAssetsWidget.locator('.entity-list-item-title').first()
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

  test('Placeholder validation - widget not visible without configuration', async ({
    page,
  }) => {
    test.slow(true);

    await addCuratedAssetPlaceholder({
      page,
      personaName: persona.responseData.name,
    });

    // Save without creating any widget configuration
    await expect(page.locator('[data-testid="save-button"]')).toBeEnabled();

    await page.locator('[data-testid="save-button"]').click();

    await redirectToHomePage(page);

    // Verify placeholder is not visible when no widget is configured
    await expect(
      page.locator('[data-testid="KnowledgePanel.CuratedAssets"]')
    ).not.toBeVisible();
  });
});
