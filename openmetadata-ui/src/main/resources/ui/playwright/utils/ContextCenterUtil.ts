/*
 *  Copyright 2026 Collate.
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
import { APIRequestContext, Browser, Page } from '@playwright/test';
import { PolicyRulesType } from '../support/access-control/PoliciesClass';
import { UserClass } from '../support/user/UserClass';
import { uuid } from './common';
import { waitForAllLoadersToDisappear } from './entity';

export const DASHBOARD_URL = '/context-center/dashboard';
export const ARTICLES_URL = '/context-center/articles';
export const DOCUMENTS_URL = '/context-center/documents';
export const MEMORIES_URL = '/context-center/memories';
export const MEMORIES_API = '/api/v1/contextCenter/memories';

export const navigateToDashboard = async (page: Page) => {
  await page.goto(DASHBOARD_URL);
  await page
    .getByTestId('context-center-dashboard-page')
    .waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);
  // Wait for article section to finish loading (either cards or empty state)
  const section = page.getByTestId('dashboard-detail-card');
  await section.waitFor({ state: 'visible' });
};

export const navigateToArticles = async (page: Page) => {
  await page.goto(ARTICLES_URL);
  await page
    .getByTestId('context-center-articles-page')
    .waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);
};

export const navigateToDocuments = async (page: Page) => {
  await page.goto(DOCUMENTS_URL);
  await page
    .getByTestId('context-center-documents-page')
    .waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);
};

export const navigateToMemories = async (page: Page) => {
  await page.goto(MEMORIES_URL);
  await page
    .getByTestId('context-center-memories-page')
    .waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);
};

export const buildPermissionRule = (
  namePrefix: string,
  resources: string[],
  operations: string[]
): PolicyRulesType[] => [
  {
    name: `${namePrefix}-${uuid()}`,
    resources,
    operations,
    effect: 'allow',
  },
];

export const loginAsUser = async (
  browser: Browser,
  user: UserClass
): Promise<Page> => {
  const page = await browser.newPage();
  await user.login(page);

  return page;
};

export const uploadDisposableDocument = async (
  apiContext: APIRequestContext,
  namePrefix = 'cc-disposable-doc'
): Promise<{ id: string; name: string }> => {
  const name = `${namePrefix}-${uuid()}.txt`;
  const response = await apiContext.post(
    '/api/v1/contextCenter/drive/files/upload',
    {
      multipart: {
        file: {
          name,
          mimeType: 'text/plain',
          buffer: Buffer.from('Playwright disposable document'),
        },
      },
    }
  );
  const data = await response.json();

  return { id: data.id, name };
};

export const createDisposableArchivedDocument = async (
  apiContext: APIRequestContext,
  namePrefix = 'cc-disposable-archived-doc'
): Promise<{ id: string; name: string }> => {
  const { id, name } = await uploadDisposableDocument(apiContext, namePrefix);
  await apiContext.delete(
    `/api/v1/contextCenter/drive/files/${id}?hardDelete=false`
  );

  return { id, name };
};
