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
  toastNotification,
  uuid,
} from './common';
import { addOwner, waitForAllLoadersToDisappear } from './entity';
import { sidebarClick } from './sidebar';

const waitForSearchDebounce = async (page: Page) => {
  // Wait for loader to appear and disappear after search
  // This ensures search debounce completed and results are stable
  try {
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'attached',
      timeout: 999,
    });
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });
  } catch (e) {
    // Loader never appeared - search was instant, which is fine
    // Just continue without waiting
  }
};

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
  const searchBox = page
    .getByTestId('page-layout-v1')
    .getByPlaceholder('Search');

  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

  await Promise.all([
    searchBox.fill(domain.name),
    page.waitForResponse('/api/v1/search/query?q=*&index=domain_search_index*'),
  ]);

  await waitForSearchDebounce(page);

  await Promise.all([
    page.getByTestId(domain.name).click(),
    page.waitForResponse('/api/v1/domains/name/*'),
  ]);

  await page.waitForLoadState('networkidle');

  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });
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
  const dpRes = page.waitForResponse((response) => {
    const url = response.url();

    return (
      url.includes('/api/v1/search/query') &&
      url.includes('index=data_product_search_index')
    );
  });
  await page
    .locator('.domain-details-page-tabs')
    .getByText('Data Products')
    .click();

  await dpRes;

  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  await Promise.all([
    page
      .getByTestId(`explore-card-${dataProduct.name}`)
      .getByTestId('entity-link')
      .click(),
    page.waitForResponse('/api/v1/dataProducts/name/*'),
  ]);
};

export const selectDataProduct = async (
  page: Page,
  dataProduct: DataProduct['data']
) => {
  const searchBox = page
    .getByTestId('page-layout-v1')
    .getByPlaceholder('Search');

  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

  await Promise.all([
    searchBox.fill(dataProduct.name),
    page.waitForResponse(
      '/api/v1/search/query?q=*&index=data_product_search_index*'
    ),
  ]);

  await waitForSearchDebounce(page);

  await Promise.all([
    page.getByTestId(dataProduct.name).click(),
    page.waitForResponse('/api/v1/dataProducts/name/*'),
  ]);

  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });
};

export const goToAssetsTab = async (
  page: Page,
  domain: Domain['data'],
  skipDomainSelection = false
) => {
  if (!skipDomainSelection) {
    await selectDomain(page, domain);
  }

  await checkDomainDisplayName(page, domain.displayName);

  await Promise.all([
    page.getByTestId('assets').click(),
    page.waitForResponse('/api/v1/search/query?q=&index=all*'),
  ]);

  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
};

export const verifyAssetsInDomain = async (
  page: Page,
  domain: Domain['data'],
  tables: TableClass[],
  expectedVisible: boolean
) => {
  await goToAssetsTab(page, domain);

  for (const table of tables) {
    const tableFqn = table.entityResponseData.fullyQualifiedName;
    const tableCard = page.locator(
      `[data-testid="table-data-card_${tableFqn}"]`
    );
    if (expectedVisible) {
      await expect(tableCard).toBeVisible({ timeout: 10000 });
    } else {
      await expect(tableCard).not.toBeVisible({ timeout: 5000 });
    }
  }
};

const fillCommonFormItems = async (
  page: Page,
  entity: Domain['data'] | DataProduct['data'] | SubDomain['data']
) => {
  await page.locator('#root\\/name').fill(entity.name);
  await page.locator('#root\\/displayName').fill(entity.displayName);
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

  const domainTypeCombo = page.getByRole('combobox', { name: 'Domain Type' });
  await domainTypeCombo.click();

  await page.getByRole('option', { name: entity.domainType }).click();
};

export const checkDomainDisplayName = async (
  page: Page,
  displayName: string
) => {
  await expect(page.getByTestId('entity-header-display-name')).toHaveText(
    displayName
  );
};

export const checkAssetsCount = async (page: Page, count: number) => {
  await expect(page.getByTestId('assets').getByTestId('count')).toContainText(
    count.toString()
  );
};

