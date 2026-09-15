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
import { get, startCase } from 'lodash';
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
import { authenticateAdminPage } from '../../../utils/admin';
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
  applyPipelineFromModal,
  connectEdgeBetweenNodes,
  deleteEdge,
  deleteNode,
  editLineage,
  editLineageClick,
  fitToScreen,
  getEntityColumns,
  performZoomOut,
  rearrangeNodes,
  removeColumnLineage,
  verifyColumnLineageInCSV,
  verifyExportLineageCSV,
  verifyExportLineagePNG,
  verifyNodePresent,
  verifyPlatformLineageForEntity,
  visitLineageTab,
} from '../../../utils/lineage';
import { test } from '../../fixtures/pages';

// Contains list of entity supported
const allEntities = {
  table: TableClass,
  container: ContainerClass,
  topic: TopicClass,
  dashboard: DashboardClass,
  mlmodel: MlModelClass,
  pipeline: PipelineClass,
  storedProcedure: StoredProcedureClass,
  searchIndex: SearchIndexClass,
  dataModel: DashboardDataModelClass,
  apiEndpoint: ApiEndpointClass,
  metric: MetricClass,
  directory: DirectoryClass,
  file: FileClass,
  spreadsheet: SpreadsheetClass,
  worksheet: WorksheetClass,
};
const lineageSourceEntities =
  process.env.CI === 'true' &&
  process.env.PW_LINEAGE_REPRESENTATIVE_ONLY === 'true'
    ? { table: TableClass }
    : allEntities;

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

test.afterEach(async ({ page }) => {
  await page.goto('about:blank');
});

