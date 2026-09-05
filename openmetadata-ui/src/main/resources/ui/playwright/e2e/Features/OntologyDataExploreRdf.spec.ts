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

import { APIRequestContext, Page } from '@playwright/test';
import {
  CreateTable,
  DataType,
  TableType,
} from '../../../src/generated/api/data/createTable';
import { Table } from '../../../src/generated/entity/data/table';
import { EntityReference } from '../../../src/generated/entity/type';
import { TableClass } from '../../support/entity/TableClass';
import { expect, test } from '../../support/fixtures/base';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { OntologyRdfFixture } from '../../support/ontology/OntologyRdfFixture';
import { performAdminLogin } from '../../utils/admin';
import { uuid } from '../../utils/common';
import { connectEdgeBetweenNodesViaAPI } from '../../utils/lineage';
import {
  navigateToOntologyStudio,
  readSearchHighlightIds,
  waitForGraphLoaded,
} from '../../utils/ontologyStudio';

const suffix = uuid().replaceAll('-', '');
const fixture = new OntologyRdfFixture(`pw_data_${suffix}`);
const foreignFixture = new OntologyRdfFixture(`pw_data_foreign_${suffix}`);
const tableFixture = new TableClass(`pw_data_asset_${suffix}_0`);
const PRIMARY_ASSET_COUNT = 101;
const PAGINATION_DECOY_COUNT = 11;
const SELECTED_GLOSSARY_TERM_COUNT = PAGINATION_DECOY_COUNT + 3;
const SECONDARY_ASSET_INDEX = PRIMARY_ASSET_COUNT;
const HIERARCHY_ASSET_INDEX = SECONDARY_ASSET_INDEX + 1;
const PAGINATION_ASSET_START_INDEX = HIERARCHY_ASSET_INDEX + 1;
const TOTAL_ASSET_COUNT = PAGINATION_ASSET_START_INDEX + PAGINATION_DECOY_COUNT;
const TABLE_CREATE_CONCURRENCY = 10;
const ASSET_ASSIGNMENT_BATCH_SIZE = 20;
let primaryTerm: GlossaryTerm;
let secondaryTerm: GlossaryTerm;
let hierarchyTerm: GlossaryTerm;
let foreignTerm: GlossaryTerm;
let paginationTerms: GlossaryTerm[] = [];
let tables: Table[] = [];
let lineageFromAssetId = '';
let lineageToAssetId = '';

interface OntologyDataGraphBody {
  clusters: Array<{
    assetCount: number;
    assets: Array<{ id: string }>;
    term: { id: string };
  }>;
  edges: Array<{
    from: string;
    relationType: string;
    to: string;
  }>;
  lineageEdges: Array<{
    fromEntity: string;
    toEntity: string;
  }>;
  paging: { total: number };
  seedTermIds: string[];
}

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

const isOntologyDataGraph = (value: unknown): value is OntologyDataGraphBody =>
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
      'assets' in cluster &&
      Array.isArray(cluster.assets) &&
      cluster.assets.every(
        (asset: unknown) =>
          typeof asset === 'object' &&
          asset !== null &&
          'id' in asset &&
          typeof asset.id === 'string'
      ) &&
      'term' in cluster &&
      typeof cluster.term === 'object' &&
      cluster.term !== null &&
      'id' in cluster.term &&
      typeof cluster.term.id === 'string'
  ) &&
  'edges' in value &&
  Array.isArray(value.edges) &&
  value.edges.every(
    (edge) =>
      typeof edge === 'object' &&
      edge !== null &&
      'from' in edge &&
      typeof edge.from === 'string' &&
      'to' in edge &&
      typeof edge.to === 'string' &&
      'relationType' in edge &&
      typeof edge.relationType === 'string'
  ) &&
  'lineageEdges' in value &&
  Array.isArray(value.lineageEdges) &&
  value.lineageEdges.every(
    (edge) =>
      typeof edge === 'object' &&
      edge !== null &&
      'fromEntity' in edge &&
      typeof edge.fromEntity === 'string' &&
      'toEntity' in edge &&
      typeof edge.toEntity === 'string'
  ) &&
  'paging' in value &&
  typeof value.paging === 'object' &&
  value.paging !== null &&
  'total' in value.paging &&
  typeof value.paging.total === 'number' &&
  'seedTermIds' in value &&
  Array.isArray(value.seedTermIds) &&
  value.seedTermIds.every((id) => typeof id === 'string');

