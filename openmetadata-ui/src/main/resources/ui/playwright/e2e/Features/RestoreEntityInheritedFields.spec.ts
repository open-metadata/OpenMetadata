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
import { expect, type Page } from '@playwright/test';
import { ServiceTypes } from '../../constant/settings';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { ApiEndpointClass } from '../../support/entity/ApiEndpointClass';
import { ChartClass } from '../../support/entity/ChartClass';
import { ContainerClass } from '../../support/entity/ContainerClass';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../../support/entity/DashboardDataModelClass';
import { MlModelClass } from '../../support/entity/MlModelClass';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { SearchIndexClass } from '../../support/entity/SearchIndexClass';
import { StoredProcedureClass } from '../../support/entity/StoredProcedureClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { performAdminLogin } from '../../utils/admin';
import {
  assignDataProduct,
  assignSingleSelectDomain,
  getApiContext,
  redirectToHomePage,
} from '../../utils/common';
import {
  softDeleteEntity,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';
import { test } from '../fixtures/pages';

// Service management pages render KnowledgePanel.DataProducts only inside the
// entity-count tab (ServiceMainTabContent). This maps each ServiceTypes value
// to the matching tab label so we can click it before assigning data products.
const SERVICE_ENTITY_TAB: Partial<Record<ServiceTypes, string>> = {
  [ServiceTypes.API_SERVICES]: 'Collections',
  [ServiceTypes.DASHBOARD_SERVICES]: 'Dashboards',
  [ServiceTypes.MESSAGING_SERVICES]: 'Topics',
  [ServiceTypes.PIPELINE_SERVICES]: 'Pipelines',
  [ServiceTypes.ML_MODEL_SERVICES]: 'ML Models',
  [ServiceTypes.STORAGE_SERVICES]: 'Containers',
  [ServiceTypes.SEARCH_SERVICES]: 'Search Indexes',
};

let domain: Domain;
let dataProduct: DataProduct;

type RestorableEntityPage = {
  endpoint: string;
  entityResponseData: {
    fullyQualifiedName?: string;
  };
  visitEntityPage: (page: Page) => Promise<void>;
};

const waitForInheritedDomainOnEntityApi = async (
  page: Page,
  entity: RestorableEntityPage,
  domainDisplayName: string
) => {
  const { apiContext, afterAction } = await getApiContext(page);

  try {
    await expect
      .poll(
        async () => {
          const entityFqn = entity.entityResponseData?.fullyQualifiedName;

          if (!entityFqn) {
            return false;
          }

          const response = await apiContext.get(
            `/api/v1/${entity.endpoint}/name/${encodeURIComponent(entityFqn)}`,
            {
              params: {
                fields: 'domains,dataProducts,owners',
              },
            }
          );

          if (!response.ok()) {
            return false;
          }

          const body = await response.json();

          return (body.domains ?? []).some(
            (domain: { displayName?: string; inherited?: boolean }) =>
              domain.displayName === domainDisplayName &&
              domain.inherited !== false
          );
        },
        {
          message: `Wait for inherited domain in entity API for ${entity.entityResponseData?.fullyQualifiedName}`,
          timeout: 90_000,
          intervals: [1_000, 2_000, 5_000],
        }
      )
      .toBe(true);
  } finally {
    await afterAction();
  }
};

const selectDataProductsFromKnowledgePanel = async (
  page: Page,
  domain: {
    name: string;
    displayName: string;
  },
  dataProducts: {
    displayName: string;
    fullyQualifiedName?: string;
  }[],
  parentId = 'KnowledgePanel.DataProducts'
) => {
  await page
    .getByTestId(parentId)
    .getByTestId('data-products-container')
    .getByTestId('add-data-product')
    .click();

  for (const dataProduct of dataProducts) {
    const tagLocator = page.getByTestId(
      `tag-${dataProduct.fullyQualifiedName}`
    );

    await expect(async () => {
      const searchDataProduct = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.url().includes(encodeURIComponent(domain.name))
      );
      await page.locator('[data-testid="data-product-selector"] input').clear();
      await page
        .locator('[data-testid="data-product-selector"] input')
        .fill(dataProduct.displayName);
      await searchDataProduct;
      await expect(tagLocator).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000, intervals: [1_000, 2_000, 5_000] });

    await tagLocator.click();
  }

  await expect(
    page
      .getByTestId('data-product-dropdown-actions')
      .getByTestId('saveAssociatedTag')
  ).toBeEnabled();

  const patchReq = page.waitForResponse(
    (req) => req.request().method() === 'PATCH'
  );

  await page
    .getByTestId('data-product-dropdown-actions')
    .getByTestId('saveAssociatedTag')
    .click();
  await patchReq;
};

