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
import { APIRequestContext, expect, Locator, Page } from '@playwright/test';
import { escapeRegExp, get, isEmpty } from 'lodash';
import type { LineageScene } from '../../src/generated/api/lineage/lineageScene';
import { SidebarItem } from '../constant/sidebar';
import { ApiEndpointClass } from '../support/entity/ApiEndpointClass';
import { ChartClass } from '../support/entity/ChartClass';
import { ContainerClass } from '../support/entity/ContainerClass';
import { DashboardClass } from '../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../support/entity/DashboardDataModelClass';
import { DirectoryClass } from '../support/entity/DirectoryClass';
import { ResponseDataType } from '../support/entity/Entity.interface';
import { EntityClass } from '../support/entity/EntityClass';
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
  clickOutside,
  getApiContext,
  getEntityTypeSearchIndexMapping,
  selectOptionWithRetry,
  toastNotification,
} from './common';
import { waitForAllLoadersToDisappear } from './entity';
import { parseCSV } from './entityImport';
import { sidebarClick } from './sidebar';

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
  await page
    .locator('[data-testid="lineage-layer-column-btn"]:not([data-selected])')
    .waitFor();
  await clickOutside(page); // close Layer popover
};

export const activateColumnLayer = async (page: Page) => {
  await page.getByTestId('lineage-layer-btn').click();

  const fieldBandButton = page.getByTestId('lineage-layer-band-FIELD');
  if (await fieldBandButton.isVisible()) {
    const isFieldBandSelected = await fieldBandButton.evaluate((element) =>
      element.hasAttribute('data-selected')
    );
    if (!isFieldBandSelected) {
      await fieldBandButton.click();
      await expect
        .poll(() => new URL(page.url()).searchParams.get('lineageBand'))
        .toBe('FIELD');
      await waitForAllLoadersToDisappear(page);
    } else {
      await clickOutside(page);
    }

    return;
  }

  const isColumnLayerSelected = await page
    .locator('[data-testid="lineage-layer-column-btn"]')
    .evaluate((el) => el.hasAttribute('data-selected'));

  if (isColumnLayerSelected) {
    await clickOutside(page);

    return;
  }

  await page.click('[data-testid="lineage-layer-column-btn"]');
  await clickOutside(page);
};

export const performZoomOut = async (page: Page, xTimes = 10) => {
  const zoomOutBtn = page.getByTestId('zoom-out');
  const enabled = await zoomOutBtn.isEnabled();
  if (enabled) {
    for (const _index of Array.from({ length: xTimes })) {
      await zoomOutBtn.dispatchEvent('click');
    }
  }
};

/**
 * Drags the React Flow camera by (dx, dy) without touching a node.
 *
 * The grip has to be a point the pane itself owns: starting the drag on a node
 * moves that node instead of the camera, and starting it on a connection handle
 * begins drawing an edge.
 */
const panCanvas = async (page: Page, dx: number, dy: number) => {
  const paneBounds = await page.locator('.react-flow__pane').boundingBox();
  if (!paneBounds) {
    throw new Error('The lineage canvas has no bounds');
  }

  const grip = await page.evaluate((bounds) => {
    for (let row = 0.2; row <= 0.85; row += 0.1) {
      for (let column = 0.05; column <= 0.95; column += 0.05) {
        const x = bounds.x + bounds.width * column;
        const y = bounds.y + bounds.height * row;
        if (
          document
            .elementFromPoint(x, y)
            ?.classList.contains('react-flow__pane')
        ) {
          return { x, y };
        }
      }
    }

    return null;
  }, paneBounds);

  if (!grip) {
    throw new Error('The lineage canvas has no empty point to drag from');
  }

  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  await page.mouse.move(grip.x + dx, grip.y + dy, { steps: 8 });
  await page.mouse.up();
};

/**
 * Pans until the marker's midpoint is the point the canvas actually receives.
 *
 * Panels painted over the pane (the layer control, the zoom-band rail) sit
 * above the canvas while fitView measures the whole pane. A midpoint that lands
 * under one still satisfies `toBeInViewport` — that compares against the
 * viewport rectangle, not against what is painted on top — so the coordinate
 * click below goes to the panel instead: the edge is never selected, the
 * toolbar never opens, and the caller's retry loop repeats the same dead click
 * until the test times out.
 */
const clearMidpointOfOverlays = async (page: Page, marker: Locator) => {
  for (let attempt = 0; attempt < 4; attempt++) {
    const box = await marker.boundingBox();
    if (!box) {
      return false;
    }

    const shift = await page.evaluate(
      ([pointX, pointY]) => {
        const top = document.elementFromPoint(pointX, pointY);
        const flow = document.querySelector('.react-flow');
        if (!top || !flow || top.closest('.react-flow')) {
          return null;
        }

        // Climb to the outermost element that is still only the overlay: the
        // first ancestor that also wraps the canvas is the shared container,
        // and shifting by its width would throw the graph off screen.
        let overlay = top;
        while (
          overlay.parentElement &&
          overlay.parentElement !== document.body &&
          !overlay.parentElement.contains(flow)
        ) {
          overlay = overlay.parentElement;
        }
        const bounds = overlay.getBoundingClientRect();
        const margin = 8;
        const right = bounds.right - pointX + margin;
        const left = pointX - bounds.left + margin;
        const down = bounds.bottom - pointY + margin;
        const up = pointY - bounds.top + margin;
        const dx = right <= left ? right : -left;
        const dy = down <= up ? down : -up;

        return Math.abs(dx) <= Math.abs(dy) ? { dx, dy: 0 } : { dx: 0, dy };
      },
      [box.x + box.width / 2, box.y + box.height / 2]
    );

    if (!shift) {
      return true;
    }

    await panCanvas(page, shift.dx, shift.dy);
  }

  return false;
};

