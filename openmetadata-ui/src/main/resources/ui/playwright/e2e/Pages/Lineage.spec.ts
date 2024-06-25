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
import test from '@playwright/test';
import { ContainerClass } from '../../support/entity/ContainerClass';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { MlModelClass } from '../../support/entity/MlModelClass';
import { SearchIndexClass } from '../../support/entity/SearchIndexClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import {
  connectEdgeBetweenNodes,
  deleteEdge,
  performZoomOut,
  setupEntitiesForLineage,
  verifyColumnLayerInactive,
  verifyNodePresent,
} from '../../utils/lineage';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const entities = [
  TableClass,
  DashboardClass,
  TopicClass,
  MlModelClass,
  ContainerClass,
  SearchIndexClass,
] as const;

for (const EntityClass of entities) {
  const defaultEntity = new EntityClass();

  test(`Lineage creation from ${defaultEntity.getType()} entity`, async ({
    browser,
  }) => {
    const { page } = await createNewPage(browser);
    const { currentEntity, entities, cleanup } = await setupEntitiesForLineage(
      page,
      defaultEntity
    );

    await test.step('Should create lineage for the entity', async () => {
      await redirectToHomePage(page);
      await currentEntity.visitEntityPage(page);
      await page.click('[data-testid="lineage"]');
      await verifyColumnLayerInactive(page);
      await page.click('[data-testid="edit-lineage"]');
      await performZoomOut(page);
      for (const entity of entities) {
        await connectEdgeBetweenNodes(page, currentEntity, entity);
      }

      await redirectToHomePage(page);
      await currentEntity.visitEntityPage(page);
      await page.click('[data-testid="lineage"]');
      await page.click('.react-flow__controls-fitview', { force: true });

      for (const entity of entities) {
        await verifyNodePresent(page, entity);
      }
    });

    await test.step('Remove lineage between nodes for the entity', async () => {
      await page.click('[data-testid="edit-lineage"]');
      await performZoomOut(page);

      for (const entity of entities) {
        await deleteEdge(page, currentEntity, entity);
      }
    });

    await cleanup();
  });
}
