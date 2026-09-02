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
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { ApiCollectionClass } from '../../support/entity/ApiCollectionClass';
import { ApiEndpointClass } from '../../support/entity/ApiEndpointClass';
import { ChartClass } from '../../support/entity/ChartClass';
import { ContainerClass } from '../../support/entity/ContainerClass';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../../support/entity/DashboardDataModelClass';
import { DatabaseClass } from '../../support/entity/DatabaseClass';
import { DatabaseSchemaClass } from '../../support/entity/DatabaseSchemaClass';
import { DirectoryClass } from '../../support/entity/DirectoryClass';
import { FileClass } from '../../support/entity/FileClass';
import { MetricClass } from '../../support/entity/MetricClass';
import { MlModelClass } from '../../support/entity/MlModelClass';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { SearchIndexClass } from '../../support/entity/SearchIndexClass';
import { ApiServiceClass } from '../../support/entity/service/ApiServiceClass';
import { DashboardServiceClass } from '../../support/entity/service/DashboardServiceClass';
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import { DriveServiceClass } from '../../support/entity/service/DriveServiceClass';
import { MessagingServiceClass } from '../../support/entity/service/MessagingServiceClass';
import { MlmodelServiceClass } from '../../support/entity/service/MlmodelServiceClass';
import { PipelineServiceClass } from '../../support/entity/service/PipelineServiceClass';
import { SearchIndexServiceClass } from '../../support/entity/service/SearchIndexServiceClass';
import { StorageServiceClass } from '../../support/entity/service/StorageServiceClass';
import { SpreadsheetClass } from '../../support/entity/SpreadsheetClass';
import { StoredProcedureClass } from '../../support/entity/StoredProcedureClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { WorksheetClass } from '../../support/entity/WorksheetClass';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { TeamClass } from '../../support/team/TeamClass';
import { UserClass } from '../../support/user/UserClass';
import { authenticateAdminPage, performAdminLogin } from '../../utils/admin';
import { assignDataProduct, clickOutside } from '../../utils/common';
import { DATA_ASSET_RULES } from '../../utils/dataAssetRules';
import { assignDomainWidget } from '../../utils/domain';
import {
  addOwner,
  assignGlossaryTerm,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';
import {
  expectMetricMetadataSelections,
  getPersistedMetricMetadata,
  openMetricMetadataEditor,
  saveMetricMetadata,
  selectMetricMetadataReference,
} from '../../utils/metricMetadata';
import { test } from '../fixtures/pages';

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
  MetricClass,
  ChartClass,
  DirectoryClass,
  FileClass,
  SpreadsheetClass,
  WorksheetClass,
  ApiServiceClass,
  ApiCollectionClass,
  DatabaseServiceClass,
  DashboardServiceClass,
  MessagingServiceClass,
  MlmodelServiceClass,
  PipelineServiceClass,
  SearchIndexServiceClass,
  StorageServiceClass,
  DatabaseClass,
  DatabaseSchemaClass,
  DriveServiceClass,
] as const;

const user = new UserClass();
const user2 = new UserClass();
const team = new TeamClass();
const table = new TableClass();
const table2 = new TableClass();
const table3 = new TableClass();
const domain = new Domain();
const domain2 = new Domain();
const testDataProducts = [new DataProduct([domain]), new DataProduct([domain])];
const createdDataProducts: DataProduct[] = [];
const glossary = new Glossary();
const glossaryTerm = new GlossaryTerm(glossary);
const glossaryTerm2 = new GlossaryTerm(glossary);

const requireFixtureValue = (
  value: string | undefined,
  fixtureName: string
) => {
  if (!value) {
    throw new Error(`${fixtureName} was not created`);
  }

  return value;
};

