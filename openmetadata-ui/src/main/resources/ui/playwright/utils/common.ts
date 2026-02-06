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
import { Browser, expect, Locator, Page, request } from '@playwright/test';
import { randomUUID } from 'crypto';
import { SidebarItem } from '../constant/sidebar';
import { adjectives, nouns } from '../constant/user';
import { Domain } from '../support/domain/Domain';
import { waitForAllLoadersToDisappear } from './entity';
import { sidebarClick } from './sidebar';
import { getToken as getTokenFromStorage } from './tokenStorage';

export const uuid = () => randomUUID().split('-')[0];
export const fullUuid = () => randomUUID();

export const descriptionBox = '.om-block-editor[contenteditable="true"]';
export const descriptionBoxReadOnly =
  '.om-block-editor[contenteditable="false"]';

export const INVALID_NAMES = {
  MAX_LENGTH:
    'a87439625b1c2d3e4f5061728394a5b6c7d8e90a1b2c3d4e5f67890aba87439625b1c2d3e4f5061728394a5b6c7d8e90a1b2c3d4e5f67890abName can be a maximum of 128 characters',
  WITH_SPECIAL_CHARS: '::normalName::',
};

export const NAME_VALIDATION_ERROR =
  'Name must contain only letters, numbers, underscores, hyphens, periods, parenthesis, and ampersands.';

export const NAME_MIN_MAX_LENGTH_VALIDATION_ERROR =
  'Name size must be between 2 and 64';

export const NAME_MAX_LENGTH_VALIDATION_ERROR =
  'Name can be a maximum of 128 characters';

export const getToken = async (page: Page) => {
  return await getTokenFromStorage(page);
};

export const getAuthContext = async (token: string) => {
  return await request.newContext({
    // Default timeout is 30s making it to 1m for AUTs
    timeout: 90000,
    extraHTTPHeaders: {
      Connection: 'keep-alive',
      Authorization: `Bearer ${token}`,
    },
  });
};

export const redirectToHomePage = async (
  page: Page,
  waitForNetworkIdle = true
) => {
  await page.goto('/');
  await page.waitForURL('**/my-data');
  if (waitForNetworkIdle) {
    await page.waitForLoadState('networkidle');
  }
};

export const redirectToExplorePage = async (page: Page) => {
  await page.goto('/explore');
  await page.waitForURL('**/explore');
  await page.waitForLoadState('networkidle');
};

export const removeLandingBanner = async (page: Page) => {
  try {
    const welcomePageCloseButton = await page
      .waitForSelector('[data-testid="welcome-screen-close-btn"]', {
        state: 'visible',
        timeout: 5000,
      })
      .catch(() => {
        // Do nothing if the welcome banner does not exist
        return;
      });

    // Close the welcome banner if it exists
    if (welcomePageCloseButton?.isVisible()) {
      await welcomePageCloseButton.click();
    }
  } catch {
    // Do nothing if the welcome banner does not exist
    return;
  }
};

export const createNewPage = async (browser: Browser) => {
  // create a new page
  const page = await browser.newPage();
  await redirectToHomePage(page);

  // get the token
  const token = await getToken(page);

  // create a new context with the token
  const apiContext = await getAuthContext(token);

  const afterAction = async () => {
    await apiContext.dispose();
    await page.close();
  };

  return { page, apiContext, afterAction };
};

/**
 * Retrieves the API context for the given page.
 * @param page The Playwright page object.
 * @returns An object containing the API context and a cleanup function.
 */
export const getApiContext = async (page: Page) => {
  const token = await getToken(page);
  const apiContext = await getAuthContext(token);
  const afterAction = async () => await apiContext.dispose();

  return { apiContext, afterAction };
};

const DASHBOARD_DATA_MODEL = 'DashboardDataModel';

export const getEntityTypeSearchIndexMapping = (entityType: string) => {
  const entityMapping = {
    Table: 'table_search_index',
    Topic: 'topic_search_index',
    Dashboard: 'dashboard_search_index',
    Pipeline: 'pipeline_search_index',
    MlModel: 'mlmodel_search_index',
    Container: 'container_search_index',
    SearchIndex: 'search_entity_search_index',
    ApiEndpoint: 'api_endpoint_search_index',
    Metric: 'metric_search_index',
    [DASHBOARD_DATA_MODEL]: 'dashboard_data_model_search_index',
  };

  return entityMapping[entityType as keyof typeof entityMapping];
};

