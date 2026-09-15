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
import { PLAYWRIGHT_INGESTION_TAG_OBJ } from '../../constant/config';
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import { expect, test } from '../../support/fixtures/base';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { waitForServiceConnectionForm } from '../../utils/serviceIngestion';

test.use({ storageState: 'playwright/.auth/admin.json' });

const service = new DatabaseServiceClass();

// Visits the service page first so it sits behind the edit form in history —
// both bugs are about leaving the form again. Navigated by URL rather than
// through the Connection tab on purpose: opening the form that way re-serialises
// the connection config, so an untouched form still produces a non-empty patch
// and the nothing-to-save path is never reached.
const openEditConnection = async (page: Page) => {
  const servicePath = `/service/databaseServices/${service.entityResponseData.name}`;

  await redirectToHomePage(page);
  await page.goto(servicePath);
  await waitForAllLoadersToDisappear(page);

  await page.goto(`${servicePath}/connection/edit-connection`);
  await waitForAllLoadersToDisappear(page);
  await waitForServiceConnectionForm(page);
};

test.describe(
  'Edit connection form navigation',
  PLAYWRIGHT_INGESTION_TAG_OBJ,
  () => {
    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await service.create(apiContext);
      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await service.delete(apiContext);
      await afterAction();
    });

    test('discarding a back navigation leaves the form on the first attempt', async ({
      page,
    }) => {
      test.slow();

      await openEditConnection(page);

      await test.step('Back on the connection step prompts', async () => {
        await page.getByTestId('previous-button').click();

        await expect(page.getByTestId('navigation-guard-modal')).toBeVisible();
      });

      await test.step('Discard returns to the service page', async () => {
        await page.getByTestId('navigation-guard-discard').click();

        // Assert the edit segment is gone rather than that the service name is
        // present — the edit route contains the name too, so a looser check
        // passes while the form is still open.
        await expect(page).not.toHaveURL(/edit-connection/);
        await expect(page).toHaveURL(
          new RegExp(
            `/service/databaseServices/${service.entityResponseData.name}`
          )
        );
      });
    });
  }
);
