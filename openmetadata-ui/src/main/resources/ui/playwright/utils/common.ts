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
import { Browser, expect, Page, request } from '@playwright/test';
import { randomUUID } from 'crypto';
import { SidebarItem } from '../constant/sidebar';
import { adjectives, nouns } from '../constant/user';
import { Domain } from '../support/domain/Domain';
import { sidebarClick } from './sidebar';

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
  return page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('om-session') ?? '{}')?.oidcIdToken ?? ''
  );
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

export const redirectToHomePage = async (page: Page) => {
  await page.goto('/');
  await page.waitForURL('**/my-data');
  await page.waitForLoadState('networkidle');
};

export const redirectToExplorePage = async (page: Page) => {
  await page.goto('/explore');
  await page.waitForURL('**/explore');
  await page.waitForLoadState('networkidle');
};

export const removeLandingBanner = async (page: Page) => {
  const widgetResponse = page.waitForResponse('/api/v1/search/query?q=**');
  await page.click('[data-testid="welcome-screen-close-btn"]');
  await widgetResponse;
};

export const createNewPage = async (browser: Browser) => {
  // create a new page
  const page = await browser.newPage();
  await redirectToHomePage(page);

  // get the token from localStorage
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
  await page.getByTestId('user-name').click();
  await userResponse;
  await clickOutside(page);
};

export const assignDomain = async (
  page: Page,
  domain: { name: string; displayName: string; fullyQualifiedName?: string }
) => {
  await page.getByTestId('add-domain').click();
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
  const searchDomain = page.waitForResponse(
    `/api/v1/search/query?q=*${encodeURIComponent(domain.name)}*`
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

  await page.getByTestId('saveAssociatedTag').click();
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
    `/api/v1/search/query?q=*${encodeURIComponent(domain.name)}*`
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

  await page.getByTestId('saveAssociatedTag').click();
  await patchReq;
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  await expect(page.getByTestId('domain-link')).toContainText(
    domain.displayName
  );
};

export const removeDomain = async (
  page: Page,
  domain: { name: string; displayName: string; fullyQualifiedName?: string }
) => {
  await page.getByTestId('add-domain').click();
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  await page.getByTestId(`tag-${domain.fullyQualifiedName}`).click();

  const patchReq = page.waitForResponse(
    (req) => req.request().method() === 'PATCH'
  );

  await page.getByTestId('saveAssociatedTag').click();
  await patchReq;
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  await expect(page.getByTestId('no-domain-text')).toContainText('No Domains');
};

export const assignDataProduct = async (
  page: Page,
  domain: { name: string; displayName: string; fullyQualifiedName?: string },
  dataProduct: {
    name: string;
    displayName: string;
    fullyQualifiedName?: string;
  },
  action: 'Add' | 'Edit' = 'Add',
  parentId = 'KnowledgePanel.DataProducts'
) => {
  await page
    .getByTestId(parentId)
    .getByTestId('data-products-container')
    .getByTestId(action === 'Add' ? 'add-data-product' : 'edit-button')
    .click();

  const searchDataProduct = page.waitForResponse(
    `/api/v1/search/query?q=*${encodeURIComponent(domain.name)}*`
  );

  await page
    .locator('[data-testid="data-product-selector"] input')
    .fill(dataProduct.displayName);
  await searchDataProduct;
  await page.getByTestId(`tag-${dataProduct.fullyQualifiedName}`).click();

  await expect(page.getByTestId('saveAssociatedTag')).toBeEnabled();

  await page.getByTestId('saveAssociatedTag').click();

  await expect(
    page
      .getByTestId(parentId)
      .getByTestId('data-products-list')
      .getByTestId(`data-product-${dataProduct.fullyQualifiedName}`)
  ).toBeVisible();
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

  await page
    .getByTestId(`selected-tag-${dataProduct.fullyQualifiedName}`)
    .getByTestId('remove-tags')
    .locator('svg')
    .click();

  await expect(page.getByTestId('saveAssociatedTag')).toBeEnabled();

  await page.getByTestId('saveAssociatedTag').click();

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
  const firstName = `${prefix}${getRandomFirstName()}`;
  const lastName = `${prefix}${getRandomLastName()}`;

  return {
    firstName,
    lastName,
    email: `${firstName}.${lastName}@example.com`,
    password: 'User@OMD123',
  };
};

export const verifyDomainPropagation = async (
  page: Page,
  domain: Domain['responseData'],
  childFqnSearchTerm: string
) => {
  await page.getByTestId('searchBox').fill(childFqnSearchTerm);
  await page.getByTestId('searchBox').press('Enter');

  await expect(
    page
      .getByTestId(`table-data-card_${childFqnSearchTerm}`)
      .getByTestId('domains-link')
  ).toContainText(domain.displayName);
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
        // eslint-disable-next-line no-console
        console.log(
          `${operationName} attempt ${
            attempt + 1
          } failed with retriable error: ${errorMessage}. Retrying in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));

        continue;
      } else {
        // eslint-disable-next-line no-console
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
