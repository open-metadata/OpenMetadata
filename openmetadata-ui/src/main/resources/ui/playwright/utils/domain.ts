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
import test, { APIRequestContext, expect, Page } from '@playwright/test';
import { get, isEmpty, isUndefined } from 'lodash';
import { SidebarItem } from '../constant/sidebar';
import { PolicyClass } from '../support/access-control/PoliciesClass';
import { RolesClass } from '../support/access-control/RolesClass';
import { DataProduct } from '../support/domain/DataProduct';
import { Domain } from '../support/domain/Domain';
import { SubDomain } from '../support/domain/SubDomain';
import { DashboardClass } from '../support/entity/DashboardClass';
import { EntityTypeEndpoint } from '../support/entity/Entity.interface';
import { EntityClass } from '../support/entity/EntityClass';
import { TableClass } from '../support/entity/TableClass';
import { TopicClass } from '../support/entity/TopicClass';
import { TeamClass } from '../support/team/TeamClass';
import { UserClass } from '../support/user/UserClass';
import {
  closeFirstPopupAlert,
  descriptionBox,
  getApiContext,
  INVALID_NAMES,
  NAME_MAX_LENGTH_VALIDATION_ERROR,
  NAME_VALIDATION_ERROR,
  redirectToHomePage,
  uuid,
} from './common';
import { addOwner } from './entity';
import { sidebarClick } from './sidebar';

export const assignDomain = async (page: Page, domain: Domain['data']) => {
  await page.getByTestId('add-domain').click();
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
  const searchDomain = page.waitForResponse(
    `/api/v1/search/query?q=*${encodeURIComponent(domain.name)}*`
  );
  await page
    .getByTestId('selectable-list')
    .getByTestId('searchbar')
    .fill(domain.name);
  await searchDomain;
  await page.getByRole('listitem', { name: domain.displayName }).click();

  const patchReq = page.waitForResponse(
    (req) => req.request().method() === 'PATCH'
  );

  await page.getByTestId('saveAssociatedTag').click();
  await patchReq;
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  await expect(page.getByTestId('domain-link')).toContainText(
    domain.displayName
  );
};

export const updateDomain = async (page: Page, domain: Domain['data']) => {
  await page.getByTestId('add-domain').click();
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
  await page.getByTestId('selectable-list').getByTestId('searchbar').clear();
  const searchDomain = page.waitForResponse(
    `/api/v1/search/query?q=*${encodeURIComponent(domain.name)}*`
  );
  await page
    .getByTestId('selectable-list')
    .getByTestId('searchbar')
    .fill(domain.name);
  await searchDomain;
  await page.getByRole('listitem', { name: domain.displayName }).click();

  await expect(page.getByTestId('domain-link')).toContainText(
    domain.displayName
  );
};

export const removeDomain = async (page: Page) => {
  await page.getByTestId('add-domain').click();
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  await expect(page.getByTestId('remove-owner').locator('path')).toBeVisible();

  await page.getByTestId('remove-owner').locator('svg').click();

  await expect(page.getByTestId('no-domain-text')).toContainText('No Domain');
};

export const validateDomainForm = async (page: Page) => {
  // Error messages
  await expect(page.locator('#name_help')).toHaveText('Name is required');
  await expect(page.locator('#description_help')).toHaveText(
    'Description is required'
  );

  // Max length validation
  await page.locator('[data-testid="name"]').type(INVALID_NAMES.MAX_LENGTH);

  await expect(page.locator('#name_help')).toHaveText(
    NAME_MAX_LENGTH_VALIDATION_ERROR
  );

  // With special char validation
  await page.locator('[data-testid="name"]').clear();
  await page
    .locator('[data-testid="name"]')
    .type(INVALID_NAMES.WITH_SPECIAL_CHARS);

  await expect(page.locator('#name_help')).toHaveText(NAME_VALIDATION_ERROR);
};

