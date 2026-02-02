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
  ENTITY_PATH,
  EntityTypeEndpoint,
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
  redirectToHomePage,
  uuid,
  visitGlossaryPage,
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
  createDataProductForSubDomain,
  createDomain,
  createSubDomain,
  fillDomainForm,
  navigateToSubDomain,
  removeAssetsFromDataProduct,
  renameDomain,
  selectDataProduct,
  selectDataProductFromTab,
  selectDomain,
  setupAssetsForDomain,
  setupDomainHasDomainTest,
  setupDomainOwnershipTest,
  setupNoDomainRule,
  verifyDataProductAssetsAfterDelete,
  verifyDataProductsCount,
  verifyDomain,
  verifyDomainOnAssetPages,
} from '../../utils/domain';
import {
  assignGlossaryTerm,
  createAnnouncement,
  deleteAnnouncement,
  editAnnouncement,
  followEntity,
  replyAnnouncement,
  unFollowEntity,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';
import { selectActiveGlossaryTerm } from '../../utils/glossary';
import {
  settingClick,
  SettingOptionsType,
  sidebarClick,
} from '../../utils/sidebar';
import { selectTagInMUITagSuggestion } from '../../utils/tag';
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
    await glossaryTerm.delete(apiContext);
    await glossary.delete(apiContext);
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

      // Wait for loaders to disappear and verify page is ready
      await waitForAllLoadersToDisappear(page);
      await expect(page.getByTestId('add-domain')).toBeVisible();

      await createDomain(page, domain.data, false);
      await verifyDomain(page, domain.data);
    });

    await test.step('Add assets to domain', async () => {
      const assetsTab = page.getByTestId('assets');
      await expect(assetsTab).toBeVisible();
      await assetsTab.click();
      await addAssetsToDomain(page, domain, assets, false);
    });

    await test.step('Delete domain using delete modal', async () => {
      const manageButton = page.getByTestId('manage-button');
      await expect(manageButton).toBeVisible();
      await manageButton.click();

      const deleteButton = page.getByTestId('delete-button-title');
      await expect(deleteButton).toBeVisible();
      await deleteButton.click();

      // Verify delete modal is visible
      await expect(
        page
          .locator('.ant-modal-title')
          .getByText(`Delete domain "${domain.data.displayName}"`)
      ).toBeVisible();

      const confirmationInput = page.getByTestId('confirmation-text-input');
      await expect(confirmationInput).toBeVisible();
      await confirmationInput.click();
      await confirmationInput.fill('DELETE');

      const deleteRes = page.waitForResponse('/api/v1/domains/*');
      const confirmButton = page.getByTestId('confirm-button');
      await expect(confirmButton).toBeVisible();
      await expect(confirmButton).toBeEnabled();
      await confirmButton.click();

      await deleteRes;

      // Verify UI shows deletion success
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
      await waitForAllLoadersToDisappear(page);

      // Verify first data product card is visible
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
      await followEntity(page, EntityTypeEndpoint.DATA_PRODUCT);

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
      await unFollowEntity(page, EntityTypeEndpoint.DATA_PRODUCT);
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

        const assetsTab = page.getByTestId('assets').getByText('Assets');
        await expect(assetsTab).toBeVisible();
        await assetsTab.click();
        await waitForAllLoadersToDisappear(page);

        // Verify empty state message
        await expect(page.getByTestId('no-data-placeholder')).toContainText(
          "Looks like you haven't added any data assets yet."
        );

        const addButton = page.getByTestId('data-assets-add-button');
        await expect(addButton).toBeVisible();
        await addButton.click();

        await waitForAllLoadersToDisappear(page);

        // Verify Add Assets form is displayed
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
      // Verify assets count is 0 after removal
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

    // Verify following widget is visible and contains the domain
    const followingWidget = page.locator('[data-testid="following-widget"]');
    await expect(followingWidget).toBeVisible();
    await expect(followingWidget).toContainText(domain.data.displayName);

    await sidebarClick(page, SidebarItem.DOMAIN);
    await selectDomain(page, domain.data);
    await unFollowEntity(page, EntityTypeEndpoint.Domain);
    await redirectToHomePage(page);

    // Verify domain is removed from following widget
    await expect(followingWidget).toBeVisible();
    await expect(followingWidget).not.toContainText(domain.data.displayName);

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

    const manageButton = page.getByTestId('manage-button');
    await expect(manageButton).toBeVisible();
    await manageButton.click();

    const renameButton = page.getByTestId('rename-button-title');
    await expect(renameButton).toBeVisible();
    await renameButton.click();

    const displayNameInput = page.locator('#displayName');
    await expect(displayNameInput).toBeVisible();
    await displayNameInput.click();
    await displayNameInput.fill(updatedDomainName);

    const saveButton = page.getByTestId('save-button');
    await expect(saveButton).toBeVisible();
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    // Verify domain name was updated in UI
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

      await waitForAllLoadersToDisappear(page);

      // Navigate to subdomain and verify
      const subDomainCard = page.getByTestId(subDomain.data.name);
      await expect(subDomainCard).toBeVisible();

      await Promise.all([
        subDomainCard.click(),
        page.waitForResponse('/api/v1/domains/name/*'),
      ]);

      // Verify subdomain page loaded correctly
      await verifyDomain(page, subDomain.data, domain.data, false);
      // Follow domain
      await followEntity(page, EntityTypeEndpoint.Domain);

      // Wait for the search query that will populate the following widget
      const followingSearchResponse = page.waitForResponse(
        '/api/v1/search/query?*index=all*'
      );
      await redirectToHomePage(page);
      await followingSearchResponse;

      // Verify the followed domain is shown in the following widget
      const followingWidget = page.locator('[data-testid="following-widget"]');
      await expect(followingWidget).toBeVisible();
      await expect(followingWidget).toContainText(subDomain.data.displayName);

      const subDomainRes = page.waitForResponse('/api/v1/domains/name/*');
      const followingLink = followingWidget.getByText(
        subDomain.data.displayName
      );
      await expect(followingLink).toBeVisible();
      await followingLink.click();

      await subDomainRes;

      // Unfollow domain
      await unFollowEntity(page, EntityTypeEndpoint.Domain);
      await redirectToHomePage(page);

      // Verify the domain is not shown in the following widget
      await expect(followingWidget).toBeVisible();
      await expect(followingWidget).not.toContainText(
        subDomain.data.displayName
      );

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
      await waitForAllLoadersToDisappear(page);

      // Navigate to nested subdomain and verify
      const nestedSubDomainCard = page.getByTestId(nestedSubDomain.data.name);
      await expect(nestedSubDomainCard).toBeVisible();

      await Promise.all([
        nestedSubDomainCard.click(),
        page.waitForResponse('/api/v1/domains/name/*'),
      ]);

      // Verify nested subdomain page loaded
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

        const subDomainsTab = page
          .getByTestId('subdomains')
          .getByText('Sub Domains');
        await expect(subDomainsTab).toBeVisible();
        await subDomainsTab.click();
        await waitForAllLoadersToDisappear(page);

        const subDomainCard = page.getByTestId(subDomain.data.name);
        await expect(subDomainCard).toBeVisible();

        await Promise.all([
          subDomainCard.click(),
          page.waitForResponse('/api/v1/domains/name/*'),
        ]);

        await waitForAllLoadersToDisappear(page);

        const assetsTab = page.getByTestId('assets');
        await expect(assetsTab).toBeVisible();
        await assetsTab.click();

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

          const assetsTab = page.getByTestId('assets');
          await expect(assetsTab).toBeVisible();
          await assetsTab.click();

          await waitForAllLoadersToDisappear(page);

          const assetCountElement = page
            .getByTestId('assets')
            .getByTestId('count');
          const countText = await assetCountElement.textContent();
          const displayedCount = Number.parseInt(countText ?? '0', 10);
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

          const subDomainsTab = page
            .getByTestId('subdomains')
            .getByText('Sub Domains');
          await expect(subDomainsTab).toBeVisible();
          await subDomainsTab.click();
          await waitForAllLoadersToDisappear(page);

          const subDomainCard = page.getByTestId(subDomain.data.name);
          await expect(subDomainCard).toBeVisible();

          await Promise.all([
            subDomainCard.click(),
            page.waitForResponse('/api/v1/domains/name/*'),
          ]);

          const assetsTab = page.getByTestId('assets');
          await expect(assetsTab).toBeVisible();
          await assetsTab.click();

          await waitForAllLoadersToDisappear(page);

          const assetCountElement = page
            .getByTestId('assets')
            .getByTestId('count');
          const countText = await assetCountElement.textContent();
          const displayedCount = Number.parseInt(countText ?? '0', 10);

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

  test('Verify domain data products count includes subdomain data products', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const domainDataProduct = new DataProduct([domain]);

    let subDomain!: SubDomain;
    let subDomainDataProduct!: Awaited<
      ReturnType<typeof createDataProductForSubDomain>
    >;

    try {
      await test.step(
        'Create domain, subdomain, and data products via API',
        async () => {
          await domain.create(apiContext);
          subDomain = new SubDomain(domain);
          await subDomain.create(apiContext);

          // Create data product in parent domain
          await domainDataProduct.create(apiContext);

          // Create data product in subdomain
          subDomainDataProduct = await createDataProductForSubDomain(
            apiContext,
            subDomain
          );
        }
      );

      await test.step(
        'Verify domain data products tab shows both domain and subdomain data products',
        async () => {
          await page.reload();
          await redirectToHomePage(page);
          await sidebarClick(page, SidebarItem.DOMAIN);
          await selectDomain(page, domain.data);

          // Click on Data Products tab
          const dataProductsTab = page.getByTestId('data_products');
          await expect(dataProductsTab).toBeVisible();
          await dataProductsTab.click();

          await waitForAllLoadersToDisappear(page);

          // Verify data products count is 2 (one from domain + one from subdomain)
          const dataProductCountElement = page
            .getByTestId('data_products')
            .getByTestId('count');
          const countText = await dataProductCountElement.textContent();
          const displayedCount = Number.parseInt(countText ?? '0', 10);

          expect(displayedCount).toBe(2);

          // Verify both data product cards are visible (scope to data products container)
          const dataProductsContainer = page.locator('.explore-search-card');
          await expect(
            dataProductsContainer.filter({
              hasText: domainDataProduct.data.displayName,
            })
          ).toBeVisible();
          await expect(
            dataProductsContainer.filter({
              hasText: subDomainDataProduct.displayName,
            })
          ).toBeVisible();
        }
      );

      await test.step(
        'Verify subdomain data products tab shows only its own data products',
        async () => {
          await redirectToHomePage(page);
          await sidebarClick(page, SidebarItem.DOMAIN);
          await selectDomain(page, domain.data);

          // Navigate to subdomain
          const subDomainsTab = page
            .getByTestId('subdomains')
            .getByText('Sub Domains');
          await expect(subDomainsTab).toBeVisible();
          await subDomainsTab.click();
          await waitForAllLoadersToDisappear(page);

          const subDomainCard = page.getByTestId(subDomain.data.name);
          await expect(subDomainCard).toBeVisible();

          await Promise.all([
            subDomainCard.click(),
            page.waitForResponse('/api/v1/domains/name/*'),
          ]);

          // Click on Data Products tab
          const dataProductsTab = page.getByTestId('data_products');
          await expect(dataProductsTab).toBeVisible();
          await dataProductsTab.click();

          await waitForAllLoadersToDisappear(page);

          // Verify data products count is 1 (only subdomain's own data product)
          const dataProductCountElement = page
            .getByTestId('data_products')
            .getByTestId('count');
          const countText = await dataProductCountElement.textContent();
          const displayedCount = Number.parseInt(countText ?? '0', 10);

          expect(displayedCount).toBe(1);

          // Verify only subdomain data product card is visible
          const dataProductsContainer = page.locator('.explore-search-card');
          await expect(
            dataProductsContainer.filter({
              hasText: subDomainDataProduct.displayName,
            })
          ).toBeVisible();
        }
      );

      await test.step(
        'Delete subdomain and verify its data products are not visible in domain',
        async () => {
          // Delete subdomain (this should cascade delete its data product)
          await subDomain.delete(apiContext);
          // Mark as deleted to prevent double-delete in finally block
          subDomainDataProduct =
            undefined as unknown as typeof subDomainDataProduct;
          subDomain = undefined as unknown as typeof subDomain;

          // Navigate to domain and verify
          await redirectToHomePage(page);
          await sidebarClick(page, SidebarItem.DOMAIN);
          await selectDomain(page, domain.data);

          // Click on Data Products tab
          const dataProductsTab = page.getByTestId('data_products');
          await expect(dataProductsTab).toBeVisible();
          await dataProductsTab.click();

          await waitForAllLoadersToDisappear(page);

          // Verify data products count is now 1 (only domain's own data product)
          const dataProductCountElement = page
            .getByTestId('data_products')
            .getByTestId('count');
          const countText = await dataProductCountElement.textContent();
          const displayedCount = Number.parseInt(countText ?? '0', 10);

          expect(displayedCount).toBe(1);

          // Verify only domain data product is visible
          const dataProductsContainer = page.locator('.explore-search-card');
          await expect(
            dataProductsContainer.filter({
              hasText: domainDataProduct.data.displayName,
            })
          ).toBeVisible();
        }
      );

      await test.step(
        'Verify deeply nested subdomain data products are visible at each level',
        async () => {
          // Create nested structure: domain -> nestedSubDomain1 -> nestedSubDomain2 -> nestedSubDomain3
          const nestedSubDomain1 = new SubDomain(domain);
          await nestedSubDomain1.create(apiContext);

          const nestedSubDomain2 = new SubDomain(nestedSubDomain1);
          await nestedSubDomain2.create(apiContext);

          const nestedSubDomain3 = new SubDomain(nestedSubDomain2);
          await nestedSubDomain3.create(apiContext);

          // Create data products at each subdomain level
          const subDomain1DataProduct = await createDataProductForSubDomain(
            apiContext,
            nestedSubDomain1
          );
          const subDomain2DataProduct = await createDataProductForSubDomain(
            apiContext,
            nestedSubDomain2
          );
          const subDomain3DataProduct = await createDataProductForSubDomain(
            apiContext,
            nestedSubDomain3
          );

          // 1. Verify at domain level: should see 4 data products (domain's own + all nested)
          await page.reload();
          await redirectToHomePage(page);
          await sidebarClick(page, SidebarItem.DOMAIN);
          await selectDomain(page, domain.data);
          await verifyDataProductsCount(page, 4);

          // Verify all data products are visible at domain level (scope to container)
          const dataProductsContainer = page.locator('.explore-search-card');
          await expect(
            dataProductsContainer.filter({
              hasText: domainDataProduct.data.displayName,
            })
          ).toBeVisible();
          await expect(
            dataProductsContainer.filter({
              hasText: subDomain1DataProduct.displayName,
            })
          ).toBeVisible();
          await expect(
            dataProductsContainer.filter({
              hasText: subDomain2DataProduct.displayName,
            })
          ).toBeVisible();
          await expect(
            dataProductsContainer.filter({
              hasText: subDomain3DataProduct.displayName,
            })
          ).toBeVisible();

          // 2. Navigate to nestedSubDomain1 and verify: should see 3 data products (its own + subdomain2's + subdomain3's)
          await navigateToSubDomain(page, nestedSubDomain1.data);
          await verifyDataProductsCount(page, 3);
          await expect(
            dataProductsContainer.filter({
              hasText: subDomain1DataProduct.displayName,
            })
          ).toBeVisible();
          await expect(
            dataProductsContainer.filter({
              hasText: subDomain2DataProduct.displayName,
            })
          ).toBeVisible();
          await expect(
            dataProductsContainer.filter({
              hasText: subDomain3DataProduct.displayName,
            })
          ).toBeVisible();

          // 3. Navigate to nestedSubDomain2 and verify: should see 2 data products (its own + subdomain3's)
          await navigateToSubDomain(page, nestedSubDomain2.data);
          await verifyDataProductsCount(page, 2);
          await expect(
            dataProductsContainer.filter({
              hasText: subDomain2DataProduct.displayName,
            })
          ).toBeVisible();
          await expect(
            dataProductsContainer.filter({
              hasText: subDomain3DataProduct.displayName,
            })
          ).toBeVisible();

          // 4. Navigate to nestedSubDomain3 and verify: should see 1 data product (its own)
          await navigateToSubDomain(page, nestedSubDomain3.data);
          await verifyDataProductsCount(page, 1);
          await expect(
            dataProductsContainer.filter({
              hasText: subDomain3DataProduct.displayName,
            })
          ).toBeVisible();

          // Cleanup nested structure (delete data products first, then subdomains from deepest level)
          await subDomain3DataProduct.delete(apiContext);
          await subDomain2DataProduct.delete(apiContext);
          await subDomain1DataProduct.delete(apiContext);
          await nestedSubDomain3.delete(apiContext);
          await nestedSubDomain2.delete(apiContext);
          await nestedSubDomain1.delete(apiContext);
        }
      );
    } finally {
      await subDomainDataProduct?.delete(apiContext);
      await domainDataProduct.delete(apiContext);
      await subDomain?.delete(apiContext);
      await domain.delete(apiContext);
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
      await waitForAllLoadersToDisappear(page);
      await selectDomain(page, domain.data);

      await addTagsAndGlossaryToDomain(page, {
        tagFqn: tag.responseData.fullyQualifiedName,
        glossaryTermFqn: glossaryTerm.responseData.fullyQualifiedName,
      });

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.DOMAIN);
      await waitForAllLoadersToDisappear(page);
      await selectDomain(page, domain.data);

      // Verify tag is visible
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

  test('Create domain with tags using MUITagSuggestion', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const testDomain = new Domain();

    try {
      await test.step('Navigate to add domain', async () => {
        await sidebarClick(page, SidebarItem.DOMAIN);
        await waitForAllLoadersToDisappear(page);
        await page.click('[data-testid="add-domain"]');
        await page.waitForSelector('h6:has-text("Add Domain")', { state: 'visible' });
      });

      await test.step('Fill domain form', async () => {
        await fillDomainForm(page, testDomain.data);
      });

      await test.step('Search and select tag via MUITagSuggestion', async () => {
        await selectTagInMUITagSuggestion(page, {
          searchTerm: tag.data.displayName,
          tagFqn: tag.responseData.fullyQualifiedName,
        });

        await expect(page.locator('[data-testid="tag-suggestion"]')).toContainText(
          tag.data.displayName
        );
      });

      await test.step('Save domain and verify tag is applied', async () => {
        const domainRes = page.waitForResponse('/api/v1/domains');
        await page.getByRole('button', { name: 'Save' }).click();
        await domainRes;
        await selectDomain(page, testDomain.data);

        await expect(
          page.locator(
            `[data-testid="tag-${tag.responseData.fullyQualifiedName}"]`
          )
        ).toBeVisible();
      });
    } finally {
      await testDomain.delete(apiContext);
      await afterAction();
    }
  });

  test('Create subdomain with tags using MUITagSuggestion', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const parentDomain = new Domain();
    const subDomain = new SubDomain(parentDomain);

    try {
      await parentDomain.create(apiContext);
      await page.reload();

      await test.step('Navigate to domain and open subdomain modal', async () => {
        await sidebarClick(page, SidebarItem.DOMAIN);
        await waitForAllLoadersToDisappear(page);
        await selectDomain(page, parentDomain.data);

        await page.getByTestId('domain-details-add-button').click();
        await page.getByRole('menuitem', { name: 'Sub Domains' }).click();
        await expect(page.getByText('Add Sub Domain')).toBeVisible();
      });

      await test.step('Fill subdomain form', async () => {
        await fillDomainForm(page, subDomain.data, false);
      });

      await test.step('Search and select tag via MUITagSuggestion', async () => {
        await selectTagInMUITagSuggestion(page, {
          searchTerm: tag.data.displayName,
          tagFqn: tag.responseData.fullyQualifiedName,
        });

        await expect(
          page.locator('[data-testid="tag-suggestion"]')
        ).toContainText(tag.data.displayName);
      });

      await test.step('Save subdomain and verify tag is applied', async () => {
        const saveRes = page.waitForResponse('/api/v1/domains');
        await page.getByTestId('save-btn').click();
        await saveRes;

        await navigateToSubDomain(page, subDomain.data);

        await expect(
          page.locator(
            `[data-testid="tag-${tag.responseData.fullyQualifiedName}"]`
          )
        ).toBeVisible();
      });
    } finally {
      await subDomain.delete(apiContext);
      await parentDomain.delete(apiContext);
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

    const manageButton = page.getByTestId('manage-button');
    await expect(manageButton).toBeVisible();
    await manageButton.click();

    const deleteButton = page.getByTestId('delete-button-title');
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    const confirmationInput = page.getByTestId('confirmation-text-input');
    await expect(confirmationInput).toBeVisible();
    await confirmationInput.click();
    await confirmationInput.fill('DELETE');

    const dpListRes = page.waitForResponse(
      '/api/v1/search/query?q=&index=data_product_search_index*'
    );
    const deleteRes = page.waitForResponse('/api/v1/dataProducts/*');

    const confirmButton = page.getByTestId('confirm-button');
    await expect(confirmButton).toBeVisible();
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    await deleteRes;
    await dpListRes;

    // Verify deletion success message and redirect
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

      const addDomainButton = page.click('[data-testid="add-domain"]');
      await expect(page.getByTestId('add-domain')).toBeVisible();
      await addDomainButton;

      const formHeading = page.locator('[data-testid="form-heading"]');
      await expect(formHeading).toBeVisible();
      await expect(formHeading).toHaveText('Add Domain');

      await fillDomainForm(page, domain1.data);

      const domainRes = page.waitForResponse('/api/v1/domains');
      const saveButton = page.click('[data-testid="save-btn"]');
      await expect(page.getByTestId('save-btn')).toBeVisible();
      await saveButton;
      await domainRes;
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
          const customPropertiesTab = page.getByTestId('custom_properties');
          await expect(customPropertiesTab).toBeVisible();
          await customPropertiesTab.click();

          // Wait for custom properties to load
          await waitForAllLoadersToDisappear(page);

          // Add custom property value
          const propertyCard = page.getByTestId(
            `custom-property-${propertyName}-card`
          );
          await expect(propertyCard).toBeVisible();

          const editIcon = propertyCard.getByTestId('edit-icon');
          await expect(editIcon).toBeVisible();
          await editIcon.click();

          const valueInput = page.getByTestId('value-input');
          await expect(valueInput).toBeVisible();
          await valueInput.fill(customPropertyValue);

          // Save the custom property value
          const saveResponse = page.waitForResponse('/api/v1/domains/*');
          const saveButton = page.getByTestId('inline-save-btn');
          await expect(saveButton).toBeVisible();
          await expect(saveButton).toBeEnabled();
          await saveButton.click();
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

          const customPropertiesTab = page.getByTestId('custom_properties');
          await expect(customPropertiesTab).toBeVisible();
          await customPropertiesTab.click();

          await waitForAllLoadersToDisappear(page);

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

test.describe('Domain Rename Comprehensive Tests', () => {
  test.slow(true);

  test.beforeEach('Visit home page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Rename domain with subdomains attached verifies subdomain accessibility', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();

    let currentDomainName = '';

    try {
      await domain.create(apiContext);
      currentDomainName = domain.responseData.name;

      const subDomain = new SubDomain(domain);
      await subDomain.create(apiContext);

      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain.data);

      // Verify subdomain exists before rename
      const subdomainSearchResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.url().includes('index=domain_search_index') &&
          response.status() === 200
      );

      await page.getByTestId('subdomains').getByText('Sub Domains').click();
      await subdomainSearchResponse;

      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await expect(page.getByTestId(subDomain.data.name)).toBeVisible();

      // Navigate back to documentation tab for rename
      await page.getByTestId('documentation').click();

      // Perform rename
      const newDomainName = `renamed-domain-${uuid()}`;
      await renameDomain(page, newDomainName);

      currentDomainName = newDomainName;

      // Verify domain name changed
      await expect(page.getByTestId('entity-header-name')).toContainText(
        newDomainName
      );

      // Verify subdomain is still accessible after parent domain rename
      const subdomainSearchResponseAfterRename = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.url().includes('index=domain_search_index') &&
          response.status() === 200
      );

      const subDomainsTab = page
        .getByTestId('subdomains')
        .getByText('Sub Domains');
      await expect(subDomainsTab).toBeVisible();
      await subDomainsTab.click();
      await subdomainSearchResponseAfterRename;

      await waitForAllLoadersToDisappear(page);

      const subDomainCard = page.getByTestId(subDomain.data.name);
      await expect(subDomainCard).toBeVisible();

      // Click on subdomain to verify it's accessible
      await Promise.all([
        subDomainCard.click(),
        page.waitForResponse('/api/v1/domains/name/*'),
      ]);

      // Verify subdomain page loaded correctly
      await expect(
        page.getByTestId('entity-header-display-name')
      ).toContainText(subDomain.data.displayName);
    } finally {
      try {
        await apiContext.delete(
          `/api/v1/domains/name/${encodeURIComponent(
            currentDomainName
          )}?hardDelete=true&recursive=true`
        );
      } catch {
        try {
          await domain.delete(apiContext);
        } catch {
          // Ignore cleanup errors
        }
      }
      await afterAction();
    }
  });

  test('Rename domain with deeply nested subdomains (3+ levels) verifies FQN propagation', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();

    let currentDomainName = '';

    try {
      await domain.create(apiContext);
      currentDomainName = domain.responseData.name;

      // Create nested hierarchy: domain -> subDomain1 -> subDomain2 -> subDomain3
      const subDomain1 = new SubDomain(domain);
      await subDomain1.create(apiContext);

      const subDomain2 = new SubDomain(subDomain1);
      await subDomain2.create(apiContext);

      const subDomain3 = new SubDomain(subDomain2);
      await subDomain3.create(apiContext);

      // Navigate to domain
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain.data);

      // Perform rename on root domain
      const newDomainName = `renamed-nested-domain-${uuid()}`;
      await renameDomain(page, newDomainName);

      currentDomainName = newDomainName;

      // Verify domain name changed
      await expect(page.getByTestId('entity-header-name')).toContainText(
        newDomainName
      );

      // Navigate to subDomain1
      const subdomainSearchResponse1 = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.url().includes('index=domain_search_index') &&
          response.status() === 200
      );

      const subDomainsTab1 = page
        .getByTestId('subdomains')
        .getByText('Sub Domains');
      await expect(subDomainsTab1).toBeVisible();
      await subDomainsTab1.click();
      await subdomainSearchResponse1;

      await waitForAllLoadersToDisappear(page);

      const subDomain1Card = page.getByTestId(subDomain1.data.name);
      await expect(subDomain1Card).toBeVisible();

      await Promise.all([
        subDomain1Card.click(),
        page.waitForResponse('/api/v1/domains/name/*'),
      ]);

      // Verify subdomain1 page loaded
      await expect(
        page.getByTestId('entity-header-display-name')
      ).toContainText(subDomain1.data.displayName);

      // Navigate to subDomain2 from subDomain1
      const subdomainSearchResponse2 = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.url().includes('index=domain_search_index') &&
          response.status() === 200
      );

      const subDomainsTab2 = page
        .getByTestId('subdomains')
        .getByText('Sub Domains');
      await expect(subDomainsTab2).toBeVisible();
      await subDomainsTab2.click();
      await subdomainSearchResponse2;

      await waitForAllLoadersToDisappear(page);

      const subDomain2Card = page.getByTestId(subDomain2.data.name);
      await expect(subDomain2Card).toBeVisible();

      await Promise.all([
        subDomain2Card.click(),
        page.waitForResponse('/api/v1/domains/name/*'),
      ]);

      // Verify subdomain2 page loaded
      await expect(
        page.getByTestId('entity-header-display-name')
      ).toContainText(subDomain2.data.displayName);

      // Navigate to subDomain3 from subDomain2
      const subdomainSearchResponse3 = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.url().includes('index=domain_search_index') &&
          response.status() === 200
      );

      const subDomainsTab3 = page
        .getByTestId('subdomains')
        .getByText('Sub Domains');
      await expect(subDomainsTab3).toBeVisible();
      await subDomainsTab3.click();
      await subdomainSearchResponse3;

      await waitForAllLoadersToDisappear(page);

      const subDomain3Card = page.getByTestId(subDomain3.data.name);
      await expect(subDomain3Card).toBeVisible();

      await Promise.all([
        subDomain3Card.click(),
        page.waitForResponse('/api/v1/domains/name/*'),
      ]);

      // Verify subdomain3 page loaded
      await expect(
        page.getByTestId('entity-header-display-name')
      ).toContainText(subDomain3.data.displayName);
    } finally {
      try {
        await apiContext.delete(
          `/api/v1/domains/name/${encodeURIComponent(
            currentDomainName
          )}?hardDelete=true&recursive=true`
        );
      } catch {
        try {
          await domain.delete(apiContext);
        } catch {
          // Ignore cleanup errors
        }
      }
      await afterAction();
    }
  });

  test('Rename domain with data products attached at domain and subdomain levels', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const domainDataProduct = new DataProduct([domain]);

    let currentDomainName = '';
    let subDomain: SubDomain | undefined;
    let subDomainDataProduct:
      | Awaited<ReturnType<typeof createDataProductForSubDomain>>
      | undefined;

    try {
      await domain.create(apiContext);
      currentDomainName = domain.responseData.name;

      subDomain = new SubDomain(domain);
      await subDomain.create(apiContext);

      // Create data product in parent domain
      await domainDataProduct.create(apiContext);

      // Create data product in subdomain
      subDomainDataProduct = await createDataProductForSubDomain(
        apiContext,
        subDomain
      );

      // Navigate to domain
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain.data);

      // Verify data products count before rename
      await verifyDataProductsCount(page, 2);

      // Navigate back to documentation tab for rename
      await page.getByTestId('documentation').click();

      // Perform rename
      const newDomainName = `renamed-dp-domain-${uuid()}`;
      await renameDomain(page, newDomainName);

      await page.reload();
      await waitForAllLoadersToDisappear(page);

      currentDomainName = newDomainName;

      // Verify domain name changed
      await expect(page.getByTestId('entity-header-name')).toContainText(
        newDomainName
      );

      // Verify data products count is preserved after rename
      await verifyDataProductsCount(page, 2);

      // Verify both data products are visible (scope to container)
      const dataProductsContainer = page.locator('.explore-search-card');
      await expect(
        dataProductsContainer.filter({
          hasText: domainDataProduct.data.displayName,
        })
      ).toBeVisible();
      await expect(
        dataProductsContainer.filter({
          hasText: subDomainDataProduct.displayName,
        })
      ).toBeVisible();
    } finally {
      try {
        await subDomainDataProduct?.delete(apiContext);
      } catch {
        // Ignore
      }
      try {
        await domainDataProduct.delete(apiContext);
      } catch {
        // Ignore
      }
      try {
        await apiContext.delete(
          `/api/v1/domains/name/${encodeURIComponent(
            currentDomainName
          )}?hardDelete=true&recursive=true`
        );
      } catch {
        try {
          await domain.delete(apiContext);
        } catch {
          // Ignore cleanup errors
        }
      }
      await afterAction();
    }
  });

  test('Rename domain with tags and glossary terms preserves associations', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const testClassification = new ClassificationClass({
      provider: 'system',
      mutuallyExclusive: false,
    });
    const testTag = new TagClass({
      classification: testClassification.data.name,
    });
    const testGlossary = new Glossary();
    const testGlossaryTerm = new GlossaryTerm(testGlossary);

    let currentDomainName = '';

    try {
      await testClassification.create(apiContext);
      await testTag.create(apiContext);
      await testGlossary.create(apiContext);
      await testGlossaryTerm.create(apiContext);
      await domain.create(apiContext);
      currentDomainName = domain.responseData.name;

      // Navigate to domain and add tags/glossary terms
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain.data);

      await addTagsAndGlossaryToDomain(page, {
        tagFqn: testTag.responseData.fullyQualifiedName,
        glossaryTermFqn: testGlossaryTerm.responseData.fullyQualifiedName,
      });

      // Verify tag is visible before rename
      await expect(
        page.locator(
          `[data-testid="tag-${testTag.responseData.fullyQualifiedName}"]`
        )
      ).toBeVisible();

      // Perform rename
      const newDomainName = `renamed-tags-domain-${uuid()}`;
      await renameDomain(page, newDomainName);

      currentDomainName = newDomainName;

      // Verify domain name changed
      await expect(page.getByTestId('entity-header-name')).toContainText(
        newDomainName
      );

      // Verify tag is still visible after rename
      await expect(
        page.locator(
          `[data-testid="tag-${testTag.responseData.fullyQualifiedName}"]`
        )
      ).toBeVisible();
    } finally {
      try {
        await apiContext.delete(
          `/api/v1/domains/name/${encodeURIComponent(
            currentDomainName
          )}?hardDelete=true&recursive=true`
        );
      } catch {
        try {
          await domain.delete(apiContext);
        } catch {
          // Ignore cleanup errors
        }
      }
      await testGlossaryTerm.delete(apiContext);
      await testGlossary.delete(apiContext);
      await testTag.delete(apiContext);
      await testClassification.delete(apiContext);
      await afterAction();
    }
  });

  test('Rename domain with assets (tables, topics, dashboards) preserves associations', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const { assets, assetCleanup } = await setupAssetsForDomain(page);
    const domain = new Domain();

    let currentDomainName = '';

    try {
      await domain.create(apiContext);
      currentDomainName = domain.responseData.name;

      // Navigate to domain and add assets
      await sidebarClick(page, SidebarItem.DOMAIN);
      await addAssetsToDomain(page, domain, assets);

      // Verify assets before rename by visiting each asset page
      await verifyDomainOnAssetPages(
        page,
        assets,
        domain.responseData.displayName,
        domain.responseData.name
      );

      // Perform rename
      const newDomainName = `renamed-assets-domain-${uuid()}`;
      await renameDomain(page, newDomainName);

      currentDomainName = newDomainName;

      // Verify domain name changed
      await expect(page.getByTestId('entity-header-name')).toContainText(
        newDomainName
      );

      // Verify assets are still associated after rename by visiting each asset page
      await verifyDomainOnAssetPages(
        page,
        assets,
        domain.responseData.displayName,
        newDomainName
      );
    } finally {
      try {
        await apiContext.delete(
          `/api/v1/domains/name/${encodeURIComponent(
            currentDomainName
          )}?hardDelete=true&recursive=true`
        );
      } catch {
        try {
          await domain.delete(apiContext);
        } catch {
          // Ignore cleanup errors
        }
      }
      await assetCleanup();
      await afterAction();
    }
  });

  test('Rename domain with owners and experts preserves assignments', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const ownerUser = new UserClass();
    const expertUser = new UserClass();

    let currentDomainName = '';

    try {
      await ownerUser.create(apiContext);
      await expertUser.create(apiContext);
      await domain.create(apiContext);
      currentDomainName = domain.responseData.name;

      // Add owner and expert to domain
      await domain.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/owners/0',
            value: {
              id: ownerUser.responseData.id,
              type: 'user',
            },
          },
          {
            op: 'add',
            path: '/experts/0',
            value: {
              id: expertUser.responseData.id,
              type: 'user',
            },
          },
        ],
      });

      // Navigate to domain
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain.data);

      // Verify owner is visible before rename
      await expect(
        page.getByTestId(ownerUser.responseData.displayName)
      ).toBeVisible();

      // Verify expert is visible before rename
      await expect(
        page.getByTestId(expertUser.responseData.displayName)
      ).toBeVisible();

      // Perform rename
      const newDomainName = `renamed-owners-domain-${uuid()}`;
      await renameDomain(page, newDomainName);

      currentDomainName = newDomainName;

      // Verify domain name changed
      await expect(page.getByTestId('entity-header-name')).toContainText(
        newDomainName
      );

      // Verify owner is still visible after rename
      await expect(
        page.getByTestId(ownerUser.responseData.displayName)
      ).toBeVisible();

      // Verify expert is still visible after rename
      await expect(
        page.getByTestId(expertUser.responseData.displayName)
      ).toBeVisible();
    } finally {
      try {
        await apiContext.delete(
          `/api/v1/domains/name/${encodeURIComponent(
            currentDomainName
          )}?hardDelete=true&recursive=true`
        );
      } catch {
        try {
          await domain.delete(apiContext);
        } catch {
          // Ignore cleanup errors
        }
      }
      await ownerUser.delete(apiContext);
      await expertUser.delete(apiContext);
      await afterAction();
    }
  });

  test('Subdomain rename does not affect parent domain and updates nested children', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();

    try {
      await domain.create(apiContext);

      // Create nested hierarchy: domain -> subDomain1 -> subDomain2
      const subDomain1 = new SubDomain(domain);
      await subDomain1.create(apiContext);

      const subDomain2 = new SubDomain(subDomain1);
      await subDomain2.create(apiContext);

      // Navigate to domain
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain.data);

      // Navigate to subDomain1
      const subdomainSearchResponse1 = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.url().includes('index=domain_search_index') &&
          response.status() === 200
      );

      const subDomainsTab = page
        .getByTestId('subdomains')
        .getByText('Sub Domains');
      await expect(subDomainsTab).toBeVisible();
      await subDomainsTab.click();
      await subdomainSearchResponse1;

      await waitForAllLoadersToDisappear(page);

      const subDomain1Card = page.getByTestId(subDomain1.data.name);
      await expect(subDomain1Card).toBeVisible();

      await Promise.all([
        subDomain1Card.click(),
        page.waitForResponse('/api/v1/domains/name/*'),
      ]);

      // Verify subDomain2 exists under subDomain1 before rename
      const subdomainSearchResponse2 = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.url().includes('index=domain_search_index') &&
          response.status() === 200
      );

      const subDomainsTab2 = page
        .getByTestId('subdomains')
        .getByText('Sub Domains');
      await expect(subDomainsTab2).toBeVisible();
      await subDomainsTab2.click();
      await subdomainSearchResponse2;

      await waitForAllLoadersToDisappear(page);

      const subDomain2Card = page.getByTestId(subDomain2.data.name);
      await expect(subDomain2Card).toBeVisible();

      // Navigate back to documentation tab for rename
      await page.getByTestId('documentation').click();

      // Perform rename on subDomain1
      const newSubDomainName = `renamed-subdomain-${uuid()}`;
      await renameDomain(page, newSubDomainName);

      // Verify subdomain name changed
      await expect(page.getByTestId('entity-header-name')).toContainText(
        newSubDomainName
      );

      // Verify subDomain2 is still accessible after parent subdomain rename
      const subdomainSearchResponse3 = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.url().includes('index=domain_search_index') &&
          response.status() === 200
      );

      const subDomainsTab3 = page
        .getByTestId('subdomains')
        .getByText('Sub Domains');
      await expect(subDomainsTab3).toBeVisible();
      await subDomainsTab3.click();
      await subdomainSearchResponse3;

      await waitForAllLoadersToDisappear(page);

      // Wait for search results to populate - subdomain card visibility check below will wait

      const subDomain2CardAfterRename = page.getByTestId(subDomain2.data.name);
      await expect(subDomain2CardAfterRename).toBeVisible();

      await Promise.all([
        subDomain2CardAfterRename.click(),
        page.waitForResponse('/api/v1/domains/name/*'),
      ]);

      // Verify subdomain2 page loaded correctly
      await expect(
        page.getByTestId('entity-header-display-name')
      ).toContainText(subDomain2.data.displayName);

      // Navigate back to parent domain to verify it's unchanged
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain.data);

      await expect(page.getByTestId('entity-header-name')).toContainText(
        domain.responseData.name
      );
    } finally {
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Comprehensive domain rename with ALL relationships preserved', async ({
    page,
  }) => {
    test.slow();

    const { afterAction, apiContext } = await getApiContext(page);
    const { assets, assetCleanup } = await setupAssetsForDomain(page);
    const domain = new Domain();
    const testClassification = new ClassificationClass({
      provider: 'system',
      mutuallyExclusive: false,
    });
    const testTag = new TagClass({
      classification: testClassification.data.name,
    });
    const testGlossary = new Glossary();
    const testGlossaryTerm = new GlossaryTerm(testGlossary);
    const ownerUser = new UserClass();

    let currentDomainName = '';
    let subDomain: SubDomain | undefined;
    let dataProduct: DataProduct | undefined;

    try {
      // Setup all entities
      await testClassification.create(apiContext);
      await testTag.create(apiContext);
      await testGlossary.create(apiContext);
      await testGlossaryTerm.create(apiContext);
      await ownerUser.create(apiContext);
      await domain.create(apiContext);
      currentDomainName = domain.responseData.name;

      // Create subdomain
      subDomain = new SubDomain(domain);
      await subDomain.create(apiContext);

      // Create data product
      dataProduct = new DataProduct([domain]);
      await dataProduct.create(apiContext);

      // Add owner to domain
      await domain.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/owners/0',
            value: {
              id: ownerUser.responseData.id,
              type: 'user',
            },
          },
        ],
      });

      // Navigate to domain and add assets
      await sidebarClick(page, SidebarItem.DOMAIN);
      await addAssetsToDomain(page, domain, assets);

      // Navigate back to documentation to add tags
      await page.getByTestId('documentation').click();

      await addTagsAndGlossaryToDomain(page, {
        tagFqn: testTag.responseData.fullyQualifiedName,
        glossaryTermFqn: testGlossaryTerm.responseData.fullyQualifiedName,
      });

      // Verify all relationships before rename
      await checkAssetsCount(page, assets.length);
      await expect(
        page.locator(
          `[data-testid="tag-${testTag.responseData.fullyQualifiedName}"]`
        )
      ).toBeVisible();
      await expect(
        page.getByTestId(ownerUser.responseData.displayName)
      ).toBeVisible();

      // Verify subdomain count
      await expect(
        page.getByTestId('subdomains').getByTestId('count')
      ).toContainText('1');

      // Verify data products count
      await expect(
        page.getByTestId('data_products').getByTestId('count')
      ).toContainText('1');

      // Perform rename
      const newDomainName = `renamed-comprehensive-${uuid()}`;
      await renameDomain(page, newDomainName);

      currentDomainName = newDomainName;

      // Verify domain name changed
      await expect(page.getByTestId('entity-header-name')).toContainText(
        newDomainName
      );

      // Verify ALL relationships are preserved after rename

      // 1. Verify assets by visiting each asset page and clicking domain link
      await verifyDomainOnAssetPages(
        page,
        assets,
        domain.responseData.displayName,
        newDomainName
      );

      // 2. Verify subdomain
      const subdomainSearchResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.url().includes('index=domain_search_index') &&
          response.status() === 200
      );

      const subDomainsTab = page
        .getByTestId('subdomains')
        .getByText('Sub Domains');
      await expect(subDomainsTab).toBeVisible();
      await subDomainsTab.click();
      await subdomainSearchResponse;

      await waitForAllLoadersToDisappear(page);

      const subDomainCard = page.getByTestId(subDomain.data.name);
      await expect(subDomainCard).toBeVisible();

      // 3. Verify data products
      const dataProductsTab = page.getByTestId('data_products');
      await expect(dataProductsTab).toBeVisible();
      await dataProductsTab.click();

      await waitForAllLoadersToDisappear(page);

      await expect(
        page.getByTestId('data_products').getByTestId('count')
      ).toContainText('1');

      // 4. Verify tags still visible (navigate back to documentation)
      const documentationTab = page.getByTestId('documentation');
      await expect(documentationTab).toBeVisible();
      await documentationTab.click();

      await expect(
        page.locator(
          `[data-testid="tag-${testTag.responseData.fullyQualifiedName}"]`
        )
      ).toBeVisible();

      // 5. Verify owner still visible
      await expect(
        page.getByTestId(ownerUser.responseData.displayName)
      ).toBeVisible();
    } finally {
      try {
        await dataProduct?.delete(apiContext);
      } catch {
        // Ignore
      }
      try {
        await apiContext.delete(
          `/api/v1/domains/name/${encodeURIComponent(
            currentDomainName
          )}?hardDelete=true&recursive=true`
        );
      } catch {
        try {
          await domain.delete(apiContext);
        } catch {
          // Ignore cleanup errors
        }
      }
      await assetCleanup();
      await testGlossaryTerm.delete(apiContext);
      await testGlossary.delete(apiContext);
      await testTag.delete(apiContext);
      await testClassification.delete(apiContext);
      await ownerUser.delete(apiContext);
      await afterAction();
    }
  });

  test('Multiple consecutive domain renames preserve all associations', async ({
    page,
  }) => {
    test.slow();

    const { afterAction, apiContext } = await getApiContext(page);
    const { assets, assetCleanup } = await setupAssetsForDomain(page);
    const domain = new Domain();

    let currentDomainName = '';

    try {
      await domain.create(apiContext);
      currentDomainName = domain.responseData.name;

      // Create subdomain
      const subDomain = new SubDomain(domain);
      await subDomain.create(apiContext);

      // Navigate to domain and add assets
      await sidebarClick(page, SidebarItem.DOMAIN);
      await addAssetsToDomain(page, domain, assets);

      const performRenameAndVerify = async (renameIndex: number) => {
        const documentationTab = page.getByTestId('documentation');
        await expect(documentationTab).toBeVisible();
        await documentationTab.click();

        const newDomainName = `renamed-multi-${renameIndex}-${uuid()}`;
        await renameDomain(page, newDomainName);

        currentDomainName = newDomainName;

        await expect(page.getByTestId('entity-header-name')).toContainText(
          newDomainName
        );

        // Verify assets by visiting each asset page and clicking domain link
        await verifyDomainOnAssetPages(
          page,
          assets,
          domain.responseData.displayName,
          newDomainName
        );

        const subdomainSearchResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/search/query') &&
            response.url().includes('index=domain_search_index') &&
            response.status() === 200
        );

        const subDomainsTab = page
          .getByTestId('subdomains')
          .getByText('Sub Domains');
        await expect(subDomainsTab).toBeVisible();
        await subDomainsTab.click();
        await subdomainSearchResponse;

        await waitForAllLoadersToDisappear(page);

        const subDomainCard = page.getByTestId(subDomain.data.name);
        await expect(subDomainCard).toBeVisible();
      };

      // Perform 3 consecutive renames sequentially
      await performRenameAndVerify(1);
      await performRenameAndVerify(2);
      await performRenameAndVerify(3);
    } finally {
      try {
        await apiContext.delete(
          `/api/v1/domains/name/${encodeURIComponent(
            currentDomainName
          )}?hardDelete=true&recursive=true`
        );
      } catch {
        try {
          await domain.delete(apiContext);
        } catch {
          // Ignore cleanup errors
        }
      }
      await assetCleanup();
      await afterAction();
    }
  });

  test('Rename to existing domain name shows appropriate error', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain1 = new Domain();
    const domain2 = new Domain();

    try {
      await domain1.create(apiContext);
      await domain2.create(apiContext);

      // Navigate to domain1
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain1.data);

      // Try to rename domain1 to domain2's name
      await page.getByTestId('manage-button').click();
      await page.getByTestId('rename-button-title').click();

      await expect(page.getByRole('dialog')).toBeVisible();

      await page.locator('#name').clear();
      await page.locator('#name').fill(domain2.responseData.name);

      // Try to save and expect an error response
      const patchResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/domains/') &&
          response.request().method() === 'PATCH'
      );
      await page.getByTestId('save-button').click();
      const response = await patchResponse;

      // Verify the response status is 409 (Conflict) or 400 (Bad Request)
      expect([400, 409]).toContain(response.status());

      // Verify an error toast/alert is shown
      await expect(page.getByTestId('alert-bar')).toBeVisible();

      // Verify the error message contains information about the duplicate name
      await expect(page.getByTestId('alert-message')).toContainText(
        /already exists/i
      );
    } finally {
      await domain1.delete(apiContext);
      await domain2.delete(apiContext);
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
    const rolesCombobox = page.locator('input[role="combobox"]').nth(1);
    await expect(rolesCombobox).toBeVisible();
    await rolesCombobox.click();

    await page.waitForSelector('[data-testid="profile-edit-roles-select"]');

    const roleOption = page.getByText('Domain Only Access Role');
    await expect(roleOption).toBeVisible();
    await roleOption.click();

    // Close the dropdown by pressing Escape
    await page.keyboard.press('Escape');

    // Wait for dropdown to close
    await expect(page.locator('.ant-select-dropdown')).toBeHidden();

    const patchRes = page.waitForResponse('/api/v1/users/*');
    const saveButton = page.getByTestId('user-profile-edit-roles-save-button');
    await expect(saveButton).toBeVisible();
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
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
    await glossaryTerm.delete(apiContext);
    await glossary.delete(apiContext);
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
    await waitForAllLoadersToDisappear(page);

    const treeViewButton = page.getByRole('button', { name: 'tree' });
    await expect(treeViewButton).toBeVisible();
    await treeViewButton.click();

    await waitForAllLoadersToDisappear(page);

    const searchBox = page
      .getByTestId('page-layout-v1')
      .getByRole('textbox', { name: 'Search' });
    await expect(searchBox).toBeVisible();
    await searchBox.clear();

    const searchDomain = page.waitForResponse(
      `/api/v1/search/query?q=*${encodeURIComponent(domainDisplayName)}*`
    );
    await searchBox.fill(domainDisplayName);
    await searchDomain;

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

  test('Verify Domain entity API calls do not include invalid domains field in glossary term assets', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const testGlossary = new Glossary();
    const testGlossaryTerm = new GlossaryTerm(testGlossary);
    const testDomain = new Domain();

    try {
      await testGlossary.create(apiContext);
      await testGlossaryTerm.create(apiContext);
      await testDomain.create(apiContext);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.DOMAIN);
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', { state: 'hidden' });
      await selectDomain(page, testDomain.data);
      await page.waitForLoadState('networkidle');

      await page.waitForSelector('[data-testid="glossary-container"]', {
        state: 'visible',
      });

      // Add only glossary term to domain (no tags)
      await assignGlossaryTerm(
        page,
        {
          displayName: testGlossaryTerm.data.displayName,
          name: testGlossaryTerm.data.name,
          fullyQualifiedName: testGlossaryTerm.responseData.fullyQualifiedName,
        },
        'Add',
        EntityTypeEndpoint.Domain
      );

      await visitGlossaryPage(page, testGlossary.data.displayName);
      await selectActiveGlossaryTerm(page, testGlossaryTerm.data.displayName);

      let apiRequestUrl: string | null = null;
      const responsePromise = page.waitForResponse((response) => {
        const url = response.url();
        if (
          url.includes('/api/v1/domains/name/') &&
          url.includes('fields=') &&
          response.status() === 200
        ) {
          apiRequestUrl = url;
          return true;
        }
        return false;
      });

      await page.getByTestId('assets').click();
      await responsePromise;
      await page.waitForSelector('.ant-tabs-tab-active:has-text("Assets")');
      await waitForAllLoadersToDisappear(page);

      expect(apiRequestUrl).not.toBeNull();
      const urlObj = new URL(apiRequestUrl!);
      const fields = urlObj.searchParams.get('fields');
      const fieldArray = fields?.split(',') ?? [];

      expect(fieldArray.includes('domains')).toBe(false);
    } finally {
      await testDomain.delete(apiContext);
      await testGlossaryTerm.delete(apiContext);
      await testGlossary.delete(apiContext);
      await afterAction();
    }
  });

  test('Verify Domain entity API calls do not include invalid domains field in tag assets', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const testClassification = new ClassificationClass({
      provider: 'system',
      mutuallyExclusive: false,
    });
    const testTag = new TagClass({
      classification: testClassification.data.name,
    });
    const testDomain = new Domain();

    try {
      await testClassification.create(apiContext);
      await testTag.create(apiContext);
      await testDomain.create(apiContext);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.DOMAIN);
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', { state: 'hidden' });
      await selectDomain(page, testDomain.data);
      await page.waitForLoadState('networkidle');

      await page.waitForSelector('[data-testid="tags-container"]', {
        state: 'visible',
      });

      await page
        .locator('[data-testid="tags-container"] [data-testid="add-tag"]')
        .click();
      const input = page.locator(
        '[data-testid="tags-container"] #tagsForm_tags'
      );
      await input.click();
      await input.fill(testTag.responseData.fullyQualifiedName);
      await page
        .getByTestId(`tag-${testTag.responseData.fullyQualifiedName}`)
        .click();

      const updateResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/domains/') &&
          response.request().method() === 'PATCH'
      );
      await page.getByTestId('saveAssociatedTag').click();
      await updateResponse;

      await testTag.visitPage(page);

      let apiRequestUrl: string | null = null;
      const responsePromise = page.waitForResponse((response) => {
        const url = response.url();
        if (
          url.includes('/api/v1/domains/name/') &&
          url.includes('fields=') &&
          response.status() === 200
        ) {
          apiRequestUrl = url;
          return true;
        }
        return false;
      });

      await page.getByTestId('assets').click();
      await responsePromise;
      await page.waitForSelector('.ant-tabs-tab-active:has-text("Assets")');
      await waitForAllLoadersToDisappear(page);

      expect(apiRequestUrl).not.toBeNull();
      const urlObj = new URL(apiRequestUrl!);
      const fields = urlObj.searchParams.get('fields');
      const fieldArray = fields?.split(',') ?? [];

      expect(fieldArray.includes('domains')).toBe(false);
    } finally {
      await testDomain.delete(apiContext);
      await testTag.delete(apiContext);
      await testClassification.delete(apiContext);
      await afterAction();
    }
  });
});