export const verifyDomainOnAssetPages = async (
  page: Page,
  assets: EntityClass[],
  domainDisplayName: string,
  renamedDomainName?: string
) => {
  for (const asset of assets) {
    await asset.visitEntityPage(page);
    await expect(page.getByTestId('domain-link')).toContainText(
      domainDisplayName
    );
  }

  if (renamedDomainName) {
    const domainRes = page.waitForResponse('/api/v1/domains/name/*');
    await page.getByTestId('domain-link').click();
    await domainRes;
    await waitForAllLoadersToDisappear(page);
    await expect(page.getByTestId('entity-header-name')).toContainText(
      renamedDomainName
    );
  }
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

  await expect(page.getByText(domain.description)).toBeVisible();

  expect(
    await page.locator(`[id="KnowledgePanel\\.Description"]`).textContent()
  ).toContain(domain.description);

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

  await page.waitForSelector('h6:has-text("Add Domain")', { timeout: 5000 });

  await expect(page.locator('h6:has-text("Add Domain")')).toBeVisible();

  const saveButton = page.getByRole('button', { name: 'Save' });

  if (validate) {
    await saveButton.click();
    await validateDomainForm(page);
  }

  await fillDomainForm(page, domain);

  const domainRes = page.waitForResponse('/api/v1/domains');
  await saveButton.click();
  await domainRes;

  await toastNotification(page, /Domain created successfully/);

  await selectDomain(page, domain);

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
  await page.getByTestId('save-btn').click();
  await saveRes;
};

export const addAssetsToDomain = async (
  page: Page,
  domain: Domain,
  assets: EntityClass[],
  navigateToAssetsTab = true,
  skipDomainSelection = false
) => {
  if (navigateToAssetsTab) {
    await goToAssetsTab(page, domain.data, skipDomainSelection);
  }
  await checkAssetsCount(page, 0);

  await expect(page.getByTestId('no-data-placeholder')).toContainText(
    "Looks like you haven't added any data assets yet."
  );

  await page.getByTestId('domain-details-add-button').click();
  const assetRes = page.waitForResponse('/api/v1/search/query?q=&index=all&*');
  await page.getByRole('menuitem', { name: 'Assets', exact: true }).click();
  await assetRes;

  for (const asset of assets) {
    const name = get(asset, 'entityResponseData.name');
    const fqn = get(asset, 'entityResponseData.fullyQualifiedName');
    const entityDisplayName = get(asset, 'entityResponseData.displayName');
    const visibleName = entityDisplayName ?? name;

    const searchRes = page.waitForResponse(
      `/api/v1/search/query?q=${encodeURIComponent(
        visibleName
      )}&index=all&from=0&size=25&*`
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
        .includes('/api/v1/search/query?q=&index=all&from=0&size=15') &&
      queryFilter !== null &&
      queryFilter !== ''
    );
  });
  await page.getByTestId('save-btn').click();
  await assetsAddRes;

  await searchRes;

  await page.reload();
  await waitForAllLoadersToDisappear(page);
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

  const assetRes = page.waitForResponse('/api/v1/search/query?q=&index=all&*');
  await page.getByRole('menuitem', { name: 'Assets', exact: true }).click();
  await assetRes;

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
    "Looks like you haven't added any data assets yet."
  );

  const assetRes = page.waitForResponse('/api/v1/search/query?q=&index=all&*');
  await page.getByTestId('data-product-details-add-button').click();
  await assetRes;

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

  await expect(page.getByTestId('form-heading')).toContainText(
    'Add Data Product'
  );

  await fillCommonFormItems(page, dataProduct);
  const saveRes = page.waitForResponse('/api/v1/dataProducts');
  await page.getByTestId('save-btn').click();
  await saveRes;
};

