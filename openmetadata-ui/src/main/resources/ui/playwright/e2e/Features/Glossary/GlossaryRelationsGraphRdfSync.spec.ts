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
import { APIRequestContext, expect, test } from '@playwright/test';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { AdminClass } from '../../../support/user/AdminClass';
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import {
  addTermRelation,
  readGraphEdges,
  waitForGraphLoaded,
} from '../../../utils/ontologyExplorer';

// Regression coverage for two backend defects in /rdf/glossary/graph:
//   Bug 1 — relations saved on a term were intermittently lost from RDF (an
//           async write race), so the term-scoped graph dropped edges and the
//           neighbour rendered as isolated.
//   Bug 2 — the term-scoped endpoint ignored `includeIsolated=false` and
//           returned isolated terms anyway.
// These assert the backend contract directly (via the API) plus the user-facing
// render. Most meaningful against an RDF-enabled deployment; against the DB
// fallback they still encode the expected behaviour.

const adminUser = new AdminClass();

const glossaryA = new Glossary();
const termA = new GlossaryTerm(glossaryA); // holds all the relations
const termB = new GlossaryTerm(glossaryA); // relatedTo target (same glossary)
const termC = new GlossaryTerm(glossaryA); // synonym target (same glossary)
const termIso = new GlossaryTerm(glossaryA); // never related — must stay isolated

const glossaryB = new Glossary();
const termX = new GlossaryTerm(glossaryB); // seeAlso target (cross-glossary)

const RELATIONS: Array<{ to: () => GlossaryTerm; type: string }> = [
  { to: () => termB, type: 'relatedTo' },
  { to: () => termC, type: 'synonym' },
  { to: () => termX, type: 'seeAlso' },
];

async function fetchTermGraph(
  apiContext: APIRequestContext,
  glossaryId: string,
  termId: string,
  includeIsolated: boolean
) {
  const response = await apiContext.get(
    `/api/v1/rdf/glossary/graph?glossaryId=${glossaryId}` +
      `&glossaryTermId=${termId}&limit=500&offset=0&includeIsolated=${includeIsolated}`
  );

  expect(response.ok()).toBeTruthy();

  return response.json();
}

function edgeExists(
  graph: { edges?: Array<{ from: string; to: string }> },
  a: string,
  b: string
): boolean {
  return (graph.edges ?? []).some(
    (e) => (e.from === a && e.to === b) || (e.from === b && e.to === a)
  );
}

test.beforeAll('Seed glossaries, terms and relations', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);

  await glossaryA.create(apiContext);
  await termA.create(apiContext);
  await termB.create(apiContext);
  await termC.create(apiContext);
  await termIso.create(apiContext);

  await glossaryB.create(apiContext);
  await termX.create(apiContext);

  // Stack THREE relations of mixed types (incl. one cross-glossary) on a single
  // term — the multi-relation save that previously lost edges in RDF.
  for (const relation of RELATIONS) {
    await addTermRelation(apiContext, termA, relation.to(), relation.type);
  }

  await afterAction();
});

test.afterAll('Cleanup', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);

  await termA.delete(apiContext);
  await termB.delete(apiContext);
  await termC.delete(apiContext);
  await termIso.delete(apiContext);
  await glossaryA.delete(apiContext);

  await termX.delete(apiContext);
  await glossaryB.delete(apiContext);

  await afterAction();
});

test.describe('Glossary Relations Graph — RDF sync', () => {
  test('every relation saved on a term is present in the term-scoped graph (Bug 1)', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const glossaryId = glossaryA.responseData.id;
    const aId = termA.responseData.id;
    const expectedNeighbours = RELATIONS.map((r) => r.to().responseData.id);

    // RDF writes are async; poll until all three edges have propagated.
    await expect
      .poll(
        async () => {
          const graph = await fetchTermGraph(apiContext, glossaryId, aId, true);

          return expectedNeighbours.filter((toId) =>
            edgeExists(graph, aId, toId)
          ).length;
        },
        {
          timeout: 30_000,
          intervals: [1_000, 1_000, 2_000],
          message:
            'All relations saved on the term must surface as edges in RDF — a missing edge means the write was lost (Bug 1)',
        }
      )
      .toBe(RELATIONS.length);

    await afterAction();
  });

  test('includeIsolated=false excludes terms with no relations (Bug 2)', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    const graph = await fetchTermGraph(
      apiContext,
      glossaryA.responseData.id,
      termA.responseData.id,
      false
    );
    const nodeIds = new Set<string>(
      (graph.nodes ?? []).map((n: { id: string }) => n.id)
    );

    expect(
      nodeIds.has(termIso.responseData.id),
      'An isolated term must NOT be returned when includeIsolated=false (Bug 2)'
    ).toBe(false);

    await afterAction();
  });

  test('term Relations Graph renders an edge to every related neighbour (Bug 1, UI)', async ({
    browser,
  }) => {
    const page = await browser.newPage();
    await adminUser.login(page);

    await redirectToHomePage(page);
    await termA.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);

    const edges = await readGraphEdges(page, RELATIONS.length);
    const aId = termA.responseData.id;

    for (const relation of RELATIONS) {
      const neighbourId = relation.to().responseData.id;
      expect(
        edges.some(
          (e) =>
            (e.from === aId && e.to === neighbourId) ||
            (e.from === neighbourId && e.to === aId)
        ),
        `A "${relation.type}" edge from the term to its neighbour must render`
      ).toBe(true);
    }

    await page.close();
  });
});
