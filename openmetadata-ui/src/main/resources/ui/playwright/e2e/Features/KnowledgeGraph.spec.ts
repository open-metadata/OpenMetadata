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

import test, { expect, Locator, Page } from '@playwright/test';
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

interface GraphFilterOption {
  id: string;
  label: string;
  count: number;
}

interface GraphApiResponse {
  nodes: GraphApiNode[];
  edges: GraphApiEdge[];
  filterOptions?: {
    entityTypes: GraphFilterOption[];
    relationshipTypes: GraphFilterOption[];
  };
}

/**
 * The graph is rendered once at least one node card is in the DOM. Asserting on
 * the count rather than on a positional locator keeps this stable when the node
 * order changes between runs.
 */
const expectGraphRendered = async (page: Page): Promise<void> => {
  await expect(page.locator('[data-testid^="node-"]')).not.toHaveCount(0);
};

/**
 * A concrete node to measure zoom and viewport against. Anchoring on a node the
 * API response says exists avoids retargeting when the layout reorders nodes.
 */
const anchorNode = (page: Page, graphData: GraphApiResponse): Locator => {
  const anchor =
    graphData.nodes.find((node) => node.type === 'table') ?? graphData.nodes[0];

  if (!anchor) {
    throw new Error('Knowledge graph returned no nodes to anchor on');
  }

  return page.getByTestId(`node-${anchor.label}`);
};

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
    await expectGraphRendered(page);

    // Fit graph so all nodes are positioned inside the viewport
    await page.locator('[data-testid="fit-screen"]').click();
    await expect(
      page.locator('[data-testid="knowledge-graph-canvas"]')
    ).toBeVisible();

    // Wait for some time to ensure G6 has applied the fit-screen transformation and nodes are in their final positions
    // eslint-disable-next-line playwright/no-wait-for-timeout -- G6 settles the fit-screen transform on its own animation clock and exposes no DOM signal to await; reading bounding boxes earlier yields pre-transform coordinates.
    await page.waitForTimeout(2000);

    let targetNode = graphData.nodes.find((n) => n.type === 'databaseSchema');
    let targetBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    } | null = await page
      .locator(`[data-testid="node-${targetNode?.label}"]`)
      .boundingBox();

    if (!targetNode || !targetBox) {
      throw new Error('No databaseSchema node found below the controls bar');
    }

    await expect(
      page.locator(`[data-testid="node-${targetNode.label}"]`)
    ).not.toHaveClass(/highlighted/);

    await page.mouse.move(
      targetBox.x + targetBox.width / 2,
      targetBox.y + targetBox.height / 2
    );

    await expect(
      page.locator(`[data-testid="node-${targetNode.label}"]`)
    ).toHaveClass(/highlighted/);

    const canvasBox = await page
      .locator('[data-testid="knowledge-graph-canvas"]')
      .boundingBox();

    // Move mouse away; G6 fires node:pointerleave → clearAllHighlights()
    await page.mouse.move(canvasBox?.x ?? 0, canvasBox?.y ?? 0);

    await expect(
      page.locator(`[data-testid="node-${targetNode.label}"]`)
    ).not.toHaveClass(/highlighted/);
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
    await expectGraphRendered(page);

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
    await expectGraphRendered(page);

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
    await expectGraphRendered(page);

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
    await expectGraphRendered(page);

    const layoutTabs = page.locator('[data-testid="layout-tabs"]');
    const hierarchicalTab = layoutTabs.getByRole('tab', {
      name: 'Hierarchical',
    });
    const radialTab = layoutTabs.getByRole('tab', { name: 'Radial' });

    // Radial is the default: at depth 1 the graph is a star around the focus
    // entity, which a layered layout funnels through a single unreadable point.
    await expect(radialTab).toHaveAttribute('aria-selected', 'true');
    await expect(hierarchicalTab).toHaveAttribute('aria-selected', 'false');

    await hierarchicalTab.click();

    await expect(hierarchicalTab).toHaveAttribute('aria-selected', 'true');
    await expect(radialTab).toHaveAttribute('aria-selected', 'false');

    await radialTab.click();

    await expect(radialTab).toHaveAttribute('aria-selected', 'true');

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
    const graphResponse = await graphDataResponse;
    const graphData = (await graphResponse.json()) as GraphApiResponse;
    await waitForAllLoadersToDisappear(page);
    await expectGraphRendered(page);

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
      const referenceNode = anchorNode(page, graphData);
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

      // After fit-screen the graph is scaled to fill the canvas, so the focus
      // node must be back inside the visible viewport.
      await expect(anchorNode(page, graphData)).toBeInViewport();
    });
  });

  test('Verify entity type filter dropdown filters graph data and triggers API call', async ({
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
    await expectGraphRendered(page);

    if (!graphData.filterOptions?.entityTypes.length) {
      throw new Error('No entity type filter options returned by API');
    }

    const controls = page.locator('[data-testid="knowledge-graph-controls"]');

    await test.step('Verify entity type dropdown opens and lists all options', async () => {
      await controls.getByRole('button', { name: 'Entity Type' }).click();

      for (const option of graphData.filterOptions!.entityTypes) {
        await expect(
          page.getByRole('menuitemcheckbox', {
            name: `${option.label} (${option.count})`,
            exact: true,
          })
        ).toBeVisible();
      }

      await page.keyboard.press('Escape');
    });

    await test.step('Verify selecting an entity type triggers a filtered API call', async () => {
      const firstOption = graphData.filterOptions!.entityTypes[0];

      const filteredResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/rdf/graph/explore') &&
          response.url().includes('entityTypes=')
      );

      await controls.getByRole('button', { name: 'Entity Type' }).click();

      await page
        .getByRole('menuitemcheckbox', {
          name: `${firstOption.label} (${firstOption.count})`,
          exact: true,
        })
        .click();

      await page.keyboard.press('Escape');

      const response = await filteredResponse;

      expect(response.url()).toContain('entityTypes=');

      await waitForAllLoadersToDisappear(page);
    });

    await test.step('Verify entity type button label shows selection count', async () => {
      await expect(
        controls.getByRole('button', { name: 'Entity Type (1)' })
      ).toBeVisible();
    });
  });

  test('Verify relationship type filter dropdown filters graph data and triggers API call', async ({
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
    await expectGraphRendered(page);

    if (!graphData.filterOptions?.relationshipTypes.length) {
      throw new Error('No relationship type filter options returned by API');
    }

    const controls = page.locator('[data-testid="knowledge-graph-controls"]');

    await test.step('Verify relationship type dropdown opens and lists all options', async () => {
      await controls.getByRole('button', { name: 'Relationship Type' }).click();

      for (const option of graphData.filterOptions!.relationshipTypes) {
        await expect(
          page.getByRole('menuitemcheckbox', {
            name: `${option.label} (${option.count})`,
            exact: true,
          })
        ).toBeVisible();
      }

      await page.keyboard.press('Escape');
    });

    await test.step('Verify selecting a relationship type triggers a filtered API call', async () => {
      const firstOption = graphData.filterOptions!.relationshipTypes[0];

      const filteredResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/rdf/graph/explore') &&
          response.url().includes('relationshipTypes=')
      );

      await controls.getByRole('button', { name: 'Relationship Type' }).click();

      await page
        .getByRole('menuitemcheckbox', {
          name: `${firstOption.label} (${firstOption.count})`,
          exact: true,
        })
        .click();

      await page.keyboard.press('Escape');

      const response = await filteredResponse;

      expect(response.url()).toContain('relationshipTypes=');

      await waitForAllLoadersToDisappear(page);
    });

    await test.step('Verify relationship type button label shows selection count', async () => {
      await expect(
        controls.getByRole('button', { name: 'Relationship Type (1)' })
      ).toBeVisible();
    });
  });

  test('Verify Clear All button resets all active filters', async ({
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

    await graphDataResponse;
    await waitForAllLoadersToDisappear(page);
    await expectGraphRendered(page);

    const controls = page.locator('[data-testid="knowledge-graph-controls"]');
    const layoutTabs = page.locator('[data-testid="layout-tabs"]');

    await test.step('Verify Clear All is not visible at default filter state', async () => {
      await expect(
        controls.getByRole('button', { name: 'Clear All' })
      ).not.toBeVisible();
    });

    await test.step('Activate filters by switching to Hierarchical layout and increasing depth', async () => {
      await layoutTabs.getByRole('tab', { name: 'Hierarchical' }).click();

      await expect(
        controls.getByRole('button', { name: 'Clear All' })
      ).toBeVisible();

      const depth2Response = page.waitForResponse(
        (response) =>
          response.url().includes('/rdf/graph/explore') &&
          response.url().includes('depth=2')
      );

      await page
        .locator('[data-testid="depth-slider"] input[type="range"]')
        .press('ArrowRight');

      await depth2Response;
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('Verify Clear All resets layout to Radial and hides the button', async () => {
      const resetResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/rdf/graph/explore') &&
          response.url().includes(`entityId=${table.entityResponseData.id}`)
      );

      await controls.getByRole('button', { name: 'Clear All' }).click();

      await resetResponse;
      await waitForAllLoadersToDisappear(page);

      await expect(
        layoutTabs.getByRole('tab', { name: 'Radial' })
      ).toHaveAttribute('aria-selected', 'true');

      await expect(
        controls.getByRole('button', { name: 'Clear All' })
      ).not.toBeVisible();
    });
  });

  test('Verify Export Graph panel shows all format options and triggers export API calls', async ({
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

    await graphDataResponse;
    await waitForAllLoadersToDisappear(page);

    await test.step('Verify export button is visible', async () => {
      await expect(
        page.locator('[data-testid="knowledge-graph-export"]')
      ).toBeVisible();
    });

    await test.step('Verify export dropdown shows only supported export format options', async () => {
      await page.locator('[data-testid="knowledge-graph-export"]').click();

      await expect(
        page.getByRole('menuitemradio', { name: 'PNG' })
      ).toBeVisible();
      await expect(
        page.getByRole('menuitemradio', { name: 'JSON-LD' })
      ).toBeVisible();
      await expect(
        page.getByRole('menuitemradio', { name: 'Turtle (.ttl)' })
      ).toBeVisible();
      await expect(
        page.getByRole('menuitemradio', { name: 'SVG' })
      ).toHaveCount(0);

      await page.keyboard.press('Escape');
    });

    await test.step('Verify JSON-LD export sends a request to the export API endpoint', async () => {
      const exportRequest = page.waitForRequest(
        (request) =>
          request.url().includes('/rdf/graph/explore/export') &&
          request.url().includes('format=jsonld')
      );

      await page.locator('[data-testid="knowledge-graph-export"]').click();
      await page.getByRole('menuitemradio', { name: 'JSON-LD' }).click();

      const request = await exportRequest;

      expect(request.url()).toContain('format=jsonld');
    });

    await test.step('Verify Turtle RDF export sends a request to the export API endpoint', async () => {
      const exportRequest = page.waitForRequest(
        (request) =>
          request.url().includes('/rdf/graph/explore/export') &&
          request.url().includes('format=turtle')
      );

      await page.locator('[data-testid="knowledge-graph-export"]').click();
      await page.getByRole('menuitemradio', { name: 'Turtle (.ttl)' }).click();

      const request = await exportRequest;

      expect(request.url()).toContain('format=turtle');
    });
  });

  test('Verify clicking canvas background deselects node and closes entity summary panel', async ({
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
    await expectGraphRendered(page);

    await page.locator('[data-testid="fit-screen"]').click();

    const clickableNode = graphData.nodes.find((n) => n.fullyQualifiedName);

    if (!clickableNode) {
      throw new Error('Expected at least one node with fullyQualifiedName');
    }

    await test.step('Click a node to open the entity summary panel', async () => {
      await page.locator(`[data-testid="node-${clickableNode.label}"]`).click();

      await expect(
        page.locator('[data-testid="entity-summary-panel-container"]')
      ).toBeVisible();
    });

    await test.step('Click canvas background to close the entity summary panel', async () => {
      const canvasBox = await page
        .locator('[data-testid="knowledge-graph-canvas"]')
        .boundingBox();

      expect(canvasBox).not.toBeNull();

      await page.mouse.click(canvasBox!.x + 5, canvasBox!.y + 5);

      await expect(
        page.locator('[data-testid="entity-summary-panel-container"]')
      ).not.toBeVisible();
    });

    await test.step('Verify the entity summary panel can be reopened after deselection', async () => {
      await page.locator(`[data-testid="node-${clickableNode.label}"]`).click();

      await expect(
        page.locator('[data-testid="entity-summary-panel-container"]')
      ).toBeVisible();
    });
  });
  test('Verify the relationship legend decodes the edge styling', async ({
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
    await expectGraphRendered(page);

    const legend = page.getByTestId('knowledge-graph-legend');

    await test.step('Legend is visible whenever the graph has relations', async () => {
      expect(graphData.edges.length).toBeGreaterThan(0);

      await expect(legend).toBeVisible();
      await expect(
        page.getByTestId('knowledge-graph-legend-items')
      ).toBeVisible();
    });

    await test.step('Legend lists at least one relation family with a count', async () => {
      await expect(
        legend.locator('[data-testid^="legend-item-"]')
      ).not.toHaveCount(0);

      const counts = await legend
        .locator('[data-testid^="legend-count-"]')
        .allTextContents();

      expect(counts.length).toBeGreaterThan(0);
      counts.forEach((count) => expect(Number(count)).toBeGreaterThan(0));
    });

    await test.step('Every legend item carries a coloured, directional sample', async () => {
      const strokes = await legend
        .locator('svg line')
        .evaluateAll((lines) =>
          lines.map((line) => line.getAttribute('stroke'))
        );

      expect(strokes.length).toBeGreaterThan(0);
      strokes.forEach((stroke) => expect(stroke).toBeTruthy());
      // A shared colour would make the legend ambiguous about which family an
      // edge belongs to.
      expect(new Set(strokes).size).toBe(strokes.length);
    });

    await test.step('Legend collapses and expands from its header', async () => {
      const toggle = page.getByTestId('knowledge-graph-legend-toggle');

      await toggle.click();

      await expect(
        page.getByTestId('knowledge-graph-legend-items')
      ).not.toBeAttached();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');

      await toggle.click();

      await expect(
        page.getByTestId('knowledge-graph-legend-items')
      ).toBeVisible();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    });
  });

  test('Verify the relationship label toggle declutters the graph', async ({
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

    await graphDataResponse;
    await waitForAllLoadersToDisappear(page);
    await expectGraphRendered(page);

    const toggle = page.getByTestId('toggle-edge-labels');

    await test.step('Labels are on by default', async () => {
      await expect(toggle).toBeChecked();
    });

    await test.step('Turning labels off rebuilds the graph without them', async () => {
      await toggle.click();

      await expect(toggle).not.toBeChecked();
      // The graph is rebuilt on toggle; the nodes must survive that rebuild.
      await expectGraphRendered(page);
    });

    await test.step('Turning labels back on restores them', async () => {
      await toggle.click();

      await expect(toggle).toBeChecked();
      await expectGraphRendered(page);
    });
  });

  test('Verify hovering a node dims the rest of the graph', async ({
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
    await expectGraphRendered(page);

    await page.locator('[data-testid="fit-screen"]').click();
    await expect(
      page.locator('[data-testid="knowledge-graph-canvas"]')
    ).toBeVisible();

    // Give G6 time to settle the fit-screen transform before reading positions.
    // eslint-disable-next-line playwright/no-wait-for-timeout -- G6 settles the fit-screen transform on its own animation clock and exposes no DOM signal to await; reading bounding boxes earlier yields pre-transform coordinates.
    await page.waitForTimeout(2000);

    const hoverTarget = graphData.nodes.find(
      (n) => n.type === 'databaseSchema'
    );

    if (!hoverTarget) {
      throw new Error('Expected a databaseSchema node in the graph');
    }

    const hoverLocator = page.locator(
      `[data-testid="node-${hoverTarget.label}"]`
    );
    const targetBox = await hoverLocator.boundingBox();

    expect(targetBox).not.toBeNull();

    await test.step('Nothing is dimmed before the pointer enters the graph', async () => {
      await expect(page.locator('[data-testid^="node-"].dimmed')).toHaveCount(
        0
      );
    });

    await test.step('Hovering focuses the path and dims everything else', async () => {
      await page.mouse.move(
        targetBox!.x + targetBox!.width / 2,
        targetBox!.y + targetBox!.height / 2
      );

      await expect(hoverLocator).toHaveClass(/highlighted/);
      await expect(hoverLocator).not.toHaveClass(/dimmed/);
      await expect(
        page.locator('[data-testid^="node-"].dimmed')
      ).not.toHaveCount(0);
    });

    await test.step('Leaving the node restores the whole graph', async () => {
      const canvasBox = await page
        .locator('[data-testid="knowledge-graph-canvas"]')
        .boundingBox();

      await page.mouse.move(canvasBox?.x ?? 0, canvasBox?.y ?? 0);

      await expect(page.locator('[data-testid^="node-"].dimmed')).toHaveCount(
        0
      );
    });
  });
});
