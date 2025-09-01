/*
 *  Copyright 2025 Collate.
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
import { test } from '@playwright/test';
import { DATA_ASSETS_SORT } from '../../constant/explore';
import { SidebarItem } from '../../constant/sidebar';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { EntityDataClassCreationConfig } from '../../support/entity/EntityDataClass.interface';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import { selectSortOrder, verifyEntitiesAreSorted } from '../../utils/explore';
import { sidebarClick } from '../../utils/sidebar';

const creationConfig: EntityDataClassCreationConfig = {
  all: true,
  table: true,
  entityDetails: true,
  topic: true,
  dashboard: true,
  mlModel: true,
  pipeline: true,
  dashboardDataModel: true,
  apiCollection: true,
  searchIndex: true,
  container: true,
  storedProcedure: true,
  apiEndpoint: true,
  database: true,
  databaseSchema: true,
  metric: true,
};

test.describe('Explore Sort Order Filter', () => {
  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    test.slow(true);

    const { apiContext, afterAction } = await performAdminLogin(browser);
    await EntityDataClass.preRequisitesForTests(apiContext, creationConfig);
    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    test.slow(true);

    const { apiContext, afterAction } = await performAdminLogin(browser);
    await EntityDataClass.postRequisitesForTests(apiContext);
    await afterAction();
  });

  DATA_ASSETS_SORT.forEach(({ name, filter }) => {
    test(`${name}`, async ({ browser }) => {
      test.slow(true);

      const { page, afterAction } = await performAdminLogin(browser);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.EXPLORE);

      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: 'Data Assets' }).click();

      await page.waitForSelector(
        'data-testid="drop-down-menu" data-testid="loader"',
        {
          state: 'detached',
        }
      );

      await page.waitForSelector(`[data-testid="${filter}-checkbox"]`, {
        state: 'visible',
      });
      await page.getByTestId(`${filter}-checkbox`).check();
      await page.getByTestId('update-btn').click();

      await selectSortOrder(page, 'Name');
      await verifyEntitiesAreSorted(page);

      await page.getByRole('button', { name: 'Data Assets' }).click();

      await page.waitForSelector(
        'data-testid="drop-down-menu" data-testid="loader"',
        {
          state: 'detached',
        }
      );

      await page.waitForSelector(`[data-testid="${filter}-checkbox"]`, {
        state: 'visible',
      });
      await page.getByTestId(`${filter}-checkbox`).uncheck();
      await page.getByTestId('update-btn').click();

      await afterAction();
    });
  });
});
