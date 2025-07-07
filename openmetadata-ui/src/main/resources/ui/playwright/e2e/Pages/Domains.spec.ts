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
import base, { APIRequestContext, expect, Page } from '@playwright/test';
import { Operation } from 'fast-json-patch';
import { get } from 'lodash';
import { SidebarItem } from '../../constant/sidebar';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { SubDomain } from '../../support/domain/SubDomain';
import {
  EntityTypeEndpoint,
  ENTITY_PATH,
} from '../../support/entity/Entity.interface';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { TagClass } from '../../support/tag/TagClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  clickOutside,
  getApiContext,
  redirectToHomePage,
  toastNotification,
} from '../../utils/common';
import { CustomPropertyTypeByName } from '../../utils/customProperty';
import {
  addAssetsToDataProduct,
  addAssetsToDomain,
  addTagsAndGlossaryToDomain,
  checkAssetsCount,
  createDataProduct,
  createDomain,
  createSubDomain,
  fillDomainForm,
  removeAssetsFromDataProduct,
  selectDataProduct,
  selectDataProductFromTab,
  selectDomain,
  selectSubDomain,
  setupAssetsForDomain,
  setupDomainOwnershipTest,
  verifyDataProductAssetsAfterDelete,
  verifyDomain,
} from '../../utils/domain';
import { followEntity, unFollowEntity } from '../../utils/entity';
import { sidebarClick } from '../../utils/sidebar';
import { performUserLogin, visitUserProfilePage } from '../../utils/user';
const user = new UserClass();

const domain = new Domain();

const classification = new ClassificationClass({
  provider: 'system',
  mutuallyExclusive: true,
});
const tag = new TagClass({
  classification: classification.data.name,
});

const glossary = new Glossary();
const glossaryTerm = new GlossaryTerm(glossary);

const test = base.extend<{
  page: Page;
  userPage: Page;
}>({
  page: async ({ browser }, use) => {
    const { page } = await performAdminLogin(browser);
    await use(page);
    await page.close();
  },
  userPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await user.login(page);
    await use(page);
    await page.close();
  },
});

