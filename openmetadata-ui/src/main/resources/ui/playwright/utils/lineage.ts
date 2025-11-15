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
import { ApiEndpointClass } from '../support/entity/ApiEndpointClass';
import { ContainerClass } from '../support/entity/ContainerClass';
import { DashboardClass } from '../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../support/entity/DashboardDataModelClass';
import { ResponseDataType } from '../support/entity/Entity.interface';
import { EntityClass } from '../support/entity/EntityClass';
import { MetricClass } from '../support/entity/MetricClass';
import { MlModelClass } from '../support/entity/MlModelClass';
import { PipelineClass } from '../support/entity/PipelineClass';
import { SearchIndexClass } from '../support/entity/SearchIndexClass';
import { TableClass } from '../support/entity/TableClass';
import { TopicClass } from '../support/entity/TopicClass';
import {
  clickOutside,
  getApiContext,
  getEntityTypeSearchIndexMapping,
  toastNotification,
} from './common';
import { waitForAllLoadersToDisappear } from './entity';
import { parseCSV } from './entityImport';

type LineageCSVRecord = {
  fromEntityFQN: string;
  fromServiceName: string;
  fromServiceType: string;
  toEntityFQN: string;
  toServiceName: string;
  toServiceType: string;
  pipelineName: string;
};

export const LINEAGE_CSV_HEADERS = [
  'fromEntityFQN',
  'fromServiceName',
  'fromServiceType',
  'fromOwners',
  'fromDomain',
  'toEntityFQN',
  'toServiceName',
  'toServiceType',
  'toOwners',
  'toDomain',
  'fromChildEntityFQN',
  'toChildEntityFQN',
  'pipelineName',
  'pipelineType',
  'pipelineDescription',
  'pipelineOwners',
  'pipelineDomain',
  'pipelineServiceName',
  'pipelineServiceType',
];

export type LineageEdge = {
  fromEntity: {
    id: string;
    type: string;
  };
  toEntity: {
    id: string;
    type: string;
  };
  columns: {
    fromColumns: string[];
    toColumn: string;
  }[];
};

export const verifyColumnLayerInactive = async (page: Page) => {
  await page.getByTestId('lineage-layer-btn').click(); // Open Layer popover
  await page.waitForSelector(
    '[data-testid="lineage-layer-column-btn"]:not(.Mui-selected)'
  );
  await clickOutside(page); // close Layer popover
};

export const activateColumnLayer = async (page: Page) => {
  await page.click('[data-testid="lineage-layer-btn"]');
  await page.click('[data-testid="lineage-layer-column-btn"]');
  await clickOutside(page);
};

export const editLineageClick = async (page: Page) => {
  await page.getByTestId('lineage-config').click();

  await expect(
    page.getByRole('menuitem', { name: 'Edit Lineage' })
  ).toBeVisible({
    timeout: 10000,
  });

  await page.getByRole('menuitem', { name: 'Edit Lineage' }).click();
  await page.waitForTimeout(1); // wait for the edit mode to activate
  await clickOutside(page);
};

export const editLineage = async (page: Page) => {
  await editLineageClick(page);

  await expect(
    page.getByTestId('table_search_index-draggable-icon')
  ).toBeVisible();
};

export const performZoomOut = async (page: Page) => {
  const zoomOutBtn = page.getByTestId('zoom-out');
  const enabled = await zoomOutBtn.isEnabled();
  if (enabled) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _index of Array.from({ length: 10 })) {
      await zoomOutBtn.dispatchEvent('click');
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

  await page
    .locator(`[data-testid="edge-${fromNodeFqn}-${toNodeFqn}"]`)
    .dispatchEvent('click');

  await page.locator('[data-testid="add-pipeline"]').dispatchEvent('click');

  await expect(page.locator('[role="dialog"]').first()).toBeVisible();

  await page
    .locator(
      '[data-testid="add-edge-modal"] [data-testid="remove-edge-button"]'
    )
    .dispatchEvent('click');

  await expect(page.locator('[role="dialog"]').first()).toBeVisible();

  const deleteRes = page.waitForResponse('/api/v1/lineage/**');
  await page
    .locator('[data-testid="delete-edge-confirmation-modal"] .ant-btn-primary')
    .dispatchEvent('click');
  await deleteRes;
};

