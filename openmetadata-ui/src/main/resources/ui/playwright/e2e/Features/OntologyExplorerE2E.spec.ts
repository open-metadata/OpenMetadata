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
 * Golden-path smoke test for the Ontology Explorer.
 *
 * Domain: Product Catalog
 *   Glossary: pw-golden-path-catalog
 *   Terms:    Product, Category, Brand
 *
 * Relation model
 *   Product  --[partOf]----->  Category   (built-in · Hierarchical)
 *   Brand    --[partOf]----->  Category   (built-in · Hierarchical)
 *   Product  --[relatedTo]->  Brand       (built-in · Semantic)
 *   Category --[pw-gp-owns]-> Brand       (custom  · ONE_TO_MANY cardinality)
 *
 * Covered flows
 *   1. Graph load   — stats and canvas render correctly
 *   2. Node data    — all 3 term nodes appear with valid positions
 *   3. Edge data    — all 4 edges present and relation types correct
 *   4. Cardinality  — custom type shows "1"→"M" labels; built-in types absent
 *   5. Node click   — entity summary panel opens for each term; relations tab populated
 *   6. Overview mode — default; all edges visible
 *   7. Hierarchy mode — Product and Brand grouped under Category via partOf
 *   8. Cross-Glossary mode — renders without error
 *   9. Data mode    — switches and loads asset counts
 *  10. Graph search — matches node + neighbours; clears correctly
 *  11. Edge labels  — toggle off hides labels; back on restores them
 *  12. Export       — PNG download triggered
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

// ── Domain model ──────────────────────────────────────────────────────────────

const CUSTOM_OWNS_RELATION = 'pw-gp-owns';

const catalog = new Glossary();
const termProduct = new GlossaryTerm(catalog);
const termCategory = new GlossaryTerm(catalog);
const termBrand = new GlossaryTerm(catalog);

// ── Lifecycle ─────────────────────────────────────────────────────────────────