test.describe('Domains', () => {
  test.slow(true);

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    test.slow(true);

    const { apiContext, afterAction } = await performAdminLogin(browser);
    await user.create(apiContext);
    await classification.create(apiContext);
    await tag.create(apiContext);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    await domain.create(apiContext);

    await domain.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/owners/0',
          value: {
            id: user.responseData.id,
            type: 'user',
          },
        },
      ],
    });

    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    test.slow(true);

    const { apiContext, afterAction } = await performAdminLogin(browser);
    await user.delete(apiContext);
    await classification.delete(apiContext);
    await tag.delete(apiContext);
    await glossary.delete(apiContext);
    await glossaryTerm.delete(apiContext);
    await afterAction();
  });

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
      await addAssetsToDomain(page, domain, assets);
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
    await page.reload();

    await test.step('Add assets to domain', async () => {
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.DOMAIN);
      await addAssetsToDomain(page, domain, assets);
    });

    await test.step('Create DataProducts', async () => {
      await selectDomain(page, domain.data);
      await createDataProduct(page, dataProduct1.data);
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain.data);
      await createDataProduct(page, dataProduct2.data);
    });

    await test.step('Follow & Un-follow DataProducts', async () => {
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDataProduct(page, domain.data, dataProduct1.data);
      await followEntity(page, EntityTypeEndpoint.DataProduct);
      await redirectToHomePage(page);

      // Check that the followed data product is shown in the following widget
      await expect(
        page.locator('[data-testid="following-widget"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="following-widget"]')
      ).toContainText(dataProduct1.data.displayName);

      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDataProduct(page, domain.data, dataProduct1.data);
      await unFollowEntity(page, EntityTypeEndpoint.DataProduct);
      await redirectToHomePage(page);

      // Check that the data product is not shown in the following widget
      await expect(
        page.locator('[data-testid="following-widget"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="following-widget"]')
      ).not.toContainText(dataProduct1.data.displayName);
    });

    await test.step('Add assets to DataProducts', async () => {
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDataProduct(page, domain.data, dataProduct1.data);
      await addAssetsToDataProduct(
        page,
        dataProduct1.data.fullyQualifiedName ?? '',
        assets
      );
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

  test('Follow & Un-follow domain', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    await domain.create(apiContext);
    await page.reload();
    await sidebarClick(page, SidebarItem.DOMAIN);
    await selectDomain(page, domain.data);
    await followEntity(page, EntityTypeEndpoint.Domain);
    await redirectToHomePage(page);

    // Check that the followed domain is shown in the following widget
    await expect(
      page.locator('[data-testid="following-widget"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="following-widget"]')
    ).toContainText(domain.data.displayName);

    await sidebarClick(page, SidebarItem.DOMAIN);
    await selectDomain(page, domain.data);
    await unFollowEntity(page, EntityTypeEndpoint.Domain);
    await redirectToHomePage(page);

    // Check that the domain is not shown in the following widget
    await expect(
      page.locator('[data-testid="following-widget"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="following-widget"]')
    ).not.toContainText(domain.data.displayName);

    await domain.delete(apiContext);
    await afterAction();
  });

  test('Add, Update custom properties for data product', async ({ page }) => {
    test.slow(true);

    const properties = Object.values(CustomPropertyTypeByName);
    const titleText = properties.join(', ');

    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const dataProduct1 = new DataProduct(domain);
    await domain.create(apiContext);
    await sidebarClick(page, SidebarItem.DOMAIN);
    await page.reload();

    await test.step(
      'Create DataProduct and custom properties for it',
      async () => {
        await selectDomain(page, domain.data);
        await createDataProduct(page, dataProduct1.data);
        await dataProduct1.prepareCustomProperty(apiContext);
      }
    );

    await test.step(`Set ${titleText} Custom Property`, async () => {
      for (const type of properties) {
        await dataProduct1.updateCustomProperty(
          page,
          dataProduct1.customPropertyValue[type].property,
          dataProduct1.customPropertyValue[type].value
        );
      }
    });

    await test.step(`Update ${titleText} Custom Property`, async () => {
      for (const type of properties) {
        await dataProduct1.updateCustomProperty(
          page,
          dataProduct1.customPropertyValue[type].property,
          dataProduct1.customPropertyValue[type].newValue
        );
      }
    });

    await dataProduct1.cleanupCustomProperty(apiContext);
    await dataProduct1.delete(apiContext);
    await domain.delete(apiContext);
    await afterAction();
  });

  test('Switch domain from navbar and check domain query call wrap in quotes', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    await domain.create(apiContext);
    await page.reload();
    await page.getByTestId('domain-dropdown').click();

    await page
      .getByTestId(`tag-${domain.responseData.fullyQualifiedName}`)
      .click();

    await page.waitForLoadState('networkidle');

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
    await page.reload();
    await sidebarClick(page, SidebarItem.DOMAIN);
    await addAssetsToDomain(page, domain, assets);
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

  test.fixme(
    'Follow/unfollow subdomain and create nested sub domain',
    async ({ page }) => {
      const { afterAction, apiContext } = await getApiContext(page);
      const domain = new Domain();
      const subDomain = new SubDomain(domain);
      const nestedSubDomain = new SubDomain(subDomain);

      await domain.create(apiContext);
      await sidebarClick(page, SidebarItem.DOMAIN);
      await page.reload();
      await selectDomain(page, domain.data);
      // Create sub domain
      await createSubDomain(page, subDomain.data);
      await selectSubDomain(page, domain.data, subDomain.data);
      await verifyDomain(page, subDomain.data, domain.data, false);
      // Follow domain
      await followEntity(page, EntityTypeEndpoint.Domain);
      await redirectToHomePage(page);

      // Check that the followed domain is shown in the following widget
      await expect(
        page.locator('[data-testid="following-widget"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="following-widget"]')
      ).toContainText(subDomain.data.displayName);

      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain.data);
      await selectSubDomain(page, domain.data, subDomain.data);
      await verifyDomain(page, subDomain.data, domain.data, false);
      // Unfollow domain
      await unFollowEntity(page, EntityTypeEndpoint.Domain);
      await redirectToHomePage(page);

      // Check that the domain is not shown in the following widget
      await expect(
        page.locator('[data-testid="following-widget"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="following-widget"]')
      ).not.toContainText(subDomain.data.displayName);

      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain.data);
      await selectSubDomain(page, domain.data, subDomain.data);
      await verifyDomain(page, subDomain.data, domain.data, false);

      // Create new sub domain under the existing sub domain
      await createSubDomain(page, nestedSubDomain.data);
      await page.getByTestId('subdomains').getByText('Sub Domains').click();
      await page.getByTestId(nestedSubDomain.data.name).click();
      await verifyDomain(page, nestedSubDomain.data, domain.data, false);

      await domain.delete(apiContext);
      await afterAction();
    }
  );

  test('Should clear assets from data products after deletion of data product in Domain', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const { assets, assetCleanup } = await setupAssetsForDomain(page);
    const domain = new Domain({
      name: 'PW_Domain_Delete_Testing',
      displayName: 'PW_Domain_Delete_Testing',
      description: 'playwright domain description',
      domainType: 'Aggregate',
      fullyQualifiedName: 'PW_Domain_Delete_Testing',
    });
    const dataProduct1 = new DataProduct(domain, 'PW_DataProduct_Sales');
    const dataProduct2 = new DataProduct(domain, 'PW_DataProduct_Finance');

    const domain1 = new Domain({
      name: 'PW_Domain_Delete_Testing',
      displayName: 'PW_Domain_Delete_Testing',
      description: 'playwright domain description',
      domainType: 'Aggregate',
      fullyQualifiedName: 'PW_Domain_Delete_Testing',
    });
    const newDomainDP1 = new DataProduct(domain1, 'PW_DataProduct_Sales');
    const newDomainDP2 = new DataProduct(domain1, 'PW_DataProduct_Finance');

    try {
      await domain.create(apiContext);
      await dataProduct1.create(apiContext);
      await dataProduct2.create(apiContext);
      await sidebarClick(page, SidebarItem.DOMAIN);
      await page.reload();
      await addAssetsToDomain(page, domain, assets);
      await verifyDataProductAssetsAfterDelete(page, {
        domain,
        dataProduct1,
        dataProduct2,
        assets,
      });

      await test.step(
        'Delete domain & recreate the same domain and data product',
        async () => {
          await domain.delete(apiContext);
          await domain1.create(apiContext);
          await newDomainDP1.create(apiContext);
          await newDomainDP2.create(apiContext);
          await page.reload();
          await redirectToHomePage(page);
          await sidebarClick(page, SidebarItem.DOMAIN);
          await selectDataProduct(page, domain1.data, newDomainDP1.data);
          await checkAssetsCount(page, 0);
          await sidebarClick(page, SidebarItem.DOMAIN);
          await selectDataProduct(page, domain1.data, newDomainDP2.data);
          await checkAssetsCount(page, 0);
        }
      );
    } finally {
      await newDomainDP1.delete(apiContext);
      await newDomainDP2.delete(apiContext);
      await domain1.delete(apiContext);
      await assetCleanup();
      await afterAction();
    }
  });

  test('Should inherit owners and experts from parent domain', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const user1 = new UserClass();
    const user2 = new UserClass();
    let domain;
    let dataProduct;
    try {
      await user1.create(apiContext);
      await user2.create(apiContext);

      domain = new Domain({
        name: 'PW_Domain_Inherit_Testing',
        displayName: 'PW_Domain_Inherit_Testing',
        description: 'playwright domain description',
        domainType: 'Aggregate',
        fullyQualifiedName: 'PW_Domain_Inherit_Testing',
        owners: [
          {
            name: user1.responseData.name,
            type: 'user',
            fullyQualifiedName: user1.responseData.fullyQualifiedName ?? '',
            id: user1.responseData.id,
          },
        ],
        experts: [user2.responseData.name],
      });
      dataProduct = new DataProduct(domain);
      await domain.create(apiContext);
      await dataProduct.create(apiContext);

      await page.reload();
      await redirectToHomePage(page);

      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain.data);
      await selectDataProduct(page, domain.data, dataProduct.data);

      await expect(
        page.getByTestId('domain-owner-name').getByTestId('owner-label')
      ).toContainText(user1.responseData.displayName);

      await expect(
        page.getByTestId('domain-expert-name').getByTestId('owner-label')
      ).toContainText(user2.responseData.displayName);
    } finally {
      await dataProduct?.delete(apiContext);
      await domain?.delete(apiContext);
      await user1.delete(apiContext);
      await user2.delete(apiContext);
      await afterAction();
    }
  });

  test('Domain owner should able to edit description of domain', async ({
    page,
    userPage,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    try {
      await sidebarClick(userPage, SidebarItem.DOMAIN);
      await selectDomain(userPage, domain.data);

      await expect(userPage.getByTestId('edit-description')).toBeInViewport();

      await userPage.getByTestId('edit-description').click();

      await expect(userPage.getByTestId('editor')).toBeInViewport();

      const descriptionInputBox = '.om-block-editor[contenteditable="true"]';

      await userPage.fill(descriptionInputBox, 'test description');

      await userPage.getByTestId('save').click();

      await userPage.waitForTimeout(3000);

      const descriptionBox = '.om-block-editor[contenteditable="false"]';

      await expect(userPage.locator(descriptionBox)).toHaveText(
        'test description'
      );
    } finally {
      await domain?.delete(apiContext);
      await user.delete(apiContext);
    }
    await afterAction();
  });

  test('Verify domain tags and glossary terms', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    try {
      await domain.create(apiContext);
      await page.reload();
      await sidebarClick(page, SidebarItem.DOMAIN);
      await page.waitForLoadState('networkidle');
      await page.waitForSelector(`[data-testid="loader"]`, {
        state: 'hidden',
      });
      await selectDomain(page, domain.data);

      await addTagsAndGlossaryToDomain(page, {
        tagFqn: tag.responseData.fullyQualifiedName,
        glossaryTermFqn: glossaryTerm.responseData.fullyQualifiedName,
      });

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.DOMAIN);
      await page.waitForLoadState('networkidle');
      await page.waitForSelector(`[data-testid="loader"]`, {
        state: 'hidden',
      });
      await selectDomain(page, domain.data);

      await page.waitForLoadState('networkidle');

      await expect(
        page.locator(
          `[data-testid="tag-${tag.responseData.fullyQualifiedName}"]`
        )
      ).toBeVisible();
    } finally {
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Verify data product tags and glossary terms', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain1 = new Domain();
    const dataProduct = new DataProduct(domain1);
    try {
      await domain1.create(apiContext);
      await page.reload();
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain1.data);
      await createDataProduct(page, dataProduct.data);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDataProduct(page, domain1.data, dataProduct.data);

      await addTagsAndGlossaryToDomain(page, {
        tagFqn: tag.responseData.fullyQualifiedName,
        glossaryTermFqn: glossaryTerm.responseData.fullyQualifiedName,
        isDomain: false,
      });
    } finally {
      await dataProduct.delete(apiContext);
      await domain1.delete(apiContext);
      await afterAction();
    }
  });

  test('Verify clicking All Domains sets active domain to default value', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    try {
      await domain.create(apiContext);
      await page.reload();
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain.data);

      await page.reload();
      await page.getByTestId('domain-dropdown').click();
      await page.getByTestId('all-domains-selector').click();

      await page.getByTestId('domain-dropdown').click();

      await expect(page.getByTestId('all-domains-selector')).toHaveClass(
        /selected-node/
      );
    } finally {
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Verify duplicate domain creation', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const domain1 = new Domain({
      name: domain.data.name,
      displayName: domain.data.displayName,
      description: domain.data.description,
      domainType: domain.data.domainType,
    });
    try {
      await domain.create(apiContext);
      await page.reload();
      await sidebarClick(page, SidebarItem.DOMAIN);

      await page.click('[data-testid="add-domain"]');
      await page.waitForSelector('[data-testid="form-heading"]');

      await expect(page.locator('[data-testid="form-heading"]')).toHaveText(
        'Add Domain'
      );

      await fillDomainForm(page, domain1.data);
      const domainRes = page.waitForResponse('/api/v1/domains');
      await page.click('[data-testid="save-domain"]');
      await domainRes;

      await toastNotification(
        page,
        /already exists. Duplicated domains are not allowed./
      );
    } finally {
      await domain.delete(apiContext);
      await afterAction();
    }
  });
});

