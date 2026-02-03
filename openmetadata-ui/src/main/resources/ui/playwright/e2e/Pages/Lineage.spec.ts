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
import { ChartClass } from '../../support/entity/ChartClass';
import { ContainerClass } from '../../support/entity/ContainerClass';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { MetricClass } from '../../support/entity/MetricClass';
import { MlModelClass } from '../../support/entity/MlModelClass';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { SearchIndexClass } from '../../support/entity/SearchIndexClass';
import { ApiServiceClass } from '../../support/entity/service/ApiServiceClass';
import { DashboardServiceClass } from '../../support/entity/service/DashboardServiceClass';
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import { MessagingServiceClass } from '../../support/entity/service/MessagingServiceClass';
import { MlmodelServiceClass } from '../../support/entity/service/MlmodelServiceClass';
import { PipelineServiceClass } from '../../support/entity/service/PipelineServiceClass';
import { StorageServiceClass } from '../../support/entity/service/StorageServiceClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import {
  clickOutside,
  createNewPage,
  getApiContext,
  redirectToHomePage,
  uuid,
} from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  activateColumnLayer,
  addColumnLineage,
  addPipelineBetweenNodes,
  applyPipelineFromModal,
  clickLineageNode,
  connectEdgeBetweenNodes,
  connectEdgeBetweenNodesViaAPI,
  deleteEdge,
  deleteNode,
  editLineage,
  editLineageClick,
  performZoomOut,
  rearrangeNodes,
  removeColumnLineage,
  setupEntitiesForLineage,
  toggleLineageFilters,
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

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
});

