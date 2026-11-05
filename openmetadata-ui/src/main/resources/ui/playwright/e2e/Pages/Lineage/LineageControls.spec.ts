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
import { get } from 'lodash';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../../constant/config';
import { EntityDataClass } from '../../../support/entity/EntityDataClass';
import { PipelineClass } from '../../../support/entity/PipelineClass';
import { TableClass } from '../../../support/entity/TableClass';
import { TopicClass } from '../../../support/entity/TopicClass';
import {
  getApiContext,
  getDefaultAdminAPIContext,
  redirectToHomePage,
} from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import {
  connectEdgeBetweenNodesViaAPI,
  dismissLineageMapOnboarding,
  fitToScreen,
  performZoomOut,
  visitLineageTab,
} from '../../../utils/lineage';
import { test } from '../../fixtures/pages';

const table = new TableClass();
const topic = new TopicClass();
const pipeline = new PipelineClass();

test.beforeAll(async ({ browser }) => {
  const { apiContext, afterAction } = await getDefaultAdminAPIContext(browser);

  await Promise.all([
    table.create(apiContext),
    topic.create(apiContext),
    pipeline.create(apiContext),
  ]);

  // Patch topic with metadata for filter tests
  await topic.patch({
    apiContext,
    patchData: [
      {
        op: 'add',
        path: '/owners/0',
        value: {
          type: 'user',
          id: EntityDataClass.user1.responseData.id,
        },
      },
      {
        op: 'add',
        path: '/domains',
        value: [
          {
            type: 'domain',
            id: EntityDataClass.domain1.responseData.id,
          },
        ],
      },
    ],
  });

  await connectEdgeBetweenNodesViaAPI(
    apiContext,
    { id: table.entityResponseData.id, type: 'table' },
    { id: topic.entityResponseData.id, type: 'topic' }
  );

  await afterAction();
});

test.afterAll(async ({ browser }) => {
  const { apiContext, afterAction } = await getDefaultAdminAPIContext(browser);
  await Promise.all([
    table.delete(apiContext),
    topic.delete(apiContext),
    pipeline.delete(apiContext),
  ]);
  await afterAction();
});

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
});

test.afterEach(async ({ page }) => {
  await page.goto('about:blank', { waitUntil: 'domcontentloaded' });
});

// ====================
// Suite 1: Canvas Control Buttons (4 tests)
// ====================
test.describe('Canvas Controls', PLAYWRIGHT_BASIC_TEST_TAG_OBJ, () => {
  test.beforeEach(async ({ page }) => {
    await table.visitEntityPage(page);
    await visitLineageTab(page);
    await performZoomOut(page);
  });

  test('Verify zoom in and zoom out controls', async ({ page }) => {
    const zoomInBtn = page.getByTestId('zoom-in');
    const zoomOutBtn = page.getByTestId('zoom-out');

    await performZoomOut(page, 5);

    for (let i = 0; i < 3; i++) {
      await zoomInBtn.click();
    }

    for (let i = 0; i < 3; i++) {
      await zoomOutBtn.click();
    }

    await expect(zoomInBtn).toBeVisible();
    await expect(zoomOutBtn).toBeVisible();
  });

  test('Verify fit to screen brings the root node into view', async ({
    page,
  }) => {
    const tableFqn = get(table, 'entityResponseData.fullyQualifiedName', '');
    const tableNode = page.getByTestId(`lineage-node-${tableFqn}`);
    const zoomLevel = page.getByTestId('zoom-level');

    for (let i = 0; i < 5; i++) {
      await page.getByTestId('zoom-in').click();
    }
    const zoomedIn = await zoomLevel.textContent();

    await page.getByTestId('fit-screen').click();

    await expect(zoomLevel).not.toHaveText(zoomedIn ?? '');
    await expect(tableNode).toBeInViewport();
  });

  test('Verify minimap toggle functionality', async ({ page }) => {
    const minimap = page.locator('.react-flow__minimap');
    await expect(minimap).toBeVisible();

    await page.getByTestId('toggle-mind-map').click();
    await expect(minimap).not.toBeVisible();

    await page.getByTestId('toggle-mind-map').click();
    await expect(minimap).toBeVisible();
  });

  test('Verify fullscreen toggle', async ({ page }) => {
    // before each step has fullscreen=true
    expect(page.url()).toContain('fullscreen=true');

    await page.getByRole('button', { name: 'Exit Full Screen' }).click();

    await expect.poll(() => page.url()).not.toContain('fullscreen=true');
    await page.getByRole('button', { name: 'Full Screen View' }).click();

    await expect.poll(() => page.url()).toContain('fullscreen=true');
  });
});

