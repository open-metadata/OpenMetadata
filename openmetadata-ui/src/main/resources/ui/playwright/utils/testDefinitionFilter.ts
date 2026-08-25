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

import { expect, Page, Response } from '@playwright/test';
import { redirectToHomePage } from './common';
import { waitForAllLoadersToDisappear } from './entity';

export const navigateToTestLibrary = async (page: Page) => {
  await redirectToHomePage(page);
  const testDefinitionResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/dataQuality/testDefinitions') &&
      response.request().method() === 'GET'
  );
  await page.goto('/test-library');
  await testDefinitionResponse;
  await waitForAllLoadersToDisappear(page);
};

export const openFilterDropdown = async (page: Page, filterLabel: string) => {
  await page.getByTestId(`search-dropdown-${filterLabel}`).click();
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
  await openFilterDropdown(page, filterLabel);

  const option = page.getByTestId(optionKey);
  await expect(option).toBeVisible();
  await option.click();

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