test.describe('Domains Rbac', () => {
  test.slow(true);

  const domain1 = new Domain();
  const domain2 = new Domain();
  const domain3 = new Domain();
  const user1 = new UserClass();

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    test.slow();

    const { apiContext, afterAction, page } = await performAdminLogin(browser);
    await Promise.all([
      domain1.create(apiContext),
      domain2.create(apiContext),
      domain3.create(apiContext),
      user1.create(apiContext),
    ]);

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
    await page.getByTestId('edit-roles-button').click();

    await page.locator('[data-testid="user-profile-edit-popover"]').isVisible();
    await page.locator('input[role="combobox"]').nth(1).click();
    await page.waitForSelector('[data-testid="profile-edit-roles-select"]');
    await page.getByText('Domain Only Access Role').click();
    const patchRes = page.waitForResponse('/api/v1/users/*');
    await page.getByTestId('user-profile-edit-roles-save-button').click();
    await patchRes;
    await afterAction();
  });

  test('Domain Rbac', async ({ browser }) => {
    test.slow(true);

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
      await addAssetsToDomain(page, domain1, domainAssset1);

      // Add assets to domain 2
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain2.data);
      await addAssetsToDomain(page, domain2, domainAssset2);
    });

    await test.step('User with access to multiple domains', async () => {
      await userPage
        .getByTestId('domain-dropdown')
        .getByRole('img')
        .first()
        .click();

      await expect(
        userPage.getByTestId(`tag-${domain1.responseData.fullyQualifiedName}`)
      ).toBeVisible();

      await expect(
        userPage.getByTestId(`tag-${domain3.responseData.fullyQualifiedName}`)
      ).toBeVisible();

      // Visit explore page and verify if domain is passed in the query
      const queryRes = userPage.waitForResponse(
        '/api/v1/search/query?*index=dataAsset*'
      );
      await sidebarClick(userPage, SidebarItem.EXPLORE);
      await queryRes.then(async (res) => {
        const queryString = new URL(res.request().url()).search;
        const urlParams = new URLSearchParams(queryString);
        const qParam = urlParams.get('q');

        expect(qParam).toEqual('');
      });

      for (const asset of domainAssset2) {
        const fqn = encodeURIComponent(
          get(asset, 'entityResponseData.fullyQualifiedName', '')
        );

        const assetData = userPage.waitForResponse(
          `/api/v1/${asset.endpoint}/name/${fqn}*`
        );
        await userPage.goto(
          `/${ENTITY_PATH[asset.endpoint as keyof typeof ENTITY_PATH]}/${fqn}`
        );
        await assetData;

        await expect(
          userPage.getByTestId('permission-error-placeholder')
        ).toHaveText(
          "You don't have necessary permissions. Please check with the admin to get the  permission."
        );
      }

      await afterActionUser1();
    });

    await Promise.all([
      domain1.delete(apiContext),
      domain2.delete(apiContext),
      domain3.delete(apiContext),
      user1.delete(apiContext),
    ]);

    await assetCleanup1();
    await assetCleanup2();
    await afterAction();
  });
});

