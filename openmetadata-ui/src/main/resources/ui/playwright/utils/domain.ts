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
import { expect, Page } from '@playwright/test';
import { get, isEmpty, isUndefined } from 'lodash';
import { DataProduct } from '../support/domain/DataProduct';
import { Domain } from '../support/domain/Domain';
import { SubDomain } from '../support/domain/SubDomain';
import { DashboardClass } from '../support/entity/DashboardClass';
import { EntityTypeEndpoint } from '../support/entity/Entity.interface';
import { EntityClass } from '../support/entity/EntityClass';
import { TableClass } from '../support/entity/TableClass';
import { TopicClass } from '../support/entity/TopicClass';
import {
  descriptionBox,
  getApiContext,
  INVALID_NAMES,
  NAME_MAX_LENGTH_VALIDATION_ERROR,
  NAME_VALIDATION_ERROR,
} from './common';
import { addOwner } from './entity';

export const assignDomain = async (page: Page, domain: Domain['data']) => {
  await page.getByTestId('add-domain').click();
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
  await page
    .getByTestId('selectable-list')
    .getByTestId('searchbar')
    .fill(domain.name);
  await page.waitForResponse(
    `/api/v1/search/query?q=*${encodeURIComponent(domain.name)}*`
  );
  await page.getByRole('listitem', { name: domain.displayName }).click();

  await expect(page.getByTestId('domain-link')).toContainText(
    domain.displayName
  );
};

export const updateDomain = async (page: Page, domain: Domain['data']) => {
  await page.getByTestId('add-domain').click();
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
  await page.getByTestId('selectable-list').getByTestId('searchbar').clear();
  await page
    .getByTestId('selectable-list')
    .getByTestId('searchbar')
    .fill(domain.name);
  await page.waitForResponse(
    `/api/v1/search/query?q=*${encodeURIComponent(domain.name)}*`
  );
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

export const validateDomainForm = async (page) => {
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
};

export const selectSubDomain = async (
  page: Page,
  domain: Domain['data'],
  subDomain: SubDomain['data']
) => {
  await page
    .getByRole('menuitem', { name: domain.displayName })
    .locator('span')
    .click();

  await page.getByTestId('subdomains').getByText('Sub Domains').click();
  await page.getByTestId(subDomain.name).click();
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

  await page.getByText('Data Products').click();
  await page
    .getByTestId(`explore-card-${dataProduct.name}`)
    .getByTestId('entity-link')
    .click();
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
  await page.fill(descriptionBox, entity.description);
  if (!isEmpty(entity.owners) && !isUndefined(entity.owners)) {
    await addOwner(
      page,
      entity.owners[0].name,
      entity.owners[0].type as 'Users' | 'Teams',
      EntityTypeEndpoint.Domain,
      'owner-container',
      'add-owner'
    );
  }
};

const fillDomainForm = async (
  page: Page,
  entity: Domain['data'] | SubDomain['data'],
  isDomain
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

  await fillDomainForm(page, subDomain);
  const saveRes = page.waitForResponse('/api/v1/domains');
  await page.getByTestId('save-sub-domain').click();
  await saveRes;
};

export const addAssetsToDomain = async (
  page: Page,
  domain: Domain['data'],
  assets: EntityClass[]
) => {
  await goToAssetsTab(page, domain);
  await checkAssetsCount(page, 0);

  await expect(page.getByTestId('no-data-placeholder')).toContainText(
    'Adding a new Asset is easy, just give it a spin!'
  );

  await page.getByTestId('domain-details-add-button').click();
  await page.getByRole('menuitem', { name: 'Assets' }).click();

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
    `/api/v1/domains/${encodeURIComponent(
      domain.fullyQualifiedName ?? ''
    )}/assets/add`
  );
  await page.getByTestId('save-btn').click();
  await assetsAddRes;

  await checkAssetsCount(page, assets.length);
};

export const addAssetsToDataProduct = async (
  page: Page,
  dataProduct: DataProduct['data'],
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
    `/api/v1/dataProducts/${encodeURIComponent(
      dataProduct.fullyQualifiedName ?? ''
    )}/assets/add`
  );
  await page.getByTestId('save-btn').click();
  await assetsAddRes;

  await checkAssetsCount(page, assets.length);
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
  await table.create(apiContext);
  await topic.create(apiContext);
  await dashboard.create(apiContext);

  const assetCleanup = async () => {
    await table.create(apiContext);
    await topic.create(apiContext);
    await dashboard.create(apiContext);
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
  await page.getByTestId('domain-details-add-button').click();
  await page.getByRole('menuitem', { name: 'Data Products' }).click();

  await expect(page.getByText('Add Data Product')).toBeVisible();

  await fillCommonFormItems(page, dataProduct);
  const saveRes = page.waitForResponse('/api/v1/dataProducts');
  await page.getByTestId('save-data-product').click();
  await saveRes;
};