const verifyEnabledMetricMetadataRules = async (
  page: Page,
  apiContext: APIRequestContext,
  metric: MetricClass
) => {
  const metricId = requireFixtureValue(metric.entityResponseData.id, 'Metric');
  const firstUserName = user.getUserDisplayName();
  const secondUserName = user2.getUserDisplayName();
  const teamName = requireFixtureValue(team.responseData.displayName, 'Team');
  const firstDomainName = requireFixtureValue(
    domain.responseData.displayName,
    'First domain'
  );
  const secondDomainName = requireFixtureValue(
    domain2.responseData.displayName,
    'Second domain'
  );
  const firstDataProductName = requireFixtureValue(
    createdDataProducts[0]?.responseData.displayName,
    'First data product'
  );
  const secondDataProductName = requireFixtureValue(
    createdDataProducts[1]?.responseData.displayName,
    'Second data product'
  );
  const dialog = await openMetricMetadataEditor(page);

  let ownersGroup = await selectMetricMetadataReference(
    dialog,
    'Owners',
    firstUserName
  );
  ownersGroup = await selectMetricMetadataReference(
    dialog,
    'Owners',
    secondUserName
  );
  await expectMetricMetadataSelections(ownersGroup, [
    firstUserName,
    secondUserName,
  ]);
  ownersGroup = await selectMetricMetadataReference(dialog, 'Owners', teamName);
  await expectMetricMetadataSelections(
    ownersGroup,
    [teamName],
    [firstUserName, secondUserName]
  );

  await selectMetricMetadataReference(dialog, 'Domains', secondDomainName);
  const domainsGroup = await selectMetricMetadataReference(
    dialog,
    'Domains',
    firstDomainName
  );
  await expectMetricMetadataSelections(
    domainsGroup,
    [firstDomainName],
    [secondDomainName]
  );

  await selectMetricMetadataReference(
    dialog,
    'Data Products',
    firstDataProductName
  );
  const dataProductsGroup = await selectMetricMetadataReference(
    dialog,
    'Data Products',
    secondDataProductName
  );
  await expectMetricMetadataSelections(
    dataProductsGroup,
    [secondDataProductName],
    [firstDataProductName]
  );

  await saveMetricMetadata(page, dialog, metricId);

  const persisted = await getPersistedMetricMetadata(apiContext, metricId);
  expect(persisted.owners?.map(({ id }) => id)).toEqual([
    requireFixtureValue(team.responseData.id, 'Team'),
  ]);
  expect(persisted.domains?.map(({ id }) => id)).toEqual([
    requireFixtureValue(domain.responseData.id, 'First domain'),
  ]);
  expect(persisted.dataProducts?.map(({ id }) => id)).toEqual([
    requireFixtureValue(
      createdDataProducts[1]?.responseData.id,
      'Second data product'
    ),
  ]);

  const metadataRail = page.getByTestId('metric-metadata-rail');
  await expect(metadataRail).toContainText(teamName);
  await expect(metadataRail).not.toContainText(firstUserName);
  await expect(metadataRail).not.toContainText(secondUserName);
  await expect(metadataRail).toContainText(firstDomainName);
  await expect(metadataRail).not.toContainText(secondDomainName);
  await expect(metadataRail).toContainText(secondDataProductName);
  await expect(metadataRail).not.toContainText(firstDataProductName);
};

test.beforeAll('Setup pre-requests', async ({ browser }) => {
  test.slow(true);

  const { apiContext, afterAction } = await performAdminLogin(browser);
  await user.create(apiContext);
  await user2.create(apiContext);
  await team.create(apiContext);
  await table.create(apiContext);
  await table2.create(apiContext);
  await table3.create(apiContext);
  await domain.create(apiContext);
  await domain2.create(apiContext);
  for (const dp of testDataProducts) {
    await dp.create(apiContext);
    createdDataProducts.push(dp);
  }
  await glossary.create(apiContext);
  await glossaryTerm.create(apiContext);
  await glossaryTerm2.create(apiContext);

  // Enable All the Data Asset Rules
  await apiContext.put(`/api/v1/system/settings`, {
    data: {
      config_type: 'entityRulesSettings',
      config_value: {
        entitySemantics: DATA_ASSET_RULES,
      },
    },
    headers: {
      'Content-Type': 'application/json',
    },
  });

  await afterAction();
});

test.describe(
  `Data Asset Rules Enabled`,
  {
    tag: '@dataAssetRules',
  },
  async () => {
    for (const EntityClass of entities) {
      const entity = new EntityClass();
      const entityName = entity.getType();

      test(`Verify the ${entityName} Entity Action items after rules is Enabled`, async ({
        page,
        browser,
      }) => {
        test.slow(true);

        const { apiContext, afterAction } = await performAdminLogin(browser);
        await entity.create(apiContext);

        if (entity instanceof MetricClass) {
          try {
            await authenticateAdminPage(page);
            await entity.visitEntityPage(page);
            await verifyEnabledMetricMetadataRules(page, apiContext, entity);
          } finally {
            await afterAction();
          }

          return;
        }

        await afterAction();

        await authenticateAdminPage(page);
        await entity.visitEntityPage(page);

        // If after adding single team it closes then default rule is working. Single team or multiple users
        await addOwner({
          page,
          owner: team.responseData.displayName,
          type: 'Teams',
          endpoint: entity.endpoint,
          dataTestId: 'data-assets-header',
        });

        // Single Domain Add Check
        await assignDomainWidget(page, domain.responseData);

        // Exclude this check at Service Level Entities
        if (!entityName.includes('Service')) {
          // Here the createdDataProducts[1] will only be available due to single select type is enabled
          await assignDataProduct(page, domain.responseData, [
            createdDataProducts[0].responseData,
          ]);
          await assignDataProduct(
            page,
            domain.responseData,
            [createdDataProducts[1].responseData],
            'Edit'
          );

          await expect(
            page
              .getByTestId('KnowledgePanel.DataProducts')
              .getByTestId('data-products-list')
              .getByTestId(
                `data-product-${createdDataProducts[0].responseData.fullyQualifiedName}`
              )
          ).not.toBeVisible();
        }

        if (entityName === 'Table') {
          // Only glossaryTerm2.responseData data will be available due to single select type is enabled
          await assignGlossaryTerm(
            page,
            glossaryTerm.responseData,
            'Add',
            entity.endpoint
          );
          await assignGlossaryTerm(
            page,
            glossaryTerm2.responseData,
            'Edit',
            entity.endpoint
          );

          await expect(
            page
              .getByTestId('KnowledgePanel.GlossaryTerms')
              .getByTestId('glossary-container')
              .getByTestId(
                `tag-${glossaryTerm.responseData.fullyQualifiedName}`
              )
          ).not.toBeVisible();
        }
      });
    }
  }
);

