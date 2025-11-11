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
import { clickOutside, redirectToHomePage } from './common';

export const redirectToUserPage = async (page: Page) => {
  await redirectToHomePage(page);

  await page.getByTestId('dropdown-profile').click();

  // Hover on the profile avatar to close the name tooltip
  await page.getByTestId('profile-avatar').first().hover();

  await page.waitForSelector('.profile-dropdown', { state: 'visible' });

  const getUserDetails = page.waitForResponse(`/api/v1/users/name/*`);

  await page.locator('.profile-dropdown').getByTestId('user-name').click();

  await getUserDetails;

  // Close the profile dropdown
  await clickOutside(page);
};
