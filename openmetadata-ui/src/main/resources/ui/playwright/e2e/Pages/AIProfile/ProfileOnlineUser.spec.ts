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

import { performAdminLogin } from '../../../utils/admin';
import {
  navigateToMembersPanel,
  openOnlineUsersPanel,
} from '../../../utils/aiProfile';
import { redirectToHomePage } from '../../../utils/common';
import { expect, test } from '../../fixtures/pages';
import { enableAiAppMode } from '../../Utils/appMode';

// Ports e2e/Features/OnlineUsers.spec.ts onto the AI-mode Online Users panel.
// The classic antd `.ant-select-dropdown` + positional `td:nth-child` selectors
// are rewritten to the core-ui Select (`getByRole('option')`) and named columns.

test.describe('AI Profile Online Users', () => {
  test.beforeAll(async ({ browser }) => {
    const { afterAction } = await performAdminLogin(browser);
    await afterAction();
  });

  test('Should render the online users table with headers and default window', async ({
    page,
  }) => {
    await navigateToMembersPanel(page);
    await openOnlineUsersPanel(page);

    await expect(page.getByTestId('online-users-table')).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Username' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Last Activity' })
    ).toBeVisible();
    await expect(page.getByTestId('time-window-select')).toContainText(
      'Last 24 hours'
    );
  });

  test('Should filter online users by time window', async ({ page }) => {
    await navigateToMembersPanel(page);
    await openOnlineUsersPanel(page);

    const filtered = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/users/online') &&
        response.url().includes('timeWindow=60')
    );
    await page.getByTestId('time-window-select').click();
    await page.getByRole('option', { name: 'Last hour' }).click();
    await filtered;

    await expect(page.getByTestId('online-users-table')).toBeVisible();
  });

  test('Should not list bots among online users', async ({ page }) => {
    await navigateToMembersPanel(page);
    await openOnlineUsersPanel(page);

    await expect(page.getByTestId('online-users-table')).not.toContainText(
      'ingestion-bot'
    );
  });

  test('Non-admin users cannot access the Members surface', async ({
    dataConsumerPage,
  }) => {
    await enableAiAppMode(dataConsumerPage);
    await redirectToHomePage(dataConsumerPage);

    await expect(
      dataConsumerPage.getByTestId('ask-ai-user-menu-trigger')
    ).toBeVisible();
    await dataConsumerPage.getByTestId('ask-ai-user-menu-trigger').click();
    await dataConsumerPage.getByTestId('ai-user-menu-profile').click();
    await dataConsumerPage.getByTestId('ai-profile-page').waitFor();

    await expect(
      dataConsumerPage.getByTestId('profile-nav-members')
    ).toBeHidden();
  });
});
