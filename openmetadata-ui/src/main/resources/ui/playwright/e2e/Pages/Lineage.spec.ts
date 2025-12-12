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
import test, { expect } from '@playwright/test';
import { get } from 'lodash';
import { SidebarItem } from '../../constant/sidebar';
import { ApiEndpointClass } from '../../support/entity/ApiEndpointClass';
import { ContainerClass } from '../../support/entity/ContainerClass';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { MetricClass } from '../../support/entity/MetricClass';
import { MlModelClass } from '../../support/entity/MlModelClass';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { SearchIndexClass } from '../../support/entity/SearchIndexClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import {
  createNewPage,
  getApiContext,
  redirectToHomePage,
  uuid,
} from '../../utils/common';
import {
  activateColumnLayer,
  addColumnLineage,
  addPipelineBetweenNodes,
  applyPipelineFromModal,
  connectEdgeBetweenNodes,
  deleteEdge,
  deleteNode,
  editLineage,
  editLineageClick,
  performZoomOut,
  rearrangeNodes,
  removeColumnLineage,
  setupEntitiesForLineage,
  verifyColumnLayerInactive,
  verifyColumnLineageInCSV,
  verifyExportLineageCSV,
  verifyExportLineagePNG,
  verifyLineageConfig,
  verifyNodePresent,
  visitLineageTab,
} from '../../utils/lineage';
import { sidebarClick } from '../../utils/sidebar';

// use the admin user to login
test.use({
  storageState: 'playwright/.auth/admin.json',
});

const entities = [
  TableClass,
  DashboardClass,
  TopicClass,
  MlModelClass,
  ContainerClass,
  SearchIndexClass,
  ApiEndpointClass,
  MetricClass,
] as const;

const pipeline = new PipelineClass();

test.beforeAll('Setup pre-requests', async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await pipeline.create(apiContext);
  await afterAction();
});

test.afterAll('Cleanup', async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await pipeline.delete(apiContext);
  await afterAction();
});

for (const EntityClass of entities) {
  const defaultEntity = new EntityClass();

  test(`Lineage creation from ${defaultEntity.getType()} entity`, async ({
    browser,
  }) => {
    // 5 minutes to avoid test timeout happening some times in AUTs
    test.setTimeout(300_000);

    const { page } = await createNewPage(browser);
    const { currentEntity, entities, cleanup } = await setupEntitiesForLineage(
      page,
      defaultEntity
    );

    try {
      await test.step('Should create lineage for the entity', async () => {
        await redirectToHomePage(page);
        await currentEntity.visitEntityPage(page);

        await visitLineageTab(page);

        await verifyColumnLayerInactive(page);
        // enable fullscreen
        await page.getByTestId('full-screen').click();
        await editLineage(page);
        await performZoomOut(page);
        for (const entity of entities) {
          await connectEdgeBetweenNodes(page, currentEntity, entity);
          await rearrangeNodes(page);
        }

        await page.reload();
        const lineageRes = page.waitForResponse('/api/v1/lineage/getLineage?*');
        await lineageRes;
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="edit-lineage"]', {
          state: 'visible',
        });
        await editLineageClick(page);
        await page.getByTestId('fit-screen').click();
        await page.getByRole('menuitem', { name: 'Fit to screen' }).click();

        for (const entity of entities) {
          await verifyNodePresent(page, entity);
        }
        await editLineageClick(page);

        // Check the Entity Drawer
        await performZoomOut(page);

        for (const entity of entities) {
          const toNodeFqn = get(
            entity,
            'entityResponseData.fullyQualifiedName'
          );
          await page
            .locator(`[data-testid="lineage-node-${toNodeFqn}"]`)
            .click();

          await expect(
            page
              .locator('.lineage-entity-panel')
              .getByTestId('entity-header-title')
          ).toHaveText(get(entity, 'entityResponseData.displayName'));

          await page.getByTestId('drawer-close-icon').click();

          // Panel should not be visible after closing it
          await expect(page.locator('.lineage-entity-panel')).not.toBeVisible();
        }
      });

      await test.step('Should create pipeline between entities', async () => {
        await editLineage(page);
        await page.getByTestId('fit-screen').click();
        await page.getByRole('menuitem', { name: 'Fit to screen' }).click();
        await page.waitForTimeout(500); // wait for the nodes to settle

        const fromNodeFqn = get(
          currentEntity,
          'entityResponseData.fullyQualifiedName'
        );
        await page
          .locator(`[data-testid="lineage-node-${fromNodeFqn}"]`)
          .click();

        for (const entity of entities) {
          await applyPipelineFromModal(page, currentEntity, entity, pipeline);
        }
      });

      await test.step('Verify Lineage Export CSV', async () => {
        await editLineageClick(page);
        await verifyExportLineageCSV(page, currentEntity, entities, pipeline);
      });

      await test.step('Verify Lineage Export PNG', async () => {
        await verifyExportLineagePNG(page);
      });

      await test.step('Remove lineage between nodes for the entity', async () => {
        await editLineage(page);
        await performZoomOut(page);

        for (const entity of entities) {
          await deleteEdge(page, currentEntity, entity);
        }
      });

      await test.step('Verify Lineage Config', async () => {
        await editLineageClick(page);
        await verifyLineageConfig(page);
      });
    } finally {
      await cleanup();
    }
  });
}