export const dragAndDropNode = async (
  page: Page,
  originSelector: string,
  destinationSelector: string
) => {
  await page.waitForTimeout(1000);
  const destinationElement = await page.waitForSelector(destinationSelector);
  await page.hover(originSelector);
  await page.mouse.down();
  const box = (await destinationElement.boundingBox()) as DOMRect;
  const x = box.x + 250;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps: 20 });
  await page.mouse.up();
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

export const rearrangeNodes = async (page: Page) => {
  await page.getByTestId('fit-screen').click();
  await page.getByRole('menuitem', { name: 'Rearrange Nodes' }).click();
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

  const source = `[data-testid="${type}-draggable-icon"]`;
  const target = '[data-testid="lineage-details"]';

  await dragAndDropNode(page, source, target);

  await page.locator('[data-testid="suggestion-node"]').dispatchEvent('click');

  await page.waitForLoadState('networkidle');

  const waitForSearchResponse = page.waitForResponse(
    `/api/v1/search/query?q=*&from=0&size=10&*`
  );

  await page.locator('[data-testid="suggestion-node"] input').fill(toNodeName);

  await waitForSearchResponse;

  await page
    .locator(`[data-testid="node-suggestion-${toNodeFqn}"]`)
    .dispatchEvent('click');

  await dragConnection(
    page,
    `lineage-node-${fromNodeFqn}`,
    `lineage-node-${toNodeFqn}`
  );
};

export const verifyNodePresent = async (page: Page, node: EntityClass) => {
  const nodeFqn = get(node, 'entityResponseData.fullyQualifiedName');
  const name = get(node, 'entityResponseData.displayName');
  const lineageNode = page.locator(`[data-testid="lineage-node-${nodeFqn}"]`);

  await expect(lineageNode).toBeVisible();

  const entityHeaderName = lineageNode.locator(
    '[data-testid="entity-header-display-name"]'
  );

  // this is failing
  await expect(entityHeaderName).toHaveText(name);
};

export const performExpand = async (
  page: Page,
  node: EntityClass,
  upstream: boolean,
  newNode?: EntityClass
) => {
  const nodeFqn = get(node, 'entityResponseData.fullyQualifiedName');
  const handleDirection = upstream ? 'left' : 'right';
  const expandBtn = page
    .locator(`[data-testid="lineage-node-${nodeFqn}"]`)
    .locator(`.react-flow__handle-${handleDirection}`)
    .getByTestId('plus-icon');

  if (newNode) {
    const expandRes = page.waitForResponse('/api/v1/lineage/getLineage?*');
    await expandBtn.click();
    await expandRes;
    await verifyNodePresent(page, newNode);
  }
};

