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
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../../constant/config';
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
  visitLineageTab,
} from '../../../utils/lineage';
import { test } from '../../fixtures/pages';

const generateColumnsWithNames = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    name: `column_${index}_${uuid()}`,
    dataType: 'VARCHAR',
    dataLength: 100,
    dataTypeDisplay: 'varchar',
    description: `Test column ${index} for hierarchical lineage`,
  }));

const table1Columns = generateColumnsWithNames(21);
const table2Columns = generateColumnsWithNames(22);

test.describe.serial(
  'Column rendering in hierarchical lineage scenes',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
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

      const table1ColumnFqns = table1Response.entity.columns?.map(
        (column: { fullyQualifiedName: string }) => column.fullyQualifiedName
      ) as string[];
      const table2ColumnFqns = table2Response.entity.columns?.map(
        (column: { fullyQualifiedName: string }) => column.fullyQualifiedName
      ) as string[];

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
            fromColumns: [table1ColumnFqns[0]],
            toColumn: table2ColumnFqns[0],
          },
          {
            fromColumns: [table1ColumnFqns[15]],
            toColumn: table2ColumnFqns[15],
          },
        ]
      );

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
      await table1.visitEntityPage(page);
      await visitLineageTab(page);
      await activateColumnLayer(page);
      await performZoomOut(page);
    });

    test('renders bounded lineage fields without legacy pagination controls', async ({
      page,
    }) => {
      const table1Node = page.getByTestId(`lineage-node-${table1Fqn}`);
      const table2Node = page.getByTestId(`lineage-node-${table2Fqn}`);

      await expect(table1Node).toBeVisible();
      await expect(table2Node).toBeVisible();

      for (const index of [0, 15]) {
        await expect(
          page.getByTestId(`column-${table1Fqn}.${table1Columns[index].name}`)
        ).toBeVisible();
        await expect(
          page.getByTestId(`column-${table2Fqn}.${table2Columns[index].name}`)
        ).toBeVisible();
      }

      await expect(
        page.getByTestId(`column-${table1Fqn}.${table1Columns[10].name}`)
      ).not.toBeVisible();
      await expect(
        page.getByTestId(`column-${table2Fqn}.${table2Columns[10].name}`)
      ).not.toBeVisible();

      await expect(
        table1Node.getByTestId('column-scroll-up')
      ).not.toBeVisible();
      await expect(
        table1Node.getByTestId('column-scroll-down')
      ).not.toBeVisible();
      await expect(
        table2Node.getByTestId('column-scroll-up')
      ).not.toBeVisible();
      await expect(
        table2Node.getByTestId('column-scroll-down')
      ).not.toBeVisible();
    });
  }
);
