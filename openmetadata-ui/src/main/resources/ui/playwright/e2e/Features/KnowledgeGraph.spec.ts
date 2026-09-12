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

import test, { expect, Page, Route } from '@playwright/test';
import { readFile } from 'fs/promises';
import { parse } from 'papaparse';
import { TableClass } from '../../support/entity/TableClass';
import { createNewPage } from '../../utils/common';
import { getEncodedFqn } from '../../utils/entity';
interface GraphData {
  nodes: {
    id: string;
    label: string;
    type: string;
    fullyQualifiedName?: string;
  }[];
  edges: { from: string; to: string; label: string; relationType?: string }[];
  truncated?: boolean;
  filterOptions?: {
    entityTypes: { id: string; label: string; count: number }[];
    relationshipTypes: { id: string; label: string; count: number }[];
  };
}

const chooseLevel = async (page: Page, level: number) => {
  await page.getByTestId('level-chooser').getByRole('button').click();
  await page.getByTestId(`graph-level-${level}`).click();
};

const downloadRelationships = async (page: Page) => {
  await page.getByTestId('graph-view-menu').click();
  await page.getByTestId('knowledge-graph-export').click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('menuitemradio', { name: 'CSV', exact: true }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe(
    'knowledge-graph-relationships.csv'
  );
  const path = await download.path();
  if (!path) throw new Error('Missing CSV download');
  const content = await readFile(path, 'utf8');
  await page.getByTestId('graph-layout-chooser').getByRole('button').focus();
  await page.keyboard.press('Escape');

  return parse<string[]>(content).data;
};
const chooseView = async (page: Page, name: string) => {
  if (name === 'Ontology' || name === 'Knowledge Graph') {
    await page.getByRole('radio', { name, exact: true }).click();

    return;
  }
  await page.getByTestId('graph-view-menu').click();
  const choosers: Record<string, string> = {
    Concentric: 'graph-layout-chooser',
    Hierarchical: 'graph-layout-chooser',
    'Connection lanes': 'graph-layout-chooser',
    'Every entity': 'graph-presentation-chooser',
    Balanced: 'graph-presentation-chooser',
  };
  const chooser = choosers[name] ?? 'graph-label-chooser';
  await page.getByTestId(chooser).getByRole('button').click();
  await page.getByRole('option', { name, exact: true }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await page.getByTestId(chooser).getByRole('button').focus();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('graph-view-settings')).toHaveCount(0);
};
const nodePosition = async (page: Page, label: string) => {
  const box = await page
    .locator('.knowledge-graph-custom-node')
    .filter({ has: page.getByTestId(`node-${label}`) })
    .boundingBox();
  if (!box) throw new Error(`Missing node ${label}`);
  const canvas = await page.getByTestId('knowledge-graph-canvas').boundingBox();
  if (!canvas) throw new Error('Missing graph canvas');
  return {
    x: box.x + box.width / 2 - canvas.x,
    y: box.y + box.height / 2 - canvas.y,
    width: box.width,
  };
};
const expectPosition = async (
  page: Page,
  label: string,
  position: { x: number; y: number; width: number }
) => {
  await expect
    .poll(async () => {
      const current = await nodePosition(page, label);
      return Math.max(
        Math.abs(current.x - position.x),
        Math.abs(current.y - position.y),
        Math.abs(current.width - position.width)
      );
    })
    .toBeLessThan(2);
};
const zoomLabel = async (page: Page) =>
  (await page.getByTestId('graph-view-controls').innerText()).match(
    /\d+%/
  )?.[0];
const paintedPixels = async (page: Page) =>
  page
    .getByTestId('knowledge-graph-canvas')
    .locator('canvas')
    .evaluateAll((elements) => {
      let count = 0;
      for (const element of elements) {
        const canvas = element as HTMLCanvasElement;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Expected a real G6 canvas');
        const pixels = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height
        ).data;
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) count++;
      }
      return count;
    });

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Knowledge Graph', { tag: ['@knowledge-graph'] }, () => {
  let table: TableClass;
  const fixture = (dense = false): GraphData => {
    const root = table.entityResponseData.id;
    const nodes: GraphData['nodes'] = [
      {
        id: root,
        label: 'Orders',
        type: 'table',
        fullyQualifiedName: table.entityResponseData.fullyQualifiedName,
      },
      { id: 'schema', label: 'Sales schema', type: 'databaseSchema' },
      { id: 'direct', label: 'Customers', type: 'table' },
      { id: 'outer', label: 'Extended table', type: 'table' },
      { id: 'owner', label: 'Steward', type: 'user' },
      { id: 'domain', label: 'Finance', type: 'domain' },
      { id: 'term', label: 'Revenue', type: 'glossaryTerm' },
      { id: 'suite', label: 'Quality checks', type: 'testSuite' },
    ];
    const edges: GraphData['edges'] = [
      {
        from: root,
        to: 'schema',
        label: 'Belongs to',
        relationType: 'belongsTo',
      },
      { from: 'schema', to: root, label: 'Contains', relationType: 'contains' },
      {
        from: root,
        to: 'schema',
        label: 'Custom predicate',
        relationType: 'customPredicate',
      },
      {
        from: 'schema',
        to: 'outer',
        label: 'Contains',
        relationType: 'contains',
      },
      {
        from: root,
        to: 'direct',
        label: 'Downstream',
        relationType: 'downstream',
      },
      { from: 'direct', to: root, label: 'Upstream', relationType: 'upstream' },
      {
        from: 'schema',
        to: 'direct',
        label: 'Cross link',
        relationType: 'customCrossLink',
      },
      {
        from: 'direct',
        to: 'direct',
        label: 'Related to',
        relationType: 'relatedTo',
      },
      { from: root, to: 'owner', label: 'Owned by', relationType: 'ownedBy' },
      {
        from: root,
        to: 'domain',
        label: 'Has domain',
        relationType: 'hasDomain',
      },
      {
        from: root,
        to: 'term',
        label: 'Has glossary term',
        relationType: 'hasGlossaryTerm',
      },
      {
        from: root,
        to: 'suite',
        label: 'Has test suite',
        relationType: 'hasTestSuite',
      },
    ];
    if (dense) {
      for (let index = 0; index < 192; index++) {
        const id = `dense-${index}`;
        nodes.push({
          id,
          label: `Extended asset ${String(index).padStart(3, '0')}`,
          type: 'table',
        });
        edges.push({
          from: 'schema',
          to: id,
          label: 'Contains',
          relationType: 'contains',
        });
        edges.push({
          from: 'direct',
          to: id,
          label: 'Downstream',
          relationType: 'downstream',
        });
      }
    }
    const entityTypes = [...new Set(nodes.map((node) => node.type))].map(
      (type) => ({
        id: type,
        label: type,
        count: nodes.filter((node) => node.type === type).length,
      })
    );
    const relationshipTypes = [
      ...new Set(edges.map((edge) => edge.relationType!)),
    ].map((type) => ({
      id: type,
      label: type,
      count: edges.filter((edge) => edge.relationType === type).length,
    }));
    return {
      nodes,
      edges,
      filterOptions: { entityTypes, relationshipTypes },
      truncated: dense,
    };
  };
  const responseFor = (
    url: URL,
    dense = false,
    graph = fixture(dense)
  ): GraphData => {
    const root =
      url.searchParams.get('entityId') ?? table.entityResponseData.id;
    const depth = Number(url.searchParams.get('depth'));
    const included = new Set([root]);
    for (let distance = 0; distance < depth; distance++) {
      const current = new Set(included);
      graph.edges.forEach((edge) => {
        if (current.has(edge.from)) included.add(edge.to);
        if (current.has(edge.to)) included.add(edge.from);
      });
    }
    const types = url.searchParams.get('entityTypes')?.split(',');
    const predicates = url.searchParams.get('relationshipTypes')?.split(',');
    const nodes = graph.nodes.filter(
      (node) =>
        included.has(node.id) &&
        (!types || node.id === root || types.includes(node.type))
    );
    const ids = new Set(nodes.map((node) => node.id));
    const edges = graph.edges.filter(
      (edge) =>
        ids.has(edge.from) &&
        ids.has(edge.to) &&
        (!predicates || predicates.includes(edge.relationType!))
    );
    return { ...graph, nodes, edges };
  };
  const mockGraph = async (page: Page, dense = false) => {
    await page.route('**/api/v1/rdf/graph/explore?**', async (route) => {
      await route.fulfill({
        json: responseFor(new URL(route.request().url()), dense),
      });
    });
  };
  const open = async (page: Page) => {
    await page.goto(
      `/table/${getEncodedFqn(
        table.entityResponseData.fullyQualifiedName!
      )}/knowledge_graph?fullscreen=true`,
      { waitUntil: 'domcontentloaded' }
    );
    await expect(page.getByTestId('knowledge-graph-canvas')).toHaveAttribute(
      'data-ready',
      'true'
    );
    await expect(page.getByTestId('knowledge-graph-canvas')).toHaveAttribute(
      'aria-busy',
      'false'
    );
  };

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    table = new TableClass();
    await table.create(apiContext);
    await afterAction();
  });
  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await table.delete(apiContext);
    await afterAction();
  });

  test('fullscreen occupies the viewport and Escape restores the same canvas', async ({
    page,
  }) => {
    await mockGraph(page);
    await open(page);
    const viewport = page.viewportSize()!;
    const fullscreen = page.locator('.full-screen-knowledge-graph');
    await expect
      .poll(() => fullscreen.boundingBox())
      .toEqual({ x: 0, y: 0, width: viewport.width, height: viewport.height });
    const graph = page.getByTestId('knowledge-graph-container');
    const bounds = await graph.boundingBox();
    expect(bounds!.y).toBeLessThan(32);
    await expect(page.getByTestId('graph-footer')).toBeInViewport();
    await page
      .getByTestId('knowledge-graph-canvas')
      .locator('canvas')
      .evaluateAll((canvases) =>
        canvases.forEach((canvas) =>
          canvas.setAttribute('data-retained', 'true')
        )
      );
    await page.getByTestId('exit-full-screen').focus();
    await page.keyboard.press('Escape');
    await expect(fullscreen).toHaveCount(0);
    await expect(page.getByTestId('full-screen')).toBeFocused();
    await expect(
      page
        .getByTestId('knowledge-graph-canvas')
        .locator('canvas:not([data-retained])')
    ).toHaveCount(0);
    await page.getByTestId('full-screen').press('Enter');
    await expect
      .poll(() => fullscreen.boundingBox())
      .toEqual({ x: 0, y: 0, width: viewport.width, height: viewport.height });
    await chooseView(page, 'All labels');
    await expect(fullscreen).toBeVisible();
    await expect(
      page
        .getByTestId('knowledge-graph-canvas')
        .locator('canvas:not([data-retained])')
    ).toHaveCount(0);
  });

  test('renders every returned node and predicate from the live RDF endpoint', async ({
    page,
  }) => {
    // Match on the request alone and assert the status after: filtering on 200
    // inside the predicate makes a failing explore call look like a call that
    // never happened, and the wait then times out without naming the HTTP error.
    //
    // RdfLiveWriter projects on a bounded drain, so the table created in
    // beforeAll reaches the store as a bare node first and its relationships
    // land a moment later. Reopen until the projection has caught up instead of
    // asserting on whichever half of it happened to exist on the first paint.
    let graph!: GraphData;
    await expect
      .poll(
        async () => {
          const response = page.waitForResponse((r) =>
            r.url().includes('/rdf/graph/explore?')
          );
          await open(page);
          const exploreResponse = await response;
          expect(exploreResponse.status()).toBe(200);
          graph = (await exploreResponse.json()) as GraphData;

          return graph.edges.length;
        },
        { timeout: 40_000 }
      )
      .toBeGreaterThan(0);

    await chooseView(page, 'Every entity');
    await expect(page.locator('[data-node-id]')).toHaveCount(
      graph.nodes.length
    );
    await expect(page.locator('[data-edge-id]')).toHaveCount(
      graph.edges.length
    );
    await expect.poll(() => paintedPixels(page)).toBeGreaterThan(100);
    await expect(page.getByTestId('graph-status')).toContainText(
      `${graph.nodes.length} entities`
    );
  });

  test('the level dropdown is keyboard accessible, maps levels to depths 1, 1 and 2 and shows the entity profile at level 1', async ({
    page,
  }) => {
    await mockGraph(page);
    await open(page);
    await expect(page.getByTestId('level-chooser')).toContainText('2 · Direct');
    // Levels 1 and 2 are two views over the same depth-1 traversal, so level 1
    // opens from the cache without another request.
    let exploreRequests = 0;
    page.on('request', (r) => {
      if (new URL(r.url()).pathname === '/api/v1/rdf/graph/explore') {
        exploreRequests += 1;
      }
    });
    await page.getByTestId('level-chooser').getByRole('button').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(3);
    await page.keyboard.press('Home');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('level-chooser')).toContainText('1 ·');
    // Level 1 is the entity with its owners, containers and governance; lineage,
    // quality and business concepts wait for level 2.
    await expect(page.locator('[data-node-id]')).toHaveCount(4);
    await expect(page.locator('[data-edge-id]')).toHaveCount(4);
    await expect(page.getByTestId('node-Orders')).toBeVisible();
    await expect(page.getByTestId('node-Steward')).toBeVisible();
    await expect(page.getByTestId('node-Finance')).toBeVisible();
    await expect(page.getByTestId('node-Customers')).toHaveCount(0);
    await expect(page.getByTestId('node-Revenue')).toHaveCount(0);
    await expect(
      page.getByTestId('graph-level-rings').locator('rect')
    ).toHaveCount(0);
    expect(exploreRequests).toBe(0);
    await chooseLevel(page, 2);
    await expect(page.getByTestId('level-chooser')).toContainText('2 ·');
    await expect(page.getByTestId('node-Customers')).toBeVisible();
    await expect(page.getByTestId('node-Revenue')).toBeVisible();
    await expect(
      page.getByTestId('graph-level-rings').locator('rect')
    ).toHaveCount(1);
    expect(exploreRequests).toBe(0);
    const extendedRequest = page.waitForRequest(
      (r) =>
        new URL(r.url()).pathname === '/api/v1/rdf/graph/explore' &&
        new URL(r.url()).searchParams.get('depth') === '2'
    );
    await chooseLevel(page, 3);
    await extendedRequest;
    await expect(page.getByTestId('level-chooser')).toContainText('3 ·');
    await expect(page.getByTestId('node-Extended table')).toHaveAttribute(
      'data-level',
      '3'
    );
    await page.getByTestId('graph-view-menu').click();
    await page.getByRole('checkbox', { name: 'Show level bands' }).focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('Escape');
    await expect(
      page.getByTestId('graph-level-rings').locator('text')
    ).toHaveCount(0);
  });

  test('re-fits each level around the subject and keeps the viewport when filtering', async ({
    page,
  }) => {
    await mockGraph(page);
    await open(page);
    await chooseLevel(page, 2);
    const fitted = await zoomLabel(page);
    await page.getByTestId('zoom-in').click();
    await expect.poll(() => zoomLabel(page)).not.toBe(fitted);
    const zoomedIn = await zoomLabel(page);
    await chooseLevel(page, 3);
    await expect(page.getByTestId('node-Extended table')).toHaveAttribute(
      'data-level',
      '3'
    );
    // Extending re-frames the graph instead of inheriting the zoomed-in view:
    // the zoom is fitted again and the subject returns to the centre.
    await expect.poll(() => zoomLabel(page)).not.toBe(zoomedIn);
    const canvas = await page
      .getByTestId('knowledge-graph-canvas')
      .boundingBox();
    if (!canvas) throw new Error('The graph canvas must be visible');
    const root = await nodePosition(page, 'Orders');
    expect(Math.abs(root.x - canvas.width / 2)).toBeLessThan(2);
    expect(Math.abs(root.y - canvas.height / 2)).toBeLessThan(2);
    await expect(
      page.getByTestId('graph-level-rings').locator('rect')
    ).toHaveCount(2);
    const outer = await nodePosition(page, 'Extended table');
    await page.getByTestId('graph-filters-toggle').click();
    // Opening the filter row resizes the canvas; take the position after that change.
    await page
      .getByRole('button', { name: 'Entity Type', exact: true })
      .click();
    await page.getByRole('menuitemcheckbox', { name: /^table \(/ }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('node-Sales schema')).toHaveCount(0);
    await expect(page.getByTestId('node-Extended table')).toHaveAttribute(
      'data-level',
      '3'
    );
    const filteredOuter = await nodePosition(page, 'Extended table');
    expect(filteredOuter.width).toBeCloseTo(outer.width, 1);
    expect(filteredOuter.x).toBeCloseTo(outer.x, 1);
    await page
      .getByRole('button', { name: 'Clear Filters', exact: true })
      .click();
    await expect(page.getByTestId('node-Sales schema')).toHaveCount(1);
    await expect(page.getByTestId('level-chooser')).toContainText(
      '3 · Extended'
    );
  });

  test('find and the keyboard inspector expose each distinct directed relationship', async ({
    page,
  }) => {
    await mockGraph(page);
    await open(page);
    await chooseLevel(page, 3);
    const find = page.getByRole('combobox', { name: 'Find in graph' });
    await find.fill('Orders');
    await page.getByRole('option', { name: 'Orders', exact: true }).click();
    const root = page.getByTestId('node-Orders');
    await expect(root).toBeFocused();
    await root.press('Enter');
    const inspector = page.getByTestId('graph-inspector');
    await expect(inspector.getByRole('heading')).toBeFocused();
    // Each row names the other endpoint and carries the predicate with its
    // direction, so the three distinct statements to the schema stay apart.
    for (const label of [
      'Sales schema → Belongs to',
      'Sales schema ← Contains',
      'Sales schema → Custom predicate',
    ]) {
      await expect(
        inspector.getByRole('button', { name: label, exact: true })
      ).toBeVisible();
    }
    await inspector
      .getByRole('button', {
        name: 'Sales schema → Custom predicate',
        exact: true,
      })
      .click();
    await expect(inspector).toContainText('Custom predicate');
    await expect(
      inspector.getByRole('link', { name: 'Orders', exact: true })
    ).toHaveAttribute('href', /\/table\//);
    await expect(page.locator('[data-edge-id]')).toHaveCount(12);
    await inspector.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(inspector).toHaveCount(0);
  });

  test('label modes and family highlights preserve all real canvas relationships', async ({
    page,
  }) => {
    await mockGraph(page);
    await open(page);
    await chooseLevel(page, 3);
    await page.getByTestId('fit-screen').click();
    await page.getByTestId('graph-view-menu').hover();
    await expect(
      page.locator('.knowledge-graph-custom-node.dimmed')
    ).toHaveCount(0);
    const position = await nodePosition(page, 'Orders');
    const before = await paintedPixels(page);
    await chooseView(page, 'No labels');
    await expect(page.locator('[data-edge-id]')).toHaveCount(12);
    await expectPosition(page, 'Orders', position);
    await expect.poll(() => paintedPixels(page)).toBeGreaterThan(100);
    await expect.poll(() => paintedPixels(page)).toBeLessThan(before);
    await chooseView(page, 'All labels');
    await page.getByTestId('graph-view-menu').hover();
    await expect(
      page.locator('.knowledge-graph-custom-node.dimmed')
    ).toHaveCount(0);
    await expect.poll(() => paintedPixels(page)).toBeGreaterThan(before);
    await chooseView(page, 'Auto labels');
    await page.getByTestId('knowledge-graph-legend-toggle').click();
    await page.getByTestId('legend-item-other').getByRole('button').click();
    await expect(
      page.getByTestId('legend-item-other').getByRole('button')
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-edge-id]')).toHaveCount(12);
    await expectPosition(page, 'Orders', position);
    await expect(
      page.locator('.knowledge-graph-custom-node.dimmed')
    ).not.toHaveCount(0);
  });

  test('hover reveals the exact predicate and clicking a canvas edge pins it', async ({
    page,
  }) => {
    await mockGraph(page);
    await open(page);
    await chooseLevel(page, 3);
    await page.getByTestId('fit-screen').click();
    await chooseView(page, 'No labels');
    const point = await page
      .getByTestId('knowledge-graph-canvas')
      .evaluate((container) => {
        const nodeBounds = Array.from(
          container.querySelectorAll('[data-node-id]'),
          (node) => node.getBoundingClientRect()
        );
        for (const canvas of container.querySelectorAll('canvas')) {
          const context = canvas.getContext('2d');
          if (!context) continue;
          const rect = canvas.getBoundingClientRect();
          const pixels = context.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
          ).data;
          const scaleX = rect.width / canvas.width;
          const scaleY = rect.height / canvas.height;
          for (let y = 30; y < canvas.height - 80; y++) {
            for (let x = 30; x < canvas.width - 30; x++) {
              const offset = (y * canvas.width + x) * 4;
              if (
                pixels[offset + 3] < 230 ||
                pixels[offset + 2] < 150 ||
                pixels[offset] > 100 ||
                pixels[offset + 1] > 150
              )
                continue;
              const point = { x: rect.x + x * scaleX, y: rect.y + y * scaleY };
              const nearNode = nodeBounds.some(
                (node) =>
                  point.x > node.left - 20 &&
                  point.x < node.right + 20 &&
                  point.y > node.top - 20 &&
                  point.y < node.bottom + 20
              );
              if (!nearNode) return point;
            }
          }
        }
        throw new Error('No painted relationship found on the real canvas');
      });
    await page.mouse.move(point.x, point.y);
    const tooltip = page.getByTestId('edge-tooltip');
    await expect(tooltip).toBeVisible();
    const label = await tooltip.locator('.kg-edge-tooltip__label').innerText();
    expect(fixture().edges.map((edge) => edge.label)).toContain(label);
    await page.mouse.click(point.x, point.y);
    await expect(page.getByTestId('graph-inspector')).toContainText(label);
    await expect(page.locator('[data-edge-id]')).toHaveCount(12);
  });

  test('rapid changes ignore stale responses and failed refreshes preserve the current view', async ({
    page,
  }) => {
    let delayed: Route | undefined;
    let fail = false;
    let shouldDelay = false;
    await page.route('**/api/v1/rdf/graph/explore?**', async (route) => {
      const url = new URL(route.request().url());
      if (shouldDelay && url.searchParams.get('depth') === '2') {
        delayed = route;
        return;
      }
      await route.fulfill(
        fail
          ? { status: 503, json: { message: 'Unavailable' } }
          : { json: responseFor(url) }
      );
    });
    await open(page);
    await chooseLevel(page, 2);
    shouldDelay = true;
    await chooseLevel(page, 3);
    await expect.poll(() => Boolean(delayed)).toBe(true);
    await expect(page.getByTestId('graph-status')).toContainText('Updating');
    await expect(page.getByTestId('node-Orders')).toHaveCount(1);
    await chooseLevel(page, 1);
    await expect(page.locator('[data-node-id]')).toHaveCount(4);
    await delayed!
      .fulfill({ json: responseFor(new URL(delayed!.request().url())) })
      .catch(() => undefined);
    await expect(page.getByTestId('graph-status')).toContainText('4 entities');
    fail = true;
    await page.getByTestId('refresh').click();
    await expect(page.getByRole('alert')).toContainText('Could not load');
    await expect(page.getByTestId('node-Orders')).toHaveCount(1);
    await expect(page.getByTestId('level-chooser')).toBeVisible();
    fail = false;
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('dense graphs retain all returned entities and expose partial results', async ({
    page,
  }) => {
    await mockGraph(page, true);
    await open(page);
    await chooseLevel(page, 3);
    await chooseView(page, 'Every entity');
    await expect(page.locator('[data-node-id]')).toHaveCount(200);
    await expect(page.locator('[data-edge-id]')).toHaveCount(396);
    await expect(page.getByTestId('graph-partial')).toContainText(
      'Partial graph'
    );
    await expect(page.getByTestId('graph-status')).toContainText(
      '200 entities · 396 relationships'
    );
    await page
      .getByRole('combobox', { name: 'Find in graph' })
      .fill('Extended asset 191');
    await page
      .getByRole('option', { name: 'Extended asset 191', exact: true })
      .click();
    await expect(page.getByTestId('node-Extended asset 191')).toBeFocused();
    await expect.poll(() => paintedPixels(page)).toBeGreaterThan(100);
    await chooseView(page, 'Hierarchical');
    await expect(
      page.getByTestId('graph-level-rings').locator('ellipse')
    ).toHaveCount(0);
    await expect(page.locator('[data-node-id]')).toHaveCount(200);
  });

  test('small graphs fit around the selected entity and use consistent view controls and typography', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1500, height: 900 });
    await mockGraph(page);
    await open(page);
    await chooseLevel(page, 2);
    await page.getByTestId('fit-screen').click();
    await expect
      .poll(() =>
        page.getByTestId('knowledge-graph-canvas').evaluate((container) => {
          const canvas = container.getBoundingClientRect();
          return Array.from(container.querySelectorAll('[data-node-id]')).every(
            (node) => {
              const rect = node.getBoundingClientRect();
              return (
                rect.left >= canvas.left &&
                rect.right <= canvas.right &&
                rect.top >= canvas.top &&
                rect.bottom <= canvas.bottom
              );
            }
          );
        })
      )
      .toBe(true);
    const canvas = await page
      .getByTestId('knowledge-graph-canvas')
      .boundingBox();
    if (!canvas) throw new Error('The graph canvas must be visible');
    const root = await nodePosition(page, 'Orders');
    expect(Math.abs(root.x - canvas.width / 2)).toBeLessThan(2);
    expect(Math.abs(root.y - canvas.height / 2)).toBeLessThan(2);
    await expect(
      page.getByTestId('node-Revenue').getByTestId('type-tag')
    ).toHaveText('Concept');
    await expect(
      page.getByTestId('node-Orders').getByTestId('label')
    ).toHaveCSS('font-size', '15px');
    await expect(page.getByTestId('node-Orders')).toHaveCSS(
      'font-family',
      /Inter/
    );
    await expect(page.getByTestId('graph-status')).not.toContainText('Level 2');
    await expect(page.getByTestId('knowledge-graph-export')).toHaveCount(0);
    await expect(
      page.getByRole('radio', { name: 'Ontology', exact: true })
    ).toBeVisible();
    await page.getByTestId('graph-view-menu').click();
    await expect(
      page
        .getByTestId('graph-view-settings')
        .getByRole('heading', { name: 'View', exact: true })
    ).toHaveCSS('font-size', '14px');
    await expect(page.getByTestId('graph-layout-chooser')).toContainText(
      'Connection lanes'
    );
    await expect(page.getByTestId('graph-label-chooser')).toContainText(
      'Auto labels'
    );
    await expect(page.getByRole('menuitemcheckbox')).toHaveCount(0);
    await expect(page.getByTestId('knowledge-graph-export')).toBeVisible();
  });

  test('narrow layouts, 200 percent zoom, dark mode and reduced motion keep controls usable', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1000, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
    await page.addInitScript(() => localStorage.setItem('ui-theme', 'dark'));
    await mockGraph(page);
    await open(page);
    await expect(page.getByTestId('exit-full-screen')).toBeVisible();
    await page.evaluate(() => {
      document.documentElement.style.zoom = '2';
    });
    const toolbar = page.getByTestId('knowledge-graph-controls');
    await expect
      .poll(() =>
        toolbar.evaluate(
          (element) => element.scrollWidth <= element.clientWidth + 1
        )
      )
      .toBe(true);
    await expect
      .poll(() =>
        page
          .getByTestId('knowledge-graph-container')
          .evaluate(
            (element) =>
              element.getBoundingClientRect().right <= window.innerWidth + 1
          )
      )
      .toBe(true);
    for (const id of [
      'graph-mode-chooser',
      'level-chooser',
      'graph-filters-toggle',
      'graph-view-menu',
    ])
      await expect(page.getByTestId(id)).toBeVisible();
    await page.getByTestId('level-chooser').getByRole('button').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(3);
    await page.keyboard.press('Escape');
    await page.getByTestId('graph-view-menu').focus();
    await page.keyboard.press('Enter');
    await page.getByTestId('graph-label-chooser').getByRole('button').focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('End');
    await expect(
      page.getByRole('option', { name: 'No labels', exact: true })
    ).toBeFocused();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    await expect(page.locator('html')).toHaveClass(/dark-mode/);
    await expect(page.getByTestId('node-Orders')).toHaveCSS(
      'transition-duration',
      '0s'
    );
    await expect
      .poll(() =>
        page.getByTestId('knowledge-graph-container').evaluate((element) => {
          const canvas = element.querySelector(
            '[data-testid="knowledge-graph-canvas"]'
          );

          return (
            canvas !== null &&
            canvas.getBoundingClientRect().bottom <=
              element.getBoundingClientRect().bottom
          );
        })
      )
      .toBe(true);
    await page.screenshot({
      path: test.info().outputPath('controls-200-percent-dark.png'),
    });
    await page.getByTestId('knowledge-graph-canvas').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('node-Orders')).toBeInViewport();
    await page.screenshot({
      path: test.info().outputPath('graph-200-percent-dark.png'),
    });
  });

  test('exports the level 1 entity profile as the root-only RDF scope in Turtle and JSON-LD', async ({
    page,
  }) => {
    await mockGraph(page);
    await page.route('**/api/v1/rdf/graph/explore/export?**', (route) =>
      route.fulfill({ body: 'root', contentType: 'text/plain' })
    );
    await open(page);
    await chooseLevel(page, 1);
    await expect(page.locator('[data-node-id]')).toHaveCount(4);
    for (const [name, format] of [
      ['SKOS / Turtle', 'turtle'],
      ['JSON-LD', 'jsonld'],
    ]) {
      const request = page.waitForRequest(
        (r) =>
          new URL(r.url()).pathname === '/api/v1/rdf/graph/explore/export' &&
          new URL(r.url()).searchParams.get('format') === format
      );
      await page.getByTestId('graph-view-menu').click();
      await page.getByTestId('knowledge-graph-export').click();
      await page.getByRole('menuitemradio', { name, exact: true }).click();
      await expect(
        page.getByRole('menuitemradio', { name: 'PNG', exact: true })
      ).toHaveCount(0);
      await page
        .getByTestId('graph-layout-chooser')
        .getByRole('button')
        .focus();
      await page.keyboard.press('Escape');
      expect(new URL((await request).url()).searchParams.get('depth')).toBe(
        '0'
      );
    }
    expect(await downloadRelationships(page)).toEqual([
      ['subject', 'predicate', 'object', 'family', 'iri'],
      ['Orders', 'Belongs to', 'Sales schema', 'structure', 'belongsTo'],
      ['Sales schema', 'Contains', 'Orders', 'structure', 'contains'],
      ['Orders', 'Owned by', 'Steward', 'ownership', 'ownedBy'],
      ['Orders', 'Has domain', 'Finance', 'governance', 'hasDomain'],
    ]);
  });

  test('ontology explores real concepts, directed predicates, properties and root-only exports', async ({
    page,
  }) => {
    const graph = fixture();
    graph.nodes.push({
      id: 'account',
      label: 'Account',
      type: 'glossaryTerm',
      fullyQualifiedName: 'Business.Account',
    });
    graph.edges.push(
      {
        from: 'direct',
        to: 'account',
        label: 'Mapped to',
        relationType: 'mappedTo',
      },
      {
        from: 'term',
        to: 'account',
        label: 'Owns',
        relationType: 'https://business.example/owns',
      },
      {
        from: 'account',
        to: 'term',
        label: 'Serves',
        relationType: 'https://business.example/serves',
      }
    );
    await page.route('**/api/v1/rdf/graph/explore?**', (route) =>
      route.fulfill({
        json: responseFor(new URL(route.request().url()), false, graph),
      })
    );
    await page.route('**/api/v1/glossaryTerms/byIds?**', (route) =>
      route.fulfill({
        json: [
          {
            id: 'account',
            name: 'Account',
            attributes: [
              {
                id: 'account-id',
                name: 'accountId',
                dataType: 'STRING',
                isIdentifier: true,
              },
            ],
          },
          { id: 'term', name: 'Revenue', attributes: [] },
        ],
      })
    );
    await page.route('**/api/v1/rdf/graph/explore/export?**', (route) =>
      route.fulfill({ body: 'concept', contentType: 'text/plain' })
    );
    await open(page);
    await chooseLevel(page, 3);
    const query = page.waitForRequest(
      (request) =>
        request.url().includes('/rdf/graph/explore?') &&
        new URL(request.url()).searchParams.get('entityType') === 'glossaryTerm'
    );
    await chooseView(page, 'Ontology');
    expect(new URL((await query).url()).searchParams.get('entityId')).toBe(
      'account'
    );
    await expect(page.getByTestId('node-Account')).toHaveAttribute(
      'data-level',
      '1'
    );
    await expect(page.getByTestId('graph-mode')).toHaveText('Ontology');
    await expect(page.getByTestId('node-accountId')).toHaveCount(1);
    await page.getByTestId('graph-open-relationships').click();
    const details = page.getByTestId('graph-details');
    const serves = details.getByRole('row').filter({ hasText: 'Serves' });
    await serves.focus();
    await page.keyboard.press('Enter');
    const inspector = page.getByTestId('graph-inspector');
    await expect(inspector.getByRole('heading')).toHaveText('Serves');
    await expect(inspector).toContainText('https://business.example/serves');
    await expect(
      inspector.getByRole('link', { name: 'Account', exact: true })
    ).toHaveAttribute('href', /Business.Account/);
    await expect(inspector).not.toContainText('Derived relationship');
    await inspector.getByRole('button', { name: 'Close', exact: true }).click();
    await details.getByRole('tab', { name: 'Properties', exact: true }).click();
    await expect(
      details.getByRole('row').filter({ hasText: 'accountId' })
    ).toContainText('At most one');
    await details.getByRole('row').filter({ hasText: 'accountId' }).click();
    await expect(inspector).toContainText('Range: STRING');
    await expect(
      inspector.getByText('Range: STRING', { exact: true })
    ).toBeInViewport();
    await expect(inspector).toContainText('At most one');
    await page.screenshot({
      path: test.info().outputPath('ontology-property-inspector.png'),
    });
    await inspector.getByRole('button', { name: 'Close', exact: true }).click();
    await details.getByRole('button', { name: 'Close', exact: true }).click();
    await chooseLevel(page, 1);
    // A concept's level 1 is the assets mapped onto it and its declared
    // properties; neighbouring concepts wait for level 2.
    await expect(page.locator('[data-node-id]')).toHaveCount(3);
    await expect(page.locator('[data-edge-id]')).toHaveCount(2);
    await expect(page.getByTestId('node-Customers')).toBeVisible();
    await expect(page.getByTestId('node-accountId')).toBeVisible();
    await expect(page.getByTestId('node-Revenue')).toHaveCount(0);
    const exportRequest = page.waitForRequest((request) =>
      request.url().includes('/rdf/graph/explore/export?')
    );
    await page.getByTestId('graph-view-menu').click();
    await page.getByTestId('knowledge-graph-export').click();
    await page
      .getByRole('menuitemradio', { name: 'JSON-LD', exact: true })
      .click();
    const exported = new URL((await exportRequest).url());
    expect(exported.searchParams.get('entityId')).toBe('account');
    expect(exported.searchParams.get('depth')).toBe('0');
  });

  test('300 columns stay discoverable through groups, Find, searchable lists and coverage', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1680, height: 1080 });
    const graph = fixture();
    const root = table.entityResponseData.id;
    const fqn = table.entityResponseData.fullyQualifiedName;
    for (const [type, relationType, label] of [
      ['tag', 'hasTag', 'Has tag'],
      ['user', 'followedBy', 'Followed by'],
      ['query', 'referencedBy', 'Referenced by'],
    ]) {
      for (let index = 0; index < 3; index++) {
        const id = type + '-' + index;
        graph.nodes.push({ id, type, label: type + ' ' + index });
        graph.edges.push({ from: root, to: id, label, relationType });
      }
    }
    graph.nodes.push(
      { id: 'tier', type: 'tag', label: 'Tier 1' },
      { id: 'certification', type: 'certification', label: 'Gold' }
    );
    graph.edges.push(
      { from: root, to: 'tier', label: 'Has tier', relationType: 'hasTier' },
      {
        from: root,
        to: 'certification',
        label: 'Certified as',
        relationType: 'certifiedAs',
      }
    );
    const columns = Array.from({ length: 300 }, (_, index) => ({
      name: 'column_' + String(index).padStart(3, '0'),
      dataType: 'VARCHAR',
      fullyQualifiedName: fqn + '.column_' + String(index).padStart(3, '0'),
      tags:
        index === 0
          ? [
              {
                tagFQN: 'Business.Revenue',
                source: 'Glossary',
                name: 'Revenue',
              },
              {
                tagFQN: 'PII.Sensitive',
                source: 'Classification',
                name: 'Sensitive',
              },
            ]
          : [],
    }));
    columns.forEach((column, index) => {
      const id = 'column-' + index;
      graph.nodes.push({
        id,
        label: column.fullyQualifiedName,
        fullyQualifiedName: column.fullyQualifiedName,
        type: 'column',
      });
      graph.edges.push({
        from: root,
        to: id,
        label: 'Has column',
        relationType: 'hasColumn',
      });
    });
    graph.edges.push({
      from: 'column-0',
      to: 'term',
      label: 'Has glossary term',
      relationType: 'hasGlossaryTerm',
    });
    await page.route('**/api/v1/rdf/graph/explore?**', (route) =>
      route.fulfill({
        json: responseFor(new URL(route.request().url()), false, graph),
      })
    );
    await page.route('**/api/v1/tables/*/columns?**', (route) =>
      route.fulfill({ json: { data: columns, paging: { total: 300 } } })
    );
    await open(page);
    await chooseLevel(page, 3);
    await expect(page.locator('[data-node-id]')).toHaveCount(14);
    await expect(page.locator('[data-edge-id]')).toHaveCount(324);
    await expect(page.getByTestId('graph-open-columns')).toContainText('300');
    await expect(page.locator('.kg-node-group')).toHaveCount(4);
    await expect(page.getByTestId('node-Tier 1')).toHaveCount(1);
    await expect(page.getByTestId('node-Gold')).toHaveCount(1);
    await expect(page.getByTestId('graph-entity-header')).toHaveCount(0);
    await expect(page.getByText('column_002', { exact: true })).toBeVisible();
    await page.screenshot({
      path: test.info().outputPath('balanced-300-columns.png'),
    });
    const group = page
      .locator('.kg-node-group')
      .filter({ has: page.getByTestId('node-column') });
    await group
      .getByRole('button', { name: 'Expand group', exact: true })
      .click();
    await expect(page.locator('[data-node-id]')).toHaveCount(20);
    await expect(
      group.getByRole('button', { name: 'Collapse group', exact: true })
    ).toBeVisible();
    const bundleInspector = page.getByTestId('graph-inspector');
    await expect(bundleInspector).toContainText('Has column');
    await expect
      .poll(async () => {
        const canvas = await page
          .getByTestId('knowledge-graph-canvas')
          .boundingBox();
        const inspector = await bundleInspector.boundingBox();
        if (!canvas || !inspector) return Number.POSITIVE_INFINITY;

        return Math.max(
          Math.abs(canvas.y - inspector.y),
          Math.abs(canvas.x + canvas.width - inspector.x)
        );
      })
      .toBeLessThan(2);
    await expect(page.getByTestId('graph-footer')).toBeInViewport();
    await bundleInspector
      .getByRole('button', { name: 'View in list', exact: true })
      .click();
    await expect(page.getByTestId('graph-details')).toContainText(
      '300 results in this scope'
    );
    await page
      .getByTestId('graph-details')
      .getByRole('button', { name: 'Close', exact: true })
      .click();
    await bundleInspector
      .getByRole('button', { name: 'column_000 → Has column', exact: true })
      .click();
    await expect(
      bundleInspector.getByTestId('relationship-predicate')
    ).toHaveText('hasColumn');
    await expect(
      bundleInspector.getByRole('link', { name: 'Orders', exact: true })
    ).toBeVisible();
    await bundleInspector
      .getByRole('button', { name: 'Close', exact: true })
      .click();
    await page.getByTestId('graph-collapse-groups').click();
    await expect(page.locator('[data-node-id]')).toHaveCount(14);
    const exported = await downloadRelationships(page);
    expect(exported).toHaveLength(325);
    expect(exported).toContainEqual([
      'Orders',
      'Has column',
      'column_299',
      'structure',
      'hasColumn',
    ]);
    await page.getByTestId('graph-open-columns').click();
    const details = page.getByTestId('graph-details');
    await expect(
      details.getByRole('row').filter({ hasText: 'column_000' })
    ).toContainText('Revenue');
    await expect(
      details.getByRole('row').filter({ hasText: 'column_000' })
    ).toContainText('Sensitive');
    await details.getByRole('button', { name: /Show 40 more/ }).click();
    await expect(
      details.getByRole('row').filter({ hasText: 'column_040' })
    ).toBeVisible();
    await details
      .getByRole('textbox', { name: 'Search', exact: true })
      .fill('column_299');
    await expect(
      details.getByRole('row').filter({ hasText: 'column_299' })
    ).toBeVisible();
    await details
      .getByRole('tab', { name: 'Relationships', exact: true })
      .click();
    await details
      .getByRole('textbox', { name: 'Search', exact: true })
      .fill('column_299');
    await details.getByRole('row').filter({ hasText: 'Has column' }).click();
    await expect(page.getByTestId('graph-inspector')).toContainText(
      'Has column'
    );
    await expect(page.getByTestId('graph-inspector')).toContainText(
      'column_299'
    );
    await expect(page.getByTestId('level-chooser')).toBeInViewport();
    await expect(
      page.getByTestId('graph-inspector').getByRole('heading')
    ).toBeInViewport();
    await page.screenshot({
      path: test.info().outputPath('relationship-inspector.png'),
    });
    await page
      .getByTestId('graph-inspector')
      .getByRole('button', { name: 'Close', exact: true })
      .click();
    await details.getByRole('tab', { name: 'Gaps', exact: true }).click();
    const coverage = details.getByRole('button', {
      name: /Show on canvas/,
    });
    await coverage.click();
    await page
      .getByRole('option', { name: 'Highlight mapping gaps', exact: true })
      .click();
    await expect(page.locator('.kg-node-group.kg-node-gap')).toHaveCount(1);
    await expect(page.locator('[data-edge-id]')).toHaveCount(324);
    await coverage.click();
    await page.getByRole('option', { name: 'Not mapped', exact: true }).click();
    await expect(page.getByTestId('graph-status')).toContainText(
      '316 entities'
    );
    await details.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByTestId('graph-filters-toggle').click();
    await page
      .getByRole('button', { name: 'Clear Filters', exact: true })
      .click();
    await expect(page.getByTestId('level-chooser')).toContainText(
      '3 · Extended'
    );
    await page
      .getByRole('combobox', { name: 'Find in graph' })
      .fill('column_299');
    await page.getByRole('option', { name: 'column_299', exact: true }).click();
    await expect(page.getByTestId('node-column_299')).toBeFocused();
    await expect(page.getByTestId('node-column_299')).toBeInViewport();
    await expect(
      page
        .getByTestId('graph-inspector')
        .getByRole('link', { name: 'Open entity page', exact: true })
    ).toHaveAttribute('href', /\/table\//);
    await expect(page.locator('[data-node-id]')).toHaveCount(20);
    await expect(page.locator('[data-edge-id]')).toHaveCount(324);
    await page.getByTestId('graph-collapse-groups').click();
    await expect(page.locator('[data-node-id]')).toHaveCount(14);
    await expect(page.getByTestId('node-column')).toBeInViewport();
    await expect(page.getByTestId('graph-inspector')).toContainText(
      'column_299'
    );
    await page
      .getByTestId('knowledge-graph-canvas')
      .click({ position: { x: 10, y: 10 } });
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(
      ''
    );
  });
});