test.describe('Data asset lineage', () => {
  const pipeline = new PipelineClass();
  const entities: EntityClassUnion[] = [];

  test.beforeAll(
    'setup lineage creation with other entity creation',
    async ({ browser }) => {
      const { apiContext, afterAction } = await getDefaultAdminAPIContext(
        browser
      );

      Object.values(allEntities).forEach((EntityClass) => {
        const lineageEntity = new EntityClass();

        entities.push(lineageEntity);
      });

      await pipeline.create(apiContext);
      await Promise.all(entities.map((entity) => entity.create(apiContext)));

      await afterAction();
    }
  );

  test.beforeEach(async ({ page }) => {
    await authenticateAdminPage(page);
  });

  Object.entries(lineageSourceEntities).forEach(([key, EntityClass]) => {
    const lineageEntity = new EntityClass();

    test(`verify create lineage for entity - ${startCase(key)}`, async ({
      page,
    }) => {
      test.setTimeout(8 * 60 * 1000);
      await page.setViewportSize({ height: 1600, width: 1920 });

      await test.step('prepare entity', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        try {
          await lineageEntity.create(apiContext);
          await lineageEntity.visitEntityPage(page);
          await visitLineageTab(page);
          await editLineageClick(page);
        } finally {
          await afterAction();
        }
      });

      await test.step('should create lineage with normal edge', async () => {
        for (const entity of entities) {
          await connectEdgeBetweenNodes(page, lineageEntity, entity);
          await fitToScreen(page);
        }

        const lineageRes = page.waitForResponse('**/api/v1/lineage/scene?*');
        await page.reload();
        await lineageRes;
        await page.getByTestId('edit-lineage').waitFor({
          state: 'visible',
        });

        await waitForAllLoadersToDisappear(page);
        await page
          .getByTestId(
            `lineage-node-${lineageEntity.entityResponseData.fullyQualifiedName}`
          )
          .waitFor();
        await rearrangeNodes(page);
        await fitToScreen(page);

        for (const entity of entities) {
          await verifyNodePresent(page, entity);
        }
      });

      await test.step('Open and close the drawer for every lineage node', async () => {
        for (const entity of entities) {
          const { fullyQualifiedName, displayName, name } =
            entity.entityResponseData;
          await page
            .getByTestId(`lineage-node-${fullyQualifiedName}`)
            .getByTestId('entity-header-display-name')
            .getByRole('button')
            .click();

          const drawer = page.getByTestId('lineage-entity-panel');
          await expect(drawer.getByTestId('entity-header-title')).toHaveText(
            displayName || name
          );
          await drawer.getByTestId('drawer-close-icon').click();
          await expect(drawer).not.toBeVisible();
        }
      });

      await test.step('should create lineage with edge having pipeline', async () => {
        await editLineage(page);

        await page.getByTestId('fit-screen').click();
        await page.getByRole('menuitem', { name: 'Fit to screen' }).click();
        await performZoomOut(page, 8);
        await waitForAllLoadersToDisappear(page);

        for (const entity of entities) {
          await applyPipelineFromModal(page, lineageEntity, entity, pipeline);
        }
      });

      await test.step('Verify Lineage Export CSV', async () => {
        await editLineageClick(page);
        await waitForAllLoadersToDisappear(page);
        await fitToScreen(page);
        await verifyExportLineageCSV(page, lineageEntity, entities, pipeline);
      });

      await test.step('Verify Lineage Export PNG', async () => {
        await verifyExportLineagePNG(page);
      });

      await test.step('Remove lineage between nodes for the entity', async () => {
        const lineageRes = page.waitForResponse('**/api/v1/lineage/scene?*');
        await page.reload();
        await lineageRes;
        await waitForAllLoadersToDisappear(page);

        await editLineage(page);
        await page.getByTestId('fit-screen').click();
        await page.getByRole('menuitem', { name: 'Fit to screen' }).click();
        await waitForAllLoadersToDisappear(page);

        await fitToScreen(page);

        for (const entity of entities) {
          await deleteEdge(page, lineageEntity, entity);
        }
      });
    });
  });
});

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
    await authenticateAdminPage(page);
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

        await test.step('Add entity lineage and finish editing', async () => {
          await addPipelineBetweenNodes(page, sourceEntity, targetEntity);
          await editLineageClick(page);
        });

        await test.step('Select the field view, then edit column lineage', async () => {
          await expect(page.getByTestId('lineage-layer-btn')).toBeEnabled();
          await activateColumnLayer(page);
          await expect(page.getByTestId('lineage-layer-btn')).toBeEnabled();
          await editLineage(page);

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

  test('Verify edit mode respects the active scene band', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const table = new TableClass();

    await table.create(apiContext);

    try {
      await table.visitEntityPage(page);
      await visitLineageTab(page);

      const fieldBandBtn = page.getByTestId('lineage-layer-band-FIELD');
      const layerControl = page.locator('.lineage-map-layer-control');

      await test.step('Verify the FIELD band is inactive initially', async () => {
        await page.click('[data-testid="lineage-layer-btn"]');

        await expect(fieldBandBtn).not.toHaveAttribute('data-selected');

        await clickOutside(page);
      });

      await test.step('Disable band selection in ASSET edit mode', async () => {
        await editLineageClick(page);

        await expect(layerControl).toHaveCSS('pointer-events', 'none');
      });

      await test.step('Preserve the FIELD band when entering edit mode', async () => {
        await editLineageClick(page);
        await activateColumnLayer(page);

        await expect
          .poll(() => new URL(page.url()).searchParams.get('lineageBand'))
          .toBe('FIELD');

        await editLineageClick(page);

        await expect(layerControl).toHaveCSS('pointer-events', 'none');
        expect(new URL(page.url()).searchParams.get('lineageBand')).toBe(
          'FIELD'
        );
      });
    } finally {
      await table.delete(apiContext);
      await afterAction();
    }
  });

  test('Verify selections and traced columns are cleared on exiting edit mode', async ({
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

      await test.step('Verify node selection is cleared on exiting edit mode', async () => {
        await editLineageClick(page);

        await expect(tableNode).not.toHaveClass(/custom-node-header-active/);

        await tableNode.dispatchEvent('click');

        await expect(tableNode).toHaveClass(/custom-node-header-active/);

        await editLineageClick(page);

        await expect(tableNode).not.toHaveClass(/custom-node-header-active/);
      });

      await test.step('Verify column tracing is cleared on exiting edit mode', async () => {
        await activateColumnLayer(page);
        await editLineageClick(page);

        await firstColumn.dispatchEvent('click');

        await expect(firstColumn).toHaveClass(
          /custom-node-header-column-tracing/
        );

        await editLineageClick(page);
        await editLineageClick(page);

        await expect(firstColumn).not.toHaveClass(
          /custom-node-header-column-tracing/
        );

        await editLineageClick(page);
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
    await authenticateAdminPage(page);
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

    await page.getByLabel(/upstream/i).fill('2');
    await page.getByLabel(/downstream/i).fill('1');

    const lineageResponse = page.waitForResponse(
      (request) =>
        request.url().includes('upstreamDepth=2&downstreamDepth=1') &&
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