export const selectDomain = async (page: Page, domain: Domain['data']) => {
  await page
    .getByRole('menuitem', { name: domain.displayName })
    .locator('span')
    .click();
  await page.waitForLoadState('networkidle');
};

export const selectSubDomain = async (
  page: Page,
  domain: Domain['data'],
  subDomain: SubDomain['data']
) => {
  const menuItem = page.getByRole('menuitem', { name: domain.displayName });
  const isSelected = await menuItem.evaluate((element) => {
    return element.classList.contains('ant-menu-item-selected');
  });

  if (!isSelected) {
    const subDomainRes = page.waitForResponse(
      '/api/v1/search/query?q=*&from=0&size=0&index=domain_search_index&deleted=false&track_total_hits=true'
    );
    await menuItem.click();
    await subDomainRes;
    await page.waitForLoadState('networkidle');
  }

  const subDomainRes = page.waitForResponse(
    '/api/v1/search/query?q=*&from=0&size=50&index=domain_search_index&deleted=false&track_total_hits=true'
  );
  await page.getByTestId('subdomains').getByText('Sub Domains').click();
  await subDomainRes;

  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

  await page.getByTestId(subDomain.name).click();
  await page.waitForLoadState('networkidle');
};

export const selectDataProductFromTab = async (
  page: Page,
  dataProduct: DataProduct['data']
) => {
  const dpRes = page.waitForResponse(
    '/api/v1/search/query?*&from=0&size=50&index=data_product_search_index*'
  );
  await page
    .locator('.domain-details-page-tabs')
    .getByText('Data Products')
    .click();

  await dpRes;

  const dpDataRes = page.waitForResponse('/api/v1/dataProducts/name/*');

  await page
    .getByTestId(`explore-card-${dataProduct.name}`)
    .getByTestId('entity-link')
    .click();
  await dpDataRes;
};

export const selectDataProduct = async (
  page: Page,
  domain: Domain['data'],
  dataProduct: DataProduct['data']
) => {
  await page
    .getByRole('menuitem', { name: domain.displayName })
    .locator('span')
    .click();

  await selectDataProductFromTab(page, dataProduct);
};

const goToAssetsTab = async (page: Page, domain: Domain['data']) => {
  await selectDomain(page, domain);
  await checkDomainDisplayName(page, domain.displayName);
  await page.getByTestId('assets').click();
};

const fillCommonFormItems = async (
  page: Page,
  entity: Domain['data'] | DataProduct['data'] | SubDomain['data']
) => {
  await page.locator('[data-testid="name"]').fill(entity.name);
  await page.locator('[data-testid="display-name"]').fill(entity.displayName);
  await page.locator(descriptionBox).fill(entity.description);
  if (!isEmpty(entity.owners) && !isUndefined(entity.owners)) {
    await addOwner({
      page,
      owner: entity.owners[0].name,
      type: entity.owners[0].type as 'Users' | 'Teams',
      endpoint: EntityTypeEndpoint.Domain,
      dataTestId: 'owner-container',
      initiatorId: 'add-owner',
    });
  }
};

export const fillDomainForm = async (
  page: Page,
  entity: Domain['data'] | SubDomain['data'],
  isDomain = true
) => {
  await fillCommonFormItems(page, entity);
  if (isDomain) {
    await page.click('[data-testid="domainType"]');
  } else {
    await page
      .getByLabel('Add Sub Domain')
      .getByTestId('domainType')
      .locator('div')
      .click();
  }
  await page.getByTitle(entity.domainType).locator('div').click();
};

export const checkDomainDisplayName = async (
  page: Page,
  displayName: string
) => {
  await page.waitForLoadState('networkidle');

  await expect(page.getByTestId('entity-header-display-name')).toHaveText(
    displayName
  );
};

export const checkAssetsCount = async (page: Page, count: number) => {
  await expect(page.getByTestId('assets').getByTestId('count')).toContainText(
    count.toString()
  );
};

