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
  addRelationTypeWithCardinality,
  addTermRelation,
  applyGlossaryFilter,
  createApiContext,
  deleteEntities,
  disposeApiContext,
  navigateToOntologyExplorer,
  readCardinalityMap,
  readGraphEdges,
  readNodePositions,
  removeRelationType,
  waitForGraphLoaded,
} from '../../utils/ontologyExplorer';

test.use({ storageState: 'playwright/.auth/admin.json' });

// Unique suffix per worker/repeat so parallel runs don't share relation type names.
const RUN_ID = Math.random().toString(36).slice(2, 8);
const CUSTOM_OWNS_RELATION = `pw-gp-owns-${RUN_ID}`;

const catalog = new Glossary();
const termProduct = new GlossaryTerm(catalog);
const termCategory = new GlossaryTerm(catalog);
const termBrand = new GlossaryTerm(catalog);

test.describe('Ontology Explorer — E2E', () => {
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
    await removeRelationType(apiContext, CUSTOM_OWNS_RELATION);
    await disposeApiContext(page, apiContext);
  });

  test.beforeEach(async ({ page }) => {
    test.slow();
    await navigateToOntologyExplorer(page);
    await waitForGraphLoaded(page);
    await applyGlossaryFilter(page, catalog.responseData.id);
    await waitForGraphLoaded(page);
  });

  test('stats show 3 terms and 6 relations', async ({ page }) => {
    await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
      '3 Terms'
    );
    await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
      '6 Relations'
    );
  });

  test('canvas renders without empty or error state', async ({ page }) => {
    await expect(page.getByTestId('ontology-graph-empty')).not.toBeVisible();
    await expect(
      page.locator('.ontology-g6-container canvas').first()
    ).toBeVisible();
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

  test('built-in relations show M:M cardinality in the cardinality map', async ({
    page,
  }) => {
    const map = await readCardinalityMap(page, ['relatedTo', 'partOf']);

    expect(map['relatedTo']).toEqual({
      startLabelText: 'M',
      endLabelText: 'M',
    });
    expect(map['partOf']).toEqual({ startLabelText: 'M', endLabelText: 'M' });
  });

  test('clicking a node opens the entity summary panel', async ({ page }) => {
    await page.getByTestId('fit-view').click();
    const positions = await readNodePositions(page);
    await page.mouse.click(
      positions[termCategory.responseData.id].x,
      positions[termCategory.responseData.id].y
    );

    await expect(
      page.getByTestId('entity-summary-panel-container')
    ).toBeVisible();
    await expect(
      page.getByTestId('permission-error-placeholder')
    ).not.toBeVisible();
  });

  test('entity panel closes via the close button', async ({ page }) => {
    await page.getByTestId('fit-view').click();
    const positions = await readNodePositions(page);
    await page.mouse.click(
      positions[termProduct.responseData.id].x,
      positions[termProduct.responseData.id].y
    );

    await expect(
      page.getByTestId('entity-summary-panel-container')
    ).toBeVisible();
    await page.getByTestId('drawer-close-icon').click();
    await expect(
      page.getByTestId('entity-summary-panel-container')
    ).not.toBeVisible();
  });

  test('Hierarchy mode renders without empty state', async ({ page }) => {
    await page.getByTestId('view-mode-select').click();
    await page.getByRole('option', { name: 'Hierarchy' }).click();
    await waitForGraphLoaded(page);

    await expect(
      page.getByTestId('ontology-graph-hierarchy-empty')
    ).not.toBeVisible();
    await expect(
      page.locator('.ontology-g6-container canvas').first()
    ).toBeVisible();
  });

  test('switching back from Hierarchy to Overview restores stats', async ({
    page,
  }) => {
    await page.getByTestId('view-mode-select').click();
    await page.getByRole('option', { name: 'Hierarchy' }).click();
    await waitForGraphLoaded(page);

    await page.getByTestId('view-mode-select').click();
    await page.getByRole('option', { name: 'Overview' }).click();

    await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
      '6 Relations',
      { timeout: 45000 }
    );
  });

  test('Cross Glossary mode renders without errors', async ({ page }) => {
    await page.getByTestId('view-mode-select').click();
    await page.getByRole('option', { name: 'Cross Glossary' }).click();
    await waitForGraphLoaded(page);

    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
  });

  test('Data mode loads and view-mode select becomes disabled', async ({
    page,
  }) => {
    await page.getByRole('tab', { name: 'Data' }).click();
    await waitForGraphLoaded(page);

    await expect(page.getByRole('tab', { name: 'Data' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(page.getByTestId('view-mode-select')).toHaveAttribute(
      'data-disabled',
      'true'
    );
  });

  test('returning to Model mode re-enables view-mode select', async ({
    page,
  }) => {
    await page.getByRole('tab', { name: 'Data' }).click();
    await waitForGraphLoaded(page);

    await page.getByRole('tab', { name: 'Model' }).click();
    await waitForGraphLoaded(page);

    await expect(page.getByTestId('view-mode-select')).not.toHaveAttribute(
      'data-disabled',
      'true'
    );
  });

  test('searching for a term shows it and its neighbours', async ({ page }) => {
    await page.getByTestId('fit-view').click();

    const categoryName =
      termCategory.responseData.displayName ?? termCategory.responseData.name;
    await page
      .getByTestId('ontology-graph-search')
      .locator('input')
      .fill(categoryName);

    const positions = await readNodePositions(page);

    expect(positions[termCategory.responseData.id]).toBeDefined();
  });

  test('searching for a non-existent term shows the empty state', async ({
    page,
  }) => {
    await page
      .getByTestId('ontology-graph-search')
      .locator('input')
      .fill('__pw_no_such_term__');

    await expect(page.getByTestId('ontology-graph-empty')).toBeVisible();
  });

  test('toggling edge labels off and back on leaves the graph and cardinality map intact', async ({
    page,
  }) => {
    await page.getByTestId('ontology-graph-settings').click();

    const toggle = page.getByTestId('graph-settings-edge-labels-toggle');
    await toggle.click();
    await expect(toggle).not.toHaveAttribute('data-selected', 'true');

    await toggle.click();
    await expect(toggle).toHaveAttribute('data-selected', 'true');
    await page.getByTestId('graph-settings-close').click();

    const map = await readCardinalityMap(page, CUSTOM_OWNS_RELATION);
    expect(map[CUSTOM_OWNS_RELATION]).toEqual({
      startLabelText: '1',
      endLabelText: 'M',
    });
  });

  test('PNG export triggers a file download', async ({ page }) => {
    await page.getByTestId('ontology-export-graph').click();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByText('PNG', { exact: true }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.png$/i);
  });
});
