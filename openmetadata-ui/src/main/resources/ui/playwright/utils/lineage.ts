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
import { expect, Page } from '@playwright/test';
import { get } from 'lodash';
import { ContainerClass } from '../support/entity/ContainerClass';
import { DashboardClass } from '../support/entity/DashboardClass';
import { EntityClass } from '../support/entity/EntityClass';
import { MlModelClass } from '../support/entity/MlModelClass';
import { PipelineClass } from '../support/entity/PipelineClass';
import { SearchIndexClass } from '../support/entity/SearchIndexClass';
import { TableClass } from '../support/entity/TableClass';
import { TopicClass } from '../support/entity/TopicClass';
import { getApiContext, getEntityTypeSearchIndexMapping } from './common';

export const verifyColumnLayerInactive = async (page: Page) => {
  await page.click('[data-testid="lineage-layer-btn"]'); // Open Layer popover
  await page.waitForSelector(
    '[data-testid="lineage-layer-column-btn"]:not(.active)'
  );
  await page.click('[data-testid="lineage-layer-btn"]'); // Close Layer popover
};

export const activateColumnLayer = async (page: Page) => {
  await page.click('[data-testid="lineage-layer-btn"]');
  await page.click('[data-testid="lineage-layer-column-btn"]');
};

export const performZoomOut = async (page: Page) => {
  for (let i = 0; i < 5; i++) {
    const zoomOutBtn = page.locator('.react-flow__controls-zoomout');
    const enabled = await zoomOutBtn.isEnabled();
    if (enabled) {
      zoomOutBtn.dispatchEvent('click');
    }
  }
};

export const deleteEdge = async (
  page: Page,
  fromNode: EntityClass,
  toNode: EntityClass
) => {
  const fromNodeFqn = get(fromNode, 'entityResponseData.fullyQualifiedName');
  const toNodeFqn = get(toNode, 'entityResponseData.fullyQualifiedName');

  page.click(`[data-testid="edge-${fromNodeFqn}-${toNodeFqn}"]`, {
    force: true,
  });

  if (
    ['Table', 'Topic'].indexOf(fromNode.getType()) > -1 &&
    ['Table', 'Topic'].indexOf(toNode.getType()) > -1
  ) {
    await page.locator('[data-testid="add-pipeline"]').dispatchEvent('click');
    await page
      .locator(
        '[data-testid="add-edge-modal"] [data-testid="remove-edge-button"]'
      )
      .dispatchEvent('click');
  } else {
    await page.locator('[data-testid="delete-button"]').dispatchEvent('click');
  }

  await expect(page.locator('[role="dialog"]')).toBeVisible();

  const deleteRes = page.waitForResponse('/api/v1/lineage/**');
  await page
    .locator('[data-testid="delete-edge-confirmation-modal"] .ant-btn-primary')
    .dispatchEvent('click');
  await deleteRes;
};

export const dragConnection = async (
  page: Page,
  sourceId: string,
  targetId: string,
  isColumnLineage = false
) => {
  const selector = !isColumnLineage
    ? '.lineage-node-handle'
    : '.lineage-column-node-handle';

  const lineageRes = page.waitForResponse('/api/v1/lineage');
  await page
    .locator(`[data-testid="${sourceId}"] ${selector}.react-flow__handle-right`)
    .dispatchEvent('click');
  await page
    .locator(`[data-testid="${targetId}"] ${selector}.react-flow__handle-left`)
    .dispatchEvent('click');

  await lineageRes;
};

