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
import { expect, Locator, Page, test } from '@playwright/test';
import { get } from 'lodash';
import { waitForAllLoadersToDisappear } from './entity';

const DRAWER = '[data-testid="asset-selection-modal"]';
const POPOVER = '[data-testid="drop-down-menu"]';

export interface DrawerAsset {
  name: string;
  fqn: string;
}

export interface DrawerQuickFilterContext {
  surface: string;
  openDrawer: () => Promise<void>;
  closeDrawer: () => Promise<void>;
  table: DrawerAsset;
  untieredTable: DrawerAsset;
  topic: DrawerAsset;
  dashboard: DrawerAsset;
  entityTypeLabel?: string;
  tierLabel?: string;
}

export const toDrawerAsset = (entity: object): DrawerAsset => ({
  name: get(entity, 'entityResponseData.name', ''),
  fqn: get(entity, 'entityResponseData.fullyQualifiedName', ''),
});

const popover = (page: Page): Locator => page.locator(POPOVER);

const optionByValue = (page: Page, value: string): Locator =>
  popover(page).getByTestId(`${value}-checkbox`);

export const openQuickFilter = async (page: Page, label: string) => {
  await page.getByTestId(`search-dropdown-${label}`).click();
  await expect(popover(page)).toBeVisible();
};

export const applyQuickFilter = async (page: Page) => {
  await page.getByTestId('update-btn').click();
  await expect(popover(page)).toBeHidden();
  await waitForAllLoadersToDisappear(page);
};

export const closeQuickFilterPopover = async (page: Page) => {
  await page.getByTestId('close-btn').click();
  await expect(popover(page)).toBeHidden();
};

export const scopeDrawerSearch = async (page: Page, text: string) => {
  await page.locator(DRAWER).getByTestId('searchbar').fill(text);
  await waitForAllLoadersToDisappear(page);
};

export const expectAssetVisible = async (page: Page, fqn: string) => {
  await expect(
    page.locator(DRAWER).locator(`[data-testid="table-data-card_${fqn}"]`)
  ).toBeVisible();
};

export const expectAssetHidden = async (page: Page, fqn: string) => {
  await expect(
    page.locator(DRAWER).locator(`[data-testid="table-data-card_${fqn}"]`)
  ).toBeHidden();
};

const assertPopoverInteractiveAndFiltersOptions = async (
  page: Page,
  entityTypeLabel: string
) => {
  await openQuickFilter(page, entityTypeLabel);

  await expect(optionByValue(page, 'table')).toBeVisible();
  await expect(optionByValue(page, 'topic')).toBeVisible();

  const searchBox = popover(page).getByRole('textbox');
  await searchBox.fill('table');
  await expect(searchBox).toHaveValue('table');
  await expect(optionByValue(page, 'table')).toBeVisible();
  await expect(optionByValue(page, 'topic')).toBeHidden();

  await searchBox.fill('a-non-existent-option-value');
  await expect(popover(page)).toContainText(/no data available/i);

  await closeQuickFilterPopover(page);
};

const assertCloseDiscardsSelection = async (
  page: Page,
  entityTypeLabel: string
) => {
  await openQuickFilter(page, entityTypeLabel);
  await optionByValue(page, 'dashboard').click();
  await closeQuickFilterPopover(page);

  await expect(
    page.getByTestId(`search-dropdown-${entityTypeLabel}`)
  ).not.toContainText('dashboard');
};

const assertApplyNarrowsList = async (
  page: Page,
  ctx: DrawerQuickFilterContext,
  entityTypeLabel: string
) => {
  await openQuickFilter(page, entityTypeLabel);
  await optionByValue(page, 'table').click();
  await applyQuickFilter(page);

  await expect(
    page.getByTestId(`search-dropdown-${entityTypeLabel}`)
  ).toContainText('table');

  await scopeDrawerSearch(page, ctx.topic.name);
  await expectAssetHidden(page, ctx.topic.fqn);
  await scopeDrawerSearch(page, ctx.table.name);
  await expectAssetVisible(page, ctx.table.fqn);
};

const assertCombineFilters = async (
  page: Page,
  ctx: DrawerQuickFilterContext,
  tierLabel: string
) => {
  await openQuickFilter(page, tierLabel);
  await popover(page)
    .getByTestId(/tier1-checkbox$/i)
    .click();
  await applyQuickFilter(page);

  await scopeDrawerSearch(page, ctx.table.name);
  await expectAssetVisible(page, ctx.table.fqn);
  await scopeDrawerSearch(page, ctx.untieredTable.name);
  await expectAssetHidden(page, ctx.untieredTable.fqn);
  await scopeDrawerSearch(page, ctx.topic.name);
  await expectAssetHidden(page, ctx.topic.fqn);
};

export const runDrawerQuickFilterMatrix = async (
  page: Page,
  ctx: DrawerQuickFilterContext
) => {
  const entityTypeLabel = ctx.entityTypeLabel ?? 'Entity Type';
  const tierLabel = ctx.tierLabel ?? 'Tier';

  await ctx.openDrawer();

  await test.step(`[${ctx.surface}] popover is interactive and filters its options`, async () => {
    await assertPopoverInteractiveAndFiltersOptions(page, entityTypeLabel);
  });

  await test.step(`[${ctx.surface}] Close discards the staged selection`, async () => {
    await assertCloseDiscardsSelection(page, entityTypeLabel);
  });

  await test.step(`[${ctx.surface}] selecting + Update narrows the asset list`, async () => {
    await assertApplyNarrowsList(page, ctx, entityTypeLabel);
  });

  await test.step(`[${ctx.surface}] combining filters intersects the results`, async () => {
    await assertCombineFilters(page, ctx, tierLabel);
  });

  await ctx.closeDrawer();
};
