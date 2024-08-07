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
import test, { expect } from '@playwright/test';
import { Operation } from 'fast-json-patch';
import { get } from 'lodash';
import { SidebarItem } from '../../constant/sidebar';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { ENTITY_PATH } from '../../support/entity/Entity.interface';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { getApiContext, redirectToHomePage } from '../../utils/common';
import {
  addAssetsToDataProduct,
  addAssetsToDomain,
  checkAssetsCount,
  createDataProduct,
  createDomain,
  removeAssetsFromDataProduct,
  selectDataProduct,
  selectDomain,
  setupAssetsForDomain,
  verifyDomain,
} from '../../utils/domain';
import { sidebarClick } from '../../utils/sidebar';
import { performUserLogin, visitUserProfilePage } from '../../utils/user';

test.describe('Domains', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test.slow(true);

  test.beforeEach('Visit home page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Create domains and add assets', async ({ page }) => {
    const { assets, assetCleanup } = await setupAssetsForDomain(page);
    const domain = new Domain();

    await test.step('Create domain', async () => {
      await sidebarClick(page, SidebarItem.DOMAIN);
      await createDomain(page, domain.data, false);
      await verifyDomain(page, domain.data);
    });

    await test.step('Add assets to domain', async () => {
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.DOMAIN);
      await addAssetsToDomain(page, domain.data, assets);
    });

    await test.step('Delete domain using delete modal', async () => {
      await page.getByTestId('manage-button').click();
      await page.getByTestId('delete-button-title').click();

      await expect(
        page
          .locator('.ant-modal-title')
          .getByText(`Delete domain "${domain.data.displayName}"`)
      ).toBeVisible();

      await page.getByTestId('confirmation-text-input').click();
      await page.getByTestId('confirmation-text-input').fill('DELETE');

      const deleteRes = page.waitForResponse('/api/v1/domains/*');

      await page.getByTestId('confirm-button').click();

      await deleteRes;

      await expect(
        page.getByText(`"${domain.data.displayName}" deleted`)
      ).toBeVisible();
    });

    await assetCleanup();
  });

  test('Create DataProducts and add remove assets', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const { assets, assetCleanup } = await setupAssetsForDomain(page);
    const domain = new Domain();
    const dataProduct1 = new DataProduct(domain);
    const dataProduct2 = new DataProduct(domain);
    await domain.create(apiContext);
    await sidebarClick(page, SidebarItem.DOMAIN);
    await page.reload();
    await addAssetsToDomain(page, domain.data, assets);

    await test.step('Create DataProducts', async () => {
      await selectDomain(page, domain.data);
      await createDataProduct(page, dataProduct1.data);
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain.data);
      await createDataProduct(page, dataProduct2.data);
    });

    await test.step('Add assets to DataProducts', async () => {
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDataProduct(page, domain.data, dataProduct1.data);
      await addAssetsToDataProduct(page, dataProduct1.data, assets);
    });

    await test.step('Remove assets from DataProducts', async () => {
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDataProduct(page, domain.data, dataProduct1.data);
      await removeAssetsFromDataProduct(page, dataProduct1.data, assets);
      await checkAssetsCount(page, 0);
    });

    await dataProduct1.delete(apiContext);
    await dataProduct2.delete(apiContext);
    await domain.delete(apiContext);
    await assetCleanup();
    await afterAction();
  });

  test('Switch domain from navbar and check domain query call warp in quotes', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    await domain.create(apiContext);
    await page.getByTestId('domain-dropdown').click();
    await page
      .locator(
        `[data-menu-id*="${domain.data.name}"] > .ant-dropdown-menu-title-content`
      )
      .click();

    await redirectToHomePage(page);

    const queryRes = page.waitForRequest(
      '/api/v1/search/query?*index=dataAsset*'
    );
    await sidebarClick(page, SidebarItem.EXPLORE);
    const response = await queryRes;
    const url = new URL(response.url());
    const queryParams = new URLSearchParams(url.search);
    const qParam = queryParams.get('q');
    const fqn = (domain.data.fullyQualifiedName ?? '').replace(/"/g, '\\"');

    expect(qParam).toContain(`(domain.fullyQualifiedName:"${fqn}")`);

    await domain.delete(apiContext);
    await afterAction();
  });

  test('Rename domain', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const { assets, assetCleanup } = await setupAssetsForDomain(page);
    const domain = new Domain();
    await domain.create(apiContext);
    await sidebarClick(page, SidebarItem.DOMAIN);
    await page.reload();
    await addAssetsToDomain(page, domain.data, assets);
    await page.getByTestId('documentation').click();
    const updatedDomainName = 'PW Domain Updated';

    await page.getByTestId('manage-button').click();
    await page.getByTestId('rename-button-title').click();
    await page.locator('#displayName').click();
    await page.locator('#displayName').fill(updatedDomainName);
    await page.getByTestId('save-button').click();

    await expect(page.getByTestId('entity-header-display-name')).toContainText(
      'PW Domain Updated'
    );

    await checkAssetsCount(page, assets.length);
    await domain.delete(apiContext);
    await assetCleanup();
    await afterAction();
  });
});

