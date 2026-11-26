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

import { expect, Locator, Page, Response } from '@playwright/test';
import {
  redirectToHomePage,
  scrollIntoViewAndSettle,
  selectOptionWithRetry,
} from './common';
import { waitForAllLoadersToDisappear } from './entity';

export const navigateToTestLibrary = async (page: Page) => {
  await redirectToHomePage(page);
  const testDefinitionResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/dataQuality/testDefinitions') &&
      response.request().method() === 'GET'
  );
  await page.goto('/test-library', { waitUntil: 'domcontentloaded' });
  await testDefinitionResponse;
  await waitForAllLoadersToDisappear(page);
};

// The label test id sits on the trigger's text span; aria-expanded is on the
// button around it.
const filterTrigger = (page: Page, filterLabel: string): Locator =>
  page
    .getByRole('button')
    .filter({ has: page.getByTestId(`search-dropdown-${filterLabel}`) });

// After paging, the list can leave the page scrolled below the filters. The
// click's own scroll then reaches react-aria a frame after the menu opened, and
// it closes the non-modal popover on that ancestor scroll.
export const openFilterDropdown = async (page: Page, filterLabel: string) => {
  const trigger = filterTrigger(page, filterLabel);
  await scrollIntoViewAndSettle(trigger);
  await trigger.click();
  await expect(page.getByTestId('drop-down-menu')).toBeVisible();
};

export const closeFilterDropdown = async (page: Page) => {
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('drop-down-menu')).not.toBeVisible();
};

export const toggleFilter = async (
  page: Page,
  filterLabel: string,
  optionKey: string
): Promise<Response> => {
  await selectOptionWithRetry(
    filterTrigger(page, filterLabel),
    page.getByTestId('drop-down-menu').getByTestId(optionKey)
  );

  const updateResponse = page.waitForResponse((response) =>
    response.url().includes('/api/v1/dataQuality/testDefinitions')
  );

  const updateBtn = page.getByTestId('update-btn');
  await expect(updateBtn).toBeVisible();
  await expect(updateBtn).toBeEnabled();
  await updateBtn.click();

  const response = await updateResponse;
  await waitForAllLoadersToDisappear(page);

  return response;
};