test('Verify column lineage between tables', async ({ browser }) => {
  const { page } = await createNewPage(browser);
  const { apiContext, afterAction } = await getApiContext(page);
  const table1 = new TableClass();
  const table2 = new TableClass();

  await Promise.all([table1.create(apiContext), table2.create(apiContext)]);

  const sourceTableFqn = get(table1, 'entityResponseData.fullyQualifiedName');
  const sourceCol = `${sourceTableFqn}.${get(
    table1,
    'entityResponseData.columns[0].name'
  )}`;

  const targetTableFqn = get(table2, 'entityResponseData.fullyQualifiedName');
  const targetCol = `${targetTableFqn}.${get(
    table2,
    'entityResponseData.columns[0].name'
  )}`;

  await addPipelineBetweenNodes(page, table1, table2);
  await activateColumnLayer(page);

  // Add column lineage
  await addColumnLineage(page, sourceCol, targetCol);
  await editLineageClick(page);

  await removeColumnLineage(page, sourceCol, targetCol);
  await editLineageClick(page);

  await deleteNode(page, table2);
  await table1.delete(apiContext);
  await table2.delete(apiContext);

  await afterAction();
});

test('Verify column lineage between table and topic', async ({ browser }) => {
  test.slow();

  const { page } = await createNewPage(browser);
  const { apiContext, afterAction } = await getApiContext(page);
  const table = new TableClass();
  const topic = new TopicClass();
  await Promise.all([table.create(apiContext), topic.create(apiContext)]);

  const tableServiceFqn = get(
    table,
    'entityResponseData.service.fullyQualifiedName'
  );

  const topicServiceFqn = get(
    topic,
    'entityResponseData.service.fullyQualifiedName'
  );

  const sourceTableFqn = get(table, 'entityResponseData.fullyQualifiedName');
  const sourceCol = `${sourceTableFqn}.${get(
    table,
    'entityResponseData.columns[0].name'
  )}`;
  const targetCol = get(
    topic,
    'entityResponseData.messageSchema.schemaFields[0].children[0].fullyQualifiedName'
  );

  await addPipelineBetweenNodes(page, table, topic);
  await activateColumnLayer(page);

  // Add column lineage
  await addColumnLineage(page, sourceCol, targetCol);

  // Verify column lineage
  await redirectToHomePage(page);
  await table.visitEntityPage(page);
  await visitLineageTab(page);
  await page.waitForLoadState('networkidle');
  await verifyColumnLineageInCSV(page, table, topic, sourceCol, targetCol);

  // Verify relation in platform lineage
  await sidebarClick(page, SidebarItem.LINEAGE);

  const tableServiceNode = page.locator(
    `[data-testid="lineage-node-${tableServiceFqn}"]`
  );
  const topicServiceNode = page.locator(
    `[data-testid="lineage-node-${topicServiceFqn}"]`
  );

  await expect(tableServiceNode).toBeVisible();
  await expect(topicServiceNode).toBeVisible();

  await table.visitEntityPage(page);
  await visitLineageTab(page);
  await activateColumnLayer(page);
  await editLineageClick(page);

  await removeColumnLineage(page, sourceCol, targetCol);
  await editLineageClick(page);

  await deleteNode(page, topic);
  await table.delete(apiContext);
  await topic.delete(apiContext);

  await afterAction();
});

test('Verify column lineage between topic and api endpoint', async ({
  browser,
}) => {
  const { page } = await createNewPage(browser);
  const { apiContext, afterAction } = await getApiContext(page);
  const topic = new TopicClass();
  const apiEndpoint = new ApiEndpointClass();

  await Promise.all([topic.create(apiContext), apiEndpoint.create(apiContext)]);

  const sourceCol = get(
    topic,
    'entityResponseData.messageSchema.schemaFields[0].children[0].fullyQualifiedName'
  );

  const targetCol = get(
    apiEndpoint,
    'entityResponseData.responseSchema.schemaFields[0].children[1].fullyQualifiedName'
  );

  await addPipelineBetweenNodes(page, topic, apiEndpoint);
  await activateColumnLayer(page);

  // Add column lineage
  await addColumnLineage(page, sourceCol, targetCol);
  await editLineageClick(page);

  await removeColumnLineage(page, sourceCol, targetCol);
  await editLineageClick(page);

  await deleteNode(page, apiEndpoint);
  await topic.delete(apiContext);
  await apiEndpoint.delete(apiContext);

  await afterAction();
});

test('Verify column lineage between table and api endpoint', async ({
  browser,
}) => {
  const { page } = await createNewPage(browser);
  const { apiContext, afterAction } = await getApiContext(page);
  const table = new TableClass();
  const apiEndpoint = new ApiEndpointClass();
  await Promise.all([table.create(apiContext), apiEndpoint.create(apiContext)]);

  const sourceTableFqn = get(table, 'entityResponseData.fullyQualifiedName');
  const sourceCol = `${sourceTableFqn}.${get(
    table,
    'entityResponseData.columns[0].name'
  )}`;
  const targetCol = get(
    apiEndpoint,
    'entityResponseData.responseSchema.schemaFields[0].children[0].fullyQualifiedName'
  );

  await addPipelineBetweenNodes(page, table, apiEndpoint);
  await activateColumnLayer(page);

  // Add column lineage
  await addColumnLineage(page, sourceCol, targetCol);
  await editLineageClick(page);
  await removeColumnLineage(page, sourceCol, targetCol);
  await editLineageClick(page);

  await deleteNode(page, apiEndpoint);
  await table.delete(apiContext);
  await apiEndpoint.delete(apiContext);

  await afterAction();
});