test.describe(
  `GlossaryTerm Domain Entity Rules Enabled`,
  {
    tag: '@dataAssetRules',
  },
  () => {
    // Verify entity rules restrict to single domain selection for glossary term
    test('should enforce single domain selection for glossary term when entity rules are enabled', async ({
      page,
      browser,
    }) => {
      test.slow(true);
      const { apiContext, afterAction } = await performAdminLogin(browser);
      const testDomain1 = new Domain();
      const testDomain2 = new Domain();
      const testGlossary = new Glossary();
      const testGlossaryTerm = new GlossaryTerm(testGlossary);

      try {
        await testDomain1.create(apiContext);
        await testDomain2.create(apiContext);
        await testGlossary.create(apiContext);
        await testGlossaryTerm.create(apiContext);

        // Navigate to glossary term page with full page load
        await page.goto(
          `/glossary/${encodeURIComponent(
            testGlossaryTerm.responseData.fullyQualifiedName
          )}`
        );

        await page.waitForLoadState('domcontentloaded');
        await waitForAllLoadersToDisappear(page);

        // Open domain selector to verify single-select mode (no checkboxes)
        await page.getByTestId('add-domain').click();
        await waitForAllLoadersToDisappear(page);

        // Verify checkboxes are NOT visible (single-select mode)
        await expect(
          page.locator('.domain-selectable-tree .ant-tree-checkbox')
        ).toHaveCount(0);

        // Close the selector by clicking outside
        await clickOutside(page);

        // Wait for domain selector to be fully closed
        await page.getByTestId('domain-selectable-tree').waitFor({
          state: 'detached',
        });

        // Assign first domain (single-select mode)
        await assignDomainWidget(page, testDomain1.responseData);

        // Verify first domain is visible
        await expect(page.getByTestId('domain-link')).toContainText(
          testDomain1.data.displayName
        );

        // Assign second domain (should REPLACE first, not add to it)
        await assignDomainWidget(page, testDomain2.responseData, false, true);

        // Verify second domain is visible
        await expect(page.getByTestId('domain-link')).toContainText(
          testDomain2.data.displayName
        );

        // Verify first domain is NOT visible (replaced, not added)
        // This confirms single-select mode is enforced by entity rules
        await expect(page.getByTestId('domain-link')).not.toContainText(
          testDomain1.data.displayName
        );

        // Verify no domain count button (only single domain, not multiple)
        await expect(page.getByTestId('domain-count-button')).not.toBeVisible();
      } finally {
        await testGlossaryTerm.delete(apiContext);
        await testGlossary.delete(apiContext);
        await testDomain1.delete(apiContext);
        await testDomain2.delete(apiContext);
        await afterAction();
      }
    });
  }
);