export const toastNotification = async (
  page: Page,
  message: string | RegExp,
  timeout?: number
) => {
  await page.waitForSelector('[data-testid="alert-bar"]', {
    state: 'visible',
  });

  await expect(page.getByTestId('alert-bar')).toHaveText(message, { timeout });

  await expect(page.getByTestId('alert-icon')).toBeVisible();

  await expect(page.getByTestId('alert-icon-close')).toBeVisible();
};

export const clickOutside = async (page: Page) => {
  await page.locator('body').click({
    position: {
      x: 0,
      y: 0,
    },
  });
};

export const visitOwnProfilePage = async (page: Page) => {
  await page.locator('[data-testid="dropdown-profile"] svg').click();
  await page.waitForSelector('[role="menu"].profile-dropdown', {
    state: 'visible',
  });
  const userResponse = page.waitForResponse(
    '/api/v1/users/name/*?fields=*&include=all'
  );
  await page.getByRole('link', { name: 'View Profile' }).click();
  await userResponse;
  await clickOutside(page);
};

export const assignDomain = async (
  page: Page,
  domain: { name: string; displayName: string; fullyQualifiedName?: string },
  checkSelectedDomain = true
) => {
  await page.getByTestId('add-domain').click();
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  const searchDomain = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes(encodeURIComponent(domain.name))
  );

  await page
    .getByTestId('domain-selectable-tree')
    .getByTestId('searchbar')
    .fill(domain.name);

  await searchDomain;

  // Wait for the tag element to be visible and ensure page is still valid
  const tagSelector = page.getByTestId(`tag-${domain.fullyQualifiedName}`);
  await tagSelector.waitFor({ state: 'visible' });
  await tagSelector.click();

  const patchReq = page.waitForResponse(
    (req) => req.request().method() === 'PATCH'
  );

  await page
    .getByTestId('domain-selectable-tree')
    .getByTestId('saveAssociatedTag')
    .click();
  await patchReq;
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  if (checkSelectedDomain) {
    await expect(page.getByTestId('domain-link')).toContainText(
      domain.displayName
    );
  }
};

export const assignSingleSelectDomain = async (
  page: Page,
  domain: { name: string; displayName: string; fullyQualifiedName?: string }
) => {
  await page.getByTestId('add-domain').click();
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  const searchDomain = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes(encodeURIComponent(domain.name))
  );

  await page
    .getByTestId('domain-selectable-tree')
    .getByTestId('searchbar')
    .fill(domain.name);

  await searchDomain;

  // Wait for the tag element to be visible and ensure page is still valid
  const tagSelector = page.getByTestId(`tag-${domain.fullyQualifiedName}`);
  await tagSelector.waitFor({ state: 'visible' });

  const patchReq = page.waitForResponse(
    (req) => req.request().method() === 'PATCH'
  );

  await tagSelector.click();

  await patchReq;
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  await expect(page.getByTestId('domain-link')).toContainText(
    domain.displayName
  );
};

export const updateDomain = async (
  page: Page,
  domain: { name: string; displayName: string; fullyQualifiedName?: string }
) => {
  await page.getByTestId('add-domain').click();
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  await page
    .getByTestId('domain-selectable-tree')
    .getByTestId('searchbar')
    .clear();

  const searchDomain = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes(encodeURIComponent(domain.name))
  );
  await page
    .getByTestId('domain-selectable-tree')
    .getByTestId('searchbar')
    .fill(domain.name);
  await searchDomain;

  await page.getByTestId(`tag-${domain.fullyQualifiedName}`).click();

  const patchReq = page.waitForResponse(
    (req) => req.request().method() === 'PATCH'
  );

  await page
    .getByTestId('domain-selectable-tree')
    .getByTestId('saveAssociatedTag')
    .click();
  await patchReq;
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  await expect(page.getByTestId('header-domain-container')).toContainText('+1');

  await page.getByTestId('header-domain-container').getByText('+1').hover();

  await expect(
    page.getByRole('menuitem', { name: domain.displayName })
  ).toBeVisible();
};