export const connectEdgeBetweenNodes = async (
  page: Page,
  fromNode: EntityClass,
  toNode: EntityClass
) => {
  const type = getEntityTypeSearchIndexMapping(toNode.type);
  const fromNodeFqn = get(fromNode, 'entityResponseData.fullyQualifiedName');
  const toNodeName = get(toNode, 'entityResponseData.name');
  const toNodeFqn = get(toNode, 'entityResponseData.fullyQualifiedName');

  const draggableIcon = page.locator(`[data-testid="${type}-draggable-icon"]`);
  const lineageDetails = page.locator('[data-testid="lineage-details"]');
  await draggableIcon.dragTo(lineageDetails);

  const suggestionNode = page.locator('[data-testid="suggestion-node"]');
  await suggestionNode.dispatchEvent('click');

  const suggestionNodeInput = page.locator(
    '[data-testid="suggestion-node"] input'
  );
  await suggestionNodeInput.dispatchEvent('click');

  await suggestionNodeInput.fill(toNodeName);
  // await searchRes;
  const nodeSuggestion = page.locator(
    `[data-testid="node-suggestion-${toNodeFqn}"]`
  );

  await nodeSuggestion.click();

  await dragConnection(
    page,
    `lineage-node-${fromNodeFqn}`,
    `lineage-node-${toNodeFqn}`
  );
};

export const verifyNodePresent = (page: Page, node: EntityClass) => {
  const nodeFqn = get(node, 'entityResponseData.fullyQualifiedName');
  const name = get(node, 'entityResponseData.name');
  const lineageNode = page.locator(`[data-testid="lineage-node-${nodeFqn}"]`);

  expect(lineageNode).toBeVisible();

  const entityHeaderName = lineageNode.locator(
    '[data-testid="entity-header-name"]'
  );

  expect(entityHeaderName).toHaveText(name);
};

export const setupEntitiesForLineage = async (
  page: Page,
  currentEntity:
    | TableClass
    | DashboardClass
    | TopicClass
    | MlModelClass
    | ContainerClass
    | SearchIndexClass
) => {
  const entities = [
    new TableClass(),
    new DashboardClass(),
    new TopicClass(),
    new MlModelClass(),
    new ContainerClass(),
    new SearchIndexClass(),
  ] as const;

  const { apiContext, afterAction } = await getApiContext(page);
  for (const entity of entities) {
    await entity.create(apiContext);
  }

  await currentEntity.create(apiContext);

  const cleanup = async () => {
    await currentEntity.delete(apiContext);
    for (const entity of entities) {
      await entity.delete(apiContext);
    }
    await afterAction();
  };

  return { currentEntity, entities, cleanup };
};

export const editPipelineEdgeDescription = async (
  page: Page,
  fromNode: EntityClass,
  toNode: EntityClass,
  pipelineData,
  description: string
) => {
  const fromNodeFqn = get(fromNode, 'entityResponseData.fullyQualifiedName');
  const toNodeFqn = get(toNode, 'entityResponseData.fullyQualifiedName');

  await page.click(
    `[data-testid="pipeline-label-${fromNodeFqn}-${toNodeFqn}"]`
  );
  await page.locator('.edge-info-drawer').isVisible();
  await page
    .locator('.edge-info-drawer [data-testid="Edge"] a')
    .filter({ hasText: pipelineData.name });

  await page.click('.edge-info-drawer [data-testid="edit-description"]');
  await page.locator('.ProseMirror').first().click();
  await page.locator('.ProseMirror').first().clear();
  await page.locator('.ProseMirror').first().fill(description);
  const descRes = page.waitForResponse('/api/v1/lineage');
  await page.getByTestId('save').click();
  await descRes;

  await expect(
    page.getByTestId('asset-description-container').getByRole('paragraph')
  ).toContainText(description);
};

const verifyPipelineDataInDrawer = async (
  page: Page,
  fromNode: EntityClass,
  toNode: EntityClass,
  pipelineItem: PipelineClass,
  bVerifyPipelineLineage: boolean
) => {
  const fromNodeFqn = get(fromNode, 'entityResponseData.fullyQualifiedName');
  const toNodeFqn = get(toNode, 'entityResponseData.fullyQualifiedName');
  const pipelineName = get(pipelineItem, 'entityResponseData.name');

  await page.click(
    `[data-testid="pipeline-label-${fromNodeFqn}-${toNodeFqn}"]`
  );

  await page.locator('.edge-info-drawer').isVisible();
  await page
    .locator('.edge-info-drawer [data-testid="Edge"] a')
    .filter({ hasText: pipelineName });

  if (bVerifyPipelineLineage) {
    await page.locator('.edge-info-drawer [data-testid="Edge"] a').click();
    await page.click('[data-testid="lineage"]');
    await fromNode.visitEntityPage(page);
    await page.click('[data-testid="lineage"]');
  } else {
    await page.click('.edge-info-drawer .ant-drawer-header .anticon-close');
  }
};

