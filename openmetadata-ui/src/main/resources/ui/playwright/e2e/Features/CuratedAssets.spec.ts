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
import { test as base, expect, Page } from '@playwright/test';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
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
import {
  getEntityDisplayName,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';

const adminUser = new UserClass();
const persona = new PersonaClass();

// Define the type for test entities using EntityDataClass properties
type TestEntity = typeof EntityDataClass[keyof typeof EntityDataClass];

// Map entity types to their EntityDataClass properties
const entityTypeToTestEntity: Record<string, TestEntity> = {
  'API Collection': EntityDataClass.apiCollection1,
  'API Endpoint': EntityDataClass.apiEndpoint1,
  'Data Model': EntityDataClass.dashboardDataModel1,
  'Data Product': EntityDataClass.dataProduct1,
  'Database Schema': EntityDataClass.databaseSchema,
  'Glossary Term': EntityDataClass.glossaryTerm1,
  'ML Model': EntityDataClass.mlModel1,
  'Search Index': EntityDataClass.searchIndex1,
  'Stored Procedure': EntityDataClass.storedProcedure1,
  Chart: EntityDataClass.chart1,
  Container: EntityDataClass.container1,
  Dashboard: EntityDataClass.dashboard1,
  Database: EntityDataClass.database,
  Metric: EntityDataClass.metric1,
  Pipeline: EntityDataClass.pipeline1,
  Table: EntityDataClass.table1,
  Topic: EntityDataClass.topic1,
};

function toNameableEntity(
  entity: TestEntity
): { name?: string; displayName?: string } | undefined {
  if (!entity) {
    return undefined;
  }
  const holder = entity as unknown as {
    entityResponseData?: { name?: string; displayName?: string };
  };

  return holder?.entityResponseData;
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

  await afterAction();
});

base.afterAll('Cleanup', async ({ browser }) => {
  test.slow(true);

  const { afterAction, apiContext } = await performAdminLogin(browser);

  // Delete user and persona
  await adminUser.delete(apiContext);
  await persona.delete(apiContext);

  await afterAction();
});