const clickCanvasEdge = async (page: Page, marker: Locator) => {
  await fitToScreen(page);
  await expect(marker).toBeInViewport();
  const viewport = page.locator('.react-flow__viewport');
  const getZoom = () =>
    viewport.evaluate(
      (element) => new DOMMatrix(getComputedStyle(element).transform).a
    );
  const zoom = await getZoom();
  const initialBounds = await marker.boundingBox();
  if (!initialBounds) {
    throw new Error('The canvas edge midpoint has no bounds');
  }

  // At overview scale neighbouring curves collapse into the same screen pixel.
  // Zoom around this edge before clicking, using React Flow's wheel interaction.
  if (zoom < 1) {
    await page.mouse.move(
      initialBounds.x + initialBounds.width / 2,
      initialBounds.y + initialBounds.height / 2
    );
    await page.mouse.wheel(0, -500 * Math.log2(1 / zoom));
    await expect.poll(getZoom).toBeGreaterThanOrEqual(0.99);
  }

  expect(
    await clearMidpointOfOverlays(page, marker),
    'the edge midpoint stayed behind an overlay'
  ).toBe(true);

  await expect(marker).toBeInViewport();

  // The click below is by screen coordinate, so the midpoint has to stop moving
  // first. React Flow re-lays the graph out after every deletion, and a box read
  // while that is in flight puts the click on a NEIGHBOURING edge -- which still
  // opens a toolbar and still deletes something, just not the edge asked for.
  // Hold until two consecutive reads agree before taking the coordinates.
  let previous: { x: number; y: number } | null = null;
  await expect
    .poll(
      async () => {
        const box = await marker.boundingBox();
        if (!box) {
          previous = null;

          return false;
        }
        const settled =
          previous !== null &&
          Math.abs(box.x - previous.x) < 1 &&
          Math.abs(box.y - previous.y) < 1;
        previous = { x: box.x, y: box.y };

        return settled;
      },
      { timeout: 15_000 }
    )
    .toBe(true);

  const bounds = await marker.boundingBox();
  if (!bounds) {
    throw new Error('The canvas edge midpoint has no bounds');
  }

  // Canvas edges receive real pointer events through the React Flow pane above
  // the test-only midpoint marker, rather than through the marker's DOM button.
  await page.mouse.click(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2
  );
};

// computeEdgeDataTestId only names the midpoint marker `pipeline-label-*` once
// the edge's own details have loaded — the scene returns skeletal edges and each
// pipeline arrives later via getLineageEdge. Until then the same marker still
// carries the plain `edge-*` id. Exactly one is present for a given edge and
// both open the same toolbar, so accept either rather than racing the hydration.
const edgeMarker = (
  page: Page,
  fromNodeFqn: string | undefined,
  toNodeFqn: string | undefined,
  isPipeline: boolean
) => {
  const plainEdge = page.getByTestId(`edge-${fromNodeFqn}-${toNodeFqn}`);

  return isPipeline
    ? page
        .getByTestId(`pipeline-label-${fromNodeFqn}-${toNodeFqn}`)
        .or(plainEdge)
    : plainEdge;
};

export const clickEdgeBetweenNodes = async (
  page: Page,
  fromNode: EntityClass,
  toNode: EntityClass,
  isPipeline = false
) => {
  const fromNodeFqn = get(fromNode, 'entityResponseData.fullyQualifiedName');
  const toNodeFqn = get(toNode, 'entityResponseData.fullyQualifiedName');

  await clickCanvasEdge(
    page,
    edgeMarker(page, fromNodeFqn, toNodeFqn, isPipeline)
  );
};

export const clickEdgeBetweenColumns = async (
  page: Page,
  fromNodeFqn: string,
  toNodeFqn: string
) => {
  const edgeDiv = page.getByTestId(`column-edge-${fromNodeFqn}-${toNodeFqn}`);

  await clickCanvasEdge(page, edgeDiv);
};

// Edge actions live in the edge drawer's header menu. Picking one closes the
// drawer so the pipeline or delete dialog it opens is not hidden behind it.
export const chooseEdgeDrawerAction = async (
  page: Page,
  action: 'Edit Pipeline' | 'Delete'
) => {
  const drawer = page.getByTestId('lineage-entity-panel');
  await expect(drawer.getByTestId('edge-header-title')).toBeVisible();
  await drawer.getByTestId('edge-drawer-menu').click();
  await page.getByRole('menuitem', { name: action }).click();
  await expect(drawer).not.toBeVisible();
};

export const deleteEdge = async (
  page: Page,
  fromNode: EntityClass,
  toNode: EntityClass
) => {
  const drawer = page.getByTestId('lineage-entity-panel');
  const toName =
    get(toNode, 'entityResponseData.displayName') ??
    get(toNode, 'entityResponseData.name') ??
    '';

  // The edge drawer is modal and resizes the canvas as it opens and closes,
  // so edge markers are still moving when the next click lands and it can hit
  // a neighbouring edge. Only delete once the drawer shows the edge aimed at.
  await expect(async () => {
    if (await drawer.isVisible()) {
      await drawer.getByTestId('drawer-close-icon').click();
      await expect(drawer).not.toBeVisible();
    }
    await fitToScreen(page);
    await clickEdgeBetweenNodes(page, fromNode, toNode, true);
    await expect(drawer.getByTestId('edge-drawer-menu')).toBeVisible({
      timeout: 5_000,
    });
    await expect(drawer).toContainText(toName, { timeout: 2_000 });
  }).toPass({ timeout: 45_000, intervals: [1_000, 2_000, 3_000] });

  await chooseEdgeDrawerAction(page, 'Delete');

  await expect(
    page.getByTestId('delete-edge-confirmation-modal')
  ).toBeVisible();

  const deleteRes = page.waitForResponse('/api/v1/lineage/**');
  const sceneRes = page.waitForResponse('**/api/v1/lineage/scene?*');
  await page
    .locator(
      '[data-testid="delete-edge-confirmation-modal"] [data-testid="confirm-button"]'
    )
    .click();
  await deleteRes;
  await page
    .getByTestId('delete-edge-confirmation-modal')
    .waitFor({ state: 'detached' });
  await sceneRes;
};

export const deleteEdgeBetweenNodesViaAPI = (
  apiContext: APIRequestContext,
  fromNode: EntityClass,
  toNode: EntityClass
) => {
  const fromType = getEntityTypeSearchIndexMapping(fromNode.type);
  const fromId = get(fromNode, 'entityResponseData.id');
  const toType = getEntityTypeSearchIndexMapping(toNode.type);
  const toId = get(toNode, 'entityResponseData.id');

  return apiContext.delete(
    `/api/v1/lineage/${fromType}/${fromId}/${toType}/${toId}`
  );
};

