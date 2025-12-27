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
import { expect, test } from '@playwright/test';
import { CUSTOM_PROPERTIES_ENTITIES } from '../../constant/customProperty';
import { GlobalSettingOptions } from '../../constant/settings';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { PipelineClass } from '../../support/entity/PipelineClass';
import {
    createNewPage,
    redirectToHomePage,
    toastNotification,
    uuid,
} from '../../utils/common';
import {
    addCustomPropertiesForEntity,
    setValueForProperty,
} from '../../utils/customProperty';
import { setSliderValue } from '../../utils/searchSettingUtils';
import { settingClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe.serial('Custom Property Search Settings', () => {
  const dashboard = new DashboardClass();
  const pipeline = new PipelineClass();

  const dashboardPropertyName = `pwSearchCPDashboard${uuid()}`;
  const pipelinePropertyName = `pwSearchCPPipeline${uuid()}`;

  const dashboardPropertyValue = `EXECUTIVE_DASHBOARD_${uuid()}`;
  const pipelinePropertyValue = `ETL_PRODUCTION_${uuid()}`;

  test.beforeAll(
    'Setup entities and custom properties',
    async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      await dashboard.create(apiContext);
      await pipeline.create(apiContext);

      await afterAction();
    }
  );

  test.afterAll('Cleanup entities', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await dashboard.delete(apiContext);
    await pipeline.delete(apiContext);

    await afterAction();
  });

  test('Create custom properties and configure search for Dashboard', async ({
    page,
  }) => {
    test.slow(true);

    await redirectToHomePage(page);

    await test.step(
      'Create and assign custom property to Dashboard',
      async () => {
        await settingClick(page, GlobalSettingOptions.DASHBOARDS, true);

        await addCustomPropertiesForEntity({
          page,
          propertyName: dashboardPropertyName,
          customPropertyData: CUSTOM_PROPERTIES_ENTITIES['entity_dashboard'],
          customType: 'String',
        });

        await dashboard.visitEntityPage(page);

        const customPropertyResponse = page.waitForResponse(
          '/api/v1/metadata/types/name/dashboard?fields=customProperties'
        );
        await page.getByTestId('custom_properties').click();
        await customPropertyResponse;

        await page.waitForSelector('.ant-skeleton-active', {
          state: 'detached',
        });

        await setValueForProperty({
          page,
          propertyName: dashboardPropertyName,
          value: dashboardPropertyValue,
          propertyType: 'string',
          endpoint: EntityTypeEndpoint.Dashboard,
        });

        // Verify the custom property was saved by refreshing the page
        await page.reload();
        await page.waitForLoadState('domcontentloaded');

        const customPropertiesTab = page.getByTestId('custom_properties');
        await customPropertiesTab.click();
        await page.waitForSelector('.ant-skeleton-active', {
          state: 'detached',
        });

        const propertyValue = page.getByText(dashboardPropertyValue);

        await expect(propertyValue).toBeVisible();

        // Wait for the custom property value to be indexed in Elasticsearch
        // Dashboards may take longer to index than tables
        await page.waitForTimeout(10000);
      }
    );

    await test.step(
      'Configure search settings for Dashboard custom property',
      async () => {
        await settingClick(page, GlobalSettingOptions.SEARCH_SETTINGS);

        const dashboardCard = page.getByTestId(
          'preferences.search-settings.dashboards'
        );
        await dashboardCard.click();

        await expect(page).toHaveURL(
          /settings\/preferences\/search-settings\/dashboards$/
        );

        await page.waitForLoadState('domcontentloaded');
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await page.getByTestId('add-field-btn').click();

        // Wait for the dropdown menu to appear
        await page.waitForTimeout(500);

        // Click on the custom property field in the dropdown menu
        const customPropertyOption = page.getByText(
          `extension.${dashboardPropertyName}`,
          { exact: true }
        );
        await customPropertyOption.click();

        const fieldPanel = page.getByTestId(
          `field-configuration-panel-extension.${dashboardPropertyName}`
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
          .locator('.ant-select-item-option[title="Standard Match"]')
          .click();

        await page.getByTestId('save-btn').click();

        await toastNotification(page, /Search Settings updated successfully/);

        // Wait for search settings to be reloaded by the application
        // The search repository needs to refresh its configuration
        await page.waitForTimeout(15000);

        // Verify the field is still visible after save
        const savedFieldPanel = page.getByTestId(
          `field-configuration-panel-extension.${dashboardPropertyName}`
        );

        await expect(savedFieldPanel).toBeVisible();
      }
    );

    await test.step(
      'Search for Dashboard using custom property value',
      async () => {
        await redirectToHomePage(page);

        // First, verify the dashboard exists by searching for it by name
        await test.step('Verify dashboard is indexed', async () => {
          const searchInput = page.getByTestId('searchBox');
          await searchInput.click();
          await searchInput.clear();
          await searchInput.fill(dashboard.entityResponseData.name);
          await searchInput.press('Enter');

          await page.waitForLoadState('domcontentloaded');
          await page.waitForTimeout(2000);

          const searchResults = page.getByTestId('search-results');
          // Note: All entity search cards use 'table-data-card_' prefix regardless of entity type
          const dashboardCard = searchResults.getByTestId(
            `table-data-card_${dashboard.entityResponseData.fullyQualifiedName}`
          );

          await expect(dashboardCard).toBeVisible();
        });

        await test.step(
          'Search for Dashboard using custom property value',
          async () => {
            await redirectToHomePage(page);

            const searchInput = page.getByTestId('searchBox');
            await searchInput.click();
            await searchInput.fill(dashboardPropertyValue);
            await searchInput.press('Enter');

            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(2000);

            const searchResults = page.getByTestId('search-results');

            // Note: All entity search cards use 'table-data-card_' prefix regardless of entity type
            const dashboardCard = searchResults.getByTestId(
              `table-data-card_${dashboard.entityResponseData.fullyQualifiedName}`
            );

            await expect(dashboardCard).toBeVisible();
          }
        );
      }
    );
  });

  test('Create custom properties and configure search for Pipeline', async ({
    page,
  }) => {
    test.slow(true);

    await redirectToHomePage(page);

    await test.step(
      'Create and assign custom property to Pipeline',
      async () => {
        await settingClick(page, GlobalSettingOptions.PIPELINES, true);

        await addCustomPropertiesForEntity({
          page,
          propertyName: pipelinePropertyName,
          customPropertyData: CUSTOM_PROPERTIES_ENTITIES['entity_pipeline'],
          customType: 'String',
        });

        await pipeline.visitEntityPage(page);

        const customPropertyResponse = page.waitForResponse(
          '/api/v1/metadata/types/name/pipeline?fields=customProperties'
        );
        await page.getByTestId('custom_properties').click();
        await customPropertyResponse;

        await page.waitForSelector('.ant-skeleton-active', {
          state: 'detached',
        });

        await setValueForProperty({
          page,
          propertyName: pipelinePropertyName,
          value: pipelinePropertyValue,
          propertyType: 'string',
          endpoint: EntityTypeEndpoint.Pipeline,
        });
      }
    );

    await test.step(
      'Configure search settings for Pipeline custom property',
      async () => {
        await settingClick(page, GlobalSettingOptions.SEARCH_SETTINGS);

        const pipelineCard = page.getByTestId(
          'preferences.search-settings.pipelines'
        );
        await pipelineCard.click();

        await expect(page).toHaveURL(
          /settings\/preferences\/search-settings\/pipelines$/
        );

        await page.waitForLoadState('domcontentloaded');
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await page.getByTestId('add-field-btn').click();

        // Wait for the dropdown menu to appear
        await page.waitForTimeout(500);

        // Click on the custom property field in the dropdown menu
        const customPropertyOption = page.getByText(
          `extension.${pipelinePropertyName}`,
          { exact: true }
        );
        await customPropertyOption.click();

        const fieldPanel = page.getByTestId(
          `field-configuration-panel-extension.${pipelinePropertyName}`
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

        await page.getByTestId('save-btn').click();

        await toastNotification(page, /Search Settings updated successfully/);

        // Wait for search index to update with new settings
        await page.waitForTimeout(10000);
      }
    );

    await test.step(
      'Search for Pipeline using custom property value',
      async () => {
        await redirectToHomePage(page);

        const searchInput = page.getByTestId('searchBox');
        await searchInput.click();
        await searchInput.clear();
        await searchInput.fill(pipelinePropertyValue);
        await searchInput.press('Enter');

        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);

        const searchResults = page.getByTestId('search-results');
        // Note: All entity search cards use 'table-data-card_' prefix regardless of entity type
        const pipelineCard = searchResults.getByTestId(
          `table-data-card_${pipeline.entityResponseData.fullyQualifiedName}`
        );

        await expect(pipelineCard).toBeVisible();
      }
    );
  });

  test('Verify custom property fields are persisted in search settings', async ({
    page,
  }) => {
    await redirectToHomePage(page);

    await test.step('Verify Dashboard custom property persists', async () => {
      await settingClick(page, GlobalSettingOptions.SEARCH_SETTINGS);

      const dashboardCard = page.getByTestId(
        'preferences.search-settings.dashboards'
      );
      await dashboardCard.click();

      await page.waitForLoadState('domcontentloaded');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      const customPropertyField = page.getByTestId(
        `field-configuration-panel-extension.${dashboardPropertyName}`
      );

      await expect(customPropertyField).toBeVisible();
    });

    await test.step('Verify Pipeline custom property persists', async () => {
      await settingClick(page, GlobalSettingOptions.SEARCH_SETTINGS);

      const pipelineCard = page.getByTestId(
        'preferences.search-settings.pipelines'
      );
      await pipelineCard.click();

      await page.waitForLoadState('domcontentloaded');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      const customPropertyField = page.getByTestId(
        `field-configuration-panel-extension.${pipelinePropertyName}`
      );

      await expect(customPropertyField).toBeVisible();
    });
  });
});
