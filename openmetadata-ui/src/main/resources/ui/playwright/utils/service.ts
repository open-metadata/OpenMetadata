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
import { settingClick, SettingOptionsType } from './sidebar';

export const searchServiceFromSettingPage = async (
  page: Page,
  service: string
) => {
  const serviceResponse = page.waitForResponse(`/api/v1/search/query?q=*`);
  await page.fill('[data-testid="searchbar"]', service);

  await serviceResponse;
};

export const visitServiceDetailsPage = async (
  page: Page,
  service: { type: string; name: string; displayName?: string },
  verifyHeader = false,
  visitChildrenTab = true
) => {
  const serviceResponse = page.waitForResponse('/api/v1/services/*');
  await settingClick(page, service.type as SettingOptionsType);
  await serviceResponse;

  await searchServiceFromSettingPage(page, service.name);

  // Click on created service
  await page.click(`[data-testid="service-name-${service.name}"]`);

  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="loader"]', { state: 'hidden' });

  if (visitChildrenTab) {
    // Click on children tab Ex. DatabaseService -> Databases
    await page.getByRole('tab').nth(1).click();
  }

  await page.waitForLoadState('networkidle');

  if (verifyHeader) {
    const text = await page.textContent(`[data-testid="entity-header-name"]`);

    expect(text).toBe(service.displayName);
  }
};