export const applyPipelineFromModal = async (
  page: Page,
  fromNode: EntityClass,
  toNode: EntityClass,
  pipelineItem?: PipelineClass
) => {
  const fromNodeFqn = get(fromNode, 'entityResponseData.fullyQualifiedName');
  const toNodeFqn = get(toNode, 'entityResponseData.fullyQualifiedName');
  const pipelineName = get(pipelineItem, 'entityResponseData.name');
  const pipelineFqn = get(
    pipelineItem,
    'entityResponseData.fullyQualifiedName'
  );

  await page.click(`[data-testid="edge-${fromNodeFqn}-${toNodeFqn}"]`, {
    force: true,
  });

  await page.click('[data-testid="add-pipeline"]');
  const field = await page.locator(
    '[data-testid="add-edge-modal"] [data-testid="field-input"]'
  );
  await field.click();
  await field.fill(pipelineName);

  await page.click(`[data-testid="pipeline-entry-${pipelineFqn}"]`);

  const saveRes = page.waitForResponse('/api/v1/lineage');
  await page.click('[data-testid="save-button"]');
  await saveRes;
};

export const deleteNode = async (page: Page, node: EntityClass) => {
  const nodeFqn = get(node, 'entityResponseData.fullyQualifiedName');
  await page
    .locator(`[data-testid="lineage-node-${nodeFqn}"]`)
    .dispatchEvent('click');

  const lineageRes = page.waitForResponse('/api/v1/lineage/**');

  await page
    .locator('[data-testid="lineage-node-remove-btn"]')
    .dispatchEvent('click');

  await lineageRes;
};

export const addColumnLineage = async (
  page: Page,
  fromColumnNode: string,
  toColumnNode: string,
  exitEditMode = true
) => {
  const lineageRes = page.waitForResponse('/api/v1/lineage');
  await dragConnection(
    page,
    `column-${fromColumnNode}`,
    `column-${toColumnNode}`,
    true
  );
  await lineageRes;

  if (exitEditMode) {
    page.click('[data-testid="edit-lineage"]');
  }

  expect(
    page.locator(
      `[data-testid="column-edge-${btoa(fromColumnNode)}-${btoa(
        toColumnNode
      )}"]`
    )
  ).toBeVisible();
};

export const removeColumnLineage = async (
  page: Page,
  fromColumnNode: string,
  toColumnNode: string
) => {
  await page
    .locator(
      `[data-testid="column-edge-${btoa(fromColumnNode)}-${btoa(
        toColumnNode
      )}"]`
    )
    .dispatchEvent('click');

  await page.locator('[data-testid="delete-button"]').dispatchEvent('click');

  const deleteRes = page.waitForResponse('/api/v1/lineage');
  await page
    .locator('[data-testid="delete-edge-confirmation-modal"] .ant-btn-primary')
    .dispatchEvent('click');
  await deleteRes;

  await page.click('[data-testid="edit-lineage"]');

  expect(
    page.locator(
      `[data-testid="column-edge-${btoa(fromColumnNode)}-${btoa(
        toColumnNode
      )}"]`
    )
  ).not.toBeVisible();
};

export const addPipelineBetweenNodes = async (
  page: Page,
  sourceEntity: EntityClass,
  targetEntity: EntityClass,
  pipelineItem?: PipelineClass,
  bVerifyPipeline = false
) => {
  await sourceEntity.visitEntityPage(page);
  await page.click('[data-testid="lineage"]');
  await page.click('[data-testid="edit-lineage"]');

  await performZoomOut(page);

  await connectEdgeBetweenNodes(page, sourceEntity, targetEntity);
  if (pipelineItem) {
    await applyPipelineFromModal(
      page,
      sourceEntity,
      targetEntity,
      pipelineItem
    );
    await page.click('[data-testid="edit-lineage"]');
    await verifyPipelineDataInDrawer(
      page,
      sourceEntity,
      targetEntity,
      pipelineItem,
      bVerifyPipeline
    );
  }
};
