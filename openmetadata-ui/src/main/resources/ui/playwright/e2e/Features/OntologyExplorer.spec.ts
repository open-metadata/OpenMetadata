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
  clickFirstGraphNode,
  clickGraphNode,
  createApiContext,
  deleteEntities,
  disposeApiContext,
  navigateToOntologyExplorer,
  readGraphEdges,
  readNodePositions,
  waitForGraphLoaded,
} from '../../utils/ontologyExplorer';

test.use({ storageState: 'playwright/.auth/admin.json' });

const glossary = new Glossary();
const term1 = new GlossaryTerm(glossary);
const term2 = new GlossaryTerm(glossary);

const multiRelGlossary = new Glossary();
const multiRelTermA = new GlossaryTerm(multiRelGlossary);
const multiRelTermB = new GlossaryTerm(multiRelGlossary);

test.describe('Ontology Explorer', () => {
  test.beforeAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);

    await glossary.create(apiContext);
    await term1.create(apiContext);
    await term2.create(apiContext);
    await multiRelGlossary.create(apiContext);
    await multiRelTermA.create(apiContext);
    await multiRelTermB.create(apiContext);

    await addTermRelation(apiContext, term1, term2, 'relatedTo');
    await addTermRelation(
      apiContext,
      multiRelTermA,
      multiRelTermB,
      'relatedTo'
    );
    await addTermRelation(apiContext, multiRelTermA, multiRelTermB, 'partOf');

    await disposeApiContext(page, apiContext);
  });

  test.afterAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);
    await deleteEntities(
      apiContext,
      term1,
      term2,
      glossary,
      multiRelTermA,
      multiRelTermB,
      multiRelGlossary
    );
    await disposeApiContext(page, apiContext);
  });

  test.beforeEach(async ({ page }) => {
    test.slow();
    await navigateToOntologyExplorer(page);
  });

  test.describe('Navigation', () => {
    test('should load the ontology studio page', async ({ page }) => {
      await expect(page.getByTestId('ontology-explorer')).toBeVisible();
      await expect(page).toHaveURL(/.*ontology.*/);
    });
  });

  test.describe('Page Layout', () => {
    test('should display the header section with title', async ({ page }) => {
      await expect(page.getByTestId('ontology-studio-shell')).toBeVisible();
      await expect(page.getByTestId('heading')).toContainText(
        'Ontology Studio'
      );
    });

    test('should display View mode with Graph and Tree surfaces', async ({
      page,
    }) => {
      await expect(page.getByTestId('mode-tab-view')).toBeVisible();
      await expect(page.getByTestId('submode-tab-graph')).toBeVisible();
      await expect(page.getByTestId('submode-tab-tree')).toBeVisible();
    });

    test('should display all graph control buttons', async ({ page }) => {
      await expect(page.getByTestId('fit-view')).toBeVisible();
      await expect(page.getByTestId('zoom-in')).toBeVisible();
      await expect(page.getByTestId('zoom-out')).toBeVisible();
      await expect(page.getByTestId('refresh')).toBeVisible();
    });

    test('should display search input in graph toolbar', async ({ page }) => {
      await expect(page.getByTestId('ontology-graph-search')).toBeVisible();
    });

    test('should display isolated concept count', async ({ page }) => {
      await expect(
        page.getByTestId('ontology-header-isolated-count')
      ).toBeVisible();
    });

    test('should display library and import/export actions', async ({
      page,
    }) => {
      await expect(page.getByTestId('ontology-library-trigger')).toBeVisible();
      await expect(
        page.getByTestId('ontology-import-export-trigger')
      ).toBeVisible();
    });

    test('should display exploration mode tabs (Model and Data)', async ({
      page,
    }) => {
      await expect(page.getByRole('tab', { name: 'Model' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Data' })).toBeVisible();
    });

    test('should select Graph surface by default and switch to Tree', async ({
      page,
    }) => {
      await expect(page.getByTestId('submode-tab-graph')).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      await page.getByTestId('submode-tab-tree').click();
      await expect(page.getByTestId('ontology-tree-view')).toBeVisible();
    });

    test('should display canvas element as graph container', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await expect(
        page.locator('.ontology-g6-container canvas').first()
      ).toBeVisible();
    });
  });

  test.describe('Graph States', () => {
    test('should show loading state while graph data is being fetched', async ({
      page,
    }) => {
      await expect(page.getByTestId('ontology-graph-loading')).toBeVisible({
        timeout: 5000,
      });
    });

    test('should hide loading state after data is loaded', async ({ page }) => {
      await waitForGraphLoaded(page);
    });

    test('should display stats in header after graph loads', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await expect(page.getByTestId('ontology-explorer-stats')).toBeVisible();
    });

    test('should not show empty state when glossary terms exist', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await expect(page.getByTestId('ontology-graph-empty')).not.toBeVisible();
    });
  });

  test.describe('Control Buttons', () => {
    test('should execute fit-view without errors', async ({ page }) => {
      await waitForGraphLoaded(page);
      await page.getByTestId('fit-view').click();
      await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    });

    test('should execute zoom-in without errors', async ({ page }) => {
      await waitForGraphLoaded(page);
      await page.getByTestId('zoom-in').click();
      await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    });

    test('should execute zoom-out without errors', async ({ page }) => {
      await waitForGraphLoaded(page);
      await page.getByTestId('zoom-out').click();
      await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    });

    test('should disable refresh button while graph is loading', async ({
      page,
    }) => {
      await expect(page.getByTestId('ontology-graph-loading')).toBeVisible({
        timeout: 5000,
      });
      await expect(page.getByTestId('refresh')).toBeDisabled();
    });

    test('should fire a glossaryTerms API request when refresh is clicked', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);

      const termsRequest = page.waitForResponse(
        (res) =>
          res.url().includes('/api/v1/glossaryTerms') &&
          res.request().method() === 'GET',
        { timeout: 30000 }
      );
      await page.getByTestId('refresh').click();
      await termsRequest;
      await waitForGraphLoaded(page);
    });

    test('should repopulate data-node-positions after fit-view', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await applyGlossaryFilter(page, glossary.responseData.id);
      await waitForGraphLoaded(page);

      await page.getByTestId('zoom-in').click();
      await page.getByTestId('zoom-in').click();

      await page.getByTestId('fit-view').click();

      const positions = await readNodePositions(page);
      expect(Object.keys(positions).length).toBeGreaterThan(0);
    });
  });

  test.describe('Graph Search', () => {
    test('should accept a search query in the graph search input', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      const searchInput = page.getByTestId('ontology-graph-search');
      await searchInput.fill(term1.data.name);
      await expect(searchInput).toHaveValue(term1.data.name);
    });

    test('should clear the search query', async ({ page }) => {
      await waitForGraphLoaded(page);
      const searchInput = page.getByTestId('ontology-graph-search');
      await searchInput.fill(term1.data.name);
      await searchInput.clear();
      await expect(searchInput).toHaveValue('');
    });

    test('should clear the search query by emptying the input', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      const searchInput = page.getByTestId('ontology-graph-search');
      await searchInput.fill('test-search');
      await searchInput.clear();
      await expect(searchInput).toHaveValue('');
    });
  });

  test.describe('Term Click - Concept Inspector', () => {
    test('clicking a term node opens the concept inspector without a permission error', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await applyGlossaryFilter(page, glossary.responseData.id);
      await waitForGraphLoaded(page);
      await page.getByTestId('fit-view').click();

      await clickFirstGraphNode(page);

      await expect(
        page.getByTestId('ontology-authoring-inspector')
      ).toBeVisible();

      await expect(
        page.getByTestId('permission-error-placeholder')
      ).not.toBeVisible();
    });

    test('concept inspector displays relationships for a connected term', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await applyGlossaryFilter(page, glossary.responseData.id);
      await waitForGraphLoaded(page);
      await page.getByTestId('fit-view').click();

      await clickFirstGraphNode(page);

      await expect(page.getByTestId('authoring-relationships')).toBeVisible();
    });

    test('concept inspector shows the related term by name', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await applyGlossaryFilter(page, glossary.responseData.id);
      await waitForGraphLoaded(page);
      await page.getByTestId('fit-view').click();

      await clickGraphNode(page, term1.responseData.id);

      const relatedName =
        term2.responseData.displayName ?? term2.responseData.name;
      await expect(
        page.getByTestId('ontology-authoring-inspector').getByText(relatedName)
      ).toBeVisible();
    });
  });

  test.describe('Tree View', () => {
    test('should render the selected glossary as a tree', async ({ page }) => {
      await waitForGraphLoaded(page);
      await applyGlossaryFilter(page, glossary.responseData.id);
      await waitForGraphLoaded(page);
      await page.getByTestId('submode-tab-tree').click();
      await expect(page.getByTestId('ontology-tree-view')).toBeVisible();
    });
  });

  test.describe('Search Filtering', () => {
    test('should show only the matching node and its neighbours when a search query is entered', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await applyGlossaryFilter(page, glossary.responseData.id);
      await waitForGraphLoaded(page);

      const searchInput = page.getByTestId('ontology-graph-search');
      await searchInput.fill(term1.data.name);

      const positions = await readNodePositions(page);
      expect(
        positions,
        'term1 must be visible — it matches the search query'
      ).toHaveProperty(term1.responseData.id);
      expect(
        positions,
        'term2 must be visible — it is a direct neighbour of term1'
      ).toHaveProperty(term2.responseData.id);
    });

    test('should restore all nodes when the search query is cleared', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await applyGlossaryFilter(page, glossary.responseData.id);
      await waitForGraphLoaded(page);

      const searchInput = page.getByTestId('ontology-graph-search');
      await searchInput.fill(term1.data.name);
      // Search does not re-run layout, so read existing positions without clearing.
      const filteredCount = Object.keys(await readNodePositions(page)).length;

      await searchInput.clear();
      const restoredCount = Object.keys(await readNodePositions(page)).length;
      expect(restoredCount).toBeGreaterThanOrEqual(filteredCount);
    });

    test('should show empty graph state when the search matches nothing', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      const searchInput = page.getByTestId('ontology-graph-search');
      await searchInput.fill('__nonexistent_term_xyz__');

      await expect(
        page.getByTestId('ontology-graph-search-empty')
      ).toBeVisible();
      await expect(
        page.locator('.ontology-g6-container canvas').first()
      ).not.toBeAttached();
    });

    test('should recover from a no-match state when the search is cleared', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      const searchInput = page.getByTestId('ontology-graph-search');
      await searchInput.fill('__nonexistent_term_xyz__');
      await expect(
        page.getByTestId('ontology-graph-search-empty')
      ).toBeVisible();

      await searchInput.clear();
      await expect(
        page.getByTestId('ontology-graph-search-empty')
      ).not.toBeVisible();
    });
  });

  test.describe('Import and Export', () => {
    test('should open and dismiss the ontology transfer modal', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await page.getByTestId('ontology-import-export-trigger').click();
      await expect(
        page.getByTestId('ontology-import-export-modal')
      ).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(
        page.getByTestId('ontology-import-export-modal')
      ).not.toBeVisible();
    });
  });

  test.describe('Multiple Relations Between Same Term Pair', () => {
    test('renders a distinct edge for each relation type between the same pair', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await applyGlossaryFilter(page, multiRelGlossary.responseData.id);
      await waitForGraphLoaded(page);

      const edges = await readGraphEdges(page);
      const fromId = multiRelTermA.responseData.id;
      const toId = multiRelTermB.responseData.id;

      const edgesForPair = edges.filter(
        (e) =>
          (e.from === fromId && e.to === toId) ||
          (e.from === toId && e.to === fromId)
      );

      const allRelationTypes = new Set<string>();
      edgesForPair.forEach((edge) => {
        allRelationTypes.add(edge.relationType);
        if (edge.inverseRelationType) {
          allRelationTypes.add(edge.inverseRelationType);
        }
      });

      expect(allRelationTypes.has('relatedTo')).toBe(true);
      expect(
        allRelationTypes.has('partOf') || allRelationTypes.has('hasPart')
      ).toBe(true);
    });
  });
});
