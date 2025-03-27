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
import { SidebarItem } from '../../constant/sidebar';
import { Domain } from '../../support/domain/Domain';
import { AdminClass } from '../../support/user/AdminClass';
import { performAdminLogin } from '../../utils/admin';
import { getApiContext, redirectToHomePage } from '../../utils/common';
import {
  addAssetsToDomain,
  addServicesToDomain,
  selectDomain,
  setupAssetsForDomain,
} from '../../utils/domain';
import { visitServiceDetailsPage } from '../../utils/service';
import { sidebarClick } from '../../utils/sidebar';

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
        JSON.stringify({ oidcIdToken: token })
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

  test.slow();

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
      await addAssetsToDomain(page, domain1, domainAsset1);

      // Add assets to domain 2
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain2.data);
      await addAssetsToDomain(page, domain2, domainAsset2);
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

    await test.step('Assign services to domains', async () => {
      // Add assets to domain 1
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain1.data);
      await addServicesToDomain(page, domain1.data, [
        domainAsset1[0].get().service,
      ]);

      // Add assets to domain 2
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain2.data);
      await addServicesToDomain(page, domain2.data, [
        domainAsset2[0].get().service,
      ]);
    });

    await test.step(
      'Ingestion bot should access domain assigned services',
      async () => {
        await redirectToHomePage(ingestionBotPage);

        // Check if services is searchable and accessible or not
        await visitServiceDetailsPage(ingestionBotPage, {
          name: domainAsset1[0].get().service.name,
          type: domainAsset1[0].serviceCategory,
        });

        // check if service has domain or not
        await expect(
          ingestionBotPage.getByTestId('domain-link').first()
        ).toHaveText(domain1.data.displayName);
      }
    );

    await assetCleanup1();
    await assetCleanup2();
  });
});
