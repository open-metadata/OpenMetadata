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

export const updatePersonaDisplayName = async ({
  page,
  displayName,
}: {
  page: Page;
  displayName: string;
}) => {
  await page.click('[data-testid="manage-button"]');

  await page.click(
    '[data-testid="manage-dropdown-list-container"] [data-testid="rename-button"]'
  );

  await page.waitForSelector('#name', { state: 'visible' });

  await expect(page.locator('#name')).toBeDisabled();

  await page.waitForSelector('#displayName', { state: 'visible' });
  await page.fill('#displayName', displayName);

  await page.click('[data-testid="save-button"]');
};