export const removeDomain = async (
  page: Page,
  domain: { name: string; displayName: string; fullyQualifiedName?: string },
  showDashPlaceholder = true
) => {
  await page.getByTestId('add-domain').click();
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  const searchDomain = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes(encodeURIComponent(domain.name))
  );
  await page
    .getByTestId('domain-selectable-tree')
    .getByTestId('searchbar')
    .fill(domain.name);
  await searchDomain;

  const tagSelector = page.getByTestId(`tag-${domain.fullyQualifiedName}`);
  await tagSelector.waitFor({ state: 'visible' });
  await tagSelector.click();

  const patchReq = page.waitForResponse(
    (req) => req.request().method() === 'PATCH'
  );

  await page
    .getByTestId('domain-selectable-tree')
    .getByTestId('saveAssociatedTag')
    .click();
  await patchReq;
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  await expect(page.getByTestId('no-domain-text')).toContainText(
    showDashPlaceholder ? '--' : 'No Domains'
  );
};

export const removeSingleSelectDomain = async (
  page: Page,
  domain: { name: string; displayName: string; fullyQualifiedName?: string },
  showDashPlaceholder = true
) => {
  await page.getByTestId('add-domain').click();
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  await page
    .getByTestId('domain-selectable-tree')
    .getByTestId('searchbar')
    .clear();

  const searchDomain = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes(encodeURIComponent(domain.name))
  );
  await page
    .getByTestId('domain-selectable-tree')
    .getByTestId('searchbar')
    .fill(domain.name);
  await searchDomain;

  const patchReq = page.waitForResponse(
    (req) => req.request().method() === 'PATCH'
  );

  await page.getByTestId(`tag-${domain.fullyQualifiedName}`).click();

  await patchReq;
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  await expect(page.getByTestId('no-domain-text')).toContainText(
    showDashPlaceholder ? '--' : 'No Domains'
  );
};

export const assignDataProduct = async (
  page: Page,
  domain: { name: string; displayName: string; fullyQualifiedName?: string },
  dataProducts: {
    name: string;
    displayName: string;
    fullyQualifiedName?: string;
  }[],
  action: 'Add' | 'Edit' = 'Add',
  parentId = 'KnowledgePanel.DataProducts'
) => {
  await page
    .getByTestId(parentId)
    .getByTestId('data-products-container')
    .getByTestId(action === 'Add' ? 'add-data-product' : 'edit-button')
    .click();

  for (const dataProduct of dataProducts) {
    const searchDataProduct = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/query') &&
        response.url().includes(encodeURIComponent(domain.name))
    );

    await page
      .locator('[data-testid="data-product-selector"] input')
      .fill(dataProduct.displayName);
    await searchDataProduct;
    await page.getByTestId(`tag-${dataProduct.fullyQualifiedName}`).click();
  }

  await expect(
    page
      .getByTestId('data-product-dropdown-actions')
      .getByTestId('saveAssociatedTag')
  ).toBeEnabled();

  const patchReq = page.waitForResponse(
    (req) => req.request().method() === 'PATCH'
  );

  await page
    .getByTestId('data-product-dropdown-actions')
    .getByTestId('saveAssociatedTag')
    .click();
  await patchReq;

  for (const dataProduct of dataProducts) {
    await expect(
      page
        .getByTestId(parentId)
        .getByTestId('data-products-list')
        .getByTestId(`data-product-${dataProduct.fullyQualifiedName}`)
    ).toBeVisible();
  }
};

export const removeDataProduct = async (
  page: Page,
  dataProduct: {
    name: string;
    displayName: string;
    fullyQualifiedName?: string;
  }
) => {
  await page
    .getByTestId('KnowledgePanel.DataProducts')
    .getByTestId('data-products-container')
    .getByTestId('edit-button')
    .click();

  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  await page
    .getByTestId(`selected-tag-${dataProduct.fullyQualifiedName}`)
    .getByTestId('remove-tags')
    .locator('svg')
    .click();

  await expect(
    page
      .getByTestId('data-product-dropdown-actions')
      .getByTestId('saveAssociatedTag')
  ).toBeEnabled();

  const patchReq = page.waitForResponse(
    (req) => req.request().method() === 'PATCH'
  );

  await page
    .getByTestId('data-product-dropdown-actions')
    .getByTestId('saveAssociatedTag')
    .click();
  await patchReq;

  await page.waitForSelector(
    '[data-testid="data-product-dropdown-actions"] [data-testid="saveAssociatedTag"] [data-icon="loading"]',
    { state: 'detached' }
  );
  await expect(
    page
      .getByTestId('data-product-dropdown-actions')
      .getByTestId('saveAssociatedTag')
  ).not.toBeVisible();

  await expect(
    page
      .getByTestId('KnowledgePanel.DataProducts')
      .getByTestId('data-products-list')
      .getByTestId(`data-product-${dataProduct.fullyQualifiedName}`)
  ).not.toBeVisible();
};

