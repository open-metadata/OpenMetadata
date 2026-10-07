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
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../../constant/config';
import { SidebarItem } from '../../../constant/sidebar';
import { DashboardClass } from '../../../support/entity/DashboardClass';
import { EntityClass } from '../../../support/entity/EntityClass';
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
  addLineageViaMenu,
  addPipelineBetweenNodes,
  chooseEdgeDrawerAction,
  clickEdgeBetweenNodes,
  clickLineageNode,
  connectEdgeBetweenNodesViaAPI,
  deleteNode,
  dismissLineageMapOnboarding,
  expectLineageNodeVisible,
  fitToScreen,
  openLineageMenu,
  openLineageNodeDrawer,
  removeColumnLineage,
  verifyNodePresent,
  visitLineageTab,
} from '../../../utils/lineage';
import { sidebarClick } from '../../../utils/sidebar';
import { test } from '../../fixtures/pages';

test.describe('Lineage Interactions', PLAYWRIGHT_BASIC_TEST_TAG_OBJ, () => {
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
          path: '/domains',
          value: [
            {
              type: 'domain',
              id: EntityDataClass.domain1.responseData.id,
            },
          ],
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

  test.afterEach(async ({ page }) => {
    await page.goto('about:blank', { waitUntil: 'domcontentloaded' });
  });

  test.describe('Lineage Layers Toggle', () => {
    test('Verify the column layer stays selected after reopening the menu', async ({
      page,
    }) => {
      await table1.visitEntityPage(page);
      await visitLineageTab(page);

      await page.getByTestId('lineage-layer-btn').click();

      const columnLayerBtn = page.getByTestId('lineage-layer-column-btn');

      await columnLayerBtn.click();
      await expect(columnLayerBtn).toHaveAttribute('data-selected');
      await clickOutside(page);

      await page.getByTestId('lineage-layer-btn').click();
      await expect(columnLayerBtn).toHaveAttribute('data-selected');
    });
  });

  test.describe('Edge Interaction', () => {
    test.beforeEach(async ({ page }) => {
      await table1.visitEntityPage(page);
      await visitLineageTab(page);
      await fitToScreen(page);
    });

    test('Verify edge click opens edge drawer', async ({ page }) => {
      await clickEdgeBetweenNodes(page, table1, topic, false);

      await expect(
        page.getByTestId('edge-info-drawer-container')
      ).toBeVisible();
      await expect(page.getByTestId('edge-header-title')).toBeVisible();
      await expect(page.getByTestId('edge-header-title')).toHaveText(
        'Edge Information'
      );
    });

    test('Verify edge delete button in drawer', async ({ page }) => {
      test.slow();

      const { apiContext, afterAction } = await getApiContext(page);
      const sourceTable = new TableClass();
      const targetTable = new TableClass();

      try {
        await Promise.all([
          sourceTable.create(apiContext),
          targetTable.create(apiContext),
        ]);
        const lineageResponse = await connectEdgeBetweenNodesViaAPI(
          apiContext,
          { id: sourceTable.entityResponseData.id, type: 'table' },
          { id: targetTable.entityResponseData.id, type: 'table' }
        );
        expect(lineageResponse.ok()).toBeTruthy();

        await sourceTable.visitEntityPage(page);
        await visitLineageTab(page);
        await fitToScreen(page);

        await clickEdgeBetweenNodes(page, sourceTable, targetTable, false);
        await chooseEdgeDrawerAction(page, 'Delete');

        await page
          .getByTestId('delete-edge-confirmation-modal')
          .getByTestId('confirm-button')
          .click();

        await waitForAllLoadersToDisappear(page);

        const edgeDiv = page.getByTestId(
          `edge-${sourceTable.entityResponseData.fullyQualifiedName}-${targetTable.entityResponseData.fullyQualifiedName}`
        );
        await expect(edgeDiv).not.toBeVisible();
      } finally {
        await Promise.all([
          sourceTable.delete(apiContext),
          targetTable.delete(apiContext),
        ]);
        await afterAction();
      }
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
        await addColumnLineage(page, sourceColName, targetColName, table2);

        // No reload here. The column edge only exists in the layer that
        // addColumnLineage just rendered; reloading drops it, and re-activating
        // the column layer does not bring that specific edge back. The pane
        // above the marker swallows a trusted click, so dispatch it directly.
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

        const persistedEdgeResponse = await apiContext.get(
          `/api/v1/lineage/getLineageEdge/${table1.entityResponseData.id}/${table2.entityResponseData.id}`
        );
        expect(persistedEdgeResponse.ok()).toBeTruthy();

        const persistedEdge = await persistedEdgeResponse.json();
        expect(get(persistedEdge, 'edge.columnsLineage[0].function')).toBe(
          'count'
        );
      } finally {
        await Promise.all([
          table1.delete(apiContext),
          table2.delete(apiContext),
        ]);
        await afterAction();
      }
    });

    test('Field path tracing responds to column selection and pane click', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const table1 = new TableClass();
      const table2 = new TableClass();

      try {
        await Promise.all([
          table1.create(apiContext),
          table2.create(apiContext),
        ]);

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

        await test.step('1. Create 2 tables and column level lineage between them', async () => {
          await connectEdgeBetweenNodesViaAPI(
            apiContext,
            { id: table1.entityResponseData.id, type: 'table' },
            { id: table2.entityResponseData.id, type: 'table' },
            [{ fromColumns: [sourceCol], toColumn: targetCol }]
          );

          await table1.visitEntityPage(page);
          await visitLineageTab(page);
        });

        const sourceColumn = page.getByTestId(`column-${sourceCol}`);
        const targetColumn = page.getByTestId(`column-${targetCol}`);

        await test.step('2. Turn on the column layer', async () => {
          await activateColumnLayer(page);

          await expect(sourceColumn).toBeVisible();
          await expect(targetColumn).toBeVisible();
        });

        await test.step('3. Selecting a column traces the connected field path', async () => {
          await sourceColumn.click();

          await expect(sourceColumn).toHaveClass(
            /custom-node-header-column-tracing/
          );
          await expect(targetColumn).toHaveClass(
            /custom-node-header-column-tracing/
          );
        });

        await test.step('4. Clicking the pane clears the traced field path', async () => {
          await page.locator('.react-flow__pane').dispatchEvent('click');

          await expect(sourceColumn).not.toHaveClass(
            /custom-node-header-column-tracing/
          );
          await expect(targetColumn).not.toHaveClass(
            /custom-node-header-column-tracing/
          );
        });
      } finally {
        await Promise.all([
          table1.delete(apiContext),
          table2.delete(apiContext),
        ]);
        await afterAction();
      }
    });
  });

  test.describe('Node Interaction', () => {
    test.beforeEach(async ({ page }) => {
      await table1.visitEntityPage(page);
      await visitLineageTab(page);
      await fitToScreen(page);
    });

    test('Verify node click opens the entity panel', async ({ page }) => {
      const tableFqn = get(table1, 'entityResponseData.fullyQualifiedName', '');

      await clickLineageNode(page, tableFqn);

      await expect(page.getByTestId('lineage-entity-panel')).toBeVisible();
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

        // Breadcrumbs use autoCollapse, so when the node is narrow the
        // middle crumbs fold into a "..." menu. The visible items remain
        // a contiguous prefix and suffix of the FQN path, so they must
        // appear in the original order.
        const visibleTexts = (await breadcrumbItems.allTextContents()).map(
          (text) => text.trim()
        );

        let fqnCursor = 0;
        for (const text of visibleTexts) {
          const matchIndex = fqnParts.indexOf(text, fqnCursor);
          expect(matchIndex).toBeGreaterThanOrEqual(0);
          fqnCursor = matchIndex + 1;
        }
      } finally {
        await table.delete(apiContext);
        await afterAction();
      }
    });

    test.describe('Field path interactions', () => {
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

      test('highlights traced field edges when a field is selected', async ({
        page,
      }) => {
        await table2.visitEntityPage(page);
        await visitLineageTab(page);
        await activateColumnLayer(page);
        await fitToScreen(page);

        const table1Column = page.getByTestId(`column-${table1Col}`);
        await table1Column.click();

        const tracedColumnEdge = page.getByTestId(
          `column-edge-${table1Col}-${table2Col}`
        );

        await expect(tracedColumnEdge).toBeVisible();
        await expect(tracedColumnEdge).toHaveAttribute(
          'data-edge-state',
          'traced'
        );
      });

      test('does not trace an unrelated field branch', async ({ page }) => {
        await table2.visitEntityPage(page);
        await visitLineageTab(page);
        await activateColumnLayer(page);
        await fitToScreen(page);

        const table3Column = page.getByTestId(`column-${table3Col}`);
        const table4Column = page.getByTestId(`column-${table4Col}`);
        // table3 and table4 sit on opposite sides of the graph; panning to one
        // pushes the other out of the rendered viewport, so fire the click in place.
        await table3Column.dispatchEvent('click');

        await expect(table3Column).toHaveClass(
          /custom-node-header-column-tracing/
        );
        await expect(table4Column).not.toHaveClass(
          /custom-node-header-column-tracing/
        );
      });

      test('clears field tracing when the pane is selected', async ({
        page,
      }) => {
        await table2.visitEntityPage(page);
        await visitLineageTab(page);
        await activateColumnLayer(page);
        await fitToScreen(page);

        const table3Column = page.getByTestId(`column-${table3Col}`);
        const table2Column = page.getByTestId(`column-${table2Col}`);
        await table3Column.click();

        await expect(table3Column).toHaveClass(
          /custom-node-header-column-tracing/
        );
        await expect(table2Column).toHaveClass(
          /custom-node-header-column-tracing/
        );

        await page.locator('.react-flow__pane').dispatchEvent('click');

        await expect(table3Column).not.toHaveClass(
          /custom-node-header-column-tracing/
        );
        await expect(table2Column).not.toHaveClass(
          /custom-node-header-column-tracing/
        );
      });
    });
  });

  test.describe('Edge editing', () => {
    test.beforeEach(async ({ page }) => {
      await table1.visitEntityPage(page);
      await visitLineageTab(page);
      await fitToScreen(page);
    });

    test('Verify a selected edge offers edge actions in the drawer', async ({
      page,
    }) => {
      await clickEdgeBetweenNodes(page, table1, topic, false);

      const drawer = page.getByTestId('lineage-entity-panel');
      await expect(drawer.getByTestId('edge-header-title')).toBeVisible();
      await drawer.getByTestId('edge-drawer-menu').click();

      await expect(
        page.getByRole('menuitem', { name: 'Edit Pipeline' })
      ).toBeVisible();
      await expect(
        page.getByRole('menuitem', { name: 'Delete' })
      ).toBeVisible();
    });
  });

  test.describe('Hierarchical map edit guards', () => {
    test('disables lineage editing in the LAYER band', async ({ page }) => {
      const sceneResponse = page.waitForResponse('**/api/v1/lineage/scene?*');
      await sidebarClick(page, SidebarItem.LINEAGE);
      expect((await sceneResponse).ok()).toBeTruthy();
      await dismissLineageMapOnboarding(page);

      await expect(
        page
          .getByTestId('lineage-map-band-LAYER')
          .locator('.lineage-map-rail-dot.active')
      ).toBeVisible();
      await waitForAllLoadersToDisappear(page);

      await expect(page.locator('.react-flow__node')).not.toHaveCount(0);
      await expect(page.getByTestId('lineage-node-menu')).toHaveCount(0);
    });

    test('opening the node menu offers the add-lineage popover', async ({
      page,
    }) => {
      await table1.visitEntityPage(page);
      await visitLineageTab(page);
      await fitToScreen(page);

      const topicFqn = get(topic, 'entityResponseData.fullyQualifiedName');
      const topicNode = page.getByTestId(`lineage-node-${topicFqn}`);

      await openLineageMenu(page, topicNode, 'lineage-node-menu');
      await page.getByRole('menuitem', { name: 'Edit Downstream' }).click();

      await expect(page.getByTestId('add-lineage-popover')).toBeVisible();
      await expect(page.getByTestId('lineage-entity-panel')).not.toBeVisible();
    });
  });

  test.describe('Edge removal persists across refresh', () => {
    // Focused coverage for a bug where removing a column-level lineage
    // edge only mutated local React state (setEntityLineage /
    // removeEdgeById / setColumnsHavingLineage) while the PUT
    // /api/v1/lineage silently sent the unchanged columnsLineage array
    // back to the server — so the removed edge reappeared on refresh.
    // The pattern here is: act via UI → reload → re-assert against a
    // fresh /api/v1/lineage/getLineage response.
    const sourceTable = new TableClass();
    const targetTable = new TableClass();

    let sourceFqn: string;
    let targetFqn: string;
    let sourceCol: string;
    let targetCol: string;

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await getDefaultAdminAPIContext(
        browser
      );
      await Promise.all([
        sourceTable.create(apiContext),
        targetTable.create(apiContext),
      ]);

      sourceFqn = get(sourceTable, 'entityResponseData.fullyQualifiedName');
      targetFqn = get(targetTable, 'entityResponseData.fullyQualifiedName');
      sourceCol = `${sourceFqn}.${get(
        sourceTable,
        'entityResponseData.columns[0].name'
      )}`;
      targetCol = `${targetFqn}.${get(
        targetTable,
        'entityResponseData.columns[0].name'
      )}`;

      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await Promise.all([
        sourceTable.delete(apiContext),
        targetTable.delete(apiContext),
      ]);
      await afterAction();
    });

    test('Node-to-node edge deletion persists across a page refresh', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);

      try {
        await connectEdgeBetweenNodesViaAPI(
          apiContext,
          { id: sourceTable.entityResponseData.id, type: 'table' },
          { id: targetTable.entityResponseData.id, type: 'table' }
        );

        await sourceTable.visitEntityPage(page);
        await visitLineageTab(page);
        await fitToScreen(page);

        await expect(
          page.getByTestId(`edge-${sourceFqn}-${targetFqn}`)
        ).toBeVisible();

        await clickEdgeBetweenNodes(page, sourceTable, targetTable, false);
        await chooseEdgeDrawerAction(page, 'Delete');

        const deleteRes = page.waitForResponse('/api/v1/lineage/**');
        await page
          .getByTestId('delete-edge-confirmation-modal')
          .getByTestId('confirm-button')
          .click();
        await deleteRes;

        // Reload to prove the server actually dropped the edge, not just
        // that local state was optimistically updated.
        const lineageRes = page.waitForResponse('/api/v1/lineage/getLineage?*');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await lineageRes;

        await expect(
          page.getByTestId(`edge-${sourceFqn}-${targetFqn}`)
        ).not.toBeVisible();
      } finally {
        await afterAction();
      }
    });

    test('Column-level edge deletion persists across a page refresh', async ({
      page,
    }) => {
      // Regression: before the fix in EntityLineageEdgeUtils.getColumnLineageData,
      // this assertion would flip back to visible after the reload
      // because the PUT body still contained the removed column pair.
      const { apiContext, afterAction } = await getApiContext(page);

      try {
        await connectEdgeBetweenNodesViaAPI(
          apiContext,
          { id: sourceTable.entityResponseData.id, type: 'table' },
          { id: targetTable.entityResponseData.id, type: 'table' },
          [{ fromColumns: [sourceCol], toColumn: targetCol }]
        );

        await sourceTable.visitEntityPage(page);
        await visitLineageTab(page);
        await activateColumnLayer(page);
        await fitToScreen(page);

        await expect(
          page.getByTestId(`column-edge-${sourceCol}-${targetCol}`)
        ).toBeVisible();

        // removeColumnLineage reloads and re-asserts against a fresh
        // getLineage response internally — that reload is the assertion
        // that would have failed before the fix.
        await removeColumnLineage(page, sourceCol, targetCol);
      } finally {
        await afterAction();
      }
    });
  });

  test.describe('Lineage editing from node and column menus', () => {
    const getFqn = (entity: EntityClass) =>
      get(entity, 'entityResponseData.fullyQualifiedName', '');
    const getFirstColumnFqn = (entity: TableClass) =>
      `${getFqn(entity)}.${get(entity, 'entityResponseData.columns[0].name')}`;

    test('adds an upstream table from the node menu', async ({ page }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const root = new TableClass();
      const upstream = new TableClass();

      try {
        await Promise.all([
          root.create(apiContext),
          upstream.create(apiContext),
        ]);
        await root.visitEntityPage(page);
        await visitLineageTab(page);
        await fitToScreen(page);

        await addLineageViaMenu(page, {
          trigger: page.getByTestId(`lineage-node-${getFqn(root)}`),
          direction: 'upstream',
          toEntity: upstream,
        });

        await verifyNodePresent(page, upstream);
        await expect(
          page.getByTestId(`edge-${getFqn(upstream)}-${getFqn(root)}`)
        ).toBeVisible();
      } finally {
        await Promise.all([
          root.delete(apiContext),
          upstream.delete(apiContext),
        ]);
        await afterAction();
      }
    });

    test('adds a downstream table from the node menu', async ({ page }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const root = new TableClass();
      const downstream = new TableClass();

      try {
        await Promise.all([
          root.create(apiContext),
          downstream.create(apiContext),
        ]);
        await root.visitEntityPage(page);
        await visitLineageTab(page);
        await fitToScreen(page);

        await addLineageViaMenu(page, {
          trigger: page.getByTestId(`lineage-node-${getFqn(root)}`),
          direction: 'downstream',
          toEntity: downstream,
        });

        await verifyNodePresent(page, downstream);
        await expect(
          page.getByTestId(`edge-${getFqn(root)}-${getFqn(downstream)}`)
        ).toBeVisible();
      } finally {
        await Promise.all([
          root.delete(apiContext),
          downstream.delete(apiContext),
        ]);
        await afterAction();
      }
    });

    test('adds a column-level edge from the column menu', async ({ page }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const root = new TableClass();
      const downstream = new TableClass();

      try {
        await Promise.all([
          root.create(apiContext),
          downstream.create(apiContext),
        ]);
        await root.visitEntityPage(page);
        await visitLineageTab(page);
        await activateColumnLayer(page);
        await fitToScreen(page);

        // addColumnLineage asserts the column-edge-<from>-<to> marker.
        await addColumnLineage(
          page,
          getFirstColumnFqn(root),
          getFirstColumnFqn(downstream),
          downstream
        );
      } finally {
        await Promise.all([
          root.delete(apiContext),
          downstream.delete(apiContext),
        ]);
        await afterAction();
      }
    });

    test('deletes a node from the node menu only after confirmation', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const root = new TableClass();
      const downstream = new TableClass();

      try {
        await Promise.all([
          root.create(apiContext),
          downstream.create(apiContext),
        ]);
        await connectEdgeBetweenNodesViaAPI(
          apiContext,
          { id: root.entityResponseData.id, type: 'table' },
          { id: downstream.entityResponseData.id, type: 'table' }
        );
        await root.visitEntityPage(page);
        await visitLineageTab(page);
        await fitToScreen(page);

        const downstreamNode = page.getByTestId(
          `lineage-node-${getFqn(downstream)}`
        );
        const modal = page.getByTestId('delete-node-confirmation-modal');

        await test.step('Cancel keeps the node', async () => {
          await openLineageMenu(page, downstreamNode, 'lineage-node-menu');
          await page.getByRole('menuitem', { name: 'Delete' }).click();

          await expect(modal).toBeVisible();

          await modal.getByTestId('cancel-button').click();

          await expect(modal).not.toBeVisible();
          await expect(downstreamNode).toBeVisible();
        });

        await test.step('Confirm removes the node', async () => {
          await deleteNode(page, downstream);

          await expect(downstreamNode).not.toBeVisible();
        });
      } finally {
        await Promise.all([
          root.delete(apiContext),
          downstream.delete(apiContext),
        ]);
        await afterAction();
      }
    });

    test('pressing Delete on a selected edge asks for confirmation', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const root = new TableClass();
      const downstream = new TableClass();

      try {
        await Promise.all([
          root.create(apiContext),
          downstream.create(apiContext),
        ]);
        await connectEdgeBetweenNodesViaAPI(
          apiContext,
          { id: root.entityResponseData.id, type: 'table' },
          { id: downstream.entityResponseData.id, type: 'table' }
        );
        await root.visitEntityPage(page);
        await visitLineageTab(page);
        await fitToScreen(page);

        await clickEdgeBetweenNodes(page, root, downstream, false);
        const drawer = page.getByTestId('lineage-entity-panel');
        await drawer.getByTestId('drawer-close-icon').click();
        await expect(drawer).not.toBeVisible();
        await page.keyboard.press('Delete');

        await expect(
          page.getByTestId('delete-edge-confirmation-modal')
        ).toBeVisible();
      } finally {
        await Promise.all([
          root.delete(apiContext),
          downstream.delete(apiContext),
        ]);
        await afterAction();
      }
    });

    test('pressing Delete on a selected node asks for confirmation', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const root = new TableClass();
      const downstream = new TableClass();

      try {
        await Promise.all([
          root.create(apiContext),
          downstream.create(apiContext),
        ]);
        await connectEdgeBetweenNodesViaAPI(
          apiContext,
          { id: root.entityResponseData.id, type: 'table' },
          { id: downstream.entityResponseData.id, type: 'table' }
        );
        await root.visitEntityPage(page);
        await visitLineageTab(page);
        await fitToScreen(page);

        await openLineageNodeDrawer(
          page,
          downstream.entityResponseData.fullyQualifiedName
        );
        const drawer = page.getByTestId('lineage-entity-panel');
        await drawer.getByTestId('drawer-close-icon').click();
        await expect(drawer).not.toBeVisible();
        await page.keyboard.press('Delete');

        const modal = page.getByTestId('delete-node-confirmation-modal');
        await expect(modal).toBeVisible();
        await modal.getByTestId('cancel-button').click();
        await expect(modal).not.toBeVisible();
        await expect(
          page.getByTestId(
            `lineage-node-${downstream.entityResponseData.fullyQualifiedName}`
          )
        ).toBeVisible();
      } finally {
        await Promise.all([
          root.delete(apiContext),
          downstream.delete(apiContext),
        ]);
        await afterAction();
      }
    });

    test('a user without EditLineage gets no node menu', async ({
      dataConsumerPage,
    }) => {
      await table1.visitEntityPage(dataConsumerPage);
      await visitLineageTab(dataConsumerPage);
      await fitToScreen(dataConsumerPage);

      await expect(
        dataConsumerPage.getByTestId(`lineage-node-${getFqn(table1)}`)
      ).toBeVisible();
      await expect(
        dataConsumerPage.getByTestId(`lineage-node-${getFqn(topic)}`)
      ).toBeVisible();
      await expect(
        dataConsumerPage.getByTestId('lineage-node-menu')
      ).toHaveCount(0);
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

      await fitToScreen(page);

      await expectLineageNodeVisible(page, tableFqn);
      await expectLineageNodeVisible(page, topicFqn);
      await expect(
        page.getByTestId(`lineage-node-${dashboardFqn}`)
      ).toBeVisible();

      for (const [sourceFqn, targetFqn] of [
        [tableFqn, topicFqn],
        [topicFqn, dashboardFqn],
        [dashboardFqn, tableFqn],
      ]) {
        const cycleEdge = page.getByTestId(`edge-${sourceFqn}-${targetFqn}`);

        await expect(cycleEdge).toHaveCount(1);
        await expect(cycleEdge).toBeVisible();
      }
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
