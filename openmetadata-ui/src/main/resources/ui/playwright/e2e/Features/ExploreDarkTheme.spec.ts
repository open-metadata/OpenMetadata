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
import { Page } from '@playwright/test';
import { expect, test } from '../fixtures/pages';

const setDarkMode = async (page: Page, dark: boolean) => {
  // Both shells expose the same switch, with different profile triggers.
  const profile = page.locator(
    '[data-testid="dropdown-profile"]:visible, [data-testid="ask-ai-user-menu-trigger"]:visible'
  );
  await profile.click();
  const toggle = page.getByRole('switch', { name: 'Dark mode', exact: true });
  if ((await toggle.isChecked()) !== dark) {
    await toggle.press('Space');
  }
  await page.keyboard.press('Escape');
  if (await toggle.isVisible()) {
    await profile.click();
  }
};

test('Explore selection colors adapt to dark mode and restore the light appearance', async ({
  page,
}) => {
  await page.goto('/explore');
  await expect(page.getByTestId('sorting-dropdown-label')).toBeVisible();

  const readBrowseStyle = () =>
    page.getByTestId('browse-chip-entityType').evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        color: style.color,
        border: style.borderColor,
        height: element.getBoundingClientRect().height,
      };
    });

  await setDarkMode(page, false);
  await page.getByTestId('explore-tree-title-Databases').click();
  await expect(page.getByTestId('browse-chip-entityType')).toBeVisible();
  const lightBrowseStyle = await readBrowseStyle();

  await setDarkMode(page, true);
  const darkBrowseStyle = await readBrowseStyle();
  expect(darkBrowseStyle.background).not.toBe(lightBrowseStyle.background);
  expect(darkBrowseStyle.color).not.toBe(lightBrowseStyle.color);
  expect(darkBrowseStyle.height).toBe(lightBrowseStyle.height);

  await page.getByTestId('sorting-dropdown-label').click();
  const currentSort = page.getByRole('menuitemradio', {
    name: 'Popularity',
    exact: true,
  });
  await expect(currentSort).toHaveAttribute('aria-checked', 'true');
  const selectedBackground = await currentSort.evaluate(
    (element) =>
      getComputedStyle(element.firstElementChild ?? element).backgroundColor
  );
  expect(selectedBackground).not.toBe('rgba(0, 0, 0, 0)');
  await page.getByRole('menuitemradio', { name: 'Name', exact: true }).click();
  await expect(page.getByTestId('sorting-dropdown-label')).toHaveText('Name');
  await page.getByTestId('sorting-dropdown-label').click();
  await expect(
    page.getByRole('menuitemradio', { name: 'Name', exact: true })
  ).toHaveAttribute('aria-checked', 'true');
  await page
    .getByRole('menuitemradio', { name: 'Name', exact: true })
    .press('Escape');
  await expect(
    page.getByRole('menuitemradio', { name: 'Name', exact: true })
  ).not.toBeVisible();

  await setDarkMode(page, false);
  expect(await readBrowseStyle()).toEqual(lightBrowseStyle);
  await page.getByTestId('remove-browse-chip-entityType').click();
  await expect(page.getByTestId('browse-chip-entityType')).not.toBeVisible();
});