export const visitGlossaryPage = async (page: Page, glossaryName: string) => {
  await redirectToHomePage(page);
  const glossaryResponse = page.waitForResponse('/api/v1/glossaries?fields=*');
  await sidebarClick(page, SidebarItem.GLOSSARY);
  await glossaryResponse;
  await page.getByRole('menuitem', { name: glossaryName }).click();
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
};

export const getRandomFirstName = () => {
  return `${
    adjectives[Math.floor(Math.random() * adjectives.length)]
  }${uuid()}`;
};
export const getRandomLastName = () => {
  return `${nouns[Math.floor(Math.random() * nouns.length)]}${uuid()}`;
};

export const generateRandomUsername = (prefix = '') => {
  const timestamp = Date.now();
  const firstName = `${prefix}${getRandomFirstName()}`;
  const lastName = `${prefix}${getRandomLastName()}`;

  return {
    firstName,
    lastName,
    email: `${firstName}.${lastName}.${timestamp}@example.com`,
    password: 'User@OMD123',
  };
};

export const verifyDomainLinkInCard = async (
  entityCard: Locator,
  domain: Domain['responseData']
) => {
  const domainLink = entityCard.getByTestId('domain-link').filter({
    hasText: domain.displayName,
  });

  await expect(domainLink).toBeVisible();
  await expect(domainLink).toContainText(domain.displayName);

  const href = await domainLink.getAttribute('href');

  expect(href).toContain('/domain/');
  await expect(domainLink).toBeEnabled();
};

export const verifyDomainPropagation = async (
  page: Page,
  domain: Domain['responseData'],
  childFqnSearchTerm: string
) => {
  await page.getByTestId('searchBox').fill(childFqnSearchTerm);
  await page.getByTestId('searchBox').press('Enter');
  await page.waitForSelector(`[data-testid*="table-data-card"]`);

  const entityCard = page.getByTestId(`table-data-card_${childFqnSearchTerm}`);

  await expect(entityCard).toBeVisible();

  const domainLink = entityCard.getByTestId('domain-link').first();

  await expect(domainLink).toBeVisible();
  await expect(domainLink).toContainText(domain.displayName);
};

export const replaceAllSpacialCharWith_ = (text: string) => {
  return text.replaceAll(/[&/\\#, +()$~%.'":*?<>{}]/g, '_');
};

// Since the tests run in parallel sometimes the error toast alert pops up
// Stating the domain or glossary does not exist since it's deleted in other test
// This error toast blocks the buttons at the top
// Below logic closes the alert if it's present to avoid flakiness in tests
export const closeFirstPopupAlert = async (page: Page) => {
  const toastElement = page.getByTestId('alert-bar');

  if ((await toastElement.count()) > 0) {
    await page.getByTestId('alert-icon-close').first().click();
  }
};

export const reloadAndWaitForNetworkIdle = async (page: Page) => {
  await page.reload();
  await page.waitForLoadState('networkidle');

  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });
};

/**
 * Utility function to handle API calls with retry logic for connection-related errors.
 * This is particularly useful for cleanup operations that might fail due to network issues.
 *
 * @param apiCall - The API call function to execute
 * @param operationName - Name of the operation for logging purposes
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param baseDelay - Base delay in milliseconds for exponential backoff (default: 1000)
 * @returns The result of the API call if successful
 */