for (const EntityClass of entities) {
  const defaultEntity = new EntityClass();

  test(`Lineage creation from ${defaultEntity.getType()} entity`, async ({
    page,
  }) => {
    // 5 minutes to avoid test timeout happening some times in AUTs
    test.setTimeout(300_000);

    const { currentEntity, entities, cleanup } = await setupEntitiesForLineage(
      page,
      defaultEntity
    );

    try {
      await test.step('Should create lineage for the entity', async () => {
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

        const lineageRes = page.waitForResponse('/api/v1/lineage/getLineage?*');
        await page.reload();
        await lineageRes;
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

          await clickLineageNode(page, toNodeFqn);

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

        await clickLineageNode(page, fromNodeFqn);

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

      await test.step(
        'Remove lineage between nodes for the entity',
        async () => {
          await editLineage(page);
          await performZoomOut(page);

          for (const entity of entities) {
            await deleteEdge(page, currentEntity, entity);
          }
        }
      );

      await test.step('Verify Lineage Config', async () => {
        await editLineageClick(page);
        await verifyLineageConfig(page);
      });
    } finally {
      await cleanup();
    }
  });
}

test('Verify column lineage between tables', async ({ page }) => {
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

test('Verify column lineage between table and topic', async ({ page }) => {
  test.slow();

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

  // ensure node will be visible in the viewport
  await performZoomOut(page);

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
  page,
}) => {
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
  page,
}) => {
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

test('Verify function data in edge drawer', async ({ page }) => {
  test.slow();

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
  page,
}) => {
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

    await clickLineageNode(page, dbFqn);
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

test('Verify cycle lineage should be handled properly', async ({ page }) => {
  test.slow();

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

test('Verify column layer is applied on entering edit mode', async ({
  page,
}) => {
  const { apiContext, afterAction } = await getApiContext(page);
  const table = new TableClass();

  await table.create(apiContext);

  try {
    await table.visitEntityPage(page);
    await visitLineageTab(page);

    const columnLayerBtn = page.locator(
      '[data-testid="lineage-layer-column-btn"]'
    );

    await test.step('Verify column layer is inactive initially', async () => {
      await page.click('[data-testid="lineage-layer-btn"]');

      await expect(columnLayerBtn).not.toHaveClass(/Mui-selected/);

      await clickOutside(page);
    });

    await test.step(
      'Enter edit mode and verify column layer is active',
      async () => {
        await editLineageClick(page);

        await page.click('[data-testid="lineage-layer-btn"]');

        await expect(columnLayerBtn).toHaveClass(/Mui-selected/);

        await clickOutside(page);
      }
    );
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});

test('Verify there is no traced nodes and columns on exiting edit mode', async ({
  page,
}) => {
  const { apiContext, afterAction } = await getApiContext(page);
  const table = new TableClass();

  await table.create(apiContext);

  try {
    await table.visitEntityPage(page);
    await visitLineageTab(page);

    const tableFqn = get(table, 'entityResponseData.fullyQualifiedName');
    const tableNode = page.locator(`[data-testid="lineage-node-${tableFqn}"]`);
    const firstColumnName = get(table, 'entityResponseData.columns[0].name');
    const firstColumn = page.locator(
      `[data-testid="column-${tableFqn}.${firstColumnName}"]`
    );

    await test.step(
      'Verify node tracing is cleared on exiting edit mode',
      async () => {
        await editLineageClick(page);

        await expect(tableNode).not.toHaveClass(/custom-node-header-active/);

        await tableNode.click({ position: { x: 5, y: 5 } });

        await expect(tableNode).toHaveClass(/custom-node-header-active/);

        await editLineageClick(page);

        await expect(tableNode).not.toHaveClass(/custom-node-header-active/);
      }
    );

    await test.step(
      'Verify column tracing is cleared on exiting edit mode',
      async () => {
        await editLineageClick(page);

        await firstColumn.click();

        await expect(firstColumn).toHaveClass(
          /custom-node-header-column-tracing/
        );

        await editLineageClick(page);

        await toggleLineageFilters(page, tableFqn);

        await expect(firstColumn).not.toHaveClass(
          /custom-node-header-column-tracing/
        );
      }
    );
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});

test('Verify node full path is present as breadcrumb in lineage node', async ({
  page,
}) => {
  const { apiContext, afterAction } = await getApiContext(page);
  const table = new TableClass();

  await table.create(apiContext);

  try {
    await table.visitEntityPage(page);
    await visitLineageTab(page);

    const tableFqn = get(table, 'entityResponseData.fullyQualifiedName');
    const tableNode = page.locator(`[data-testid="lineage-node-${tableFqn}"]`);

    await expect(tableNode).toBeVisible();

    const breadcrumbContainer = tableNode.locator(
      '[data-testid="lineage-breadcrumbs"]'
    );
    await expect(breadcrumbContainer).toBeVisible();

    const breadcrumbItems = breadcrumbContainer.locator(
      '.lineage-breadcrumb-item'
    );
    const breadcrumbCount = await breadcrumbItems.count();

    expect(breadcrumbCount).toBeGreaterThan(0);

    const fqnParts: Array<string> = tableFqn.split('.');
    fqnParts.pop();

    expect(breadcrumbCount).toBe(fqnParts.length);

    for (let i = 0; i < breadcrumbCount; i++) {
      const breadcrumbText = await breadcrumbItems.nth(i).textContent();
      expect(breadcrumbText).toBe(fqnParts[i]);
    }
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});

test('Edges are not getting hidden when column is selected and column layer is removed', async ({
  page,
}) => {
  const { apiContext, afterAction } = await getApiContext(page);
  const table1 = new TableClass();
  const table2 = new TableClass();

  try {
    await Promise.all([table1.create(apiContext), table2.create(apiContext)]);

    const table1Fqn = get(table1, 'entityResponseData.fullyQualifiedName');
    const table2Fqn = get(table2, 'entityResponseData.fullyQualifiedName');

    const sourceCol = `${table1Fqn}.${get(
      table1,
      'entityResponseData.columns[0].name'
    )}`;
    const targetCol = `${table2Fqn}.${get(
      table2,
      'entityResponseData.columns[0].name'
    )}`;

    await test.step(
      '1. Create 2 tables and create column level lineage between them.',
      async () => {
        await connectEdgeBetweenNodesViaAPI(
          apiContext,
          {
            id: table1.entityResponseData.id,
            type: 'table',
          },
          {
            id: table2.entityResponseData.id,
            type: 'table',
          },
          [
            {
              fromColumns: [sourceCol],
              toColumn: targetCol,
            },
          ]
        );

        await table1.visitEntityPage(page);
        await visitLineageTab(page);
      }
    );

    await test.step('2. Verify edge between 2 tables is visible', async () => {
      const tableEdge = page.getByTestId(
        `rf__edge-edge-${table1.entityResponseData.id}-${table2.entityResponseData.id}`
      );
      await expect(tableEdge).toBeVisible();
    });

    await test.step(
      '3. Activate column layer and select a column - table edge should be hidden',
      async () => {
        await activateColumnLayer(page);

        const firstColumn = page.locator(`[data-testid="column-${sourceCol}"]`);
        await firstColumn.click();

        const tableEdge = page.getByTestId(
          `rf__edge-edge-${table1.entityResponseData.id}-${table2.entityResponseData.id}`
        );
        await expect(tableEdge).not.toBeVisible();
      }
    );

    await test.step(
      '4. Remove column layer - table edge should be visible again',
      async () => {
        const columnLayerBtn = page.locator(
          '[data-testid="lineage-layer-column-btn"]'
        );

        await page.click('[data-testid="lineage-layer-btn"]');
        await columnLayerBtn.click();
        await clickOutside(page);

        const tableEdge = page.getByTestId(
          `rf__edge-edge-${table1.entityResponseData.id}-${table2.entityResponseData.id}`
        );
        await expect(tableEdge).toBeVisible();
      }
    );
  } finally {
    await Promise.all([table1.delete(apiContext), table2.delete(apiContext)]);
    await afterAction();
  }
});

test.describe('node selection edge behavior', () => {
  /**
   * Test setup:
   * - table1 -> table2 -> table3
   *          -> table4
   *
   * This creates a lineage graph where:
   * - table1 is upstream of table2
   * - table2 is upstream of table3 and table4
   * - When table3 is selected, the traced path is: table1 -> table2 -> table3
   * - The edge table2 -> table4 should be dimmed (not in traced path)
   */
  const table1 = new TableClass();
  const table2 = new TableClass();
  const table3 = new TableClass();
  const table4 = new TableClass();

  let table1Fqn: string;
  let table2Fqn: string;
  let table3Fqn: string;
  let table4Fqn: string;

  let table1Col: string;
  let table2Col: string;
  let table3Col: string;
  let table4Col: string;

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await Promise.all([
      table1.create(apiContext),
      table2.create(apiContext),
      table3.create(apiContext),
      table4.create(apiContext),
    ]);

    table1Fqn = get(table1, 'entityResponseData.fullyQualifiedName');
    table2Fqn = get(table2, 'entityResponseData.fullyQualifiedName');
    table3Fqn = get(table3, 'entityResponseData.fullyQualifiedName');
    table4Fqn = get(table4, 'entityResponseData.fullyQualifiedName');

    table1Col = `${table1Fqn}.${get(
      table1,
      'entityResponseData.columns[0].name'
    )}`;
    table2Col = `${table2Fqn}.${get(
      table2,
      'entityResponseData.columns[0].name'
    )}`;
    table3Col = `${table3Fqn}.${get(
      table3,
      'entityResponseData.columns[0].name'
    )}`;
    table4Col = `${table4Fqn}.${get(
      table4,
      'entityResponseData.columns[0].name'
    )}`;

    await connectEdgeBetweenNodesViaAPI(
      apiContext,
      { id: table1.entityResponseData.id, type: 'table' },
      { id: table2.entityResponseData.id, type: 'table' },
      [{ fromColumns: [table1Col], toColumn: table2Col }]
    );

    await connectEdgeBetweenNodesViaAPI(
      apiContext,
      { id: table2.entityResponseData.id, type: 'table' },
      { id: table3.entityResponseData.id, type: 'table' },
      [{ fromColumns: [table2Col], toColumn: table3Col }]
    );

    await connectEdgeBetweenNodesViaAPI(
      apiContext,
      { id: table2.entityResponseData.id, type: 'table' },
      { id: table4.entityResponseData.id, type: 'table' },
      [{ fromColumns: [table2Col], toColumn: table4Col }]
    );

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await Promise.all([
      table1.delete(apiContext),
      table2.delete(apiContext),
      table3.delete(apiContext),
      table4.delete(apiContext),
    ]);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('highlights traced node-to-node edges when a node is selected', async ({
    page,
  }) => {
    await table2.visitEntityPage(page);
    await visitLineageTab(page);
    await performZoomOut(page);

    await clickLineageNode(page, table3Fqn);

    await page.keyboard.press('Escape');

    const tracedEdge1 = page.locator(
      `[data-testid="edge-${table1Fqn}-${table2Fqn}"]`
    );
    const tracedEdge2 = page.locator(
      `[data-testid="edge-${table2Fqn}-${table3Fqn}"]`
    );

    await expect(tracedEdge1).toBeVisible();
    await expect(tracedEdge2).toBeVisible();

    const tracedEdge1Style = await tracedEdge1.getAttribute('style');
    const tracedEdge2Style = await tracedEdge2.getAttribute('style');

    expect(tracedEdge1Style).toContain('opacity: 1');
    expect(tracedEdge2Style).toContain('opacity: 1');
  });

  test('hides column-to-column edges when a node is selected', async ({
    page,
  }) => {
    await table2.visitEntityPage(page);
    await visitLineageTab(page);
    await activateColumnLayer(page);
    await performZoomOut(page);

    const columnEdge = page.locator(
      `[data-testid="column-edge-${btoa(table1Col)}-${btoa(table2Col)}"]`
    );
    await expect(columnEdge).toBeVisible();

    await clickLineageNode(page, table3Fqn);

    const columnEdgeStyle = await columnEdge.getAttribute('style');

    expect(columnEdgeStyle).toContain('display: none');
  });

  test('grays out non-traced node-to-node edges when a node is selected', async ({
    page,
  }) => {
    await table2.visitEntityPage(page);
    await visitLineageTab(page);
    await performZoomOut(page);

    await clickLineageNode(page, table3Fqn);

    const nonTracedEdge = page.locator(
      `[data-testid="edge-${table2Fqn}-${table4Fqn}"]`
    );

    await expect(nonTracedEdge).toBeVisible();

    const nonTracedEdgeStyle = await nonTracedEdge.getAttribute('style');

    expect(nonTracedEdgeStyle).toContain('opacity: 0.3');
  });

  test('highlights traced column-to-column edges when a column is selected', async ({
    page,
  }) => {
    await table2.visitEntityPage(page);
    await visitLineageTab(page);
    await activateColumnLayer(page);
    await performZoomOut(page);

    const table1Column = page.locator(`[data-testid="column-${table1Col}"]`);
    await table1Column.click();

    const tracedColumnEdge = page.locator(
      `[data-testid="column-edge-${btoa(table1Col)}-${btoa(table2Col)}"]`
    );

    await expect(tracedColumnEdge).toBeVisible();

    const tracedEdgeStyle = await tracedColumnEdge.getAttribute('style');

    expect(tracedEdgeStyle).toContain('opacity: 1');
    expect(tracedEdgeStyle).not.toContain('display: none');
  });

  test('hides non-traced column-to-column edges when a column is selected', async ({
    page,
  }) => {
    await table2.visitEntityPage(page);
    await visitLineageTab(page);
    await activateColumnLayer(page);
    await performZoomOut(page);

    const table3Column = page.locator(`[data-testid="column-${table3Col}"]`);
    await table3Column.click();

    const nonTracedColumnEdge = page.locator(
      `[data-testid="column-edge-${btoa(table2Col)}-${btoa(table4Col)}"]`
    );

    const edgeStyle = await nonTracedColumnEdge.getAttribute('style');

    expect(edgeStyle).toContain('display: none');
  });

  test('grays out node-to-node edges when a column is selected', async ({
    page,
  }) => {
    await table2.visitEntityPage(page);
    await visitLineageTab(page);
    await activateColumnLayer(page);
    await performZoomOut(page);

    const table3Column = page.locator(`[data-testid="column-${table3Col}"]`);
    await table3Column.click();

    const nodeEdge = page.locator(
      `[data-testid="edge-${table2Fqn}-${table3Fqn}"]`
    );

    await expect(nodeEdge).toBeVisible();

    const nodeEdgeStyle = await nodeEdge.getAttribute('style');

    expect(nodeEdgeStyle).toContain('opacity: 0.3');
  });
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
    const { apiContext, afterAction, page } = await createNewPage(browser);

    await redirectToHomePage(page);
    table1.entity.columns = table1Columns;
    table2.entity.columns = table2Columns;

    const [table1Response, table2Response] = await Promise.all([
      table1.create(apiContext),
      table2.create(apiContext),
    ]);

    table1Fqn = get(table1Response, 'entity.fullyQualifiedName');
    table2Fqn = get(table2Response, 'entity.fullyQualifiedName');

    await addPipelineBetweenNodes(page, table1, table2);

    await rearrangeNodes(page);

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
    const table1ColumnFqn = table1Response.entity.columns?.map(
      (col: { fullyQualifiedName: string }) => col.fullyQualifiedName
    ) as string[];
    const table2ColumnFqn = table2Response.entity.columns?.map(
      (col: { fullyQualifiedName: string }) => col.fullyQualifiedName
    ) as string[];

    await test.step('Add edges between T1-P1 and T2-P1', async () => {
      await connectEdgeBetweenNodesViaAPI(
        apiContext,
        {
          id: table1Response.entity.id,
          type: 'table',
        },
        {
          id: table2Response.entity.id,
          type: 'table',
        },
        [
          {
            fromColumns: [table1ColumnFqn[0]],
            toColumn: table2ColumnFqn[0],
          },
          {
            fromColumns: [table1ColumnFqn[1]],
            toColumn: table2ColumnFqn[1],
          },
          {
            fromColumns: [table1ColumnFqn[2]],
            toColumn: table2ColumnFqn[2],
          },
          {
            fromColumns: [table1ColumnFqn[0]],
            toColumn: table2ColumnFqn[5],
          },
          {
            fromColumns: [table1ColumnFqn[1]],
            toColumn: table2ColumnFqn[6],
          },
          {
            fromColumns: [table1ColumnFqn[3]],
            toColumn: table2ColumnFqn[7],
          },
          {
            fromColumns: [table1ColumnFqn[4]],
            toColumn: table2ColumnFqn[7],
          },
          {
            fromColumns: [table1ColumnFqn[5]],
            toColumn: table2ColumnFqn[5],
          },
          {
            fromColumns: [table1ColumnFqn[6]],
            toColumn: table2ColumnFqn[6],
          },
          {
            fromColumns: [table1ColumnFqn[8]],
            toColumn: table2ColumnFqn[7],
          },
        ]
      );
    });

    await test.step(
      'Navigate to T1-P2 and add edges between T1-P2 and T2-P2',
      async () => {
        const table1Box = await table1Node.boundingBox();
        if (table1Box) {
          await page.mouse.click(table1Box.x - 10, table1Box.y - 10);
        }
      }
    );

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await Promise.all([table1.delete(apiContext), table2.delete(apiContext)]);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Verify column visibility across pagination pages', async ({ page }) => {
    test.slow();

    await table1.visitEntityPage(page);
    await visitLineageTab(page);
    await activateColumnLayer(page);
    await toggleLineageFilters(page, table1Fqn);
    await toggleLineageFilters(page, table2Fqn);

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
    page,
  }) => {
    test.slow();

    await table1.visitEntityPage(page);
    await visitLineageTab(page);
    await activateColumnLayer(page);
    await toggleLineageFilters(page, table1Fqn);
    await toggleLineageFilters(page, table2Fqn);

    await page.getByTestId('full-screen').click();

    const table1Node = page.locator(
      `[data-testid="lineage-node-${table1Fqn}"]`
    );
    const table2Node = page.locator(
      `[data-testid="lineage-node-${table2Fqn}"]`
    );

    const table1NextBtn = table1Node.locator('[data-testid="next-btn"]');
    const table2NextBtn = table2Node.locator('[data-testid="next-btn"]');

    await test.step(
      'Verify T1-P1 and T2-P1: Only (T1,C1)-(T2,C1), (T1,C2)-(T2,C2), (T1,C3)-(T2,C3) edges visible',
      async () => {
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
      }
    );

    await test.step(
      'Navigate to T2-P2 and verify (T1,C1)-(T2,C6), (T1,C2)-(T2,C7), (T1,C4)-(T2,C8), (T1,C5)-(T2,C8) edges visible',
      async () => {
        if (await table2NextBtn.isVisible()) {
          await table2NextBtn.click();
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
      }
    );

    await test.step(
      'Navigate to T1-P2 and verify (T1,C6)-(T2,C6), (T1,C7)-(T2,C7), (T1,C9)-(T2,C8) edges visible',
      async () => {
        if (await table1NextBtn.isVisible()) {
          await table1NextBtn.click();
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
      }
    );
  });

  test('Verify columns and edges when a column is hovered', async ({
    page,
  }) => {
    test.slow();

    await table1.visitEntityPage(page);
    await visitLineageTab(page);
    await activateColumnLayer(page);

    await toggleLineageFilters(page, table1Fqn);
    await toggleLineageFilters(page, table2Fqn);

    await page.getByTestId('full-screen').click();

    await test.step(
      'Hover on (T1,C1) and verify highlighted columns and edges',
      async () => {
        const c1Column = page.locator(
          `[data-testid="column-${table1Fqn}.${table1Columns[0].name}"]`
        );

        await c1Column.hover();

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
      }
    );
  });

  test('Verify columns and edges when a column is clicked', async ({
    page,
  }) => {
    test.slow();

    await table1.visitEntityPage(page);
    await visitLineageTab(page);
    await activateColumnLayer(page);

    await toggleLineageFilters(page, table1Fqn);
    await toggleLineageFilters(page, table2Fqn);

    await page.getByTestId('full-screen').click();

    await test.step(
      'Navigate to T1-P2 and T2-P2, click (T2,C6) and verify highlighted columns and edges',
      async () => {
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
        }

        // Navigate to T2-P2
        const table2NextBtn = table2Node.locator('[data-testid="next-btn"]');
        if (await table2NextBtn.isVisible()) {
          await table2NextBtn.click();
        }

        // Click on (T2,C6)
        const t2c6Column = page.locator(
          `[data-testid="column-${table2Fqn}.${table2Columns[5].name}"]`
        );
        await t2c6Column.click();

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
      }
    );
  });

  test('Verify edges for column level lineage between 2 nodes when filter is toggled', async ({
    page,
  }) => {
    test.slow();

    const { afterAction } = await getApiContext(page);

    try {
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

      await toggleLineageFilters(page, table1Fqn);
      await toggleLineageFilters(page, table2Fqn);

      await test.step(
        '2. Verify edges visible and hidden for page1 of both the tables',
        async () => {
          const visibleEdges = [
            `column-edge-${btoa(
              `${table1Fqn}.${table1Columns[0].name}`
            )}-${btoa(`${table2Fqn}.${table2Columns[0].name}`)}`,
            `column-edge-${btoa(
              `${table1Fqn}.${table1Columns[1].name}`
            )}-${btoa(`${table2Fqn}.${table2Columns[1].name}`)}`,
            `column-edge-${btoa(
              `${table1Fqn}.${table1Columns[2].name}`
            )}-${btoa(`${table2Fqn}.${table2Columns[2].name}`)}`,
          ];

          const hiddenEdges = [
            `column-edge-${btoa(
              `${table1Fqn}.${table1Columns[0].name}`
            )}-${btoa(`${table2Fqn}.${table2Columns[5].name}`)}`,
            `column-edge-${btoa(
              `${table1Fqn}.${table1Columns[1].name}`
            )}-${btoa(`${table2Fqn}.${table2Columns[6].name}`)}`,
            `column-edge-${btoa(
              `${table1Fqn}.${table1Columns[3].name}`
            )}-${btoa(`${table2Fqn}.${table2Columns[7].name}`)}`,
          ];

          for (const edgeId of visibleEdges) {
            await expect(
              page.locator(`[data-testid="${edgeId}"]`)
            ).toBeVisible();
          }

          for (const edgeId of hiddenEdges) {
            await expect(
              page.locator(`[data-testid="${edgeId}"]`)
            ).not.toBeVisible();
          }
        }
      );

      await test.step(
        '3. Enable the filter for table1 by clicking filter button',
        async () => {
          const table1FilterButton = table1Node.locator(
            '[data-testid="lineage-filter-button"]'
          );
          await table1FilterButton.click();
        }
      );

      await test.step(
        '4. Verify that only columns with lineage are visible in table1',
        async () => {
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
        }
      );

      await test.step(
        '5. Enable the filter for table2 by clicking filter button',
        async () => {
          const table2FilterButton = table2Node.locator(
            '[data-testid="lineage-filter-button"]'
          );
          await table2FilterButton.click();
        }
      );

      await test.step(
        '6. Verify that only columns with lineage are visible in table2',
        async () => {
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
        }
      );

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
    } finally {
      await afterAction();
    }
  });
});

test('Verify custom properties tab visibility in lineage sidebar', async ({
  page,
}) => {
  const { apiContext } = await getApiContext(page);
  const currentTable = new TableClass();
  const upstreamTable = new TableClass();
  const downstreamTable = new TableClass();

  // Create test entities
  await Promise.all([
    currentTable.create(apiContext),
    upstreamTable.create(apiContext),
    downstreamTable.create(apiContext),
  ]);

  await test.step('Create lineage connections', async () => {
    const currentTableId = currentTable.entityResponseData?.id;
    const upstreamTableId = upstreamTable.entityResponseData?.id;
    const downstreamTableId = downstreamTable.entityResponseData?.id;

    await connectEdgeBetweenNodesViaAPI(
      apiContext,
      {
        id: upstreamTableId,
        type: 'table',
      },
      {
        id: currentTableId,
        type: 'table',
      },
      []
    );
    await connectEdgeBetweenNodesViaAPI(
      apiContext,
      {
        id: currentTableId,
        type: 'table',
      },
      {
        id: downstreamTableId,
        type: 'table',
      },
      []
    );
  });

  await test.step(
    'Navigate to lineage tab and verify custom properties tab in sidebar',
    async () => {
      // Navigate to the entity detail page first (required for visitLineageTab)
      const searchTerm =
        currentTable.entityResponseData?.['fullyQualifiedName'] ||
        currentTable.entity.name;

      await currentTable.visitEntityPage(page, searchTerm);

      // Navigate to lineage tab (this navigates to the full lineage page)
      await visitLineageTab(page);

      // Click on the current entity node to open the sidebar drawer
      const nodeFqn = currentTable.entityResponseData?.['fullyQualifiedName'];

      await clickLineageNode(page, nodeFqn);

      // Wait for the lineage entity panel (sidebar drawer) to open
      const lineagePanel = page.getByTestId('lineage-entity-panel');
      await expect(lineagePanel).toBeVisible();

      // Wait for the panel content to load
      await waitForAllLoadersToDisappear(page);

      // Try to find custom properties tab in the lineage sidebar - use data-testid first (priority 1)
      const customPropertiesTab = lineagePanel.getByTestId(
        'custom-properties-tab'
      );

      await expect(customPropertiesTab).toBeVisible();

      await customPropertiesTab.click();
      await waitForAllLoadersToDisappear(page);
    }
  );
});

test.describe(
  'Verify custom properties tab visibility logic for supported entity types',
  () => {
    const supportedEntities = [
      { entity: new TableClass(), type: 'table' },
      { entity: new TopicClass(), type: 'topic' },
      { entity: new DashboardClass(), type: 'dashboard' },
      { entity: new PipelineClass(), type: 'pipeline' },
      { entity: new MlModelClass(), type: 'mlmodel' },
      { entity: new ContainerClass(), type: 'container' },
      { entity: new SearchIndexClass(), type: 'searchIndex' },
      { entity: new ApiEndpointClass(), type: 'apiEndpoint' },
      { entity: new MetricClass(), type: 'metric' },
      { entity: new ChartClass(), type: 'chart' },
    ];

    test.beforeAll(async ({ browser }) => {
      const { apiContext } = await createNewPage(browser);

      for (const { entity } of supportedEntities) {
        await entity.create(apiContext);
      }
    });

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
    });

    for (const { entity, type } of supportedEntities) {
      test(`Verify custom properties tab IS visible for supported type: ${type}`, async ({
        page,
      }) => {
        test.slow();

        const searchTerm =
          entity.entityResponseData?.['fullyQualifiedName'] ||
          entity.entity.name;

        await entity.visitEntityPage(page, searchTerm);
        await visitLineageTab(page);

        const nodeFqn = entity.entityResponseData?.['fullyQualifiedName'];

        await clickLineageNode(page, nodeFqn);

        const lineagePanel = page.getByTestId('lineage-entity-panel');
        await expect(lineagePanel).toBeVisible();
        await waitForAllLoadersToDisappear(page);

        const customPropertiesTab = lineagePanel.getByTestId(
          'custom-properties-tab'
        );
        await expect(customPropertiesTab).toBeVisible();

        const closeButton = lineagePanel.getByTestId('drawer-close-icon');
        if (await closeButton.isVisible()) {
          await closeButton.click();
          await expect(lineagePanel).not.toBeVisible();
        }
      });
    }
  }
);

test.describe(
  'Verify custom properties tab is NOT visible for unsupported entity types in platform lineage',
  () => {
    const unsupportedServices = [
      { service: new DatabaseServiceClass(), type: 'databaseService' },
      { service: new MessagingServiceClass(), type: 'messagingService' },
      { service: new DashboardServiceClass(), type: 'dashboardService' },
      { service: new PipelineServiceClass(), type: 'pipelineService' },
      { service: new MlmodelServiceClass(), type: 'mlmodelService' },
      { service: new StorageServiceClass(), type: 'storageService' },
      { service: new ApiServiceClass(), type: 'apiService' },
    ];

    test.beforeAll(async ({ browser }) => {
      const { apiContext } = await createNewPage(browser);

      for (const { service } of unsupportedServices) {
        await service.create(apiContext);
      }
    });

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
    });

    for (const { service, type } of unsupportedServices) {
      test(`Verify custom properties tab is NOT visible for ${type} in platform lineage`, async ({
        page,
      }) => {
        test.slow();

        const serviceFqn = get(
          service,
          'entityResponseData.fullyQualifiedName'
        );

        await sidebarClick(page, SidebarItem.LINEAGE);

        const searchEntitySelect = page.getByTestId('search-entity-select');
        await expect(searchEntitySelect).toBeVisible();
        await searchEntitySelect.click();

        const searchInput = page
          .getByTestId('search-entity-select')
          .locator('.ant-select-selection-search-input');

        const searchResponse = page.waitForResponse((response) =>
          response.url().includes('/api/v1/search/query')
        );
        await searchInput.fill(service.entity.name);

        const searchResponseResult = await searchResponse;
        expect(searchResponseResult.status()).toBe(200);

        const nodeSuggestion = page.getByTestId(
          `node-suggestion-${serviceFqn}`
        );
        //small timeout to wait for the node suggestion to be visible in dropdown
        await expect(nodeSuggestion).toBeVisible({ timeout: 10000 });

        const lineageResponse = page.waitForResponse((response) =>
          response.url().includes('/api/v1/lineage/getLineage')
        );

        await nodeSuggestion.click();

        const lineageResponseResult = await lineageResponse;
        expect(lineageResponseResult.status()).toBe(200);

        await expect(
          page.getByTestId(`lineage-node-${serviceFqn}`)
        ).toBeVisible();

        await clickLineageNode(page, serviceFqn);

        const lineagePanel = page.getByTestId('lineage-entity-panel');
        await expect(lineagePanel).toBeVisible();
        await waitForAllLoadersToDisappear(page);

        const customPropertiesTab = lineagePanel.getByTestId(
          'custom-properties-tab'
        );
        const customPropertiesTabByRole = lineagePanel.getByRole('menuitem', {
          name: /custom propert/i,
        });

        await expect(customPropertiesTab).not.toBeVisible();
        await expect(customPropertiesTabByRole).not.toBeVisible();

        const closeButton = lineagePanel.getByTestId('drawer-close-icon');
        if (await closeButton.isVisible()) {
          await closeButton.click();
          await expect(lineagePanel).not.toBeVisible();
        }
      });
    }
  }
);