/**
 * Pans the canvas so the target sits at the pane centre when it is off-screen or
 * something else is painted over its midpoint. The canvas never scrolls, so a
 * plain click cannot bring an off-screen node into view, and the panels float
 * over the pane's edges.
 */
export const panIntoCanvasView = async (page: Page, target: Locator) => {
  const isHitTarget = () =>
    target.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const top = document.elementFromPoint(
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2
      );

      return Boolean(top && element.contains(top));
    });

  if (await isHitTarget()) {
    return;
  }

  const [targetBounds, paneBounds] = await Promise.all([
    target.boundingBox(),
    page.locator('.react-flow__pane').boundingBox(),
  ]);
  if (!targetBounds || !paneBounds) {
    throw new Error('The lineage menu trigger or the canvas has no bounds');
  }

  await panCanvas(
    page,
    paneBounds.x +
      paneBounds.width / 2 -
      (targetBounds.x + targetBounds.width / 2),
    paneBounds.y +
      paneBounds.height / 2 -
      (targetBounds.y + targetBounds.height / 2)
  );
  await expect.poll(isHitTarget).toBe(true);
};

export const openLineageMenu = async (
  page: Page,
  trigger: Locator,
  menuTestId: 'lineage-node-menu' | 'lineage-column-menu'
) => {
  const menuButton = trigger.getByTestId(menuTestId);

  await panIntoCanvasView(page, menuButton);
  // The column ⋮ is only revealed by CSS hover/focus on its row.
  await trigger.hover();
  await menuButton.click();
};

// At the Field band a node lists only the columns that already carry lineage,
// and the list itself can be collapsed behind its "N Columns" chip, so a
// column about to get its first edge is usually not on the canvas yet.
export const revealColumn = async (
  page: Page,
  columnFqn: string,
  // A dashboard's columns are its charts, whose FQNs do not start with the
  // dashboard's, so callers that know the owning entity pass it in.
  ownerFqn?: string
) => {
  const column = page.getByTestId(`column-${columnFqn}`);
  if (await column.isVisible()) {
    return column;
  }

  const nodeTestIds = await page
    .locator('.react-flow__node > [data-testid^="lineage-node-"]')
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('data-testid') ?? '')
    );
  // Otherwise the owning node is the one whose FQN is the longest prefix of
  // the column's.
  const ownerTestId = ownerFqn
    ? `lineage-node-${ownerFqn}`
    : nodeTestIds
        .filter((testId) => {
          const nodeFqn = testId.slice('lineage-node-'.length);

          return columnFqn === nodeFqn || columnFqn.startsWith(`${nodeFqn}.`);
        })
        .sort((a, b) => b.length - a.length)[0];
  if (!ownerTestId) {
    throw new Error(`No lineage node on the canvas owns column ${columnFqn}`);
  }
  // A metric is its own column endpoint and has no column row to reveal.
  if (ownerTestId === `lineage-node-${columnFqn}`) {
    return page.getByTestId(ownerTestId);
  }

  const owner = page.getByTestId(ownerTestId);
  const lineageOnlyFilter = owner.locator(
    '.only-show-columns-with-lineage-filter-button.active'
  );
  if (await lineageOnlyFilter.isVisible()) {
    await panIntoCanvasView(page, lineageOnlyFilter);
    await lineageOnlyFilter.click();
    await clickOutside(page);
  }
  const collapsedColumns = owner.locator(
    '.children-info-dropdown-label.collapsed'
  );
  if (await collapsedColumns.isVisible()) {
    await panIntoCanvasView(page, collapsedColumns);
    await collapsedColumns.click();
  }

  await expect(column).toBeVisible();

  return column;
};

export const addLineageViaMenu = async (
  page: Page,
  {
    trigger,
    direction,
    toEntity,
    columnFqn,
  }: {
    trigger: Locator;
    direction: 'upstream' | 'downstream';
    toEntity: EntityClass;
    columnFqn?: string;
  }
) => {
  await openLineageMenu(
    page,
    trigger,
    columnFqn ? 'lineage-column-menu' : 'lineage-node-menu'
  );
  await page
    .getByRole('menuitem', {
      name: direction === 'upstream' ? 'Edit Upstream' : 'Edit Downstream',
    })
    .click();
  const popover = page.getByTestId('add-lineage-popover');
  await expect(popover).toBeVisible();

  // Options are keyed by search index, which is locale-independent where the
  // option labels are not.
  await popover
    .getByTestId('add-lineage-type-select')
    .getByRole('button')
    .click();
  await page
    .locator(
      `[role="listbox"]:visible [data-key="${getEntityTypeSearchIndexMapping(
        toEntity.type
      )}"]`
    )
    .click();

  const toName = get(toEntity, 'entityResponseData.name') ?? '';
  const toFqn = get(toEntity, 'entityResponseData.fullyQualifiedName') ?? '';
  const searchResponse = page.waitForResponse('/api/v1/search/query?*');
  await popover
    .getByTestId('add-lineage-entity-input')
    .getByRole('combobox')
    .fill(toName);
  await searchResponse;

  const lineageMutation = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      new URL(response.url()).pathname.endsWith('/api/v1/lineage')
  );
  // Options end with the FQN as supporting text, which tells apart entities
  // that share a name across services. Anchor it: a child container's FQN
  // starts with its parent's.
  await page
    .locator('[role="listbox"]:visible')
    .getByRole('option')
    .filter({ hasText: new RegExp(`${escapeRegExp(toFqn)}$`) })
    .click();
  if (columnFqn) {
    await popover
      .getByTestId('add-lineage-column-select')
      .getByRole('button')
      .click();
    await page
      .locator(`[role="listbox"]:visible [data-key="${columnFqn}"]`)
      .click();
  }
  const lineageResponse = await lineageMutation;
  expect(lineageResponse.ok()).toBeTruthy();
  await expect(popover).not.toBeVisible();
};

export const fitToScreen = async (page: Page) => {
  await page.getByTestId('fit-screen').click();
};

