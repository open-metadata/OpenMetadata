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
import {
  createBot,
  deleteBot,
  redirectToBotPage,
  tokenExpirationForDays,
  tokenExpirationUnlimitedDays,
  updateBotDetails,
  verifyGenerateTokenAPIContract,
} from '../../utils/bot';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe(
  'Bots Page should work properly',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    test.slow(true);

    test('Bots Page should work properly', async ({ page }) => {
      await redirectToBotPage(page);

      await test.step(
        'Verify ingestion bot delete button is always disabled',
        async () => {
          await expect(
            page.getByTestId('bot-delete-ingestion-bot')
          ).toBeDisabled();
        }
      );

      await test.step('Create Bot', async () => {
        await createBot(page);
      });

      await test.step('Update display name and description', async () => {
        await updateBotDetails(page);
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
