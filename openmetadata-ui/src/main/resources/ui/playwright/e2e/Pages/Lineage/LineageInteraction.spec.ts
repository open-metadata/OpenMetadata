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
import { expect } from '@playwright/test';
import { get } from 'lodash';
import { DashboardClass } from '../../../support/entity/DashboardClass';
import { EntityDataClass } from '../../../support/entity/EntityDataClass';
import { TableClass } from '../../../support/entity/TableClass';
import { TopicClass } from '../../../support/entity/TopicClass';
import { performAdminLogin } from '../../../utils/admin';
import {
  clickOutside,
  getApiContext,
  getDefaultAdminAPIContext,
  redirectToHomePage,
} from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import {
  activateColumnLayer,
  addColumnLineage,
  addPipelineBetweenNodes,
  clickEdgeBetweenNodes,
  clickLineageNode,
  connectEdgeBetweenNodesViaAPI,
  editLineage,
  editLineageClick,
  performZoomOut,
  visitLineageTab,
} from '../../../utils/lineage';
import { test } from '../../fixtures/pages';

test.describe('Lineage Interactions', () => {
  const table1 = new TableClass();
  const table2 = new TableClass();
  const topic = new TopicClass();
  const dashboard = new DashboardClass();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      browser
    );

    await Promise.all([
      table1.create(apiContext),
      table2.create(apiContext),
      topic.create(apiContext),
      dashboard.create(apiContext),
    ]);

    await topic.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/owners/0',
          value: {
            type: 'user',
            id: EntityDataClass.user1.responseData.id,
          },
        },
        {
          op: 'add',
          path: '/domains/0',
          value: {
            type: 'domain',
            id: EntityDataClass.domain1.responseData.id,
          },
        },
      ],
    });

    await connectEdgeBetweenNodesViaAPI(
      apiContext,
      { id: table1.entityResponseData.id, type: 'table' },
      { id: topic.entityResponseData.id, type: 'topic' }
    );

    await connectEdgeBetweenNodesViaAPI(
      apiContext,
      { id: topic.entityResponseData.id, type: 'topic' },
      { id: dashboard.entityResponseData.id, type: 'dashboard' }
    );

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await Promise.all([
      table1.delete(apiContext),
      table2.delete(apiContext),
      topic.delete(apiContext),
      dashboard.delete(apiContext),
    ]);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test.describe('Lineage Layers Toggle', () => {
    test('Verify multiple non-platform layers can be active simultaneously', async ({
      page,
    }) => {
      await table1.visitEntityPage(page);
      await visitLineageTab(page);

      await page.getByTestId('lineage-layer-btn').click();

      const columnBtn = page.getByTestId('lineage-layer-column-btn');
      const observabilityBtn = page.getByTestId(
        'lineage-layer-observability-btn'
      );

      await columnBtn.click();
      await observabilityBtn.click();
      await page.keyboard.press('Escape');

      await page.getByTestId('lineage-layer-btn').click();
      await expect(columnBtn).toHaveClass(/Mui-selected/);
      await expect(observabilityBtn).toHaveClass(/Mui-selected/);
    });
  });

  test.describe('Edge Interaction', () => {
    test.beforeEach(async ({ page }) => {
      await table1.visitEntityPage(page);
      await visitLineageTab(page);
      await performZoomOut(page);
    });

    test('Verify edge click opens edge drawer', async ({ page }) => {
      await clickEdgeBetweenNodes(page, table1, topic, false);

      await expect(page.getByTestId('edge-header-title')).toBeVisible();
      await expect(page.getByTestId('edge-header-title')).toHaveText(
        'Edge Information'
      );

      await expect(page.getByTestId('Source-value')).toBeVisible();
      await expect(page.getByTestId('Source-value')).toHaveText(
        table1.entityResponseData.displayName ?? ''
      );

      await expect(page.getByTestId('Target-value')).toBeVisible();
      await expect(page.getByTestId('Target-value')).toHaveText(
        topic.entityResponseData.displayName ?? ''
      );
    });

    test('Verify edge delete button in drawer', async ({ page }) => {
      const table1Fqn = get(table1, 'entityResponseData.fullyQualifiedName');
      const topicFqn = get(topic, 'entityResponseData.fullyQualifiedName');

      await editLineage(page);

      await clickEdgeBetweenNodes(page, table1, topic, false);

      const deleteBtn = page.getByTestId('add-pipeline');
      await expect(deleteBtn).toBeVisible();

      await deleteBtn.click();

      await page.getByTestId('remove-edge-button').click();

      await page.getByRole('button', { name: /confirm/i }).waitFor();
      await page.getByRole('button', { name: /confirm/i }).click();

      await waitForAllLoadersToDisappear(page);

      await editLineageClick(page);

      const edgeDiv = page.getByTestId(`edge-${table1Fqn}-${topicFqn}`);
      await expect(edgeDiv).not.toBeVisible();
    });

    test('Verify function data in edge drawer', async ({ page }) => {
      test.slow();

      const { apiContext, afterAction } = await getApiContext(page);
      const table1 = new TableClass();
      const table2 = new TableClass();

      try {
        await Promise.all([
          table1.create(apiContext),
          table2.create(apiContext),
        ]);
        const sourceTableFqn = get(
          table1,
          'entityResponseData.fullyQualifiedName'
        );
        const sourceColName = `${sourceTableFqn}.${get(
          table1,
          'entityResponseData.columns[0].name'
        )}`;

        const targetTableFqn = get(
          table2,
          'entityResponseData.fullyQualifiedName'
        );
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
            `[data-testid="column-edge-${sourceColName}-${targetColName}"]`
          )
          .dispatchEvent('click');

        await page.locator('.sql-function-section').waitFor({
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

        const lineageReq1 = page.waitForResponse(
          '/api/v1/lineage/getLineage?*'
        );
        await page.reload();
        await lineageReq1;

        await activateColumnLayer(page);
        await page
          .locator(
            `[data-testid="column-edge-${sourceColName}-${targetColName}"]`
          )
          .dispatchEvent('click');

        await page.locator('.edge-info-drawer').isVisible();

        await expect(
          page.locator('[data-testid="sql-function"]')
        ).toContainText('count');
      } finally {
        await Promise.all([
          table1.delete(apiContext),
          table2.delete(apiContext),
        ]);
        await afterAction();
      }
    });

    test.fixme(
      'Edges are not getting hidden when column is selected and column layer is removed',
      async ({ page }) => {
        const { apiContext, afterAction } = await getApiContext(page);
        const table1 = new TableClass();
        const table2 = new TableClass();

        try {
          await Promise.all([
            table1.create(apiContext),
            table2.create(apiContext),
          ]);

          const table1Fqn = get(
            table1,
            'entityResponseData.fullyQualifiedName'
          );
          const table2Fqn = get(
            table2,
            'entityResponseData.fullyQualifiedName'
          );

          const sourceCol = `${table1Fqn}.${get(
            table1,
            'entityResponseData.columns[0].name'
          )}`;
          const targetCol = `${table2Fqn}.${get(
            table2,
            'entityResponseData.columns[0].name'
          )}`;

          await test.step('1. Create 2 tables and create column level lineage between them.', async () => {
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
          });

          await test.step('2. Verify edge between 2 tables is visible', async () => {
            const tableEdge = page.getByTestId(
              `edge-${table1.entityResponseData.fullyQualifiedName}-${table2.entityResponseData.fullyQualifiedName}`
            );
            await expect(tableEdge).toBeVisible();
          });

          await test.step('3. Activate column layer and select a column - table edge should be hidden', async () => {
            await activateColumnLayer(page);

            const firstColumn = page.locator(
              `[data-testid="column-${sourceCol}"]`
            );
            await firstColumn.click();

            const tableEdge = page.getByTestId(
              `edge-${table1.entityResponseData.fullyQualifiedName}-${table2.entityResponseData.fullyQualifiedName}`
            );
            await expect(tableEdge).not.toBeVisible();
          });

          await test.step('4. Remove column layer - table edge should be visible again', async () => {
            const columnLayerBtn = page.locator(
              '[data-testid="lineage-layer-column-btn"]'
            );

            await page.click('[data-testid="lineage-layer-btn"]');
            await columnLayerBtn.click();
            await clickOutside(page);

            const tableEdge = page.getByTestId(
              `edge-${table1.entityResponseData.fullyQualifiedName}-${table2.entityResponseData.fullyQualifiedName}`
            );
            await expect(tableEdge).toBeVisible();
          });
        } finally {
          await Promise.all([
            table1.delete(apiContext),
            table2.delete(apiContext),
          ]);
          await afterAction();
        }
      }
    );
  });

  test.describe('Node Interaction', () => {
    test.beforeEach(async ({ page }) => {
      await table1.visitEntityPage(page);
      await visitLineageTab(page);
      await performZoomOut(page);
    });

    test('Verify node panel opens on click', async ({ page }) => {
      const topicFqn = get(topic, 'entityResponseData.fullyQualifiedName', '');

      await clickLineageNode(page, topicFqn);

      await expect(page.locator('[role="dialog"]')).toBeVisible();

      await expect(
        page
          .getByTestId('entity-summary-panel-container')
          .getByTestId('entity-header-title')
      ).toHaveText(topic.entityResponseData.displayName ?? '');

      await page.getByLabel('Close').first().click();

      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
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

        const tableFqn = get(
          table,
          'entityResponseData.fullyQualifiedName',
          ''
        );
        const tableNode = page.locator(
          `[data-testid="lineage-node-${tableFqn}"]`
        );

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
          await expect(breadcrumbItems.nth(i)).toHaveText(fqnParts[i]);
        }
      } finally {
        await table.delete(apiContext);
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
        const { apiContext, afterAction } = await getDefaultAdminAPIContext(
          browser
        );

        await Promise.all([
          table1.create(apiContext),
          table2.create(apiContext),
          table3.create(apiContext),
          table4.create(apiContext),
        ]);

        table1Fqn = get(table1, 'entityResponseData.fullyQualifiedName', '');
        table2Fqn = get(table2, 'entityResponseData.fullyQualifiedName', '');
        table3Fqn = get(table3, 'entityResponseData.fullyQualifiedName', '');
        table4Fqn = get(table4, 'entityResponseData.fullyQualifiedName', '');

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
        const { apiContext, afterAction } = await getDefaultAdminAPIContext(
          browser
        );
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

      test.fixme(
        'highlights traced node-to-node edges when a node is selected',
        async ({ page }) => {
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
        }
      );

      test.fixme(
        'hides column-to-column edges when a node is selected',
        async ({ page }) => {
          await table2.visitEntityPage(page);
          await visitLineageTab(page);
          await activateColumnLayer(page);
          await performZoomOut(page);

          const columnEdge = page.locator(
            `[data-testid="column-edge-${table1Col}-${table2Col}"]`
          );
          await expect(columnEdge).toBeVisible();

          await clickLineageNode(page, table3Fqn);

          const columnEdgeStyle = await columnEdge.getAttribute('style');

          expect(columnEdgeStyle).toContain('display: none');
        }
      );

      test.fixme(
        'grays out non-traced node-to-node edges when a node is selected',
        async ({ page }) => {
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
        }
      );

      test.fixme(
        'highlights traced column-to-column edges when a column is selected',
        async ({ page }) => {
          await table2.visitEntityPage(page);
          await visitLineageTab(page);
          await activateColumnLayer(page);
          await performZoomOut(page);

          const table1Column = page.locator(
            `[data-testid="column-${table1Col}"]`
          );
          await table1Column.click();

          const tracedColumnEdge = page.locator(
            `[data-testid="column-edge-${table1Col}-${table2Col}"]`
          );

          await expect(tracedColumnEdge).toBeVisible();

          const tracedEdgeStyle = await tracedColumnEdge.getAttribute('style');

          expect(tracedEdgeStyle).toContain('opacity: 1');
          expect(tracedEdgeStyle).not.toContain('display: none');
        }
      );

      test.fixme(
        'hides non-traced column-to-column edges when a column is selected',
        async ({ page }) => {
          await table2.visitEntityPage(page);
          await visitLineageTab(page);
          await activateColumnLayer(page);
          await performZoomOut(page);

          const table3Column = page.locator(
            `[data-testid="column-${table3Col}"]`
          );
          await table3Column.click();

          const nonTracedColumnEdge = page.locator(
            `[data-testid="column-edge-${table2Col}-${table4Col}"]`
          );

          const edgeStyle = await nonTracedColumnEdge.getAttribute('style');

          expect(edgeStyle).toContain('display: none');
        }
      );

      test.fixme(
        'grays out node-to-node edges when a column is selected',
        async ({ page }) => {
          await table2.visitEntityPage(page);
          await visitLineageTab(page);
          await activateColumnLayer(page);
          await performZoomOut(page);

          const table3Column = page.locator(
            `[data-testid="column-${table3Col}"]`
          );
          await table3Column.click();

          const nodeEdge = page.locator(
            `[data-testid="edge-${table2Fqn}-${table3Fqn}"]`
          );

          await expect(nodeEdge).toBeVisible();

          const nodeEdgeStyle = await nodeEdge.getAttribute('style');

          expect(nodeEdgeStyle).toContain('opacity: 0.3');
        }
      );
    });
  });

  test.describe('Edit Mode Operations', () => {
    test.beforeEach(async ({ page }) => {
      await table1.visitEntityPage(page);
      await visitLineageTab(page);
      await performZoomOut(page);
    });

    test('Verify edit mode with edge operations', async ({ page }) => {
      await editLineage(page);

      await clickEdgeBetweenNodes(page, table1, topic, false);

      const addPipelineBtn = page.getByTestId('add-pipeline');

      if ((await addPipelineBtn.count()) > 0) {
        await expect(addPipelineBtn).toBeVisible();
      }

      await editLineageClick(page);
    });
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

      // connect table to topic
      await connectEdgeBetweenNodesViaAPI(
        apiContext,
        {
          id: table.entityResponseData.id,
          type: 'table',
        },
        {
          id: topic.entityResponseData.id,
          type: 'topic',
        }
      );

      // connect topic to dashboard
      await connectEdgeBetweenNodesViaAPI(
        apiContext,
        {
          id: topic.entityResponseData.id,
          type: 'topic',
        },
        {
          id: dashboard.entityResponseData.id,
          type: 'dashboard',
        }
      );

      // connect dashboard to table
      await connectEdgeBetweenNodesViaAPI(
        apiContext,
        {
          id: dashboard.entityResponseData.id,
          type: 'dashboard',
        },
        {
          id: table.entityResponseData.id,
          type: 'table',
        }
      );

      await redirectToHomePage(page);
      await table.visitEntityPage(page);
      await visitLineageTab(page);

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
        .dispatchEvent('click');

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
        .dispatchEvent('click');

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
        .dispatchEvent('click');

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
        .dispatchEvent('click');
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
        .dispatchEvent('click');

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
  });
});
