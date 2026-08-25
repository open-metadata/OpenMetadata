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
import { expect, test } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import {
  BOT_DETAILS,
  createBot,
  deleteBot,
  redirectToBotPage,
  searchBotFromSearchInput,
  tokenExpirationForDays,
  tokenExpirationUnlimitedDays,
  updateBotDetails,
  verifyGenerateTokenAPIContract,
} from '../../utils/bot';
import { waitForAllLoadersToDisappear } from '../../utils/entity';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe(
  'Bots Page should work properly',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    test.slow(true);

    test('Bots Page should work properly', async ({ page }) => {
      await redirectToBotPage(page);

      await test.step('Verify ingestion bot delete button is always disabled', async () => {
        await searchBotFromSearchInput(page, 'ingestion');

        await expect(
          page.getByTestId('bot-delete-ingestion-bot')
        ).toBeDisabled();
      });

      await test.step('Create Bot', async () => {
        await createBot(page);
      });

      await test.step('Update display name and description', async () => {
        await updateBotDetails(page);
      });

      await redirectToBotPage(page);

      const searchInput = page.getByTestId('searchbar');
      const createdBotLink = page.getByTestId(
        `bot-link-${BOT_DETAILS.updatedBotName}`
      );

      await test.step('Search bot by display name', async () => {
        await searchBotFromSearchInput(page, BOT_DETAILS.updatedBotName);

        await expect(createdBotLink).toBeVisible();
      });

      await test.step('Search bot by bot name', async () => {
        await searchBotFromSearchInput(page, BOT_DETAILS.botName);

        await expect(createdBotLink).toBeVisible();
      });

      await test.step('Search bot by email', async () => {
        await searchBotFromSearchInput(page, BOT_DETAILS.botEmail);

        await expect(createdBotLink).toBeVisible();
      });

      await test.step('Search with no match shows empty state', async () => {
        await searchBotFromSearchInput(
          page,
          `${BOT_DETAILS.updatedBotName}-no-match`
        );

        await expect(
          page.getByTestId('search-error-placeholder')
        ).toBeVisible();
      });

      await test.step('Clear search restores full list', async () => {
        await searchInput.clear();
        await searchInput.fill('');
        await expect(searchInput).toHaveValue('');
        await waitForAllLoadersToDisappear(page);

        await expect(createdBotLink).toBeVisible();
      });

      await test.step('Verify generateToken API contract', async () => {
        await verifyGenerateTokenAPIContract(page);
      });

      await test.step('Update token expiration', async () => {
        await redirectToBotPage(page);
        await tokenExpirationForDays(page);
        await tokenExpirationUnlimitedDays(page);
      });

      await test.step('Delete Bot', async () => {
        await deleteBot(page);
      });
    });
  }
);
