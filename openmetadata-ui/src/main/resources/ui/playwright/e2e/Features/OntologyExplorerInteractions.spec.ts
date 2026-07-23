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
import {
  addTermRelation,
  applyGlossaryFilter,
  applyRelationTypeFilter,
  createApiContext,
  deleteEntities,
  disposeApiContext,
  navigateToOntologyExplorer,
  readGraphEdges,
  readNodePositions,
  waitForGraphLoaded,
} from '../../utils/ontologyExplorer';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Isolated nodes + relation filter combo', () => {
  const comboGlossary = new Glossary();
  const connectedTermA = new GlossaryTerm(comboGlossary);
  const connectedTermB = new GlossaryTerm(comboGlossary);
  const isolatedTerm = new GlossaryTerm(comboGlossary);

  test.beforeAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);
    await comboGlossary.create(apiContext);
    await connectedTermA.create(apiContext);
    await connectedTermB.create(apiContext);
    await isolatedTerm.create(apiContext);
    await addTermRelation(
      apiContext,
      connectedTermA,
      connectedTermB,
      'relatedTo'
    );
    await disposeApiContext(page, apiContext);
  });

  test.afterAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);
    await deleteEntities(
      apiContext,
      connectedTermA,
      connectedTermB,
      isolatedTerm,
      comboGlossary
    );
    await disposeApiContext(page, apiContext);
  });

  test.beforeEach(async ({ page }) => {
    test.slow();
    await navigateToOntologyExplorer(page);
    await waitForGraphLoaded(page);
    await applyGlossaryFilter(page, comboGlossary.responseData.id);
    await waitForGraphLoaded(page);
  });

  test('relation filter with no matching edges shows no-relations state', async ({
    page,
  }) => {
    await applyRelationTypeFilter(page, 'Synonym');

    await expect(page.getByTestId('ontology-graph-no-relations')).toBeVisible();
  });

  test('isolated nodes OFF + unmatched relation filter shows no-relations, not empty state', async ({
    page,
  }) => {
    await page.getByTestId('ontology-isolated-toggle').click();
    await applyRelationTypeFilter(page, 'Synonym');

    await expect(page.getByTestId('ontology-graph-no-relations')).toBeVisible();
    await expect(page.getByTestId('ontology-graph-empty')).not.toBeVisible();
  });

  test('removing the relation filter restores connected nodes', async ({
    page,
  }) => {
    await page.getByTestId('ontology-isolated-toggle').click();
    await applyRelationTypeFilter(page, 'Synonym');
    await applyRelationTypeFilter(page, 'Synonym');

    await expect(
      page.getByTestId('ontology-graph-no-relations')
    ).not.toBeVisible();
    await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
      '2 Terms'
    );
  });

  test('re-enabling isolated nodes while relation filter is active keeps no-relations state', async ({
    page,
  }) => {
    await page.getByTestId('ontology-isolated-toggle').click();
    await applyRelationTypeFilter(page, 'Synonym');

    await page.getByTestId('ontology-isolated-toggle').click();

    await expect(page.getByTestId('ontology-graph-no-relations')).toBeVisible();
  });
});

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
    test.slow();
    await navigateToOntologyExplorer(page);
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

  test('stats include the cross-glossary relation', async ({ page }) => {
    await expect(page.getByTestId('ontology-explorer-stats')).not.toContainText(
      '0 Relations'
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
    test.slow();
    await termA.visitEntityPage(page);
    await page.getByTestId('relations_graph').click();
    await waitForGraphLoaded(page);
  });

  test('ontology explorer is visible in the Relations Graph tab', async ({
    page,
  }) => {
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
  });

  test('global filter toolbar is hidden in term scope', async ({ page }) => {
    await expect(
      page.getByTestId('ontology-explorer-header')
    ).not.toBeVisible();
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