test('Verify function data in edge drawer', async ({ browser }) => {
  test.slow();

  const { page } = await createNewPage(browser);
  const { apiContext, afterAction } = await getApiContext(page);
  const table1 = new TableClass();
  const table2 = new TableClass();

  try {
    await Promise.all([table1.create(apiContext), table2.create(apiContext)]);
    const sourceTableFqn = get(table1, 'entityResponseData.fullyQualifiedName');
    const sourceColName = `${sourceTableFqn}.${get(
      table1,
      'entityResponseData.columns[0].name'
    )}`;

    const targetTableFqn = get(table2, 'entityResponseData.fullyQualifiedName');
    const targetColName = `${targetTableFqn}.${get(
      table2,
      'entityResponseData.columns[0].name'
    )}`;

    await addPipelineBetweenNodes(page, table1, table2);
    await activateColumnLayer(page);
    await addColumnLineage(page, sourceColName, targetColName);

    const lineageReq = page.waitForResponse('/api/v1/lineage/getLineage?*');
    await page.reload();
    await lineageReq;

    await activateColumnLayer(page);

    await page
      .locator(
        `[data-testid="column-edge-${btoa(sourceColName)}-${btoa(
          targetColName
        )}"]`
      )
      .dispatchEvent('click');

    await page.waitForSelector('.sql-function-section', {
      state: 'visible',
    });

    await page
      .locator('.sql-function-section')
      .getByTestId('edit-button')
      .click();
    await page.getByTestId('sql-function-input').fill('count');
    const saveRes = page.waitForResponse('/api/v1/lineage');
    await page.getByTestId('save').click();
    await saveRes;

    await expect(page.getByTestId('sql-function')).toContainText('count');

    const lineageReq1 = page.waitForResponse('/api/v1/lineage/getLineage?*');
    await page.reload();
    await lineageReq1;

    await page.waitForLoadState('networkidle');

    await activateColumnLayer(page);
    await page
      .locator(
        `[data-testid="column-edge-${btoa(sourceColName)}-${btoa(
          targetColName
        )}"]`
      )
      .dispatchEvent('click');

    await page.locator('.edge-info-drawer').isVisible();

    await expect(page.locator('[data-testid="sql-function"]')).toContainText(
      'count'
    );
  } finally {
    await Promise.all([table1.delete(apiContext), table2.delete(apiContext)]);
    await afterAction();
  }
});

test('Verify table search with special characters as handled', async ({
  browser,
}) => {
  const { page } = await createNewPage(browser);
  const { apiContext, afterAction } = await getApiContext(page);

  // Create a table with '/' in the name to test encoding functionality
  const tableNameWithSlash = `pw-table-with/slash-${uuid()}`;
  const table = new TableClass(tableNameWithSlash);

  await table.create(apiContext);

  const db = table.databaseResponseData.name;
  try {
    await sidebarClick(page, SidebarItem.LINEAGE);

    await page.waitForSelector('[data-testid="search-entity-select"]');
    await page.click('[data-testid="search-entity-select"]');

    await page.fill(
      '[data-testid="search-entity-select"] .ant-select-selection-search-input',
      table.entity.name
    );

    await page.waitForRequest(
      (req) =>
        req.url().includes('/api/v1/search/query') &&
        req.url().includes('deleted=false')
    );

    await page.waitForSelector('.ant-select-dropdown');

    const nodeFqn = get(table, 'entityResponseData.fullyQualifiedName');
    const dbFqn = get(table, 'entityResponseData.database.fullyQualifiedName');
    await page
      .locator(`[data-testid="node-suggestion-${nodeFqn}"]`)
      .dispatchEvent('click');

    await page.waitForResponse('/api/v1/lineage/getLineage?*');

    await expect(page.locator('[data-testid="lineage-details"]')).toBeVisible();

    await expect(
      page.locator(`[data-testid="lineage-node-${nodeFqn}"]`)
    ).toBeVisible();

    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.LINEAGE);
    await page.waitForSelector('[data-testid="search-entity-select"]');
    await page.click('[data-testid="search-entity-select"]');

    await page.fill(
      '[data-testid="search-entity-select"] .ant-select-selection-search-input',
      db
    );
    await page.waitForSelector(`[data-testid="node-suggestion-${dbFqn}"]`);
    await page
      .locator(`[data-testid="node-suggestion-${dbFqn}"]`)
      .dispatchEvent('click');
    await page.waitForResponse('/api/v1/lineage/getLineage?*');

    await expect(page.locator('[data-testid="lineage-details"]')).toBeVisible();

    await page.locator(`[data-testid="lineage-node-${dbFqn}"]`).click();
    await page.waitForLoadState('networkidle');

    await expect(
      page.locator('.lineage-entity-panel').getByTestId('entity-header-title')
    ).toBeVisible();
  } finally {
    // Cleanup
    await table.delete(apiContext);
    await afterAction();
  }
});

