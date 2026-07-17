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
import { expect, Page } from '@playwright/test';

export const expectBreadcrumbCrumbsUnique = async (page: Page) => {
  const breadcrumb = page.getByTestId('breadcrumb');

  await expect(breadcrumb).toBeVisible();

  const crumbLabels = (await breadcrumb.getByRole('listitem').allInnerTexts())
    .map((label) => label.trim())
    .filter((label) => label.length > 0);

  expect(crumbLabels.length).toBeGreaterThan(0);
  expect(new Set(crumbLabels).size).toBe(crumbLabels.length);
};

// The DataAssetsHeader breadcrumb auto-collapses: when the trail is too wide for
// its row, the middle crumbs move into a `…` overflow menu (the first + current
// crumbs always stay inline). These helpers read/navigate ancestors whether a
// crumb is rendered inline or hidden behind that menu, so callers stay valid at
// any viewport width.
export const openBreadcrumbOverflowMenu = async (page: Page) => {
  await page
    .getByTestId('breadcrumb')
    .getByRole('button', { name: 'Show hidden breadcrumbs' })
    .click();

  return page.getByRole('menu', { name: 'Hidden breadcrumbs' });
};

export const expectBreadcrumbToContainAncestor = async (
  page: Page,
  name: string
) => {
  const breadcrumb = page.getByTestId('breadcrumb');
  await expect(breadcrumb).toBeVisible();

  const inlineCrumb = breadcrumb.getByText(name);

  if ((await inlineCrumb.count()) > 0) {
    await expect(inlineCrumb.first()).toBeVisible();
  } else {
    const menu = await openBreadcrumbOverflowMenu(page);
    await expect(menu).toContainText(name);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  }
};

export const clickBreadcrumbAncestor = async (page: Page, name: string) => {
  const breadcrumb = page.getByTestId('breadcrumb');
  await expect(breadcrumb).toBeVisible();

  const inlineLink = breadcrumb.getByRole('link', { name });

  if ((await inlineLink.count()) > 0) {
    await inlineLink.click();
  } else {
    await openBreadcrumbOverflowMenu(page);
    // The overflow menu is a single-selection react-aria menu, so its entries
    // expose the `menuitemradio` role (not `menuitem`).
    await page.getByRole('menuitemradio', { name }).click();
  }
};
