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

import { expect, Page } from '@playwright/test';
import { test } from '../../support/fixtures/base';
import { redirectToHomePage } from '../../utils/common';
import { enableAiAppMode } from '../Utils/appMode';

test.use({ storageState: 'playwright/.auth/admin.json' });

// Everything on this page is per device (localStorage / cookie), so each test's
// fresh browser context keeps them from leaking between tests or workers.
const openPreferences = async (page: Page) => {
  await enableAiAppMode(page);
  await redirectToHomePage(page, false);
  await page.getByTestId('ask-ai-user-menu-trigger').click();
  await page.getByTestId('ai-user-menu-profile').click();
  await page.getByTestId('profile-nav-preferences').click();
  await expect(page.getByTestId('preferences-panel')).toBeVisible();
};

const root = (page: Page) => page.locator('html');

test.describe(
  'Profile Preferences',
  { tag: ['@Platform', '@Features'] },
  () => {
    test('theme: an explicit choice applies at once and survives a reload', async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await openPreferences(page);
      await expect(root(page)).not.toHaveClass(/dark-mode/);

      await page.getByTestId('theme-preference-dark').click();
      await expect(root(page)).toHaveClass(/dark-mode/);

      await page.reload();
      await expect(root(page)).toHaveClass(/dark-mode/);

      // The settings modal lives in the URL hash, so the reload reopens it on
      // Preferences; the user-menu trigger is behind its overlay.
      await expect(page.getByTestId('preferences-panel')).toBeVisible();
      await page.getByTestId('theme-preference-light').click();
      await expect(root(page)).not.toHaveClass(/dark-mode/);
    });

    test('theme: System follows the operating system, including live changes', async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await openPreferences(page);
      // Light stays the default until the user chooses System.
      await expect(root(page)).not.toHaveClass(/dark-mode/);

      await page.getByTestId('theme-preference-system').click();
      await expect(root(page)).toHaveClass(/dark-mode/);

      await page.emulateMedia({ colorScheme: 'light' });
      await expect(root(page)).not.toHaveClass(/dark-mode/);

      await page.emulateMedia({ colorScheme: 'dark' });
      await page.reload();
      await expect(root(page)).toHaveClass(/dark-mode/);
    });

    test('compact sidebar: the toggle collapses the open sidebar to the icon rail', async ({
      page,
    }) => {
      await openPreferences(page);
      const sidebar = page.getByTestId('ask-sidebar');
      await expect(sidebar).not.toHaveClass(/ask-sidebar--collapsed/);

      await page.getByTestId('compact-sidebar-toggle').click();
      await expect(sidebar).toHaveClass(/ask-sidebar--collapsed/);

      await page.getByTestId('compact-sidebar-toggle').click();
      await expect(sidebar).not.toHaveClass(/ask-sidebar--collapsed/);
    });

    test('language: choosing a language reloads the app in it', async ({
      page,
    }) => {
      await openPreferences(page);
      await page.getByTestId('language-preference').getByRole('button').click();
      await page.getByRole('option', { name: /FR$/ }).click();

      await expect(page.getByTestId('preferences-panel')).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByText('Langue et région')).toBeVisible();
    });
  }
);