export const performCollapse = async (
  page: Page,
  node: EntityClass,
  upstream: boolean,
  hiddenEntity: EntityClass[]
) => {
  const nodeFqn = get(node, 'entityResponseData.fullyQualifiedName');
  const handleDirection = upstream ? 'left' : 'right';
  const collapseBtn = page
    .locator(`[data-testid="lineage-node-${nodeFqn}"]`)
    .locator(`.react-flow__handle-${handleDirection}`)
    .getByTestId('minus-icon');

  await collapseBtn.click();

  for (const entity of hiddenEntity) {
    const hiddenNodeFqn = get(entity, 'entityResponseData.fullyQualifiedName');
    const hiddenNode = page.locator(
      `[data-testid="lineage-node-${hiddenNodeFqn}"]`
    );

    await expect(hiddenNode).not.toBeVisible();
  }
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
    | ApiEndpointClass
    | MetricClass
    | DashboardDataModelClass
) => {
  const entities = [
    new TableClass(),
    new DashboardClass(),
    new TopicClass(),
    new MlModelClass(),
    new ContainerClass(),
    new SearchIndexClass(),
    new ApiEndpointClass(),
    new MetricClass(),
    new DashboardDataModelClass(),
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
  pipelineData: ResponseDataType,
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
  bVisitPipelinePageFromDrawer: boolean
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

  if (bVisitPipelinePageFromDrawer) {
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

  await page
    .locator(`[data-testid="edge-${fromNodeFqn}-${toNodeFqn}"]`)
    .click({ force: true });

  await page.locator('[data-testid="add-pipeline"]').dispatchEvent('click');

  const waitForSearchResponse = page.waitForResponse(
    `/api/v1/search/query?q=*`
  );

  await page
    .locator('[data-testid="add-edge-modal"] [data-testid="field-input"]')
    .fill(pipelineName);

  await waitForSearchResponse;

  await page.click(`[data-testid="pipeline-entry-${pipelineFqn}"]`);

  const saveRes = page.waitForResponse('/api/v1/lineage');
  await page.click('[data-testid="save-button"]');
  await saveRes;

  await page.waitForSelector('[data-testid="add-edge-modal"]', {
    state: 'detached',
  });
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
    await editLineageClick(page);
  }

  await expect(
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

  await editLineageClick(page);

  await expect(
    page.locator(
      `[data-testid="column-edge-${btoa(fromColumnNode)}-${btoa(
        toColumnNode
      )}"]`
    )
  ).not.toBeVisible();
};

export const visitLineageTab = async (page: Page) => {
  const lineageRes = page.waitForResponse('/api/v1/lineage/getLineage?*');
  await page.click('[data-testid="lineage"]');
  await lineageRes;
  await page.waitForLoadState('networkidle');
  await waitForAllLoadersToDisappear(page);
};

export const addPipelineBetweenNodes = async (
  page: Page,
  sourceEntity: EntityClass,
  targetEntity: EntityClass,
  pipelineItem?: PipelineClass,
  bVerifyPipeline = false
) => {
  await sourceEntity.visitEntityPage(page);
  await visitLineageTab(page);
  await editLineage(page);

  await performZoomOut(page);

  await connectEdgeBetweenNodes(page, sourceEntity, targetEntity);
  if (pipelineItem) {
    await applyPipelineFromModal(
      page,
      sourceEntity,
      targetEntity,
      pipelineItem
    );
    await editLineageClick(page);
    await verifyPipelineDataInDrawer(
      page,
      sourceEntity,
      targetEntity,
      pipelineItem,
      bVerifyPipeline
    );
  }
};

export const fillLineageConfigForm = async (
  page: Page,
  config: { upstreamDepth: number; downstreamDepth: number; layer: string }
) => {
  await page
    .getByTestId('field-upstream')
    .fill(config.upstreamDepth.toString());
  await page
    .getByTestId('field-downstream')
    .fill(config.downstreamDepth.toString());
  await page.getByTestId('field-lineage-layer').click();
  await page.locator(`.ant-select-item[title="${config.layer}"]`).click();

  const saveRes = page.waitForResponse('/api/v1/system/settings');
  await page.getByTestId('save-button').click();
  await saveRes;

  await toastNotification(page, /Lineage Config updated successfully/);
};

export const verifyColumnLayerActive = async (page: Page) => {
  await page.click('[data-testid="lineage-layer-btn"]'); // Open Layer popover
  await page.waitForSelector(
    '[data-testid="lineage-layer-column-btn"].Mui-selected'
  );
  await clickOutside(page); // Close Layer popover
};

export const verifyCSVHeaders = async (headers: string[]) => {
  LINEAGE_CSV_HEADERS.forEach((expectedHeader) => {
    expect(headers).toContain(expectedHeader);
  });
};

export const getLineageCSVData = async (page: Page) => {
  await expect(page.getByRole('button', { name: 'Export' })).toBeEnabled();

  await page.getByRole('button', { name: 'Export' }).click();

  await page.waitForSelector(
    '[data-testid="export-entity-modal"] #submit-button',
    {
      state: 'visible',
    }
  );

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click(
      '[data-testid="export-entity-modal"] button#submit-button:visible'
    ),
  ]);

  const filePath = await download.path();

  expect(filePath).not.toBeNull();

  const fileContent = await download.createReadStream();

  let fileData = '';
  for await (const item of fileContent) {
    fileData += item.toString();
  }

  const csvRows = fileData
    .split('\n')
    .map((row) => row.split(',').map((cell) => cell.replace(/"/g, '').trim()));

  const headers = csvRows[0];
  await verifyCSVHeaders(headers);

  return parseCSV(csvRows);
};

export const verifyExportLineageCSV = async (
  page: Page,
  currentEntity: EntityClass,
  entities: readonly [
    TableClass,
    DashboardClass,
    TopicClass,
    MlModelClass,
    ContainerClass,
    SearchIndexClass,
    ApiEndpointClass,
    MetricClass,
    DashboardDataModelClass
  ],
  pipeline: PipelineClass
) => {
  const parsedData = await getLineageCSVData(page);
  const currentEntityFQN = get(
    currentEntity,
    'entityResponseData.fullyQualifiedName'
  );

  const arr = [];
  for (let i = 0; i < entities.length; i++) {
    arr.push({
      fromEntityFQN: currentEntityFQN,
      fromServiceName: get(
        currentEntity,
        'entityResponseData.service.name',
        ''
      ),
      fromServiceType: get(currentEntity, 'entityResponseData.serviceType', ''),
      toEntityFQN: get(
        entities[i],
        'entityResponseData.fullyQualifiedName',
        ''
      ),
      toServiceName: get(entities[i], 'entityResponseData.service.name', ''),
      toServiceType: get(entities[i], 'entityResponseData.serviceType', ''),
      pipelineName: get(pipeline, 'entityResponseData.name', ''),
    });
  }

  arr.forEach((expectedRow: LineageCSVRecord) => {
    const matchingRow = parsedData.find((row) =>
      Object.keys(expectedRow).every(
        (key) => row[key] === expectedRow[key as keyof LineageCSVRecord]
      )
    );

    expect(matchingRow).toBeDefined(); // Ensure a matching row exists
  });
};

export const verifyExportLineagePNG = async (
  page: Page,
  isPNGSelected?: boolean
) => {
  await expect(page.getByRole('button', { name: 'Export' })).toBeEnabled();

  await page.getByRole('button', { name: 'Export' }).click();

  await page.waitForSelector(
    '[data-testid="export-entity-modal"] #submit-button',
    {
      state: 'visible',
    }
  );

  if (!isPNGSelected) {
    await page.getByTestId('export-type-select').click();
    await page.locator('.ant-select-item[title="PNG"]').click();
  }

  await expect(
    page.getByTestId('export-type-select').getByText('PNGBeta')
  ).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click(
      '[data-testid="export-entity-modal"] button#submit-button:visible'
    ),
  ]);

  const filePath = await download.path();

  expect(filePath).not.toBeNull();
};

export const verifyColumnLineageInCSV = async (
  page: Page,
  sourceEntity: EntityClass,
  targetEntity: EntityClass,
  sourceColFqn: string,
  targetColFqn: string
) => {
  const parsedData = await getLineageCSVData(page);
  const expectedRow = {
    fromEntityFQN: get(sourceEntity, 'entityResponseData.fullyQualifiedName'),
    fromServiceName: get(sourceEntity, 'entityResponseData.service.name', ''),
    fromServiceType: get(sourceEntity, 'entityResponseData.serviceType', ''),
    toEntityFQN: get(targetEntity, 'entityResponseData.fullyQualifiedName', ''),
    toServiceName: get(targetEntity, 'entityResponseData.service.name', ''),
    toServiceType: get(targetEntity, 'entityResponseData.serviceType', ''),
    fromChildEntityFQN: sourceColFqn,
    toChildEntityFQN: targetColFqn,
    pipelineName: '',
  };

  const matchingRow = parsedData.find((row) =>
    Object.keys(expectedRow).every(
      (key) => row[key] === expectedRow[key as keyof LineageCSVRecord]
    )
  );

  expect(matchingRow).toBeDefined(); // Ensure a matching row exists
};

export const verifyLineageConfig = async (page: Page) => {
  await page.click('[data-testid="lineage-config"]');
  await page.getByRole('menuitem', { name: 'Node Depth' }).click();
  await page.waitForSelector('.ant-modal-content', {
    state: 'visible',
  });

  await page.getByTestId('field-upstream').fill('-1');
  await page.getByTestId('field-downstream').fill('-1');
  await page.getByTestId('field-nodes-per-layer').fill('3');

  await page.getByText('OK').click();

  await expect(
    page.getByText('Upstream Depth size cannot be less than 0')
  ).toBeVisible();
  await expect(
    page.getByText('Downstream Depth size cannot be less than 0')
  ).toBeVisible();
  await expect(
    page.getByText('Nodes Per Layer size cannot be less than 5')
  ).toBeVisible();

  await page.getByTestId('field-upstream').fill('0');
  await page.getByTestId('field-downstream').fill('0');
  await page.getByTestId('field-nodes-per-layer').fill('5');

  const saveRes = page.waitForResponse('/api/v1/lineage/getLineage?**');
  await page.getByText('OK').click();
  await saveRes;
};