export const createDataProductFromListPage = async (
  page: Page,
  dataProduct: DataProduct['data'],
  domain: Domain['data']
) => {
  await page.getByTestId('add-entity-button').click();

  await expect(page.getByTestId('form-heading')).toContainText(
    'Add Data Product'
  );

  await fillCommonFormItems(page, dataProduct);

  // Fill domain field (required when creating from list page)
  const domainInput = page.getByTestId('domain-select');
  await domainInput.scrollIntoViewIfNeeded();
  await domainInput.waitFor({ state: 'visible' });
  await domainInput.click();

  const searchDomain = page.waitForResponse(
    `/api/v1/search/query?q=*index=domain_search_index*`
  );
  await domainInput.fill(domain.displayName);
  await searchDomain;

  const domainOption = page.getByText(domain.displayName);
  await domainOption.waitFor({ state: 'visible', timeout: 5000 });
  await domainOption.click();

  const saveRes = page.waitForResponse('/api/v1/dataProducts');
  await page.getByTestId('save-btn').click();
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

    if (subDomain) {
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectSubDomain(page, domain.data, subDomain.data);
      await selectDataProductFromTab(page, dataProduct1.data);
    } else {
      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, dataProduct1.data);
    }
    await addAssetsToDataProduct(
      page,
      dataProduct1.responseData.fullyQualifiedName ?? '',
      assets.slice(0, 2)
    );
  });

  await test.step('Add assets to DataProduct Finance', async () => {
    await redirectToHomePage(page);

    if (subDomain) {
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectSubDomain(page, domain.data, subDomain.data);
      await selectDataProductFromTab(page, dataProduct2.data);
    } else {
      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, dataProduct2.data);
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

      if (subDomain) {
        await sidebarClick(page, SidebarItem.DOMAIN);
        await selectSubDomain(page, domain.data, subDomain.data);
        await selectDataProductFromTab(page, newDataProduct1.data);
      } else {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, newDataProduct1.data);
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

/**
 * Sets up a complete environment for testing hasDomain() rule condition
 * Creates user, domain, subdomain, assets, policy with hasDomain(), role, and team
 * Returns all created objects and a cleanup function
 */
export const setupDomainHasDomainTest = async (
  apiContext: APIRequestContext
) => {
  const id = uuid();

  // Create test user
  const testUser = new UserClass();
  await testUser.create(apiContext);
  const mainDomain = new Domain();
  await mainDomain.create(apiContext);
  const subDomain = new SubDomain(mainDomain);
  await subDomain.create(apiContext);

  // Create assets for domain and subdomain
  const domainTable = new TableClass();
  const subDomainTable = new TableClass();
  await domainTable.create(apiContext);
  await subDomainTable.create(apiContext);

  // Create policy with hasDomain() rule
  const domainPolicy = new PolicyClass();
  const domainRule = [
    {
      name: 'HasDomainRule',
      description: '',
      resources: ['All'],
      operations: ['All'],
      effect: 'allow',
      condition: 'hasDomain()',
    },
  ];
  await domainPolicy.create(apiContext, domainRule);

  // Create role with the policy
  const domainRole = new RolesClass();
  await domainRole.create(apiContext, [domainPolicy.responseData.name]);

  // Create team with the user and assign the role
  const domainTeam = new TeamClass({
    name: `PW_Team_HasDomain_${id}`,
    displayName: `PW Team HasDomain ${id}`,
    description: 'Team for hasDomain() rule testing',
    teamType: 'Group',
    users: [testUser.responseData.id ?? ''],
    defaultRoles: [domainRole.responseData.id ?? ''],
  });
  await domainTeam.create(apiContext);

  // Add user to domain
  await testUser.patch({
    apiContext,
    patchData: [
      {
        op: 'add',
        path: '/domains/0',
        value: {
          id: mainDomain.responseData.id,
          type: 'domain',
        },
      },
    ],
  });

  // Assign assets to domain and subdomain
  await domainTable.patch({
    apiContext,
    patchData: [
      {
        op: 'add',
        path: '/domains/0',
        value: {
          id: mainDomain.responseData.id,
          type: 'domain',
        },
      },
    ],
  });

  await subDomainTable.patch({
    apiContext,
    patchData: [
      {
        op: 'add',
        path: '/domains/0',
        value: {
          id: subDomain.responseData.id,
          type: 'domain',
        },
      },
    ],
  });

  // Cleanup function
  const cleanup = async (cleanupContext: APIRequestContext) => {
    await domainTable.delete(cleanupContext);
    await subDomainTable.delete(cleanupContext);
    await subDomain.delete(cleanupContext);
    await mainDomain.delete(cleanupContext);
    await domainTeam.delete(cleanupContext);
    await domainRole.delete(cleanupContext);
    await domainPolicy.delete(cleanupContext);
    await testUser.delete(cleanupContext);
  };

  return {
    testUser,
    mainDomain,
    subDomain,
    domainTable,
    subDomainTable,
    domainPolicy,
    domainRole,
    domainTeam,
    cleanup,
  };
};

export const setupNoDomainRule = async (apiContext: APIRequestContext) => {
  const id = uuid();

  // Create test user
  const testUser = new UserClass();
  await testUser.create(apiContext);
  const mainDomain = new Domain();
  await mainDomain.create(apiContext);

  // Create assets for domain
  const domainTable = new TableClass();
  const noDomainTable = new TableClass();
  await domainTable.create(apiContext);
  await noDomainTable.create(apiContext);

  // Create policy with hasDomain() rule
  const domainPolicy = new PolicyClass();
  const domainRule = [
    {
      name: 'NoDomainRule',
      description: '',
      resources: ['All'],
      operations: ['ViewAll'],
      effect: 'deny',
      condition: 'noDomain()',
    },
  ];
  await domainPolicy.create(apiContext, domainRule);

  // Create role with the policy
  const domainRole = new RolesClass();
  await domainRole.create(apiContext, [domainPolicy.responseData.name]);

  // Create team with the user and assign the role
  const domainTeam = new TeamClass({
    name: `PW_Team_NoDomain_${id}`,
    displayName: `PW Team NoDomain ${id}`,
    description: 'Team for noDomain() rule testing',
    teamType: 'Group',
    users: [testUser.responseData.id ?? ''],
    defaultRoles: [domainRole.responseData.id ?? ''],
  });
  await domainTeam.create(apiContext);

  // Add user to domain
  await testUser.patch({
    apiContext,
    patchData: [
      {
        op: 'add',
        path: '/domains/0',
        value: {
          id: mainDomain.responseData.id,
          type: 'domain',
        },
      },
    ],
  });

  // Assign assets to domain and subdomain
  await domainTable.patch({
    apiContext,
    patchData: [
      {
        op: 'add',
        path: '/domains/0',
        value: {
          id: mainDomain.responseData.id,
          type: 'domain',
        },
      },
    ],
  });

  // Cleanup function
  const cleanup = async (cleanupContext: APIRequestContext) => {
    await domainTable.delete(cleanupContext);
    await noDomainTable.delete(cleanupContext);
    await mainDomain.delete(cleanupContext);
    await domainTeam.delete(cleanupContext);
    await domainRole.delete(cleanupContext);
    await domainPolicy.delete(cleanupContext);
    await testUser.delete(cleanupContext);
  };

  return {
    testUser,
    mainDomain,
    domainTable,
    noDomainTable,
    domainPolicy,
    domainRole,
    domainTeam,
    cleanup,
  };
};

/**
 * Creates a data product under a subdomain via direct API call.
 * Use this when you need to create a data product that belongs to a subdomain
 * rather than a parent domain.
 */
export const createDataProductForSubDomain = async (
  apiContext: APIRequestContext,
  subDomain: SubDomain
) => {
  const id = uuid();
  const response = await apiContext.post('/api/v1/dataProducts', {
    data: {
      name: `PW%dataProduct.${id}`,
      displayName: `PW SubDomain Data Product ${id}`,
      description: 'playwright subdomain data product description',
      domains: [subDomain.responseData.fullyQualifiedName],
    },
  });

  if (!response.ok()) {
    throw new Error(
      `Failed to create data product for subdomain: ${response.status()} ${await response.text()}`
    );
  }

  const responseData = await response.json();

  return {
    ...responseData,
    async delete(deleteContext: APIRequestContext) {
      await deleteContext.delete(
        `/api/v1/dataProducts/name/${encodeURIComponent(
          responseData.fullyQualifiedName
        )}`
      );
    },
  };
};

/**
 * Verifies the data products count displayed in the Data Products tab.
 * Clicks on the Data Products tab and checks if the count matches the expected value.
 */
export const verifyDataProductsCount = async (
  page: Page,
  expectedCount: number
) => {
  await page.getByTestId('data_products').click();
  await waitForAllLoadersToDisappear(page);
  await page.waitForLoadState('networkidle');

  const dataProductCountElement = page
    .getByTestId('data_products')
    .getByTestId('count');
  const countText = await dataProductCountElement.textContent();
  const displayedCount = parseInt(countText ?? '0', 10);

  expect(displayedCount).toBe(expectedCount);
};

/**
 * Navigates to a subdomain from the current domain/subdomain page.
 * Clicks on the Sub Domains tab and then clicks on the specified subdomain.
 */
export const navigateToSubDomain = async (
  page: Page,
  subDomainData: { name: string }
) => {
  await page.getByTestId('subdomains').getByText('Sub Domains').click();
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

  await Promise.all([
    page.getByTestId(subDomainData.name).click(),
    page.waitForResponse('/api/v1/domains/name/*'),
  ]);
};

/**
 * Navigates to the Input/Output Ports tab on a data product page.
 */
export const navigateToPortsTab = async (page: Page) => {
  await page.waitForTimeout(2000);

  const portsViewResponse = page.waitForResponse(
    (response) => response.url().includes('/portsView')
  );
  await page.getByTestId('input_output_ports').click();
  await portsViewResponse;
  await waitForAllLoadersToDisappear(page);
};

/**
 * Expands the lineage section in the InputOutputPortsTab.
 * Only expands if currently collapsed.
 */
export const expandLineageSection = async (page: Page) => {
  const portsViewRes = page.waitForResponse((response) =>
    response.url().includes('/portsView')
  );
  await page.getByTestId('toggle-lineage-collapse').click();
  await portsViewRes;
  await waitForAllLoadersToDisappear(page);
};

/**
 * Verifies the port counts displayed in the InputOutputPortsTab.
 */
export const verifyPortCounts = async (
  page: Page,
  expectedInputCount: number,
  expectedOutputCount: number
) => {
  const inputPortsSection = page
    .locator('[data-testid="input-output-ports-tab"]')
    .locator('text=Input Ports')
    .first();
  const outputPortsSection = page
    .locator('[data-testid="input-output-ports-tab"]')
    .locator('text=Output Ports')
    .first();

  await expect(
    inputPortsSection
      .locator('..')
      .locator('span')
      .filter({ hasText: `(${expectedInputCount})` })
  ).toBeVisible();
  await expect(
    outputPortsSection
      .locator('..')
      .locator('span')
      .filter({ hasText: `(${expectedOutputCount})` })
  ).toBeVisible();
};

/**
 * Adds an input port to a data product via UI.
 */
export const addInputPortToDataProduct = async (
  page: Page,
  asset: EntityClass
) => {
  const name = get(asset, 'entityResponseData.name');
  const fqn = get(asset, 'entityResponseData.fullyQualifiedName');
  const displayName = get(asset, 'entityResponseData.displayName') ?? name;

  await expect(page.getByTestId('add-input-port-button')).toBeEnabled({
    timeout: 10000
  });

  await page.getByTestId('add-input-port-button').click();

  await page.waitForSelector('[data-testid="asset-selection-modal"]', {
    state: 'visible',
  });

  const searchBar = page
    .getByTestId('asset-selection-modal')
    .getByTestId('searchbar');

  const searchRes = page.waitForResponse(
    (res) =>
      res.url().includes('/api/v1/search/query') &&
      res.request().method() === 'GET'
  );
  await searchBar.fill(displayName);
  await searchRes;

  await page.locator(`[data-testid="table-data-card_${fqn}"] input`).check();

  const addRes = page.waitForResponse(
    (res) =>
      res.url().includes('/inputPorts/add') && res.request().method() === 'PUT'
  );
  await page.getByTestId('save-btn').click();
  await addRes;
};

/**
 * Adds an output port to a data product via UI.
 */
export const addOutputPortToDataProduct = async (
  page: Page,
  asset: EntityClass
) => {
  const name = get(asset, 'entityResponseData.name');
  const fqn = get(asset, 'entityResponseData.fullyQualifiedName');
  const displayName = get(asset, 'entityResponseData.displayName') ?? name;

  await expect(page.getByTestId('add-output-port-button')).toBeEnabled({
    timeout: 10000
  });

  await page.getByTestId('add-output-port-button').click();

  await page.waitForSelector('[data-testid="asset-selection-modal"]', {
    state: 'visible',
  });

  const searchBar = page
    .getByTestId('asset-selection-modal')
    .getByTestId('searchbar');

  const searchRes = page.waitForResponse(
    (res) =>
      res.url().includes('/api/v1/search/query') &&
      res.request().method() === 'GET'
  );
  await searchBar.fill(displayName);
  await searchRes;

  await page.locator(`[data-testid="table-data-card_${fqn}"] input`).check();

  const addRes = page.waitForResponse(
    (res) =>
      res.url().includes('/outputPorts/add') && res.request().method() === 'PUT'
  );
  await page.getByTestId('save-btn').click();
  await addRes;
};

/**
 * Removes a port from a data product via UI.
 */
export const removePortFromDataProduct = async (
  page: Page,
  portId: string,
  portType: 'input' | 'output'
) => {
  await page.getByTestId(`port-actions-${portId}`).click();
  await page.getByRole('menuitem', { name: 'Remove' }).click();

  const removeRes = page.waitForResponse(
    (res) =>
      res.url().includes(`/${portType}Ports/remove`) &&
      res.request().method() === 'PUT'
  );
  await page.getByRole('button', { name: 'Remove' }).click();
  await removeRes;
};

/**
 * Renames a domain or subdomain via the UI.
 * Opens the manage menu, clicks rename, fills the new name and saves.
 */
export const renameDomain = async (page: Page, newName: string) => {
  await page.getByTestId('manage-button').click();
  await page.getByTestId('rename-button-title').click();

  await expect(page.getByRole('dialog')).toBeVisible();

  await page.locator('#name').clear();
  await page.locator('#name').fill(newName);

  const patchRes = page.waitForResponse('/api/v1/domains/*');
  await page.getByTestId('save-button').click();
  await patchRes;

  const domainRes = page.waitForResponse('/api/v1/domains/name/*');
  await page.reload();
  await domainRes;
};

/**
 * Selects a domain from the navbar dropdown.
 * Clicks the domain dropdown, searches for the domain, and selects it.
 */
export const selectDomainFromNavbar = async (
  page: Page,
  domain: Domain['responseData']
) => {
  await page.getByTestId('domain-dropdown').click();
  await page.waitForSelector('[data-testid="domain-selectable-tree"]', {
    state: 'visible',
  });

  const searchDomainRes = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('domain_search_index')
  );
  await page
    .getByTestId('domain-selectable-tree')
    .getByTestId('searchbar')
    .fill(domain.displayName);
  await searchDomainRes;

  const tagSelector = page.getByTestId(`tag-${domain.fullyQualifiedName}`);
  await tagSelector.waitFor({ state: 'visible' });
  await tagSelector.click();
  await waitForAllLoadersToDisappear(page);
  await page.waitForLoadState('networkidle');
};

/**
 * Searches for an entity in the explore page and verifies it is visible.
 */
export const searchAndExpectEntityVisible = async (
  page: Page,
  entity: {
    entityResponseData: {
      name: string;
      displayName?: string;
      fullyQualifiedName?: string;
    };
  },
  timeout?: number
) => {
  const name = get(
    entity,
    'entityResponseData.displayName',
    entity.entityResponseData.name
  );
  await page.getByTestId('searchBox').fill(name);
  await page.getByTestId('searchBox').press('Enter');
  await page.waitForLoadState('networkidle');
  await waitForAllLoadersToDisappear(page);

  await expect(
    page.locator(
      `[data-testid="table-data-card_${entity.entityResponseData.fullyQualifiedName}"]`
    )
  ).toBeVisible(timeout ? { timeout } : undefined);
};

/**
 * Searches for an entity in the explore page and verifies it is NOT visible.
 */
export const searchAndExpectEntityNotVisible = async (
  page: Page,
  entity: {
    entityResponseData: {
      name: string;
      displayName?: string;
      fullyQualifiedName?: string;
    };
  }
) => {
  const name = get(
    entity,
    'entityResponseData.displayName',
    entity.entityResponseData.name
  );
  await page.getByTestId('searchBox').fill(name);
  await page.getByTestId('searchBox').press('Enter');
  await page.waitForLoadState('networkidle');
  await waitForAllLoadersToDisappear(page);

  await expect(
    page.locator(
      `[data-testid="table-data-card_${entity.entityResponseData.fullyQualifiedName}"]`
    )
  ).not.toBeVisible();
};

/**
 * Assigns a domain to an entity via API patch.
 */
export const assignDomainToEntity = async (
  apiContext: APIRequestContext,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entity: {
    patch: (options: {
      apiContext: APIRequestContext;
      patchData: any[];
    }) => Promise<any>;
  },
  domain: { responseData: { id?: string } }
) => {
  await entity.patch({
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
};
