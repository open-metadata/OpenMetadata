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
import { Page } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { Domain } from '../../support/domain/Domain';
import { expect, test as base } from '../../support/fixtures/base';
import { installServerLoadReducers } from '../../support/fixtures/serverLoad';
import { performAdminLogin } from '../../utils/admin';
import { getApiContext, redirectToHomePage } from '../../utils/common';
import {
  addAssetsToDomain,
  addServicesToDomain,
  selectDomain,
  setupAssetsForDomain,
} from '../../utils/domain';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { waitForSearchIndexed } from '../../utils/polling';
import { visitServiceDetailsPage } from '../../utils/service';
import { sidebarClick } from '../../utils/sidebar';
import { setToken } from '../../utils/tokenStorage';

const test = base.extend<{
  page: Page;
  ingestionBotPage: Page;
}>({
  page: async ({ browser }, use) => {
    const { afterAction, page } = await performAdminLogin(browser, {
      navigate: true,
    });

    await use(page);
    await afterAction();
  },
  ingestionBotPage: async ({ browser }, use) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    const bot = await apiContext
      .get('/api/v1/bots/name/ingestion-bot')
      .then((response) => response.json());
    const tokenData = await apiContext
      .get(`/api/v1/users/auth-mechanism/${bot.botUser.id}`)
      .then((response) => response.json());

    const page = await browser.newPage();
    await installServerLoadReducers(page.context());
    await page.goto('/signin', { waitUntil: 'domcontentloaded' });
    // Only localhost/HTTPS are secure contexts, so on the AUT deployments that serve
    // http:// on a hostname `navigator.serviceWorker` is undefined and the app never
    // registers a SW -- there is no clients.claim() race to wait out there.
    await page.waitForFunction(
      () =>
        !('serviceWorker' in navigator) ||
        Boolean(navigator.serviceWorker.controller),
      undefined,
      { timeout: 30_000 }
    );

    await setToken(page, tokenData.config.JWTToken);
    await redirectToHomePage(page);
    await page.locator('loader').waitFor({ state: 'hidden' });

    await expect(page.getByTestId('nav-user-name')).toHaveText('ingestion-bot');

    await use(page);
    await page.close();
    await afterAction();
  },
});

test.describe('Ingestion Bot', () => {
  const domains = [new Domain(), new Domain()];

  test.beforeAll('Create domains', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    try {
      await Promise.all(domains.map((domain) => domain.create(apiContext)));
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Delete domains', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    try {
      await Promise.all(domains.map((domain) => domain.delete(apiContext)));
    } finally {
      await afterAction();
    }
  });

  for (const [index, domain] of domains.entries()) {
    test(`Ingestion bot can access assets and services in domain ${
      index + 1
    }`, async ({ ingestionBotPage, page }) => {
      test.slow();
      const { assets, assetCleanup } = await setupAssetsForDomain(page);
      try {
        const { apiContext, afterAction } = await getApiContext(page);
        try {
          await Promise.all(
            assets.map((asset) =>
              waitForSearchIndexed(
                apiContext,
                asset.entityResponseData.fullyQualifiedName,
                'all'
              )
            )
          );
        } finally {
          await afterAction();
        }

        await test.step('Assign assets to the domain', async () => {
          await sidebarClick(page, SidebarItem.DOMAIN);
          await waitForAllLoadersToDisappear(page);
          await selectDomain(page, domain.data);
          await addAssetsToDomain(page, domain, assets, true, true);
        });

        await test.step('Ingestion bot can access every domain asset', async () => {
          for (const asset of assets) {
            await asset.visitEntityPage(ingestionBotPage);
            await expect(
              ingestionBotPage.getByTestId('permission-error-placeholder')
            ).toBeHidden();
            await expect(
              ingestionBotPage.getByTestId('domain-link')
            ).toHaveText(domain.data.displayName);
          }
        });

        const service = assets[0].get().service;
        const serviceCategory = assets[0].serviceCategory;
        if (!serviceCategory) {
          throw new Error(`Service category is missing for ${service.name}`);
        }
        await test.step('Assign the service to the domain', async () => {
          await sidebarClick(page, SidebarItem.DOMAIN);
          await waitForAllLoadersToDisappear(page);
          await addServicesToDomain(page, domain.data, [service]);
        });

        await test.step('Ingestion bot can access the domain service', async () => {
          await visitServiceDetailsPage(ingestionBotPage, {
            name: service.name,
            type: serviceCategory,
          });
          await expect(
            ingestionBotPage.getByTestId('permission-error-placeholder')
          ).toBeHidden();
          await expect(
            ingestionBotPage.getByTestId('domain-link').first()
          ).toHaveText(domain.data.displayName);
        });
      } finally {
        await assetCleanup();
      }
    });
  }
});