const waitForDataProductsOnEntityApi = async (
  page: Page,
  entity: RestorableEntityPage,
  dataProducts: {
    fullyQualifiedName?: string;
  }[]
) => {
  const { apiContext, afterAction } = await getApiContext(page);

  try {
    await expect
      .poll(
        async () => {
          const entityFqn = entity.entityResponseData?.fullyQualifiedName;

          if (!entityFqn) {
            return false;
          }

          const response = await apiContext.get(
            `/api/v1/${entity.endpoint}/name/${encodeURIComponent(entityFqn)}`,
            {
              params: {
                fields: 'domains,dataProducts,owners',
              },
            }
          );

          if (!response.ok()) {
            return false;
          }

          const body = await response.json();
          const entityDataProducts = new Set(
            (body.dataProducts ?? []).map(
              (dataProduct: { fullyQualifiedName?: string }) =>
                dataProduct.fullyQualifiedName
            )
          );

          return dataProducts.every((dataProduct) =>
            entityDataProducts.has(dataProduct.fullyQualifiedName)
          );
        },
        {
          message: `Wait for inherited data products in entity API for ${entity.entityResponseData?.fullyQualifiedName}`,
          timeout: 90_000,
          intervals: [1_000, 2_000, 5_000],
        }
      )
      .toBe(true);
  } finally {
    await afterAction();
  }
};

const waitForDataProductsOnEntityPage = async (
  page: Page,
  entity: RestorableEntityPage,
  dataProducts: {
    fullyQualifiedName?: string;
  }[],
  parentId = 'KnowledgePanel.DataProducts'
) => {
  await expect(async () => {
    await entity.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    for (const dataProduct of dataProducts) {
      await expect(
        page
          .getByTestId(parentId)
          .getByTestId('data-products-list')
          .getByTestId(`data-product-${dataProduct.fullyQualifiedName}`)
      ).toBeVisible({ timeout: 3_000 });
    }
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 5_000] });
};

const assignInheritedDataProducts = async (
  page: Page,
  entity: RestorableEntityPage,
  domain: {
    name: string;
    displayName: string;
  },
  dataProducts: {
    displayName: string;
    fullyQualifiedName?: string;
  }[]
) => {
  await selectDataProductsFromKnowledgePanel(page, domain, dataProducts);
  await waitForDataProductsOnEntityApi(page, entity, dataProducts);
  await waitForDataProductsOnEntityPage(page, entity, dataProducts);
};

const getInheritanceParentBreadcrumbIndex = (entityType: string) => {
  if (entityType === 'ApiEndpoint') {
    return 2;
  }

  if (['Table', 'Store Procedure'].includes(entityType)) {
    return 1;
  }

  return 0;
};

const waitForInheritedDomainOnEntityPage = async (
  page: Page,
  entity: RestorableEntityPage,
  domainDisplayName: string
) => {
  await waitForInheritedDomainOnEntityApi(page, entity, domainDisplayName);

  await expect(async () => {
    await entity.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    const domainCountButton = page.getByTestId('domain-count-button');
    const hasMultipleDomains = await domainCountButton
      .isVisible()
      .catch(() => false);

    if (hasMultipleDomains) {
      await expect(domainCountButton).toBeVisible({
        timeout: 2_000,
      });
    } else {
      await expect(page.getByTestId('domain-link')).toContainText(
        domainDisplayName,
        { timeout: 2_000 }
      );
    }
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 5_000] });
};