export const connectEdgeBetweenNodes = async (
  page: Page,
  fromNode: EntityClass,
  toNode: EntityClass
) => {
  const fromNodeFqn = get(fromNode, 'entityResponseData.fullyQualifiedName');
  const fromNodeId = get(fromNode, 'entityResponseData.id');
  const toNodeId = get(toNode, 'entityResponseData.id');
  const sceneRefresh = page.waitForResponse(async (response) => {
    if (
      response.request().method() !== 'GET' ||
      !new URL(response.url()).pathname.endsWith('/api/v1/lineage/scene') ||
      !response.ok()
    ) {
      return false;
    }

    const scene = (await response.json()) as LineageScene;
    const sourceSceneNode = scene.nodes.find(
      (node) =>
        (node.sourceEntity as { id?: string } | undefined)?.id === fromNodeId
    );
    const targetSceneNode = scene.nodes.find(
      (node) =>
        (node.sourceEntity as { id?: string } | undefined)?.id === toNodeId
    );

    return Boolean(
      sourceSceneNode &&
        targetSceneNode &&
        scene.edges.some(
          (edge) =>
            edge.from === sourceSceneNode.id && edge.to === targetSceneNode.id
        )
    );
  });

  await addLineageViaMenu(page, {
    trigger: page.getByTestId(`lineage-node-${fromNodeFqn}`),
    direction: 'downstream',
    toEntity: toNode,
  });
  expect((await sceneRefresh).ok()).toBeTruthy();
};

export const connectEntityEdgeBetweenNodesViaAPI = (
  apiContext: APIRequestContext,
  fromNode: EntityClass,
  toNode: EntityClass
) => {
  return connectEdgeBetweenNodesViaAPI(
    apiContext,
    {
      id: get(fromNode, 'entityResponseData.id'),
      type: getEntityTypeSearchIndexMapping(fromNode.type),
    },
    {
      id: get(toNode, 'entityResponseData.id'),
      type: getEntityTypeSearchIndexMapping(toNode.type),
    }
  );
};

export const verifyNodePresent = async (page: Page, node: EntityClass) => {
  const nodeFqn = get(node, 'entityResponseData.fullyQualifiedName');
  const name =
    get(node, 'entityResponseData.displayName') ??
    get(node, 'entityResponseData.name') ??
    '';
  const lineageNode = page.locator(`[data-testid="lineage-node-${nodeFqn}"]`);

  await lineageNode.waitFor({ state: 'attached' });
  await lineageNode.scrollIntoViewIfNeeded();

  await expect(lineageNode).toBeVisible();

  const entityHeaderName = lineageNode.locator(
    '[data-testid="entity-header-display-name"]'
  );

  await expect(entityHeaderName).toHaveText(name);
};

const verifyNodeDepth = async (
  page: Page,
  node: EntityClass,
  expectedDepth: number
) => {
  const nodeFqn = get(node, 'entityResponseData.fullyQualifiedName');
  const lineageNode = page.getByTestId(`lineage-node-${nodeFqn}`);
  await lineageNode.waitFor({ state: 'attached' });
  await lineageNode.scrollIntoViewIfNeeded();
  await expect(lineageNode).toBeVisible();
  const nodeDepth = await lineageNode.getAttribute('data-nodedepth');
  expect(Number(nodeDepth)).toBe(expectedDepth);
};

