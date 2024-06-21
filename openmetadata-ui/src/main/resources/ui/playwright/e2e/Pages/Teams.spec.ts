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
import test, { expect } from '@playwright/test';
import { GlobalSettingOptions } from '../../constant/settings';
import { redirectToHomePage } from '../../utils/common';
import { settingClick } from '../../utils/sidebar';
import { createTeam, hardDeleteTeam } from '../../utils/team';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Teams Page', () => {
  test.beforeEach('Visit Home Page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Create a new public team', async ({ page }) => {
    await settingClick(page, GlobalSettingOptions.TEAMS);

    await page.waitForSelector('[data-testid="add-team"]');

    await page.getByTestId('add-team').click();

    const publicTeam = await createTeam(page, true);

    await page.getByRole('link', { name: publicTeam.displayName }).click();

    await page
      .getByTestId('team-details-collapse')
      .getByTestId('manage-button')
      .click();

    await expect(page.locator('button[role="switch"]')).toHaveAttribute(
      'aria-checked',
      'true'
    );

    await page.click('body'); // Equivalent to clicking outside

    await hardDeleteTeam(page);
  });

  test('Create a new private team', async ({ page }) => {
    await settingClick(page, GlobalSettingOptions.TEAMS);

    await page.waitForSelector('[data-testid="add-team"]');

    await page.getByTestId('add-team').click();

    const publicTeam = await createTeam(page);

    await page.getByRole('link', { name: publicTeam.displayName }).click();

    await page
      .getByTestId('team-details-collapse')
      .getByTestId('manage-button')
      .click();

    await expect(page.locator('button[role="switch"]')).toHaveAttribute(
      'aria-checked',
      'false'
    );

    await page.click('body'); // Equivalent to clicking outside

    await hardDeleteTeam(page);
  });
});
