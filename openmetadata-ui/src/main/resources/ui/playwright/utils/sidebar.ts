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
import { expect, Page } from '@playwright/test';
import {
  SETTINGS_OPTIONS_PATH,
  SETTING_CUSTOM_PROPERTIES_PATH,
} from '../constant/settings';
import { SidebarItem, SIDEBAR_LIST_ITEMS } from '../constant/sidebar';
import { waitForAllLoadersToDisappear } from './entity';
import { waitForAntOverlayToOpen } from './waitHelpers';

export type SettingOptionsType =
  | keyof typeof SETTINGS_OPTIONS_PATH
  | keyof typeof SETTING_CUSTOM_PROPERTIES_PATH;

export const clickOnLogo = async (page: Page) => {
  await page.click('#openmetadata_logo > [data-testid="image"]');
  await page.mouse.move(1280, 0); // Move mouse to top right corner
};

export const clickSidebarLink = async (page: Page, testId: string) => {
  const navigation = page
    .getByTestId('left-sidebar')
    .or(page.locator('.ant-menu-submenu-popup'));
  const targetElement = navigation
    .getByTestId(testId)
    .filter({ visible: true });
  await expect(targetElement).toBeVisible();
  const popup = page
    .locator('.ant-menu-submenu-popup')
    .filter({ has: page.getByTestId(testId) });
  if (await popup.count()) {
    await waitForAntOverlayToOpen(popup);
  }
  await targetElement.focus();
  const href = await targetElement.getAttribute('href');
  await targetElement.click();
  if (href) {
    const pathname = new URL(href, page.url()).pathname;
    // Sections such as Glossary immediately select a child route on entry.
    await expect
      .poll(() => {
        const currentPathname = new URL(page.url()).pathname;

        return (
          currentPathname === pathname ||
          currentPathname.startsWith(`${pathname}/`)
        );
      })
      .toBe(true);
  }
};

export const sidebarClick = async (page: Page, id: string) => {
  // Settings moved to the profile menu in the new shell; the legacy sidebar
  // remains on routes that have not migrated yet.
  if (
    id === SidebarItem.SETTINGS &&
    (await page.getByTestId('ask-sidebar').count()) > 0
  ) {
    await page.getByTestId('ask-ai-user-menu-trigger').click();
    await page.getByTestId('ask-user-menu-settings').click();
    await page.waitForURL('**/settings');

    return;
  }
  const items = SIDEBAR_LIST_ITEMS[id as keyof typeof SIDEBAR_LIST_ITEMS];
  const moduleKeys: Record<string, string> = {
    [SidebarItem.EXPLORE]: 'explore',
    [SidebarItem.OBSERVABILITY]: 'observability',
    [SidebarItem.GOVERNANCE]: 'govern',
    [SidebarItem.DATA_MARKETPLACE_SECTION]: 'marketplace',
    [SidebarItem.CONTEXT_CENTER]: 'context-center',
  };
  const moduleKey = moduleKeys[items?.[0] ?? id];
  if (moduleKey && (await page.getByTestId('ask-sidebar').count()) > 0) {
    // The module navigation replaces hover menus, and either panel can be collapsed.
    const mainItem = page
      .getByTestId(`ask-nav-item-${moduleKey}`)
      .or(page.getByTestId(`ask-rail-item-${moduleKey}`))
      .or(page.getByTestId(`ask-more-nav-item-${moduleKey}`))
      .filter({ visible: true });
    if (!(await mainItem.isVisible())) {
      await page
        .getByTestId('ask-nav-item-more')
        .or(page.getByTestId('ask-rail-item-more'))
        .filter({ visible: true })
        .click();
    }
    await mainItem.click();
    if (items) {
      const subKeys: Record<string, string> = {
        [SidebarItem.INCIDENT_MANAGER]: 'incidents',
        [SidebarItem.OBSERVABILITY_ALERT]: 'alerts',
        [SidebarItem.DOMAIN]: 'domains',
        [SidebarItem.DATA_PRODUCT]: 'data-products',
        [SidebarItem.ARTICLE]: 'articles',
      };
      const subKey = subKeys[id] ?? id;
      await page
        .getByTestId(`ask-sub-panel-item-${subKey}`)
        .or(page.getByTestId(`ask-sub-rail-item-${subKey}`))
        .filter({ visible: true })
        .click();
    }
    await waitForAllLoadersToDisappear(page);

    return;
  }
  if (items) {
    await page.mouse.move(0, 0); // Dismiss any open tooltips before interacting with sidebar
    await page.hover('[data-testid="left-sidebar"]');
    await page.click(`[data-testid="${items[0]}"]`);
  }

  await clickSidebarLink(page, `app-bar-item-${items ? items[1] : id}`);
  await page.mouse.move(1280, 0); // Move mouse to top right corner
};

export const settingClick = async (
  page: Page,
  dataTestId: SettingOptionsType,
  isCustomProperty?: boolean
) => {
  let paths =
    SETTINGS_OPTIONS_PATH[dataTestId as keyof typeof SETTINGS_OPTIONS_PATH];

  if (isCustomProperty) {
    paths =
      SETTING_CUSTOM_PROPERTIES_PATH[
        dataTestId as keyof typeof SETTING_CUSTOM_PROPERTIES_PATH
      ];
  }

  await sidebarClick(page, SidebarItem.SETTINGS);

  for (const path of paths ?? []) {
    await page.click(`[data-testid="${path}"]`);
  }

  await waitForAllLoadersToDisappear(page);
};