export const checkDataProductCount = async (page: Page, count: number) => {
  await expect(
    page.getByTestId('data_products').getByTestId('count')
  ).toContainText(count.toString());
};

export const verifyDomain = async (
  page: Page,
  domain: Domain['data'] | SubDomain['data'],
  parentDomain?: Domain['data'],
  isDomain = true
) => {
  await checkDomainDisplayName(page, domain.displayName);

  const viewerContainerText = await page.textContent(
    '[data-testid="viewer-container"]'
  );

  await expect(viewerContainerText).toContain(domain.description);

  if (!isEmpty(domain.owners) && !isUndefined(domain.owners)) {
    await expect(
      page.getByTestId('domain-owner-name').getByTestId('owner-link')
    ).toContainText(domain.owners[0].name);
  }

  await expect(
    page.getByTestId('domain-type-label').locator('div')
  ).toContainText(domain.domainType);

  // Check breadcrumbs
  if (!isDomain && parentDomain) {
    await expect(
      page.getByRole('link', { name: parentDomain.fullyQualifiedName })
    ).toBeVisible();
  }
};

export const createDomain = async (
  page: Page,
  domain: Domain['data'],
  validate = false
) => {
  await page.click('[data-testid="add-domain"]');
  await page.waitForSelector('[data-testid="form-heading"]');

  await expect(page.locator('[data-testid="form-heading"]')).toHaveText(
    'Add Domain'
  );

  await page.click('[data-testid="save-domain"]');

  if (validate) {
    await validateDomainForm(page);
  }

  await fillDomainForm(page, domain);

  const domainRes = page.waitForResponse('/api/v1/domains');
  await page.click('[data-testid="save-domain"]');
  await domainRes;
  await checkDomainDisplayName(page, domain.displayName);
  await checkAssetsCount(page, 0);
  await checkDataProductCount(page, 0);
};

export const createSubDomain = async (
  page: Page,
  subDomain: SubDomain['data']
) => {
  await page.getByTestId('domain-details-add-button').click();
  await page.getByRole('menuitem', { name: 'Sub Domains' }).click();

  await expect(page.getByText('Add Sub Domain')).toBeVisible();

  await fillDomainForm(page, subDomain, false);
  const saveRes = page.waitForResponse('/api/v1/domains');
  await page.getByTestId('save-sub-domain').click();
  await saveRes;
};

export const addAssetsToDomain = async (
  page: Page,
  domain: Domain,
  assets: EntityClass[],
  navigateToAssetsTab = true
) => {
  if (navigateToAssetsTab) {
    await goToAssetsTab(page, domain.data);
  }
  await checkAssetsCount(page, 0);

  await expect(page.getByTestId('no-data-placeholder')).toContainText(
    'Adding a new Asset is easy, just give it a spin!'
  );

  await page.getByTestId('domain-details-add-button').click();
  await page.getByRole('menuitem', { name: 'Assets', exact: true }).click();

  for (const asset of assets) {
    const name = get(asset, 'entityResponseData.name');
    const fqn = get(asset, 'entityResponseData.fullyQualifiedName');
    const entityDisplayName = get(asset, 'entityResponseData.displayName');
    const visibleName = entityDisplayName ?? name;

    const searchRes = page.waitForResponse(
      `/api/v1/search/query?q=${visibleName}&index=all&from=0&size=25&*`
    );
    await page
      .getByTestId('asset-selection-modal')
      .getByTestId('searchbar')
      .fill(visibleName);
    await searchRes;

    await page.locator(`[data-testid="table-data-card_${fqn}"] input`).check();

    await expect(
      page.locator(
        `[data-testid="table-data-card_${fqn}"] [data-testid="entity-header-name"]`
      )
    ).toContainText(visibleName);
  }

  const assetsAddRes = page.waitForResponse(`/api/v1/domains/*/assets/add`);
  const searchRes = page.waitForResponse((response) => {
    const url = new URL(response.url());
    const queryParams = new URLSearchParams(url.search);
    const queryFilter = queryParams.get('query_filter');

    return (
      response
        .url()
        .includes('/api/v1/search/query?q=**&index=all&from=0&size=15') &&
      queryFilter !== null &&
      queryFilter !== ''
    );
  });
  await page.getByTestId('save-btn').click();
  await assetsAddRes;

  await searchRes;

  await page.reload();
  await page.waitForLoadState('networkidle');

  await checkAssetsCount(page, assets.length);
};

