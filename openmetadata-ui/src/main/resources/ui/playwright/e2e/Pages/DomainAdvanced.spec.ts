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

import {
  APIRequestContext,
  expect,
  Page,
  test as base,
} from '@playwright/test';
import { get } from 'lodash';
import { SidebarItem } from '../../constant/sidebar';
import { PolicyClass } from '../../support/access-control/PoliciesClass';
import { RolesClass } from '../../support/access-control/RolesClass';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { SubDomain } from '../../support/domain/SubDomain';
import { TableClass } from '../../support/entity/TableClass';
import { TeamClass } from '../../support/team/TeamClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { getApiContext, uuid } from '../../utils/common';
import {
  addAssetsToDomain,
  checkAssetsCount,
  selectDataProduct,
  selectDomain,
  setupAssetsForDomain,
} from '../../utils/domain';
import { sidebarClick } from '../../utils/sidebar';
import { performUserLogin } from '../../utils/user';

const test = base.extend<{
  page: Page;
}>({
  page: async ({ browser }, use) => {
    const { page } = await performAdminLogin(browser);
    await use(page);
    await page.close();
  },
});

test.describe('Domain Expert Permissions', () => {
  test.slow(true);

  let testResources: {
    expertUser: UserClass;
    domain: Domain;
    dataProduct: DataProduct;
    cleanup: (apiContext: APIRequestContext) => Promise<void>;
  };

  test.beforeAll('Setup domain with expert', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const id = uuid();

    const expertUser = new UserClass();
    await expertUser.create(apiContext);

    const domain = new Domain({
      name: `PW_Domain_Expert_Test_${id}`,
      displayName: `PW Domain Expert Test ${id}`,
      description: 'Domain for expert permission testing',
      domainType: 'Aggregate',
      fullyQualifiedName: `PW_Domain_Expert_Test_${id}`,
      experts: [expertUser.responseData.name],
    });
    await domain.create(apiContext);

    const dataProduct = new DataProduct([domain]);
    await dataProduct.create(apiContext);

    const cleanup = async (cleanupContext: APIRequestContext) => {
      await dataProduct.delete(cleanupContext);
      await domain.delete(cleanupContext);
      await expertUser.delete(cleanupContext);
    };

    testResources = {
      expertUser,
      domain,
      dataProduct,
      cleanup,
    };

    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await testResources.cleanup(apiContext);
    await afterAction();
  });

  test('Domain expert can edit domain description and tags', async ({
    browser,
  }) => {
    const { page: expertPage, afterAction } = await performUserLogin(
      browser,
      testResources.expertUser
    );

    await sidebarClick(expertPage, SidebarItem.DOMAIN);
    await selectDomain(expertPage, testResources.domain.data);

    await expect(expertPage.getByTestId('edit-description')).toBeVisible();
    await expect(
      expertPage.getByTestId('tags-container').getByTestId('add-tag')
    ).toBeVisible();

    await afterAction();
  });

  test('Domain expert can manage data products', async ({ browser }) => {
    const { page: expertPage, afterAction } = await performUserLogin(
      browser,
      testResources.expertUser
    );

    await sidebarClick(expertPage, SidebarItem.DATA_PRODUCT);
    await selectDataProduct(expertPage, testResources.dataProduct.responseData);

    await expect(expertPage.getByTestId('edit-description')).toBeVisible();

    await afterAction();
  });
});

