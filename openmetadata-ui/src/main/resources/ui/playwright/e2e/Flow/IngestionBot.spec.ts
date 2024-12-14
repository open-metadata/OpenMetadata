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
import { GlobalSettingOptions } from '../../constant/settings';
import { SidebarItem } from '../../constant/sidebar';
import { Domain } from '../../support/domain/Domain';
import { AdminClass } from '../../support/user/AdminClass';
import { performAdminLogin } from '../../utils/admin';
import { getApiContext, redirectToHomePage } from '../../utils/common';
import {
  addAssetsToDomain,
  selectDomain,
  setupAssetsForDomain,
} from '../../utils/domain';
import { settingClick, sidebarClick } from '../../utils/sidebar';

const test = base.extend<{
  page: Page;
  ingestionBotPage: Page;
}>({
  page: async ({ browser }, use) => {
    const adminUser = new AdminClass();
    const adminPage = await browser.newPage();
    await adminUser.login(adminPage);
    await use(adminPage);
    await adminPage.close();
  },
  ingestionBotPage: async ({ browser }, use) => {
    const admin = new AdminClass();
    const page = await browser.newPage();

    // login with admin user
    await admin.login(page);
    await page.waitForURL('**/my-data');

    const { apiContext } = await getApiContext(page);

    const bot = await apiContext
      .get('/api/v1/bots/name/ingestion-bot')
      .then((response) => response.json());
    const tokenData = await apiContext
      .get(`/api/v1/users/auth-mechanism/${bot.botUser.id}`)
      .then((response) => response.json());

    await page.evaluate((token) => {
      // Set a new value for a key in localStorage
      localStorage.setItem(
        'om-session',
        JSON.stringify({ state: { oidcIdToken: token } })
      );
    }, tokenData.config.JWTToken);

    // await afterAction();
    await use(page);
    await page.close();
  },
});

test.describe('Ingestion Bot ', () => {
  const domain1 = new Domain();
  const domain2 = new Domain();
  const domain3 = new Domain();

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction, page } = await performAdminLogin(browser);
    await redirectToHomePage(page);
    await Promise.all([
      domain1.create(apiContext),
      domain2.create(apiContext),
      domain3.create(apiContext),
    ]);

    await afterAction();
  });

  test.afterAll('Cleanup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await Promise.all([
      domain1.delete(apiContext),
      domain2.delete(apiContext),
      domain3.delete(apiContext),
    ]);
    await afterAction();
  });

  test.beforeEach('Visit entity details page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Ingestion bot should be able to access domain specific domain', async ({
    ingestionBotPage,
    page,
  }) => {
    const { assets: domainAsset1, assetCleanup: assetCleanup1 } =
      await setupAssetsForDomain(page);
    const { assets: domainAsset2, assetCleanup: assetCleanup2 } =
      await setupAssetsForDomain(page);

    await test.step('Assign assets to domains', async () => {
      // Add assets to domain 1
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain1.data);
      await addAssetsToDomain(page, domain1.data, domainAsset1);

      // Add assets to domain 2
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain2.data);
      await addAssetsToDomain(page, domain2.data, domainAsset2);
    });

    await test.step(
      'Ingestion bot should access domain assigned assets',
      async () => {
        await redirectToHomePage(ingestionBotPage);

        // Check if entity page is accessible & it has domain
        for (const asset of domainAsset1) {
          await asset.visitEntityPage(ingestionBotPage);

          await expect(
            ingestionBotPage.getByTestId('permission-error-placeholder')
          ).not.toBeVisible();

          await expect(ingestionBotPage.getByTestId('domain-link')).toHaveText(
            domain1.data.displayName
          );
        }
        // Check if entity page is accessible & it has domain
        for (const asset of domainAsset2) {
          await asset.visitEntityPage(ingestionBotPage);

          await expect(
            ingestionBotPage.getByTestId('permission-error-placeholder')
          ).not.toBeVisible();

          await expect(ingestionBotPage.getByTestId('domain-link')).toHaveText(
            domain2.data.displayName
          );
        }
      }
    );

    // Need backend change to support this tests
    test.fixme(
      'Ingestion bot should able to access services irrespective of domain',
      async () => {
        await redirectToHomePage(page);
        // change domain
        await ingestionBotPage.getByTestId('domain-dropdown').click();
        await ingestionBotPage
          .locator(
            `[data-menu-id*="${domain1.data.name}"] > .ant-dropdown-menu-title-content`
          )
          .click();

        //   validate service list

        await settingClick(ingestionBotPage, GlobalSettingOptions.DATABASES);
        const rowKeys = await ingestionBotPage.waitForSelector(
          '[data-row-key=*]'
        );

        expect(rowKeys).not.toHaveLength(0);
      }
    );

    await assetCleanup1();
    await assetCleanup2();
  });
});