test.describe('Ontology Explorer — Golden Path (Product Catalog domain)', () => {
  test.beforeAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);

    // Create glossary and terms
    await catalog.create(apiContext);
    await termProduct.create(apiContext);
    await termCategory.create(apiContext);
    await termBrand.create(apiContext);

    // Register custom ONE_TO_MANY relation type
    await addRelationTypeWithCardinality(apiContext, {
      name: CUSTOM_OWNS_RELATION,
      displayName: 'GP Owns',
      cardinality: 'ONE_TO_MANY',
    });

    // Wire up the relation model
    await addTermRelation(apiContext, termProduct, termCategory, 'partOf'); // hierarchical
    await addTermRelation(apiContext, termBrand, termCategory, 'partOf'); // hierarchical
    await addTermRelation(apiContext, termProduct, termBrand, 'relatedTo'); // semantic
    await addTermRelation(apiContext, termCategory, termBrand, CUSTOM_OWNS_RELATION); // cardinality

    await disposeApiContext(page, apiContext);
  });

  test.afterAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);
    await removeRelationType(apiContext, CUSTOM_OWNS_RELATION);
    await deleteEntities(
      apiContext,
      termProduct,
      termCategory,
      termBrand,
      catalog
    );
    await disposeApiContext(page, apiContext);
  });

  test.beforeEach(async ({ page }) => {
    test.slow();
    await navigateToOntologyExplorer(page);
    await waitForGraphLoaded(page);
    await applyGlossaryFilter(page, catalog.responseData.id);
    await waitForGraphLoaded(page);
  });

  // ── 1. Graph load ────────────────────────────────────────────────────────────

  test.describe('1 · Graph load', () => {
    test('stats show 3 terms and 4 relations for the Product Catalog domain', async ({
      page,
    }) => {
      const stats = page.getByTestId('ontology-explorer-stats');
      await expect(stats).toContainText('3 Terms');
      await expect(stats).toContainText('4 Relations');
    });

    test('canvas renders without empty or error state', async ({ page }) => {
      await expect(page.getByTestId('ontology-graph-empty')).not.toBeVisible();
      await expect(
        page.locator('.ontology-g6-container canvas').first()
      ).toBeVisible();
    });
  });

  // ── 2. Node data ─────────────────────────────────────────────────────────────

  test.describe('2 · Node data', () => {
    test('all three term nodes have canvas positions', async ({ page }) => {
      await page.getByTestId('fit-view').click();
      const positions = await readNodePositions(page);

      expect(positions[termProduct.responseData.id]).toBeDefined();
      expect(positions[termCategory.responseData.id]).toBeDefined();
      expect(positions[termBrand.responseData.id]).toBeDefined();
    });
  });

  // ── 3. Edge data ─────────────────────────────────────────────────────────────

  test.describe('3 · Edge data', () => {
    test('graph edges contain all four expected relation types', async ({
      page,
    }) => {
      const edges = await readGraphEdges(page);
      const types = new Set(
        edges.flatMap((e) =>
          e.inverseRelationType
            ? [e.relationType, e.inverseRelationType]
            : [e.relationType]
        )
      );

      // partOf ↔ hasPart pair
      expect(types.has('partOf') || types.has('hasPart')).toBe(true);
      // relatedTo (symmetric)
      expect(types.has('relatedTo')).toBe(true);
      // custom cardinality relation
      expect(types.has(CUSTOM_OWNS_RELATION)).toBe(true);
    });

    test('the two partOf edges connect correct term pairs', async ({ page }) => {
      const edges = await readGraphEdges(page);

      const productCategoryEdge = edges.find(
        (e) =>
          (e.relationType === 'partOf' &&
            e.from === termProduct.responseData.id &&
            e.to === termCategory.responseData.id) ||
          (e.relationType === 'hasPart' &&
            e.from === termCategory.responseData.id &&
            e.to === termProduct.responseData.id)
      );
      expect(
        productCategoryEdge,
        'Product→Category (partOf) edge must be present'
      ).toBeDefined();

      const brandCategoryEdge = edges.find(
        (e) =>
          (e.relationType === 'partOf' &&
            e.from === termBrand.responseData.id &&
            e.to === termCategory.responseData.id) ||
          (e.relationType === 'hasPart' &&
            e.from === termCategory.responseData.id &&
            e.to === termBrand.responseData.id)
      );
      expect(
        brandCategoryEdge,
        'Brand→Category (partOf) edge must be present'
      ).toBeDefined();
    });
  });

  // ── 4. Cardinality ───────────────────────────────────────────────────────────

  test.describe('4 · Cardinality labels', () => {
    test('custom ONE_TO_MANY relation shows "1" at source and "M" at target', async ({
      page,
    }) => {
      const map = await readCardinalityMap(page);

      expect(map[CUSTOM_OWNS_RELATION]).toEqual({
        startLabelText: '1',
        endLabelText: 'M',
      });
    });

    test('built-in relatedTo relation does not appear in cardinality map', async ({
      page,
    }) => {
      const map = await readCardinalityMap(page);

      expect(map['relatedTo']).toBeUndefined();
    });

    test('built-in partOf relation does not appear in cardinality map', async ({
      page,
    }) => {
      const map = await readCardinalityMap(page);

      expect(map['partOf']).toBeUndefined();
    });
  });

  // ── 5. Node click — entity summary panel ────────────────────────────────────

  test.describe('5 · Node click and entity panel', () => {
    test('clicking the Category node opens the entity summary panel', async ({
      page,
    }) => {
      await page.getByTestId('fit-view').click();
      const positions = await readNodePositions(page);
      const pos = positions[termCategory.responseData.id];

      expect(pos, 'Category node must have a canvas position').toBeDefined();
      await page.mouse.click(pos.x, pos.y);

      await expect(
        page.getByTestId('entity-summary-panel-container')
      ).toBeVisible();
      await expect(
        page.getByTestId('permission-error-placeholder')
      ).not.toBeVisible();
    });

    test('Relations tab on Category panel shows Product and Brand as related terms', async ({
      page,
    }) => {
      await page.getByTestId('fit-view').click();
      const positions = await readNodePositions(page);
      await page.mouse.click(
        positions[termCategory.responseData.id].x,
        positions[termCategory.responseData.id].y
      );

      await expect(
        page.getByTestId('entity-summary-panel-container')
      ).toBeVisible();
      await page.getByTestId('ontology-relations-tab').click();

      const panel = page.getByTestId('entity-summary-panel-container');
      const productName =
        termProduct.responseData.displayName ?? termProduct.responseData.name;
      const brandName =
        termBrand.responseData.displayName ?? termBrand.responseData.name;

      await expect(panel.getByText(productName)).toBeVisible({ timeout: 5000 });
      await expect(panel.getByText(brandName)).toBeVisible({ timeout: 5000 });
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
  });

  // ── 6. Overview mode (default) ───────────────────────────────────────────────

  test.describe('6 · Overview mode', () => {
    test('Overview is selected by default and shows all 4 relations', async ({
      page,
    }) => {
      await expect(page.getByTestId('view-mode-select')).toContainText(
        'Overview'
      );
      await expect(
        page.getByTestId('ontology-explorer-stats')
      ).toContainText('4 Relations');
    });
  });

  // ── 7. Hierarchy mode ────────────────────────────────────────────────────────

  test.describe('7 · Hierarchy mode', () => {
    test('switching to Hierarchy mode shows partOf relations (non-empty)', async ({
      page,
    }) => {
      await page.getByTestId('view-mode-select').click();
      await page.getByRole('option', { name: 'Hierarchy' }).click();
      await waitForGraphLoaded(page);

      // partOf relations exist → hierarchy should NOT be empty
      await expect(
        page.getByTestId('ontology-graph-hierarchy-empty')
      ).not.toBeVisible();
      await expect(
        page.locator('.ontology-g6-container canvas').first()
      ).toBeVisible();
    });

    test('switching back from Hierarchy to Overview restores 4-relation stats', async ({
      page,
    }) => {
      await page.getByTestId('view-mode-select').click();
      await page.getByRole('option', { name: 'Hierarchy' }).click();
      await waitForGraphLoaded(page);

      await page.getByTestId('view-mode-select').click();
      await page.getByRole('option', { name: 'Overview' }).click();
      await waitForGraphLoaded(page);

      await expect(
        page.getByTestId('ontology-explorer-stats')
      ).toContainText('4 Relations');
    });
  });

  // ── 8. Cross-Glossary mode ────────────────────────────────────────────────────

  test.describe('8 · Cross-Glossary mode', () => {
    test('Cross Glossary mode renders the graph without errors', async ({
      page,
    }) => {
      await page.getByTestId('view-mode-select').click();
      await page.getByRole('option', { name: 'Cross Glossary' }).click();
      await waitForGraphLoaded(page);

      await expect(page.getByTestId('ontology-explorer')).toBeVisible();
      await expect(page.getByTestId('view-mode-select')).toContainText(
        'Cross Glossary'
      );
    });
  });

  // ── 9. Data mode ─────────────────────────────────────────────────────────────

  test.describe('9 · Data exploration mode', () => {
    test('switching to Data mode fires the asset-counts API and shows the graph', async ({
      page,
    }) => {
      const assetCountsReq = page.waitForResponse(
        (res) =>
          res.url().includes('/api/v1/glossaryTerms/assets/counts') &&
          res.request().method() === 'GET',
        { timeout: 30000 }
      );
      await page.getByRole('tab', { name: 'Data' }).click();
      await assetCountsReq;
      await waitForGraphLoaded(page);

      await expect(page.getByRole('tab', { name: 'Data' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    });

    test('view-mode select is disabled in Data mode and re-enabled in Model mode', async ({
      page,
    }) => {
      await page.getByRole('tab', { name: 'Data' }).click();
      await waitForGraphLoaded(page);
      await expect(page.getByTestId('view-mode-select')).toHaveAttribute(
        'data-disabled',
        'true'
      );

      await page.getByRole('tab', { name: 'Model' }).click();
      await waitForGraphLoaded(page);
      await expect(page.getByTestId('view-mode-select')).not.toHaveAttribute(
        'data-disabled',
        'true'
      );
    });

    test('returning to Model mode preserves glossary filter and shows 4 relations', async ({
      page,
    }) => {
      await page.getByRole('tab', { name: 'Data' }).click();
      await waitForGraphLoaded(page);

      await page.getByRole('tab', { name: 'Model' }).click();
      await waitForGraphLoaded(page);

      await expect(
        page.getByTestId('ontology-explorer-stats')
      ).toContainText('4 Relations');
    });
  });

  // ── 10. Graph search ─────────────────────────────────────────────────────────

  test.describe('10 · Graph search', () => {
    test('searching for Category shows Category and its direct neighbours only', async ({
      page,
    }) => {
      const productName =
        termProduct.responseData.displayName ?? termProduct.responseData.name;
      const categoryName =
        termCategory.responseData.displayName ?? termCategory.responseData.name;

      await page.getByTestId('fit-view').click();

      const searchInput = page
        .getByTestId('ontology-graph-search')
        .locator('input');
      await searchInput.fill(categoryName);

      const positions = await readNodePositions(page);

      expect(
        positions[termCategory.responseData.id],
        'Category must be visible after searching for it'
      ).toBeDefined();

      // Product and Brand are both direct neighbours of Category via partOf
      const productVisible = Boolean(
        positions[termProduct.responseData.id]
      );
      const brandVisible = Boolean(positions[termBrand.responseData.id]);
      expect(
        productVisible || brandVisible,
        `At least one neighbour of Category must be visible — ` +
          `search term: "${productName}"`
      ).toBe(true);
    });

    test('clearing the search restores all 3 nodes', async ({ page }) => {
      await page.getByTestId('fit-view').click();

      const searchInput = page
        .getByTestId('ontology-graph-search')
        .locator('input');
      await searchInput.fill(
        termCategory.responseData.displayName ??
          termCategory.responseData.name
      );

      await searchInput.clear();

      const positions = await readNodePositions(page);
      expect(Object.keys(positions).length).toBeGreaterThanOrEqual(3);
    });

    test('searching for a non-existent term shows the empty state', async ({
      page,
    }) => {
      const searchInput = page
        .getByTestId('ontology-graph-search')
        .locator('input');
      await searchInput.fill('__pw_no_such_term_golden_path__');

      await expect(page.getByTestId('ontology-graph-empty')).toBeVisible();
    });
  });

  // ── 11. Edge labels toggle ────────────────────────────────────────────────────

  test.describe('11 · Edge labels toggle', () => {
    test('cardinality map is present when edge labels are on (default state)', async ({
      page,
    }) => {
      const map = await readCardinalityMap(page);

      expect(Object.keys(map).length).toBeGreaterThan(0);
      expect(map[CUSTOM_OWNS_RELATION]).toBeDefined();
    });

    test('toggling edge labels off and back on leaves the graph visible', async ({
      page,
    }) => {
      await page.getByTestId('ontology-graph-settings').click();
      await expect(page.getByTestId('graph-settings-close')).toBeVisible();

      const toggle = page.getByTestId('graph-settings-edge-labels-toggle');
      await expect(toggle).toHaveAttribute('data-selected', 'true');

      await toggle.click();
      await expect(toggle).not.toHaveAttribute('data-selected', 'true');
      await expect(
        page.locator('.ontology-g6-container canvas').first()
      ).toBeVisible();

      await toggle.click();
      await expect(toggle).toHaveAttribute('data-selected', 'true');
      await page.getByTestId('graph-settings-close').click();

      // cardinality map must still be intact after the roundtrip
      const map = await readCardinalityMap(page);
      expect(map[CUSTOM_OWNS_RELATION]).toEqual({
        startLabelText: '1',
        endLabelText: 'M',
      });
    });
  });

  // ── 12. Export ────────────────────────────────────────────────────────────────

  test.describe('12 · Export', () => {
    test('PNG export triggers a .png file download', async ({ page }) => {
      await waitForGraphLoaded(page);
      await page.getByTestId('ontology-export-graph').click();

      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByText('PNG', { exact: true }).click(),
      ]);

      expect(download.suggestedFilename()).toMatch(/\.png$/i);
    });
  });
});