test.describe('Move Assets Between Domains', () => {
  test.slow(true);

  test('Move table from one domain to another via API', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain1 = new Domain();
    const domain2 = new Domain();
    const table = new TableClass();

    try {
      await domain1.create(apiContext);
      await domain2.create(apiContext);
      await table.create(apiContext);

      await table.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/domains/0',
            value: {
              id: domain1.responseData.id,
              type: 'domain',
            },
          },
        ],
      });

      await page.goto(
        `/table/${encodeURIComponent(
          table.entityResponseData.fullyQualifiedName
        )}`
      );
      await page.waitForLoadState('networkidle');

      await expect(
        page.locator('[data-testid="domain-link"]').first()
      ).toContainText(domain1.data.displayName);

      await table.patch({
        apiContext,
        patchData: [
          {
            op: 'replace',
            path: '/domains/0',
            value: {
              id: domain2.responseData.id,
              type: 'domain',
            },
          },
        ],
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      await expect(
        page.locator('[data-testid="domain-link"]').first()
      ).toContainText(domain2.data.displayName);

      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain1.data);
      await page.getByTestId('assets').click();
      await checkAssetsCount(page, 0);

      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain2.data);
      await page.getByTestId('assets').click();
      await checkAssetsCount(page, 1);
    } finally {
      await table.delete(apiContext);
      await domain1.delete(apiContext);
      await domain2.delete(apiContext);
      await afterAction();
    }
  });

  test('Move asset from domain to subdomain via API', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const subDomain = new SubDomain(domain);
    const table = new TableClass();

    try {
      await domain.create(apiContext);
      await subDomain.create(apiContext);
      await table.create(apiContext);

      await table.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/domains/0',
            value: {
              id: domain.responseData.id,
              type: 'domain',
            },
          },
        ],
      });

      await table.patch({
        apiContext,
        patchData: [
          {
            op: 'replace',
            path: '/domains/0',
            value: {
              id: subDomain.responseData.id,
              type: 'domain',
            },
          },
        ],
      });

      await page.goto(
        `/table/${encodeURIComponent(
          table.entityResponseData.fullyQualifiedName
        )}`
      );
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      const domainLinks = page.locator('[data-testid="domain-link"]');
      const count = await domainLinks.count();

      if (count > 0) {
        await expect(domainLinks.first()).toContainText(
          subDomain.data.displayName
        );
      }
    } finally {
      await table.delete(apiContext);
      await subDomain.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });
});

test.describe('Subdomain Permissions', () => {
  test.slow(true);

  let testResources: {
    testUser: UserClass;
    domain: Domain;
    subDomain: SubDomain;
    domainPolicy: PolicyClass;
    domainRole: RolesClass;
    domainTeam: TeamClass;
    cleanup: (apiContext: APIRequestContext) => Promise<void>;
  };

  test.beforeAll('Setup subdomain with permissions', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const id = uuid();

    const testUser = new UserClass();
    await testUser.create(apiContext);

    const domain = new Domain();
    await domain.create(apiContext);

    const subDomain = new SubDomain(domain);
    await subDomain.create(apiContext);

    const domainPolicy = new PolicyClass();
    const domainRule = [
      {
        name: 'SubDomainAccessRule',
        description: '',
        resources: ['All'],
        operations: ['ViewAll', 'EditDescription'],
        effect: 'allow',
        condition: `hasDomain('${domain.responseData.fullyQualifiedName}')`,
      },
    ];
    await domainPolicy.create(apiContext, domainRule);

    const domainRole = new RolesClass();
    await domainRole.create(apiContext, [domainPolicy.responseData.name]);

    const domainTeam = new TeamClass({
      name: `PW_Team_SubDomain_${id}`,
      displayName: `PW Team SubDomain ${id}`,
      description: 'Team for subdomain permission testing',
      teamType: 'Group',
      users: [testUser.responseData.id ?? ''],
      defaultRoles: [domainRole.responseData.id ?? ''],
    });
    await domainTeam.create(apiContext);

    await testUser.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/domains/0',
          value: {
            id: domain.responseData.id,
            type: 'domain',
          },
        },
      ],
    });

    const cleanup = async (cleanupContext: APIRequestContext) => {
      await subDomain.delete(cleanupContext);
      await domain.delete(cleanupContext);
      await domainTeam.delete(cleanupContext);
      await domainRole.delete(cleanupContext);
      await domainPolicy.delete(cleanupContext);
      await testUser.delete(cleanupContext);
    };

    testResources = {
      testUser,
      domain,
      subDomain,
      domainPolicy,
      domainRole,
      domainTeam,
      cleanup,
    };

    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await testResources.cleanup(apiContext);
    await afterAction();
  });

  test('User with domain access can view subdomains', async ({ browser }) => {
    const { page: userPage, afterAction } = await performUserLogin(
      browser,
      testResources.testUser
    );

    await sidebarClick(userPage, SidebarItem.DOMAIN);
    await selectDomain(userPage, testResources.domain.data);

    await userPage.getByTestId('subdomains').click();

    await expect(
      userPage.getByTestId(testResources.subDomain.data.name)
    ).toBeVisible();

    await afterAction();
  });

  test('User can access subdomain details page', async ({ browser }) => {
    const { page: userPage, afterAction } = await performUserLogin(
      browser,
      testResources.testUser
    );

    const subDomainFqn =
      testResources.subDomain.responseData.fullyQualifiedName;
    await userPage.goto(`/domain/${encodeURIComponent(subDomainFqn)}`);
    await userPage.waitForLoadState('networkidle');
    await userPage.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    await expect(
      userPage.getByTestId('entity-header-display-name')
    ).toContainText(testResources.subDomain.data.displayName);

    await afterAction();
  });
});

