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
import { Column } from '../../../../src/generated/entity/data/table';
import { TableClass } from '../../../support/entity/TableClass';
import {
  getDefaultAdminAPIContext,
  redirectToHomePage,
  uuid,
} from '../../../utils/common';
import {
  activateColumnLayer,
  connectEdgeBetweenNodesViaAPI,
  performZoomOut,
  toggleLineageFilters,
  visitLineageTab,
} from '../../../utils/lineage';
import { test } from '../../fixtures/pages';

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

const table1Columns = generateColumnsWithNames(21);
const table2Columns = generateColumnsWithNames(22);
test.describe.serial('Test pagination in column level lineage', () => {
  const table1 = new TableClass();
  const table2 = new TableClass();

  let table1Fqn: string;
  let table2Fqn: string;

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      browser
    );

    table1.entity.columns = table1Columns as Column[];
    table2.entity.columns = table2Columns as Column[];

    const [table1Response, table2Response] = await Promise.all([
      table1.create(apiContext),
      table2.create(apiContext),
    ]);

    table1Fqn = get(table1Response, 'entity.fullyQualifiedName');
    table2Fqn = get(table2Response, 'entity.fullyQualifiedName');

    await connectEdgeBetweenNodesViaAPI(
      apiContext,
      {
        id: table1Response.entity.id,
        type: 'table',
      },
      {
        id: table2Response.entity.id,
        type: 'table',
      }
    );

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
            toColumn: table2ColumnFqn[15],
          },
          {
            fromColumns: [table1ColumnFqn[1]],
            toColumn: table2ColumnFqn[16],
          },
          {
            fromColumns: [table1ColumnFqn[3]],
            toColumn: table2ColumnFqn[17],
          },
          {
            fromColumns: [table1ColumnFqn[4]],
            toColumn: table2ColumnFqn[17],
          },
          {
            fromColumns: [table1ColumnFqn[15]],
            toColumn: table2ColumnFqn[15],
          },
          {
            fromColumns: [table1ColumnFqn[16]],
            toColumn: table2ColumnFqn[16],
          },
          {
            fromColumns: [table1ColumnFqn[18]],
            toColumn: table2ColumnFqn[17],
          },
        ]
      );
    });

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      browser
    );
    await Promise.all([table1.delete(apiContext), table2.delete(apiContext)]);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test.beforeEach(async ({ page }) => {
    await table1.visitEntityPage(page);
    await visitLineageTab(page);
    await activateColumnLayer(page);
    await performZoomOut(page);
    await toggleLineageFilters(page, table1Fqn);
    await toggleLineageFilters(page, table2Fqn);
  });

  test('Verify column visibility across pagination pages', async ({ page }) => {
    test.slow();

    const table1Node = page.locator(
      `[data-testid="lineage-node-${table1Fqn}"]`
    );
    const table2Node = page.locator(
      `[data-testid="lineage-node-${table2Fqn}"]`
    );

    const table1NextBtn = table1Node.getByTestId('column-scroll-down');
    const table2NextBtn = table2Node.getByTestId('column-scroll-down');

    const allColumnTestIds = {
      table1: table1Columns.map((col) => `column-${table1Fqn}.${col.name}`),
      table2: table2Columns.map((col) => `column-${table2Fqn}.${col.name}`),
    };

    const columnTestIds: Record<string, string[]> = {
      'T1-P1': allColumnTestIds.table1.slice(0, 10),
      'T1-P2': allColumnTestIds.table1.slice(10, 20),
      'T1-P3': allColumnTestIds.table1.slice(11, 21),
      'T2-P1': allColumnTestIds.table2.slice(0, 10),
      'T2-P2': allColumnTestIds.table2.slice(10, 20),
      'T2-P3': allColumnTestIds.table2.slice(12, 22),
    };

    await test.step('Verify T1-P1: C1-C10 visible, C10-C21 hidden', async () => {
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

    await test.step('Verify T2-P1: C1-C10 visible, C10-C22 hidden', async () => {
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
    const table1Node = page.getByTestId(`lineage-node-${table1Fqn}`);
    const table2Node = page.getByTestId(`lineage-node-${table2Fqn}`);

    const table1NextBtn = table1Node.getByTestId('column-scroll-down');
    const table2NextBtn = table2Node.getByTestId('column-scroll-down');

    await test.step('Verify T1-P1 and T2-P1: Only (T1,C1)-(T2,C1), (T1,C2)-(T2,C2), (T1,C3)-(T2,C3) edges visible', async () => {
      const visibleEdges = [
        `column-edge-${table1Fqn}.${table1Columns[0].name}-${table2Fqn}.${table2Columns[0].name}`,
        `column-edge-${table1Fqn}.${table1Columns[1].name}-${table2Fqn}.${table2Columns[1].name}`,
        `column-edge-${table1Fqn}.${table1Columns[2].name}-${table2Fqn}.${table2Columns[2].name}`,
      ];

      const hiddenEdges = [
        `column-edge-${table1Fqn}.${table1Columns[0].name}-${table2Fqn}.${table2Columns[15].name}`,
        `column-edge-${table1Fqn}.${table1Columns[1].name}-${table2Fqn}.${table2Columns[16].name}`,
        `column-edge-${table1Fqn}.${table1Columns[3].name}-${table2Fqn}.${table2Columns[17].name}`,
        `column-edge-${table1Fqn}.${table1Columns[4].name}-${table2Fqn}.${table2Columns[17].name}`,
        `column-edge-${table1Fqn}.${table1Columns[15].name}-${table2Fqn}.${table2Columns[15].name}`,
        `column-edge-${table1Fqn}.${table1Columns[16].name}-${table2Fqn}.${table2Columns[16].name}`,
        `column-edge-${table1Fqn}.${table1Columns[18].name}-${table2Fqn}.${table2Columns[17].name}`,
      ];

      for (const edgeId of visibleEdges) {
        await expect(page.getByTestId(edgeId)).toBeVisible();
      }

      for (const edgeId of hiddenEdges) {
        await expect(page.getByTestId(edgeId)).not.toBeVisible();
      }
    });

    await test.step('Navigate to T2-P2 and verify (T1,C1)-(T2,C6), (T1,C2)-(T2,C7), (T1,C4)-(T2,C8), (T1,C5)-(T2,C8) edges visible', async () => {
      if (await table2NextBtn.isVisible()) {
        await table2NextBtn.click();
      }

      const visibleEdges = [
        `column-edge-${table1Fqn}.${table1Columns[0].name}-${table2Fqn}.${table2Columns[15].name}`,
        `column-edge-${table1Fqn}.${table1Columns[1].name}-${table2Fqn}.${table2Columns[16].name}`,
        `column-edge-${table1Fqn}.${table1Columns[3].name}-${table2Fqn}.${table2Columns[17].name}`,
        `column-edge-${table1Fqn}.${table1Columns[4].name}-${table2Fqn}.${table2Columns[17].name}`,
      ];

      const hiddenEdges = [
        `column-edge-${table1Fqn}.${table1Columns[0].name}-${table2Fqn}.${table2Columns[0].name}`,
        `column-edge-${table1Fqn}.${table1Columns[1].name}-${table2Fqn}.${table2Columns[1].name}`,
        `column-edge-${table1Fqn}.${table1Columns[2].name}-${table2Fqn}.${table2Columns[2].name}`,
        `column-edge-${table1Fqn}.${table1Columns[15].name}-${table2Fqn}.${table2Columns[15].name}`,
        `column-edge-${table1Fqn}.${table1Columns[16].name}-${table2Fqn}.${table2Columns[16].name}`,
        `column-edge-${table1Fqn}.${table1Columns[18].name}-${table2Fqn}.${table2Columns[17].name}`,
      ];

      for (const edgeId of visibleEdges) {
        await expect(page.getByTestId(edgeId)).toBeVisible();
      }

      for (const edgeId of hiddenEdges) {
        await expect(page.getByTestId(edgeId)).not.toBeVisible();
      }
    });

    await test.step('Navigate to T1-P2 and verify (T1,C6)-(T2,C6), (T1,C7)-(T2,C7), (T1,C9)-(T2,C8) edges visible', async () => {
      if (await table1NextBtn.isVisible()) {
        await table1NextBtn.click();
      }

      const visibleEdges = [
        `column-edge-${table1Fqn}.${table1Columns[15].name}-${table2Fqn}.${table2Columns[15].name}`,
        `column-edge-${table1Fqn}.${table1Columns[16].name}-${table2Fqn}.${table2Columns[16].name}`,
        `column-edge-${table1Fqn}.${table1Columns[18].name}-${table2Fqn}.${table2Columns[17].name}`,
      ];

      const hiddenEdges = [
        `column-edge-${table1Fqn}.${table1Columns[0].name}-${table2Fqn}.${table2Columns[0].name}`,
        `column-edge-${table1Fqn}.${table1Columns[1].name}-${table2Fqn}.${table2Columns[1].name}`,
        `column-edge-${table1Fqn}.${table1Columns[2].name}-${table2Fqn}.${table2Columns[2].name}`,
        `column-edge-${table1Fqn}.${table1Columns[0].name}-${table2Fqn}.${table2Columns[15].name}`,
        `column-edge-${table1Fqn}.${table1Columns[1].name}-${table2Fqn}.${table2Columns[16].name}`,
        `column-edge-${table1Fqn}.${table1Columns[3].name}-${table2Fqn}.${table2Columns[17].name}`,
        `column-edge-${table1Fqn}.${table1Columns[4].name}-${table2Fqn}.${table2Columns[17].name}`,
      ];

      for (const edgeId of visibleEdges) {
        await expect(page.getByTestId(edgeId)).toBeVisible();
      }

      for (const edgeId of hiddenEdges) {
        await expect(page.getByTestId(edgeId)).not.toBeVisible();
      }
    });
  });

  test('Verify columns and edges when a column is hovered', async ({
    page,
  }) => {
    await test.step('Hover on (T1,C1) and verify highlighted columns and edges', async () => {
      const c1Column = page.getByTestId(
        `column-${table1Fqn}.${table1Columns[0].name}`
      );

      await c1Column.hover();

      // Verify (T1,C1), (T2,C1) and (T2,C6) are highlighted and visible
      const t1c1 = page.getByTestId(
        `column-${table1Fqn}.${table1Columns[0].name}`
      );
      const t2c1 = page.getByTestId(
        `column-${table2Fqn}.${table2Columns[0].name}`
      );
      const t2c6 = page.getByTestId(
        `column-${table2Fqn}.${table2Columns[15].name}`
      );

      await expect(t1c1).toBeVisible();
      await expect(t1c1).toHaveClass(/custom-node-header-column-tracing/);

      await expect(t2c1).toBeVisible();
      await expect(t2c1).toHaveClass(/custom-node-header-column-tracing/);

      await expect(t2c6).toBeVisible();
      await expect(t2c6).toHaveClass(/custom-node-header-column-tracing/);

      // Verify edges are visible
      const edge_t1c1_to_t2c1 = `column-edge-${table1Fqn}.${table1Columns[0].name}-${table2Fqn}.${table2Columns[0].name}`;
      const edge_t1c1_to_t2c6 = `column-edge-${table1Fqn}.${table1Columns[0].name}-${table2Fqn}.${table2Columns[15].name}`;

      await expect(page.getByTestId(edge_t1c1_to_t2c1)).toBeVisible();
      await expect(page.getByTestId(edge_t1c1_to_t2c6)).toBeVisible();
    });
  });

  test('Verify columns and edges when a column is clicked', async ({
    page,
  }) => {
    test.slow();

    await test.step('Navigate to T1-P2 and T2-P2, click (T2,C6) and verify highlighted columns and edges', async () => {
      const table1Node = page.getByTestId(`lineage-node-${table1Fqn}`);
      const table2Node = page.getByTestId(`lineage-node-${table2Fqn}`);

      // Navigate to T1-P2
      const table1NextBtn = table1Node.getByTestId('column-scroll-down');
      if (await table1NextBtn.isVisible()) {
        await table1NextBtn.click();
      }

      // Navigate to T2-P2
      const table2NextBtn = table2Node.getByTestId('column-scroll-down');
      if (await table2NextBtn.isVisible()) {
        await table2NextBtn.click();
      }

      // Click on (T2,C6)
      const t2c6Column = page.getByTestId(
        `column-${table2Fqn}.${table2Columns[15].name}`
      );
      await t2c6Column.click();

      // Verify (T1,C1), (T1,C6) and (T2,C6) are highlighted and visible
      const t1c1 = page.getByTestId(
        `column-${table1Fqn}.${table1Columns[0].name}`
      );
      const t1c6 = page.getByTestId(
        `column-${table1Fqn}.${table1Columns[15].name}`
      );
      const t2c6 = page.getByTestId(
        `column-${table2Fqn}.${table2Columns[15].name}`
      );

      await expect(t1c1).toBeVisible();
      await expect(t1c1).toHaveClass(/custom-node-header-column-tracing/);

      await expect(t1c6).toBeVisible();
      await expect(t1c6).toHaveClass(/custom-node-header-column-tracing/);

      await expect(t2c6).toBeVisible();
      await expect(t2c6).toHaveClass(/custom-node-header-column-tracing/);

      // Verify edges are visible
      const edge_t1c1_to_t2c6 = `column-edge-${table1Fqn}.${table1Columns[0].name}-${table2Fqn}.${table2Columns[15].name}`;
      const edge_t1c6_to_t2c6 = `column-edge-${table1Fqn}.${table1Columns[15].name}-${table2Fqn}.${table2Columns[15].name}`;

      await expect(page.getByTestId(edge_t1c1_to_t2c6)).toBeVisible();
      await expect(page.getByTestId(edge_t1c6_to_t2c6)).toBeVisible();
    });
  });

  test('Verify edges for column level lineage between 2 nodes when filter is toggled', async ({
    page,
  }) => {
    await test.step('1. Verify edges visible and hidden for page1 of both the tables', async () => {
      const visibleEdges = [
        `column-edge-${table1Fqn}.${table1Columns[0].name}-${table2Fqn}.${table2Columns[0].name}`,
        `column-edge-${table1Fqn}.${table1Columns[1].name}-${table2Fqn}.${table2Columns[1].name}`,
        `column-edge-${table1Fqn}.${table1Columns[2].name}-${table2Fqn}.${table2Columns[2].name}`,
      ];

      const hiddenEdges = [
        `column-edge-${table1Fqn}.${table1Columns[0].name}-${table2Fqn}.${table2Columns[15].name}`,
        `column-edge-${table1Fqn}.${table1Columns[1].name}-${table2Fqn}.${table2Columns[16].name}`,
        `column-edge-${table1Fqn}.${table1Columns[3].name}-${table2Fqn}.${table2Columns[17].name}`,
      ];

      for (const edgeId of visibleEdges) {
        await expect(page.getByTestId(edgeId)).toBeVisible();
      }

      for (const edgeId of hiddenEdges) {
        await expect(page.getByTestId(edgeId)).not.toBeVisible();
      }
    });

    await test.step('3. Enable the filter for table1 by clicking filter button', async () => {
      await toggleLineageFilters(page, table1Fqn);
    });

    await test.step('4. Verify that only columns with lineage are visible in table1', async () => {
      const columnsWithLineage = [0, 1, 2, 3, 4, 15, 16, 18];
      const columnsWithoutLineage = [7, 9, 10];

      for (const index of columnsWithLineage) {
        await expect(
          page.getByTestId(`column-${table1Fqn}.${table1Columns[index].name}`)
        ).toBeVisible();
      }

      for (const index of columnsWithoutLineage) {
        await expect(
          page.getByTestId(`column-${table1Fqn}.${table1Columns[index].name}`)
        ).not.toBeVisible();
      }
    });

    await test.step('5. Enable the filter for table2 by clicking filter button', async () => {
      await toggleLineageFilters(page, table2Fqn);
    });

    await test.step('6. Verify that only columns with lineage are visible in table2', async () => {
      const columnsWithLineage = [0, 1, 2, 15, 16, 17];
      const columnsWithoutLineage = [3, 4, 8, 9, 10, 11];

      for (const index of columnsWithLineage) {
        await expect(
          page.getByTestId(`column-${table2Fqn}.${table2Columns[index].name}`)
        ).toBeVisible();
      }

      for (const index of columnsWithoutLineage) {
        await expect(
          page.getByTestId(`column-${table2Fqn}.${table2Columns[index].name}`)
        ).not.toBeVisible();
      }
    });

    await test.step('7. Verify new edges are now visible.', async () => {
      const allVisibleEdges = [
        `column-edge-${table1Fqn}.${table1Columns[0].name}-${table2Fqn}.${table2Columns[0].name}`,
        `column-edge-${table1Fqn}.${table1Columns[1].name}-${table2Fqn}.${table2Columns[1].name}`,
        `column-edge-${table1Fqn}.${table1Columns[2].name}-${table2Fqn}.${table2Columns[2].name}`,
        `column-edge-${table1Fqn}.${table1Columns[0].name}-${table2Fqn}.${table2Columns[15].name}`,
        `column-edge-${table1Fqn}.${table1Columns[1].name}-${table2Fqn}.${table2Columns[16].name}`,
        `column-edge-${table1Fqn}.${table1Columns[3].name}-${table2Fqn}.${table2Columns[17].name}`,
        `column-edge-${table1Fqn}.${table1Columns[4].name}-${table2Fqn}.${table2Columns[17].name}`,
        `column-edge-${table1Fqn}.${table1Columns[15].name}-${table2Fqn}.${table2Columns[15].name}`,
        `column-edge-${table1Fqn}.${table1Columns[16].name}-${table2Fqn}.${table2Columns[16].name}`,
        `column-edge-${table1Fqn}.${table1Columns[18].name}-${table2Fqn}.${table2Columns[17].name}`,
      ];

      for (const edgeId of allVisibleEdges) {
        await expect(page.getByTestId(edgeId)).toBeVisible();
      }
    });
  });
});
