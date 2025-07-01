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
import { SidebarItem, SIDEBAR_LIST_ITEMS } from '../constant/sidebar';
import { PersonaClass } from '../support/persona/PersonaClass';

const NAV_ITEMS = [
  'Explore',
  'Lineage',
  'Observability',
  'Data Quality',
  'Incident Manager',
  'Alerts',
  'Insights',
  'Domains',
  'Govern',
  'Glossary',
  'Classification',
  'Metrics',
];

export const checkDefaultStateForNavigationTree = async (page: Page) => {
  for (const item of NAV_ITEMS) {
    await expect(
      page.getByTestId('page-layout-v1').getByText(item)
    ).toBeVisible();
    await expect(
      page.getByTestId('page-layout-v1').getByText(item).getByRole('switch')
    ).toBeChecked();
  }
};

export const validateLeftSidebarWithHiddenItems = async (
  page: Page,
  hiddenItems: string[]
) => {
  for (const item of Object.values(SidebarItem)) {
    // Dropdown items are handled differently
    if (
      item === SidebarItem.OBSERVABILITY ||
      item === SidebarItem.GOVERNANCE ||
      item === SidebarItem.DOMAINS
    ) {
      await expect(page.getByTestId(item)).toBeVisible();
    } else {
      const items = SIDEBAR_LIST_ITEMS[item as keyof typeof SIDEBAR_LIST_ITEMS];

      if (items) {
        await page.hover('[data-testid="left-sidebar"]');
        await page.waitForTimeout(300);
        await page.click(`[data-testid="${items[0]}"]`);

        if (hiddenItems.includes(items[1])) {
          await expect(
            page.getByTestId(`app-bar-item-${items[1]}`)
          ).not.toBeVisible();
        } else {
          await expect(
            page.getByTestId(`app-bar-item-${items[1]}`)
          ).toBeVisible();
        }

        await page.click(`[data-testid="${items[0]}"]`);

        await page.mouse.move(1280, 0); // Move mouse to top right corner

        continue;
      }
      hiddenItems.includes(item)
        ? await expect(
            page.getByTestId('left-sidebar').getByTestId(`app-bar-item-${item}`)
          ).not.toBeVisible()
        : await expect(
            page.getByTestId('left-sidebar').getByTestId(`app-bar-item-${item}`)
          ).toBeVisible();
    }
  }
};

export const selectPersona = async (page: Page, persona: PersonaClass) => {
  await page.getByTestId('dropdown-profile').click();
  await page
    .getByTestId('persona-label')
    .getByText(persona.data.displayName)
    .click();
  await page.waitForLoadState('networkidle');
};
