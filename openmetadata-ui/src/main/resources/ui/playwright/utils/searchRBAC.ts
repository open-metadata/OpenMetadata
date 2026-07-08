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

  await page.getByTestId('searchBox').fill(fqn);
  // Register the results-page listener AFTER fill() and BEFORE press('Enter').
  // fill() itself can fire an autocomplete query whose URL matches
  // /api/v1/search/query?*, which would resolve a pre-registered listener on
  // that early response — leaving the actual results-page query never awaited
  // and the assertions below running against stale autocomplete UI. This
  // mirrors the ordering fix already applied in searchForEntityShouldWork.
  const searchRes = page.waitForResponse('/api/v1/search/query?*');
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
    // RBAC enforcement against newly-assigned user roles lags the patch
    // call by several seconds — the search-index user doc needs to update
    // before queries get filtered against the role's policies. Use a
    // longer timeout on the negative assertion so the result-card has
    // time to drop out as the role takes effect.
    await expect(resultCard).toHaveCount(0, { timeout: 45_000 });
  }
};

/**
 * Navigate the (already-logged-in) user to Explore and assert which top-level
 * browse-tree categories are shown. A category only appears when its filtered
 * count is non-zero, so this proves the tree counts honor search RBAC — a user
 * with no access to an asset type never sees that category (no count leakage).
 */
export const exploreTreeCategories = async (
  page: Page,
  { visible, hidden }: { visible: string[]; hidden: string[] }
) => {
  await closeWelcomeScreenIfVisible(page);
  await redirectToHomePage(page);

  const exploreRes = page.waitForResponse('/api/v1/search/query?*');
  await sidebarClick(page, SidebarItem.EXPLORE);
  await exploreRes;
  await waitForAllLoadersToDisappear(page);

  // The explore tree fires multiple aggregation queries to compute per-category
  // counts; the tree DOM updates asynchronously as those resolve. Poll the
  // category visibility/absence assertions to ride out renders that haven't
  // settled yet, rather than relying on a single search-query wait.
  await expect(async () => {
    for (const category of visible) {
      await expect(
        page.getByTestId(`explore-tree-title-${category}`)
      ).toBeVisible({ timeout: 2_000 });
    }
    for (const category of hidden) {
      await expect(
        page.getByTestId(`explore-tree-title-${category}`)
      ).toHaveCount(0, { timeout: 2_000 });
    }
  }).toPass({ timeout: 20_000, intervals: [500, 1_000, 2_000] });
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

  // Register waitForResponse BEFORE the action that triggers it. Registering
  // after `press('Enter')` is racy — the search response can return before
  // the listener is attached, leaving the assertion to run against stale UI
  // state.
  const searchResponse = page.waitForResponse(`api/v1/search/query?**`);
  await page.getByTestId('searchBox').press('Enter');
  await searchResponse;

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

  // Register waitForResponse BEFORE the action that triggers it. See the
  // matching note in searchForEntityShouldWork for why.
  const searchResponse = page.waitForResponse(`api/v1/search/query?**`);
  await page.getByTestId('searchBox').press('Enter');
  await searchResponse;

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