test.describe('Lineage Layers', PLAYWRIGHT_BASIC_TEST_TAG_OBJ, () => {
  test.describe('Data Observability Layer', () => {
    test.beforeEach(async ({ page }) => {
      await table.visitEntityPage(page);
      await visitLineageTab(page);
      await performZoomOut(page);
    });

    test('Verify DQ layer toggle activation', async ({ page }) => {
      await page.getByTestId('lineage-layer-btn').click();

      const observabilityBtn = page.getByTestId(
        'lineage-layer-observability-btn'
      );
      await expect(observabilityBtn).toBeVisible();

      await expect(observabilityBtn).not.toHaveAttribute('data-selected');

      await observabilityBtn.click();
      await page.keyboard.press('Escape');

      await page.getByTestId('lineage-layer-btn').click();
      await expect(observabilityBtn).toHaveAttribute('data-selected');
    });

    test('Verify DQ layer toggle off removes highlights', async ({ page }) => {
      await page.getByTestId('lineage-layer-btn').click();

      const observabilityBtn = page.getByTestId(
        'lineage-layer-observability-btn'
      );

      await observabilityBtn.click();
      await page.keyboard.press('Escape');

      await page.getByTestId('lineage-layer-btn').click();
      await expect(observabilityBtn).toHaveAttribute('data-selected');

      await observabilityBtn.click();
      await page.keyboard.press('Escape');

      await page.getByTestId('lineage-layer-btn').click();
      await expect(observabilityBtn).not.toHaveAttribute('data-selected');
    });
  });

  test.describe('Error Handling', () => {
    test('Verify invalid entity search handling', async ({ page }) => {
      const sceneResponse = page.waitForResponse('**/api/v1/lineage/scene?*');
      // The retained global lineage page has no entry in the current sidebar.
      await page.goto('/lineage');
      expect((await sceneResponse).ok()).toBeTruthy();
      await dismissLineageMapOnboarding(page);

      await waitForAllLoadersToDisappear(page);

      const searchSelect = page.getByTestId('search-entity-select');
      await expect(searchSelect).toBeVisible();

      await searchSelect
        .getByRole('combobox')
        .fill('invalid_fqn_does_not_exist_12345');

      const noResultsText = page.getByText(/no match/i);
      if ((await noResultsText.count()) > 0) {
        await expect(noResultsText).toBeVisible();
      }
    });

    test('Verify lineage tab with no lineage data', async ({ page }) => {
      const emptyTable = new TableClass();
      const { apiContext, afterAction } = await getApiContext(page);

      await emptyTable.create(apiContext);

      await emptyTable.visitEntityPage(page);
      await visitLineageTab(page);

      await waitForAllLoadersToDisappear(page);

      const tableFqn = get(emptyTable, 'entityResponseData.fullyQualifiedName');
      const tableNode = page.getByTestId(`lineage-node-${tableFqn}`);
      await expect(tableNode).toBeVisible();

      await emptyTable.delete(apiContext);
      await afterAction();
    });
  });
});

test.describe('Node drag', PLAYWRIGHT_BASIC_TEST_TAG_OBJ, () => {
  test('Verify holding a dragged node at the canvas edge auto-pans and hides only its edges', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const root = new TableClass();
    const dragged = new TopicClass();
    const sibling = new TableClass();
    const getFqn = (entity: TableClass | TopicClass) =>
      get(entity, 'entityResponseData.fullyQualifiedName', '');

    try {
      await Promise.all([
        root.create(apiContext),
        dragged.create(apiContext),
        sibling.create(apiContext),
      ]);
      await Promise.all([
        connectEdgeBetweenNodesViaAPI(
          apiContext,
          { id: root.entityResponseData.id, type: 'table' },
          { id: dragged.entityResponseData.id, type: 'topic' }
        ),
        connectEdgeBetweenNodesViaAPI(
          apiContext,
          { id: root.entityResponseData.id, type: 'table' },
          { id: sibling.entityResponseData.id, type: 'table' }
        ),
      ]);
      await root.visitEntityPage(page);
      await visitLineageTab(page);
      await fitToScreen(page);

      const draggedNode = page.getByTestId(`lineage-node-${getFqn(dragged)}`);
      const draggedEdge = page.getByTestId(
        `edge-${getFqn(root)}-${getFqn(dragged)}`
      );
      const siblingEdge = page.getByTestId(
        `edge-${getFqn(root)}-${getFqn(sibling)}`
      );
      const canvas = page.locator('.react-flow__pane');
      const viewport = page.locator('.react-flow__viewport');
      await expect(draggedEdge).toHaveCount(1);
      await expect(siblingEdge).toHaveCount(1);

      const nodeBox = await draggedNode.boundingBox();
      const canvasBox = await canvas.boundingBox();
      if (!nodeBox || !canvasBox) {
        throw new Error('Lineage node or canvas has no bounding box');
      }
      const getPanY = async () =>
        Number(
          /translate\([^,]+,\s*(-?[\d.]+)px/.exec(
            (await viewport.getAttribute('style')) ?? ''
          )?.[1] ?? 0
        );
      const startPanY = await getPanY();
      const grabX = nodeBox.x + nodeBox.width / 2;

      await page.mouse.move(grabX, nodeBox.y + 8);
      await page.mouse.down();
      await page.mouse.move(grabX, canvasBox.y + 4, { steps: 10 });

      // Auto-pan keeps scrolling while the pointer rests at the edge; hold
      // until it has panned far enough to have run for many frames.
      await expect
        .poll(async () => (await getPanY()) - startPanY, { timeout: 15_000 })
        .toBeGreaterThan(1500);
      // Only the dragged node's edges are hidden while it moves.
      await expect(draggedEdge).toHaveCount(0);
      await expect(siblingEdge).toHaveCount(1);
      await page.mouse.up();

      // A "Maximum update depth exceeded" crash unmounts the canvas.
      await expect(canvas).toBeVisible();
      await expect(draggedEdge).toHaveCount(1);
      // The drop position was committed: the node stays under the pointer
      // instead of snapping back to where the drag started.
      await expect
        .poll(async () => (await draggedNode.boundingBox())?.y ?? Infinity)
        .toBeLessThan(canvasBox.y + 50);
    } finally {
      await Promise.all([
        root.delete(apiContext),
        dragged.delete(apiContext),
        sibling.delete(apiContext),
      ]);
      await afterAction();
    }
  });
});
