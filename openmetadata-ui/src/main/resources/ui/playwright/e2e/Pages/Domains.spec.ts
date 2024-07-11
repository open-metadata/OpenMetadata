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
import test from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { Domain } from '../../support/domain/Domain';
import { getApiContext, redirectToHomePage } from '../../utils/common';
import {
  addAssetsToDomain,
  createDomain,
  setupAssetsForDomain,
  verifyDomain,
} from '../../utils/domain';
import { sidebarClick } from '../../utils/sidebar';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Domains', () => {
  test.beforeEach('Visit home page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Create & verify domain', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    await sidebarClick(page, SidebarItem.DOMAIN);
    await createDomain(page, domain.data, false);
    await verifyDomain(page, domain.data);
    await domain.delete(apiContext);
    await afterAction();
  });

  test('Add assets to domain', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const { assets, assetCleanup } = await setupAssetsForDomain(page);
    const domain = new Domain();
    await domain.create(apiContext);
    await sidebarClick(page, SidebarItem.DOMAIN);
    await page.reload();
    await addAssetsToDomain(page, domain.data, assets);
    await domain.delete(apiContext);
    await assetCleanup();
    await afterAction();
  });
});
