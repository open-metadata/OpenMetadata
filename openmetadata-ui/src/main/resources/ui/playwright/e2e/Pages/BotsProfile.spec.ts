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
import { expect, test } from '../../support/fixtures/base';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage, uuid } from '../../utils/common';
import { enableAiAppMode } from '../Utils/appMode';

test.use({ storageState: 'playwright/.auth/admin.json' });

const BOT_NAME = `pw-bot-${uuid()}`;
const BOT_EMAIL = `${BOT_NAME}@test.com`;

const goToBotsPanel = async (page: Page) => {
  await enableAiAppMode(page);
  await redirectToHomePage(page);

  await expect(page.getByTestId('ask-ai-user-menu-trigger')).toBeVisible();

  await page.getByTestId('ask-ai-user-menu-trigger').click();
  await page.getByTestId('ai-user-menu-profile').click();
  await page.getByTestId('ai-profile-page').waitFor();

  await page.getByTestId('profile-nav-bots').click();

  await expect(page.getByTestId('bots-list-panel')).toBeVisible();
};

const searchBot = async (page: Page, term: string) => {
  const searchResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.request().method() === 'GET'
  );

  await page.getByTestId('searchbar').getByRole('textbox').fill(term);
  await searchResponsePromise;
};

test.describe('Bots Panel in AI Profile Modal', { tag: '@basic' }, () => {
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await apiContext.put('/api/v1/users', {
        data: {
          email: BOT_EMAIL,
          name: BOT_NAME,
          displayName: BOT_NAME,
          isBot: true,
          isAdmin: false,
          botName: BOT_NAME,
          domains: [],
          authenticationMechanism: {
            authType: 'JWT',
            config: { JWTTokenExpiry: 'Unlimited' },
          },
        },
      });

      await apiContext.post('/api/v1/bots', {
        data: {
          botUser: BOT_NAME,
          name: BOT_NAME,
          displayName: BOT_NAME,
        },
      });
    } finally {
      await afterAction();
    }
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await apiContext.delete(`/api/v1/bots/name/${BOT_NAME}?hardDelete=true`);
    } catch {
      // best-effort cleanup
    } finally {
      await afterAction();
    }
  });

  test('should navigate to bots panel', async ({ page }) => {
    await goToBotsPanel(page);

    await expect(
      page.getByTestId('searchbar').getByRole('textbox')
    ).toBeVisible();
  });

  test('should verify system bot cannot be deleted', async ({ page }) => {
    await goToBotsPanel(page);

    await searchBot(page, 'ingestion');

    await expect(page.getByTestId('bot-delete-ingestion-bot')).toBeDisabled();
  });

  test('should create bot via add form', async ({ page }) => {
    await goToBotsPanel(page);

    await page.getByTestId('add-bot').click();

    await expect(page.getByTestId('bot-add-form')).toBeVisible();

    const formBotName = `pw-form-bot-${uuid()}`;
    const formBotEmail = `${formBotName}@test.com`;

    await page.getByTestId('email').getByRole('textbox').fill(formBotEmail);
    await page
      .getByTestId('displayName')
      .getByRole('textbox')
      .fill(formBotName);

    await page.getByTestId('token-expiry').getByRole('button').click();
    await page.getByRole('option', { name: '1 hour' }).click();

    const userResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/users') &&
        response.request().method() === 'PUT'
    );
    const botResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/bots') &&
        response.request().method() === 'POST'
    );

    await page.getByTestId('submit-btn').click();
    await userResponsePromise;
    await botResponsePromise;

    await expect(page.getByTestId('bots-list-panel')).toBeVisible();
  });

  test('should search bots from list', async ({ page }) => {
    await goToBotsPanel(page);

    await searchBot(page, BOT_NAME);

    await expect(page.getByTestId(`bot-link-${BOT_NAME}`)).toBeVisible();
  });

  test('should show bot detail and edit description', async ({ page }) => {
    await goToBotsPanel(page);

    await searchBot(page, BOT_NAME);
    await page.getByTestId(`bot-link-${BOT_NAME}`).click();

    await expect(page.getByTestId('bot-detail-container')).toBeVisible();

    const editDescButton = page.getByTestId('edit-description-btn');

    await expect(editDescButton).toBeVisible();
    await editDescButton.click();

    await expect(page.getByTestId('edit-description-modal')).toBeVisible();
  });

  test('should show token section', async ({ page }) => {
    await goToBotsPanel(page);

    await searchBot(page, BOT_NAME);
    await page.getByTestId(`bot-link-${BOT_NAME}`).click();

    await expect(page.getByTestId('token-section')).toBeVisible();
  });

  test('should toggle show deleted', async ({ page }) => {
    await goToBotsPanel(page);

    await expect(page.getByTestId('switch-deleted')).toBeVisible();
  });
});