export const performExpand = async (
  page: Page,
  node: EntityClass,
  upstream: boolean,
  newNode?: EntityClass
) => {
  const nodeFqn = get(node, 'entityResponseData.fullyQualifiedName');
  const handleDirection = upstream ? 'left' : 'right';
  const nodeLocator = page.locator(`[data-testid="lineage-node-${nodeFqn}"]`);
  await nodeLocator.hover();
  const expandBtn = page
    .getByTestId(`lineage-node-${nodeFqn}`)
    .locator(`.react-flow__handle-${handleDirection}`)
    .getByTestId('plus-icon');

  const existingNodeDepth = Number(
    await page
      .getByTestId(`lineage-node-${nodeFqn}`)
      .getAttribute('data-nodedepth')
  );

  if (newNode) {
    const expandRes = page.waitForResponse('/api/v1/lineage/getLineage/*?*');
    await expandBtn.dispatchEvent('click');
    await expandRes;

    // perform a zoom out to have everything in view
    await performZoomOut(page, 5);
    await verifyNodePresent(page, newNode);
    await verifyNodeDepth(
      page,
      newNode,
      upstream ? existingNodeDepth - 1 : existingNodeDepth + 1
    );
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

  await collapseBtn.dispatchEvent('click');

  for (const entity of hiddenEntity) {
    const hiddenNodeFqn = get(entity, 'entityResponseData.fullyQualifiedName');
    const hiddenNode = page.locator(
      `[data-testid="lineage-node-${hiddenNodeFqn}"]`
    );

    await expect(hiddenNode).not.toBeVisible();
  }
};

export const verifyExpandHandleHover = async (
  page: Page,
  node: EntityClass,
  upstream: boolean
) => {
  const nodeFqn = get(node, 'entityResponseData.fullyQualifiedName');
  const handleDirection = upstream ? 'left' : 'right';
  const handle = page
    .locator(`[data-testid="lineage-node-${nodeFqn}"]`)
    .locator(
      `.react-flow__handle-${handleDirection}.lineage-node-handle-expand-all`
    );

  await handle.hover();

  const expandBtn = handle.getByTestId('lineage-expand-all-btn');
  await expect(expandBtn).toBeVisible();

  const plusIcon = handle.getByTestId('plus-icon');
  const plusBox = await plusIcon.boundingBox();
  const expandBox = await expandBtn.boundingBox();

  if (upstream) {
    expect(expandBox?.x).toBeLessThan(plusBox?.x ?? Number.MAX_VALUE);
  } else {
    expect(expandBox?.x).toBeGreaterThan(plusBox?.x ?? 0);
  }
};

export const setupEntitiesForLineage = async (
  page: Page,
  currentEntity:
    | TableClass
    | DashboardClass
    | ChartClass
    | StoredProcedureClass
    | TopicClass
    | MlModelClass
    | ContainerClass
    | SearchIndexClass
    | ApiEndpointClass
    | MetricClass
    | DashboardDataModelClass
    | DirectoryClass
    | FileClass
    | SpreadsheetClass
    | WorksheetClass
) => {
  const entities = [
    new TableClass(),
    new DashboardClass(),
    new ChartClass(),
    new StoredProcedureClass(),
    new TopicClass(),
    new MlModelClass(),
    new ContainerClass(),
    new SearchIndexClass(),
    new ApiEndpointClass(),
    new MetricClass(),
    new DashboardDataModelClass(),
    new DirectoryClass(),
    new FileClass(),
    new SpreadsheetClass(),
    new WorksheetClass(),
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
  _pipelineData: ResponseDataType,
  description: string
) => {
  const fromNodeFqn = get(fromNode, 'entityResponseData.fullyQualifiedName');
  const toNodeFqn = get(toNode, 'entityResponseData.fullyQualifiedName');

  await page.click(
    `[data-testid="pipeline-label-${fromNodeFqn}-${toNodeFqn}"]`
  );
  await page.locator('.edge-info-drawer').isVisible();

  await page.click('.edge-info-drawer [data-testid="edit-description"]');
  // The drawer opened two lines up owns the only editor in play; scoping to it
  // beats indexing into every ProseMirror instance on the page.
  const descriptionEditor = page.locator('.edge-info-drawer .ProseMirror');
  await descriptionEditor.click();
  await descriptionEditor.clear();
  await descriptionEditor.fill(description);
  const descRes = page.waitForResponse('/api/v1/lineage');
  await page.getByTestId('save').click();
  await descRes;

  await expect(
    page.getByTestId('asset-description-container').getByRole('paragraph')
  ).toContainText(description);
};

export const verifyPipelineDataInDrawer = async (
  page: Page,
  fromNode: EntityClass,
  toNode: EntityClass,
  pipelineItem: PipelineClass,
  bVisitPipelinePageFromDrawer: boolean
) => {
  const fromNodeFqn = get(fromNode, 'entityResponseData.fullyQualifiedName');
  const toNodeFqn = get(toNode, 'entityResponseData.fullyQualifiedName');
  const pipelineName = get(pipelineItem, 'entityResponseData.name');

  await page
    .getByTestId(`pipeline-label-${fromNodeFqn}-${toNodeFqn}`)
    .dispatchEvent('click');

  await expect(page.getByTestId('edge-header-title')).toBeVisible();

  if (bVisitPipelinePageFromDrawer) {
    await expect(page.getByTestId('edge-header-title')).toHaveText(
      'Edge Information'
    );
    await expect(
      page.locator('.overview-section').getByTestId('Source-value')
    ).toHaveText(get(fromNode, 'entity.displayName', ''));
    await expect(
      page.locator('.overview-section').getByTestId('Target-value')
    ).toHaveText(get(toNode, 'entity.displayName', ''));
    await expect(
      page.locator('.overview-section').getByTestId('Edge-value')
    ).toHaveText(pipelineName);

    await fromNode.visitEntityPage(page);
  } else {
    await page.getByTestId('drawer-close-icon').click();
  }
};

export const applyPipelineFromModal = async (
  page: Page,
  fromNode: EntityClass,
  toNode: EntityClass,
  pipelineItem?: PipelineClass
) => {
  const pipelineName = get(pipelineItem, 'entityResponseData.name') ?? '';
  const pipelineFqn = get(
    pipelineItem,
    'entityResponseData.fullyQualifiedName'
  );

  await fitToScreen(page);
  await clickEdgeBetweenNodes(page, fromNode, toNode);
  await chooseEdgeDrawerAction(page, 'Edit Pipeline');

  const waitForSearchResponse = page.waitForResponse(
    `/api/v1/search/query?q=*`
  );

  await page
    .locator('[data-testid="add-edge-modal"] [data-testid="field-input"]')
    .fill(pipelineName);

  await waitForSearchResponse;

  await page.click(`[data-testid="pipeline-entry-${pipelineFqn}"]`);

  const saveButton = page.getByTestId('save-button');
  await expect(saveButton).not.toHaveAttribute('data-loading');

  const saveRes = page.waitForResponse('/api/v1/lineage');
  await saveButton.click();
  await saveRes;

  await page.getByTestId('add-edge-modal').waitFor({
    state: 'detached',
  });
};

export const applyPipelineBetweenNodesViaAPI = (
  apiContext: APIRequestContext,
  fromNode: EntityClass,
  toNode: EntityClass,
  pipelineItem: PipelineClass
) => {
  return apiContext.put('/api/v1/lineage', {
    data: {
      edge: {
        fromEntity: {
          id: get(fromNode, 'entityResponseData.id'),
          type: getEntityTypeSearchIndexMapping(fromNode.type),
        },
        toEntity: {
          id: get(toNode, 'entityResponseData.id'),
          type: getEntityTypeSearchIndexMapping(toNode.type),
        },
        lineageDetails: {
          pipeline: {
            id: get(pipelineItem, 'entityResponseData.id'),
            type: getEntityTypeSearchIndexMapping(pipelineItem.type),
          },
        },
      },
    },
  });
};

export const deleteNode = async (page: Page, node: EntityClass) => {
  const nodeFqn = get(node, 'entityResponseData.fullyQualifiedName');

  await openLineageMenu(
    page,
    page.getByTestId(`lineage-node-${nodeFqn}`),
    'lineage-node-menu'
  );
  await page.getByRole('menuitem', { name: 'Delete' }).click();

  const modal = page.getByTestId('delete-node-confirmation-modal');
  await expect(modal).toBeVisible();

  const lineageRes = page.waitForResponse('/api/v1/lineage/**');
  await modal.getByTestId('confirm-button').click();
  await lineageRes;
};

// The column menu only offers Table and Data Model targets, so column lineage
// to any other type has to be set up through the API.
export const addColumnLineage = async (
  page: Page,
  fromColumnFqn: string,
  toColumnFqn: string,
  toEntity: TableClass | DashboardDataModelClass,
  fromOwnerFqn?: string
) => {
  const fromColumn = await revealColumn(page, fromColumnFqn, fromOwnerFqn);

  await addLineageViaMenu(page, {
    trigger: fromColumn,
    direction: 'downstream',
    toEntity,
    columnFqn: toColumnFqn,
  });

  // The canvas only draws edges whose nodes are in view, and a target the
  // popover just added lands wherever the layout puts it.
  await fitToScreen(page);
  await expect(
    page.getByTestId(`column-edge-${fromColumnFqn}-${toColumnFqn}`)
  ).toBeVisible();
};

export const isColumnMenuTarget = (
  entity: EntityClass
): entity is TableClass | DashboardDataModelClass =>
  entity instanceof TableClass || entity instanceof DashboardDataModelClass;

export const addColumnLineageViaAPI = async (
  page: Page,
  apiContext: APIRequestContext,
  fromEntity: EntityClass,
  toEntity: EntityClass,
  fromColumnFqn: string,
  toColumnFqn: string
) => {
  const response = await connectEdgeBetweenNodesViaAPI(
    apiContext,
    {
      id: get(fromEntity, 'entityResponseData.id', ''),
      type: getEntityTypeSearchIndexMapping(fromEntity.type) ?? '',
    },
    {
      id: get(toEntity, 'entityResponseData.id', ''),
      type: getEntityTypeSearchIndexMapping(toEntity.type) ?? '',
    },
    [{ fromColumns: [fromColumnFqn], toColumn: toColumnFqn }]
  );
  expect(response.ok()).toBeTruthy();

  const lineageRes = page.waitForResponse('**/api/v1/lineage/scene?*');
  await page.reload();
  await lineageRes;
  await waitForAllLoadersToDisappear(page);
  await activateColumnLayer(page);
  await revealColumn(
    page,
    fromColumnFqn,
    get(fromEntity, 'entityResponseData.fullyQualifiedName')
  );
  await revealColumn(
    page,
    toColumnFqn,
    get(toEntity, 'entityResponseData.fullyQualifiedName')
  );
  await fitToScreen(page);

  await expect(
    page.getByTestId(`column-edge-${fromColumnFqn}-${toColumnFqn}`)
  ).toBeVisible();
};

export const removeColumnLineage = async (
  page: Page,
  fromColumnNode: string,
  toColumnNode: string,
  owners: { fromFqn?: string; toFqn?: string } = {}
) => {
  await revealColumn(page, fromColumnNode, owners.fromFqn);
  await revealColumn(page, toColumnNode, owners.toFqn);
  await clickEdgeBetweenColumns(page, fromColumnNode, toColumnNode);
  await chooseEdgeDrawerAction(page, 'Delete');

  const deleteRes = page.waitForResponse('/api/v1/lineage');
  await page
    .locator(
      '[data-testid="delete-edge-confirmation-modal"] [data-testid="confirm-button"]'
    )
    .click();
  await deleteRes;

  // Reload before asserting. removeColumnEdge optimistically mutates local
  // React state (setEntityLineage / removeEdgeById / setColumnsHavingLineage),
  // so the edge disappears from the DOM regardless of what the server did.
  // Only a fresh /api/v1/lineage/scene response proves the removal
  // actually persisted.
  const lineageRes = page.waitForResponse('**/api/v1/lineage/scene?*');
  await page.reload();
  await lineageRes;

  await waitForAllLoadersToDisappear(page);
  await activateColumnLayer(page);
  await revealColumn(page, fromColumnNode, owners.fromFqn);
  await revealColumn(page, toColumnNode, owners.toFqn);

  await expect(
    page.getByTestId(`column-edge-${fromColumnNode}-${toColumnNode}`)
  ).not.toBeVisible();
};

export const dismissLineageMapOnboarding = async (page: Page) => {
  const onboardingDialog = page.getByTestId('lineage-map-onboarding-dialog');
  // The onboarding dialog belongs to the main Lineage page; asset lineage
  // tabs never show it.
  const isMainLineagePage = new URL(page.url()).pathname.startsWith('/lineage');
  if (!isMainLineagePage) {
    await expect(onboardingDialog).not.toBeVisible();

    return;
  }
  const hasSeenOnboarding = (await page.context().cookies()).some(
    ({ name, value }) =>
      name === 'lineageMapsOnboardingSeen' && value === 'true'
  );
  if (!hasSeenOnboarding) {
    await expect(onboardingDialog).toBeVisible();
    await onboardingDialog.getByRole('button').click();
    await expect(onboardingDialog).not.toBeVisible();
  }
};

export const visitLineageTab = async (page: Page) => {
  const lineageRes = page.waitForResponse('**/api/v1/lineage/scene?*');
  await page.click('[data-testid="lineage"]');
  const lineageResponse = await lineageRes;
  expect(lineageResponse.ok()).toBeTruthy();
  await waitForAllLoadersToDisappear(page);
  await dismissLineageMapOnboarding(page);
  // Go to full screen to get nodes to view
  await page.getByRole('button', { name: 'Full Screen View' }).first().click();
  const pane = page.locator('.react-flow__pane');
  await pane.click({ position: { x: 0, y: 0 } });
};

export const getEntityColumns = (
  entity: EntityClass,
  entityName: string
): Array<{ name: string; fullyQualifiedName?: string }> => {
  if (entityName === 'table' || entityName === 'dashboardDataModel') {
    return get(entity, 'entityResponseData.columns', []);
  } else if (entityName === 'topic') {
    return get(entity, 'entityResponseData.messageSchema.schemaFields', []);
  } else if (entityName === 'dashboard') {
    return get(entity, 'entityResponseData.charts', []);
  } else if (entityName === 'container') {
    return get(entity, 'entityResponseData.dataModel.columns', []);
  } else if (entityName === 'apiEndpoint') {
    const requestSchema = get(
      entity,
      'entityResponseData.requestSchema.schemaFields',
      []
    );
    const responseSchema = get(
      entity,
      'entityResponseData.responseSchema.schemaFields',
      []
    );
    const schema = responseSchema.length > 0 ? responseSchema : requestSchema;

    return isEmpty(schema) ? [] : schema;
  } else if (entityName === 'mlModel') {
    return get(entity, 'entityResponseData.mlFeatures', []);
  } else if (entityName === 'searchIndex') {
    return get(entity, 'entityResponseData.fields', []);
  } else if (entityName === 'metric') {
    // A metric has no columns -- it is its own column-lineage endpoint.
    return [
      {
        name: get(entity, 'entityResponseData.name', ''),
        fullyQualifiedName: get(
          entity,
          'entityResponseData.fullyQualifiedName',
          ''
        ),
      },
    ];
  }

  return [];
};

export const openImpactAnalysisTab = async (page: Page) => {
  const impactAnalysisTab = page.getByRole('tab', {
    name: 'Impact Analysis',
  });

  await expect(impactAnalysisTab).toBeVisible();
  await impactAnalysisTab.scrollIntoViewIfNeeded();
  await impactAnalysisTab.click();
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
  await fitToScreen(page);

  await connectEdgeBetweenNodes(page, sourceEntity, targetEntity);
  if (pipelineItem) {
    await applyPipelineFromModal(
      page,
      sourceEntity,
      targetEntity,
      pipelineItem
    );
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
  await page
    .locator('[data-testid="lineage-layer-column-btn"][data-selected]')
    .waitFor();
  await clickOutside(page); // Close Layer popover
};

export const verifyCSVHeaders = async (headers: string[]) => {
  LINEAGE_CSV_HEADERS.forEach((expectedHeader) => {
    expect(headers).toContain(expectedHeader);
  });
};

export const getLineageCSVData = async (page: Page) => {
  await expect(page.getByTestId('export-button')).toBeEnabled();

  await page.getByTestId('export-button').click();

  await page
    .locator(
      '[data-testid="export-entity-modal"] [data-testid="submit-button"]'
    )
    .waitFor({
      state: 'visible',
    });

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click(
      '[data-testid="export-entity-modal"] [data-testid="submit-button"]:visible'
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
    .map((row) =>
      row.split(',').map((cell) => cell.replaceAll('"', '').trim())
    );

  const headers = csvRows[0];
  await verifyCSVHeaders(headers);

  return parseCSV(csvRows);
};

export const verifyExportLineageCSV = async (
  page: Page,
  currentEntity: EntityClass,
  entities: EntityClass[],
  pipeline: PipelineClass
) => {
  const parsedData = await getLineageCSVData(page);
  const currentEntityFQN = get(
    currentEntity,
    'entityResponseData.fullyQualifiedName',
    ''
  );

  const arr = [];
  for (const entity of entities) {
    arr.push({
      fromEntityFQN: currentEntityFQN,
      fromServiceName: get(
        currentEntity,
        'entityResponseData.service.name',
        ''
      ),
      fromServiceType: get(currentEntity, 'entityResponseData.serviceType', ''),
      toEntityFQN: get(entity, 'entityResponseData.fullyQualifiedName', ''),
      toServiceName: get(entity, 'entityResponseData.service.name', ''),
      toServiceType: get(entity, 'entityResponseData.serviceType', ''),
      pipelineName: get(pipeline, 'entityResponseData.name', ''),
    });
  }

  arr.forEach((expectedRow) => {
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
  await expect(page.getByTestId('export-button')).toBeEnabled();

  await page.getByTestId('export-button').click();

  await page
    .locator(
      '[data-testid="export-entity-modal"] [data-testid="submit-button"]'
    )
    .waitFor({
      state: 'visible',
    });

  if (!isPNGSelected) {
    await selectOptionWithRetry(
      page.getByTestId('export-type-select'),
      page.getByRole('option', { name: 'PNG' })
    );
  }

  await expect(page.getByTestId('export-type-select')).toContainText('PNG');

  // If the client-side render throws, no download event ever fires and the wait
  // below expires with nothing to say. Capture page errors so a silent exception
  // is reported as the cause instead of an anonymous 120s timeout; a genuinely
  // slow render still surfaces the original timeout untouched.
  const pageErrors: string[] = [];
  const collectPageError = (error: Error) =>
    pageErrors.push(error.stack ?? error.message);
  page.on('pageerror', collectPageError);

  try {
    const [download] = await Promise.all([
      // Platform lineage renders up to 500 nodes at pixelRatio:3 — give the PNG
      // render enough headroom before the download event fires.
      page.waitForEvent('download', { timeout: 120_000 }),
      page.click(
        '[data-testid="export-entity-modal"] [data-testid="submit-button"]:visible'
      ),
    ]);

    const filePath = await download.path();

    expect(filePath).not.toBeNull();
  } catch (error) {
    // Only the download wait is ambiguous about its cause. A click or selector
    // failure already says what went wrong, so a stray page error must never
    // replace it — and even for a timeout the original message is kept and the
    // page errors appended, so a slow render still reads as a slow render.
    const isDownloadTimeout =
      error instanceof Error &&
      error.message.includes('waiting for event "download"');

    if (isDownloadTimeout && pageErrors.length > 0) {
      throw new Error(
        `${
          error.message
        }\n\nThe page also threw during the export, which may be the real cause:\n  ${pageErrors.join(
          '\n  '
        )}`
      );
    }

    throw error;
  } finally {
    page.off('pageerror', collectPageError);
  }
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
  await page.getByTestId('lineage-config').click();

  await page.getByTestId('field-upstream').waitFor({ state: 'visible' });

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

  const saveRes = page.waitForResponse('**/api/v1/lineage/scene?**');
  await page.getByText('OK').click();
  await saveRes;
};

export const connectEdgeBetweenNodesViaAPI = (
  apiContext: APIRequestContext,
  fromEntity: { id: string; type: string },
  toEntity: { id: string; type: string },
  columnsLineage?: Array<{ fromColumns: string[]; toColumn: string }>
) => {
  return apiContext.put('/api/v1/lineage/', {
    data: {
      edge: {
        fromEntity,
        toEntity,
        lineageDetails: { columnsLineage, description: '' },
      },
    },
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

export const toggleLineageFilters = async (page: Page, tableFqn: string) => {
  await page
    .getByTestId(`lineage-node-${tableFqn}`)
    .getByTestId('lineage-filter-button')
    .click();

  // To remove tooltip
  await clickOutside(page);
};

export const clickLineageNode = async (page: Page, nodeFqn: string) => {
  // React Flow mounts nodes after its own layout pass, which runs well after the
  // getLineage response the caller waited on. Clicking straight away leaves the
  // action auto-waiting with no timeout of its own, so a graph that is slow to
  // lay out surfaces as a bare test timeout with nothing naming the node.
  const nodeTitle = page
    .locator(`[data-testid="lineage-node-${nodeFqn}"]`)
    .locator(`[data-testid="entity-header-display-name"]`);

  await expect(nodeTitle).toBeVisible();
  await nodeTitle.click();
};

export const updateLineageConfigFromModal = async (
  page: Page,
  config: { upstreamDepth: number; downstreamDepth: number }
) => {
  await page.getByTestId('lineage-config').click();

  await page.getByTestId('field-upstream').waitFor({ state: 'visible' });

  await page
    .getByTestId('field-upstream')
    .fill(config.upstreamDepth.toString());
  await page
    .getByTestId('field-downstream')
    .fill(config.downstreamDepth.toString());

  await page.getByText('OK').click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
};

export const setLineageDepthAndVerify = async (
  page: Page,
  upstreamDepth: number,
  downstreamDepth: number
) => {
  await page.getByTestId('lineage-config').click();

  const upstreamField = page.getByTestId('field-upstream');
  const downstreamField = page.getByTestId('field-downstream');

  await upstreamField.waitFor({ state: 'visible' });

  const depthChanged =
    (await upstreamField.inputValue()) !== upstreamDepth.toString() ||
    (await downstreamField.inputValue()) !== downstreamDepth.toString();

  await upstreamField.fill(upstreamDepth.toString());
  await downstreamField.fill(downstreamDepth.toString());

  const lineageRes = depthChanged
    ? page.waitForResponse((response) => {
        const url = response.url();

        return (
          url.includes('/api/v1/lineage/scene') &&
          url.includes(`upstreamDepth=${upstreamDepth}`) &&
          url.includes(`downstreamDepth=${downstreamDepth}`)
        );
      })
    : undefined;

  await page.getByText('OK').click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await lineageRes;
};

export const verifyPlatformLineageForEntity = async (
  page: Page,
  fromFqn: string,
  toFqn?: string
) => {
  // Verify relation in platform lineage
  const rootSceneResponse = page.waitForResponse('**/api/v1/lineage/scene?*');
  await sidebarClick(page, SidebarItem.LINEAGE);
  expect((await rootSceneResponse).ok()).toBeTruthy();
  await dismissLineageMapOnboarding(page);

  await page
    .getByTestId('search-entity-select')
    .getByRole('combobox')
    .fill(fromFqn);

  const focusSceneResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith('/api/v1/lineage/scene') &&
      new URL(response.url()).searchParams.get('focusFqn') === fromFqn
  );
  await page
    .locator('[role="listbox"]:visible')
    .getByTestId(`option-${fromFqn}`)
    .click();
  await expect(page).toHaveURL((url) =>
    url.pathname.endsWith(`/${encodeURIComponent(fromFqn)}`)
  );
  expect((await focusSceneResponse).ok()).toBeTruthy();

  await page.getByTestId('lineage-layer-btn').click();

  const assetBandButton = page.getByTestId('lineage-layer-band-ASSET');
  await expect(assetBandButton).toHaveAttribute('data-selected');
  await clickOutside(page);

  const fromNode = page.getByTestId(`lineage-node-${fromFqn}`);
  await expect(fromNode).toBeVisible();

  // Fit rather than zoom out. Zooming is not just framing here: LineageMap's
  // `handleMove` reads the new zoom, and when it crosses into a shallower
  // semantic band it calls `getParentSceneRequest` and navigates to the parent
  // scene -- so the entity this function is about to assert on gets folded into
  // its service node ("pw-ml-model-service-… · 1 model" in the screenshot for
  // this failure) and is genuinely absent from the DOM. `fit-screen` goes
  // through `fitViewWithoutSemanticZoom`, which suppresses that.
  await fitToScreen(page);

  await expect(fromNode).toBeVisible();

  if (toFqn) {
    await expect(page.getByTestId(`lineage-node-${toFqn}`)).toBeVisible();
  }
};

export const generateColumns = (count: number, prefix: string) => {
  return Array.from({ length: count }, (_, i) => ({
    name: `${prefix}_column_${i}`,
    dataType: 'VARCHAR',
    dataLength: 100,
    dataTypeDisplay: 'varchar',
    description: `Test column ${i}`,
  }));
};

export const expectLineageNodeVisible = async (
  page: Page,
  fqn: string | undefined
) => {
  if (!fqn) {
    throw new Error(
      'expectLineageNodeVisible was given no fully qualified name'
    );
  }

  const node = page.getByTestId(`lineage-node-${fqn}`);

  await expect(async () => {
    if ((await node.count()) === 0) {
      if ((await page.getByTestId('fit-screen').count()) > 0) {
        await fitToScreen(page);
      } else {
        await performZoomOut(page);
      }
    }

    await expect(node).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
};

export const openLineageNodeDrawer = async (
  page: Page,
  fqn: string | undefined
) => {
  // A node testid built from `undefined` matches nothing, and the retry below
  // would spend its whole budget re-fitting for it. Say so immediately.
  if (!fqn) {
    throw new Error('openLineageNodeDrawer called without a node FQN');
  }

  const trigger = page
    .getByTestId(`lineage-node-${fqn}`)
    .getByTestId('entity-header-display-name')
    .getByRole('button');

  // Recover when the click fails, not when the node is missing from the DOM.
  // Attachment is not proof the trigger can be pressed: the canvas can keep an
  // attached node clipped outside the viewport, and React Flow transforms
  // rather than scrolls, so Playwright's scroll-into-view cannot reach it.
  // Gating recovery on `count() === 0` skipped that case and re-clicked the
  // same unreachable trigger until the 90s budget ran out.
  //
  // The escalation is the one verifyNodePresent uses, for the same reason: a
  // fit is capped at the band's minZoom floor (0.9 in the Field band), so on a
  // tall scene it cannot widen the view far enough, and re-fitting on every
  // attempt throws away the zoom-out that can. Press first -- the node is
  // usually right there -- then fit, then widen progressively.
  let attempt = 0;
  await expect(async () => {
    if (attempt === 1) {
      await fitToScreen(page);
    } else if (attempt > 1) {
      await performZoomOut(page, 3);
    }
    attempt += 1;

    await trigger.click({ timeout: 10_000 });
  }).toPass({ timeout: 90_000 });
};
