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

/**
 * PR-side data asset lineage suite. The parameterized "verify create lineage
 * for entity - X" loop runs for Table only (other entities run in
 * stress/Lineage/DataAssetLineageAllEntities.spec.ts — identical UI flow,
 * redundant per-PR). The non-parameterized Column Level Lineage / Temp /
 * Settings describes stay here since they provide unique coverage.
 */

import { expect } from '@playwright/test';
import { get } from 'lodash';
import { registerDataAssetLineageEntityTests } from '../../../shared/dataAssetLineageEntityTests';
import { ApiEndpointClass } from '../../../support/entity/ApiEndpointClass';
import { ContainerClass } from '../../../support/entity/ContainerClass';
import { DashboardClass } from '../../../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../../../support/entity/DashboardDataModelClass';
import { DirectoryClass } from '../../../support/entity/DirectoryClass';
import { FileClass } from '../../../support/entity/FileClass';
import { MetricClass } from '../../../support/entity/MetricClass';
import { MlModelClass } from '../../../support/entity/MlModelClass';
import { PipelineClass } from '../../../support/entity/PipelineClass';
import { SearchIndexClass } from '../../../support/entity/SearchIndexClass';
import { SpreadsheetClass } from '../../../support/entity/SpreadsheetClass';
import { StoredProcedureClass } from '../../../support/entity/StoredProcedureClass';
import { TableClass } from '../../../support/entity/TableClass';
import { TopicClass } from '../../../support/entity/TopicClass';
import { WorksheetClass } from '../../../support/entity/WorksheetClass';
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
  deleteNode,
  editLineageClick,
  getEntityColumns,
  removeColumnLineage,
  toggleLineageFilters,
  verifyColumnLineageInCSV,
  verifyPlatformLineageForEntity,
  visitLineageTab,
} from '../../../utils/lineage';
import { test } from '../../fixtures/pages';

// Contains list of entity supported
const columnLevelEntities = {
  table: TableClass,
  container: ContainerClass,
  topic: TopicClass,
  apiEndpoint: ApiEndpointClass,
  dashboard: DashboardClass,
  dashboardDataModel: DashboardDataModelClass,
  searchIndex: SearchIndexClass,
  mlModel: MlModelClass,
};

type EntityClassUnion =
  | TableClass
  | ContainerClass
  | TopicClass
  | DashboardClass
  | MlModelClass
  | PipelineClass
  | StoredProcedureClass
  | SearchIndexClass
  | DashboardDataModelClass
  | ApiEndpointClass
  | MetricClass
  | DirectoryClass
  | FileClass
  | SpreadsheetClass
  | WorksheetClass;

registerDataAssetLineageEntityTests({ table: TableClass });
test.describe('Column Level Lineage', () => {
  const entities: Map<string, EntityClassUnion> = new Map();

  test.beforeAll(
    'setup lineage creation with other entity creation',
    async ({ browser }) => {
      const { apiContext, afterAction } = await getDefaultAdminAPIContext(
        browser
      );

      Object.entries(columnLevelEntities).forEach(([key, EntityClass]) => {
        const lineageEntity = new EntityClass();

        entities.set(key, lineageEntity);
      });

      await Promise.all(
        Array.from(entities.values()).map((entity) => entity.create(apiContext))
      );

      await afterAction();
    }
  );

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  Object.entries(columnLevelEntities).forEach(([key, EntityClassSource]) => {
    const sourceEntity = new EntityClassSource();
    const entityKeys = Object.keys(columnLevelEntities);

    entityKeys.forEach((targetKey) => {
      test(`Column lineage for ${key} -> ${targetKey}`, async ({ page }) => {
        test.slow();
        const targetEntity = entities.get(targetKey) as EntityClassUnion;
        const { apiContext, afterAction } = await getApiContext(page);

        await sourceEntity.create(apiContext);

        const sourceColumns = getEntityColumns(sourceEntity, key);
        const targetColumns = getEntityColumns(targetEntity, targetKey);

        const sourceCol = get(sourceColumns, '[0].fullyQualifiedName', '');
        const targetCol = get(targetColumns, '[0].fullyQualifiedName', '');

        await test.step('Add column lineage', async () => {
          await addPipelineBetweenNodes(page, sourceEntity, targetEntity);
          await activateColumnLayer(page);

          // Add column lineage
          await addColumnLineage(page, sourceCol, targetCol);
        });

        await test.step('Column lineage export as CSV', async () => {
          // Verify column lineage
          await redirectToHomePage(page);
          await sourceEntity.visitEntityPage(page);
          await visitLineageTab(page);
          await verifyColumnLineageInCSV(
            page,
            sourceEntity,
            targetEntity,
            sourceCol,
            targetCol
          );
        });

        await test.step('Verify nodes in Platform Lineage', async () => {
          await verifyPlatformLineageForEntity(
            page,
            sourceEntity.entityResponseData.fullyQualifiedName ?? '',
            targetEntity.entityResponseData.fullyQualifiedName ?? ''
          );
        });

        await test.step('Remove column lineage', async () => {
          await sourceEntity.visitEntityPage(page);
          await visitLineageTab(page);
          await activateColumnLayer(page);
          await editLineageClick(page);

          await removeColumnLineage(page, sourceCol, targetCol);
          await editLineageClick(page);
        });

        await deleteNode(page, targetEntity);
        await sourceEntity.delete(apiContext);

        await afterAction();
      });
    });
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

      await test.step('Enter edit mode and verify column layer is active', async () => {
        await editLineageClick(page);

        await page.click('[data-testid="lineage-layer-btn"]');

        await expect(columnLayerBtn).toHaveClass(/Mui-selected/);

        await clickOutside(page);
      });
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

      const tableFqn = get(table, 'entityResponseData.fullyQualifiedName', '');
      const tableNode = page.getByTestId(`lineage-node-${tableFqn}`);
      const firstColumnName = get(
        table,
        'entityResponseData.columns[0].fullyQualifiedName'
      );
      const firstColumn = page.getByTestId(`column-${firstColumnName}`);

      await test.step('Verify node tracing is cleared on exiting edit mode', async () => {
        await editLineageClick(page);

        await expect(tableNode).not.toHaveClass(/custom-node-header-active/);

        await tableNode.click({ position: { x: 5, y: 5 } });

        await expect(tableNode).toHaveClass(/custom-node-header-active/);

        await editLineageClick(page);

        await expect(tableNode).not.toHaveClass(/custom-node-header-active/);
      });

      await test.step('Verify column tracing is cleared on exiting edit mode', async () => {
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
      });
    } finally {
      await table.delete(apiContext);
      await afterAction();
    }
  });
});

