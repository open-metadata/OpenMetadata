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
  dashboardServices: 'dashboards',
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
      service.displayName ?? service.name
    );
  }
};

/** The AI-mode service details page's child-asset list request, optionally narrowed by its params. */
/** A service's asset list request at `/api/v1/<path>`, optionally narrowed by its params. */
const waitForServiceAssetList = (
  page: Page,
  path: string,
  serviceFqn: string,
  matchesParams: (params: URLSearchParams) => boolean = () => true
): Promise<Response> =>
  waitForResponseWithStatus(
    page,
    (response) => {
      const url = new URL(response.url());

      return (
        response.request().method() === 'GET' &&
        url.pathname === `/api/v1/${path}` &&
        url.searchParams.get('service') === serviceFqn &&
        matchesParams(url.searchParams)
      );
    },
    200
  );

export const waitForServiceChildList = (
  page: Page,
  category: string,
  serviceFqn: string,
  matchesParams?: (params: URLSearchParams) => boolean
): Promise<Response> =>
  waitForServiceAssetList(
    page,
    SERVICE_CHILD_LIST_PATHS[category],
    serviceFqn,
    matchesParams
  );

/**
 * Opens one of the AI-mode service page's secondary asset tabs (a dashboard service's data
 * models, a drive service's files or spreadsheets) and waits for the list that tab requests.
 */
export const openAiModeServiceAssetTab = async (
  page: Page,
  {
    tabName,
    listPath,
    serviceFqn,
  }: { tabName: string; listPath: string; serviceFqn: string }
) => {
  const list = waitForServiceAssetList(page, listPath, serviceFqn);
  // The tab's name carries its count once that loads ("Files 2"), so match the label alone.
  await page
    .getByRole('tab', { name: new RegExp(`^${tabName}( \\d+)?$`) })
    .click();
  await list;
  await waitForAllLoadersToDisappear(page);
};

/**
 * Opens a service on the AI-mode details page (`/connections/<category>/<fqn>/<tab>`) and, on the
 * data-assets tab, waits for its child-asset list. The caller puts the page in AI mode first
 * (`enableAiAppMode`).
 *
 * The tab defaults to `dataAssets` rather than the page's default tab: that is the first tab in
 * `order`, and a plugin can contribute tabs ahead of the built-ins (Collate puts Summary first), so
 * a bare service URL does not land on the data assets everywhere.
 */
export const visitAiModeServiceDetailsPage = async (
  page: Page,
  {
    category,
    fqn,
    tab = 'dataAssets',
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
  // Only the data-assets tab requests the list; another tab, or the tab a gated deep link falls
  // back to, may never send it.
  const list =
    tab === 'dataAssets' &&
    waitForServiceChildList(
      page,
      category,
      fqn,
      (params) => params.get('include') === include
    );
  await page.goto(
    `/connections/${category}/${encodeURIComponent(fqn)}/${tab}${query}`,
    { waitUntil: 'domcontentloaded' }
  );
  await list;
  await waitForAllLoadersToDisappear(page);
  await expect(page.getByTestId('entity-header-display-name')).toBeVisible();
};
