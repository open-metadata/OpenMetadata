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
        await page.waitForLoadState('networkidle');
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
            .locator(
              `[data-testid="lineage-node-${toNodeFqn}"] .entity-service-icon`
            )
            .click();

          await expect(
            page.locator('.ant-drawer [data-testid="entity-header-title"]')
          ).toHaveText(get(entity, 'entityResponseData.displayName'));

          await page.getByTestId('entity-panel-close-icon').click();

          // Drawer should not open after closing it
          await expect(
            page.locator('.ant-drawer-content-wrapper')
          ).not.toBeVisible();
        }
      });

      await test.step('Should create pipeline between entities', async () => {
        await editLineage(page);
        await page.getByTestId('fit-screen').click();
        await page.getByRole('menuitem', { name: 'Fit to screen' }).click();
        await page.waitForTimeout(500); // wait for the nodes to settle

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

    await page.getByTestId('edit-function').click();

    // wait for the modal to be visible
    await expect(page.locator('[role="dialog"].ant-modal')).toBeVisible();

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

    await expect(page.locator('.ant-drawer-wrapper-body')).toBeVisible();
  } finally {
    // Cleanup
    await table.delete(apiContext);
    await afterAction();
  }
});

test.fixme(
  'Verify cycle lineage should be handled properly',
  async ({ browser }) => {
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
        page
          .getByTestId(`lineage-node-${dashboardFqn}`)
          .getByTestId('plus-icon')
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
        page
          .getByTestId(`lineage-node-${dashboardFqn}`)
          .getByTestId('plus-icon')
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
      ).not.toBeVisible();
    } finally {
      await Promise.all([
        table.delete(apiContext),
        topic.delete(apiContext),
        dashboard.delete(apiContext),
      ]);
      await afterAction();
    }
  }
);
