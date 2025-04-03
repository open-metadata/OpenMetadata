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
import { Response } from 'playwright';
import { SidebarItem } from '../constant/sidebar';
import { adjectives, nouns } from '../constant/user';
import { Domain } from '../support/domain/Domain';
import { sidebarClick } from './sidebar';

export const uuid = () => randomUUID().split('-')[0];

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
};

export const removeLandingBanner = async (page: Page) => {
  const widgetResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      matchRequestParams(response, 'POST', {
        query: '',
      })
  );
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
  };

  return entityMapping[entityType as keyof typeof entityMapping];
};

export const toastNotification = async (
  page: Page,
  message: string | RegExp
) => {
  await expect(page.getByTestId('alert-bar')).toHaveText(message);

  await expect(page.getByTestId('alert-icon')).toBeVisible();

  await expect(page.getByTestId('alert-icon-close')).toBeVisible();
};

export const clickOutside = async (page: Page) => {
  await page.locator('body').click({
    position: {
      x: 0,
      y: 0,
    },
  }); // with this action left menu bar is getting opened
  await page.mouse.move(1280, 0); // moving out side left menu bar to avoid random failure due to left menu bar
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

  await expect(page.getByTestId('no-domain-text')).toContainText('No Domain');
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
      .getByTestId('domain-link')
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

/**
 * Utility to check if a request matches specific parameters based on request type
 * @param response - The response to check
 * @param method - The HTTP method (GET, POST, etc.)
 * @param params - Key-value pairs to match in the request (optional)
 * @returns boolean indicating if the request matches all criteria
 */
export const matchRequestParams = (
  response: Response,
  method: string,
  params?: Record<string, any>
): boolean => {
  if (response.request().method() !== method) {
    return false;
  }

  // If no params specified, match based on method alone
  if (!params || Object.keys(params).length === 0) {
    return true;
  }

  if (method === 'GET') {
    // For GET requests, check URL parameters
    const url = new URL(response.url());

    return Object.entries(params).every(([key, value]) => {
      const paramValue = url.searchParams.get(key);
      if (Array.isArray(value)) {
        return value.some((v) => paramValue?.includes(String(v)));
      }

      return paramValue?.includes(String(value));
    });
  } else if (method === 'POST') {
    // For POST requests, check request body
    try {
      const postData = response.request().postData();
      if (!postData) {
        return false;
      }

      const payload = JSON.parse(postData);

      return Object.entries(params).every(([key, value]) => {
        if (Array.isArray(payload[key])) {
          return Array.isArray(value)
            ? value.every((v) => payload[key].includes(v))
            : payload[key].includes(value);
        }

        return payload[key] === value;
      });
    } catch (e) {
      return false;
    }
  }

  return false;
};

/**
 * Utility to search for a substring anywhere in the request payload
 * @param response - The response to check
 * @param method - The HTTP method (GET, POST, etc.)
 * @param searchString - The string to look for in the request payload
 * @returns boolean indicating if the string was found in the payload
 */
export const searchRequestPayload = (
  response: Response,
  method: string,
  searchString: string
): boolean => {
  if (response.request().method() !== method) {
    return false;
  }

  if (method === 'GET') {
    // For GET requests, check URL
    return response.url().includes(searchString);
  } else if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    // For POST/PUT/PATCH requests, check request body
    try {
      const postData = response.request().postData();
      if (!postData) {
        return false;
      }

      return postData.includes(searchString);
    } catch (e) {
      return false;
    }
  }

  return false;
};
