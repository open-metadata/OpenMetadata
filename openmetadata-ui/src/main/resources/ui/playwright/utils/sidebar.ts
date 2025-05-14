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
import { Page } from '@playwright/test';
import {
  SETTINGS_OPTIONS_PATH,
  SETTING_CUSTOM_PROPERTIES_PATH,
} from '../constant/settings';
import { SidebarItem, SIDEBAR_LIST_ITEMS } from '../constant/sidebar';

export type SettingOptionsType =
  | keyof typeof SETTINGS_OPTIONS_PATH
  | keyof typeof SETTING_CUSTOM_PROPERTIES_PATH;

export const clickOnLogo = async (page: Page) => {
  await page.click('#openmetadata_logo > [data-testid="image"]');
  await page.mouse.move(1280, 0); // Move mouse to top right corner
};

export const sidebarClick = async (page: Page, id: string) => {
  const items = SIDEBAR_LIST_ITEMS[id as keyof typeof SIDEBAR_LIST_ITEMS];
  if (items) {
    await page.hover('[data-testid="left-sidebar"]');
    await page.waitForTimeout(300);
    await page.click(`[data-testid="${items[0]}"]`);
    await page.click(`[data-testid="app-bar-item-${items[1]}"]`);
  } else {
    await page.click(`[data-testid="app-bar-item-${id}"]`);
  }

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

  await page.waitForLoadState('networkidle');
};
