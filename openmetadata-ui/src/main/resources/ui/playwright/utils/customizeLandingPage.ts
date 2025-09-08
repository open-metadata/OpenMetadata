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
import { expect, Page } from '@playwright/test';
import { GlobalSettingOptions } from '../constant/settings';
import {
  redirectToHomePage,
  toastNotification,
  visitOwnProfilePage,
} from './common';
import { waitForAllLoadersToDisappear } from './entity';
import { settingClick } from './sidebar';

// Entity types mapping from CURATED_ASSETS_LIST
export const ENTITY_TYPE_CONFIGS = [
  {
    name: 'Table',
    index: 'table',
    displayName: 'Tables',
    searchTerm: 'Table',
  },
  {
    name: 'Dashboard',
    index: 'dashboard',
    displayName: 'Dashboards',
    searchTerm: 'Dashboard',
  },
  {
    name: 'Pipeline',
    index: 'pipeline',
    displayName: 'Pipelines',
    searchTerm: 'Pipeline',
  },
  {
    name: 'Topic',
    index: 'topic',
    displayName: 'Topics',
    searchTerm: 'Topic',
  },
  {
    name: 'ML Model',
    index: 'mlmodel',
    displayName: 'ML Model',
    searchTerm: 'ML',
  },
  {
    name: 'Container',
    index: 'container',
    displayName: 'Containers',
    searchTerm: 'Container',
  },
  {
    name: 'Search Index',
    index: 'searchIndex',
    displayName: 'Search Indexes',
    searchTerm: 'Search',
  },
  {
    name: 'Chart',
    index: 'chart',
    displayName: 'Charts',
    searchTerm: 'Chart',
  },
  {
    name: 'Stored Procedure',
    index: 'storedProcedure',
    displayName: 'Stored Procedures',
    searchTerm: 'Stored',
  },
  {
    name: 'Data Model',
    index: 'dashboardDataModel',
    displayName: 'Data Model',
    searchTerm: 'Data',
  },
  {
    name: 'Glossary Term',
    index: 'glossaryTerm',
    displayName: 'Glossary Terms',
    searchTerm: 'Glossary',
  },
  {
    name: 'Metric',
    index: 'metric',
    displayName: 'Metrics',
    searchTerm: 'Metric',
  },
  {
    name: 'Database',
    index: 'database',
    displayName: 'Databases',
    searchTerm: 'Database',
  },
  {
    name: 'Database Schema',
    index: 'databaseSchema',
    displayName: 'Database Schemas',
    searchTerm: 'Database',
  },
  {
    name: 'API Collection',
    index: 'apiCollection',
    displayName: 'API Collections',
    searchTerm: 'API',
  },
  {
    name: 'API Endpoint',
    index: 'apiEndpoint',
    displayName: 'API Endpoints',
    searchTerm: 'API',
  },
  {
    name: 'Data Product',
    index: 'dataProduct',
    displayName: 'Data Products',
    searchTerm: 'Data',
  },
  {
    name: 'Knowledge Page',
    index: 'page',
    displayName: 'Knowledge Pages',
    searchTerm: 'Knowledge',
  },
];

export const navigateToCustomizeLandingPage = async (
  page: Page,
  { personaName }: { personaName: string }
) => {
  const getPersonas = page.waitForResponse('/api/v1/personas*');

  await settingClick(page, GlobalSettingOptions.PERSONA);

  await getPersonas;

  const getCustomPageDataResponse = page.waitForResponse(
    `/api/v1/docStore/name/persona.${encodeURIComponent(personaName)}`
  );

  // Navigate to the customize landing page
  await page.getByTestId(`persona-details-card-${personaName}`).click();

  await page.getByRole('tab', { name: 'Customize UI' }).click();

  await page.getByTestId('LandingPage').click();
  await getCustomPageDataResponse;

  await page.waitForLoadState('networkidle');
};

export const removeAndCheckWidget = async (
  page: Page,
  { widgetKey }: { widgetKey: string }
) => {
  // Click on remove widget button
  await page
    .locator(`[data-testid="${widgetKey}"] [data-testid="more-options-button"]`)
    .click();

  await page.getByText('Remove').click();

  await expect(page.getByTestId(`${widgetKey}`)).not.toBeVisible();
};

export const checkAllDefaultWidgets = async (page: Page) => {
  await expect(page.getByTestId('KnowledgePanel.ActivityFeed')).toBeVisible();
  await expect(page.getByTestId('KnowledgePanel.Following')).toBeVisible();
  await expect(page.getByTestId('KnowledgePanel.DataAssets')).toBeVisible();
  await expect(page.getByTestId('KnowledgePanel.MyData')).toBeVisible();
  await expect(page.getByTestId('KnowledgePanel.KPI')).toBeVisible();
  await expect(page.getByTestId('KnowledgePanel.TotalAssets')).toBeVisible();
};

