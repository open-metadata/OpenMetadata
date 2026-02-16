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
import { expect } from '@playwright/test';
import { get } from 'lodash';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../../support/entity/DashboardDataModelClass';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { MlModelClass } from '../../support/entity/MlModelClass';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  connectEdgeBetweenNodesViaAPI,
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

test.describe('Impact Analysis', () => {
  let tableColumns: string[] = [];
  let table2Columns: string[] = [];

  test.beforeAll(async ({ browser }) => {
    test.slow(true);
    const { apiContext, afterAction } = await performAdminLogin(browser);

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
      (col: { fullyQualifiedName: string }) => col.fullyQualifiedName
    );
    table2Columns = get(table2, 'entityResponseData.columns', []).map(
      (col: { fullyQualifiedName: string }) => col.fullyQualifiedName
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

  test.beforeEach(
    'prepare for test and navigate to Impact Analysis',
    async ({ page }) => {
      await redirectToHomePage(page);
      await table.visitEntityPage(page);
      await visitLineageTab(page);
      const lineageResponse = page.waitForResponse(
        `/api/v1/lineage/getLineageByEntityCount?*`
      );
      const impactAnalysisResponse = page.waitForResponse(
        `/api/v1/lineage/getPaginationInfo?*`
      );
      await page.getByRole('button', { name: 'Impact Analysis' }).click();
      await lineageResponse;
      await impactAnalysisResponse;
      await waitForAllLoadersToDisappear(page);
    }
  );

  test('validate upstream/ downstream counts', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: 'Downstream 5' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Upstream 1' })
    ).toBeVisible();
  });

  test('Verify Downstream connections', async ({ page }) => {
    const tableDownstreamNodes: string[] = [
      pipeline.entityResponseData.displayName,
      dataModel.entityResponseData.displayName,
      topic.entityResponseData.displayName,
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
    const impactAnalysisResponse = page.waitForResponse(
      `/api/v1/lineage/getPaginationInfo?*`
    );
    await page.getByRole('button', { name: 'Impact Analysis' }).click();
    await dashboardLineageResponse;
    await impactAnalysisResponse;

    await updateLineageConfigFromModal(page, {
      upstreamDepth: 2,
      downstreamDepth: 2,
    });

    await waitForAllLoadersToDisappear(page);

    const dashboardDownstreamNodes: string[] = [
      dataModel.entityResponseData.displayName,
      table.entityResponseData.displayName ?? table.entity.displayName,
      pipeline.entityResponseData.displayName,
      mlModel.entityResponseData.displayName,
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
    const impactAnalysisResponse = page.waitForResponse(
      `/api/v1/lineage/getPaginationInfo?*`
    );
    await page.getByRole('button', { name: 'Impact Analysis' }).click();
    await topicLineageResponse;
    await impactAnalysisResponse;

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
    await page.getByRole('button', { name: 'Filters' }).click();
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

  // we are not getting domain in aggregation response that's why this test is marked as fixme
  test.fixme(
    'verify domain for Asset level impact analysis',
    async ({ page }) => {
      await page.getByRole('button', { name: 'Filters' }).click();
      await page.getByTestId('search-dropdown-Domains').click();

      await expect(
        page.getByTitle(EntityDataClass.domain1.responseData.name)
      ).toBeVisible();

      await page.getByTitle(EntityDataClass.domain1.responseData.name).click();
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
    }
  );

  test('verify tier for Asset level impact analysis', async ({ page }) => {
    await page.getByRole('button', { name: 'Filters' }).click();
    await page.getByTestId('search-dropdown-Tier').click();

    await expect(
      page.getByTitle(EntityDataClass.tierTag1.responseData.displayName)
    ).toBeVisible();

    await page
      .getByTitle(EntityDataClass.tierTag1.responseData.displayName)
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
    const columnLineageResponse = page.waitForResponse(
      `/api/v1/lineage/getLineage?**`
    );
    await page.getByText('Column level').click();
    await columnLineageResponse;
    await waitForAllLoadersToDisappear(page);

    // Column level data take time to reflect due to UI processing
    // hence had to add static wait
    await page.waitForTimeout(1000);

    await expect(
      page.getByRole('button', { name: 'Downstream 5' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Upstream 0' })
    ).toBeVisible();

    await table2.visitEntityPage(page);
    await visitLineageTab(page);
    const table2LineageResponse = page.waitForResponse(
      `/api/v1/lineage/getLineageByEntityCount?*`
    );
    const impactAnalysisResponse = page.waitForResponse(
      `/api/v1/lineage/getPaginationInfo?*`
    );
    await page.getByRole('button', { name: 'Impact Analysis' }).click();
    await table2LineageResponse;
    await impactAnalysisResponse;

    await updateLineageConfigFromModal(page, {
      upstreamDepth: 2,
      downstreamDepth: 2,
    });
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('button', { name: 'Impact On: Table' }).click();

    const table2ColumnLineageResponse = page.waitForResponse(
      `/api/v1/lineage/getLineage?fqn=${table2.entityResponseData.fullyQualifiedName}&type=table&upstreamDepth=2&downstreamDepth=2&includeDeleted=false&size=50`
    );
    await page.getByText('Column level').click();
    await table2ColumnLineageResponse;
    await waitForAllLoadersToDisappear(page);

    // Column level data take time to reflect due to UI processing
    // hence had to add static wait
    await page.waitForTimeout(1000);

    await expect(
      page.getByRole('button', { name: 'Downstream 0' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Upstream 5' })
    ).toBeVisible();
  });

  test('Verify column level downstream connections', async ({ page }) => {
    await page.getByRole('button', { name: 'Impact On: Table' }).click();
    const columnLineageResponse = page.waitForResponse(
      `/api/v1/lineage/getLineage?**`
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
    const impactAnalysisResponse = page.waitForResponse(
      `/api/v1/lineage/getPaginationInfo?*`
    );
    await page.getByRole('button', { name: 'Impact Analysis' }).click();
    await table2LineageResponse;
    await impactAnalysisResponse;
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('button', { name: 'Impact On: Table' }).click();
    const columnLineageResponse = page.waitForResponse(
      `/api/v1/lineage/getLineage?**`
    );
    await page.getByText('Column level').click();
    await columnLineageResponse;
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('button', { name: 'Upstream' }).click();

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
});
