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

import { expect, test } from '@playwright/test';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { AdminClass } from '../../support/user/AdminClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  addTermRelation,
  buildMalformedRdfGraphJson,
  buildRdfGraphJson,
  DANGLING_GRAPH_NODE_ID,
  readGraphEdges,
  readNodePositions,
  waitForGraphLoaded,
} from '../../utils/ontologyExplorer';

const adminUser = new AdminClass();
const rdfGlossary = new Glossary();
const rdfTerm1 = new GlossaryTerm(rdfGlossary);
const rdfTerm2 = new GlossaryTerm(rdfGlossary);

const graphJson = () =>
  buildRdfGraphJson(
    rdfGlossary.responseData.id,
    { id: rdfTerm1.responseData.id, name: rdfTerm1.data.name },
    { id: rdfTerm2.responseData.id, name: rdfTerm2.data.name }
  );

const malformedGraphJson = () =>
  buildMalformedRdfGraphJson(
    rdfGlossary.responseData.id,
    { id: rdfTerm1.responseData.id, name: rdfTerm1.data.name },
    { id: rdfTerm2.responseData.id, name: rdfTerm2.data.name }
  );

test.beforeAll('Seed test data', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);

  await rdfGlossary.create(apiContext);
  await rdfTerm1.create(apiContext);
  await rdfTerm2.create(apiContext);
  await addTermRelation(apiContext, rdfTerm1, rdfTerm2, 'relatedTo');

  await afterAction();
});

test.afterAll('Cleanup test data', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);

  await rdfTerm1.delete(apiContext);
  await rdfTerm2.delete(apiContext);
  await rdfGlossary.delete(apiContext);

  await afterAction();
});

async function navigateToGlossaryRelationsGraph(
  page: Parameters<typeof waitForGraphLoaded>[0]
) {
  await redirectToHomePage(page);
  await rdfGlossary.visitEntityPage(page);
  await waitForAllLoadersToDisappear(page);
  await page.getByRole('tab', { name: 'Relations Graph' }).click();
  await expect(page.getByTestId('ontology-explorer')).toBeVisible();
  await waitForGraphLoaded(page);
}

test.describe('Ontology Explorer — RDF exports (Turtle and RDF/XML)', () => {
  test('Turtle (.ttl) option appears in the export menu when RDF is enabled', async ({
    browser,
  }) => {
    const page = await browser.newPage();
    await adminUser.login(page);

    // Mock RDF status so the export options are rendered.
    await page.route('**/api/v1/rdf/status**', (route) =>
      route.fulfill({ json: { enabled: true } })
    );

    await navigateToGlossaryRelationsGraph(page);

    await page.getByTestId('ontology-export-graph').click();
    await expect(
      page.getByText('Turtle (.ttl)', { exact: true })
    ).toBeVisible();

    await page.close();
  });

  test('RDF/XML (.rdf) option appears in the export menu when RDF is enabled', async ({
    browser,
  }) => {
    const page = await browser.newPage();
    await adminUser.login(page);

    await page.route('**/api/v1/rdf/status**', (route) =>
      route.fulfill({ json: { enabled: true } })
    );

    await navigateToGlossaryRelationsGraph(page);

    await page.getByTestId('ontology-export-graph').click();
    await expect(
      page.getByText('RDF/XML (.rdf)', { exact: true })
    ).toBeVisible();

    await page.close();
  });

  test('Turtle export triggers a .ttl file download', async ({ browser }) => {
    const page = await browser.newPage();
    await adminUser.login(page);

    await page.route('**/api/v1/rdf/status**', (route) =>
      route.fulfill({ json: { enabled: true } })
    );

    // Return a minimal Turtle payload so the download blob is non-empty.
    await page.route('**/api/v1/rdf/glossary/*/export**', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/turtle' },
        body: '@prefix owl: <http://www.w3.org/2002/07/owl#> .\n',
      })
    );

    await navigateToGlossaryRelationsGraph(page);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      (async () => {
        await page.getByTestId('ontology-export-graph').click();
        await page.getByText('Turtle (.ttl)', { exact: true }).click();
      })(),
    ]);

    expect(download.suggestedFilename()).toMatch(/_ontology\.ttl$/i);

    await page.close();
  });

  test('RDF/XML export triggers a .rdf file download', async ({ browser }) => {
    const page = await browser.newPage();
    await adminUser.login(page);

    await page.route('**/api/v1/rdf/status**', (route) =>
      route.fulfill({ json: { enabled: true } })
    );

    await page.route('**/api/v1/rdf/glossary/*/export**', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/rdf+xml' },
        body: '<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"/>',
      })
    );

    await navigateToGlossaryRelationsGraph(page);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      (async () => {
        await page.getByTestId('ontology-export-graph').click();
        await page.getByText('RDF/XML (.rdf)', { exact: true }).click();
      })(),
    ]);

    expect(download.suggestedFilename()).toMatch(/_ontology\.rdf$/i);

    await page.close();
  });

  test('Turtle and RDF/XML options are NOT shown when RDF is disabled', async ({
    browser,
  }) => {
    const page = await browser.newPage();
    await adminUser.login(page);

    // RDF disabled — the options must not appear.
    await page.route('**/api/v1/rdf/status**', (route) =>
      route.fulfill({ json: { enabled: false } })
    );

    await navigateToGlossaryRelationsGraph(page);

    await page.getByTestId('ontology-export-graph').click();
    await expect(
      page.getByText('Turtle (.ttl)', { exact: true })
    ).not.toBeVisible();
    await expect(
      page.getByText('RDF/XML (.rdf)', { exact: true })
    ).not.toBeVisible();

    // PNG (always present) still shows.
    await expect(page.getByText('PNG', { exact: true })).toBeVisible();

    await page.close();
  });
});

