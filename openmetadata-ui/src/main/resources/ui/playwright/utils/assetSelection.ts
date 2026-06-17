/*
 *  Copyright 2025 Collate.
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
import { expect, Page } from '@playwright/test';
import { waitForAllLoadersToDisappear } from './entity';

/**
 * Quick filters rendered inside the "Add Assets" dialog for the Domain / Data
 * Product / Input-Output Port surfaces (DOMAIN_DATAPRODUCT_DROPDOWN_ITEMS).
 */
export const DOMAIN_DATA_PRODUCT_ASSET_FILTERS = [
  'Entity Type',
  'Owners',
  'Tag',
  'Tier',
  'Service',
  'Service Type',
];

/**
 * Opens a quick-filter dropdown inside the "Add Assets" dialog and waits for its
 * options (or empty state) to settle.
 */
const openAssetFilterDropdown = async (page: Page, filterName: string) => {
  await page.getByTestId(`search-dropdown-${filterName}`).click();

  await page.getByTestId('drop-down-menu').waitFor();
  await waitForAllLoadersToDisappear(page);
};

/**
 * With an "Add Assets" quick-filter dropdown already open, selects the first
 * available option, applies it via Update and asserts the filter took effect (a
 * query_filter search fires and the clear-filter affordance appears), then
 * clears it. When the filter has no aggregation buckets in the current scope it
 * simply closes — every drawer surface scopes assets differently, so not every
 * filter has data to apply.
 *
 * The clear-filter affordance is only rendered when a quick filter is applied,
 * so it is the reliable signal that the option was actually selectable — the
 * functional regression guard for the non-interactive popup bug.
 */
const applyFirstOptionOrClose = async (page: Page) => {
  const options = page.locator(
    '[data-testid="drop-down-menu"] .ant-dropdown-menu-item'
  );

  if ((await options.count()) === 0) {
    await page.getByTestId('close-btn').click();

    return;
  }

  const filterResponse = page.waitForResponse(
    '/api/v1/search/query?*query_filter=*'
  );

  await options.first().click();
  await page.getByTestId('update-btn').click();

  await filterResponse;

  const clearFilter = page.locator(
    '.asset-filters-wrapper .text-primary.cursor-pointer'
  );
  await expect(clearFilter).toBeVisible();

  const clearResponse = page.waitForResponse('/api/v1/search/query?*');
  await clearFilter.click();
  await clearResponse;
};

/**
 * Opens a quick-filter dropdown and applies + clears its first option. Works for
 * both the modal and the drawer variants of the "Add Assets" dialog.
 */
export const applyAndClearFirstAssetFilterOption = async (
  page: Page,
  filterName: string
) => {
  await openAssetFilterDropdown(page, filterName);
  await applyFirstOptionOrClose(page);
};

/**
 * Drawer-only verification of a single quick filter: opens it, asserts the popup
 * renders inside the drawer dialog (the structural regression guard — a popup
 * portalled to document.body lands outside the react-aria focus scope and turns
 * non-interactive), then applies + clears its first option.
 */
export const verifyAssetFilterInteractive = async (
  page: Page,
  filterName: string
) => {
  await openAssetFilterDropdown(page, filterName);

  await expect(
    page.locator('[role="dialog"] [data-testid="drop-down-menu"]')
  ).toBeVisible();

  await applyFirstOptionOrClose(page);
};

/**
 * Verifies the options list inside an "Add Assets" quick-filter dropdown can be
 * scrolled with the mouse wheel. Directly targets the "cannot scroll" symptom:
 * react-aria's usePreventScroll blocks wheel events outside the drawer's scroll
 * region when the popup is portalled to document.body.
 */
export const verifyAssetFilterDropdownScrollable = async (
  page: Page,
  filterName: string
) => {
  await openAssetFilterDropdown(page, filterName);

  const optionsList = page.locator(
    '[data-testid="drop-down-menu"] .ant-dropdown-menu'
  );
  await optionsList.waitFor();

  const isScrollable = await optionsList.evaluate(
    (el) => el.scrollHeight > el.clientHeight + 5
  );

  if (isScrollable) {
    await optionsList.hover();
    await page.mouse.wheel(0, 240);

    await expect
      .poll(async () => optionsList.evaluate((el) => el.scrollTop), {
        timeout: 5000,
      })
      .toBeGreaterThan(0);
  }

  await page.getByTestId('close-btn').click();
};

/**
 * Full interactive verification of the "Add Assets" filter dropdowns for the
 * Domain / Data Product / Port drawer surfaces. Assumes the drawer is already
 * open. Asserts every filter is visible, that each filter's popup renders inside
 * the drawer dialog and can be applied, and that the options list scrolls.
 */
export const verifyDrawerAssetFilters = async (page: Page) => {
  await expect(page.locator('.asset-filters-wrapper')).toBeVisible();
  await expect(
    page.locator('.asset-filters-wrapper .explore-quick-filters-container')
  ).toBeVisible();

  for (const filterName of DOMAIN_DATA_PRODUCT_ASSET_FILTERS) {
    await expect(
      page.getByTestId(`search-dropdown-${filterName}`)
    ).toBeVisible();
  }

  await waitForAllLoadersToDisappear(page);

  await verifyAssetFilterDropdownScrollable(page, 'Entity Type');

  for (const filterName of DOMAIN_DATA_PRODUCT_ASSET_FILTERS) {
    await verifyAssetFilterInteractive(page, filterName);
  }
};