export const addServicesToDomain = async (
  page: Page,
  domain: Domain['data'],
  assets: EntityClass[]
) => {
  await goToAssetsTab(page, domain);

  await page.getByTestId('domain-details-add-button').click();
  await page.getByRole('menuitem', { name: 'Assets', exact: true }).click();

  for (const asset of assets) {
    const name = get(asset, 'name');
    const fqn = get(asset, 'fullyQualifiedName');

    const searchRes = page.waitForResponse(
      `/api/v1/search/query?q=${name}&index=all&from=0&size=25&*`
    );
    await page
      .getByTestId('asset-selection-modal')
      .getByTestId('searchbar')
      .fill(name);
    await searchRes;

    await page.locator(`[data-testid="table-data-card_${fqn}"] input`).check();
  }

  const assetsAddRes = page.waitForResponse(
    `/api/v1/domains/${encodeURIComponent(
      domain.fullyQualifiedName ?? ''
    )}/assets/add`
  );
  await page.getByTestId('save-btn').click();
  await assetsAddRes;
};

export const addAssetsToDataProduct = async (
  page: Page,
  dataProductFqn: string,
  assets: EntityClass[]
) => {
  await page.getByTestId('assets').click();
  await checkAssetsCount(page, 0);

  await expect(page.getByTestId('no-data-placeholder')).toContainText(
    'Adding a new Asset is easy, just give it a spin!'
  );

  await page.getByTestId('data-product-details-add-button').click();

  for (const asset of assets) {
    const name = get(asset, 'entityResponseData.name');
    const fqn = get(asset, 'entityResponseData.fullyQualifiedName');

    const searchRes = page.waitForResponse(
      `/api/v1/search/query?q=${name}&index=all&from=0&size=25&*`
    );
    await page.getByTestId('searchbar').fill(name);
    await searchRes;

    await page.locator(`[data-testid="table-data-card_${fqn}"] input`).check();
  }

  const assetsAddRes = page.waitForResponse(
    `/api/v1/dataProducts/*/assets/add`
  );
  await page.getByTestId('save-btn').click();
  await assetsAddRes;

  await checkAssetsCount(page, assets.length);

  for (const asset of assets) {
    const fqn = get(asset, 'entityResponseData.fullyQualifiedName');

    await page
      .locator(
        `[data-testid="table-data-card_${fqn}"] a[data-testid="entity-link"]`
      )
      .click();

    await page.waitForLoadState('networkidle');

    await expect(
      page
        .getByTestId('KnowledgePanel.DataProducts')
        .getByTestId('data-products-list')
        .getByTestId(`data-product-${dataProductFqn}`)
    ).toBeVisible();

    await page.goBack();
    await page.waitForLoadState('networkidle');
  }
};

export const removeAssetsFromDataProduct = async (
  page: Page,
  dataProduct: DataProduct['data'],
  assets: EntityClass[]
) => {
  await page.getByTestId('assets').click();
  for (const asset of assets) {
    const fqn = get(asset, 'entityResponseData.fullyQualifiedName');
    await page.locator(`[data-testid="table-data-card_${fqn}"] input`).check();
  }

  const assetsRemoveRes = page.waitForResponse(
    `/api/v1/dataProducts/${encodeURIComponent(
      dataProduct.fullyQualifiedName ?? ''
    )}/assets/remove`
  );

  await page.getByTestId('delete-all-button').click();
  await assetsRemoveRes;
};

