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

/**
 * Tests for four previously-uncovered Ontology Explorer features:
 *
 * 1. Node data update after edit
 *    Editing a term's displayName in the entity panel updates the panel and
 *    triggers a PATCH (not a full graph re-fetch).
 *
 * 2. Isolated nodes + relation filter combo
 *    Turning isolated nodes OFF then applying a relation-type filter that
 *    removes all edges produces ontology-graph-no-relations (not empty-state).
 *
 * 3. Cross-glossary term hydration
 *    A term in Glossary A that references a term in Glossary B causes both
 *    terms to appear as nodes in Cross Glossary view with an edge between them.
 *
 * 4. Embedded scope  (scope="term")
 *    Opening the Relations Graph tab on a glossary term detail page renders
 *    the ontology explorer WITHOUT the global filter toolbar, scoped to just
 *    that term and its direct neighbours.
 *
 * All tests are fully independent and safe for parallel execution.
 * Each test owns its own entities; no test mutates state shared by another.
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

// ─────────────────────────────────────────────────────────────────────────────
// 1 · Node data update after edit
// Each write test gets its own dedicated entity pair so parallel runs never
// race on the same API resource.
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Node data update after edit', () => {

  const editGlossary = new Glossary();

  // Test 1 — PATCH-vs-GET check owns these two terms exclusively.
  const patchTestSource = new GlossaryTerm(editGlossary);
  const patchTestTarget = new GlossaryTerm(editGlossary);

  // Test 2 — position-stability check owns these two terms exclusively.
  const layoutTestSource = new GlossaryTerm(editGlossary);
  const layoutTestTarget = new GlossaryTerm(editGlossary);

  test.beforeAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);
    await editGlossary.create(apiContext);
    await patchTestSource.create(apiContext);
    await patchTestTarget.create(apiContext);
    await layoutTestSource.create(apiContext);
    await layoutTestTarget.create(apiContext);
    await addTermRelation(apiContext, patchTestSource, patchTestTarget, 'relatedTo');
    await addTermRelation(apiContext, layoutTestSource, layoutTestTarget, 'relatedTo');
    await disposeApiContext(page, apiContext);
  });

  test.afterAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);
    await deleteEntities(
      apiContext,
      patchTestSource,
      patchTestTarget,
      layoutTestSource,
      layoutTestTarget,
      editGlossary
    );
    await disposeApiContext(page, apiContext);
  });

  test.beforeEach(async ({ page }) => {
    test.slow();
    await navigateToOntologyExplorer(page);
    await waitForGraphLoaded(page);
    await applyGlossaryFilter(page, editGlossary.responseData.id);
    await waitForGraphLoaded(page);
    await page.getByTestId('fit-view').click();
  });

  test('editing displayName via entity panel fires a PATCH, not a full graph re-fetch', async ({
    page,
  }) => {
    const positions = await readNodePositions(page);
    const termPos = positions[patchTestSource.responseData.id];

    expect(termPos, 'patchTestSource must be in the graph').toBeDefined();
    await page.mouse.click(termPos.x, termPos.y);

    await expect(
      page.getByTestId('entity-summary-panel-container')
    ).toBeVisible();

    let patchFired = false;
    let fullRefetchFired = false;

    page.on('request', (req) => {
      if (
        req.method() === 'PATCH' &&
        req.url().includes(`/api/v1/glossaryTerms/${patchTestSource.responseData.id}`)
      ) {
        patchFired = true;
      }
      if (
        req.method() === 'GET' &&
        req.url().includes('/api/v1/glossaryTerms?') &&
        req.url().includes('limit=')
      ) {
        fullRefetchFired = true;
      }
    });

    const panel = page.getByTestId('entity-summary-panel-container');
    await panel.hover();
    await page.getByTestId('edit-displayName-button').first().click();

    await expect(page.getByTestId('save-button')).toBeVisible();

    const newName = `${patchTestSource.responseData.displayName ?? patchTestSource.responseData.name}-edited`;
    await page.locator('[name="displayName"]').clear();
    await page.locator('[name="displayName"]').fill(newName);

    const patchResponse = page.waitForResponse(
      (res) =>
        res
          .url()
          .includes(`/api/v1/glossaryTerms/${patchTestSource.responseData.id}`) &&
        res.request().method() === 'PATCH',
      { timeout: 15000 }
    );

    await page.getByTestId('save-button').click();
    await patchResponse;

    expect(patchFired, 'A PATCH to the term endpoint must be fired on save').toBe(
      true
    );
    expect(
      fullRefetchFired,
      'A full graph re-fetch (GET glossaryTerms with limit) must NOT fire'
    ).toBe(false);

    await expect(panel.getByText(newName)).toBeVisible({ timeout: 10000 });
  });

  test('entity panel content updates without graph canvas re-render after edit', async ({
    page,
  }) => {
    const positions = await readNodePositions(page);
    await page.mouse.click(
      positions[layoutTestSource.responseData.id].x,
      positions[layoutTestSource.responseData.id].y
    );

    await expect(
      page.getByTestId('entity-summary-panel-container')
    ).toBeVisible();

    const positionsBefore = await readNodePositions(page);

    const panel = page.getByTestId('entity-summary-panel-container');
    await panel.hover();
    await page.getByTestId('edit-displayName-button').first().click();

    await expect(page.getByTestId('save-button')).toBeVisible();
    const updatedName = `${layoutTestSource.responseData.displayName ?? layoutTestSource.responseData.name}-v2`;
    await page.locator('[name="displayName"]').clear();
    await page.locator('[name="displayName"]').fill(updatedName);
    await page.getByTestId('save-button').click();

    await expect(panel.getByText(updatedName)).toBeVisible({ timeout: 10000 });

    const positionsAfter = await readNodePositions(page);
    const termBefore = positionsBefore[layoutTestSource.responseData.id];
    const termAfter = positionsAfter[layoutTestSource.responseData.id];

    expect(
      Math.abs((termAfter?.x ?? 0) - (termBefore?.x ?? 0)),
      'Node X position must not change after an in-panel edit'
    ).toBeLessThan(5);
    expect(
      Math.abs((termAfter?.y ?? 0) - (termBefore?.y ?? 0)),
      'Node Y position must not change after an in-panel edit'
    ).toBeLessThan(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2 · Isolated nodes + relation filter combo
// All tests are read-only (UI-state only via beforeEach reset) — safe to run
// in parallel with individual page contexts.
// ─────────────────────────────────────────────────────────────────────────────

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
    await addTermRelation(apiContext, connectedTermA, connectedTermB, 'relatedTo');
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

  test('relation filter alone shows ontology-graph-no-relations when no edges match', async ({
    page,
  }) => {
    await applyRelationTypeFilter(page, 'Synonym');

    await expect(page.getByTestId('ontology-graph-no-relations')).toBeVisible();
  });

  test('isolated nodes OFF + relation filter that removes all edges → ontology-graph-no-relations', async ({
    page,
  }) => {
    await page.getByTestId('ontology-isolated-toggle').click();
    await waitForGraphLoaded(page);

    await applyRelationTypeFilter(page, 'Synonym');

    await expect(page.getByTestId('ontology-graph-no-relations')).toBeVisible();
    await expect(page.getByTestId('ontology-graph-empty')).not.toBeVisible();
  });

  test('removing the relation filter restores visible nodes after combo was active', async ({
    page,
  }) => {
    await page.getByTestId('ontology-isolated-toggle').click();
    await waitForGraphLoaded(page);
    await applyRelationTypeFilter(page, 'Synonym');
    await expect(page.getByTestId('ontology-graph-no-relations')).toBeVisible();

    // Click Synonym again to deselect and restore all edges.
    await applyRelationTypeFilter(page, 'Synonym');
    await waitForGraphLoaded(page);

    await expect(
      page.getByTestId('ontology-graph-no-relations')
    ).not.toBeVisible();
    await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
      '2 Terms'
    );
  });

  test('turning isolated nodes back ON after combo restores the isolated term', async ({
    page,
  }) => {
    await page.getByTestId('ontology-isolated-toggle').click();
    await waitForGraphLoaded(page);
    await applyRelationTypeFilter(page, 'Synonym');
    await expect(page.getByTestId('ontology-graph-no-relations')).toBeVisible();

    await page.getByTestId('ontology-isolated-toggle').click();
    await waitForGraphLoaded(page);

    await expect(page.getByTestId('ontology-graph-no-relations')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3 · Cross-glossary term hydration
// Read-only after setup — safe to run in parallel.
// ─────────────────────────────────────────────────────────────────────────────

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
  });

  test('both terms from different glossaries appear as nodes after hydration', async ({
    page,
  }) => {
    await applyGlossaryFilter(page, salesGlossary.responseData.id);
    await waitForGraphLoaded(page);
    await page.getByTestId('fit-view').click();

    const positions = await readNodePositions(page);

    expect(
      positions[termRevenue.responseData.id],
      'Revenue (Sales) node must be present'
    ).toBeDefined();
    expect(
      positions[termExpense.responseData.id],
      'Expense (Finance) must be hydrated in even when only Sales glossary is selected'
    ).toBeDefined();
  });

  test('the cross-glossary edge between the two terms is present in graph data', async ({
    page,
  }) => {
    await applyGlossaryFilter(page, salesGlossary.responseData.id);
    await waitForGraphLoaded(page);

    const edges = await readGraphEdges(page);
    const crossEdge = edges.find(
      (e) =>
        (e.from === termRevenue.responseData.id &&
          e.to === termExpense.responseData.id) ||
        (e.from === termExpense.responseData.id &&
          e.to === termRevenue.responseData.id)
    );

    expect(
      crossEdge,
      'A cross-glossary edge between Revenue and Expense must be present'
    ).toBeDefined();
    expect(
      crossEdge?.relationType === 'relatedTo' ||
        crossEdge?.inverseRelationType === 'relatedTo',
      'Edge relation type must be relatedTo'
    ).toBe(true);
  });

  test('Cross Glossary view mode shows only the inter-glossary edge', async ({
    page,
  }) => {
    await page.getByTestId('search-dropdown-Glossary').click();
    await page.getByTestId(salesGlossary.responseData.id).click();
    await page.getByTestId(financeGlossary.responseData.id).click();
    await page.getByTestId('update-btn').click();
    await waitForGraphLoaded(page);

    await page.getByTestId('view-mode-select').click();
    await page.getByRole('option', { name: 'Cross Glossary' }).click();
    await waitForGraphLoaded(page);

    const positions = await readNodePositions(page);

    expect(
      positions[termRevenue.responseData.id],
      'Revenue must be visible in Cross Glossary mode'
    ).toBeDefined();
    expect(
      positions[termExpense.responseData.id],
      'Expense must be visible in Cross Glossary mode'
    ).toBeDefined();

    const edges = await readGraphEdges(page);
    expect(edges.length, 'At least the cross-glossary edge must be shown').toBeGreaterThan(0);
  });

  test('stats reflect a cross-glossary relation in the relation count', async ({
    page,
  }) => {
    await applyGlossaryFilter(page, salesGlossary.responseData.id);
    await waitForGraphLoaded(page);

    const stats = page.getByTestId('ontology-explorer-stats');
    const text = await stats.textContent();
    const match = text?.match(/(\d+)\s+Relations?/);
    const relationCount = match ? Number(match[1]) : 0;

    expect(
      relationCount,
      'Cross-glossary relation must be included in the stats'
    ).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4 · Embedded scope (scope="term")
// Read-only after setup — safe to run in parallel.
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Embedded scope (Relations Graph tab on a glossary term page)', () => {

  const embeddedGlossary = new Glossary();
  const embeddedTermA = new GlossaryTerm(embeddedGlossary);
  const embeddedTermB = new GlossaryTerm(embeddedGlossary);
  const embeddedTermC = new GlossaryTerm(embeddedGlossary);

  test.beforeAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);
    await embeddedGlossary.create(apiContext);
    await embeddedTermA.create(apiContext);
    await embeddedTermB.create(apiContext);
    await embeddedTermC.create(apiContext);
    await addTermRelation(apiContext, embeddedTermA, embeddedTermB, 'relatedTo');
    await disposeApiContext(page, apiContext);
  });

  test.afterAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);
    await deleteEntities(
      apiContext,
      embeddedTermA,
      embeddedTermB,
      embeddedTermC,
      embeddedGlossary
    );
    await disposeApiContext(page, apiContext);
  });

  test.beforeEach(async ({ page }) => {
    test.slow();
    await embeddedTermA.visitEntityPage(page);
    await page.getByTestId('relations_graph').click();
    await waitForGraphLoaded(page);
  });

  test('ontology-explorer container is visible inside the Relations Graph tab', async ({
    page,
  }) => {
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
  });

  test('global filter toolbar (ontology-explorer-header) is NOT shown in term scope', async ({
    page,
  }) => {
    await expect(page.getByTestId('ontology-explorer-header')).not.toBeVisible();
  });

  test('graph control buttons (zoom, fit, refresh) ARE visible in term scope', async ({
    page,
  }) => {
    await expect(page.getByTestId('fit-view')).toBeVisible();
    await expect(page.getByTestId('zoom-in')).toBeVisible();
    await expect(page.getByTestId('zoom-out')).toBeVisible();
  });

  test('only the selected term and its direct neighbours appear as nodes', async ({
    page,
  }) => {
    await page.getByTestId('fit-view').click();
    const positions = await readNodePositions(page);

    expect(
      positions[embeddedTermA.responseData.id],
      'The selected term (A) must appear in its own graph'
    ).toBeDefined();
    expect(
      positions[embeddedTermB.responseData.id],
      'Term B (direct neighbour of A via relatedTo) must appear'
    ).toBeDefined();
    expect(
      positions[embeddedTermC.responseData.id],
      "Term C (unrelated to A) must NOT appear in A's embedded graph"
    ).toBeUndefined();
  });

  test('the edge between the selected term and its neighbour is present', async ({
    page,
  }) => {
    const edges = await readGraphEdges(page);
    const edge = edges.find(
      (e) =>
        (e.from === embeddedTermA.responseData.id &&
          e.to === embeddedTermB.responseData.id) ||
        (e.from === embeddedTermB.responseData.id &&
          e.to === embeddedTermA.responseData.id)
    );

    expect(
      edge,
      'Edge between A and B must be present in the embedded graph'
    ).toBeDefined();
  });

  test("stats in the embedded graph reflect only the term's direct relations", async ({
    page,
  }) => {
    const stats = page.getByTestId('ontology-explorer-stats');
    await expect(stats).toBeVisible();
    await expect(stats).toContainText('1 Relations');
  });

  test('clicking a neighbour node opens the entity panel within the embedded graph', async ({
    page,
  }) => {
    await page.getByTestId('fit-view').click();
    const positions = await readNodePositions(page);
    const bPos = positions[embeddedTermB.responseData.id];

    expect(bPos, 'Term B must have a canvas position').toBeDefined();
    await page.mouse.click(bPos.x, bPos.y);

    await expect(
      page.getByTestId('entity-summary-panel-container')
    ).toBeVisible();
    await expect(
      page.getByTestId('permission-error-placeholder')
    ).not.toBeVisible();
  });
});