function hasUndirectedRelation(
  edges: OntologyDataGraphBody['edges'],
  firstId: string,
  secondId: string,
  relationType: string
): boolean {
  return edges.some(
    (edge) =>
      edge.relationType === relationType &&
      ((edge.from === firstId && edge.to === secondId) ||
        (edge.from === secondId && edge.to === firstId))
  );
}

async function assertOntologyDesignContract(
  page: Page,
  termId: string,
  assetId: string
): Promise<void> {
  const shell = page.getByTestId('ontology-studio-shell');
  const header = shell.locator(':scope > header');
  const subNavigation = shell.locator(':scope > nav');
  const dataTab = page.getByRole('tab', { name: 'Data' });
  const cluster = page.getByTestId(`ontology-data-cluster-${termId}`);
  const assetName = cluster
    .getByTestId(`ontology-data-asset-${assetId}`)
    .getByTestId('ontology-data-asset-name');

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
    description: 'Ontology data-mode pagination fixture.',
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

async function getOntologyAssetCount(
  apiContext: APIRequestContext,
  term: GlossaryTerm,
  glossaryFqn: string
): Promise<number> {
  const body = await getOntologyDataGraph(apiContext, glossaryFqn);

  return (
    body?.clusters.find((cluster) => cluster.term.id === term.responseData.id)
      ?.assetCount ?? 0
  );
}

async function getOntologyDataGraph(
  apiContext: APIRequestContext,
  glossaryFqn: string
): Promise<OntologyDataGraphBody | undefined> {
  const response = await apiContext.get('/api/v1/glossaryTerms/ontology/data', {
    params: {
      assetPreviewSize: 4,
      connectedTermLimit: 48,
      edgeLimit: 100,
      limit: 12,
      lineageEdgeLimit: 100,
      offset: 0,
      parent: glossaryFqn,
    },
  });
  const body: unknown = response.ok() ? await response.json() : undefined;

  return isOntologyDataGraph(body) ? body : undefined;
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
      hierarchyTerm = await fixture.createTerm(
        apiContext,
        `HierarchyChild${suffix}`,
        primaryTerm
      );
      for (let index = 0; index < PAGINATION_DECOY_COUNT; index += 1) {
        paginationTerms.push(
          await fixture.createTerm(
            apiContext,
            `A${String(index).padStart(2, '0')}Pagination${suffix}`
          )
        );
      }
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
      await fixture.addRelation(apiContext, {
        relationType: 'relatedTo',
        source: primaryTerm,
        target: foreignTerm,
      });

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
      await addAssets(apiContext, secondaryTerm, [
        tables[SECONDARY_ASSET_INDEX],
      ]);
      await addAssets(apiContext, hierarchyTerm, [
        tables[HIERARCHY_ASSET_INDEX],
      ]);
      await Promise.all(
        paginationTerms.map((term, index) =>
          addAssets(apiContext, term, [
            tables[PAGINATION_ASSET_START_INDEX + index],
          ])
        )
      );
      await addAssets(apiContext, foreignTerm, [tables[SECONDARY_ASSET_INDEX]]);

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
              getOntologyAssetCount(
                apiContext,
                primaryTerm,
                fixture.glossary.responseData.fullyQualifiedName
              ),
              getOntologyAssetCount(
                apiContext,
                foreignTerm,
                foreignFixture.glossary.responseData.fullyQualifiedName
              ),
            ]),
          { timeout: 120_000 }
        )
        .toEqual([PRIMARY_ASSET_COUNT, 1]);
      await expect
        .poll(
          async () => {
            const graph = await getOntologyDataGraph(
              apiContext,
              fixture.glossary.responseData.fullyQualifiedName
            );
            const clusterIds = new Set(
              graph?.clusters.map((cluster) => cluster.term.id) ?? []
            );

            return {
              hasHierarchyContext: clusterIds.has(
                hierarchyTerm.responseData.id
              ),
              hasHierarchyEdge:
                graph?.edges.some(
                  (edge) =>
                    edge.from === primaryTerm.responseData.id &&
                    edge.to === hierarchyTerm.responseData.id &&
                    edge.relationType === 'parentOf'
                ) ?? false,
              hasRelatedContext: clusterIds.has(secondaryTerm.responseData.id),
              hasRelatedEdge: graph
                ? hasUndirectedRelation(
                    graph.edges,
                    primaryTerm.responseData.id,
                    secondaryTerm.responseData.id,
                    'relatedTo'
                  )
                : false,
              total: graph?.paging.total ?? 0,
            };
          },
          { timeout: 120_000 }
        )
        .toEqual({
          hasHierarchyContext: true,
          hasHierarchyEdge: true,
          hasRelatedContext: true,
          hasRelatedEdge: true,
          total: SELECTED_GLOSSARY_TERM_COUNT,
        });
      const connectedGraph = await getOntologyDataGraph(
        apiContext,
        fixture.glossary.responseData.fullyQualifiedName
      );
      const primaryPreview = connectedGraph?.clusters.find(
        (cluster) => cluster.term.id === primaryTerm.responseData.id
      )?.assets[0];
      const secondaryPreview = connectedGraph?.clusters.find(
        (cluster) => cluster.term.id === secondaryTerm.responseData.id
      )?.assets[0];
      if (!primaryPreview || !secondaryPreview) {
        throw new Error(
          'Connected Data mode clusters did not return asset previews'
        );
      }
      lineageFromAssetId = primaryPreview.id;
      lineageToAssetId = secondaryPreview.id;
      const lineageResponse = await connectEdgeBetweenNodesViaAPI(
        apiContext,
        { id: lineageFromAssetId, type: 'table' },
        { id: lineageToAssetId, type: 'table' }
      );
      expect(lineageResponse.ok(), await lineageResponse.text()).toBe(true);
      await expect
        .poll(
          async () => {
            const graph = await getOntologyDataGraph(
              apiContext,
              fixture.glossary.responseData.fullyQualifiedName
            );

            return (
              graph?.lineageEdges.some(
                (edge) =>
                  edge.fromEntity === lineageFromAssetId &&
                  edge.toEntity === lineageToAssetId
              ) ?? false
            );
          },
          { timeout: 30_000 }
        )
        .toBe(true);
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

  test('renders cross-page relations and lineage while paging 100+ tagged assets', async ({
    browser,
  }) => {
    test.slow();
    const { page, afterAction } = await performAdminLogin(browser, {
      navigate: true,
    });

    try {
      await navigateToOntologyStudio(page);
      await fixture.selectInStudio(page);
      const dataResponse = page.waitForResponse((response) => {
        const url = new URL(response.url());

        return (
          url.pathname === '/api/v1/glossaryTerms/ontology/data' &&
          url.searchParams.get('limit') === '12' &&
          url.searchParams.get('offset') === '0' &&
          url.searchParams.get('assetPreviewSize') === '4' &&
          url.searchParams.get('connectedTermLimit') === '48' &&
          url.searchParams.get('edgeLimit') === '100' &&
          url.searchParams.get('lineageEdgeLimit') === '100'
        );
      });
      await page.getByRole('tab', { name: 'Data' }).click();
      const initialDataResponse = await dataResponse;
      const initialDataBody: unknown = initialDataResponse.ok()
        ? await initialDataResponse.json()
        : undefined;

      expect(initialDataResponse.ok(), await initialDataResponse.text()).toBe(
        true
      );
      expect(isOntologyDataGraph(initialDataBody)).toBe(true);
      if (!isOntologyDataGraph(initialDataBody)) {
        throw new Error('Ontology data response is invalid');
      }

      expect(initialDataBody.paging.total).toBe(SELECTED_GLOSSARY_TERM_COUNT);
      expect(initialDataBody.clusters).toHaveLength(
        SELECTED_GLOSSARY_TERM_COUNT
      );
      expect(
        hasUndirectedRelation(
          initialDataBody.edges,
          primaryTerm.responseData.id,
          secondaryTerm.responseData.id,
          'relatedTo'
        )
      ).toBe(true);
      expect(initialDataBody.edges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            from: primaryTerm.responseData.id,
            relationType: 'parentOf',
            to: hierarchyTerm.responseData.id,
          }),
        ])
      );
      expect(initialDataBody.lineageEdges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fromEntity: lineageFromAssetId,
            toEntity: lineageToAssetId,
          }),
        ])
      );

      const primaryCluster = initialDataBody.clusters.find(
        (cluster) => cluster.term.id === primaryTerm.responseData.id
      );
      const previewAssetId = primaryCluster?.assets[0]?.id;

      expect(previewAssetId).toBeTruthy();
      if (!previewAssetId) {
        throw new Error('Primary cluster did not return a preview asset');
      }

      await waitForGraphLoaded(page);
      await expect(page.getByTestId('ontology-data-edge-legend')).toBeVisible();
      await assertOntologyDesignContract(
        page,
        primaryTerm.responseData.id,
        previewAssetId
      );
      await expect(page.getByTestId('ontology-data-semantic-edge')).toHaveCount(
        2
      );
      await expect(
        page
          .getByTestId('ontology-data-semantic-edge-label')
          .filter({ hasText: /related to/i })
      ).toHaveCount(1);
      await expect(
        page
          .getByTestId('ontology-data-semantic-edge-label')
          .filter({ hasText: /parent of/i })
      ).toHaveCount(1);
      await expect(
        page.getByTestId('ontology-data-observed-lineage-edge')
      ).toHaveCount(1);
      await expect(
        page.getByTestId('ontology-data-observed-lineage-edge')
      ).not.toHaveAttribute('stroke-dasharray');
      await expect(
        page.getByTestId(
          `ontology-data-cluster-${hierarchyTerm.responseData.id}`
        )
      ).toBeVisible();
      const primaryAssetRows = page
        .getByTestId(`ontology-data-cluster-${primaryTerm.responseData.id}`)
        .locator('button[data-testid^="ontology-data-asset-"]');

      const firstPageResponse = page.waitForResponse((response) => {
        const url = new URL(response.url());

        return (
          url.pathname ===
            `/api/v1/glossaryTerms/${primaryTerm.responseData.id}/assets` &&
          url.searchParams.get('limit') === '6' &&
          url.searchParams.get('offset') === '4'
        );
      });
      await page
        .getByTestId(`ontology-load-more-assets-${primaryTerm.responseData.id}`)
        .click();
      expect((await firstPageResponse).ok()).toBe(true);
      await expect(primaryAssetRows).toHaveCount(10);

      await expect(
        page
          .getByTestId(`ontology-data-cluster-${secondaryTerm.responseData.id}`)
          .getByTestId(`ontology-data-asset-${lineageToAssetId}`)
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
            `/api/v1/glossaryTerms/${primaryTerm.responseData.id}/assets` &&
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
          url.pathname === '/api/v1/glossaryTerms/ontology/data' &&
          !url.searchParams.has('parent')
        );
      });
      await page
        .getByRole('menuitemradio', { name: /all glossaries/i })
        .click();
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
