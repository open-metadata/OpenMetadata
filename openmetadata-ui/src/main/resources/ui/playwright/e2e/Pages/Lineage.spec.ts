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
import { get } from 'lodash';
import { ContainerClass } from '../../support/entity/ContainerClass';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { MlModelClass } from '../../support/entity/MlModelClass';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { SearchIndexClass } from '../../support/entity/SearchIndexClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import {
  createNewPage,
  getApiContext,
  redirectToHomePage,
} from '../../utils/common';
import {
  activateColumnLayer,
  addColumnLineage,
  addPipelineBetweenNodes,
  connectEdgeBetweenNodes,
  deleteEdge,
  deleteNode,
  editPipelineEdgeDescription,
  performZoomOut,
  removeColumnLineage,
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

test('Lineage Add Pipeline Between Tables', async ({ browser }) => {
  const { page } = await createNewPage(browser);
  const { apiContext, afterAction } = await getApiContext(page);
  const table1 = new TableClass();
  const table2 = new TableClass();
  const pipeline = new PipelineClass();
  await table1.create(apiContext);
  await table2.create(apiContext);
  await pipeline.create(apiContext);
  await redirectToHomePage(page);

  await addPipelineBetweenNodes(page, table1, table2, pipeline, true);
  await page.click('[data-testid="edit-lineage"]');
  await deleteNode(page, table2);

  await table1.delete(apiContext);
  await table2.delete(apiContext);
  await pipeline.delete(apiContext);

  await afterAction();
});

test('Lineage Pipeline Between Table and Topic', async ({ browser }) => {
  const { page } = await createNewPage(browser);
  const { apiContext, afterAction } = await getApiContext(page);
  const table = new TableClass();
  const topic = new TopicClass();
  const pipeline = new PipelineClass();
  await table.create(apiContext);
  await topic.create(apiContext);
  await pipeline.create(apiContext);
  await redirectToHomePage(page);

  await addPipelineBetweenNodes(page, table, topic, pipeline, true);
  await editPipelineEdgeDescription(
    page,
    table,
    topic,
    pipeline,
    'Test Description'
  );
  await page.click('[data-testid="edit-lineage"]');
  await deleteNode(page, topic);

  await table.delete(apiContext);
  await topic.delete(apiContext);
  await pipeline.delete(apiContext);
  await afterAction();
});

test('Verify column lineage between tables', async ({ browser }) => {
  const { page } = await createNewPage(browser);
  const { apiContext, afterAction } = await getApiContext(page);
  const table1 = new TableClass();
  const table2 = new TableClass();

  await table1.create(apiContext);
  await table2.create(apiContext);

  const sourceTableFqn = get(table1, 'entityResponseData.fullyQualifiedName');
  const sourceCol = `${sourceTableFqn}.${get(
    table1,
    'entityResponseData.columns[0].name'
  )}`;

  const targetTableFqn = get(table2, 'entityResponseData.fullyQualifiedName');
  const targetCol = `${targetTableFqn}.${get(
    table2,
    'entityResponseData.columns[0].name'
  )}`;

  await addPipelineBetweenNodes(page, table1, table2);
  await activateColumnLayer(page);

  // Add column lineage
  await addColumnLineage(page, sourceCol, targetCol);
  await page.click('[data-testid="edit-lineage"]');

  await removeColumnLineage(page, sourceCol, targetCol);
  await page.click('[data-testid="edit-lineage"]');

  await deleteNode(page, table2);
  await table1.delete(apiContext);
  await table2.delete(apiContext);

  await afterAction();
});

test('Verify column lineage between table and topic', async ({ browser }) => {
  const { page } = await createNewPage(browser);
  const { apiContext, afterAction } = await getApiContext(page);
  const table = new TableClass();
  const topic = new TopicClass();
  await table.create(apiContext);
  await topic.create(apiContext);

  const sourceTableFqn = get(table, 'entityResponseData.fullyQualifiedName');
  const sourceCol = `${sourceTableFqn}.${get(
    table,
    'entityResponseData.columns[0].name'
  )}`;
  const targetCol = get(
    topic,
    'entityResponseData.messageSchema.schemaFields[0].children[0].fullyQualifiedName'
  );

  await addPipelineBetweenNodes(page, table, topic);
  await activateColumnLayer(page);

  // Add column lineage
  await addColumnLineage(page, sourceCol, targetCol);
  await page.click('[data-testid="edit-lineage"]');

  await removeColumnLineage(page, sourceCol, targetCol);
  await page.click('[data-testid="edit-lineage"]');

  await deleteNode(page, topic);
  await table.delete(apiContext);
  await topic.delete(apiContext);

  await afterAction();
});
