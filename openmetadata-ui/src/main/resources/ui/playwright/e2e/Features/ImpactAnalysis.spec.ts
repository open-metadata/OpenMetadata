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
import { expect, Page } from '@playwright/test';
import { get } from 'lodash';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../../support/entity/DashboardDataModelClass';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { MlModelClass } from '../../support/entity/MlModelClass';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import {
  getDefaultAdminAPIContext,
  redirectToHomePage,
} from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  connectEdgeBetweenNodesViaAPI,
  openImpactAnalysisTab,
  updateLineageConfigFromModal,
  visitLineageTab,
} from '../../utils/lineage';
import { test } from '../fixtures/pages';
const table = new TableClass();
const table2 = new TableClass();
const topic = new TopicClass();
const dashboard = new DashboardClass();
const dataModel = new DashboardDataModelClass();
const pipeline = new PipelineClass();
const mlModel = new MlModelClass();

const waitForDirectionalColumnLineageResponse = (
  page: Page,
  {
    direction,
    fqn,
    upstreamDepth,
    downstreamDepth,
    columnFilterIncludes,
  }: {
    direction: 'Downstream' | 'Upstream';
    fqn?: string;
    upstreamDepth?: number;
    downstreamDepth?: number;
    columnFilterIncludes?: string;
  }
) =>
  page.waitForResponse((response) => {
    if (!response.url().includes(`/api/v1/lineage/getLineage/${direction}`)) {
      return false;
    }

    const url = new URL(response.url());

    if (fqn && url.searchParams.get('fqn') !== fqn) {
      return false;
    }

    if (
      upstreamDepth !== undefined &&
      url.searchParams.get('upstreamDepth') !== upstreamDepth.toString()
    ) {
      return false;
    }

    if (
      downstreamDepth !== undefined &&
      url.searchParams.get('downstreamDepth') !== downstreamDepth.toString()
    ) {
      return false;
    }

    if (
      columnFilterIncludes &&
      !(
        url.searchParams.get('column_filter')?.includes(columnFilterIncludes) ??
        false
      )
    ) {
      return false;
    }

    return true;
  });