test.describe('Temp lineage table nodes', () => {
  const RAW_ORDER_FQN = 'sample_data.ecommerce_db.shopify.raw_order';
  const TEMP_TABLE_NAMES = ['tmp_order_staging', 'tmp_order_enriched'];

  test.beforeAll('verify sample data entity exists', async ({ browser }) => {
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      browser
    );

    try {
      const response = await apiContext.get(
        `/api/v1/tables/name/${encodeURIComponent(RAW_ORDER_FQN)}`
      );

      if (!response.ok()) {
        throw new Error(
          `Sample entity '${RAW_ORDER_FQN}' not found. Ensure sample data is loaded before running temp lineage tests.`
        );
      }
    } finally {
      await afterAction();
    }
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should render temp lineage table nodes on canvas', async ({ page }) => {
    await page.goto(`/table/${encodeURIComponent(RAW_ORDER_FQN)}`);
    await waitForAllLoadersToDisappear(page);

    await visitLineageTab(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByTestId('fit-screen').click();
    await page.getByRole('menuitem', { name: 'Fit to screen' }).click();

    for (const tempTableName of TEMP_TABLE_NAMES) {
      await expect(
        page.getByTestId(`lineage-node-${tempTableName}`)
      ).toBeVisible();
    }
  });
});

test.describe('Lineage Settings modal', () => {
  const table = new TableClass();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      browser
    );
    await table.create(apiContext);

    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await table.visitEntityPage(page);
    await visitLineageTab(page);
  });

  test('Verify opening config modal', async ({ page }) => {
    await page.getByTestId('lineage-config').click();

    await expect(page.locator('[role="dialog"]')).toBeVisible();

    await expect(page.getByLabel(/upstream/i)).toBeVisible();
    await expect(page.getByLabel(/downstream/i)).toBeVisible();
  });

  test('Verify updating depth configuration', async ({ page }) => {
    await page.getByTestId('lineage-config').click();

    await page.getByLabel(/upstream/i).fill('5');
    await page.getByLabel(/downstream/i).fill('4');

    const lineageResponse = page.waitForResponse(
      (request) =>
        request.url().includes('upstreamDepth=5&downstreamDepth=4') &&
        request.request().method() === 'GET'
    );

    await page.getByRole('button', { name: /Ok/i }).click();

    await lineageResponse;

    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });

  test('Verify validation for invalid depth', async ({ page }) => {
    await page.getByTestId('lineage-config').click();

    await page.getByLabel(/upstream/i).fill('-1');
    await page.getByRole('button', { name: /Ok/i }).click();

    await expect(page.getByText(/cannot be less than/i)).toBeVisible();

    await expect(page.locator('[role="dialog"]')).toBeVisible();

    await page.getByLabel(/upstream/i).fill('3');
    await page.getByRole('button', { name: /Ok/i }).click();

    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });
});