test.describe('Curated Assets Widget', () => {
  test.beforeAll(async ({ page }) => {
    test.slow(true);

    await setUserDefaultPersona(page, persona.responseData.displayName);
    await redirectToHomePage(page);
    await removeLandingBanner(page);

    await page.getByTestId('sidebar-toggle').click();
  });

  for (const entityType of ENTITY_TYPE_CONFIGS) {
    test(`Test ${entityType.displayName} with display name filter`, async ({
      page,
    }) => {
      test.slow(true);

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
        'Display Name',
        true
      );

      await selectOption(
        page,
        ruleLocator.locator('.rule--operator .ant-select'),
        'Contains'
      );

      const entityDisplayName =
        getEntityDisplayName(toNameableEntity(testEntity)) || 'pw';
      await ruleLocator.locator('.rule--value input').clear();
      await ruleLocator.locator('.rule--value input').fill(entityDisplayName);

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

      await page.waitForLoadState('networkidle');

      await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');

      await expect(
        page
          .getByTestId('KnowledgePanel.CuratedAssets')
          .locator('.entity-list-item-title')
          .filter({ hasText: entityDisplayName })
          .first()
      ).toBeVisible();

      await redirectToHomePage(page);
      await removeLandingBanner(page);

      await page.waitForLoadState('networkidle');

      await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');

      await expect(
        page.getByTestId('KnowledgePanel.CuratedAssets')
      ).toBeVisible();

      await expect(
        page
          .getByTestId('KnowledgePanel.CuratedAssets')
          .getByText(`${entityType.displayName} - Display Name Filter`)
      ).toBeVisible();

      await page.waitForLoadState('networkidle');

      await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');

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
    });
  }

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
      'Deleted',
      true
    );

    await selectOption(
      page,
      ruleLocator.locator('.rule--operator .ant-select'),
      'Is'
    );

    await ruleLocator
      .locator('.rule--value .rule--widget--BOOLEAN .ant-switch')
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

    await page.waitForLoadState('networkidle');

    await waitForAllLoadersToDisappear(page);

    // Save and verify widget creation
    await expect(
      page.locator('[data-testid="KnowledgePanel.CuratedAssets"]')
    ).toBeVisible();

    await page.waitForLoadState('networkidle');

    await expect(
      page
        .getByTestId('KnowledgePanel.CuratedAssets')
        .getByText('All Entity Types - Initial')
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

    await page
      .getByTestId('KnowledgePanel.CuratedAssets')
      .getByText('Create')
      .click();

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
      'Owners',
      true
    );
    await selectOption(
      page,
      ruleLocator1.locator('.rule--operator .ant-select'),
      'Is Set'
    );

    await page.getByRole('button', { name: 'Add Condition' }).click();

    // Switch to OR condition (AND is selected by default, click OR button)
    await page.locator('.group--conjunctions button:has-text("OR")').click();

    const ruleLocator2 = page.locator('.rule').nth(1);
    await selectOption(
      page,
      ruleLocator2.locator('.rule--field .ant-select'),
      'Deleted',
      true
    );
    await selectOption(
      page,
      ruleLocator2.locator('.rule--operator .ant-select'),
      'Is'
    );
    await ruleLocator2
      .locator('.rule--value .rule--widget--BOOLEAN .ant-switch')
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

    await expect(
      page.getByTestId('KnowledgePanel.CuratedAssets')
    ).toBeVisible();

    // Wait for auto-save to complete before navigating
    await page.waitForLoadState('networkidle');

    await redirectToHomePage(page);
    await removeLandingBanner(page);

    await page.waitForLoadState('networkidle');

    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');

    await expect(
      page.getByTestId('KnowledgePanel.CuratedAssets')
    ).toBeVisible();

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
      'Deleted',
      true
    );
    await selectOption(
      page,
      ruleLocator1.locator('.rule--operator .ant-select'),
      'Is'
    );
    await ruleLocator1
      .locator('.rule--value .rule--widget--BOOLEAN .ant-switch')
      .click();

    await page.getByRole('button', { name: 'Add Condition' }).click();
    await page.locator('.group--conjunctions button:has-text("AND")').click();

    const ruleLocator2 = page.locator('.rule').nth(1);
    await selectOption(
      page,
      ruleLocator2.locator('.rule--field .ant-select'),
      'Display Name',
      true
    );
    await selectOption(
      page,
      ruleLocator2.locator('.rule--operator .ant-select'),
      'Contains'
    );

    // Use a common prefix that should match test entities
    await ruleLocator2.locator('.rule--value input').clear();
    await ruleLocator2.locator('.rule--value input').fill('pw');

    await page.waitForLoadState('networkidle');

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

    await page.waitForLoadState('networkidle');

    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');

    // Verify on customize page: widget and at least one entity item
    await expect(
      page.getByTestId('KnowledgePanel.CuratedAssets')
    ).toBeVisible();

    await expect(
      page
        .getByTestId('KnowledgePanel.CuratedAssets')
        .locator('.entity-list-item-title')
        .first()
    ).toBeVisible();

    // Wait for auto-save to complete before navigating
    await page.waitForLoadState('networkidle');

    // Navigate to landing page to verify widget
    await redirectToHomePage(page);
    await removeLandingBanner(page);

    await page.waitForLoadState('networkidle');

    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');

    await expect(
      page.getByTestId('KnowledgePanel.CuratedAssets')
    ).toBeVisible();

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
      'Owners',
      true
    );
    await selectOption(
      page,
      ruleLocator1.locator('.rule--operator .ant-select'),
      'Any in'
    );
    await selectOption(
      page,
      ruleLocator1.locator('.rule--value .ant-select'),
      'admin',
      true
    );

    await page.getByRole('button', { name: 'Add Condition' }).click();

    // Switch first group to OR condition (AND is default)
    await page.locator('.group--conjunctions button:has-text("OR")').click();

    const ruleLocator2 = page.locator('.rule').nth(1);
    await selectOption(
      page,
      ruleLocator2.locator('.rule--field .ant-select'),
      'Description',
      true
    );
    await selectOption(
      page,
      ruleLocator2.locator('.rule--operator .ant-select'),
      'Is'
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
      'Tier',
      true
    );
    await selectOption(
      page,
      ruleLocator3.locator('.rule--operator .ant-select'),
      'Is Not'
    );
    await selectOption(
      page,
      ruleLocator3.locator('.rule--value .ant-select'),
      'tier.tier5',
      true
    );

    // Wait for save button to be enabled
    await expect(page.locator('[data-testid="saveButton"]')).toBeEnabled();

    const queryResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/query') &&
        response.url().includes('index=all') &&
        response.url().includes('tier.tier5')
    );

    await page.locator('[data-testid="saveButton"]').click();
    await queryResponse;

    await page.waitForLoadState('networkidle');

    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');

    // Verify on customize page: widget and at least one entity item
    await expect(
      page.getByTestId('KnowledgePanel.CuratedAssets')
    ).toBeVisible();

    await expect(
      page
        .getByTestId('KnowledgePanel.CuratedAssets')
        .locator('.entity-list-item-title')
        .first()
    ).toBeVisible();

    // Wait for auto-save to complete before navigating
    await page.waitForLoadState('networkidle');

    // Navigate to landing page to verify widget
    await redirectToHomePage(page);
    await removeLandingBanner(page);

    await page.waitForLoadState('networkidle');

    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');

    await expect(
      page.getByTestId('KnowledgePanel.CuratedAssets')
    ).toBeVisible();

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
    await page.waitForLoadState('networkidle');

    await redirectToHomePage(page);
    await removeLandingBanner(page);

    // Verify placeholder is not visible when no widget is configured
    await expect(
      page.locator('[data-testid="KnowledgePanel.CuratedAssets"]')
    ).not.toBeVisible();
  });
});
