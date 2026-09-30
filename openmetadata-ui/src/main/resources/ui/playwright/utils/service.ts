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
import { expect, Page, Response } from '@playwright/test';
import { waitForAllLoadersToDisappear } from './entity';
import { settingClick, SettingOptionsType } from './sidebar';
import { waitForResponseWithStatus } from './waitHelpers';

// The child-asset list the AI-mode service details page reads, by service category.
const SERVICE_CHILD_LIST_PATHS: Record<string, string> = {
  databaseServices: 'databases',
  storageServices: 'containers',
  driveServices: 'drives/directories',
};

export const searchServiceFromSettingPage = async (
  page: Page,
  service: string
) => {
  const serviceResponse = page.waitForResponse((response) => {
    const url = response.url();

    return (
      url.includes('/api/v1/search/query') &&
      decodeURIComponent(url).includes(service)
    );
  });
  await page.fill('[data-testid="searchbar"]', service);

  await serviceResponse;
};

export const visitServiceDetailsPage = async (
  page: Page,
  service: { type: string; name: string; displayName?: string },
  verifyHeader = false,
  visitChildrenTab = true
) => {
  const serviceResponse = page.waitForResponse(
    '/api/v1/services/*?fields=owners*'
  );
  await settingClick(page, service.type as SettingOptionsType);
  await serviceResponse;
  await waitForAllLoadersToDisappear(page);

  await searchServiceFromSettingPage(page, service.name);

  // Click on created service
  await page.click(`[data-testid="service-name-${service.name}"]`);

  await waitForAllLoadersToDisappear(page);

  if (visitChildrenTab) {
    // Click on children tab Ex. DatabaseService -> Databases
    await page.getByRole('tab').nth(1).click();
  }

  if (verifyHeader) {
    await expect(page.locator('[data-testid="entity-header-name"]')).toHaveText(
      service.displayName
    );
  }
};

/** The AI-mode service details page's child-asset list request, optionally narrowed by its params. */
export const waitForServiceChildList = (
  page: Page,
  category: string,
  serviceFqn: string,
  matchesParams: (params: URLSearchParams) => boolean = () => true
): Promise<Response> =>
  waitForResponseWithStatus(
    page,
    (response) => {
      const url = new URL(response.url());

      return (
        response.request().method() === 'GET' &&
        url.pathname === `/api/v1/${SERVICE_CHILD_LIST_PATHS[category]}` &&
        url.searchParams.get('service') === serviceFqn &&
        matchesParams(url.searchParams)
      );
    },
    200
  );

/**
 * Opens a service on the AI-mode details page (`/connections/<category>/<fqn>[/<tab>]`) and waits
 * for its child-asset list. The caller puts the page in AI mode first (`enableAiAppMode`).
 */
export const visitAiModeServiceDetailsPage = async (
  page: Page,
  {
    category,
    fqn,
    tab = '',
    query = '',
    include = 'non-deleted',
  }: {
    category: string;
    fqn: string;
    tab?: string;
    query?: string;
    include?: string;
  }
) => {
  const list = waitForServiceChildList(
    page,
    category,
    fqn,
    (params) => params.get('include') === include
  );
  await page.goto(
    `/connections/${category}/${encodeURIComponent(fqn)}${
      tab ? `/${tab}` : ''
    }${query}`,
    { waitUntil: 'domcontentloaded' }
  );
  await list;
  await waitForAllLoadersToDisappear(page);
  await expect(page.getByTestId('entity-header-display-name')).toBeVisible();
};