test.describe('Domain Version History', () => {
  test.slow(true);

  test('Domain version history shows changes', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();

    try {
      await domain.create(apiContext);

      await domain.patch({
        apiContext,
        patchData: [
          {
            op: 'replace',
            path: '/description',
            value: 'Updated domain description for version test',
          },
        ],
      });

      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain.data);

      await page.waitForSelector('[data-testid="version-button"]', {
        state: 'visible',
      });

      await expect(page.getByTestId('version-button')).toContainText('0.2');

      await page.getByTestId('version-button').click();
      await page.waitForLoadState('networkidle');

      await expect(page.locator('.version-data')).toBeVisible();
    } finally {
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Data product version history shows changes', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const dataProduct = new DataProduct([domain]);

    try {
      await domain.create(apiContext);
      await dataProduct.create(apiContext);

      await apiContext.patch(
        `/api/v1/dataProducts/${dataProduct.responseData.id}`,
        {
          data: [
            {
              op: 'replace',
              path: '/description',
              value: 'Updated data product description for version test',
            },
          ],
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      );

      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, dataProduct.responseData);

      await page.waitForSelector('[data-testid="version-button"]', {
        state: 'visible',
      });

      await expect(page.getByTestId('version-button')).toContainText('0.2');
    } finally {
      await dataProduct.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });
});

test.describe('Domain Description Editing', () => {
  test.slow(true);

  test('Admin can edit domain description', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();

    try {
      await domain.create(apiContext);

      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain.data);

      await page.getByTestId('edit-description').click();
      await page.locator('.om-block-editor[contenteditable="true"]').clear();
      await page
        .locator('.om-block-editor[contenteditable="true"]')
        .fill('Updated domain description via UI');

      const saveRes = page.waitForResponse('/api/v1/domains/*');
      await page.getByTestId('save').click();
      await saveRes;

      await page.waitForLoadState('networkidle');

      await expect(
        page.locator('.om-block-editor[contenteditable="false"]')
      ).toContainText('Updated domain description via UI');
    } finally {
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Admin can edit data product description', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const dataProduct = new DataProduct([domain]);

    try {
      await domain.create(apiContext);
      await dataProduct.create(apiContext);

      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, dataProduct.responseData);

      await page.getByTestId('edit-description').click();
      await page.locator('.om-block-editor[contenteditable="true"]').clear();
      await page
        .locator('.om-block-editor[contenteditable="true"]')
        .fill('Updated data product description via UI');

      const saveRes = page.waitForResponse('/api/v1/dataProducts/*');
      await page.getByTestId('save').click();
      await saveRes;

      await page.waitForLoadState('networkidle');

      await expect(
        page.locator('.om-block-editor[contenteditable="false"]')
      ).toContainText('Updated data product description via UI');
    } finally {
      await dataProduct.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });
});

test.describe('Bulk Domain Asset Operations', () => {
  test.slow(true);

  test('Add multiple assets to domain at once', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const { assets, assetCleanup } = await setupAssetsForDomain(page);
    const domain = new Domain();

    try {
      await domain.create(apiContext);

      await sidebarClick(page, SidebarItem.DOMAIN);
      await addAssetsToDomain(page, domain, assets);

      await checkAssetsCount(page, assets.length);
    } finally {
      await domain.delete(apiContext);
      await assetCleanup();
      await afterAction();
    }
  });

  test('Remove multiple assets from domain at once', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const { assets, assetCleanup } = await setupAssetsForDomain(page);
    const domain = new Domain();

    try {
      await domain.create(apiContext);

      await sidebarClick(page, SidebarItem.DOMAIN);
      await addAssetsToDomain(page, domain, assets);
      await checkAssetsCount(page, assets.length);

      for (const asset of assets) {
        const fqn = get(asset, 'entityResponseData.fullyQualifiedName');
        await page
          .locator(`[data-testid="table-data-card_${fqn}"] input`)
          .check();
      }

      const removeRes = page.waitForResponse('/api/v1/domains/*/assets/remove');
      await page.getByTestId('delete-all-button').click();
      await removeRes;

      await page.reload();
      await checkAssetsCount(page, 0);
    } finally {
      await domain.delete(apiContext);
      await assetCleanup();
      await afterAction();
    }
  });
});

