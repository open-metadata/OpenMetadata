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
  addRelationTypeWithCardinality,
  addTermRelation,
  applyGlossaryFilter,
  clickGraphNode,
  createApiContext,
  deleteEntities,
  deleteRelationTypeByName,
  disposeApiContext,
  navigateToOntologyStudio,
  readCardinalityMap,
  readGraphEdges,
  readNodePositions,
  waitForGraphLoaded,
} from '../../utils/ontologyStudio';

test.use({ storageState: 'playwright/.auth/admin.json' });
test.describe.configure({ mode: 'serial' });

// Unique suffix per worker/repeat so parallel runs don't share relation type names.
const RUN_ID = Math.random().toString(36).slice(2, 8);
const CUSTOM_OWNS_RELATION = `pw-gp-owns-${RUN_ID}`;

const catalog = new Glossary();
const termProduct = new GlossaryTerm(catalog);
const termCategory = new GlossaryTerm(catalog);
const termBrand = new GlossaryTerm(catalog);

test.describe('Ontology Studio — E2E', () => {
  test.beforeAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);

    await catalog.create(apiContext);
    await termProduct.create(apiContext);
    await termCategory.create(apiContext);
    await termBrand.create(apiContext);

    await addRelationTypeWithCardinality(apiContext, {
      name: CUSTOM_OWNS_RELATION,
      displayName: 'GP Owns',
      cardinality: 'ONE_TO_MANY',
    });

    await addTermRelation(apiContext, termProduct, termCategory, 'partOf');
    await addTermRelation(apiContext, termBrand, termCategory, 'partOf');
    await addTermRelation(apiContext, termProduct, termBrand, 'relatedTo');
    await addTermRelation(
      apiContext,
      termCategory,
      termBrand,
      CUSTOM_OWNS_RELATION
    );

    await disposeApiContext(page, apiContext);
  });

  test.afterAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);
    await deleteEntities(
      apiContext,
      termProduct,
      termCategory,
      termBrand,
      catalog
    );
    await deleteRelationTypeByName(apiContext, CUSTOM_OWNS_RELATION);
    await disposeApiContext(page, apiContext);
  });

  test.beforeEach(async ({ page }) => {
    await navigateToOntologyStudio(page);
    await waitForGraphLoaded(page);
    await applyGlossaryFilter(page, catalog.responseData.id);
    await waitForGraphLoaded(page);
  });

  test('stats show 3 terms and 4 relations', async ({ page }) => {
    await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
      /3\s+terms/i
    );
    await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
      /4\s+relations?/i
    );
  });

  test('graph renders without empty or error state', async ({ page }) => {
    await expect(page.getByTestId('ontology-graph-empty')).not.toBeVisible();
    await expect(page.locator('.ontology-g6-container')).toBeVisible();
  });

  test('all three term nodes have canvas positions', async ({ page }) => {
    await page.getByTestId('fit-view').click();
    const positions = await readNodePositions(page);

    expect(positions[termProduct.responseData.id]).toBeDefined();
    expect(positions[termCategory.responseData.id]).toBeDefined();
    expect(positions[termBrand.responseData.id]).toBeDefined();
  });

  test('graph edges contain all four expected relation types', async ({
    page,
  }) => {
    const edges = await readGraphEdges(page, 4);
    const types = new Set(
      edges.flatMap((e) =>
        e.inverseRelationType
          ? [e.relationType, e.inverseRelationType]
          : [e.relationType]
      )
    );

    expect(types.has('partOf') || types.has('hasPart')).toBe(true);
    expect(types.has('relatedTo')).toBe(true);
    expect(types.has(CUSTOM_OWNS_RELATION)).toBe(true);
  });

  test('custom ONE_TO_MANY relation shows "1" at source and "M" at target', async ({
    page,
  }) => {
    const map = await readCardinalityMap(page, CUSTOM_OWNS_RELATION);

    expect(map[CUSTOM_OWNS_RELATION]).toEqual({
      startLabelText: '1',
      endLabelText: 'M',
    });
  });

  test('unconstrained built-in relations omit endpoint labels', async ({
    page,
  }) => {
    const map = await readCardinalityMap(page);

    expect(map.relatedTo).toBeUndefined();
    expect(map.partOf).toBeUndefined();
  });

  test('clicking a node opens the concept inspector', async ({ page }) => {
    await page.getByTestId('fit-view').click();
    await clickGraphNode(page, termCategory.responseData.id);

    await expect(
      page.getByTestId('ontology-authoring-inspector')
    ).toBeVisible();
    await expect(
      page.getByTestId('permission-error-placeholder')
    ).not.toBeVisible();
  });

  test('concept inspector exposes the full-details action', async ({
    page,
  }) => {
    await page.getByTestId('fit-view').click();
    await clickGraphNode(page, termProduct.responseData.id);

    await expect(
      page.getByTestId('ontology-concept-full-details')
    ).toBeVisible();
  });

  test('Tree surface renders the glossary hierarchy', async ({ page }) => {
    await page.getByTestId('submode-tab-tree').click();

    await expect(page.getByTestId('ontology-tree-view')).toBeVisible();
  });

  test('switching back from Tree to Graph restores the graph and stats', async ({
    page,
  }) => {
    await page.getByTestId('submode-tab-tree').click();
    await page.getByTestId('submode-tab-graph').click();

    await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
      /4\s+relations?/i,
      { timeout: 45000 }
    );
    await expect(page.locator('.ontology-g6-container')).toBeVisible();
  });

  test('Data mode shows an empty state when the glossary has no assets', async ({
    page,
  }) => {
    await page.getByRole('tab', { name: 'Data' }).click();
    await waitForGraphLoaded(page);

    await expect(page.getByRole('tab', { name: 'Data' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(page.getByTestId('ontology-graph-empty')).toBeVisible();
  });

  test('returning to Model mode restores graph controls', async ({ page }) => {
    await page.getByRole('tab', { name: 'Data' }).click();
    await waitForGraphLoaded(page);
    await expect(page.getByTestId('ontology-graph-empty')).toBeVisible();

    await page.getByRole('tab', { name: 'Model' }).click();
    await waitForGraphLoaded(page);

    await expect(page.getByTestId('ontology-graph-controls')).toBeVisible();
  });

  test('searching for a term shows it and its neighbours', async ({ page }) => {
    await page.getByTestId('fit-view').click();

    const categoryName =
      termCategory.responseData.displayName ?? termCategory.responseData.name;
    await page.getByTestId('ontology-graph-search').fill(categoryName);

    const positions = await readNodePositions(page);

    expect(positions[termCategory.responseData.id]).toBeDefined();
  });

  test('searching for a non-existent term shows the empty state', async ({
    page,
  }) => {
    await page.getByTestId('ontology-graph-search').fill('__pw_no_such_term__');

    await expect(page.getByTestId('ontology-graph-search-empty')).toBeVisible();
  });

  test('cardinality map survives a Data-to-Model round trip', async ({
    page,
  }) => {
    await page.getByRole('tab', { name: 'Data' }).click();
    await expect(page.getByTestId('ontology-graph-empty')).toBeVisible();
    await page.getByRole('tab', { name: 'Model' }).click();

    const map = await readCardinalityMap(page, CUSTOM_OWNS_RELATION);
    expect(map[CUSTOM_OWNS_RELATION]).toEqual({
      startLabelText: '1',
      endLabelText: 'M',
    });
  });
});