test.describe(
  `Data Product Domain Validation Rule Enabled`,
  {
    tag: '@dataAssetRules',
  },
  () => {
    const assetDomain = new Domain();
    const productDomain = new Domain();
    const sameDomainDataProduct = new DataProduct([assetDomain]);
    const otherDomainDataProduct = new DataProduct([productDomain]);
    const crossTable = new TableClass();
    // Fixtures for the "Add Assets" picker test: a Data Product in
    // productDomain, an asset in the same domain (must be offered) and an asset
    // in a different domain (must be scoped out).
    const pickerDataProduct = new DataProduct([productDomain]);
    const sameDomainTable = new TableClass();
    const otherDomainTable = new TableClass();

    test.beforeAll('Setup cross-domain data', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await assetDomain.create(apiContext);
      await productDomain.create(apiContext);
      await sameDomainDataProduct.create(apiContext);
      await otherDomainDataProduct.create(apiContext);
      await crossTable.create(apiContext);
      await pickerDataProduct.create(apiContext);
      await sameDomainTable.create(apiContext);
      await otherDomainTable.create(apiContext);
      await sameDomainTable.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/domains',
            value: [{ id: productDomain.responseData.id, type: 'domain' }],
          },
        ],
      });
      await otherDomainTable.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/domains',
            value: [{ id: assetDomain.responseData.id, type: 'domain' }],
          },
        ],
      });
      await afterAction();
    });

    test.afterAll('Cleanup cross-domain data', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await otherDomainTable.delete(apiContext);
      await sameDomainTable.delete(apiContext);
      await pickerDataProduct.delete(apiContext);
      await crossTable.delete(apiContext);
      await sameDomainDataProduct.delete(apiContext);
      await otherDomainDataProduct.delete(apiContext);
      await productDomain.delete(apiContext);
      await assetDomain.delete(apiContext);
      await afterAction();
    });

    // With the "Data Product Domain Validation" rule enabled, the Data Product
    // dropdown stays scoped to the asset's domain, so a Data Product from a
    // different domain is not offered.
    test('should not list Data Products from a different domain', async ({
      page,
    }) => {
      await authenticateAdminPage(page);
      await crossTable.visitEntityPage(page);

      await assignDomainWidget(page, assetDomain.responseData);

      await page
        .getByTestId('KnowledgePanel.DataProducts')
        .getByTestId('data-products-container')
        .getByTestId('add-data-product')
        .click();

      const selectorInput = page.locator(
        '[data-testid="data-product-selector"] input'
      );
      const sameDomainFqn =
        sameDomainDataProduct.responseData.fullyQualifiedName;
      const otherDomainFqn =
        otherDomainDataProduct.responseData.fullyQualifiedName;

      // Positive control: a Data Product in the asset's domain is listed.
      await expect(async () => {
        const searchResponse = page.waitForResponse((response) =>
          response.url().includes('/api/v1/search/query')
        );
        await selectorInput.clear();
        await selectorInput.fill(sameDomainDataProduct.data.displayName);
        await searchResponse;
        await expect(page.getByTestId(`tag-${sameDomainFqn}`)).toBeVisible({
          timeout: 2_000,
        });
      }).toPass({ timeout: 30_000, intervals: [1_000, 2_000, 5_000] });

      // Scoped to the asset's domain, so a Data Product from another domain is
      // not offered.
      const otherSearchResponse = page.waitForResponse((response) =>
        response.url().includes('/api/v1/search/query')
      );
      await selectorInput.clear();
      await selectorInput.fill(otherDomainDataProduct.data.displayName);
      await otherSearchResponse;

      await expect(page.getByTestId(`tag-${otherDomainFqn}`)).not.toBeVisible();
    });

    // With the rule enabled, the "Add Assets" picker on a Data Product stays
    // scoped to the Data Product's own domain, so an asset from a different
    // domain is not offered (#32297).
    test('should scope the Add Assets picker to the Data Product domain', async ({
      page,
    }) => {
      await authenticateAdminPage(page);
      await pickerDataProduct.visitEntityPage(page);

      const initialSearch = page.waitForResponse(
        '/api/v1/search/query?q=&index=all&*'
      );
      await page.getByTestId('data-product-details-add-button').click();
      await initialSearch;

      const drawer = page.getByTestId('asset-selection-modal');
      await drawer.waitFor({ state: 'visible' });

      const sameDomainName = sameDomainTable.entityResponseData.name;
      const sameDomainFqn =
        sameDomainTable.entityResponseData.fullyQualifiedName;
      const otherDomainName = otherDomainTable.entityResponseData.name;
      const otherDomainFqn =
        otherDomainTable.entityResponseData.fullyQualifiedName;

      // Positive control: an asset in the Data Product's domain is offered.
      const sameDomainSearch = page.waitForResponse(
        `/api/v1/search/query?q=${encodeURIComponent(
          sameDomainName
        )}&index=all&from=0&size=25&*`
      );
      await page.getByTestId('searchbar').fill(sameDomainName);
      await sameDomainSearch;

      await expect(
        drawer.getByTestId(`table-data-card_${sameDomainFqn}`)
      ).toBeVisible();

      // Scoped to the Data Product's domain, so a cross-domain asset is not
      // offered.
      const otherDomainSearch = page.waitForResponse(
        `/api/v1/search/query?q=${encodeURIComponent(
          otherDomainName
        )}&index=all&from=0&size=25&*`
      );
      await page.getByTestId('searchbar').fill(otherDomainName);
      await otherDomainSearch;

      await expect(
        drawer.getByTestId(`table-data-card_${otherDomainFqn}`)
      ).not.toBeVisible();
    });
  }
);
