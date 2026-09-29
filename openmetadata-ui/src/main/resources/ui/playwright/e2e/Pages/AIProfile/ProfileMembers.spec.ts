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

import { Page } from '@playwright/test';
import { expect, test } from '../../../support/fixtures/base';
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { enableAiAppMode } from '../../Utils/appMode';

const navigateToMembersPanel = async (page: Page): Promise<void> => {
  await enableAiAppMode(page);
  await redirectToHomePage(page);

  await expect(page.getByTestId('ask-ai-user-menu-trigger')).toBeVisible();

  await page.getByTestId('ask-ai-user-menu-trigger').click();
  await page.getByTestId('ai-user-menu-profile').click();
  await page.getByTestId('ai-profile-page').waitFor();

  await page.getByTestId('profile-nav-members').click();
  await expect(page.getByTestId('members-landing')).toBeVisible();
};

test.describe('AI Profile Members Panel', () => {
  test.beforeAll(async ({ browser }) => {
    const { afterAction } = await performAdminLogin(browser);
    await afterAction();
  });

  test('Should render Members landing with 4 cards', async ({ page }) => {
    await navigateToMembersPanel(page);

    await expect(page.getByTestId('members-card-teams')).toBeVisible();
    await expect(page.getByTestId('members-card-users')).toBeVisible();
    await expect(page.getByTestId('members-card-admins')).toBeVisible();
    await expect(page.getByTestId('members-card-online-users')).toBeVisible();
  });

  test('Should navigate to Teams sub-page from landing card', async ({
    page,
  }) => {
    await navigateToMembersPanel(page);

    await page.getByTestId('members-card-teams').click();

    await expect(page.getByTestId('teams-panel-container')).toBeVisible();
  });

  test('Should navigate to Users sub-page from landing card', async ({
    page,
  }) => {
    await navigateToMembersPanel(page);

    await page.getByTestId('members-card-users').click();

    await expect(page.getByTestId('users-list-container')).toBeVisible();
  });

  test('Should navigate to Admins sub-page from landing card', async ({
    page,
  }) => {
    await navigateToMembersPanel(page);

    await page.getByTestId('members-card-admins').click();

    await expect(page.getByTestId('users-list-container')).toBeVisible();
  });

  test('Should navigate to Online Users sub-page from landing card', async ({
    page,
  }) => {
    await navigateToMembersPanel(page);

    await page.getByTestId('members-card-online-users').click();

    await expect(page.getByTestId('online-users-panel')).toBeVisible();
  });

  test('Should navigate back to landing via breadcrumb', async ({ page }) => {
    await navigateToMembersPanel(page);

    await page.getByTestId('members-card-teams').click();
    await expect(page.getByTestId('teams-panel-container')).toBeVisible();

    // Click the "Members" breadcrumb to go back to landing
    const breadcrumb = page.getByRole('link', { name: 'Members' });

    await breadcrumb.click();

    await expect(page.getByTestId('members-landing')).toBeVisible();
  });
});
