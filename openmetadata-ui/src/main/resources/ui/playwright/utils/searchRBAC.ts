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
import { SidebarItem } from '../constant/sidebar';
import { redirectToHomePage } from './common';
import { waitForAllLoadersToDisappear } from './entity';
import { sidebarClick } from './sidebar';

const closeWelcomeScreenIfVisible = async (page: Page) => {
  const isWelcomeScreenVisible = await page
    .getByTestId('welcome-screen')
    .isVisible();

  if (isWelcomeScreenVisible) {
    await page.getByTestId('welcome-screen-close-btn').click();
  }
};

/**
 * Navigate the given (already-logged-in) user to the Explore page, search for an
 * entity by FQN, and assert whether its result card is shown — used to verify
 * that browse/search results honor the per-user search RBAC policies.
 */
export const exploreShouldShowEntity = async (
  page: Page,
  fqn: string,
  displayName: string,
  shouldSee: boolean
) => {
  await closeWelcomeScreenIfVisible(page);
  await redirectToHomePage(page);

  const exploreRes = page.waitForResponse('/api/v1/search/query?*');
  await sidebarClick(page, SidebarItem.EXPLORE);
  await exploreRes;
  await waitForAllLoadersToDisappear(page);

  const searchRes = page.waitForResponse('/api/v1/search/query?*');
  await page.getByTestId('searchBox').fill(fqn);
  await page.getByTestId('searchBox').press('Enter');
  await searchRes;
  await waitForAllLoadersToDisappear(page);

  const resultCard = page
    .getByTestId('search-container')
    .locator('[data-testid="entity-header-display-name"]', {
      hasText: displayName,
    });

  if (shouldSee) {
    await expect(resultCard.first()).toBeVisible();
  } else {
    await expect(resultCard).toHaveCount(0);
  }
};

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
};
