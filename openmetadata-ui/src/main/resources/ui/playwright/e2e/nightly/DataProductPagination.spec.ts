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
import base, { expect, Page } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { sidebarClick } from '../../utils/sidebar';

const domain = new Domain();

const test = base.extend<{ page: Page }>({
  page: async ({ browser }, setPage) => {
    const { page, afterAction } = await performAdminLogin(browser, {
      navigate: true,
    });
    await setPage(page);
    await afterAction();
  },
});

test.describe('Data Product Pagination', () => {
  test.beforeAll('Setup domain', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await domain.create(apiContext);
    await afterAction();
  });

  test.afterAll('Cleanup domain', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await domain.delete(apiContext);
    await afterAction();
  });

  test.beforeEach('Visit home page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Pagination', async ({ page }) => {
    const dataProducts: DataProduct[] = [];

    await test.step('Create 30 test data products', async () => {
      const { apiContext, afterAction } = await performAdminLogin(
        page.context().browser()!
      );

      for (let i = 0; i < 30; i++) {
        const dp = new DataProduct([domain]);
        await dp.create(apiContext);
        dataProducts.push(dp);
      }

      await afterAction();
    });

    await test.step('Navigate to Data Products page', async () => {
      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('Verify pagination controls are visible', async () => {
      await expect(page.getByTestId('pagination')).toBeVisible();
      await expect(page.getByTestId('page-indicator')).toContainText('Page 1');
      await expect(page.getByTestId('previous')).toBeDisabled();
    });

    await test.step('Navigate to page 2', async () => {
      await page.getByTestId('next').click();
      await waitForAllLoadersToDisappear(page);

      await expect(page.getByTestId('page-indicator')).toContainText('Page 2');
    });

    await test.step('Navigate back to page 1', async () => {
      await page.getByTestId('previous').click();
      await waitForAllLoadersToDisappear(page);

      await expect(page.getByTestId('page-indicator')).toContainText('Page 1');
    });

    await test.step('Cleanup test data products', async () => {
      const { apiContext, afterAction } = await performAdminLogin(
        page.context().browser()!
      );

      for (const dp of dataProducts) {
        await dp.delete(apiContext);
      }

      await afterAction();
    });
  });
});
