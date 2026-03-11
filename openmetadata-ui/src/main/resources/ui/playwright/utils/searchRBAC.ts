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
import { APIRequestContext, expect, Page } from '@playwright/test';
import { waitForAllLoadersToDisappear } from './entity';

export const enableDisableSearchRBAC = async (
  apiContext: APIRequestContext,
  enable: boolean
) => {
  const settingResponse = await apiContext.get(
    '/api/v1/system/settings/searchSettings'
  );
  const initialSetting = await settingResponse.json();

  const updatedSetting = {
    ...initialSetting,
    config_value: {
      ...initialSetting.config_value,
      globalSettings: {
        ...initialSetting.config_value.globalSettings,
        enableAccessControl: enable,
      },
    },
  };

  await apiContext.put('/api/v1/system/settings', {
    data: updatedSetting,
  });
};

export const searchForEntityShouldWork = async (
  fqn: string,
  displayName: string,
  page: Page
) => {
  // Wait for welcome screen and close it if visible
  const isWelcomeScreenVisible = await page
    .getByTestId('welcome-screen')
    .isVisible();

  if (isWelcomeScreenVisible) {
    await page.getByTestId('welcome-screen-close-btn').click();
  }

  await page.getByTestId('searchBox').click();
  await page.getByTestId('searchBox').fill(fqn);
  await page.getByTestId('searchBox').press('Enter');

  await page.waitForResponse(`api/v1/search/query?**`);

  await page.waitForLoadState('networkidle');
  await waitForAllLoadersToDisappear(page);

  await expect(
    page.locator('[data-testid="entity-header-display-name"]', {
      hasText: displayName,
    })
  ).toBeAttached();

  await page
    .getByTestId('navbar-search-container')
    .getByTestId('cancel-icon')
    .click();
  await page.waitForLoadState('networkidle');
};

export const searchForEntityShouldWorkShowNoResult = async (
  fqn: string,
  displayName: string,
  page: Page
) => {
  // Wait for welcome screen and close it if visible
  const isWelcomeScreenVisible = await page
    .getByTestId('welcome-screen')
    .isVisible();

  if (isWelcomeScreenVisible) {
    await page.getByTestId('welcome-screen-close-btn').click();
  }

  await page.getByTestId('searchBox').click();
  await page.getByTestId('searchBox').fill(fqn);
  await page.getByTestId('searchBox').press('Enter');

  await page.waitForResponse(`api/v1/search/query?**`);

  await page.waitForLoadState('networkidle');
  await waitForAllLoadersToDisappear(page);

  await expect(
    page.locator('[data-testid="entity-header-display-name"]', {
      hasText: displayName,
    })
  ).not.toBeAttached();

  await expect(
    page.getByTestId('no-search-results').getByText('No result found.')
  ).toBeVisible();
  await expect(
    page
      .getByTestId('no-search-results')
      .getByText('Try adjusting your search or')
  ).toBeVisible();

  await page
    .getByTestId('navbar-search-container')
    .getByTestId('cancel-icon')
    .click();

  await page.waitForLoadState('networkidle');
};