const entities = [
  ApiEndpointClass,
  TableClass,
  StoredProcedureClass,
  DashboardClass,
  PipelineClass,
  TopicClass,
  MlModelClass,
  ContainerClass,
  SearchIndexClass,
  DashboardDataModelClass,
  ChartClass,
] as const;

test.beforeAll('setup test', async ({ browser }) => {
  domain = new Domain();
  dataProduct = new DataProduct([domain]);

  const { afterAction, apiContext } = await performAdminLogin(browser);
  await domain.create(apiContext);
  await dataProduct.create(apiContext);

  await afterAction();
});

entities.forEach((EntityClass) => {
  const entity = new EntityClass();

  test.describe(entity.getType(), () => {
    test.beforeAll('setup entity ' + entity.getType(), async ({ browser }) => {
      const { afterAction, apiContext } = await performAdminLogin(browser);
      await entity.create(apiContext);
      await afterAction();
    });

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
    });

    test('Validate restore with Inherited domain and data products assigned', async ({
      page,
    }) => {
      test.slow();

      await entity.visitEntityPage(page);

      // Table and StoredProcedure have 3 breadcrumbs; clicking index 1 lands
      // on the Database entity page which already exposes KnowledgePanel.DataProducts.
      // All other entities have 1 breadcrumb (service) or their intermediate
      // breadcrumb resolves to the service management page.
      const isDbEntity = ['Table', 'Store Procedure'].includes(
        entity.getType()
      );
      const is3Breadcrumb = [
        'Table',
        'ApiEndpoint',
        'Store Procedure',
      ].includes(entity.getType());

      await expect(page.getByTestId('breadcrumb-link')).toHaveCount(
        is3Breadcrumb ? 3 : 1
      );

      // Navigate to the parent and assign domain.
      await page
        .getByTestId('breadcrumb-link')
        .nth(is3Breadcrumb ? 1 : 0)
        .click();

      await assignSingleSelectDomain(page, domain.responseData);
      await waitForAllLoadersToDisappear(page);

      // For service management pages KnowledgePanel.DataProducts is rendered
      // inside ServiceMainTabContent, which lives in the entity-count tab
      // (e.g. "ML Models", "Dashboards"). Click it so the panel becomes visible.
      if (!isDbEntity && entity.serviceType) {
        const tabLabel = SERVICE_ENTITY_TAB[entity.serviceType];

        if (tabLabel) {
          await page
            .getByRole('tab', { name: new RegExp(tabLabel, 'i') })
            .click();
          await waitForAllLoadersToDisappear(page);
        }
      }

      // Assign data product to the parent so the entity inherits it.
      // Domain is directly assigned above, no polling needed.
      await assignDataProduct(page, domain.responseData, [
        dataProduct.responseData,
      ]);

      // Back to entity; poll until the inherited domain propagates via ES.
      await redirectToHomePage(page);
      await entity.visitEntityPage(page);

      await expect
        .poll(
          async () => {
            const entityResponse = page.waitForResponse(
              (r) =>
                r.url().includes(`/api/v1/${entity.endpoint}/`) &&
                r.status() === 200
            );
            await page.reload();
            await entityResponse;
            await waitForAllLoadersToDisappear(page);

            return page
              .getByTestId('domain-link')
              .textContent()
              .catch(() => null);
          },
          {
            message: `Waiting for inherited domain "${domain.responseData.displayName}"`,
            timeout: 120_000,
            intervals: [3_000, 5_000, 10_000],
          }
        )
        .toContain(domain.responseData.displayName);

      // Entity owns no domain or data products (both inherited from parent),
      // so the backend restore check passes.
      await softDeleteEntity(
        page,
        entity.entityResponseData.name,
        entity.endpoint,
        entity.entityResponseData?.['displayName'] ??
          entity.entityResponseData.name
      );
    });
  });
});