test.describe('Data Consumer Domain Ownership', () => {
  test.slow(true);

  const classification = new ClassificationClass({
    provider: 'system',
    mutuallyExclusive: true,
  });
  const tag = new TagClass({
    classification: classification.data.name,
  });
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);

  let testResources: {
    dataConsumerUser: UserClass;
    domainForTest: Domain;
    dataProductForTest: DataProduct;
    cleanup: (apiContext1: APIRequestContext) => Promise<void>;
  };

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await classification.create(apiContext);
    await tag.create(apiContext);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);

    testResources = await setupDomainOwnershipTest(apiContext);

    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await tag.delete(apiContext);
    await glossary.delete(apiContext);
    await glossaryTerm.delete(apiContext);
    await classification.delete(apiContext);
    await testResources.cleanup(apiContext);

    await afterAction();
  });

  test.fixme(
    'Data consumer can manage domain as owner',
    async ({ browser }) => {
      const { page: dataConsumerPage, afterAction: consumerAfterAction } =
        await performUserLogin(browser, testResources.dataConsumerUser);

      await test.step(
        'Check domain management permissions for data consumer owner',
        async () => {
          await sidebarClick(dataConsumerPage, SidebarItem.DOMAIN);
          await selectDomain(
            dataConsumerPage,
            testResources.domainForTest.data
          );

          await dataConsumerPage.locator('[data-testid="loader"]').waitFor({
            state: 'detached',
          });

          await dataConsumerPage
            .getByTestId('domain-details-add-button')
            .click();

          // check Data Products menu item is visible
          await expect(
            dataConsumerPage.getByRole('menuitem', {
              name: 'Data Products',
              exact: true,
            })
          ).toBeVisible();

          await clickOutside(dataConsumerPage);

          await selectDataProductFromTab(
            dataConsumerPage,
            testResources.dataProductForTest.data
          );

          // Verify the user can edit owner, tags, glossary and domain experts
          await expect(
            dataConsumerPage.getByTestId('edit-owner')
          ).toBeVisible();
          await expect(
            dataConsumerPage
              .getByTestId('tags-container')
              .getByTestId('add-tag')
          ).toBeVisible();

          await expect(
            dataConsumerPage
              .getByTestId('glossary-container')
              .getByTestId('add-tag')
          ).toBeVisible();

          await expect(
            dataConsumerPage
              .getByTestId('domain-expert-name')
              .getByTestId('Add')
          ).toBeVisible();

          await expect(
            dataConsumerPage.getByTestId('manage-button')
          ).toBeVisible();

          await addTagsAndGlossaryToDomain(dataConsumerPage, {
            tagFqn: tag.responseData.fullyQualifiedName,
            glossaryTermFqn: glossaryTerm.responseData.fullyQualifiedName,
            isDomain: false,
          });
        }
      );

      await consumerAfterAction();
    }
  );
});
