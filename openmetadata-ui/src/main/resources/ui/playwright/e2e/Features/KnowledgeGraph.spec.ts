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

import test, { expect } from '@playwright/test';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { TableClass } from '../../support/entity/TableClass';
import { createNewPage } from '../../utils/common';
import {
  getEncodedFqn,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';

interface GraphApiNode {
  id: string;
  label: string;
  type: string;
  fullyQualifiedName?: string;
}

interface GraphApiEdge {
  from: string;
  to: string;
  label: string;
}

interface GraphApiResponse {
  nodes: GraphApiNode[];
  edges: GraphApiEdge[];
}

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Knowledge Graph', { tag: ['@knowledge-graph'] }, () => {
  let table: TableClass;

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    table = new TableClass();

    await table.create(apiContext);
    await table.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          value: {
            type: 'user',
            id: EntityDataClass.user1.responseData.id,
          },
          path: '/owners/0',
        },
        {
          op: 'add',
          value: {
            tagFQN: 'PersonalData.Personal',
          },
          path: '/tags/0',
        },
        {
          op: 'add',
          value: {
            tagFQN: 'Tier.Tier1',
          },
          path: '/tags/1',
        },
        {
          op: 'add',
          value: {
            appliedDate: Date.now(),
            expiryDate: Date.now() + 1000 * 60 * 60 * 24 * 30, // 30 days from now
            tagLabel: {
              tagFQN: 'Certification.Gold',
            },
          },
          path: '/certification',
        },
        {
          op: 'add',
          path: '/domains/0',
          value: {
            id: EntityDataClass.domain1.responseData.id,
            type: 'domain',
            name: EntityDataClass.domain1.responseData.name,
            displayName: EntityDataClass.domain1.responseData.displayName,
          },
        },
      ],
    });

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await table.delete(apiContext);
    await afterAction();
  });

  test('Verify that the knowledge graph displays the correct relationships for a table entity', async ({
    page,
  }) => {
    const graphDataResponse = page.waitForResponse(
      `/api/v1/rdf/graph/explore?entityId=${table.entityResponseData.id}&entityType=table&depth=1`
    );

    await page.goto(
      `/table/${getEncodedFqn(
        table.entityResponseData.fullyQualifiedName ?? ''
      )}/knowledge_graph`
    );

    const graphResponse = await graphDataResponse;
    const graphData = (await graphResponse.json()) as GraphApiResponse;

    await waitForAllLoadersToDisappear(page);

    const graphLoader = page.locator(
      `[data-testid="knowledge-graph-container"] [data-testid="loader"]`
    );
    await expect(graphLoader).not.toBeAttached();

    const nodeLabelById = new Map<string, string>(
      graphData.nodes.map((n) => [n.id, n.label])
    );

    await test.step('Verify all graph nodes are rendered in the DOM', async () => {
      for (const node of graphData.nodes) {
        await expect(
          page.locator(`[data-testid="node-${node.label}"]`)
        ).toBeAttached();
      }
    });

    await test.step('Verify the table node is present', async () => {
      const tableNodes = graphData.nodes.filter((n) => n.type === 'table');

      expect(tableNodes.length).toBeGreaterThan(0);

      for (const tableNode of tableNodes) {
        await expect(
          page.locator(`[data-testid="node-${tableNode.label}"]`)
        ).toBeAttached();
      }
    });

    await test.step('Verify at least one user node is present (owner)', async () => {
      const userNodes = graphData.nodes.filter((n) => n.type === 'user');

      expect(userNodes.length).toBeGreaterThan(0);

      for (const userNode of userNodes) {
        await expect(
          page.locator(`[data-testid="node-${userNode.label}"]`)
        ).toBeAttached();
      }
    });

    await test.step('Verify domain nodes are rendered when present', async () => {
      const domainNodes = graphData.nodes.filter((n) => n.type === 'domain');

      for (const domainNode of domainNodes) {
        await expect(
          page.locator(`[data-testid="node-${domainNode.label}"]`)
        ).toBeAttached();
      }
    });

    await test.step('Verify all edges from the API response are in the hidden edges div', async () => {
      const edgesContainer = page.locator(
        '[data-testid="knowledge-graph-edges"]'
      );

      await expect(edgesContainer).toBeAttached();

      for (const edge of graphData.edges) {
        const srcLabel = nodeLabelById.get(edge.from) ?? edge.from;
        const tgtLabel = nodeLabelById.get(edge.to) ?? edge.to;

        await expect(
          edgesContainer.locator(
            `[data-testid="edge-${srcLabel}-${edge.label}-${tgtLabel}"]`
          )
        ).toBeAttached();
      }
    });
  });

  test('Verify node highlighting is applied on hover', async ({ page }) => {
    const graphDataResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/rdf/graph/explore') &&
        response.url().includes(`entityId=${table.entityResponseData.id}`)
    );
    await page.goto(
      `/table/${getEncodedFqn(
        table.entityResponseData.fullyQualifiedName ?? ''
      )}/knowledge_graph`
    );
    const graphResponse = await graphDataResponse;
    const graphData = (await graphResponse.json()) as GraphApiResponse;
    await waitForAllLoadersToDisappear(page);
    await expect(page.locator('[data-testid^="node-"]').first()).toBeAttached();

    // Fit graph so all nodes are positioned inside the viewport
    await page.locator('[data-testid="fit-screen"]').click();
    await expect(
      page.locator('[data-testid="knowledge-graph-canvas"]')
    ).toBeVisible();

    // The controls toolbar (position:absolute, z-index:1000) covers the top of the
    // canvas. We must pick a node whose center is below it; otherwise page.mouse.move
    // delivers the pointer event to the toolbar, not the G6 node, and no highlight fires.
    const controlsBox = await page
      .locator('[data-testid="knowledge-graph-controls"]')
      .boundingBox();
    const controlsBottom = controlsBox ? controlsBox.y + controlsBox.height : 0;

    let targetNode: GraphApiNode | undefined;
    let targetBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    } | null = null;

    for (const node of graphData.nodes.filter((n) => n.type !== 'table')) {
      const box = await page
        .locator(`[data-testid="node-${node.label}"]`)
        .boundingBox();
      if (box && box.y + box.height / 2 > controlsBottom) {
        targetNode = node;
        targetBox = box;
        break;
      }
    }

    if (!targetNode || !targetBox) {
      throw new Error('No non-table node found below the controls bar');
    }

    const nodeLocator = page.locator(
      `[data-testid="node-${targetNode.label}"]`
    );

    await expect(nodeLocator).not.toHaveClass(/highlighted/);

    await page.mouse.move(
      targetBox.x + targetBox.width / 2,
      targetBox.y + targetBox.height / 2
    );

    await expect(nodeLocator).toHaveClass(/highlighted/);

    // Move mouse away; G6 fires node:pointerleave → clearAllHighlights()
    await page.mouse.move(0, 0);

    await expect(nodeLocator).not.toHaveClass(/highlighted/);
  });

  test('Verify entity summary panel opens when a node is clicked', async ({
    page,
  }) => {
    const graphDataResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/rdf/graph/explore') &&
        response.url().includes(`entityId=${table.entityResponseData.id}`)
    );
    await page.goto(
      `/table/${getEncodedFqn(
        table.entityResponseData.fullyQualifiedName ?? ''
      )}/knowledge_graph`
    );
    const graphResponse = await graphDataResponse;
    const graphData = (await graphResponse.json()) as GraphApiResponse;
    await waitForAllLoadersToDisappear(page);
    await expect(page.locator('[data-testid^="node-"]').first()).toBeAttached();

    const clickableNode = graphData.nodes.find((n) => n.fullyQualifiedName);

    if (!clickableNode) {
      throw new Error('Expected at least one node with fullyQualifiedName');
    }

    await page.locator(`[data-testid="node-${clickableNode.label}"]`).click();

    await expect(
      page.locator('[data-testid="entity-summary-panel-container"]')
    ).toBeVisible();

    await page.locator('[data-testid="drawer-close-icon"]').click();

    await expect(
      page.locator('[data-testid="entity-summary-panel-container"]')
    ).not.toBeVisible();
  });

  test('Verify depth slider change fetches and renders depth 2 graph', async ({
    page,
  }) => {
    const depth1ResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/rdf/graph/explore') &&
        response.url().includes(`entityId=${table.entityResponseData.id}`)
    );
    await page.goto(
      `/table/${getEncodedFqn(
        table.entityResponseData.fullyQualifiedName ?? ''
      )}/knowledge_graph`
    );
    await depth1ResponsePromise;
    await waitForAllLoadersToDisappear(page);
    await expect(page.locator('[data-testid^="node-"]').first()).toBeAttached();

    const depth2ResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/rdf/graph/explore') &&
        response.url().includes('depth=2')
    );

    const sliderInput = page.locator(
      '[data-testid="depth-slider"] input[type="range"]'
    );
    await sliderInput.press('ArrowRight');

    const depth2Response = await depth2ResponsePromise;
    const depth2Data = (await depth2Response.json()) as GraphApiResponse;

    await waitForAllLoadersToDisappear(page);
    await expect(page.locator('[data-testid^="node-"]').first()).toBeAttached();

    for (const node of depth2Data.nodes) {
      await expect(
        page.locator(`[data-testid="node-${node.label}"]`)
      ).toBeAttached();
    }
  });

  test('Verify layout toggle switches between Hierarchical and Radial modes', async ({
    page,
  }) => {
    const graphDataResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/rdf/graph/explore') &&
        response.url().includes(`entityId=${table.entityResponseData.id}`)
    );
    await page.goto(
      `/table/${getEncodedFqn(
        table.entityResponseData.fullyQualifiedName ?? ''
      )}/knowledge_graph`
    );
    const graphResponse = await graphDataResponse;
    const graphData = (await graphResponse.json()) as GraphApiResponse;
    await waitForAllLoadersToDisappear(page);
    await expect(page.locator('[data-testid^="node-"]').first()).toBeAttached();

    const layoutTabs = page.locator('[data-testid="layout-tabs"]');
    const hierarchicalTab = layoutTabs.getByRole('tab', {
      name: 'Hierarchical',
    });
    const radialTab = layoutTabs.getByRole('tab', { name: 'Radial' });

    await expect(hierarchicalTab).toHaveAttribute('aria-selected', 'true');
    await expect(radialTab).toHaveAttribute('aria-selected', 'false');

    await radialTab.click();

    await expect(radialTab).toHaveAttribute('aria-selected', 'true');
    await expect(hierarchicalTab).toHaveAttribute('aria-selected', 'false');

    const nodeLabelById = new Map<string, string>(
      graphData.nodes.map((n) => [n.id, n.label])
    );
    const edgesContainer = page.locator(
      '[data-testid="knowledge-graph-edges"]'
    );
    for (const edge of graphData.edges) {
      const srcLabel = nodeLabelById.get(edge.from) ?? edge.from;
      const tgtLabel = nodeLabelById.get(edge.to) ?? edge.to;
      await expect(
        edgesContainer.locator(
          `[data-testid="edge-${srcLabel}-${edge.label}-${tgtLabel}"]`
        )
      ).toBeAttached();
    }

    await hierarchicalTab.click();
    await expect(hierarchicalTab).toHaveAttribute('aria-selected', 'true');
  });

  test('Verify toolbar buttons function correctly', async ({ page }) => {
    const graphDataResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/rdf/graph/explore') &&
        response.url().includes(`entityId=${table.entityResponseData.id}`)
    );
    await page.goto(
      `/table/${getEncodedFqn(
        table.entityResponseData.fullyQualifiedName ?? ''
      )}/knowledge_graph`
    );
    await graphDataResponse;
    await waitForAllLoadersToDisappear(page);
    await expect(page.locator('[data-testid^="node-"]').first()).toBeAttached();

    await test.step('Verify refresh button triggers a new API call', async () => {
      const refreshResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/rdf/graph/explore') &&
          response.url().includes(`entityId=${table.entityResponseData.id}`)
      );
      await page.locator('[data-testid="refresh"]').click();
      const response = await refreshResponse;
      expect(response.status()).toBe(200);
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('Verify full-screen toggle changes URL and button state', async () => {
      await page.locator('[data-testid="full-screen"]').click();

      await expect(page).toHaveURL(/fullscreen=true/);
      await expect(
        page.locator('[data-testid="exit-full-screen"]')
      ).toBeVisible();
      // Scope to the knowledge-graph full-screen wrapper to avoid matching the
      // page-header breadcrumb which also has data-testid="breadcrumb"
      await expect(
        page.locator('.full-screen-knowledge-graph [data-testid="breadcrumb"]')
      ).toBeVisible();

      await page.locator('[data-testid="exit-full-screen"]').click();

      await expect(page).not.toHaveURL(/fullscreen=true/);
      await expect(page.locator('[data-testid="full-screen"]')).toBeVisible();
    });

    await test.step('Verify zoom buttons change node positions', async () => {
      const referenceNode = page.locator('[data-testid^="node-"]').first();
      const initialBox = await referenceNode.boundingBox();

      await page.locator('[data-testid="zoom-in"]').click();

      // G6 zoom animation runs ~300ms; poll until the bounding box shifts
      await expect(async () => {
        const newBox = await referenceNode.boundingBox();
        expect(newBox).not.toEqual(initialBox);
      }).toPass();

      const zoomedInBox = await referenceNode.boundingBox();

      await page.locator('[data-testid="zoom-out"]').click();

      await expect(async () => {
        const newBox = await referenceNode.boundingBox();
        expect(newBox).not.toEqual(zoomedInBox);
      }).toPass();
    });

    await test.step('Verify fit-screen restores nodes to viewport', async () => {
      // Zoom in several times so nodes spread outside the visible area
      for (let i = 0; i < 4; i++) {
        await page.locator('[data-testid="zoom-in"]').click();
      }

      await page.locator('[data-testid="fit-screen"]').click();

      // After fit-screen the graph is scaled to fill the canvas, so at least
      // the first node must be inside the visible viewport
      await expect(
        page.locator('[data-testid^="node-"]').first()
      ).toBeInViewport();
    });
  });
});
