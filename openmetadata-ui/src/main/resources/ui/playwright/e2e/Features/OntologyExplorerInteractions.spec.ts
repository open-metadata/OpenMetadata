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
import {
  OntologyExplorerComboData as ComboData,
  OntologyExplorerCrossGlossaryData as CrossGlossaryData,
  OntologyExplorerEmbeddedData as EmbeddedData,
} from '../../support/entity/OntologyExplorerDataClass';
import {
  applyGlossaryFilter,
  applyRelationTypeFilter,
  createApiContext,
  disposeApiContext,
  navigateToOntologyExplorer,
  readGraphEdges,
  readNodePositions,
  waitForGraphLoaded,
} from '../../utils/ontologyExplorer';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Isolated nodes + relation filter combo', () => {
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createApiContext(browser);
    await ComboData.setup(apiContext);
    await disposeApiContext(afterAction, apiContext);
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createApiContext(browser);
    await ComboData.teardown(apiContext);
    await disposeApiContext(afterAction, apiContext);
  });

  test.beforeEach(async ({ page }) => {
    await navigateToOntologyExplorer(page);
    await waitForGraphLoaded(page);
    await applyGlossaryFilter(page, ComboData.comboGlossary.responseData.id);
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
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createApiContext(browser);
    await CrossGlossaryData.setup(apiContext);
    await disposeApiContext(afterAction, apiContext);
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createApiContext(browser);
    await CrossGlossaryData.teardown(apiContext);
    await disposeApiContext(afterAction, apiContext);
  });

  test.beforeEach(async ({ page }) => {
    await navigateToOntologyExplorer(page);
    await waitForGraphLoaded(page);
    await applyGlossaryFilter(
      page,
      CrossGlossaryData.salesGlossary.responseData.id
    );
    await waitForGraphLoaded(page);
  });

  test('term from another glossary is hydrated in as a node', async ({
    page,
  }) => {
    await page.getByTestId('fit-view').click();
    const positions = await readNodePositions(page);

    expect(
      positions[CrossGlossaryData.termRevenue.responseData.id]
    ).toBeDefined();
    expect(
      positions[CrossGlossaryData.termExpense.responseData.id]
    ).toBeDefined();
  });

  test('cross-glossary edge is present in graph data', async ({ page }) => {
    const edges = await readGraphEdges(page);
    const edge = edges.find(
      (e) =>
        (e.from === CrossGlossaryData.termRevenue.responseData.id &&
          e.to === CrossGlossaryData.termExpense.responseData.id) ||
        (e.from === CrossGlossaryData.termExpense.responseData.id &&
          e.to === CrossGlossaryData.termRevenue.responseData.id)
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
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createApiContext(browser);
    await EmbeddedData.setup(apiContext);
    await disposeApiContext(afterAction, apiContext);
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createApiContext(browser);
    await EmbeddedData.teardown(apiContext);
    await disposeApiContext(afterAction, apiContext);
  });

  test.beforeEach(async ({ page }) => {
    await EmbeddedData.termA.visitEntityPage(page);
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

    expect(positions[EmbeddedData.termA.responseData.id]).toBeDefined();
    expect(positions[EmbeddedData.termB.responseData.id]).toBeDefined();
    expect(positions[EmbeddedData.termC.responseData.id]).toBeUndefined();
  });

  test('edge between the term and its neighbour is present', async ({
    page,
  }) => {
    const edges = await readGraphEdges(page);
    const edge = edges.find(
      (e) =>
        (e.from === EmbeddedData.termA.responseData.id &&
          e.to === EmbeddedData.termB.responseData.id) ||
        (e.from === EmbeddedData.termB.responseData.id &&
          e.to === EmbeddedData.termA.responseData.id)
    );

    expect(edge).toBeDefined();
  });

  test('clicking a neighbour node opens the entity panel', async ({ page }) => {
    await page.getByTestId('fit-view').click();
    const positions = await readNodePositions(page);
    await page.mouse.click(
      positions[EmbeddedData.termB.responseData.id].x,
      positions[EmbeddedData.termB.responseData.id].y
    );

    await expect(
      page.getByTestId('entity-summary-panel-container')
    ).toBeVisible();
  });
});
