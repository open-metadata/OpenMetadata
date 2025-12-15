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
import { navigateToPersonaWithPagination } from './persona';
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

  // Need to find persona card and click as the list might get paginated
  await navigateToPersonaWithPagination(page, personaName, true);

  // Navigate to the customize landing page
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
  await page.click(`.ant-select-dropdown:visible [title="${personaName}"]`);

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

  await waitForAllLoadersToDisappear(page);

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

  await page
    .getByRole('dialog', { name: 'Customize Home' })
    .getByTestId(widgetKey)
    .click();

  await page.locator('[data-testid="apply-btn"]').click();

  await expect(
    page.getByTestId('page-layout-v1').getByTestId(widgetKey)
  ).toBeVisible();

  await page.locator('[data-testid="save-button"]').click();
  await page.waitForLoadState('networkidle');

  await redirectToHomePage(page);

  await waitForAllLoadersToDisappear(page);
  await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');

  await expect(
    page.getByTestId('page-layout-v1').getByTestId(widgetKey)
  ).toBeVisible();
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

// Helper function to test widget footer "View More" button
export const verifyWidgetFooterViewMore = async (
  page: Page,
  {
    widgetKey,
    expectedLink,
    link,
  }: {
    widgetKey: string;
    expectedLink?: string;
    link?: string;
  }
) => {
  // Wait for the page to load
  await waitForAllLoadersToDisappear(page);

  const widget = page.getByTestId(widgetKey);

  await expect(widget).toBeVisible();

  // Wait for the data to appear in the widget
  await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');

  // Check for widget footer
  const widgetFooter = widget.locator('[data-testid="widget-footer"]');
  const footerExists = await widgetFooter.isVisible().catch(() => false);

  if (!footerExists) {
    // No footer is expected for this widget
    return;
  }

  // Footer exists, check for view more button
  const viewMoreButton = widget.locator('.footer-view-more-button');
  const buttonExists = await viewMoreButton.isVisible().catch(() => false);

  if (!buttonExists) {
    // No view more button in footer
    return;
  }

  // View more button exists, verify it
  await expect(viewMoreButton).toBeVisible();

  // Get and verify the href
  const href = await viewMoreButton.getAttribute('href');

  if (expectedLink) {
    // Exact link match
    expect(href).toBe(expectedLink);
  } else if (link) {
    // Pattern match
    expect(href).toContain(link);
  }

  // Click and verify navigation
  await viewMoreButton.click();

  if (expectedLink) {
    // Wait for the specific URL
    await page.waitForURL(expectedLink);
  } else if (link) {
    const currentUrl = page.url();

    // Wait for URL matching pattern
    expect(currentUrl).toContain(link);
  }
};

export const verifyWidgetEntityNavigation = async (
  page: Page,
  {
    widgetKey,
    entitySelector,
    urlPattern,
    emptyStateTestId,
    verifyElement,
    apiResponseUrl,
    searchQuery,
  }: {
    widgetKey: string;
    entitySelector: string;
    urlPattern: string;
    emptyStateTestId?: string;
    verifyElement?: string;
    apiResponseUrl: string;
    searchQuery: string | string[];
  }
) => {
  // Wait for API response matching the search query
  const response = page.waitForResponse((response) => {
    if (!response.url().includes(apiResponseUrl)) {
      return false;
    }

    // Handle multiple query parts (for complex queries like Data Assets)
    if (Array.isArray(searchQuery)) {
      return searchQuery.every((query) => response.url().includes(query));
    }

    // Handle single query string
    return response.url().includes(searchQuery);
  });

  await redirectToHomePage(page);

  await response;

  // Wait for loaders after navigation
  await waitForAllLoadersToDisappear(page);
  await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');

  // Get widget after navigation to home page
  const widget = page.getByTestId(widgetKey);

  // Wait for widget to be visible
  await expect(widget).toBeVisible();

  // Wait again for any widget-specific loaders
  await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');
  await page.waitForTimeout(1000);

  // Check for entity items in the widget
  const entityItems = widget.locator(entitySelector);
  const hasEntities = (await entityItems.count()) > 0;

  if (hasEntities) {
    await expect(entityItems.first()).toBeVisible();

    // Get the first entity item
    const firstEntity = entityItems.first();

    // Check if it's a link or button and click appropriately
    const isLink = (await firstEntity.locator('.item-link').count()) > 0;

    if (isLink) {
      // For widgets with links inside (like My Data)
      const entityLink = firstEntity.locator('.item-link').first();
      await entityLink.click();
    } else {
      // For widgets with direct clickable cards (like Domains, Data Products)
      await firstEntity.click();
    }

    // Wait for navigation
    await page.waitForLoadState('networkidle');

    // Verify we're on the correct page
    const currentUrl = page.url();

    expect(currentUrl).toContain(urlPattern);

    // Verify page element is visible if specified
    if (verifyElement) {
      const pageElement = page.locator(verifyElement);

      await expect(pageElement).toBeVisible();
    }

    // Navigate back to home for next tests
    await redirectToHomePage(page);
  } else {
    // Check for empty state if no entities
    const emptyState = widget.locator('[data-testid="widget-empty-state"]');

    await expect(emptyState).toBeVisible();

    if (emptyStateTestId) {
      const emptyStateComponent = page.getByTestId(emptyStateTestId);

      await expect(emptyStateComponent).toBeVisible();
    }
  }
};

export const verifyWidgetHeaderNavigation = async (
  page: Page,
  widgetKey: string,
  expectedTitle: string,
  navigationUrl: string
) => {
  const widget = page.getByTestId(widgetKey);

  await expect(widget).toBeVisible();

  // Wait for loaders before interacting with widget header
  await waitForAllLoadersToDisappear(page);

  // Verify widget header
  const widgetHeader = widget.getByTestId('widget-header');

  await expect(widgetHeader).toBeVisible();

  // Verify header title
  const headerTitle = widgetHeader.getByTestId('widget-title');

  await expect(headerTitle).toBeVisible();
  await expect(headerTitle).toContainText(expectedTitle);

  // Click header title to navigate
  await headerTitle.click();

  const currentUrl = page.url();

  // Wait for navigation
  expect(currentUrl).toContain(navigationUrl);

  // Navigate back to home page for next tests
  await redirectToHomePage(page);
};

export const verifyDomainCountInDomainWidget = async (
  page: Page,
  domainId: string,
  expectedCount: number
) => {
  const domainWidget = page.getByTestId('KnowledgePanel.Domains');

  await expect(domainWidget).toBeVisible();

  const domainCountElement = domainWidget.locator(
    `[data-testid="domain-card-${domainId}"] .domain-card-count`
  );

  await expect(domainCountElement).toBeVisible();
  await expect(domainCountElement).toContainText(expectedCount.toString());
};

export const verifyDataProductCountInDataProductWidget = async (
  page: Page,
  dataProductId: string,
  expectedCount: number
) => {
  const dataProductWidget = page.getByTestId('KnowledgePanel.DataProducts');

  await expect(dataProductWidget).toBeVisible();

  const dataProductCountElement = dataProductWidget.locator(
    `[data-testid="data-product-card-${dataProductId}"] [data-testid="data-product-asset-count"]`
  );

  await expect(dataProductCountElement).toBeVisible();
  await expect(dataProductCountElement).toContainText(expectedCount.toString());
};
