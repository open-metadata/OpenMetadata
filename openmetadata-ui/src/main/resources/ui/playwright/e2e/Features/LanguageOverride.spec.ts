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
import { expect, test as base, Browser, Page } from '@playwright/test';
import { redirectToHomePage } from '../../utils/common';

const test = base.extend<{ germanLocalePage: Page }>({
  germanLocalePage: async ({ browser }: { browser: Browser }, use) => {
    const context = await browser.newContext({
      locale: 'de-DE',
      storageState: 'playwright/.auth/admin.json',
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

test.describe('Language Override Tests', () => {
  test('App language should override browser language on landing page and user dropdown', async ({
    germanLocalePage,
  }) => {
    test.slow(true);

    await redirectToHomePage(germanLocalePage);

    await germanLocalePage.getByTestId('language-selector-button').waitFor({ state: 'visible' });
    await germanLocalePage.getByTestId('language-selector-button').click();
    await germanLocalePage.waitForSelector('.ant-dropdown', { state: 'visible' });
    await germanLocalePage.getByText('EN', { exact: true }).click();
    await germanLocalePage.waitForLoadState('networkidle');

    await germanLocalePage.locator('[data-testid="dropdown-profile"]').click();
    await germanLocalePage.waitForSelector('[role="menu"].profile-dropdown', {
      state: 'visible',
    });

    const profileDropdown = germanLocalePage.locator('[role="menu"].profile-dropdown');

    await expect(profileDropdown.getByText('View Profile', { exact: true })).toBeVisible();
    await expect(profileDropdown.getByText('Switch Persona', { exact: true })).toBeVisible();
    await expect(profileDropdown.getByText('Roles', { exact: true })).toBeVisible();
    await expect(profileDropdown.getByText('Inherited Roles', { exact: true })).toBeVisible();
    await expect(profileDropdown.getByText('Logout', { exact: true })).toBeVisible();

    await expect(profileDropdown.getByText('Profil anzeigen', { exact: true })).not.toBeVisible();
    await expect(profileDropdown.getByText('Persona wechseln', { exact: true })).not.toBeVisible();
    await expect(profileDropdown.getByText('Rollen', { exact: true })).not.toBeVisible();
    await expect(profileDropdown.getByText('Geerbte Rollen', { exact: true })).not.toBeVisible();
    await expect(profileDropdown.getByText('Abmelden', { exact: true })).not.toBeVisible();
  });
});
