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
  await page.click('[data-testid="lineage-layer-btn"]');
};

export const performZoomOut = async (page: Page) => {
  for (let i = 0; i < 5; i++) {
    const zoomOutBtn = page.locator('.react-flow__controls-zoomout');
    const enabled = await zoomOutBtn.isEnabled();
    if (enabled) {
      zoomOutBtn.click({ force: true });
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
    await page.click('[data-testid="add-pipeline"]', { force: true });
    await page.click(
      '[data-testid="add-edge-modal"] [data-testid="remove-edge-button"]',
      { force: true }
    );
  } else {
    await page.click('[data-testid="delete-button"]', { force: true });
  }

  const deleteRes = page.waitForResponse('/api/v1/lineage/**');

  await page.click(
    '[data-testid="delete-edge-confirmation-modal"] .ant-btn-primary',
    { force: true }
  );
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
    .click({ force: true });
  await page
    .locator(`[data-testid="${targetId}"] ${selector}.react-flow__handle-left`)
    .click({ force: true });

  await lineageRes;
};

export const connectEdgeBetweenNodes = async (
  page: Page,
  fromNode: EntityClass,
  toNode: EntityClass
) => {
  const type = getEntityTypeSearchIndexMapping(toNode.type);

  // const fromNodeName = get(fromNode, 'entityResponseData.name');
  const fromNodeFqn = get(fromNode, 'entityResponseData.fullyQualifiedName');
  const toNodeName = get(toNode, 'entityResponseData.name');
  const toNodeFqn = get(toNode, 'entityResponseData.fullyQualifiedName');

  const draggableIcon = page.locator(`[data-testid="${type}-draggable-icon"]`); // Replace 'cy.get' with 'page.locator'

  expect(draggableIcon).toHaveAttribute('draggable', 'true');

  const lineageDetails = page.locator('[data-testid="lineage-details"]');
  await draggableIcon.dragTo(lineageDetails, {
    targetPosition: {
      x: 200,
      y: 200,
    },
  });

  const suggestionNode = page.locator('[data-testid="suggestion-node"]');
  await suggestionNode.click();

  const suggestionNodeInput = page.locator(
    '[data-testid="suggestion-node"] input'
  );
  await suggestionNodeInput.click();

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