test('Verify cycle lineage should be handled properly', async ({ browser }) => {
  test.slow();

  const { page } = await createNewPage(browser);
  const { apiContext, afterAction } = await getApiContext(page);
  const table = new TableClass();
  const topic = new TopicClass();
  const dashboard = new DashboardClass();

  try {
    await Promise.all([
      table.create(apiContext),
      topic.create(apiContext),
      dashboard.create(apiContext),
    ]);

    const tableFqn = get(table, 'entityResponseData.fullyQualifiedName');
    const topicFqn = get(topic, 'entityResponseData.fullyQualifiedName');
    const dashboardFqn = get(
      dashboard,
      'entityResponseData.fullyQualifiedName'
    );

    await redirectToHomePage(page);
    await table.visitEntityPage(page);
    await visitLineageTab(page);
    await page.getByTestId('full-screen').click();
    await editLineage(page);
    await performZoomOut(page);

    // connect table to topic
    await connectEdgeBetweenNodes(page, table, topic);
    await rearrangeNodes(page);

    // connect topic to dashboard
    await connectEdgeBetweenNodes(page, topic, dashboard);
    await rearrangeNodes(page);

    // connect dashboard to table
    await connectEdgeBetweenNodes(page, dashboard, table);
    await rearrangeNodes(page);

    await page.reload();
    await page.waitForLoadState('networkidle');
    await performZoomOut(page);

    await expect(page.getByTestId(`lineage-node-${tableFqn}`)).toBeVisible();
    await expect(page.getByTestId(`lineage-node-${topicFqn}`)).toBeVisible();
    await expect(
      page.getByTestId(`lineage-node-${dashboardFqn}`)
    ).toBeVisible();

    // Collapse the cycle dashboard lineage downstreamNodeHandler
    await page
      .getByTestId(`lineage-node-${dashboardFqn}`)
      .getByTestId('downstream-collapse-handle')
      .click();

    await expect(
      page.getByTestId(`edge-${dashboardFqn}-${tableFqn}`)
    ).not.toBeVisible();

    await expect(page.getByTestId(`lineage-node-${tableFqn}`)).toBeVisible();
    await expect(page.getByTestId(`lineage-node-${topicFqn}`)).toBeVisible();
    await expect(
      page.getByTestId(`lineage-node-${dashboardFqn}`)
    ).toBeVisible();

    await expect(
      page
        .getByTestId(`lineage-node-${tableFqn}`)
        .getByTestId('upstream-collapse-handle')
    ).not.toBeVisible();

    await expect(
      page.getByTestId(`lineage-node-${dashboardFqn}`).getByTestId('plus-icon')
    ).toBeVisible();

    // Reclick the plus icon to expand the cycle dashboard lineage downstreamNodeHandler
    const downstreamResponse = page.waitForResponse(
      `/api/v1/lineage/getLineage/Downstream?fqn=${dashboardFqn}&type=dashboard**`
    );
    await page
      .getByTestId(`lineage-node-${dashboardFqn}`)
      .getByTestId('plus-icon')
      .click();

    await downstreamResponse;

    await expect(
      page
        .getByTestId(`lineage-node-${tableFqn}`)
        .getByTestId('upstream-collapse-handle')
        .getByTestId('minus-icon')
    ).toBeVisible();

    // Click the Upstream Node to expand the cycle dashboard lineage
    await page
      .getByTestId(`lineage-node-${dashboardFqn}`)
      .getByTestId('upstream-collapse-handle')
      .click();

    await expect(page.getByTestId(`lineage-node-${tableFqn}`)).toBeVisible();
    await expect(
      page.getByTestId(`lineage-node-${dashboardFqn}`)
    ).toBeVisible();
    await expect(
      page.getByTestId(`lineage-node-${topicFqn}`)
    ).not.toBeVisible();

    await expect(
      page.getByTestId(`lineage-node-${dashboardFqn}`).getByTestId('plus-icon')
    ).toBeVisible();

    // Reclick the plus icon to expand the cycle dashboard lineage upstreamNodeHandler
    const upStreamResponse2 = page.waitForResponse(
      `/api/v1/lineage/getLineage/Upstream?fqn=${dashboardFqn}&type=dashboard**`
    );
    await page
      .getByTestId(`lineage-node-${dashboardFqn}`)
      .getByTestId('plus-icon')
      .click();
    await upStreamResponse2;

    await expect(page.getByTestId(`lineage-node-${tableFqn}`)).toBeVisible();
    await expect(
      page.getByTestId(`lineage-node-${dashboardFqn}`)
    ).toBeVisible();
    await expect(page.getByTestId(`lineage-node-${topicFqn}`)).toBeVisible();

    // Collapse the Node from the Parent Cycle Node
    await page
      .getByTestId(`lineage-node-${topicFqn}`)
      .getByTestId('downstream-collapse-handle')
      .click();

    await expect(page.getByTestId(`lineage-node-${tableFqn}`)).toBeVisible();
    await expect(page.getByTestId(`lineage-node-${topicFqn}`)).toBeVisible();
    await expect(
      page.getByTestId(`lineage-node-${dashboardFqn}`)
    ).toBeVisible();
  } finally {
    await Promise.all([
      table.delete(apiContext),
      topic.delete(apiContext),
      dashboard.delete(apiContext),
    ]);
    await afterAction();
  }
});

