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
      page.getByTestId('page-layout-v1').getByText(item).first()
    ).toBeVisible();
    await expect(
      page
        .getByTestId('page-layout-v1')
        .getByText(item)
        .first()
        .getByRole('switch')
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
        await page.click(`[data-testid="${items[0]}"]`);

        // Wait for dropdown to expand - wait for any child item of the parent to be visible
        // This confirms the dropdown has fully expanded before checking specific items
        // For Observability, wait for at least one of its children to be visible
        const anyChildInDropdown = page
          .locator(`[data-testid="left-sidebar"]`)
          .locator(`[data-testid^="app-bar-item-"]`)
          .first();

        try {
          // Wait for at least one child to be visible (with timeout)
          await anyChildInDropdown.waitFor({ state: 'visible', timeout: 3000 });
        } catch {
          // If no children are visible, the dropdown might not have expanded
          // Wait a bit more and continue
          await page.waitForTimeout(500);
        }

        const childElement = page
          .locator(`[data-testid="app-bar-item-${items[1]}"]`)
          .first();

        if (hiddenItems.includes(items[1])) {
          // For hidden items, they are filtered out from DOM entirely by filterHiddenNavigationItems
          // Check if element exists in DOM
          const elementCount = await childElement.count();

          if (elementCount > 0) {
            // If element exists, it should not be visible
            await expect(childElement).not.toBeVisible();
          }
          // If count is 0, element doesn't exist (expected for hidden items filtered from DOM)
        } else {
          // For visible items, wait for them to be visible (with timeout)
          await childElement.waitFor({ state: 'visible', timeout: 5000 });

          await expect(childElement).toBeVisible();
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