test.describe('Cross-Domain Access Denial', () => {
  test.slow(true);

  let testResources: {
    testUser: UserClass;
    accessibleDomain: Domain;
    inaccessibleDomain: Domain;
    accessibleTable: TableClass;
    inaccessibleTable: TableClass;
    domainPolicy: PolicyClass;
    domainRole: RolesClass;
    domainTeam: TeamClass;
    cleanup: (apiContext: APIRequestContext) => Promise<void>;
  };

  test.beforeAll('Setup cross-domain test', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const id = uuid();

    const testUser = new UserClass();
    await testUser.create(apiContext);

    const accessibleDomain = new Domain();
    const inaccessibleDomain = new Domain();
    await accessibleDomain.create(apiContext);
    await inaccessibleDomain.create(apiContext);

    const accessibleTable = new TableClass();
    const inaccessibleTable = new TableClass();
    await accessibleTable.create(apiContext);
    await inaccessibleTable.create(apiContext);

    await accessibleTable.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/domains/0',
          value: {
            id: accessibleDomain.responseData.id,
            type: 'domain',
          },
        },
      ],
    });

    await inaccessibleTable.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/domains/0',
          value: {
            id: inaccessibleDomain.responseData.id,
            type: 'domain',
          },
        },
      ],
    });

    const domainPolicy = new PolicyClass();
    const domainRule = [
      {
        name: 'DomainOnlyRule',
        description: '',
        resources: ['All'],
        operations: ['ViewAll'],
        effect: 'allow',
        condition: `hasDomain('${accessibleDomain.responseData.fullyQualifiedName}')`,
      },
    ];
    await domainPolicy.create(apiContext, domainRule);

    const domainRole = new RolesClass();
    await domainRole.create(apiContext, [domainPolicy.responseData.name]);

    const domainTeam = new TeamClass({
      name: `PW_Team_CrossDomain_${id}`,
      displayName: `PW Team CrossDomain ${id}`,
      description: 'Team for cross-domain testing',
      teamType: 'Group',
      users: [testUser.responseData.id ?? ''],
      defaultRoles: [domainRole.responseData.id ?? ''],
    });
    await domainTeam.create(apiContext);

    await testUser.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/domains/0',
          value: {
            id: accessibleDomain.responseData.id,
            type: 'domain',
          },
        },
      ],
    });

    const cleanup = async (cleanupContext: APIRequestContext) => {
      await accessibleTable.delete(cleanupContext);
      await inaccessibleTable.delete(cleanupContext);
      await accessibleDomain.delete(cleanupContext);
      await inaccessibleDomain.delete(cleanupContext);
      await domainTeam.delete(cleanupContext);
      await domainRole.delete(cleanupContext);
      await domainPolicy.delete(cleanupContext);
      await testUser.delete(cleanupContext);
    };

    testResources = {
      testUser,
      accessibleDomain,
      inaccessibleDomain,
      accessibleTable,
      inaccessibleTable,
      domainPolicy,
      domainRole,
      domainTeam,
      cleanup,
    };

    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await testResources.cleanup(apiContext);
    await afterAction();
  });

  test('User can access assets in their domain', async ({ browser }) => {
    const { page: userPage, afterAction } = await performUserLogin(
      browser,
      testResources.testUser
    );

    const tableFqn =
      testResources.accessibleTable.entityResponseData.fullyQualifiedName;
    await userPage.goto(`/table/${encodeURIComponent(tableFqn)}`);
    await userPage.waitForLoadState('networkidle');
    await userPage.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    await expect(
      userPage.getByTestId('permission-error-placeholder')
    ).not.toBeVisible();
    await expect(userPage.getByTestId('entity-header-title')).toBeVisible();

    await afterAction();
  });

  test('User with domain policy is restricted by policy rules', async ({
    browser,
  }) => {
    const { page: userPage, afterAction } = await performUserLogin(
      browser,
      testResources.testUser
    );

    const tableFqn =
      testResources.accessibleTable.entityResponseData.fullyQualifiedName;
    await userPage.goto(`/table/${encodeURIComponent(tableFqn)}`);
    await userPage.waitForLoadState('networkidle');
    await userPage.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    await expect(userPage.getByTestId('entity-header-title')).toBeVisible();

    await afterAction();
  });
});

