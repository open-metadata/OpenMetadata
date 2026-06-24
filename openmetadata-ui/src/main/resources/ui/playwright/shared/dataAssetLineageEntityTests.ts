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
 * Helper that registers the parameterized "verify create lineage for entity"
 * tests. Sibling entities (used as edge targets in the lineage UI) are always
 * the full 15 types; the `testEntities` parameter controls which entity types
 * we parameterize the test loop over.
 *
 * Used by:
 *   - e2e/Pages/Lineage/TableLineage.spec.ts                       (PR: { table })
 *   - e2e/stress/Lineage/DataAssetLineageAllEntities.spec.ts       (Stress: 14 others)
 *
 * The non-parameterized describes from the original spec (Column Level
 * Lineage, Temp lineage table nodes, Lineage Settings modal) live inline in
 * TableLineage.spec.ts since they're not entity-redundant.
 */

import { expect } from '@playwright/test';
import { get, startCase } from 'lodash';
import { test } from '../e2e/fixtures/pages';
import { ApiEndpointClass } from '../support/entity/ApiEndpointClass';
import { ContainerClass } from '../support/entity/ContainerClass';
import { DashboardClass } from '../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../support/entity/DashboardDataModelClass';
import { DirectoryClass } from '../support/entity/DirectoryClass';
import { FileClass } from '../support/entity/FileClass';
import { MetricClass } from '../support/entity/MetricClass';
import { MlModelClass } from '../support/entity/MlModelClass';
import { PipelineClass } from '../support/entity/PipelineClass';
import { SearchIndexClass } from '../support/entity/SearchIndexClass';
import { SpreadsheetClass } from '../support/entity/SpreadsheetClass';
import { StoredProcedureClass } from '../support/entity/StoredProcedureClass';
import { TableClass } from '../support/entity/TableClass';
import { TopicClass } from '../support/entity/TopicClass';
import { WorksheetClass } from '../support/entity/WorksheetClass';
import {
  getApiContext,
  getDefaultAdminAPIContext,
  redirectToHomePage,
} from '../utils/common';
import { waitForAllLoadersToDisappear } from '../utils/entity';
import {
  applyPipelineFromModal,
  clickLineageNode,
  connectEdgeBetweenNodes,
  deleteEdge,
  editLineage,
  editLineageClick,
  performZoomOut,
  rearrangeNodes,
  verifyExportLineageCSV,
  verifyExportLineagePNG,
  verifyNodePresent,
  visitLineageTab,
} from '../utils/lineage';

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

export const registerDataAssetLineageEntityTests = (
  testEntities: Record<string, new () => EntityClassUnion>
) => {
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
      await redirectToHomePage(page);
    });

    Object.entries(testEntities).forEach(([key, EntityClass]) => {
      const lineageEntity = new EntityClass();

      test(`verify create lineage for entity - ${startCase(key)}`, async ({
        page,
      }) => {
        // 5 minute timeout
        test.setTimeout(5 * 60 * 1000);

        await test.step('prepare entity', async () => {
          const { apiContext } = await getApiContext(page);

          await lineageEntity.create(apiContext);
          await lineageEntity.visitEntityPage(page);
          await visitLineageTab(page);
          await editLineageClick(page);
        });

        await test.step('should create lineage with normal edge', async () => {
          for (const entity of entities) {
            await connectEdgeBetweenNodes(page, lineageEntity, entity);
            await rearrangeNodes(page);
            await performZoomOut(page);
          }

          const lineageRes = page.waitForResponse(
            '/api/v1/lineage/getLineage?*'
          );
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
          await performZoomOut(page);

          for (const entity of entities) {
            await verifyNodePresent(page, entity);
          }

          // Check the Entity Drawer
          await performZoomOut(page);

          for (const entity of entities) {
            const toNodeFqn = get(
              entity,
              'entityResponseData.fullyQualifiedName',
              ''
            );
            const entityName = get(
              entity,
              'entityResponseData.displayName',
              get(entity, 'entityResponseData.name', '')
            );

            await clickLineageNode(page, toNodeFqn);

            await expect(
              page
                .locator('.lineage-entity-panel')
                .getByTestId('entity-header-title')
            ).toHaveText(entityName);

            await page.getByTestId('drawer-close-icon').click();

            // Panel should not be visible after closing it
            await expect(
              page.locator('.lineage-entity-panel')
            ).not.toBeVisible();
          }
        });

        await test.step('should create lineage with edge having pipeline', async () => {
          await editLineage(page);

          await page.getByTestId('fit-screen').click();
          await page.getByRole('menuitem', { name: 'Fit to screen' }).click();
          await performZoomOut(page, 8);
          await waitForAllLoadersToDisappear(page);

          const fromNodeFqn = get(
            lineageEntity,
            'entityResponseData.fullyQualifiedName',
            ''
          );

          await clickLineageNode(page, fromNodeFqn);

          for (const entity of entities) {
            await applyPipelineFromModal(page, lineageEntity, entity, pipeline);
          }
        });

        await test.step('Verify Lineage Export CSV', async () => {
          await editLineageClick(page);
          await waitForAllLoadersToDisappear(page);
          await performZoomOut(page);
          await verifyExportLineageCSV(page, lineageEntity, entities, pipeline);
        });

        await test.step('Verify Lineage Export PNG', async () => {
          await verifyExportLineagePNG(page);
        });

        await test.step('Remove lineage between nodes for the entity', async () => {
          await editLineage(page);
          await page.getByTestId('fit-screen').click();
          await page.getByRole('menuitem', { name: 'Fit to screen' }).click();
          await waitForAllLoadersToDisappear(page);

          await performZoomOut(page);

          for (const entity of entities) {
            await deleteEdge(page, lineageEntity, entity);
          }
        });
      });
    });
  });
};