export const executeWithRetry = async <T>(
  apiCall: () => Promise<T>,
  operationName: string,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T | void> => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Check if it's a retriable error (connection-related issues)
      const isRetriableError =
        errorMessage.includes('socket hang up') ||
        errorMessage.includes('ECONNRESET') ||
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('Connection refused') ||
        errorMessage.includes('ECONNREFUSED');

      if (isRetriableError && attempt < maxRetries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(
          `${operationName} attempt ${
            attempt + 1
          } failed with retriable error: ${errorMessage}. Retrying in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));

        continue;
      } else {
        console.error(
          `Failed to ${operationName} after ${attempt + 1} attempts:`,
          errorMessage
        );

        // Don't throw the error to prevent test failures - just log it
        break;
      }
    }
  }
};

export const readElementInListWithScroll = async (
  page: Page,
  locator: Locator,
  hierarchyElementLocator: Locator
) => {
  const element = locator;

  // Reset scroll position to top before starting pagination
  await hierarchyElementLocator.hover();
  await page.mouse.wheel(0, -99999);

  await page.waitForTimeout(1000);

  // Retry mechanism for pagination
  let elementCount = await element.count();
  let retryCount = 0;
  const maxRetries = 10;

  while (elementCount === 0 && retryCount < maxRetries) {
    await hierarchyElementLocator.hover();
    await page.mouse.wheel(0, 1000);
    await page.waitForTimeout(500);

    // Create fresh locator and check if the article is now visible after this retry
    const freshArticle = locator;
    const count = await freshArticle.count();

    // Check if the article is now visible after this retry
    elementCount = count;

    // If we found the element, validate it and break out of the loop
    if (count > 0) {
      await expect(freshArticle).toBeVisible();

      return; // Exit the function early since we found and validated the article
    }

    retryCount++;
  }
};

export const testPaginationNavigation = async (
  page: Page,
  apiEndpointPattern: string,
  waitForLoadSelector?: string,
  validateUrl = true
) => {
  const responseMatcher = (response: { url: () => string }) => {
    const url = response.url();
    return (
      url.includes(apiEndpointPattern) &&
      !url.includes('limit=0') &&
      (url.includes('limit=') ||
        url.includes('after=') ||
        url.includes('before='))
    );
  };

  const page1ResponsePromise = page.waitForResponse(responseMatcher);

  const page1Response = await page1ResponsePromise;
  expect(page1Response.status()).toBe(200);

  if (waitForLoadSelector) {
    await page.waitForSelector(waitForLoadSelector, { state: 'visible' });
  }
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

  const page1Data = await page1Response.json();
  const page1FirstItem = page1Data.data?.[0];
  const page1FirstItemName =
    page1FirstItem?.displayName || page1FirstItem?.name;

  await expect(page.getByTestId('previous')).toBeDisabled();
  const nextButton = page.locator('[data-testid="next"]');

  const isNextButtonEnabled = await nextButton.isEnabled();

  if (!isNextButtonEnabled) {
    return;
  }
  const page2ResponsePromise = page.waitForResponse(responseMatcher);

  await nextButton.click();
  const page2Response = await page2ResponsePromise;
  expect(page2Response.status()).toBe(200);

  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

  await expect(page.getByTestId('previous')).toBeEnabled();
  let afterValue: string | null = '';
  if (validateUrl) {
    const currentUrl = page.url();
    const urlObj = new URL(currentUrl);
    const searchParams = urlObj.searchParams;

    expect(searchParams.get('currentPage')).toBe('2');
    expect(searchParams.get('cursorType')).toBe('after');

    afterValue = searchParams.get('cursorValue');

    expect(afterValue).toBeTruthy();
  }

  if (page1FirstItemName) {
    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow.locator('td').nth(0)).not.toHaveText(
      page1FirstItemName
    );
    await expect(firstRow.locator('td').nth(1)).not.toHaveText(
      page1FirstItemName
    );
  }

  const reloadResponsePromise = page.waitForResponse(responseMatcher);

  await page.reload();

  const reloadResponse = await reloadResponsePromise;
  expect(reloadResponse.status()).toBe(200);
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

  await expect(page.getByTestId('previous')).toBeEnabled();
  const paginationText = page.locator('[data-testid="page-indicator"]');
  await expect(paginationText).toBeVisible();
  const paginationTextContent = await paginationText.textContent();

  expect(paginationTextContent).toMatch(/2\s*of\s*\d+/);

  if (validateUrl) {
    const reloadedUrl = page.url();
    const reloadedUrlObj = new URL(reloadedUrl);
    const reloadedSearchParams = reloadedUrlObj.searchParams;

    expect(reloadedSearchParams.get('currentPage')).toBe('2');
    expect(reloadedSearchParams.get('cursorType')).toBe('after');
    expect(reloadedSearchParams.get('cursorValue')).toBe(afterValue);
  }
  await page.waitForLoadState('domcontentloaded');
  const pageSizeDropdown = page.getByTestId('page-size-selection-dropdown');
  if (await pageSizeDropdown.isVisible()) {
    await expect(pageSizeDropdown).toHaveText('15 / Page');

    // Explicitly using selector, as in some cases table cell contains markdown
    // and markdown can further have tables
    const initialRowCount = await page
      .locator('tbody > tr[data-row-key]:visible')
      .count();
    expect(initialRowCount).toBeLessThanOrEqual(15);
    const menuItem = page.getByRole('menuitem', { name: '25 / Page' });
    await pageSizeDropdown.hover();
    const isMenuVisibleAfterHover = await menuItem
      .isVisible()
      .catch(() => false);
    if (!isMenuVisibleAfterHover) {
      await pageSizeDropdown.click();
    }
    await menuItem.waitFor({ state: 'visible' });

    const pageSizeChangePromise = page.waitForResponse((response) =>
      response.url().includes(apiEndpointPattern)
    );
    await menuItem.click();
    await pageSizeChangePromise;
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await expect(pageSizeDropdown).toHaveText('25 / Page');

    const newRowCount = await page
      .locator('tbody > tr[data-row-key]:visible')
      .count();
    expect(newRowCount).toBeLessThanOrEqual(25);
    expect(newRowCount).not.toBe(initialRowCount);
  }
};

export interface PaginationTestConfig {
  page: Page;
  baseUrl: string;
  normalApiPattern: string;
  searchApiPattern?: string;
  searchTestTerm?: string;
  searchParamName?: string;
  waitForLoadSelector?: string;
  deleteBtnTestId?: string;
}

export const testCompletePaginationWithSearch = async (
  config: PaginationTestConfig
) => {
  const {
    page,
    baseUrl,
    normalApiPattern,
    searchApiPattern = '/api/v1/search/query',
    searchTestTerm,
    searchParamName = 'endpoint',
    waitForLoadSelector = 'table',
    deleteBtnTestId = 'show-deleted',
  } = config;

  await page.goto(`${baseUrl}`);
  await page.waitForSelector(waitForLoadSelector, { state: 'visible' });

  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

  const nextButton = page.locator('[data-testid="next"]');
  const isNextEnabled = await nextButton.isEnabled();
  await expect(page.getByTestId('previous')).toBeDisabled();

  if (isNextEnabled) {
    const page2ResponsePromise = page.waitForResponse((response) =>
      response.url().includes(normalApiPattern)
    );

    await nextButton.click();
    const page2Response = await page2ResponsePromise;
    expect(page2Response.status()).toBe(200);
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    await expect(page.getByTestId('previous')).toBeEnabled();
    const paginationPage2 = page.locator('[data-testid="page-indicator"]');
    await expect(paginationPage2).toBeVisible();
    const page2Content = await paginationPage2.textContent();
    expect(page2Content).toMatch(/2\s*of\s*\d+/);
  }

  const searchResponsePromise = page.waitForResponse((response) =>
    response.url().includes(searchApiPattern)
  );

  await page.getByTestId('searchbar').fill(searchTestTerm || '');
  const searchResponse = await searchResponsePromise;
  expect(searchResponse.status()).toBe(200);

  const urlAfterSearch = new URL(page.url());
  expect(urlAfterSearch.searchParams.get(searchParamName)).toBe(searchTestTerm);

  await expect(page.getByTestId('previous')).toBeDisabled();
  const paginationAfterSearch = page.locator('[data-testid="page-indicator"]');
  await expect(paginationAfterSearch).toBeVisible();
  const searchPage1Content = await paginationAfterSearch.textContent();
  expect(searchPage1Content).toMatch(/1\s*of\s*\d+/);

  const nextButtonAfterSearch = page.locator('[data-testid="next"]');
  const isNextEnabledAfterSearch = await nextButtonAfterSearch.isEnabled();

  if (isNextEnabledAfterSearch) {
    const searchPage2Promise = page.waitForResponse((response) =>
      response.url().includes(searchApiPattern)
    );

    await nextButtonAfterSearch.click();
    const searchPage2Response = await searchPage2Promise;
    expect(searchPage2Response.status()).toBe(200);

    await expect(page.getByTestId('previous')).toBeEnabled();
    const paginationSearchPage2 = page.locator(
      '[data-testid="page-indicator"]'
    );
    await expect(paginationSearchPage2).toBeVisible();
    const searchPage2Content = await paginationSearchPage2.textContent();
    expect(searchPage2Content).toMatch(/2\s*of\s*\d+/);

    const reloadPromise = page.waitForResponse((response) =>
      response.url().includes(searchApiPattern)
    );

    await page.reload();
    const reloadResponse = await reloadPromise;
    expect(reloadResponse.status()).toBe(200);

    const urlAfterRefresh = new URL(page.url());
    expect(urlAfterRefresh.searchParams.get(searchParamName)).toBe(
      searchTestTerm
    );

    await expect(page.getByTestId('previous')).toBeEnabled();
    const paginationAfterRefresh = page.locator(
      '[data-testid="page-indicator"]'
    );
    await expect(paginationAfterRefresh).toBeVisible();
    const refreshPage2Content = await paginationAfterRefresh.textContent();
    expect(refreshPage2Content).toMatch(/2\s*of\s*\d+/);

    const searchValueAfterRefresh = await page
      .getByTestId('searchbar')
      .inputValue();
    expect(searchValueAfterRefresh).toBe(searchTestTerm);

    const deleteToggle = page.getByTestId(`${deleteBtnTestId}`);
    const isDeleteTogglePresent = await deleteToggle.count();

    if (isDeleteTogglePresent > 0) {
      const searchApiPromiseWithToggle1 = page.waitForResponse((response) =>
        response.url().includes(searchApiPattern)
      );

      await deleteToggle.click();
      const searchApiResponseWithToggle1 = await searchApiPromiseWithToggle1;
      expect(searchApiResponseWithToggle1.status()).toBe(200);
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      const searchApiPromiseWithToggle2 = page.waitForResponse((response) =>
        response.url().includes(searchApiPattern)
      );

      await deleteToggle.click();
      const searchApiResponseWithToggle2 = await searchApiPromiseWithToggle2;
      expect(searchApiResponseWithToggle2.status()).toBe(200);
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await expect(page.getByTestId('previous')).toBeDisabled();
      const paginationAfterToggleWithSearch = page.locator(
        '[data-testid="page-indicator"]'
      );
      await expect(paginationAfterToggleWithSearch).toBeVisible();
      const toggleSearchContent =
        await paginationAfterToggleWithSearch.textContent();
      expect(toggleSearchContent).toMatch(/1\s*of\s*\d+/);

      const urlAfterToggle = new URL(page.url());
      expect(urlAfterToggle.searchParams.get(searchParamName)).toBe(
        searchTestTerm
      );
    }
  }
};

export const testTableSorting = async (
  page: Page,
  columnHeader: string,
  columnIndex = 0
) => {
  await waitForAllLoadersToDisappear(page);
  await page.waitForLoadState('networkidle');

  const header = page.locator(`th:has-text("${columnHeader}")`).first();
  const visibleRowSelector = `tbody tr:not([aria-hidden="true"])`;

  const getFirstCellValue = async () => {
    const firstCell = page.locator(`${visibleRowSelector} td`).nth(columnIndex);
    await firstCell.waitFor({ state: 'visible' });

    return (await firstCell.textContent())?.trim();
  };

  const rowCount = await page.locator(visibleRowSelector).count();
  if (rowCount <= 1) {
    return;
  }

  const initialValue = await getFirstCellValue();

  await header.click();
  await waitForAllLoadersToDisappear(page);
  await header.click();
  await waitForAllLoadersToDisappear(page);

  const afterFirstClickValue = await getFirstCellValue();

  expect(afterFirstClickValue).not.toBe(initialValue);

  await header.click();
  await waitForAllLoadersToDisappear(page);

  const afterSecondClickValue = await getFirstCellValue();

  expect(afterSecondClickValue).not.toBe(afterFirstClickValue);
};

export const testTableSearch = async (
  page: Page,
  searchIndex: string,
  searchTerm: string,
  notVisibleText: string
) => {
  await waitForAllLoadersToDisappear(page);
  await page.waitForLoadState('networkidle');

  const waitForSearchResponse = page.waitForResponse(
    `/api/v1/search/query?q=*index=${searchIndex}*`
  );

  await page.getByTestId('searchbar').fill(searchTerm);
  await waitForSearchResponse;
  await waitForAllLoadersToDisappear(page);
  await page.waitForLoadState('networkidle');

  await expect(page.getByText(searchTerm).first()).toBeVisible();

  await expect(page.getByText(notVisibleText).first()).not.toBeVisible();
};
