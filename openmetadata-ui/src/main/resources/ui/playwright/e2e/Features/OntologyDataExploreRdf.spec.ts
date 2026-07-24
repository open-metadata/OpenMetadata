/*
 *  Copyright 2026 Collate.
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

import { APIRequestContext, expect, Page, test } from '@playwright/test';
import {
  CreateTable,
  DataType,
  TableType,
} from '../../../src/generated/api/data/createTable';
import { Table } from '../../../src/generated/entity/data/table';
import { EntityReference } from '../../../src/generated/entity/type';
import { TableClass } from '../../support/entity/TableClass';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { OntologyRdfFixture } from '../../support/ontology/OntologyRdfFixture';
import { performAdminLogin } from '../../utils/admin';
import { uuid } from '../../utils/common';
import {
  navigateToOntologyExplorer,
  readSearchHighlightIds,
  waitForGraphLoaded,
} from '../../utils/ontologyExplorer';

const suffix = uuid().replaceAll('-', '');
const fixture = new OntologyRdfFixture(`pw_data_${suffix}`);
const foreignFixture = new OntologyRdfFixture(`pw_data_foreign_${suffix}`);
const tableFixture = new TableClass(`pw_data_asset_${suffix}_0`);
const PRIMARY_ASSET_COUNT = 101;
const TOTAL_ASSET_COUNT = PRIMARY_ASSET_COUNT + 1;
const TABLE_CREATE_CONCURRENCY = 10;
const ASSET_ASSIGNMENT_BATCH_SIZE = 20;
let primaryTerm: GlossaryTerm;
let secondaryTerm: GlossaryTerm;
let foreignTerm: GlossaryTerm;
let tables: Table[] = [];

const isTable = (value: unknown): value is Table =>
  typeof value === 'object' &&
  value !== null &&
  'id' in value &&
  typeof value.id === 'string' &&
  'fullyQualifiedName' in value &&
  typeof value.fullyQualifiedName === 'string';

const isAssetCountResponse = (
  value: unknown
): value is Record<string, number> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every((count) => typeof count === 'number');

const isStudioDataGraph = (
  value: unknown
): value is {
  clusters: Array<{ assetCount: number; term: { id: string } }>;
} =>
  typeof value === 'object' &&
  value !== null &&
  'clusters' in value &&
  Array.isArray(value.clusters) &&
  value.clusters.every(
    (cluster) =>
      typeof cluster === 'object' &&
      cluster !== null &&
      'assetCount' in cluster &&
      typeof cluster.assetCount === 'number' &&
      'term' in cluster &&
      typeof cluster.term === 'object' &&
      cluster.term !== null &&
      'id' in cluster.term &&
      typeof cluster.term.id === 'string'
  );

async function assertStudioDesignContract(
  page: Page,
  termId: string
): Promise<void> {
  const shell = page.getByTestId('ontology-studio-shell');
  const header = shell.locator('header').first();
  const subNavigation = shell.locator('nav').first();
  const dataTab = page.getByRole('tab', { name: 'Data' });
  const cluster = page.getByTestId(`ontology-data-cluster-${termId}`);
  const assetName = cluster.getByTestId('ontology-data-asset-name').first();

  await expect(shell).toHaveCSS('font-family', /Inter/);
  await expect(header).toHaveCSS('height', '56px');
  await expect(subNavigation).toHaveCSS('height', '46px');
  await expect(dataTab).toHaveCSS('font-size', '11px');
  await expect(dataTab).toHaveCSS('font-weight', '600');
  await expect(dataTab).toHaveCSS('padding-left', '16px');
  await expect(dataTab).toHaveCSS('padding-top', '6px');
  await expect(dataTab).toHaveCSS('background-color', 'rgb(239, 248, 255)');
  await expect(dataTab).toHaveCSS('color', 'rgb(23, 92, 211)');
  await expect(cluster).toHaveCSS('width', '236px');
  await expect(assetName).toHaveCSS('font-family', /Geist Mono/);
  await expect(assetName).toHaveCSS('font-size', '11px');
  await expect(assetName).toHaveCSS('font-weight', '500');
}

function toEntityReference(table: Table): EntityReference {
  return {
    fullyQualifiedName: table.fullyQualifiedName,
    id: table.id,
    name: table.name,
    type: 'table',
  };
}

async function createTable(
  apiContext: APIRequestContext,
  databaseSchema: string,
  index: number
): Promise<Table> {
  const request: CreateTable = {
    columns: [
      {
        dataType: DataType.Int,
        dataTypeDisplay: 'int',
        name: 'id',
      },
    ],
    databaseSchema,
    description: 'Ontology Studio data-mode pagination fixture.',
    displayName: `Ontology data asset ${index}`,
    name: `pw_data_asset_${suffix}_${index}`,
    tableType: TableType.Regular,
  };
  const response = await apiContext.post('/api/v1/tables', { data: request });
  const body: unknown = response.ok() ? await response.json() : undefined;

  expect(response.ok(), await response.text()).toBe(true);
  expect(isTable(body)).toBe(true);
  if (!isTable(body)) {
    throw new Error(`Table ${index} response is invalid`);
  }

  return body;
}

async function createAdditionalTables(
  apiContext: APIRequestContext,
  databaseSchema: string,
  count: number
): Promise<Table[]> {
  const createdTables: Table[] = [];

  for (let start = 1; start <= count; start += TABLE_CREATE_CONCURRENCY) {
    const indexes = Array.from(
      { length: Math.min(TABLE_CREATE_CONCURRENCY, count - start + 1) },
      (_, offset) => start + offset
    );
    createdTables.push(
      ...(await Promise.all(
        indexes.map((index) => createTable(apiContext, databaseSchema, index))
      ))
    );
  }

  return createdTables;
}

async function addAssets(
  apiContext: APIRequestContext,
  term: GlossaryTerm,
  assets: Table[]
): Promise<void> {
  for (
    let start = 0;
    start < assets.length;
    start += ASSET_ASSIGNMENT_BATCH_SIZE
  ) {
    await addAssetBatch(
      apiContext,
      term,
      assets.slice(start, start + ASSET_ASSIGNMENT_BATCH_SIZE)
    );
  }
}

async function addAssetBatch(
  apiContext: APIRequestContext,
  term: GlossaryTerm,
  assets: Table[]
): Promise<void> {
  const response = await apiContext.put(
    `/api/v1/glossaryTerms/${term.responseData.id}/assets/add`,
    {
      data: {
        assets: assets.map(toEntityReference),
        dryRun: false,
      },
    }
  );

  expect(response.ok(), await response.text()).toBe(true);
}

async function getAssetCount(
  apiContext: APIRequestContext,
  term: GlossaryTerm,
  glossaryFqn: string
): Promise<number> {
  const response = await apiContext.get('/api/v1/glossaryTerms/assets/counts', {
    params: { parent: glossaryFqn },
  });
  const body: unknown = response.ok() ? await response.json() : undefined;

  return isAssetCountResponse(body)
    ? body[term.responseData.fullyQualifiedName] ?? 0
    : 0;
}

async function getStudioAssetCount(
  apiContext: APIRequestContext,
  term: GlossaryTerm,
  glossaryFqn: string
): Promise<number> {
  const response = await apiContext.get('/api/v1/glossaryTerms/studio/data', {
    params: {
      assetPreviewSize: 4,
      limit: 12,
      offset: 0,
      parent: glossaryFqn,
    },
  });
  const body: unknown = response.ok() ? await response.json() : undefined;

  return isStudioDataGraph(body)
    ? body.clusters.find((cluster) => cluster.term.id === term.responseData.id)
        ?.assetCount ?? 0
    : 0;
}

test.describe('Ontology data exploration', { tag: ['@ontology-rdf'] }, () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180_000);
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await fixture.create(apiContext);
      primaryTerm = await fixture.createTerm(
        apiContext,
        `PrimaryCluster${suffix}`
      );
      secondaryTerm = await fixture.createTerm(
        apiContext,
        `SecondaryCluster${suffix}`
      );
      await fixture.addRelation(apiContext, {
        relationType: 'relatedTo',
        source: primaryTerm,
        target: secondaryTerm,
      });
      await foreignFixture.create(apiContext);
      foreignTerm = await foreignFixture.createTerm(
        apiContext,
        `ForeignCluster${suffix}`
      );

      const tableResources = await tableFixture.create(apiContext);
      tables = [
        tableResources.entity,
        ...(await createAdditionalTables(
          apiContext,
          tableResources.schema.fullyQualifiedName,
          TOTAL_ASSET_COUNT - 1
        )),
      ];
      await addAssets(
        apiContext,
        primaryTerm,
        tables.slice(0, PRIMARY_ASSET_COUNT)
      );
      await addAssets(
        apiContext,
        secondaryTerm,
        tables.slice(PRIMARY_ASSET_COUNT)
      );
      await addAssets(
        apiContext,
        foreignTerm,
        tables.slice(PRIMARY_ASSET_COUNT)
      );

      await expect
        .poll(
          () =>
            getAssetCount(
              apiContext,
              primaryTerm,
              fixture.glossary.responseData.fullyQualifiedName
            ),
          { timeout: 120_000 }
        )
        .toBe(PRIMARY_ASSET_COUNT);
      await expect
        .poll(
          () =>
            getAssetCount(
              apiContext,
              foreignTerm,
              foreignFixture.glossary.responseData.fullyQualifiedName
            ),
          { timeout: 120_000 }
        )
        .toBe(1);
      await expect
        .poll(
          () =>
            Promise.all([
              getStudioAssetCount(
                apiContext,
                primaryTerm,
                fixture.glossary.responseData.fullyQualifiedName
              ),
              getStudioAssetCount(
                apiContext,
                foreignTerm,
                foreignFixture.glossary.responseData.fullyQualifiedName
              ),
            ]),
          { timeout: 120_000 }
        )
        .toEqual([PRIMARY_ASSET_COUNT, 1]);
      await fixture.expectRelationProjected(
        apiContext,
        primaryTerm,
        'https://open-metadata.org/ontology/relatedTo',
        secondaryTerm
      );
    } finally {
      await afterAction();
    }
  });

  test.afterAll(async ({ browser }) => {
    test.setTimeout(120_000);
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await fixture.delete(apiContext);
      await foreignFixture.delete(apiContext);
      if (tableFixture.serviceResponseData.id) {
        await tableFixture.delete(apiContext);
      }
    } finally {
      await afterAction();
    }
  });

  test('pages 100+ tagged assets and exposes inferred clusters, search, scope, and tree', async ({
    browser,
  }) => {
    test.slow();
    const { page, afterAction } = await performAdminLogin(browser);

    try {
      await navigateToOntologyExplorer(page);
      await fixture.selectInStudio(page);
      const dataResponse = page.waitForResponse((response) => {
        const url = new URL(response.url());

        return (
          url.pathname === '/api/v1/glossaryTerms/studio/data' &&
          url.searchParams.get('limit') === '12' &&
          url.searchParams.get('offset') === '0' &&
          url.searchParams.get('assetPreviewSize') === '4'
        );
      });
      await page.getByRole('tab', { name: 'Data' }).click();
      expect((await dataResponse).ok()).toBe(true);
      await waitForGraphLoaded(page);
      await expect(page.getByTestId('ontology-data-edge-legend')).toBeVisible();
      await assertStudioDesignContract(page, primaryTerm.responseData.id);
      const primaryAssetRows = page
        .getByTestId(`ontology-data-cluster-${primaryTerm.responseData.id}`)
        .locator('button[data-testid^="ontology-data-asset-"]');

      const firstPageResponse = page.waitForResponse((response) => {
        const url = new URL(response.url());

        return (
          url.pathname ===
            `/api/v1/glossaryTerms/${primaryTerm.responseData.id}/studioAssets` &&
          url.searchParams.get('limit') === '6' &&
          url.searchParams.get('offset') === '4'
        );
      });
      await page
        .getByTestId(`ontology-load-more-assets-${primaryTerm.responseData.id}`)
        .click();
      expect((await firstPageResponse).ok()).toBe(true);
      await expect(primaryAssetRows).toHaveCount(10);
      await expect(page.getByTestId('ontology-data-semantic-edge')).toHaveCount(
        1
      );
      await expect(
        page.getByTestId('ontology-data-semantic-edge-label')
      ).toContainText('related');

      await expect(
        page
          .getByTestId(`ontology-data-cluster-${secondaryTerm.responseData.id}`)
          .getByTestId(`ontology-data-asset-${tables.at(-1)?.id}`)
      ).toBeVisible();

      const primaryAssetIds = new Set(
        tables.slice(0, PRIMARY_ASSET_COUNT).map((table) => table.id)
      );
      await expect
        .poll(async () => {
          const renderedAssets = await primaryAssetRows.evaluateAll(
            (elements) =>
              elements.map((element) =>
                element
                  .getAttribute('data-testid')
                  ?.replace('ontology-data-asset-', '')
              )
          );

          return renderedAssets.every(
            (assetId) => assetId && primaryAssetIds.has(assetId)
          );
        })
        .toBe(true);

      const secondPageResponse = page.waitForResponse((response) => {
        const url = new URL(response.url());

        return (
          url.pathname ===
            `/api/v1/glossaryTerms/${primaryTerm.responseData.id}/studioAssets` &&
          url.searchParams.get('limit') === '6' &&
          url.searchParams.get('offset') === '10'
        );
      });
      await page
        .getByTestId(`ontology-load-more-assets-${primaryTerm.responseData.id}`)
        .click();
      expect((await secondPageResponse).ok()).toBe(true);
      await expect(primaryAssetRows).toHaveCount(16);

      await page.getByTestId('ontology-glossary-menu-trigger').click();
      const allDataResponse = page.waitForResponse((response) => {
        const url = new URL(response.url());

        return (
          url.pathname === '/api/v1/glossaryTerms/studio/data' &&
          !url.searchParams.has('parent')
        );
      });
      await page.getByRole('menuitemradio').first().click();
      expect((await allDataResponse).ok()).toBe(true);
      await waitForGraphLoaded(page);
      await expect(
        page.getByTestId(`ontology-data-cluster-${foreignTerm.responseData.id}`)
      ).toBeVisible();

      await page.getByRole('tab', { name: 'Model' }).click();
      await waitForGraphLoaded(page);
      await page
        .getByTestId('ontology-graph-search')
        .fill(primaryTerm.responseData.name);
      await expect
        .poll(async () => readSearchHighlightIds(page))
        .toContain(primaryTerm.responseData.id);

      await page.getByTestId('submode-tab-tree').click();
      await expect(page.getByTestId('ontology-tree-view')).toBeVisible();
      await expect(
        page.getByTestId(`ontology-tree-term-${primaryTerm.responseData.id}`)
      ).toBeVisible();
    } finally {
      await afterAction();
    }
  });
});
