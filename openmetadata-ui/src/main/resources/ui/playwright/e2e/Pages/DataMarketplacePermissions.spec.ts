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
import base, { expect, Page } from '@playwright/test';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  navigateToMarketplace,
  searchMarketplace,
  verifyGreetingBanner,
} from '../../utils/dataMarketplace';
import { waitForAllLoadersToDisappear } from '../../utils/entity';

const domain = new Domain();
const dp = new DataProduct([domain]);
const consumerUser = new UserClass();

const test = base.extend<{
  adminPage: Page;
  consumerPage: Page;
}>({
  adminPage: async ({ browser }, use) => {
    const page = await browser.newPage({
      storageState: 'playwright/.auth/admin.json',
    });
    await use(page);
    await page.close();
  },
  consumerPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await consumerUser.login(page);
    await use(page);
    await page.close();
  },
});

test.describe(
  'Data Marketplace - Permissions',
  { tag: ['@Pages', '@Discovery'] },
  () => {
    test.beforeAll('Setup entities', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await domain.create(apiContext);
      await dp.create(apiContext);
      await consumerUser.create(apiContext);

      await afterAction();
    });

    test.afterAll('Cleanup entities', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await consumerUser.delete(apiContext);
      await dp.delete(apiContext);
      await domain.delete(apiContext);

      await afterAction();
    });

    test('Admin sees add buttons and customize button', async ({
      adminPage,
    }) => {
      test.slow();

      await test.step('Navigate to marketplace as admin', async () => {
        await navigateToMarketplace(adminPage);
      });

      await test.step('Verify admin action buttons', async () => {
        await expect(
          adminPage.getByTestId('add-data-product-btn')
        ).toBeVisible();
        await expect(adminPage.getByTestId('add-domain-btn')).toBeVisible();
      });

      await test.step('Verify greeting banner shows admin name', async () => {
        await verifyGreetingBanner(adminPage, 'admin');
      });
    });

    test('Data consumer does NOT see add buttons', async ({ consumerPage }) => {
      test.slow();

      await test.step('Navigate to marketplace as consumer', async () => {
        await consumerPage.goto('/data-marketplace');
        await waitForAllLoadersToDisappear(consumerPage);
      });

      await test.step('Verify add buttons are not visible', async () => {
        await expect(
          consumerPage.getByTestId('add-data-product-btn')
        ).not.toBeVisible();
        await expect(
          consumerPage.getByTestId('add-domain-btn')
        ).not.toBeVisible();
      });

      await test.step('Verify consumer can still see widgets and greeting', async () => {
        await expect(
          consumerPage.getByTestId('marketplace-dp-widget')
        ).toBeVisible();
        await expect(
          consumerPage.getByTestId('marketplace-domains-widget')
        ).toBeVisible();
        await expect(
          consumerPage.getByTestId('marketplace-greeting')
        ).toBeVisible();
        await expect(
          consumerPage.getByTestId('marketplace-search-bar')
        ).toBeVisible();
      });

      await test.step('Verify greeting banner shows consumer name', async () => {
        const name =
          consumerUser.responseData.displayName ??
          consumerUser.responseData.name;
        await verifyGreetingBanner(consumerPage, name);
      });
    });

    test('Data consumer can search and view results', async ({
      consumerPage,
    }) => {
      test.slow();

      await test.step('Navigate to marketplace as consumer', async () => {
        await consumerPage.goto('/data-marketplace');
        await waitForAllLoadersToDisappear(consumerPage);
      });

      await test.step('Search and verify results appear', async () => {
        await searchMarketplace(consumerPage, dp.data.displayName);
        await expect(
          consumerPage.getByTestId(`search-result-dp-${dp.responseData.id}`)
        ).toBeVisible();
      });

      await test.step('Click result and verify navigation', async () => {
        const resultItem = consumerPage.getByTestId(
          `search-result-dp-${dp.responseData.id}`
        );
        await resultItem.dispatchEvent('click');
        await consumerPage.waitForURL('**/data-marketplace/data-products/**');
      });
    });
  }
);