test.describe('Domains Rbac', () => {
  test.slow(true);

  const domain1 = new Domain();
  const domain2 = new Domain();
  const domain3 = new Domain();
  const user1 = new UserClass();

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction, page } = await performAdminLogin(browser);
    await domain1.create(apiContext);
    await domain2.create(apiContext);
    await domain3.create(apiContext);
    await user1.create(apiContext);

    const domainPayload: Operation[] = [
      {
        op: 'add',
        path: '/domains/0',
        value: {
          id: domain1.responseData.id,
          type: 'domain',
        },
      },
      {
        op: 'add',
        path: '/domains/1',
        value: {
          id: domain3.responseData.id,
          type: 'domain',
        },
      },
    ];

    await user1.patch({ apiContext, patchData: domainPayload });

    // Add domain role to the user
    await visitUserProfilePage(page, user1.responseData.name);
    await page
      .getByTestId('user-profile')
      .locator('.ant-collapse-expand-icon')
      .click();
    await page.getByTestId('edit-roles-button').click();

    await page
      .getByTestId('select-user-roles')
      .getByLabel('Select roles')
      .click();
    await page.getByText('Domain Only Access Role').click();
    await page.click('body');
    const patchRes = page.waitForResponse('/api/v1/users/*');
    await page.getByTestId('inline-save-btn').click();
    await patchRes;
    await afterAction();
  });

  test('Domain Rbac', async ({ browser }) => {
    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const { page: userPage, afterAction: afterActionUser1 } =
      await performUserLogin(browser, user1);

    const { assets: domainAssset1, assetCleanup: assetCleanup1 } =
      await setupAssetsForDomain(page);
    const { assets: domainAssset2, assetCleanup: assetCleanup2 } =
      await setupAssetsForDomain(page);

    await test.step('Assign assets to domains', async () => {
      // Add assets to domain 1
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain1.data);
      await addAssetsToDomain(page, domain1.data, domainAssset1);

      // Add assets to domain 2
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain2.data);
      await addAssetsToDomain(page, domain2.data, domainAssset2);
    });

    await test.step('User with access to multiple domains', async () => {
      await userPage
        .getByTestId('domain-dropdown')
        .getByRole('img')
        .first()
        .click();

      await expect(
        userPage
          .getByRole('menuitem', { name: domain1.data.displayName })
          .locator('span')
      ).toBeVisible();
      await expect(
        userPage
          .getByRole('menuitem', { name: domain3.data.displayName })
          .locator('span')
      ).toBeVisible();

      for (const asset of domainAssset2) {
        const fqn = encodeURIComponent(
          get(asset, 'entityResponseData.fullyQualifiedName', '')
        );

        const assetData = userPage.waitForResponse(
          `/api/v1/${asset.endpoint}/name/${fqn}*`
        );
        await userPage.goto(`/${ENTITY_PATH[asset.endpoint]}/${fqn}`);
        await assetData;

        await expect(
          userPage.getByTestId('permission-error-placeholder')
        ).toHaveText(
          'You don’t have access, please check with the admin to get permissions'
        );
      }

      await afterActionUser1();
    });

    await domain1.delete(apiContext);
    await domain2.delete(apiContext);
    await domain3.delete(apiContext);
    await user1.delete(apiContext);
    await assetCleanup1();
    await assetCleanup2();
    await afterAction();
  });
});
