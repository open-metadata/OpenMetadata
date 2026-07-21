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
  readGraphEdges,
  readNodePositions,
  waitForGraphLoaded,
} from '../../utils/ontologyExplorer';

const adminUser = new AdminClass();
const rdfGlossary = new Glossary();
const rdfTerm1 = new GlossaryTerm(rdfGlossary);
const rdfTerm2 = new GlossaryTerm(rdfGlossary);

test.describe.configure({ mode: 'serial' });

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

async function expectFixtureGraph(
  page: Parameters<typeof waitForGraphLoaded>[0]
): Promise<void> {
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
    )
  ).toBe(true);
}

test.describe('Ontology Explorer — RDF exports (Turtle and RDF/XML)', () => {
  test('SKOS / Turtle option appears in the export menu when RDF is enabled', async ({
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
      page.getByRole('menuitemradio', { name: 'SKOS / Turtle' })
    ).toBeVisible();

    await page.close();
  });

  test('OWL / RDF-XML option appears in the export menu when RDF is enabled', async ({
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
      page.getByRole('menuitemradio', { name: 'OWL / RDF-XML' })
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
        await page
          .getByRole('menuitemradio', { name: 'SKOS / Turtle' })
          .click();
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
        await page
          .getByRole('menuitemradio', { name: 'OWL / RDF-XML' })
          .click();
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
      page.getByRole('menuitemradio', { name: 'SKOS / Turtle' })
    ).not.toBeVisible();
    await expect(
      page.getByRole('menuitemradio', { name: 'OWL / RDF-XML' })
    ).not.toBeVisible();

    // PNG (always present) still shows.
    await expect(page.getByText('PNG', { exact: true })).toBeVisible();

    await page.close();
  });
});

test.describe('Ontology Explorer — relational graph data loading', () => {
  test('term Relations Graph remains database-authoritative when RDF is enabled', async ({
    browser,
  }) => {
    const page = await browser.newPage();
    await adminUser.login(page);
    let rdfGraphRequestCount = 0;

    await page.route('**/api/v1/rdf/status**', (route) =>
      route.fulfill({ json: { enabled: true } })
    );
    await page.route('**/api/v1/rdf/glossary/graph**', (route) => {
      rdfGraphRequestCount += 1;

      return route.fulfill({ json: { edges: [], nodes: [] } });
    });

    await redirectToHomePage(page);
    await rdfTerm1.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);
    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);

    expect(rdfGraphRequestCount).toBe(0);
    await expectFixtureGraph(page);

    await page.close();
  });

  test('glossary Relations Graph remains available when RDF is disabled', async ({
    browser,
  }) => {
    const page = await browser.newPage();
    await adminUser.login(page);
    let rdfGraphRequestCount = 0;

    await page.route('**/api/v1/rdf/status**', (route) =>
      route.fulfill({ json: { enabled: false } })
    );
    await page.route('**/api/v1/rdf/glossary/graph**', (route) => {
      rdfGraphRequestCount += 1;

      return route.fulfill({ json: { edges: [], nodes: [] } });
    });

    await navigateToGlossaryRelationsGraph(page);

    expect(rdfGraphRequestCount).toBe(0);
    await expectFixtureGraph(page);

    await page.close();
  });
});