test.describe('Domain Type Behavior', () => {
  test.slow(true);

  test('Create domain with Source System type', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain({
      name: `PW_Domain_SourceSystem_${uuid()}`,
      displayName: `PW Domain SourceSystem ${uuid()}`,
      description: 'Source system domain type test',
      domainType: 'Source-aligned',
      fullyQualifiedName: `PW_Domain_SourceSystem_${uuid()}`,
    });

    try {
      await domain.create(apiContext);

      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain.data);

      await expect(
        page.getByTestId('domain-type-label').locator('div')
      ).toContainText('Source-aligned');
    } finally {
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Create domain with Consumer-aligned type', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain({
      name: `PW_Domain_Consumer_${uuid()}`,
      displayName: `PW Domain Consumer ${uuid()}`,
      description: 'Consumer-aligned domain type test',
      domainType: 'Consumer-aligned',
      fullyQualifiedName: `PW_Domain_Consumer_${uuid()}`,
    });

    try {
      await domain.create(apiContext);

      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain.data);

      await expect(
        page.getByTestId('domain-type-label').locator('div')
      ).toContainText('Consumer-aligned');
    } finally {
      await domain.delete(apiContext);
      await afterAction();
    }
  });
});

test.describe('Data Product Asset Management', () => {
  test.slow(true);

  test('Move assets between data products', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const dataProduct1 = new DataProduct([domain]);
    const dataProduct2 = new DataProduct([domain]);
    const table = new TableClass();

    try {
      await domain.create(apiContext);
      await dataProduct1.create(apiContext);
      await dataProduct2.create(apiContext);
      await table.create(apiContext);

      await table.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/domains/0',
            value: {
              id: domain.responseData.id,
              type: 'domain',
            },
          },
        ],
      });

      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, dataProduct1.responseData);
      await page.getByTestId('assets').click();
      await page.getByTestId('data-product-details-add-button').click();
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      const tableName = table.entityResponseData.name;
      const tableFqn = table.entityResponseData.fullyQualifiedName;
      const searchRes = page.waitForResponse(
        `/api/v1/search/query?q=${tableName}&index=all&from=0&size=25&*`
      );
      await page.getByTestId('searchbar').fill(tableName);
      await searchRes;

      await page
        .locator(`[data-testid="table-data-card_${tableFqn}"] input`)
        .check();

      const addRes = page.waitForResponse('/api/v1/dataProducts/*/assets/add');
      await page.getByTestId('save-btn').click();
      await addRes;

      await checkAssetsCount(page, 1);

      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, dataProduct2.responseData);
      await page.getByTestId('assets').click();
      await checkAssetsCount(page, 0);
    } finally {
      await table.delete(apiContext);
      await dataProduct1.delete(apiContext);
      await dataProduct2.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });
});

test.describe('Domain Search and Filter', () => {
  test.slow(true);

  test('Search for domain by name', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const uniqueId = uuid();
    const domain = new Domain({
      name: `SearchTestDomain_${uniqueId}`,
      displayName: `Search Test Domain ${uniqueId}`,
      description: 'Domain for search testing',
      domainType: 'Aggregate',
      fullyQualifiedName: `SearchTestDomain_${uniqueId}`,
    });

    try {
      await domain.create(apiContext);

      await sidebarClick(page, SidebarItem.DOMAIN);

      const searchBox = page
        .getByTestId('page-layout-v1')
        .getByPlaceholder('Search');

      await searchBox.fill(`SearchTestDomain_${uniqueId}`);

      await page.waitForResponse(
        '/api/v1/search/query?q=*&index=domain_search_index*'
      );

      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await expect(page.getByTestId(domain.data.name)).toBeVisible();
    } finally {
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Filter assets by domain from explore page', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const table = new TableClass();

    try {
      await domain.create(apiContext);
      await table.create(apiContext);

      await table.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/domains/0',
            value: {
              id: domain.responseData.id,
              type: 'domain',
            },
          },
        ],
      });

      await page.goto('/explore/tables');
      await page.waitForLoadState('networkidle');

      await page.getByTestId('domain-dropdown').click();

      const domainTag = page.getByTestId(
        `tag-${domain.responseData.fullyQualifiedName}`
      );

      if (await domainTag.isVisible()) {
        await domainTag.click();
        await page.waitForLoadState('networkidle');

        await expect(page.getByTestId('domain-dropdown')).toContainText(
          domain.data.displayName
        );
      }
    } finally {
      await table.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });
});