test.describe.serial('Test pagination in column level lineage', () => {
  const generateColumnsWithNames = (count: number) => {
    const columns = [];
    for (let i = 0; i < count; i++) {
      columns.push({
        name: `column_${i}_${uuid()}`,
        dataType: 'VARCHAR',
        dataLength: 100,
        dataTypeDisplay: 'varchar',
        description: `Test column ${i} for pagination`,
      });
    }

    return columns;
  };

  const table1Columns = generateColumnsWithNames(11);
  const table2Columns = generateColumnsWithNames(12);

  const table1 = new TableClass();
  const table2 = new TableClass();

  let table1Fqn: string;
  let table2Fqn: string;

  test.beforeAll(async ({ browser }) => {
    const { page } = await createNewPage(browser);
    const { apiContext, afterAction } = await getApiContext(page);

    table1.entity.columns = table1Columns;
    table2.entity.columns = table2Columns;

    await Promise.all([table1.create(apiContext), table2.create(apiContext)]);

    table1Fqn = get(table1, 'entityResponseData.fullyQualifiedName');
    table2Fqn = get(table2, 'entityResponseData.fullyQualifiedName');

    await addPipelineBetweenNodes(page, table1, table2);

    await activateColumnLayer(page);

    await page.waitForSelector(
      `[data-testid="column-${table1Fqn}.${table1Columns[0].name}"]`,
      {
        state: 'visible',
      }
    );

    const table1Node = page.locator(
      `[data-testid="lineage-node-${table1Fqn}"]`
    );
    const table2Node = page.locator(
      `[data-testid="lineage-node-${table2Fqn}"]`
    );

    await expect(table1Node).toBeVisible();
    await expect(table2Node).toBeVisible();

    await page.getByTestId('full-screen').click();

    const table1PaginationNext = table1Node.locator('[data-testid="next-btn"]');
    const table2PaginationNext = table2Node.locator('[data-testid="next-btn"]');
    const table1PaginationPrev = table1Node.locator('[data-testid="prev-btn"]');
    const table2PaginationPrev = table2Node.locator('[data-testid="prev-btn"]');

    await test.step('Add edges between T1-P1 and T2-P1', async () => {
      await addColumnLineage(
        page,
        `${table1Fqn}.${table1Columns[0].name}`,
        `${table2Fqn}.${table2Columns[0].name}`,
        false
      );

      await addColumnLineage(
        page,
        `${table1Fqn}.${table1Columns[1].name}`,
        `${table2Fqn}.${table2Columns[1].name}`,
        false
      );

      await addColumnLineage(
        page,
        `${table1Fqn}.${table1Columns[2].name}`,
        `${table2Fqn}.${table2Columns[2].name}`,
        false
      );
    });

    await test.step('Navigate to T2-P2 and add edges between T1-P1 and T2-P2', async () => {
      if (await table2PaginationNext.isVisible()) {
        await table2PaginationNext.click();
        await page.waitForTimeout(500);
      }

      await addColumnLineage(
        page,
        `${table1Fqn}.${table1Columns[0].name}`,
        `${table2Fqn}.${table2Columns[5].name}`,
        false
      );

      await addColumnLineage(
        page,
        `${table1Fqn}.${table1Columns[1].name}`,
        `${table2Fqn}.${table2Columns[6].name}`,
        false
      );

      await addColumnLineage(
        page,
        `${table1Fqn}.${table1Columns[3].name}`,
        `${table2Fqn}.${table2Columns[7].name}`,
        false
      );

      await addColumnLineage(
        page,
        `${table1Fqn}.${table1Columns[4].name}`,
        `${table2Fqn}.${table2Columns[7].name}`,
        false
      );
    });

    await test.step('Navigate to T1-P2 and add edges between T1-P2 and T2-P2', async () => {
      if (await table1PaginationNext.isVisible()) {
        await table1PaginationNext.click();
        await page.waitForTimeout(500);
      }

      await addColumnLineage(
        page,
        `${table1Fqn}.${table1Columns[5].name}`,
        `${table2Fqn}.${table2Columns[5].name}`,
        false
      );

      await addColumnLineage(
        page,
        `${table1Fqn}.${table1Columns[6].name}`,
        `${table2Fqn}.${table2Columns[6].name}`,
        false
      );

      await addColumnLineage(
        page,
        `${table1Fqn}.${table1Columns[8].name}`,
        `${table2Fqn}.${table2Columns[7].name}`,
        false
      );

      const table1Box = await table1Node.boundingBox();
      if (table1Box) {
        await page.mouse.click(table1Box.x - 10, table1Box.y - 10);
      }
    });

    if (await table1PaginationPrev.isVisible()) {
      await table1PaginationPrev.click();
    }
    if (await table2PaginationPrev.isVisible()) {
      await table2PaginationPrev.click();
    }

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await getApiContext(
      await createNewPage(browser).then((p) => p.page)
    );
    await Promise.all([table1.delete(apiContext), table2.delete(apiContext)]);
    await afterAction();
  });

  test('Verify column visibility across pagination pages', async ({
    browser,
  }) => {
    test.slow();

    const { page } = await createNewPage(browser);

    await table1.visitEntityPage(page);
    await visitLineageTab(page);
    await activateColumnLayer(page);

    await page.getByTestId('full-screen').click();

    const table1Node = page.locator(
      `[data-testid="lineage-node-${table1Fqn}"]`
    );
    const table2Node = page.locator(
      `[data-testid="lineage-node-${table2Fqn}"]`
    );

    const table1NextBtn = table1Node.locator('[data-testid="next-btn"]');
    const table2NextBtn = table2Node.locator('[data-testid="next-btn"]');

    const allColumnTestIds = {
      table1: table1Columns.map((col) => `column-${table1Fqn}.${col.name}`),
      table2: table2Columns.map((col) => `column-${table2Fqn}.${col.name}`),
    };

    const columnTestIds: Record<string, string[]> = {
      'T1-P1': allColumnTestIds.table1.slice(0, 5),
      'T1-P2': allColumnTestIds.table1.slice(5, 10),
      'T1-P3': allColumnTestIds.table1.slice(10, 11),
      'T2-P1': allColumnTestIds.table2.slice(0, 5),
      'T2-P2': allColumnTestIds.table2.slice(5, 10),
      'T2-P3': allColumnTestIds.table2.slice(10, 12),
    };

    await test.step('Verify T1-P1: C1-C5 visible, C6-C11 hidden', async () => {
      for (const testId of columnTestIds['T1-P1']) {
        await expect(page.locator(`[data-testid="${testId}"]`)).toBeVisible();
      }

      for (const testId of allColumnTestIds.table1) {
        if (!columnTestIds['T1-P1'].includes(testId)) {
          await expect(
            page.locator(`[data-testid="${testId}"]`)
          ).not.toBeVisible();
        }
      }
    });

    await test.step('Verify T2-P1: C1-C5 visible, C6-C12 hidden', async () => {
      for (const testId of columnTestIds['T2-P1']) {
        await expect(page.locator(`[data-testid="${testId}"]`)).toBeVisible();
      }

      for (const testId of allColumnTestIds.table2) {
        if (!columnTestIds['T2-P1'].includes(testId)) {
          await expect(
            page.locator(`[data-testid="${testId}"]`)
          ).not.toBeVisible();
        }
      }
    });

    await test.step('Navigate to T1-P2 and verify visibility', async () => {
      if (await table1NextBtn.isVisible()) {
        await table1NextBtn.click();
        await page.waitForTimeout(500);
      }

      for (const testId of columnTestIds['T1-P2']) {
        await expect(page.locator(`[data-testid="${testId}"]`)).toBeVisible();
      }

      for (const testId of allColumnTestIds.table1) {
        if (!columnTestIds['T1-P2'].includes(testId)) {
          await expect(
            page.locator(`[data-testid="${testId}"]`)
          ).not.toBeVisible();
        }
      }
    });

    await test.step('Navigate to T2-P2 and verify visibility', async () => {
      if (await table2NextBtn.isVisible()) {
        await table2NextBtn.click();
        await page.waitForTimeout(500);
      }

      for (const testId of columnTestIds['T2-P2']) {
        await expect(page.locator(`[data-testid="${testId}"]`)).toBeVisible();
      }

      for (const testId of allColumnTestIds.table2) {
        if (!columnTestIds['T2-P2'].includes(testId)) {
          await expect(
            page.locator(`[data-testid="${testId}"]`)
          ).not.toBeVisible();
        }
      }
    });

    await test.step('Navigate to T1-P3 and verify visibility', async () => {
      if (await table1NextBtn.isVisible()) {
        await table1NextBtn.click();
        await page.waitForTimeout(500);
      }

      for (const testId of columnTestIds['T1-P3']) {
        await expect(page.locator(`[data-testid="${testId}"]`)).toBeVisible();
      }

      for (const testId of allColumnTestIds.table1) {
        if (!columnTestIds['T1-P3'].includes(testId)) {
          await expect(
            page.locator(`[data-testid="${testId}"]`)
          ).not.toBeVisible();
        }
      }
    });

    await test.step('Navigate to T2-P3 and verify visibility', async () => {
      if (await table2NextBtn.isVisible()) {
        await table2NextBtn.click();
        await page.waitForTimeout(500);
      }

      for (const testId of columnTestIds['T2-P3']) {
        await expect(page.locator(`[data-testid="${testId}"]`)).toBeVisible();
      }

      for (const testId of allColumnTestIds.table2) {
        if (!columnTestIds['T2-P3'].includes(testId)) {
          await expect(
            page.locator(`[data-testid="${testId}"]`)
          ).not.toBeVisible();
        }
      }
    });
  });

  test('Verify edges when no column is hovered or selected', async ({
    browser,
  }) => {
    test.slow();

    const { page } = await createNewPage(browser);

    await table1.visitEntityPage(page);
    await visitLineageTab(page);
    await activateColumnLayer(page);

    await page.getByTestId('full-screen').click();

    const table1Node = page.locator(
      `[data-testid="lineage-node-${table1Fqn}"]`
    );
    const table2Node = page.locator(
      `[data-testid="lineage-node-${table2Fqn}"]`
    );

    const table1NextBtn = table1Node.locator('[data-testid="next-btn"]');
    const table2NextBtn = table2Node.locator('[data-testid="next-btn"]');

    await test.step('Verify T1-P1 and T2-P1: Only (T1,C1)-(T2,C1), (T1,C2)-(T2,C2), (T1,C3)-(T2,C3) edges visible', async () => {
      const visibleEdges = [
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[0].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[0].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[1].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[1].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[2].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[2].name}`
        )}`,
      ];

      const hiddenEdges = [
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[0].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[5].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[1].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[6].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[3].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[7].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[4].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[7].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[5].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[5].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[6].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[6].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[8].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[7].name}`
        )}`,
      ];

      for (const edgeId of visibleEdges) {
        await expect(page.locator(`[data-testid="${edgeId}"]`)).toBeVisible();
      }

      for (const edgeId of hiddenEdges) {
        await expect(
          page.locator(`[data-testid="${edgeId}"]`)
        ).not.toBeVisible();
      }
    });

    await test.step('Navigate to T2-P2 and verify (T1,C1)-(T2,C6), (T1,C2)-(T2,C7), (T1,C4)-(T2,C8), (T1,C5)-(T2,C8) edges visible', async () => {
      if (await table2NextBtn.isVisible()) {
        await table2NextBtn.click();
        await page.waitForTimeout(500);
      }

      const visibleEdges = [
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[0].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[5].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[1].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[6].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[3].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[7].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[4].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[7].name}`
        )}`,
      ];

      const hiddenEdges = [
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[0].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[0].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[1].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[1].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[2].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[2].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[5].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[5].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[6].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[6].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[8].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[7].name}`
        )}`,
      ];

      for (const edgeId of visibleEdges) {
        await expect(page.locator(`[data-testid="${edgeId}"]`)).toBeVisible();
      }

      for (const edgeId of hiddenEdges) {
        await expect(
          page.locator(`[data-testid="${edgeId}"]`)
        ).not.toBeVisible();
      }
    });

    await test.step('Navigate to T1-P2 and verify (T1,C6)-(T2,C6), (T1,C7)-(T2,C7), (T1,C9)-(T2,C8) edges visible', async () => {
      if (await table1NextBtn.isVisible()) {
        await table1NextBtn.click();
        await page.waitForTimeout(500);
      }

      const visibleEdges = [
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[5].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[5].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[6].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[6].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[8].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[7].name}`
        )}`,
      ];

      const hiddenEdges = [
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[0].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[0].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[1].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[1].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[2].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[2].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[0].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[5].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[1].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[6].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[3].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[7].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[4].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[7].name}`
        )}`,
      ];

      for (const edgeId of visibleEdges) {
        await expect(page.locator(`[data-testid="${edgeId}"]`)).toBeVisible();
      }

      for (const edgeId of hiddenEdges) {
        await expect(
          page.locator(`[data-testid="${edgeId}"]`)
        ).not.toBeVisible();
      }
    });
  });

  test('Verify columns and edges when a column is hovered', async ({
    browser,
  }) => {
    test.slow();

    const { page } = await createNewPage(browser);

    await table1.visitEntityPage(page);
    await visitLineageTab(page);
    await activateColumnLayer(page);

    await page.getByTestId('full-screen').click();

    await test.step('Hover on (T1,C1) and verify highlighted columns and edges', async () => {
      const c1Column = page.locator(
        `[data-testid="column-${table1Fqn}.${table1Columns[0].name}"]`
      );

      await c1Column.hover();
      await page.waitForTimeout(500);

      // Verify (T1,C1), (T2,C1) and (T2,C6) are highlighted and visible
      const t1c1 = page.locator(
        `[data-testid="column-${table1Fqn}.${table1Columns[0].name}"]`
      );
      const t2c1 = page.locator(
        `[data-testid="column-${table2Fqn}.${table2Columns[0].name}"]`
      );
      const t2c6 = page.locator(
        `[data-testid="column-${table2Fqn}.${table2Columns[5].name}"]`
      );

      await expect(t1c1).toBeVisible();
      await expect(t1c1).toHaveClass(/custom-node-header-column-tracing/);

      await expect(t2c1).toBeVisible();
      await expect(t2c1).toHaveClass(/custom-node-header-column-tracing/);

      await expect(t2c6).toBeVisible();
      await expect(t2c6).toHaveClass(/custom-node-header-column-tracing/);

      // Verify edges are visible
      const edge_t1c1_to_t2c1 = `column-edge-${btoa(
        `${table1Fqn}.${table1Columns[0].name}`
      )}-${btoa(`${table2Fqn}.${table2Columns[0].name}`)}`;
      const edge_t1c1_to_t2c6 = `column-edge-${btoa(
        `${table1Fqn}.${table1Columns[0].name}`
      )}-${btoa(`${table2Fqn}.${table2Columns[5].name}`)}`;

      await expect(
        page.locator(`[data-testid="${edge_t1c1_to_t2c1}"]`)
      ).toBeVisible();
      await expect(
        page.locator(`[data-testid="${edge_t1c1_to_t2c6}"]`)
      ).toBeVisible();
    });
  });

  test('Verify columns and edges when a column is clicked', async ({
    browser,
  }) => {
    test.slow();

    const { page } = await createNewPage(browser);

    await table1.visitEntityPage(page);
    await visitLineageTab(page);
    await activateColumnLayer(page);

    await page.getByTestId('full-screen').click();

    await test.step('Navigate to T1-P2 and T2-P2, click (T2,C6) and verify highlighted columns and edges', async () => {
      const table1Node = page.locator(
        `[data-testid="lineage-node-${table1Fqn}"]`
      );
      const table2Node = page.locator(
        `[data-testid="lineage-node-${table2Fqn}"]`
      );

      // Navigate to T1-P2
      const table1NextBtn = table1Node.locator('[data-testid="next-btn"]');
      if (await table1NextBtn.isVisible()) {
        await table1NextBtn.click();
        await page.waitForTimeout(500);
      }

      // Navigate to T2-P2
      const table2NextBtn = table2Node.locator('[data-testid="next-btn"]');
      if (await table2NextBtn.isVisible()) {
        await table2NextBtn.click();
        await page.waitForTimeout(500);
      }

      // Click on (T2,C6)
      const t2c6Column = page.locator(
        `[data-testid="column-${table2Fqn}.${table2Columns[5].name}"]`
      );
      await t2c6Column.click();
      await page.waitForTimeout(500);

      // Verify (T1,C1), (T1,C6) and (T2,C6) are highlighted and visible
      const t1c1 = page.locator(
        `[data-testid="column-${table1Fqn}.${table1Columns[0].name}"]`
      );
      const t1c6 = page.locator(
        `[data-testid="column-${table1Fqn}.${table1Columns[5].name}"]`
      );
      const t2c6 = page.locator(
        `[data-testid="column-${table2Fqn}.${table2Columns[5].name}"]`
      );

      await expect(t1c1).toBeVisible();
      await expect(t1c1).toHaveClass(/custom-node-header-column-tracing/);

      await expect(t1c6).toBeVisible();
      await expect(t1c6).toHaveClass(/custom-node-header-column-tracing/);

      await expect(t2c6).toBeVisible();
      await expect(t2c6).toHaveClass(/custom-node-header-column-tracing/);

      // Verify edges are visible
      const edge_t1c1_to_t2c6 = `column-edge-${btoa(
        `${table1Fqn}.${table1Columns[0].name}`
      )}-${btoa(`${table2Fqn}.${table2Columns[5].name}`)}`;
      const edge_t1c6_to_t2c6 = `column-edge-${btoa(
        `${table1Fqn}.${table1Columns[5].name}`
      )}-${btoa(`${table2Fqn}.${table2Columns[5].name}`)}`;

      await expect(
        page.locator(`[data-testid="${edge_t1c1_to_t2c6}"]`)
      ).toBeVisible();
      await expect(
        page.locator(`[data-testid="${edge_t1c6_to_t2c6}"]`)
      ).toBeVisible();
    });
  });
  test('Verify edges for column level lineage between 2 nodes when filter is toggled', async ({
    browser,
  }) => {
    test.slow();

    const { page } = await createNewPage(browser);

    await test.step('1. Load both the table', async () => {
      await table1.visitEntityPage(page);
      await visitLineageTab(page);
      await activateColumnLayer(page);
      await page.getByTestId('full-screen').click();
    });

    const table1Node = page.locator(
      `[data-testid="lineage-node-${table1Fqn}"]`
    );
    const table2Node = page.locator(
      `[data-testid="lineage-node-${table2Fqn}"]`
    );

    // First turn off both the filters
    const table1FilterButton = table1Node.locator(
      '[data-testid="lineage-filter-button"]'
    );
    await table1FilterButton.click();

    const table2FilterButton = table2Node.locator(
      '[data-testid="lineage-filter-button"]'
    );
    await table2FilterButton.click();
    await page.waitForTimeout(500);

    await test.step('2. Verify edges visible and hidden for page1 of both the tables', async () => {
      const visibleEdges = [
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[0].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[0].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[1].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[1].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[2].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[2].name}`
        )}`,
      ];

      const hiddenEdges = [
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[0].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[5].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[1].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[6].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[3].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[7].name}`
        )}`,
      ];

      for (const edgeId of visibleEdges) {
        await expect(page.locator(`[data-testid="${edgeId}"]`)).toBeVisible();
      }

      for (const edgeId of hiddenEdges) {
        await expect(
          page.locator(`[data-testid="${edgeId}"]`)
        ).not.toBeVisible();
      }
    });

    await test.step('3. Enable the filter for table1 by clicking filter button', async () => {
      const table1FilterButton = table1Node.locator(
        '[data-testid="lineage-filter-button"]'
      );
      await table1FilterButton.click();
      await page.waitForTimeout(500);
    });

    await test.step('4. Verify that only columns with lineage are visible in table1', async () => {
      const columnsWithLineage = [0, 1, 2, 3, 4, 5, 6, 8];
      const columnsWithoutLineage = [7, 9, 10];

      for (const index of columnsWithLineage) {
        await expect(
          page.locator(
            `[data-testid="column-${table1Fqn}.${table1Columns[index].name}"]`
          )
        ).toBeVisible();
      }

      for (const index of columnsWithoutLineage) {
        await expect(
          page.locator(
            `[data-testid="column-${table1Fqn}.${table1Columns[index].name}"]`
          )
        ).not.toBeVisible();
      }
    });

    await test.step('5. Enable the filter for table2 by clicking filter button', async () => {
      const table2FilterButton = table2Node.locator(
        '[data-testid="lineage-filter-button"]'
      );
      await table2FilterButton.click();
      await page.waitForTimeout(500);
    });

    await test.step('6. Verify that only columns with lineage are visible in table2', async () => {
      const columnsWithLineage = [0, 1, 2, 5, 6, 7];
      const columnsWithoutLineage = [3, 4, 8, 9, 10, 11];

      for (const index of columnsWithLineage) {
        await expect(
          page.locator(
            `[data-testid="column-${table2Fqn}.${table2Columns[index].name}"]`
          )
        ).toBeVisible();
      }

      for (const index of columnsWithoutLineage) {
        await expect(
          page.locator(
            `[data-testid="column-${table2Fqn}.${table2Columns[index].name}"]`
          )
        ).not.toBeVisible();
      }
    });

    await test.step('7. Verify new edges are now visible.', async () => {
      const allVisibleEdges = [
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[0].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[0].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[1].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[1].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[2].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[2].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[0].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[5].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[1].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[6].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[3].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[7].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[4].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[7].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[5].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[5].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[6].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[6].name}`
        )}`,
        `column-edge-${btoa(`${table1Fqn}.${table1Columns[8].name}`)}-${btoa(
          `${table2Fqn}.${table2Columns[7].name}`
        )}`,
      ];

      for (const edgeId of allVisibleEdges) {
        await expect(page.locator(`[data-testid="${edgeId}"]`)).toBeVisible();
      }
    });
  });
});