test.describe('Ontology Explorer — RDF graph data loading', () => {
  test('term Relations Graph requests /rdf/glossary/graph scoped to the selected term (glossaryTermId) when RDF is enabled', async ({
    browser,
  }) => {
    const page = await browser.newPage();
    await adminUser.login(page);

    await page.route('**/api/v1/rdf/status**', (route) =>
      route.fulfill({ json: { enabled: true } })
    );
    await page.route('**/api/v1/rdf/glossary/graph**', (route) =>
      route.fulfill({ json: graphJson() })
    );

    await redirectToHomePage(page);
    await rdfTerm1.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    const graphResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/rdf/glossary/graph') &&
        new URL(response.url()).searchParams.get('glossaryTermId') ===
          rdfTerm1.responseData.id
    );

    await page.getByRole('tab', { name: 'Relations Graph' }).click();

    const response = await graphResponse;
    expect(response.status()).toBe(200);
    expect(
      new URL(response.url()).searchParams.get('glossaryId'),
      'the term view must still pass its parent glossaryId'
    ).toBe(rdfGlossary.responseData.id);

    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);

    const positions = await readNodePositions(page);
    expect(positions[rdfTerm1.responseData.id]).toBeDefined();
    expect(positions[rdfTerm2.responseData.id]).toBeDefined();

    const edges = await readGraphEdges(page);
    expect(
      edges.some(
        (edge) =>
          (edge.from === rdfTerm1.responseData.id &&
            edge.to === rdfTerm2.responseData.id) ||
          (edge.from === rdfTerm2.responseData.id &&
            edge.to === rdfTerm1.responseData.id)
      ),
      'the related-term edge between the term and its neighbor must render'
    ).toBe(true);

    await page.close();
  });

  test('glossary Relations Graph calls /rdf/glossary/graph when RDF is enabled and renders nodes from the response', async ({
    browser,
  }) => {
    const page = await browser.newPage();
    await adminUser.login(page);

    await page.route('**/api/v1/rdf/status**', (route) =>
      route.fulfill({ json: { enabled: true } })
    );

    let graphApiCalled = false;
    await page.route('**/api/v1/rdf/glossary/graph**', (route) => {
      graphApiCalled = true;

      return route.fulfill({ json: graphJson() });
    });

    await navigateToGlossaryRelationsGraph(page);

    expect(
      graphApiCalled,
      'GET /rdf/glossary/graph must be called on the glossary Relations Graph when RDF is enabled'
    ).toBe(true);

    const positions = await readNodePositions(page);
    expect(
      positions[rdfTerm1.responseData.id],
      'rdfTerm1 must appear as a node (from RDF graph response)'
    ).toBeDefined();
    expect(
      positions[rdfTerm2.responseData.id],
      'rdfTerm2 must appear as a node (from RDF graph response)'
    ).toBeDefined();

    await page.close();
  });

  test('renders without crashing when /rdf/glossary/graph returns duplicate nodes and dangling edges', async ({
    browser,
  }) => {
    const page = await browser.newPage();
    await adminUser.login(page);

    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.route('**/api/v1/rdf/status**', (route) =>
      route.fulfill({ json: { enabled: true } })
    );
    await page.route('**/api/v1/rdf/glossary/graph**', (route) =>
      route.fulfill({ json: malformedGraphJson() })
    );

    await navigateToGlossaryRelationsGraph(page);

    // The graph must render — not the fetch-error / render-error empty states.
    await expect(page.getByTestId('ontology-graph-error')).toHaveCount(0);
    await expect(page.getByTestId('ontology-graph-render-error')).toHaveCount(
      0
    );

    // Both real terms render despite the duplicate node and dangling edge.
    const positions = await readNodePositions(page);
    expect(
      positions[rdfTerm1.responseData.id],
      'rdfTerm1 must render even though its id was duplicated in the payload'
    ).toBeDefined();
    expect(
      positions[rdfTerm2.responseData.id],
      'rdfTerm2 must render'
    ).toBeDefined();

    // The valid edge is drawn; the dangling edge is dropped, not rendered.
    const edges = await readGraphEdges(page);
    expect(
      edges.some(
        (e) =>
          e.from === rdfTerm1.responseData.id &&
          e.to === rdfTerm2.responseData.id
      ),
      'the valid term-to-term edge must be rendered'
    ).toBe(true);
    expect(
      edges.some(
        (e) =>
          e.from === DANGLING_GRAPH_NODE_ID || e.to === DANGLING_GRAPH_NODE_ID
      ),
      'the dangling edge must be dropped, never handed to G6'
    ).toBe(false);

    expect(
      pageErrors.filter(
        (m) => m.includes('Node already exists') || m.includes('Node not found')
      )
    ).toEqual([]);

    await page.close();
  });

  test('graph falls back to database when RDF is enabled but /rdf/glossary/graph returns empty', async ({
    browser,
  }) => {
    test.slow();
    const page = await browser.newPage();
    await adminUser.login(page);

    await page.route('**/api/v1/rdf/status**', (route) =>
      route.fulfill({ json: { enabled: true } })
    );

    // RDF endpoint returns empty — component must fall back to the database path.
    await page.route('**/api/v1/rdf/glossary/graph**', (route) =>
      route.fulfill({ json: { nodes: [], edges: [] } })
    );

    await navigateToGlossaryRelationsGraph(page);

    const positions = await readNodePositions(page);
    expect(
      positions[rdfTerm1.responseData.id],
      'rdfTerm1 must appear via the database fallback when RDF returns empty'
    ).toBeDefined();
    expect(
      positions[rdfTerm2.responseData.id],
      'rdfTerm2 must appear via the database fallback when RDF returns empty'
    ).toBeDefined();

    await page.close();
  });
});
