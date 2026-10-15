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

import { expect, test } from '../../support/fixtures/base';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import {
  addTermRelation,
  applyGlossaryFilter,
  createApiContext,
  deleteEntities,
  disposeApiContext,
  navigateToOntologyStudio,
  readGraphEdges,
  readNodePositions,
  waitForGraphLoaded,
} from '../../utils/ontologyStudio';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Cross-glossary term hydration', () => {
  const salesGlossary = new Glossary();
  const financeGlossary = new Glossary();
  const termRevenue = new GlossaryTerm(salesGlossary);
  const termExpense = new GlossaryTerm(financeGlossary);

  test.beforeAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);
    await salesGlossary.create(apiContext);
    await financeGlossary.create(apiContext);
    await termRevenue.create(apiContext);
    await termExpense.create(apiContext);
    await addTermRelation(apiContext, termRevenue, termExpense, 'relatedTo');
    await disposeApiContext(page, apiContext);
  });

  test.afterAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);
    await deleteEntities(
      apiContext,
      termRevenue,
      termExpense,
      salesGlossary,
      financeGlossary
    );
    await disposeApiContext(page, apiContext);
  });

  test.beforeEach(async ({ page }) => {
    await navigateToOntologyStudio(page);
    await waitForGraphLoaded(page);
    await applyGlossaryFilter(page, salesGlossary.responseData.id);
    await waitForGraphLoaded(page);
  });

  test('term from another glossary is hydrated in as a node', async ({
    page,
  }) => {
    await page.getByTestId('fit-view').click();
    const positions = await readNodePositions(page);

    expect(positions[termRevenue.responseData.id]).toBeDefined();
    expect(positions[termExpense.responseData.id]).toBeDefined();
  });

  test('cross-glossary edge is present in graph data', async ({ page }) => {
    const edges = await readGraphEdges(page);
    const edge = edges.find(
      (e) =>
        (e.from === termRevenue.responseData.id &&
          e.to === termExpense.responseData.id) ||
        (e.from === termExpense.responseData.id &&
          e.to === termRevenue.responseData.id)
    );

    expect(edge).toBeDefined();
  });

  test('header stats remain scoped to the selected glossary', async ({
    page,
  }) => {
    await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
      /1\s+terms?/i
    );
  });
});

test.describe('Embedded scope (Relations Graph tab)', () => {
  const embeddedGlossary = new Glossary();
  const termA = new GlossaryTerm(embeddedGlossary);
  const termB = new GlossaryTerm(embeddedGlossary);
  const termC = new GlossaryTerm(embeddedGlossary);

  test.beforeAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);
    await embeddedGlossary.create(apiContext);
    await termA.create(apiContext);
    await termB.create(apiContext);
    await termC.create(apiContext);
    await addTermRelation(apiContext, termA, termB, 'relatedTo');
    await disposeApiContext(page, apiContext);
  });

  test.afterAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);
    await deleteEntities(apiContext, termA, termB, termC, embeddedGlossary);
    await disposeApiContext(page, apiContext);
  });

  test.beforeEach(async ({ page }) => {
    await termA.visitEntityPage(page);
    await page.getByTestId('relations_graph').click();
    await waitForGraphLoaded(page);
  });

  test('ontology explorer is visible in the Relations Graph tab', async ({
    page,
  }) => {
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
  });

  test('global Studio controls are hidden in term scope', async ({ page }) => {
    await expect(
      page.getByTestId('ontology-glossary-menu-trigger')
    ).not.toBeVisible();
    await expect(page.getByTestId('mode-tab-view')).not.toBeVisible();
  });

  test('zoom and fit-view controls are visible', async ({ page }) => {
    await expect(page.getByTestId('fit-view')).toBeVisible();
    await expect(page.getByTestId('zoom-in')).toBeVisible();
    await expect(page.getByTestId('zoom-out')).toBeVisible();
  });

  test('only the term and its direct neighbours appear — unrelated term is absent', async ({
    page,
  }) => {
    await page.getByTestId('fit-view').click();
    const positions = await readNodePositions(page);

    expect(positions[termA.responseData.id]).toBeDefined();
    expect(positions[termB.responseData.id]).toBeDefined();
    expect(positions[termC.responseData.id]).toBeUndefined();
  });

  test('edge between the term and its neighbour is present', async ({
    page,
  }) => {
    const edges = await readGraphEdges(page);
    const edge = edges.find(
      (e) =>
        (e.from === termA.responseData.id && e.to === termB.responseData.id) ||
        (e.from === termB.responseData.id && e.to === termA.responseData.id)
    );

    expect(edge).toBeDefined();
  });

  test('clicking a neighbour node opens the entity panel', async ({ page }) => {
    await page.getByTestId('fit-view').click();
    const positions = await readNodePositions(page);
    await page.mouse.click(
      positions[termB.responseData.id].x,
      positions[termB.responseData.id].y
    );

    await expect(
      page.getByTestId('entity-summary-panel-container')
    ).toBeVisible();
  });
});
