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
import { DashboardClass } from '../../../support/entity/DashboardClass';
import { EntityDataClass } from '../../../support/entity/EntityDataClass';
import { TableClass } from '../../../support/entity/TableClass';
import { TopicClass } from '../../../support/entity/TopicClass';
import { performAdminLogin } from '../../../utils/admin';
import {
  getApiContext,
  getDefaultAdminAPIContext,
  redirectToHomePage,
  toastNotification,
} from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import {
  activateColumnLayer,
  addColumnLineage,
  addPipelineBetweenNodes,
  clickEdgeBetweenNodes,
  connectEdgeBetweenNodesViaAPI,
  editLineage,
  editLineageClick,
  fitToScreen,
  removeColumnLineage,
  visitLineageTab,
} from '../../../utils/lineage';
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
    await page.goto('about:blank');
  });

  test.describe('Lineage Layers Toggle', () => {
    test('Verify the selected scene band persists after reopening the menu', async ({
      page,
    }) => {
      await table1.visitEntityPage(page);
      await visitLineageTab(page);

      await page.getByTestId('lineage-layer-btn').click();

      const fieldBandBtn = page.getByTestId('lineage-layer-band-FIELD');

      await fieldBandBtn.click();
      await expect
        .poll(() => new URL(page.url()).searchParams.get('lineageBand'))
        .toBe('FIELD');
      await waitForAllLoadersToDisappear(page);

      await page.getByTestId('lineage-layer-btn').click();
      await expect(fieldBandBtn).toHaveAttribute('data-selected');
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

      await expect(page.locator('.edge-info-drawer-container')).toBeVisible();
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
        await editLineage(page);

        await clickEdgeBetweenNodes(page, sourceTable, targetTable, false);

        const deleteBtn = page.getByTestId('add-pipeline');
        await expect(deleteBtn).toBeVisible();

        await deleteBtn.click();

        await page.getByTestId('remove-edge-button').click();

        await page.getByRole('button', { name: /confirm/i }).waitFor();
        await page.getByRole('button', { name: /confirm/i }).click();

        await waitForAllLoadersToDisappear(page);

        await editLineageClick(page);

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
        await editLineageClick(page);
        await activateColumnLayer(page);
        await editLineageClick(page);
        await addColumnLineage(page, sourceColName, targetColName);

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

        await test.step('2. Switch to the field scene', async () => {
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

    test('Verify node click drills into the field scene', async ({ page }) => {
      const tableFqn = get(table1, 'entityResponseData.fullyQualifiedName', '');

      await page
        .getByTestId(`lineage-node-${tableFqn}`)
        .click({ position: { x: 10, y: 10 } });

      await expect
        .poll(() => {
          const currentUrl = new URL(page.url());

          return {
            band: currentUrl.searchParams.get('lineageBand'),
            focus: currentUrl.searchParams.get('lineageFocus'),
          };
        })
        .toEqual({
          band: 'FIELD',
          focus: tableFqn,
        });
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
        const visibleTexts: Array<string> = [];
        for (let i = 0; i < breadcrumbCount; i++) {
          visibleTexts.push(
            (await breadcrumbItems.nth(i).textContent())?.trim() ?? ''
          );
        }

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

    test.describe('Scene path interactions', () => {
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

      test('highlights the connected asset path while a node is hovered', async ({
        page,
      }) => {
        await table2.visitEntityPage(page);
        await visitLineageTab(page);
        await fitToScreen(page);

        const table3Node = page.getByTestId(`lineage-node-${table3Fqn}`);
        await table3Node.hover();

        for (const tableFqn of [table1Fqn, table2Fqn, table3Fqn, table4Fqn]) {
          await expect(
            page.locator('.react-flow__node.lineage-path-highlight', {
              has: page.getByTestId(`lineage-node-${tableFqn}`),
            })
          ).toBeVisible();
        }
      });

      test('drills into the field scene when an asset node is selected', async ({
        page,
      }) => {
        await table2.visitEntityPage(page);
        await visitLineageTab(page);
        await fitToScreen(page);

        await page
          .getByTestId(`lineage-node-${table2Fqn}`)
          .click({ position: { x: 10, y: 10 } });

        await expect
          .poll(() => {
            const currentUrl = new URL(page.url());

            return {
              band: currentUrl.searchParams.get('lineageBand'),
              focus: currentUrl.searchParams.get('lineageFocus'),
            };
          })
          .toEqual({
            band: 'FIELD',
            focus: table2Fqn,
          });
      });

      test('clears the connected asset path after leaving a node', async ({
        page,
      }) => {
        await table2.visitEntityPage(page);
        await visitLineageTab(page);
        await fitToScreen(page);

        const table3Node = page.getByTestId(`lineage-node-${table3Fqn}`);
        const highlightedTable3Node = page.locator(
          '.react-flow__node.lineage-path-highlight',
          {
            has: table3Node,
          }
        );

        await table3Node.hover();
        await expect(highlightedTable3Node).toBeVisible();

        await page.mouse.move(5, 5);

        await expect(highlightedTable3Node).not.toBeVisible();
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
        await table3Column.click();

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

  test.describe('Edit Mode Operations', () => {
    test.beforeEach(async ({ page }) => {
      await table1.visitEntityPage(page);
      await visitLineageTab(page);
      await fitToScreen(page);
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

  test.describe('Hierarchical map edit guards', () => {
    test('disables lineage editing in the LAYER band', async ({ page }) => {
      await table1.visitEntityPage(page);
      await visitLineageTab(page);

      await page.getByTestId('lineage-map-band-LAYER').click();
      await expect
        .poll(() => new URL(page.url()).searchParams.get('lineageBand'))
        .toBe('LAYER');
      await waitForAllLoadersToDisappear(page);

      await expect(page.getByTestId('edit-lineage')).toBeDisabled();
    });

    test('suppresses semantic zoom and node drill while editing', async ({
      page,
    }) => {
      await table1.visitEntityPage(page);
      await visitLineageTab(page);
      await fitToScreen(page);
      await editLineageClick(page);

      const initialUrl = new URL(page.url());
      const topicFqn = get(topic, 'entityResponseData.fullyQualifiedName');
      const topicNode = page.getByTestId(`lineage-node-${topicFqn}`);

      await topicNode.click({ position: { x: 10, y: 10 } });
      for (let index = 0; index < 6; index++) {
        await page.getByTestId('zoom-in').dispatchEvent('click');
      }

      await expect(
        page.getByTestId('lineage-map-band-ASSET').locator('.active')
      ).toBeVisible();
      await expect
        .poll(() => {
          const currentUrl = new URL(page.url());

          return {
            band: currentUrl.searchParams.get('lineageBand'),
            focus: currentUrl.searchParams.get('lineageFocus'),
          };
        })
        .toEqual({
          band: initialUrl.searchParams.get('lineageBand'),
          focus: initialUrl.searchParams.get('lineageFocus'),
        });
    });

    test('directs aggregated-edge edits to a deeper band', async ({ page }) => {
      const sourceFqn = get(
        table1,
        'entityResponseData.fullyQualifiedName',
        ''
      );
      const targetFqn = get(topic, 'entityResponseData.fullyQualifiedName', '');
      const sourceNodeId = `table:${table1.entityResponseData.id}`;
      const targetNodeId = `topic:${topic.entityResponseData.id}`;

      await page.route('**/api/v1/lineage/scene?*', async (route) => {
        const requestUrl = new URL(route.request().url());
        if (requestUrl.searchParams.get('band') !== 'ASSET') {
          await route.continue();

          return;
        }

        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            lens: 'service',
            band: 'ASSET',
            focusFqn: sourceFqn,
            focusEntityType: 'table',
            originFqn: sourceFqn,
            originEntityType: 'table',
            nodes: [
              {
                id: sourceNodeId,
                label: sourceFqn,
                band: 'ASSET',
                levelKind: 'table',
                entityType: 'table',
                fullyQualifiedName: sourceFqn,
                isFocus: true,
                isOrigin: true,
                sourceEntity: {
                  id: table1.entityResponseData.id,
                  entityType: 'table',
                  fullyQualifiedName: sourceFqn,
                },
              },
              {
                id: targetNodeId,
                label: targetFqn,
                band: 'ASSET',
                levelKind: 'topic',
                entityType: 'topic',
                fullyQualifiedName: targetFqn,
                sourceEntity: {
                  id: topic.entityResponseData.id,
                  entityType: 'topic',
                  fullyQualifiedName: targetFqn,
                },
              },
            ],
            edges: [
              {
                id: 'aggregated-edge',
                from: sourceNodeId,
                to: targetNodeId,
                band: 'ASSET',
                isRollup: true,
                weight: 2,
              },
            ],
            breadcrumb: [],
            hiddenNodeCount: 0,
            sampled: false,
          }),
        });
      });

      await table1.visitEntityPage(page);
      await visitLineageTab(page);
      await fitToScreen(page);
      await editLineageClick(page);
      await clickEdgeBetweenNodes(page, table1, topic);

      await toastNotification(page, 'Zoom In');
    });
  });

  test.describe('Edge removal persists across refresh', () => {
    // Focused coverage for a bug where removing a column-level lineage
    // edge only mutated local React state (setEntityLineage /
    // removeEdgeById / setColumnsHavingLineage) while the PUT
    // /api/v1/lineage silently sent the unchanged columnsLineage array
    // back to the server — so the removed edge reappeared on refresh.
    // The pattern here is: act via UI → reload → re-assert against a
    // fresh /api/v1/lineage/scene response.
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

        await editLineage(page);
        await clickEdgeBetweenNodes(page, sourceTable, targetTable, false);

        await page.getByTestId('add-pipeline').click();
        await page.getByTestId('remove-edge-button').click();

        const deleteRes = page.waitForResponse('/api/v1/lineage/**');
        await page.getByRole('button', { name: /confirm/i }).click();
        await deleteRes;

        // Reload to prove the server actually dropped the edge, not just
        // that local state was optimistically updated.
        const lineageRes = page.waitForResponse('**/api/v1/lineage/scene?*');
        await page.reload();
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

        await editLineageClick(page);

        // removeColumnLineage reloads and re-asserts against a fresh
        // scene response internally — that reload is the assertion
        // that would have failed before the fix.
        await removeColumnLineage(page, sourceCol, targetCol);
      } finally {
        await afterAction();
      }
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

      await expect(page.getByTestId(`lineage-node-${tableFqn}`)).toBeVisible();
      await expect(page.getByTestId(`lineage-node-${topicFqn}`)).toBeVisible();
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
