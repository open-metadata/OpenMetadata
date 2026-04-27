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

export const navigateToMarketplace = async (page: Page) => {
  await redirectToHomePage(page);
  await sidebarClick(page, SidebarItem.DATA_MARKETPLACE);
  await waitForAllLoadersToDisappear(page);
};

export const searchMarketplace = async (page: Page, term: string) => {
  const searchWrapper = page.getByTestId('marketplace-search-input');
  await expect(searchWrapper).toBeVisible();
  const searchInput = searchWrapper.locator('input');
  await searchInput.clear();
  await searchInput.fill(term);

  const searchResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.status() === 200
  );
  await searchInput.press('Enter');
  await searchResponse;
};

export const closeSearchPopover = async (page: Page) => {
  const searchWrapper = page.getByTestId('marketplace-search-input');
  const searchInput = searchWrapper.locator('input');
  await searchInput.clear();
  await expect(page.locator('.marketplace-search-results')).not.toBeVisible();
};

export const verifyGreetingBanner = async (page: Page, displayName: string) => {
  await expect(page.getByTestId('marketplace-greeting')).toBeVisible();
  await expect(page.getByTestId('greeting-text')).toContainText(displayName);
};

export const createAnnouncementViaApi = async (
  apiContext: APIRequestContext,
  entityLink: string,
  message: string,
  description: string
) => {
  const startTime = Date.now();
  const endTime = startTime + 86400 * 1000;
  const response = await apiContext.post('/api/v1/announcements', {
    data: {
      displayName: message,
      description,
      entityLink,
      startTime,
      endTime,
    },
  });
  expect(response.ok()).toBeTruthy();

  return response.json();
};

export const deleteAnnouncementViaApi = async (
  apiContext: APIRequestContext,
  announcementId: string
) => {
  await apiContext.delete(`/api/v1/announcements/${announcementId}`);
};