export const setupAssetsForDomain = async (page: Page) => {
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const topic = new TopicClass();
  const dashboard = new DashboardClass();
  await Promise.all([
    table.create(apiContext),
    topic.create(apiContext),
    dashboard.create(apiContext),
  ]);

  const assetCleanup = async () => {
    await Promise.all([
      table.delete(apiContext),
      topic.delete(apiContext),
      dashboard.delete(apiContext),
    ]);
    await afterAction();
  };

  return {
    assets: [table, topic, dashboard],
    assetCleanup,
  };
};

export const createDataProduct = async (
  page: Page,
  dataProduct: DataProduct['data']
) => {
  // Safety check to close potential domain not found alert
  // Arrived due to parallel testing
  await closeFirstPopupAlert(page);

  await page.getByTestId('domain-details-add-button').click();
  await page.getByRole('menuitem', { name: 'Data Products' }).click();

  await expect(page.getByText('Add Data Product')).toBeVisible();

  await fillCommonFormItems(page, dataProduct);
  const saveRes = page.waitForResponse('/api/v1/dataProducts');
  await page.getByTestId('save-data-product').click();
  await saveRes;
};

export const verifyDataProductAssetsAfterDelete = async (
  page: Page,
  {
    domain,
    dataProduct1,
    dataProduct2,
    assets,
    subDomain,
  }: {
    domain: Domain;
    dataProduct1: DataProduct;
    dataProduct2: DataProduct;
    assets: EntityClass[];
    subDomain?: SubDomain;
  }
) => {
  const { apiContext } = await getApiContext(page);
  const newDataProduct1 = new DataProduct([domain], 'PW_DataProduct_Sales');

  await test.step('Add assets to DataProduct Sales', async () => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.DOMAIN);
    if (subDomain) {
      await selectSubDomain(page, domain.data, subDomain.data);
      await selectDataProductFromTab(page, dataProduct1.data);
    } else {
      await selectDataProduct(page, domain.data, dataProduct1.data);
    }
    await addAssetsToDataProduct(
      page,
      dataProduct1.responseData.fullyQualifiedName ?? '',
      assets.slice(0, 2)
    );
  });

  await test.step('Add assets to DataProduct Finance', async () => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.DOMAIN);
    if (subDomain) {
      await selectSubDomain(page, domain.data, subDomain.data);
      await selectDataProductFromTab(page, dataProduct2.data);
    } else {
      await selectDataProduct(page, domain.data, dataProduct2.data);
    }
    await addAssetsToDataProduct(
      page,
      dataProduct2.responseData.fullyQualifiedName ?? '',
      [assets[2]]
    );
  });

  await test.step(
    'Remove Data Product Sales and Create the same again',
    async () => {
      // Remove sales data product
      await dataProduct1.delete(apiContext);

      // Create sales data product again
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.DOMAIN);
      if (subDomain) {
        await selectSubDomain(page, domain.data, subDomain.data);
      } else {
        await selectDomain(page, domain.data);
      }

      await createDataProduct(page, newDataProduct1.data);
    }
  );

  await test.step(
    'Verify assets are not present in the newly created data product',
    async () => {
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.DOMAIN);
      if (subDomain) {
        await selectSubDomain(page, domain.data, subDomain.data);
        await selectDataProductFromTab(page, newDataProduct1.data);
      } else {
        await selectDataProduct(page, domain.data, newDataProduct1.data);
      }
      await checkAssetsCount(page, 0);
    }
  );
};

