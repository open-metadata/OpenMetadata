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
import { Browser, Page, request } from '@playwright/test';
import { randomUUID } from 'crypto';

export const uuid = () => randomUUID().split('-')[0];

export const getToken = async (page: Page) => {
  return page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('om-session') ?? '{}')?.state
        ?.oidcIdToken ?? ''
  );
};

export const getAuthContext = async (token: string) => {
  return await request.newContext({
    extraHTTPHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const redirectToHomePage = async (page: Page) => {
  await page.goto('/');
  await page.waitForURL('**/my-data');
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
    MlModel: 'mlmodel_search_index',
    Container: 'container_search_index',
    SearchIndex: 'search_entity_search_index',
  };

  return entityMapping[entityType];
};
