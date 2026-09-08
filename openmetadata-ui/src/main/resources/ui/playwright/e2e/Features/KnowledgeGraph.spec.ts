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
const chooseView = async (page: Page, name: string) => {
  await page.getByTestId('graph-view-menu').click();
  await page.getByRole('menuitemcheckbox', { name, exact: true }).click();
  await page.keyboard.press('Escape');
};
const nodePosition = async (page: Page, label: string) => {
  const box = await page.getByTestId(`node-${label}`).boundingBox();
  if (!box) throw new Error(`Missing node ${label}`);
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
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
  const responseFor = (url: URL, dense = false): GraphData => {
    const graph = fixture(dense);
    const root = table.entityResponseData.id;
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
      )}/knowledge_graph?fullscreen=true`
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

  test('renders every returned node and predicate from the live RDF endpoint', async ({
    page,
  }) => {
    const response = page.waitForResponse(
      (r) => r.url().includes('/rdf/graph/explore?') && r.status() === 200
    );
    await open(page);
    const graph = (await (await response).json()) as GraphData;
    await expect(page.locator('[data-node-id]')).toHaveCount(
      graph.nodes.length
    );
    await expect(page.locator('[data-edge-id]')).toHaveCount(
      graph.edges.length
    );
    expect(graph.edges.length).toBeGreaterThan(0);
    await expect.poll(() => paintedPixels(page)).toBeGreaterThan(100);
    await expect(page.getByTestId('graph-status')).toContainText(
      `${graph.nodes.length} entities`
    );
  });

  test('the level dropdown is keyboard accessible and maps levels to depths 0, 1 and 2', async ({
    page,
  }) => {
    await mockGraph(page);
    await open(page);
    await expect(page.getByTestId('level-chooser')).toContainText(
      '2 — Direct connections'
    );
    await page.getByTestId('level-chooser').getByRole('button').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(3);
    await page.keyboard.press('Home');
    const rootRequest = page.waitForRequest(
      (r) =>
        new URL(r.url()).pathname === '/api/v1/rdf/graph/explore' &&
        new URL(r.url()).searchParams.get('depth') === '0'
    );
    await page.keyboard.press('Enter');
    await rootRequest;
    await expect(page.locator('[data-node-id]')).toHaveCount(1);
    await expect(page.locator('[data-edge-id]')).toHaveCount(0);
    await expect(page.getByTestId('node-Orders')).toBeVisible();
    for (const level of [2, 3]) {
      const request = page.waitForRequest(
        (r) =>
          new URL(r.url()).pathname === '/api/v1/rdf/graph/explore' &&
          new URL(r.url()).searchParams.get('depth') === String(level - 1)
      );
      await chooseLevel(page, level);
      await request;
      await expect(page.getByTestId('level-chooser')).toContainText(
        `${level} —`
      );
    }
    await expect(page.getByTestId('node-Extended table')).toHaveAttribute(
      'data-level',
      '3'
    );
    await expect(
      page.getByTestId('graph-level-rings').locator('text')
    ).toHaveCount(0);
  });

  test('preserves the viewport and inner ring when extending and filtering connections', async ({
    page,
  }) => {
    await mockGraph(page);
    await open(page);
    await page.getByTestId('zoom-in').click();
    const position = await nodePosition(page, 'Customers');
    await chooseLevel(page, 3);
    await expect(page.getByTestId('node-Extended table')).toHaveAttribute(
      'data-level',
      '3'
    );
    await expectPosition(page, 'Customers', position);
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
      '3 — Extended connections'
    );
  });

  test('find and the keyboard inspector expose each distinct directed relationship', async ({
    page,
  }) => {
    await mockGraph(page);
    await open(page);
    const find = page.getByRole('combobox', { name: 'Find in graph' });
    await find.fill('Orders');
    await page.getByRole('option', { name: 'Orders', exact: true }).click();
    const root = page.getByTestId('node-Orders');
    await expect(root).toBeFocused();
    await root.press('Enter');
    const inspector = page.getByTestId('graph-inspector');
    await expect(inspector.getByRole('heading')).toBeFocused();
    for (const label of [
      'Orders → Belongs to → Sales schema',
      'Sales schema → Contains → Orders',
      'Orders → Custom predicate → Sales schema',
    ]) {
      await expect(
        inspector.getByRole('button', { name: label, exact: true })
      ).toBeVisible();
    }
    await inspector
      .getByRole('button', {
        name: 'Orders → Custom predicate → Sales schema',
        exact: true,
      })
      .click();
    await expect(inspector).toContainText('Custom predicate');
    await expect(
      inspector.getByRole('link', { name: 'Orders', exact: true })
    ).toHaveAttribute('href', /\/table\//);
    await expect(page.locator('[data-edge-id]')).toHaveCount(11);
    await inspector.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(inspector).toHaveCount(0);
  });

  test('label modes and family highlights preserve all real canvas relationships', async ({
    page,
  }) => {
    await mockGraph(page);
    await open(page);
    await page.getByTestId('fit-screen').click();
    const position = await nodePosition(page, 'Orders');
    const before = await paintedPixels(page);
    await chooseView(page, 'No labels');
    await expect(page.locator('[data-edge-id]')).toHaveCount(11);
    await expectPosition(page, 'Orders', position);
    await expect.poll(() => paintedPixels(page)).toBeGreaterThan(100);
    await expect.poll(() => paintedPixels(page)).toBeLessThan(before);
    await chooseView(page, 'All labels');
    await expect.poll(() => paintedPixels(page)).toBeGreaterThan(before);
    await chooseView(page, 'Auto labels');
    await page.getByTestId('legend-item-other').getByRole('button').click();
    await expect(
      page.getByTestId('legend-item-other').getByRole('button')
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-edge-id]')).toHaveCount(11);
    await expectPosition(page, 'Orders', position);
    await expect(page.locator('[data-node-id].dimmed')).not.toHaveCount(0);
  });

  test('hover reveals the exact predicate and clicking a canvas edge pins it', async ({
    page,
  }) => {
    await mockGraph(page);
    await open(page);
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
    await expect(page.locator('[data-edge-id]')).toHaveCount(11);
  });

  test('rapid changes ignore stale responses and failed refreshes preserve the current view', async ({
    page,
  }) => {
    let delayed: Route | undefined;
    let fail = false;
    await page.route('**/api/v1/rdf/graph/explore?**', async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('depth') === '2') {
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
    await chooseLevel(page, 3);
    await expect.poll(() => Boolean(delayed)).toBe(true);
    await expect(page.getByTestId('graph-status')).toContainText('Updating');
    await expect(page.getByTestId('node-Orders')).toHaveCount(1);
    await chooseLevel(page, 1);
    await expect(page.locator('[data-node-id]')).toHaveCount(1);
    await delayed!
      .fulfill({ json: responseFor(new URL(delayed!.request().url())) })
      .catch(() => undefined);
    await expect(page.getByTestId('graph-status')).toContainText('1 entities');
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

  test('narrow layouts, 200 percent zoom, dark mode and reduced motion keep controls usable', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1000, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
    await page.addInitScript(() => localStorage.setItem('ui-theme', 'dark'));
    await mockGraph(page);
    await open(page);
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
    for (const id of [
      'level-chooser',
      'graph-filters-toggle',
      'graph-view-menu',
    ])
      await expect(page.getByTestId(id)).toBeVisible();
    await page.getByTestId('level-chooser').getByRole('button').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(3);
    await page.keyboard.press('Escape');
    await expect(page.locator('html')).toHaveClass(/dark-mode/);
    await expect(page.getByTestId('node-Orders')).toHaveCSS(
      'transition-duration',
      '0s'
    );
  });

  test('exports the selected root-only scope in Turtle and JSON-LD', async ({
    page,
  }) => {
    await mockGraph(page);
    await page.route('**/api/v1/rdf/graph/explore/export?**', (route) =>
      route.fulfill({ body: 'root', contentType: 'text/plain' })
    );
    await open(page);
    await chooseLevel(page, 1);
    await expect(page.locator('[data-node-id]')).toHaveCount(1);
    for (const [name, format] of [
      ['SKOS / Turtle', 'turtle'],
      ['JSON-LD', 'jsonld'],
    ]) {
      const request = page.waitForRequest(
        (r) =>
          new URL(r.url()).pathname === '/api/v1/rdf/graph/explore/export' &&
          new URL(r.url()).searchParams.get('format') === format
      );
      await page.getByTestId('knowledge-graph-export').click();
      await page.getByRole('menuitemradio', { name, exact: true }).click();
      expect(new URL((await request).url()).searchParams.get('depth')).toBe(
        '0'
      );
    }
  });
});