export const addTagsAndGlossaryToDomain = async (
  page: Page,
  {
    tagFqn,
    glossaryTermFqn,
    isDomain = true,
  }: {
    tagFqn: string;
    glossaryTermFqn: string;
    isDomain?: boolean;
  }
) => {
  const addTagOrTerm = async (
    containerType: 'tags' | 'glossary',
    value: string
  ) => {
    const container = `[data-testid="${containerType}-container"]`;

    // Click add button
    await page.locator(`${container} [data-testid="add-tag"]`).click();

    // Fill and select tag/term
    const input = page.locator(`${container} #tagsForm_tags`);
    await input.click();
    await input.fill(value);
    const tag = page.getByTestId(`tag-${value}`);
    if (containerType === 'glossary') {
      // To avoid clicking on white space between checkbox and text
      await tag.locator('.ant-select-tree-checkbox').click();
    } else {
      await tag.click();
    }

    // Save and wait for response
    const updateResponse = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes(`/api/v1/${isDomain ? 'domains' : 'dataProducts'}/`) &&
        response.request().method() === 'PATCH'
    );
    await page.getByTestId('saveAssociatedTag').click();
    await updateResponse;
  };

  // Add tag
  await addTagOrTerm('tags', tagFqn);

  // Add glossary term
  await addTagOrTerm('glossary', glossaryTermFqn);
};

/**
 * Verifies if the active domain is set to All Domains (DEFAULT_DOMAIN_VALUE)
 */
export const verifyActiveDomainIsDefault = async (page: Page) => {
  await expect(page.getByTestId('domain-dropdown')).toContainText(
    'All Domains'
  );
};

/**
 * Sets up a complete environment for domain ownership testing
 * Creates user, policy, role, domain, data product and assigns ownership
 * Returns all created objects and a cleanup function
 */
export const setupDomainOwnershipTest = async (apiContext: any) => {
  // Create all necessary resources
  const dataConsumerUser = new UserClass();
  const id = uuid();
  const domainForTest = new Domain({
    name: `PW_Domain_Owner_Rule_Testing-${id}`,
    displayName: `PW_Domain_Owner_Rule_Testing-${id}`,
    description: 'playwright domain description',
    domainType: 'Aggregate',
    fullyQualifiedName: `PW_Domain_Owner_Rule_Testing-${id}`,
  });
  const dataProductForTest = new DataProduct(
    [domainForTest],
    `PW_DataProduct_Owner_Rule-${id}`
  );

  await dataConsumerUser.create(apiContext);
  await domainForTest.create(apiContext);

  // Setup permissions
  const dataConsumerPolicy = new PolicyClass();
  const dataConsumerRole = new RolesClass();

  // Create domain access policy
  const domainRule = [
    {
      name: 'DomainRule',
      description: '',
      resources: ['dataProduct', 'domain'],
      operations: ['All'],
      effect: 'allow',
      condition: 'isOwner()',
    },
  ];

  await dataConsumerPolicy.create(apiContext, domainRule);
  await dataConsumerRole.create(apiContext, [
    dataConsumerPolicy.responseData.name,
  ]);

  await dataProductForTest.create(apiContext);

  // Create team for the user
  const dataConsumerTeam = new TeamClass({
    name: `PW_data_consumer_team-${id}`,
    displayName: `PW Data Consumer Team ${id}`,
    description: 'playwright data consumer team description',
    teamType: 'Group',
    users: [dataConsumerUser.responseData.id ?? ''],
    defaultRoles: [dataConsumerRole.responseData.id ?? ''],
  });

  await dataConsumerTeam.create(apiContext);

  // Set domain ownership
  await domainForTest.patch({
    apiContext,
    patchData: [
      {
        op: 'add',
        path: '/owners/0',
        value: {
          id: dataConsumerUser.responseData.id,
          type: 'user',
        },
      },
    ],
  });

  // Return cleanup function and all created resources
  const cleanup = async (apiContext1: APIRequestContext) => {
    await dataProductForTest.delete(apiContext1);
    await domainForTest.delete(apiContext1);
    await dataConsumerUser.delete(apiContext1);
    await dataConsumerTeam.delete(apiContext1);
    await dataConsumerPolicy.delete(apiContext1);
    await dataConsumerRole.delete(apiContext1);
  };

  return {
    dataConsumerUser,
    domainForTest,
    dataProductForTest,
    dataConsumerTeam,
    dataConsumerPolicy,
    dataConsumerRole,
    cleanup,
  };
};
