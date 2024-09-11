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
import { expect, Page, test as base } from '@playwright/test';
import { BotClass } from '../../support/bot/BotClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  createBot,
  deleteBot,
  getCreatedBot,
  redirectToBotPage,
  tokenExpirationForDays,
  tokenExpirationUnlimitedDays,
  updateBotDetails,
} from '../../utils/bot';

const adminUser = new UserClass();
const bot = new BotClass();
const bot2 = new BotClass();

const test = base.extend<{ adminPage: Page }>({
  adminPage: async ({ browser }, use) => {
    const adminPage = await browser.newPage();
    await adminUser.login(adminPage);
    await use(adminPage);
    await adminPage.close();
  },
});

test.describe.skip('Bots Page should work properly', () => {
  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await adminUser.create(apiContext);
    await adminUser.setAdminRole(apiContext);
    await bot.create(apiContext);
    await bot2.create(apiContext);
    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await adminUser.delete(apiContext);
    await bot.delete(apiContext);
    await bot2.delete(apiContext);
    await afterAction();
  });

  test('Verify ingestion bot delete button is always disabled', async ({
    adminPage,
  }) => {
    await redirectToBotPage(adminPage);

    await expect(
      adminPage.getByTestId('bot-delete-ingestion-bot')
    ).toBeDisabled();
  });

  test('Create and Delete Bot', async ({ adminPage }) => {
    await redirectToBotPage(adminPage);
    await createBot(adminPage);
    await deleteBot(adminPage);
  });

  test('Update display name and description', async ({ adminPage }) => {
    await redirectToBotPage(adminPage);
    await updateBotDetails(adminPage, bot.responseData);
  });

  test('Update token expiration', async ({ adminPage }) => {
    test.slow(true);

    await redirectToBotPage(adminPage);
    await getCreatedBot(adminPage, bot2.responseData.name);
    await tokenExpirationForDays(adminPage);
    await tokenExpirationUnlimitedDays(adminPage);
  });
});
