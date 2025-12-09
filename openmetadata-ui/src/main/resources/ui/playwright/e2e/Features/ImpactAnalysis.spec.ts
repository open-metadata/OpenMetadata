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
import { DashboardClass } from '../../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../../support/entity/DashboardDataModelClass';
import { MlModelClass } from '../../support/entity/MlModelClass';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import {
  connectEdgeBetweenNodesViaAPI,
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
  test.beforeAll(async ({ browser }) => {
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

    await connectEdgeBetweenNodesViaAPI(
      apiContext,
      { id: table.entityResponseData.id, type: 'table' },
      { id: topic.entityResponseData.id, type: 'topic' },
      [
        {
          fromColumns: [
            table.columnsName[0],
            table.columnsName[1],
            table.columnsName[2],
          ],
          toColumn: table2.columnsName[0],
        },
        {
          fromColumns: [table.columnsName[3]],
          toColumn: table2.columnsName[1],
        },
        {
          fromColumns: [table.columnsName[4]],
          toColumn: table2.columnsName[1],
        },
      ]
    );

    await connectEdgeBetweenNodesViaAPI(
      apiContext,
      { id: dashboard.entityResponseData.id, type: 'dashboard' },
      { id: table.entityResponseData.id, type: 'table' },
      []
    );

    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Verify Downstream connections', async ({ page }) => {
    await table.visitEntityPage(page);
    await visitLineageTab(page);
    await page.getByRole('button', { name: 'Impact Analysis' }).click();

    // Verify Topic is visible in Impact Analysis for Downstream
    await expect(
      page.getByText(topic.entityResponseData.displayName)
    ).toBeVisible();

    // Verify Dashboard is visible in Impact Analysis for Upstream
    await page.getByText('Upstream').click();

    await expect(
      page.getByText(dashboard.entityResponseData.displayName)
    ).toBeVisible();

    await dashboard.visitEntityPage(page);
    await visitLineageTab(page);
    await page.getByRole('button', { name: 'Impact Analysis' }).click();

    // Verify Table is visible in Impact Analysis for Downstream of Dashboard
    await expect(
      page.getByText(table.entityResponseData.displayName)
    ).toBeVisible();
  });

  test('Verify Upstream connections', async ({ page }) => {
    await table.visitEntityPage(page);
    await visitLineageTab(page);
    await page.getByRole('button', { name: 'Impact Analysis' }).click();

    // Verify Dashboard is visible in Impact Analysis for Upstream
    await page.getByText('Upstream').click();

    await expect(
      page.getByText(dashboard.entityResponseData.displayName)
    ).toBeVisible();

    await topic.visitEntityPage(page);
    await visitLineageTab(page);
    await page.getByRole('button', { name: 'Impact Analysis' }).click();

    // Verify Table is visible in Impact Analysis for Upstream of Topic
    await page.getByText('Upstream').click();

    await expect(
      page.getByText(table.entityResponseData.displayName)
    ).toBeVisible();
  });

  test('Verify column level downstream connections', async ({ page }) => {
    await table.visitEntityPage(page);
    await visitLineageTab(page);
    await page.getByRole('button', { name: 'Impact Analysis' }).click();

    await page.getByRole('button', { name: 'Impact On: Table' }).click();
    const columnLineageResponse = page.waitForResponse(
      `/api/v1/lineage/getLineage?fqn=${table.entityResponseData.fullyQualifiedName}&type=table&upstreamDepth=2&downstreamDepth=2&includeDeleted=false&size=50`
    );
    await page.getByText('Column level').click();
    await columnLineageResponse;

    // Verify Topic is visible in Impact Analysis for Downstream
    const fromColumns = [
      table.columnsName[0],
      table.columnsName[1],
      table.columnsName[2],
    ];

    // Verify columns are visible in Impact Analysis for Downstream Topic
    for (const col of fromColumns) {
      await expect(page.getByText(col)).toBeVisible();
    }
  });
});