export const setUserDefaultPersona = async (
  page: Page,
  personaName: string
) => {
  await visitOwnProfilePage(page);

  await page.locator('[data-testid="default-edit-user-persona"]').click();

  await expect(
    page.locator('[data-testid="default-persona-select-list"]')
  ).toBeVisible();

  await page.locator('[data-testid="default-persona-select-list"]').click();
  await page.waitForLoadState('networkidle');

  const setDefaultPersona = page.waitForResponse('/api/v1/users/*');

  // Click on the persona option by text within the dropdown
  await page.locator(`[data-testid="${personaName}-option"]`).click();

  await page
    .locator('[data-testid="user-profile-default-persona-edit-save"]')
    .click();

  await setDefaultPersona;

  await expect(
    page.locator('[data-testid="persona-details-card"]')
  ).toContainText(personaName);
};

export const openAddCustomizeWidgetModal = async (page: Page) => {
  const fetchResponse = page.waitForResponse(
    '/api/v1/docStore?fqnPrefix=KnowledgePanel*'
  );
  await page
    .locator(
      '[data-testid="customize-landing-page-header"] [data-testid="add-widget-button"]'
    )
    .click();

  await fetchResponse;
};

export const saveCustomizeLayoutPage = async (
  page: Page,
  isCreated?: boolean
) => {
  const saveResponse = page.waitForResponse(
    isCreated ? '/api/v1/docStore' : '/api/v1/docStore/*'
  );
  await page.locator('[data-testid="save-button"]').click();
  await saveResponse;

  await toastNotification(
    page,
    `Page layout ${isCreated ? 'created' : 'updated'} successfully.`
  );
};

export const removeAndVerifyWidget = async (
  page: Page,
  widgetKey: string,
  personaName: string
) => {
  await navigateToCustomizeLandingPage(page, {
    personaName,
  });

  await removeAndCheckWidget(page, {
    widgetKey,
  });

  await page.locator('[data-testid="save-button"]').click();
  await page.waitForLoadState('networkidle');

  await redirectToHomePage(page);

  await expect(page.getByTestId(widgetKey)).not.toBeVisible();
};

export const addAndVerifyWidget = async (
  page: Page,
  widgetKey: string,
  personaName: string
) => {
  await navigateToCustomizeLandingPage(page, {
    personaName,
  });

  await openAddCustomizeWidgetModal(page);
  await waitForAllLoadersToDisappear(page);

  await page.locator(`[data-testid="${widgetKey}"]`).click();

  await page.locator('[data-testid="apply-btn"]').click();

  await expect(page.getByTestId(widgetKey)).toBeVisible();

  await page.locator('[data-testid="save-button"]').click();
  await page.waitForLoadState('networkidle');

  await redirectToHomePage(page);

  await expect(page.getByTestId(widgetKey)).toBeVisible();
};

export const addCuratedAssetPlaceholder = async ({
  page,
  personaName,
}: {
  page: Page;
  personaName: string;
}) => {
  await navigateToCustomizeLandingPage(page, {
    personaName,
  });

  await openAddCustomizeWidgetModal(page);
  await waitForAllLoadersToDisappear(page);

  await page.locator('[data-testid="KnowledgePanel.CuratedAssets"]').click();

  await page.locator('[data-testid="apply-btn"]').click();

  await expect(
    page
      .getByTestId('KnowledgePanel.CuratedAssets')
      .getByTestId('widget-empty-state')
  ).toBeVisible();
};

// Helper function to select asset types in the dropdown
export const selectAssetTypes = async (
  page: Page,
  assetTypes: string[] | 'all'
) => {
  // Click on asset type selector to open dropdown
  await page.locator('[data-testid="asset-type-select"]').click();

  // Wait for dropdown to be visible
  await page.waitForSelector('.ant-select-dropdown', {
    state: 'visible',
    timeout: 5000,
  });

  // Wait for the tree to load
  await page.waitForSelector('.ant-select-tree', {
    state: 'visible',
    timeout: 5000,
  });

  if (assetTypes === 'all') {
    // Select all asset types using the checkbox
    await page.locator('[data-testid="all-option"]').click();
  } else {
    // Select specific asset types
    for (const assetType of assetTypes) {
      // Find the corresponding config for search term
      const config = ENTITY_TYPE_CONFIGS.find(
        (c) => c.name === assetType || c.displayName === assetType
      );
      const searchTerm = config?.searchTerm || assetType;
      const index = config?.index || assetType.toLowerCase();

      // Search for the asset type
      await page.keyboard.type(searchTerm);
      await page.waitForTimeout(500);

      // Try to click the filtered result
      const filteredElement = page.locator(`[data-testid="${index}-option"]`);

      if (await filteredElement.isVisible()) {
        await filteredElement.click();
      }

      await page.getByText('Select Asset Type').click();
    }
  }

  // Close the dropdown
  await page.getByText('Select Asset Type').click();
};
