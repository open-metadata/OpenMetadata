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
import base, { APIRequestContext, expect, Page } from '@playwright/test';
import { Operation } from 'fast-json-patch';
import { get } from 'lodash';
import { SidebarItem } from '../../constant/sidebar';
import { PolicyClass } from '../../support/access-control/PoliciesClass';
import { RolesClass } from '../../support/access-control/RolesClass';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { SubDomain } from '../../support/domain/SubDomain';
import {
  EntityTypeEndpoint,
  ENTITY_PATH,
} from '../../support/entity/Entity.interface';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { TableClass } from '../../support/entity/TableClass';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { TagClass } from '../../support/tag/TagClass';
import { TeamClass } from '../../support/team/TeamClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  clickOutside,
  getApiContext,
  redirectToExplorePage,
  redirectToHomePage,
  toastNotification,
  uuid,
} from '../../utils/common';
import {
  addCustomPropertiesForEntity,
  CustomPropertyTypeByName,
  deleteCreatedProperty,
} from '../../utils/customProperty';
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
  setupAssetsForDomain,
  setupDomainHasDomainTest,
  setupDomainOwnershipTest,
  setupNoDomainRule,
  verifyDataProductAssetsAfterDelete,
  verifyDomain,
} from '../../utils/domain';
import {
  createAnnouncement,
  deleteAnnouncement,
  editAnnouncement,
  followEntity,
  replyAnnouncement,
  unFollowEntity,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';
import {
  settingClick,
  SettingOptionsType,
  sidebarClick,
} from '../../utils/sidebar';
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
  page: async ({ browser }, setPage) => {
    const { page } = await performAdminLogin(browser);
    await setPage(page);
    await page.close();
  },
  userPage: async ({ browser }, setPage) => {
    const page = await browser.newPage();
    await user.login(page);
    await setPage(page);
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

      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await createDomain(page, domain.data, false);
      await verifyDomain(page, domain.data);
    });

    await test.step('Add assets to domain', async () => {
      await page.getByTestId('assets').click();
      await addAssetsToDomain(page, domain, assets, false);
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
    test.slow(true);

    const { afterAction, apiContext } = await getApiContext(page);
    const { assets, assetCleanup } = await setupAssetsForDomain(page);
    const domain = new Domain();
    const dataProduct1 = new DataProduct([domain]);
    const dataProduct2 = new DataProduct([domain]);
    await domain.create(apiContext);
    await page.reload();

    await test.step('Add assets to domain', async () => {
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.DOMAIN);
      await addAssetsToDomain(page, domain, assets);
    });

    await test.step('Create DataProducts', async () => {
      await createDataProduct(page, dataProduct1.data);
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.getByTestId(
          `table-data-card_${dataProduct1.data.fullyQualifiedName}`
        )
      ).toBeVisible();

      await createDataProduct(page, dataProduct2.data);
    });

    await test.step('Follow & Un-follow DataProducts', async () => {
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, dataProduct1.data);
      await followEntity(page, EntityTypeEndpoint.DataProduct);

      // Wait for the search query that will populate the following widget
      const followingSearchResponse = page.waitForResponse(
        '/api/v1/search/query?*index=all*'
      );
      await redirectToHomePage(page);
      await followingSearchResponse;

      // Check that the followed data product is shown in the following widget
      await expect(
        page.locator('[data-testid="following-widget"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="following-widget"]')
      ).toContainText(dataProduct1.data.displayName);

      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, dataProduct1.data);
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

    await test.step(
      'Verify empty assets message and Add Asset button',
      async () => {
        await redirectToHomePage(page);
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct1.data);
        await waitForAllLoadersToDisappear(page);
        await page.waitForLoadState('networkidle');

        await expect(
          page.getByTestId('KnowledgePanel.Domain').getByTestId('add-domain')
        ).not.toBeVisible();

        await page.getByTestId('assets').getByText('Assets').click();
        await waitForAllLoadersToDisappear(page);
        await page.waitForLoadState('networkidle');

        await expect(page.getByTestId('no-data-placeholder')).toContainText(
          "Looks like you haven't added any data assets yet."
        );

        await page.getByTestId('data-assets-add-button').click();

        await waitForAllLoadersToDisappear(page);
        await page.waitForLoadState('networkidle');

        await expect(page.getByTestId('form-heading')).toContainText(
          'Add Assets'
        );

        await expect(page.getByTestId('cancel-btn')).toBeVisible();
        await expect(page.getByTestId('save-btn')).toBeDisabled();
      }
    );

    await test.step('Add assets to DataProducts', async () => {
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, dataProduct1.data);
      await addAssetsToDataProduct(
        page,
        dataProduct1.data.fullyQualifiedName ?? '',
        assets
      );
    });

    await test.step('Remove assets from DataProducts', async () => {
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, dataProduct1.data);
      await removeAssetsFromDataProduct(page, dataProduct1.data, assets);
      await page.reload();
      await waitForAllLoadersToDisappear(page);
      await page.waitForLoadState('networkidle');
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

    // Wait for the search query that will populate the following widget
    const followingSearchResponse = page.waitForResponse(
      '/api/v1/search/query?*index=all*'
    );
    await redirectToHomePage(page);
    await followingSearchResponse;

    await page.waitForLoadState('networkidle');

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
    const dataProduct1 = new DataProduct([domain]);
    await domain.create(apiContext);
    await sidebarClick(page, SidebarItem.DOMAIN);

    await test.step(
      'Create DataProduct and custom properties for it',
      async () => {
        await selectDomain(page, domain.data);
        await createDataProduct(page, dataProduct1.data);
        await dataProduct1.prepareCustomProperty(apiContext);
      }
    );

    await test.step(`Set ${titleText} Custom Property`, async () => {
      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, dataProduct1.data);
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

    await redirectToExplorePage(page);
    await waitForAllLoadersToDisappear(page);
    await page.waitForLoadState('networkidle');

    const domainsResponse = page.waitForResponse('api/v1/domains/hierarchy?*');
    await page.getByTestId('domain-dropdown').click();
    await domainsResponse;
    await waitForAllLoadersToDisappear(page);

    const searchDomainResponse = page.waitForResponse(
      'api/v1/search/query?q=*&index=domain_search_index*'
    );
    await page.getByTestId('searchbar').fill(domain.responseData.displayName);
    await searchDomainResponse;

    await page
      .getByTestId(`tag-${domain.responseData.fullyQualifiedName}`)
      .click();
    await waitForAllLoadersToDisappear(page);

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

    // The domain FQN should be properly escaped in the query
    // The actual format uses escaped hyphens, not URL encoding
    const fqn = (domain.data.fullyQualifiedName ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/-/g, '\\-');

    expect(qParam).toContain(`(domains.fullyQualifiedName:"${fqn}")`);

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

  test('Follow/unfollow subdomain and create nested sub domain', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const subDomain = new SubDomain(domain);
    const nestedSubDomain = new SubDomain(subDomain);

    try {
      await domain.create(apiContext);
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain.data);

      // Create sub domain and wait for auto-navigation to subdomains tab
      await Promise.all([
        createSubDomain(page, subDomain.data),
        page.waitForResponse(
          '/api/v1/search/query?q=&index=domain_search_index&from=0&size=9&deleted=false*'
        ),
      ]);

      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await Promise.all([
        page.getByTestId(subDomain.data.name).click(),
        page.waitForResponse('/api/v1/domains/name/*'),
      ]);

      await verifyDomain(page, subDomain.data, domain.data, false);
      // Follow domain
      await followEntity(page, EntityTypeEndpoint.Domain);

      // Wait for the search query that will populate the following widget
      const followingSearchResponse = page.waitForResponse(
        '/api/v1/search/query?*index=all*'
      );
      await redirectToHomePage(page);
      await followingSearchResponse;
      await page.waitForLoadState('networkidle');

      // Check that the followed domain is shown in the following widget
      await expect(
        page.locator('[data-testid="following-widget"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="following-widget"]')
      ).toContainText(subDomain.data.displayName);

      const subDomainRes = page.waitForResponse('/api/v1/domains/name/*');
      await page
        .locator('[data-testid="following-widget"]')
        .getByText(subDomain.data.displayName)
        .click();

      await subDomainRes;

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

      // const selectSubDomainRes = page.waitForResponse(
      //   '/api/v1/search/query?q=&index=domain_search_index*'
      // );
      // await page.getByTestId('subdomains').getByText('Sub Domains').click();
      // await selectSubDomainRes;
      // await verifyDomain(page, subDomain.data, domain.data, false);

      const subDomainApiRes1 = page.waitForResponse(
        '/api/v1/search/query?q=&index=domain_search_index&from=0&size=9&deleted=false*'
      );

      // Create new sub domain under the existing sub domain
      await createSubDomain(page, nestedSubDomain.data);

      await subDomainApiRes1;

      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await Promise.all([
        page.getByTestId(nestedSubDomain.data.name).click(),
        page.waitForResponse('/api/v1/domains/name/*'),
      ]);
      await verifyDomain(page, nestedSubDomain.data, domain.data, false);
    } finally {
      await nestedSubDomain.delete(apiContext);
      await subDomain.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });

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
    const dataProduct1 = new DataProduct([domain], 'PW_DataProduct_Sales');
    const dataProduct2 = new DataProduct([domain], 'PW_DataProduct_Finance');

    const domain1 = new Domain({
      name: 'PW_Domain_Delete_Testing',
      displayName: 'PW_Domain_Delete_Testing',
      description: 'playwright domain description',
      domainType: 'Aggregate',
      fullyQualifiedName: 'PW_Domain_Delete_Testing',
    });
    const newDomainDP1 = new DataProduct([domain1], 'PW_DataProduct_Sales');
    const newDomainDP2 = new DataProduct([domain1], 'PW_DataProduct_Finance');

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
          await sidebarClick(page, SidebarItem.DATA_PRODUCT);
          await selectDataProduct(page, newDomainDP1.data);
          await checkAssetsCount(page, 0);
          await sidebarClick(page, SidebarItem.DATA_PRODUCT);
          await selectDataProduct(page, newDomainDP2.data);
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
      dataProduct = new DataProduct([domain]);
      await domain.create(apiContext);
      await dataProduct.create(apiContext);

      await page.reload();
      await redirectToHomePage(page);

      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, dataProduct.data);

      await expect(
        page.getByTestId(user1.responseData.displayName)
      ).toBeVisible();

      await expect(
        page.getByTestId(user2.responseData.displayName)
      ).toBeVisible();
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

      // clear existing description to avoid flakiness
      await userPage.fill(descriptionInputBox, '');

      await userPage.fill(descriptionInputBox, 'test description');

      const saveResponse = userPage.waitForResponse(
        (req) =>
          req.request().method() === 'PATCH' &&
          req.request().url().includes('/api/v1/domains/')
      );

      await userPage.getByTestId('save').click();

      await saveResponse;

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

  test('Verify domain and subdomain asset count accuracy', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const { assets: domainAssets, assetCleanup: domainAssetCleanup } =
      await setupAssetsForDomain(page);
    const { assets: subDomainAssets, assetCleanup: subDomainAssetCleanup } =
      await setupAssetsForDomain(page);

    let subDomain!: SubDomain;

    try {
      await test.step('Create domain and subdomain via API', async () => {
        await domain.create(apiContext);
        subDomain = new SubDomain(domain);
        await subDomain.create(apiContext);
      });

      await test.step('Add assets to domain', async () => {
        await page.reload();
        await redirectToHomePage(page);
        await sidebarClick(page, SidebarItem.DOMAIN);
        await selectDomain(page, domain.data);
        await page.getByTestId('assets').click();
        await addAssetsToDomain(page, domain, domainAssets, false);
      });

      await test.step('Add assets to subdomain', async () => {
        await redirectToHomePage(page);
        await sidebarClick(page, SidebarItem.DOMAIN);
        await selectDomain(page, domain.data);
        await page.getByTestId('subdomains').getByText('Sub Domains').click();
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await Promise.all([
          page.getByTestId(subDomain.data.name).click(),
          page.waitForResponse('/api/v1/domains/name/*'),
        ]);

        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await page.getByTestId('assets').click();
        await addAssetsToDomain(
          page,
          subDomain as unknown as Domain,
          subDomainAssets,
          false
        );
      });

      await test.step(
        'Verify domain asset count matches displayed cards',
        async () => {
          await redirectToHomePage(page);
          await sidebarClick(page, SidebarItem.DOMAIN);
          await selectDomain(page, domain.data);
          await page.getByTestId('assets').click();
          await waitForAllLoadersToDisappear(page);
          await page.waitForLoadState('networkidle');

          const assetCountElement = page
            .getByTestId('assets')
            .getByTestId('count');
          const countText = await assetCountElement.textContent();
          const displayedCount = parseInt(countText ?? '0', 10);
          const totalCount = domainAssets.length + subDomainAssets.length;
          const assetCards = await page
            .locator('[data-testid*="table-data-card_"]')
            .count();

          expect(displayedCount).toBe(totalCount);
          expect(assetCards).toBe(totalCount);
        }
      );

      await test.step(
        'Verify subdomain asset count matches displayed cards',
        async () => {
          await redirectToHomePage(page);
          await sidebarClick(page, SidebarItem.DOMAIN);
          await selectDomain(page, domain.data);
          await page.getByTestId('subdomains').getByText('Sub Domains').click();
          await page.waitForLoadState('networkidle');
          await page.waitForSelector('[data-testid="loader"]', {
            state: 'detached',
          });

          await Promise.all([
            page.getByTestId(subDomain.data.name).click(),
            page.waitForResponse('/api/v1/domains/name/*'),
          ]);

          await page.getByTestId('assets').click();
          await waitForAllLoadersToDisappear(page);
          await page.waitForLoadState('networkidle');

          const assetCountElement = page
            .getByTestId('assets')
            .getByTestId('count');
          const countText = await assetCountElement.textContent();
          const displayedCount = parseInt(countText ?? '0', 10);

          const assetCards = await page
            .locator('[data-testid*="table-data-card_"]')
            .count();

          expect(displayedCount).toBe(subDomainAssets.length);
          expect(assetCards).toBe(subDomainAssets.length);
        }
      );
    } finally {
      await subDomain?.delete(apiContext);
      await domain.delete(apiContext);
      await domainAssetCleanup();
      await subDomainAssetCleanup();
      await afterAction();
    }
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
    const dataProduct = new DataProduct([domain1]);
    try {
      await domain1.create(apiContext);
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain1.data);
      await createDataProduct(page, dataProduct.data);
      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, dataProduct.data);

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

  test('Verify redirect path on data product delete', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const dataProduct = new DataProduct([domain]);

    await domain.create(apiContext);
    await dataProduct.create(apiContext);

    await page.reload();
    await redirectToHomePage(page);

    await sidebarClick(page, SidebarItem.DATA_PRODUCT);
    await selectDataProduct(page, dataProduct.data);

    await page.getByTestId('manage-button').click();
    await page.getByTestId('delete-button-title').click();

    await page.getByTestId('confirmation-text-input').click();
    await page.getByTestId('confirmation-text-input').fill('DELETE');

    const dpListRes = page.waitForResponse(
      '/api/v1/search/query?q=&index=data_product_search_index*'
    );
    const deleteRes = page.waitForResponse('/api/v1/dataProducts/*');

    await page.getByTestId('confirm-button').click();

    await deleteRes;
    await dpListRes;

    await expect(
      page.getByText(`"Data Product" deleted successfully!`)
    ).toBeVisible();

    await expect(page.getByTestId('add-entity-button')).toBeVisible();

    await afterAction();
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
      await page.click('[data-testid="save-btn"]');
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

  test('Create domain custom property and verify value persistence', async ({
    page,
  }) => {
    test.slow(true);

    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const propertyName = `pwDomainCustomProperty${uuid()}`;
    const customPropertyValue = 'Test Domain Property Value';

    try {
      // Create domain first
      await domain.create(apiContext);
      await page.reload();

      await test.step('Create custom property for domain entity', async () => {
        // Navigate to domain settings to create custom property
        await settingClick(page, 'domains' as SettingOptionsType, true);

        await addCustomPropertiesForEntity({
          page,
          propertyName,
          customPropertyData: {
            description: 'Test domain custom property',
            entityApiType: 'domains',
          },
          customType: 'String',
        });
      });

      await test.step(
        'Navigate to domain and assign custom property value',
        async () => {
          // Navigate to domain page
          await sidebarClick(page, SidebarItem.DOMAIN);

          await selectDomain(page, domain.data);

          // Click on custom properties tab
          await page.getByTestId('custom_properties').click();

          // Wait for custom properties to load
          await page.waitForSelector('.ant-skeleton-active', {
            state: 'detached',
          });

          // Add custom property value
          await page
            .getByTestId(`custom-property-${propertyName}-card`)
            .getByTestId('edit-icon')
            .click();

          await page.getByTestId('value-input').fill(customPropertyValue);

          // Save the custom property value
          const saveResponse = page.waitForResponse('/api/v1/domains/*');
          await page.getByTestId('inline-save-btn').click();
          await saveResponse;

          // Verify the value is displayed
          await expect(
            page.getByTestId(`custom-property-${propertyName}-card`)
          ).toContainText(customPropertyValue);
        }
      );

      await test.step(
        'Reload and verify custom property value persists',
        async () => {
          // Reload the page
          await page.reload();

          // Navigate back to the domain and custom properties
          await sidebarClick(page, SidebarItem.DOMAIN);
          await selectDomain(page, domain.data);

          await page.getByTestId('custom_properties').click();

          await page.waitForSelector('.ant-skeleton-active', {
            state: 'detached',
          });

          // Verify the custom property value persists after reload
          await expect(
            page.getByTestId(`custom-property-${propertyName}-card`)
          ).toContainText(customPropertyValue);
        }
      );

      await test.step('Cleanup custom property', async () => {
        // Navigate back to domain settings to delete the custom property
        await settingClick(page, 'domains' as SettingOptionsType, true);
        await deleteCreatedProperty(page, propertyName);
      });
    } finally {
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Domain announcement create, edit & delete', async ({ page }) => {
    test.slow(true);

    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();

    try {
      await domain.create(apiContext);
      await page.reload();
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain.data);

      await createAnnouncement(
        page,
        {
          title: 'Domain Announcement Test',
          description: 'Domain Announcement Description',
        },
        false
      );

      await editAnnouncement(page, {
        title: 'Edited Domain Announcement',
        description: 'Updated Domain Announcement Description',
      });

      await replyAnnouncement(page);
      await deleteAnnouncement(page);
    } finally {
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Data Product announcement create, edit & delete', async ({ page }) => {
    test.slow(true);

    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const dataProduct = new DataProduct([domain]);

    try {
      await domain.create(apiContext);
      await page.reload();
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain.data);
      await createDataProduct(page, dataProduct.data);

      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, dataProduct.data);

      await createAnnouncement(
        page,
        {
          title: 'Data Product Announcement Test',
          description: 'Data Product Announcement Description',
        },
        false
      );

      await editAnnouncement(page, {
        title: 'Edited Data Product Announcement',
        description: 'Updated Data Product Announcement Description',
      });

      await replyAnnouncement(page);
      await deleteAnnouncement(page);
    } finally {
      await dataProduct.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  /**
   * Tests that verify UI handles entities with deleted descriptions gracefully.
   * The issue occurs when:
   * 1. An entity is created with a description
   * 2. The description is later deleted/cleared via API patch
   * 3. The API returns the entity without a description field (due to @JsonInclude(NON_NULL))
   * 4. UI should handle this gracefully instead of crashing
   */
  test('should handle domain after description is deleted', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();

    try {
      await domain.create(apiContext);

      // Delete the description via API PATCH
      await apiContext.patch(`/api/v1/domains/${domain.responseData.id}`, {
        data: [
          {
            op: 'remove',
            path: '/description',
          },
        ],
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      });

      // Navigate to the domain page
      await domain.visitEntityPage(page);

      // Verify the domain page loads without error
      await expect(
        page.getByTestId('entity-header-display-name')
      ).toBeVisible();

      // Verify no error page is shown
      await expect(page.locator('text=Something went wrong')).not.toBeVisible();
      await expect(
        page.locator('text=Cannot read properties of undefined')
      ).not.toBeVisible();
    } finally {
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('should handle data product after description is deleted', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    await domain.create(apiContext);
    const dataProduct = new DataProduct([domain]);

    try {
      await dataProduct.create(apiContext);

      // Delete the description via API PATCH
      await apiContext.patch(
        `/api/v1/dataProducts/${dataProduct.responseData.id}`,
        {
          data: [
            {
              op: 'remove',
              path: '/description',
            },
          ],
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      );

      // Navigate to the domain page
      await domain.visitEntityPage(page);

      const dpRes = page.waitForResponse(
        '/api/v1/search/query?q=&index=data_product_search_index&*'
      );
      // Navigate to data products tab
      await page.getByTestId('data_products').click();

      await dpRes;

      const dpDetails = page.waitForResponse(
        '/api/v1/dataProducts/name/*?fields=domains*'
      );

      // Click on the data product using displayName
      await page
        .locator('.explore-search-card')
        .getByText(dataProduct.responseData.displayName)
        .click();

      await dpDetails;

      // Verify the data product page loads without error
      await expect(
        page.getByTestId('entity-header-display-name')
      ).toBeVisible();

      // Verify no error page is shown
      await expect(page.locator('text=Something went wrong')).not.toBeVisible();
      await expect(
        page.locator('text=Cannot read properties of undefined')
      ).not.toBeVisible();
    } finally {
      await dataProduct.delete(apiContext);
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
      await addAssetsToDomain(page, domain1, domainAssset1);

      // Add assets to domain 2
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.DOMAIN);
      await addAssetsToDomain(page, domain2, domainAssset2);
    });

    await test.step('User with access to multiple domains', async () => {
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
          `/api/v1/permissions/${
            ENTITY_PATH[asset.endpoint as keyof typeof ENTITY_PATH]
          }/name/${fqn}*`
        );
        await userPage.goto(
          `/${ENTITY_PATH[asset.endpoint as keyof typeof ENTITY_PATH]}/${fqn}`
        );
        await assetData;

        await expect(
          userPage.getByTestId('permission-error-placeholder')
        ).toHaveText(
          /You don't have necessary permissions\. Please check with the admin to get the .* permission\./
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

  test('Data consumer can manage domain as owner', async ({ browser }) => {
    const { page: dataConsumerPage, afterAction: consumerAfterAction } =
      await performUserLogin(browser, testResources.dataConsumerUser);

    await test.step(
      'Check domain management permissions for data consumer owner',
      async () => {
        await sidebarClick(dataConsumerPage, SidebarItem.DOMAIN);
        await selectDomain(dataConsumerPage, testResources.domainForTest.data);
        await dataConsumerPage.getByTestId('domain-details-add-button').click();

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
        await expect(dataConsumerPage.getByTestId('edit-owner')).toBeVisible();
        await expect(
          dataConsumerPage.getByTestId('tags-container').getByTestId('add-tag')
        ).toBeVisible();

        await expect(
          dataConsumerPage
            .getByTestId('glossary-container')
            .getByTestId('add-tag')
        ).toBeVisible();

        await expect(
          dataConsumerPage.getByTestId('domain-expert-name').getByTestId('Add')
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
  });
});

test.describe('Domain Access with hasDomain() Rule', () => {
  test.slow(true);

  let testResources: {
    testUser: UserClass;
    mainDomain: Domain;
    subDomain: SubDomain;
    domainTable: TableClass;
    subDomainTable: TableClass;
    domainPolicy: PolicyClass;
    domainRole: RolesClass;
    domainTeam: TeamClass;
    cleanup: (apiContext1: APIRequestContext) => Promise<void>;
  };

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    testResources = await setupDomainHasDomainTest(apiContext);
    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await testResources.cleanup(apiContext);
    await afterAction();
  });

  test('User with hasDomain() rule can access domain and subdomain assets', async ({
    browser,
  }) => {
    // Login as test user and verify access
    const { page: userPage, afterAction: userAfterAction } =
      await performUserLogin(browser, testResources.testUser);

    await test.step('Verify user can access domain assets', async () => {
      // Navigate to the domain table
      const domainTableFqn =
        testResources.domainTable.entityResponseData.fullyQualifiedName;
      await userPage.goto(`/table/${encodeURIComponent(domainTableFqn)}`);
      await userPage.waitForLoadState('networkidle');
      await userPage.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      // Verify no permission error
      await expect(
        userPage.getByTestId('permission-error-placeholder')
      ).not.toBeVisible();

      // Verify table details are visible
      await expect(userPage.getByTestId('entity-header-title')).toBeVisible();
    });

    await test.step('Verify user can access subdomain assets', async () => {
      // Navigate to the subdomain table
      const subDomainTableFqn =
        testResources.subDomainTable.entityResponseData.fullyQualifiedName;
      await userPage.goto(`/table/${encodeURIComponent(subDomainTableFqn)}`);
      await userPage.waitForLoadState('networkidle');

      // Verify no permission error
      await expect(
        userPage.getByTestId('permission-error-placeholder')
      ).not.toBeVisible();

      // Verify table details are visible
      await expect(userPage.getByTestId('entity-header-title')).toBeVisible();
    });

    await userAfterAction();
  });
});

test.describe('Domain Access with noDomain() Rule', () => {
  test.slow(true);

  let testResources: {
    testUser: UserClass;
    mainDomain: Domain;
    domainTable: TableClass;
    noDomainTable: TableClass;
    domainPolicy: PolicyClass;
    domainRole: RolesClass;
    domainTeam: TeamClass;
    cleanup: (cleanupContext: APIRequestContext) => Promise<void>;
  };

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    testResources = await setupNoDomainRule(apiContext);
    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await testResources.cleanup(apiContext);
    await afterAction();
  });

  test('User with noDomain() rule cannot access tables without domain', async ({
    browser,
  }) => {
    const { page: userPage, afterAction: userAfterAction } =
      await performUserLogin(browser, testResources.testUser);

    await test.step(
      'Verify user can access domain-assigned table',
      async () => {
        const domainTableFqn =
          testResources.domainTable.entityResponseData.fullyQualifiedName;
        await userPage.goto(`/table/${encodeURIComponent(domainTableFqn)}`);
        await userPage.waitForLoadState('networkidle');
        await userPage.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        // Verify no permission error
        await expect(
          userPage.getByTestId('permission-error-placeholder')
        ).not.toBeVisible();

        // Verify table details are visible
        await expect(userPage.getByTestId('entity-header-title')).toBeVisible();
      }
    );

    await test.step(
      'Verify user gets permission error for table without domain',
      async () => {
        const noDomainTableFqn =
          testResources.noDomainTable.entityResponseData.fullyQualifiedName;
        await userPage.goto(`/table/${encodeURIComponent(noDomainTableFqn)}`);
        await userPage.waitForLoadState('networkidle');
        await userPage.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        // Verify permission error is shown
        await expect(
          userPage.getByTestId('permission-error-placeholder')
        ).toBeVisible();

        await expect(
          userPage.getByTestId('permission-error-placeholder')
        ).toContainText(
          "You don't have necessary permissions. Please check with the admin to get the View Table Details permission."
        );

        // Verify table details are not visible
        await expect(
          userPage.getByTestId('entity-header-title')
        ).not.toBeVisible();
      }
    );

    await userAfterAction();
  });
});

test.describe('Domain Tree View Functionality', () => {
  let subDomain: SubDomain;
  const domain = EntityDataClass.domain1;
  const domainDisplayName = domain.responseData.displayName;

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    test.slow(true);

    const { apiContext, afterAction } = await performAdminLogin(browser);
    subDomain = new SubDomain(domain);
    await subDomain.create(apiContext);
    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    test.slow(true);

    const { apiContext, afterAction } = await performAdminLogin(browser);
    await subDomain.delete(apiContext);
    await afterAction();
  });

  test('should render the domain tree view with correct details', async ({
    page,
  }) => {
    test.slow(true);

    await sidebarClick(page, SidebarItem.DOMAIN);
    await page.waitForLoadState('networkidle');
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('button', { name: 'tree' }).click();
    await page.waitForLoadState('networkidle');
    await waitForAllLoadersToDisappear(page);

    await page
      .getByTestId('page-layout-v1')
      .getByRole('textbox', { name: 'Search' })
      .clear();

    const searchDomain = page.waitForResponse(
      `/api/v1/search/query?q=*${encodeURIComponent(domainDisplayName)}*`
    );
    await page
      .getByTestId('page-layout-v1')
      .getByRole('textbox', { name: 'Search' })
      .fill(domainDisplayName);
    await searchDomain;
    await page.waitForLoadState('networkidle');
    await waitForAllLoadersToDisappear(page);

    await expect(
      page
        .getByRole('treeitem', {
          name: domainDisplayName,
        })
        .locator('div')
        .nth(2)
    ).toBeVisible();

    await page
      .getByRole('treeitem', { name: domainDisplayName })
      .locator('div')
      .nth(2)
      .click();

    await expect(
      page
        .getByRole('treeitem', { name: subDomain.data.displayName })
        .locator('div')
        .nth(2)
    ).toBeVisible();
    await expect(
      page
        .getByRole('listitem')
        .filter({ hasText: domain.responseData.fullyQualifiedName })
        .getByTestId('breadcrumb-link')
    ).toBeVisible();
    await expect(page.getByTestId('entity-header-display-name')).toContainText(
      domainDisplayName
    );
    await expect(page.getByTestId('entity-header-name')).toContainText(
      domain.responseData.name
    );
    await expect(
      page.getByTestId('documentation').getByText('Documentation')
    ).toBeVisible();
    await expect(
      page.getByTestId('subdomains').getByText('Sub Domains')
    ).toBeVisible();
    await expect(
      page.getByTestId('data_products').getByText('Data Products')
    ).toBeVisible();
    await expect(
      page.getByTestId('activity_feed').getByText('Activity Feeds & Tasks')
    ).toBeVisible();
    await expect(page.getByTestId('assets').getByText('Assets')).toBeVisible();
    await expect(
      page.getByTestId('custom_properties').getByText('Custom Properties')
    ).toBeVisible();
    await expect(
      page
        .getByTestId('asset-description-container')
        .getByText(domain.responseData.description)
    ).toBeVisible();
    await expect(page.getByTestId('domain-details-add-button')).toBeVisible();

    await expect(
      page.getByTestId('subdomains').getByTestId('count')
    ).toContainText('1');

    await page.getByTestId('subdomains').getByText('Sub Domains').click();
    await page.waitForLoadState('networkidle');
    await waitForAllLoadersToDisappear(page);

    await expect(
      page
        .getByTestId(subDomain.data.name)
        .getByText(subDomain.data.displayName)
    ).toBeVisible();
  });
});