test.describe('Impact Analysis', () => {
  let tableColumns: string[] = [];
  let table2Columns: string[] = [];

  test.beforeAll(async ({ browser }) => {
    test.slow(true);
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      browser
    );

    await Promise.all([
      table.create(apiContext),
      table2.create(apiContext),
      topic.create(apiContext),
      dashboard.create(apiContext),
      dataModel.create(apiContext),
      pipeline.create(apiContext),
      mlModel.create(apiContext),
    ]);

    tableColumns = get(table, 'entityResponseData.columns', []).map(
      (col: { fullyQualifiedName?: string }) => col.fullyQualifiedName ?? ''
    );
    table2Columns = get(table2, 'entityResponseData.columns', []).map(
      (col: { fullyQualifiedName?: string }) => col.fullyQualifiedName ?? ''
    );

    // connect table and table2 with column lineage
    await connectEdgeBetweenNodesViaAPI(
      apiContext,
      { id: table.entityResponseData.id, type: 'table' },
      { id: table2.entityResponseData.id, type: 'table' },
      [
        {
          fromColumns: [tableColumns[0], tableColumns[1], tableColumns[2]],
          toColumn: table2Columns[0],
        },
        {
          fromColumns: [tableColumns[3]],
          toColumn: table2Columns[1],
        },
        {
          fromColumns: [tableColumns[2]],
          toColumn: table2Columns[1],
        },
      ]
    );

    // connect table to Topic
    await connectEdgeBetweenNodesViaAPI(
      apiContext,
      { id: table.entityResponseData.id, type: 'table' },
      { id: topic.entityResponseData.id, type: 'topic' },
      []
    );

    // connect Dashboard to table for upstream
    await connectEdgeBetweenNodesViaAPI(
      apiContext,
      { id: dashboard.entityResponseData.id, type: 'dashboard' },
      { id: table.entityResponseData.id, type: 'table' },
      []
    );

    // connect table to dashboardDataModel
    await connectEdgeBetweenNodesViaAPI(
      apiContext,
      { id: table.entityResponseData.id, type: 'table' },
      { id: dataModel.entityResponseData.id, type: 'dashboardDataModel' },
      []
    );

    await connectEdgeBetweenNodesViaAPI(
      apiContext,
      { id: table.entityResponseData.id, type: 'table' },
      { id: pipeline.entityResponseData.id, type: 'pipeline' },
      []
    );

    await connectEdgeBetweenNodesViaAPI(
      apiContext,
      { id: table.entityResponseData.id, type: 'table' },
      { id: mlModel.entityResponseData.id, type: 'mlmodel' },
      []
    );

    await table2.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/tags/0',
          value: {
            name: EntityDataClass.tierTag1.responseData.name,
            tagFQN: EntityDataClass.tierTag1.responseData.fullyQualifiedName,
            labelType: 'Manual',
            state: 'Confirmed',
          },
        },
      ],
    });

    await apiContext.put(
      `/api/v1/columns/name/${table2.entityResponseData.columns[0].fullyQualifiedName}?entityType=table`,
      {
        data: {
          tags: [
            {
              name: EntityDataClass.tag1.responseData.name,
              tagFQN: EntityDataClass.tag1.responseData.fullyQualifiedName,
              labelType: 'Manual',
              state: 'Confirmed',
            },
            {
              name: EntityDataClass.glossaryTerm1.responseData.name,
              tagFQN:
                EntityDataClass.glossaryTerm1.responseData.fullyQualifiedName,
              source: 'Glossary',
              labelType: 'Manual',
              state: 'Confirmed',
            },
          ],
        },
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    await pipeline.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          value: {
            type: 'user',
            id: EntityDataClass.user1.responseData.id,
          },
          path: '/owners/0',
        },
        {
          op: 'add',
          value: {
            labelType: 'Manual',
            name: EntityDataClass.tag1.responseData.name,
            source: 'Classification',
            state: 'Confirmed',
            tagFQN: EntityDataClass.tag1.responseData.fullyQualifiedName,
          },
          path: '/tags/0',
        },
      ],
    });

    await topic.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          value: {
            type: 'domain',
            id: EntityDataClass.domain1.responseData.id,
          },
          path: '/domains/0',
        },
      ],
    });

    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      browser
    );
    await table.delete(apiContext);
    await table2.delete(apiContext);
    await topic.delete(apiContext);
    await dashboard.delete(apiContext);
    await dataModel.delete(apiContext);
    await pipeline.delete(apiContext);
    await mlModel.delete(apiContext);
    await afterAction();
  });

  test.beforeEach(
    'prepare for test and navigate to Impact Analysis',
    async ({ page }) => {
      await redirectToHomePage(page);
      await table.visitEntityPage(page);
      await visitLineageTab(page);
      const lineageResponse = page.waitForResponse(
        `/api/v1/lineage/getLineageByEntityCount?*`
      );
      await openImpactAnalysisTab(page);
      await lineageResponse;
    }
  );

  test('validate upstream/ downstream counts', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: 'Downstream 5' })
    ).toBeVisible();

    await page.getByRole('button', { name: 'Upstream' }).click();

    await expect(
      page.getByRole('button', { name: 'Upstream 1' })
    ).toBeVisible();
  });

  test('Verify impact analysis requests include entityType and explicit depth bounds', async ({
    page,
  }) => {
    const lineageRequests: string[] = [];
    const captureRequest = (request: { url: () => string }) => {
      const url = request.url();
      if (url.includes('/api/v1/lineage/getLineageByEntityCount')) {
        lineageRequests.push(url);
      }
    };

    page.on('request', captureRequest);

    const initialLineageCount = lineageRequests.length;

    await page.getByTestId('lineage-config').click();

    await page.getByLabel(/upstream/i).fill('5');

    await page.getByRole('button', { name: /ok/i }).click();

    await expect(page.locator('[role="dialog"]')).not.toBeVisible();

    await expect
      .poll(() => lineageRequests.length, { timeout: 10000 })
      .toBeGreaterThan(initialLineageCount);
    page.off('request', captureRequest);

    const lineageUrl = new URL(lineageRequests.at(-1) ?? '');
    expect(lineageUrl.searchParams.get('entityType')).toBe('table');
    expect(lineageUrl.searchParams.get('maxDepth')).toBeTruthy();
    expect(lineageUrl.searchParams.get('nodeDepth')).toBeTruthy();
    expect(lineageUrl.searchParams.get('maxDepth')).toBe(
      lineageUrl.searchParams.get('nodeDepth')
    );
    expect(lineageUrl.searchParams.get('upstreamDepth')).toBeTruthy();
    expect(lineageUrl.searchParams.get('downstreamDepth')).toBeTruthy();
    expect(lineageUrl.searchParams.get('include_pagination_info')).toBe('true');
    expect(lineageUrl.searchParams.get('upstreamDepth')).toBe('5');
  });

  test('Verify Downstream connections', async ({ page }) => {
    const tableDownstreamNodes: string[] = [
      pipeline.entityResponseData.displayName ?? pipeline.entity.displayName,
      dataModel.entityResponseData.displayName ?? dataModel.entity.displayName,
      topic.entityResponseData.displayName ?? topic.entity.displayName,
      table2.entityResponseData.displayName ?? table2.entity.displayName,
    ];
    for (const node of tableDownstreamNodes) {
      await expect(page.getByText(node)).toBeVisible();
    }

    // Verify Dashboard is visible in Impact Analysis for Upstream
    await page.getByRole('button', { name: 'Upstream' }).click();

    await expect(
      page.getByText(dashboard.entityResponseData.displayName)
    ).toBeVisible();

    await dashboard.visitEntityPage(page);
    await visitLineageTab(page);
    const dashboardLineageResponse = page.waitForResponse(
      `/api/v1/lineage/getLineageByEntityCount?*`
    );
    await openImpactAnalysisTab(page);
    await dashboardLineageResponse;

    await updateLineageConfigFromModal(page, {
      upstreamDepth: 2,
      downstreamDepth: 2,
    });

    await waitForAllLoadersToDisappear(page);

    const dashboardDownstreamNodes: string[] = [
      dataModel.entityResponseData.displayName ?? dataModel.entity.displayName,
      table.entityResponseData.displayName ?? table.entity.displayName,
      pipeline.entityResponseData.displayName ?? pipeline.entity.displayName,
      mlModel.entityResponseData.displayName ?? mlModel.entity.displayName,
      table2.entityResponseData.displayName ?? table2.entity.displayName,
    ];

    for (const node of dashboardDownstreamNodes) {
      await expect(page.getByText(node)).toBeVisible();
    }
  });

  test('Verify Upstream connections', async ({ page }) => {
    // Verify Dashboard is visible in Impact Analysis for Upstream
    await page.getByRole('button', { name: 'Upstream' }).click();

    await expect(
      page.getByText(dashboard.entityResponseData.displayName)
    ).toBeVisible();

    await topic.visitEntityPage(page);
    await visitLineageTab(page);
    const topicLineageResponse = page.waitForResponse(
      `/api/v1/lineage/getLineageByEntityCount?*`
    );
    await openImpactAnalysisTab(page);
    await topicLineageResponse;

    await updateLineageConfigFromModal(page, {
      upstreamDepth: 2,
      downstreamDepth: 2,
    });
    await waitForAllLoadersToDisappear(page);

    // Verify Table is visible in Impact Analysis for Upstream of Topic
    await page.getByRole('button', { name: 'Upstream' }).click();

    await expect(
      page.getByText(
        table.entityResponseData.displayName ?? table.entity.displayName
      )
    ).toBeVisible();
    await expect(
      page.getByText(dashboard.entityResponseData.displayName)
    ).toBeVisible();
  });

  test('verify owner filter for Asset level impact analysis', async ({
    page,
  }) => {
    await page.getByTestId('filters-button').click();
    await page.getByTestId('search-dropdown-Owners').click();

    await expect(
      page.getByTitle(EntityDataClass.user1.responseData.name)
    ).toBeVisible();

    await page.getByTitle(EntityDataClass.user1.responseData.name).click();
    const filterResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/lineage/getLineageByEntityCount') &&
        response.request().method() === 'GET'
    );
    await page.getByRole('button', { name: 'Update' }).click();
    await filterResponse;
    await waitForAllLoadersToDisappear(page);

    await expect(page.locator('[data-row-key]')).toHaveCount(1);

    await expect(
      page.locator(
        `[data-row-key="${pipeline.entityResponseData.fullyQualifiedName}"]`
      )
    ).toBeVisible();
  });

  test('verify domain for Asset level impact analysis', async ({ page }) => {
    await page.getByTestId('filters-button').click();
    await page.getByTestId('search-dropdown-Domains').click();

    await expect(
      page.getByTitle(EntityDataClass.domain1.responseData.displayName)
    ).toBeVisible();

    await page
      .getByTitle(EntityDataClass.domain1.responseData.displayName)
      .click();
    const filterResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/lineage/getLineageByEntityCount') &&
        response.request().method() === 'GET'
    );
    await page.getByRole('button', { name: 'Update' }).click();
    await filterResponse;
    await waitForAllLoadersToDisappear(page);

    await expect(page.locator('[data-row-key]')).toHaveCount(1);

    await expect(
      page.locator(
        `[data-row-key="${topic.entityResponseData.fullyQualifiedName}"]`
      )
    ).toBeVisible();
  });

  test('verify tier for Asset level impact analysis', async ({ page }) => {
    await page.getByTestId('filters-button').click();
    await page.getByTestId('search-dropdown-Tier').click();

    await expect(
      page.getByTitle(EntityDataClass.tierTag1.responseData.fullyQualifiedName)
    ).toBeVisible();

    await page
      .getByTitle(EntityDataClass.tierTag1.responseData.fullyQualifiedName)
      .click();
    const filterResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/lineage/getLineageByEntityCount') &&
        response.request().method() === 'GET'
    );
    await page.getByRole('button', { name: 'Update' }).click();
    await filterResponse;
    await waitForAllLoadersToDisappear(page);

    await expect(page.locator('[data-row-key]')).toHaveCount(1);

    await expect(
      page.locator(
        `[data-row-key="${table2.entityResponseData.fullyQualifiedName}"]`
      )
    ).toBeVisible();
  });

  test('Verify upstream/downstream counts for column level', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Impact On: Table' }).click();
    const paginationRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/lineage/getPaginationInfo')) {
        paginationRequests.push(request.url());
      }
    });
    const paginationRequestCountBeforeColumnMode = paginationRequests.length;
    const columnLineageResponse = waitForDirectionalColumnLineageResponse(
      page,
      {
        direction: 'Downstream',
      }
    );
    await page.getByText('Column level').click();
    await columnLineageResponse;
    await waitForAllLoadersToDisappear(page);

    await expect(
      page.getByRole('button', { name: 'Downstream 5' })
    ).toBeVisible();

    await page.getByRole('button', { name: 'Upstream' }).click();

    await expect(
      page.getByRole('button', { name: 'Upstream 0' })
    ).toBeVisible();
    await expect
      .poll(() => paginationRequests.length, { timeout: 5000 })
      .toBe(paginationRequestCountBeforeColumnMode);

    await table2.visitEntityPage(page);
    await visitLineageTab(page);
    const table2LineageResponse = page.waitForResponse(
      `/api/v1/lineage/getLineageByEntityCount?*`
    );
    await openImpactAnalysisTab(page);
    await table2LineageResponse;

    await updateLineageConfigFromModal(page, {
      upstreamDepth: 2,
      downstreamDepth: 2,
    });
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('button', { name: 'Impact On: Table' }).click();
    const table2ColumnLineageResponse = waitForDirectionalColumnLineageResponse(
      page,
      {
        direction: 'Downstream',
        fqn: table2.entityResponseData.fullyQualifiedName,
        upstreamDepth: 0,
        downstreamDepth: 2,
      }
    );
    await page.getByText('Column level').click();
    await table2ColumnLineageResponse;
    await waitForAllLoadersToDisappear(page);

    await expect(
      page.getByRole('button', { name: 'Downstream 0' })
    ).toBeVisible();

    await page.getByRole('button', { name: 'Upstream' }).click();
    await expect(
      page.getByRole('button', { name: 'Upstream 0' })
    ).toBeVisible();
  });

  test('Verify column mode switches direction with directional lineage requests', async ({
    page,
  }) => {
    await table2.visitEntityPage(page);
    await visitLineageTab(page);
    const table2LineageResponse = page.waitForResponse(
      `/api/v1/lineage/getLineageByEntityCount?*`
    );
    await openImpactAnalysisTab(page);
    await table2LineageResponse;

    await updateLineageConfigFromModal(page, {
      upstreamDepth: 2,
      downstreamDepth: 2,
    });
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('button', { name: 'Impact On: Table' }).click();
    const initialColumnResponse = waitForDirectionalColumnLineageResponse(
      page,
      {
        direction: 'Downstream',
        fqn: table2.entityResponseData.fullyQualifiedName,
        upstreamDepth: 0,
        downstreamDepth: 2,
      }
    );
    await page.getByText('Column level').click();
    await initialColumnResponse;
    await waitForAllLoadersToDisappear(page);

    await expect(page.locator('[data-row-key]')).toHaveCount(0);

    const upstreamColumnResponse = waitForDirectionalColumnLineageResponse(
      page,
      {
        direction: 'Upstream',
        fqn: table2.entityResponseData.fullyQualifiedName,
        upstreamDepth: 2,
        downstreamDepth: 0,
      }
    );
    await page.getByRole('button', { name: 'Upstream' }).click();
    await upstreamColumnResponse;
    await waitForAllLoadersToDisappear(page);

    await expect(page.locator('[data-row-key]')).toHaveCount(5);
  });

  test('Verify column level downstream connections', async ({ page }) => {
    await page.getByRole('button', { name: 'Impact On: Table' }).click();
    const columnLineageResponse = waitForDirectionalColumnLineageResponse(
      page,
      {
        direction: 'Downstream',
      }
    );
    await page.getByText('Column level').click();
    await columnLineageResponse;
    await waitForAllLoadersToDisappear(page);

    // Verify columns are visible in Impact Analysis for Downstream
    const fromColumns = [
      {
        rowKey: tableColumns[0] + '->' + table2Columns[0],
        sourceColumn: table.columnsName[0],
        targetColumn: table2.columnsName[0],
      },
      {
        rowKey: tableColumns[0] + '->' + table2Columns[0],
        sourceColumn: table.columnsName[0],
        targetColumn: table2.columnsName[0],
      },
      {
        rowKey: tableColumns[1] + '->' + table2Columns[0],
        sourceColumn: table.columnsName[1],
        targetColumn: table2.columnsName[0],
      },
      {
        rowKey: tableColumns[2] + '->' + table2Columns[0],
        sourceColumn: table.columnsName[2],
        targetColumn: table2.columnsName[0],
      },
      {
        rowKey: tableColumns[3] + '->' + table2Columns[1],
        sourceColumn: table.columnsName[7],
        targetColumn: table2.columnsName[1],
      },
      {
        rowKey: tableColumns[2] + '->' + table2Columns[1],
        sourceColumn: table.columnsName[2],
        targetColumn: table2.columnsName[1],
      },
    ];

    // Verify columns are visible in Impact Analysis for Downstream Topic
    for (const col of fromColumns) {
      // Assert row with column connection
      await expect(
        page.locator(`[data-row-key="${col.rowKey}"]`)
      ).toBeVisible();

      // assert source column
      await expect(
        page
          .locator(`[data-row-key="${col.rowKey}"]`)
          .getByRole('cell', { name: col.sourceColumn })
      ).toBeVisible();

      // assert target column
      await expect(
        page
          .locator(`[data-row-key="${col.rowKey}"]`)
          .getByRole('cell', { name: col.targetColumn })
      ).toBeVisible();
    }
  });

  test('Verify column level upstream connections', async ({ page }) => {
    await table2.visitEntityPage(page);
    await visitLineageTab(page);
    const table2LineageResponse = page.waitForResponse(
      `/api/v1/lineage/getLineageByEntityCount?*`
    );
    await openImpactAnalysisTab(page);
    await table2LineageResponse;
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('button', { name: 'Impact On: Table' }).click();
    const columnLineageResponse = waitForDirectionalColumnLineageResponse(
      page,
      {
        direction: 'Downstream',
        fqn: table2.entityResponseData.fullyQualifiedName,
      }
    );
    await page.getByText('Column level').click();
    await columnLineageResponse;
    await waitForAllLoadersToDisappear(page);

    const upstreamColumnResponse = waitForDirectionalColumnLineageResponse(
      page,
      {
        direction: 'Upstream',
        fqn: table2.entityResponseData.fullyQualifiedName,
      }
    );
    await page.getByRole('button', { name: 'Upstream' }).click();
    await upstreamColumnResponse;
    await waitForAllLoadersToDisappear(page);

    // Verify columns are visible in Impact Analysis for Upstream
    const fromColumns = [
      {
        rowKey: tableColumns[0] + '->' + table2Columns[0],
        sourceColumn: table.columnsName[0],
        targetColumn: table2.columnsName[0],
      },
      {
        rowKey: tableColumns[0] + '->' + table2Columns[0],
        sourceColumn: table.columnsName[0],
        targetColumn: table2.columnsName[0],
      },
      {
        rowKey: tableColumns[1] + '->' + table2Columns[0],
        sourceColumn: table.columnsName[1],
        targetColumn: table2.columnsName[0],
      },
      {
        rowKey: tableColumns[2] + '->' + table2Columns[0],
        sourceColumn: table.columnsName[2],
        targetColumn: table2.columnsName[0],
      },
      {
        rowKey: tableColumns[3] + '->' + table2Columns[1],
        sourceColumn: table.columnsName[7],
        targetColumn: table2.columnsName[1],
      },
      {
        rowKey: tableColumns[2] + '->' + table2Columns[1],
        sourceColumn: table.columnsName[2],
        targetColumn: table2.columnsName[1],
      },
    ];

    // Verify columns are visible in Impact Analysis for Upstream Topic
    for (const col of fromColumns) {
      // Assert row with column connection
      await expect(
        page.locator(`[data-row-key="${col.rowKey}"]`)
      ).toBeVisible();

      // assert source column
      await expect(
        page
          .locator(`[data-row-key="${col.rowKey}"]`)
          .getByRole('cell', { name: col.sourceColumn })
      ).toBeVisible();

      // assert target column
      await expect(
        page
          .locator(`[data-row-key="${col.rowKey}"]`)
          .getByRole('cell', { name: col.targetColumn })
      ).toBeVisible();
    }
  });

  test('Verify entity popover card appears on asset hover in lineage-card-table', async ({
    page,
  }) => {
    // Verify the lineage-card-table is present
    const lineageCardTable = page.getByTestId('lineage-card-table');
    await expect(lineageCardTable).toBeVisible();

    // Find the first asset link in the table
    const firstAssetLink = lineageCardTable
      .locator('tbody tr')
      .first()
      .getByRole('cell')
      .first()
      .getByRole('link');

    await expect(firstAssetLink).toBeVisible();

    // Hover over the asset name to trigger the EntityPopOverCard
    await firstAssetLink.hover();

    // Wait for the popover content to appear using the specific testid
    // The ExploreSearchCard has testid pattern: table-data-card_<fqn>
    const entityPopoverCard = page.getByTestId(/^table-data-card_/);
    await expect(entityPopoverCard).toBeVisible();

    // Verify the popover contains expected entity information
    await expect(
      entityPopoverCard.getByTestId('entity-header-display-name')
    ).toBeVisible();
  });

  test('Verify search functionality filters table results', async ({
    page,
  }) => {
    const searchInput = page.getByTestId('searchbar');
    await expect(searchInput).toBeVisible();

    const initialRowCount = await page.locator('[data-row-key]').count();

    await searchInput.fill(table2.entityResponseData.displayName ?? '');

    await waitForAllLoadersToDisappear(page);

    await expect(
      page.locator('[data-row-key]').count()
    ).resolves.toBeLessThanOrEqual(initialRowCount);

    await expect(
      page.locator(
        `[data-row-key="${table2.entityResponseData.fullyQualifiedName}"]`
      )
    ).toBeVisible();

    await searchInput.clear();
    await waitForAllLoadersToDisappear(page);
  });

  test('Verify depth configuration changes impact analysis results', async ({
    page,
  }) => {
    await updateLineageConfigFromModal(page, {
      upstreamDepth: 1,
      downstreamDepth: 1,
    });
    await waitForAllLoadersToDisappear(page);

    const depth1Count = await page.locator('[data-row-key]').count();

    await updateLineageConfigFromModal(page, {
      upstreamDepth: 1,
      downstreamDepth: 3,
    });
    await waitForAllLoadersToDisappear(page);

    const depth3Count = await page.locator('[data-row-key]').count();
    expect(depth3Count).toBeGreaterThanOrEqual(depth1Count);
  });

  test('Verify service type filter for Asset level impact analysis', async ({
    page,
  }) => {
    await page.getByTestId('filters-button').click();
    await page.getByTestId('search-dropdown-Service Type').click();

    const serviceTypeOption = page.getByTitle('mlflow', { exact: true });
    await expect(serviceTypeOption).toBeVisible();

    await serviceTypeOption.click();
    const filterResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/lineage/getLineageByEntityCount') &&
        response.request().method() === 'GET'
    );
    await page.getByRole('button', { name: 'Update' }).click();
    await filterResponse;
    await waitForAllLoadersToDisappear(page);

    await expect(page.locator('[data-row-key]')).toHaveCount(1);

    await expect(
      page.locator(
        `[data-row-key="${mlModel.entityResponseData.fullyQualifiedName}"]`
      )
    ).toBeVisible();

    await page.getByRole('button', { name: 'Clear All' }).click();
  });

  test('Verify tag filter for column level impact analysis', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Impact On: Table' }).click();
    const columnLineageResponse = waitForDirectionalColumnLineageResponse(
      page,
      {
        direction: 'Downstream',
      }
    );
    await page.getByText('Column level').click();
    await columnLineageResponse;
    await waitForAllLoadersToDisappear(page);

    const initialRowCount = await page.locator('[data-row-key]').count();

    await page.getByTestId('filters-button').click();
    await page.getByTestId('search-dropdown-Tag').click();

    await waitForAllLoadersToDisappear(page);

    const firstTag = page.getByTestId(
      EntityDataClass.tag1.responseData.fullyQualifiedName?.toLowerCase()
    );
    await firstTag.click();

    const filterResponse = waitForDirectionalColumnLineageResponse(page, {
      direction: 'Downstream',
      columnFilterIncludes: 'tag:',
    });
    await page.getByRole('button', { name: 'Update' }).click();
    await filterResponse;
    await waitForAllLoadersToDisappear(page);

    const filteredRowCount = await page.locator('[data-row-key]').count();
    expect(filteredRowCount).toBeLessThanOrEqual(initialRowCount);
  });

  test('Verify column search in column level impact analysis', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Impact On: Table' }).click();
    const columnLineageResponse = waitForDirectionalColumnLineageResponse(
      page,
      {
        direction: 'Downstream',
      }
    );
    await page.getByText('Column level').click();
    await columnLineageResponse;
    await waitForAllLoadersToDisappear(page);

    // eslint-disable-next-line playwright/no-wait-for-timeout -- column level lineage data takes time to reflect due to UI processing
    await page.waitForTimeout(1000);

    const searchInput = page.getByTestId('searchbar');
    await expect(searchInput).toBeVisible();

    const columnName = table.columnsName[0];
    await searchInput.fill(columnName);

    await waitForAllLoadersToDisappear(page);
    // eslint-disable-next-line playwright/no-wait-for-timeout -- search filtering needs time to complete
    await page.waitForTimeout(500);

    const rowsWithColumn = page.locator(
      `[data-row-key*="${columnName}"], tbody tr:has-text("${columnName}")`
    );
    await expect(rowsWithColumn.first()).toBeVisible();

    await searchInput.clear();
    await waitForAllLoadersToDisappear(page);
  });

  test('Verify switching between table and column level clears filters', async ({
    page,
  }) => {
    await page.getByTestId('filters-button').click();
    await page.getByTestId('search-dropdown-Tier').click();

    await page
      .getByTitle(
        EntityDataClass.tierTag1.responseData.fullyQualifiedName.toLowerCase()
      )
      .click();

    await page.getByRole('button', { name: 'Update' }).click();
    await waitForAllLoadersToDisappear(page);

    await expect(page.locator('[data-row-key]')).toHaveCount(1);

    await page.getByRole('button', { name: 'Impact On: Table' }).click();
    const columnLineageResponse = waitForDirectionalColumnLineageResponse(
      page,
      {
        direction: 'Downstream',
      }
    );
    await page.getByText('Column level').click();
    await columnLineageResponse;
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('button', { name: 'Impact On: Column' }).click();
    const tableLineageResponse = page.waitForResponse(
      `/api/v1/lineage/getLineageByEntityCount?**`
    );
    await page.getByText('Asset level').click();
    await tableLineageResponse;
    await waitForAllLoadersToDisappear(page);

    const rowCount = await page.locator('[data-row-key]').count();
    expect(rowCount).toBeGreaterThan(1);
  });

  test('Verify node depth display in table level impact analysis', async ({
    page,
  }) => {
    await updateLineageConfigFromModal(page, {
      upstreamDepth: 2,
      downstreamDepth: 2,
    });
    await waitForAllLoadersToDisappear(page);

    const nodeDepthCells = page.locator('tbody tr td:nth-child(2)');
    const firstDepthCell = nodeDepthCells.first();

    await expect(firstDepthCell).toBeVisible();
    const depthText = await firstDepthCell.textContent();
    expect(depthText).toMatch(/^\d+$/);
  });

  test('Verify glossary term filter for column level impact analysis', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Impact On: Table' }).click();
    const columnLineageResponse = page.waitForResponse((response) =>
      response.url().includes('/api/v1/lineage/getLineage/Downstream')
    );
    await page.getByText('Column level').click();
    await columnLineageResponse;
    await waitForAllLoadersToDisappear(page);

    await page.getByTestId('filters-button').click();
    await page.getByTestId('search-dropdown-Glossary Terms').click();
    const glossaryOptions = page
      .getByTestId('drop-down-menu')
      .getByRole('menuitem');
    await expect(glossaryOptions).toHaveCount(1);
    await glossaryOptions.first().click();

    const filterResponse = page.waitForResponse((response) => {
      if (!response.url().includes('/api/v1/lineage/getLineage/Downstream')) {
        return false;
      }

      const url = new URL(response.url());

      return (
        url.searchParams.get('column_filter')?.includes('glossary:') ?? false
      );
    });
    await page.getByRole('button', { name: 'Update' }).click();
    await filterResponse;
    await waitForAllLoadersToDisappear(page);

    await expect(
      page.locator(`[data-row-key="${tableColumns[0]}->${table2Columns[0]}"]`)
    ).toBeVisible();
  });

  test('Verify table columns visibility and content', async ({ page }) => {
    const expectedColumns = ['Name', 'Node Depth', 'Owners'];

    for (const columnName of expectedColumns) {
      const columnHeader = page
        .locator('thead th')
        .filter({ hasText: columnName });
      await expect(columnHeader).toBeVisible();
    }

    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow).toBeVisible();

    const nameCell = firstRow.locator('td').first();
    await expect(nameCell.getByRole('link')).toBeVisible();
  });

  test('Verify column level table has correct columns', async ({ page }) => {
    await page.getByRole('button', { name: 'Impact On: Table' }).click();
    const columnLineageResponse = waitForDirectionalColumnLineageResponse(
      page,
      {
        direction: 'Downstream',
      }
    );
    await page.getByText('Column level').click();
    await columnLineageResponse;
    await waitForAllLoadersToDisappear(page);

    const expectedColumns = [
      'Source',
      'Source Columns',
      'Impacted',
      'Impacted Columns',
      'Node Depth',
    ];

    for (const columnName of expectedColumns) {
      const columnHeader = page.getByRole('columnheader', {
        name: columnName,
        exact: true,
      });
      await expect(columnHeader).toBeVisible();
    }
  });

  test('Verify upstream downstream toggle persists pagination', async ({
    page,
  }) => {
    await updateLineageConfigFromModal(page, {
      upstreamDepth: 2,
      downstreamDepth: 2,
    });
    await waitForAllLoadersToDisappear(page);

    const downstreamCount = await page.locator('[data-row-key]').count();

    await page.getByRole('button', { name: 'Upstream' }).click();
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('button', { name: 'Downstream' }).click();
    await waitForAllLoadersToDisappear(page);

    const finalCount = await page.locator('[data-row-key]').count();
    expect(finalCount).toBe(downstreamCount);
  });
});
