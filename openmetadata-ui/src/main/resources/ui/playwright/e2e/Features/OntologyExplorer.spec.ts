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
  clickFirstGraphNode,
  createApiContext,
  deleteEntities,
  disposeApiContext,
  navigateToOntologyExplorer,
  readNodePositions,
  waitForGraphLoaded,
} from '../../utils/ontologyExplorer';

test.use({ storageState: 'playwright/.auth/admin.json' });

const glossary = new Glossary();
const term1 = new GlossaryTerm(glossary);
const term2 = new GlossaryTerm(glossary);

const glossary2 = new Glossary();
const term3 = new GlossaryTerm(glossary2);
const term4 = new GlossaryTerm(glossary2);

test.describe('Ontology Explorer', () => {
  test.beforeAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);

    await glossary.create(apiContext);
    await term1.create(apiContext);
    await term2.create(apiContext);
    await glossary2.create(apiContext);
    await term3.create(apiContext);
    await term4.create(apiContext);

    await addTermRelation(apiContext, term1, term2, 'relatedTo');

    await disposeApiContext(page, apiContext);
  });

  test.afterAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);
    await deleteEntities(
      apiContext,
      term1,
      term2,
      glossary,
      term3,
      term4,
      glossary2
    );
    await disposeApiContext(page, apiContext);
  });

  test.beforeEach(async ({ page }) => {
    await navigateToOntologyExplorer(page);
  });

  test.describe('Navigation', () => {
    test('should navigate to ontology explorer via sidebar and load page', async ({
      page,
    }) => {
      await expect(page.getByTestId('ontology-explorer')).toBeVisible();
      await expect(page).toHaveURL(/.*ontology.*/);
    });
  });

  test.describe('Page Layout', () => {
    test('should display the header section with title', async ({ page }) => {
      await expect(page.getByTestId('ontology-explorer-header')).toBeVisible();
      await expect(page.getByTestId('heading')).toContainText(
        'Ontology Explorer'
      );
    });

    test('should display filter toolbar with View Mode label', async ({
      page,
    }) => {
      await expect(page.getByText('View Mode:')).toBeVisible();
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

    test('should display isolated nodes toggle', async ({ page }) => {
      await expect(page.getByTestId('ontology-isolated-toggle')).toBeVisible();
    });

    test('should display settings button', async ({ page }) => {
      await expect(page.getByTestId('ontology-graph-settings')).toBeVisible();
    });

    test('should display exploration mode tabs (Model and Data)', async ({
      page,
    }) => {
      await expect(page.getByRole('tab', { name: 'Model' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Data' })).toBeVisible();
    });

    test('should display view mode select with Overview, Hierarchy and Cross Glossary options', async ({
      page,
    }) => {
      const viewModeSelect = page.getByTestId('view-mode-select');
      await expect(viewModeSelect).toBeVisible();
      await viewModeSelect.click();
      await expect(
        page.getByRole('option', { name: 'Overview' })
      ).toBeVisible();
      await expect(
        page.getByRole('option', { name: 'Hierarchy' })
      ).toBeVisible();
      await expect(
        page.getByRole('option', { name: 'Cross Glossary' })
      ).toBeVisible();
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
      await expect(
        page.getByTestId('ontology-explorer-stats-item')
      ).toBeVisible({ timeout: 10000 });
    });

    test('should not show empty state when glossary terms exist', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await expect(page.getByTestId('ontology-graph-empty')).not.toBeVisible();
    });

    test('should show empty state when active filter yields no visible nodes', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await applyGlossaryFilter(page, glossary2.responseData.id);
      await waitForGraphLoaded(page);
      await page.getByTestId('ontology-isolated-toggle').click();

      await expect(page.getByTestId('ontology-graph-empty')).toBeVisible();
    });

    test('should show empty state when relation type filter removes all edges and no isolated nodes remain', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await applyGlossaryFilter(page, glossary.responseData.id);
      await waitForGraphLoaded(page);
      await applyRelationTypeFilter(page, 'Synonym');

      await expect(page.getByTestId('ontology-graph-empty')).toBeVisible();
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
        { timeout: 15000 }
      );
      await page.getByTestId('refresh').click();
      await termsRequest;
      await waitForGraphLoaded(page);
    });

    test('should fire glossaryTerms/assets/counts API when refresh is clicked in Data mode', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await page.getByRole('tab', { name: 'Data' }).click();
      await waitForGraphLoaded(page);

      const assetCountsRequest = page.waitForResponse(
        (res) =>
          res.url().includes('/api/v1/glossaryTerms/assets/counts') &&
          res.request().method() === 'GET',
        { timeout: 15000 }
      );
      await page.getByTestId('refresh').click();
      await assetCountsRequest;
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
      const searchInput = page
        .getByTestId('ontology-graph-search')
        .locator('input');
      await searchInput.fill(term1.data.name);
      await expect(searchInput).toHaveValue(term1.data.name);
    });

    test('should clear the search query', async ({ page }) => {
      await waitForGraphLoaded(page);
      const searchInput = page
        .getByTestId('ontology-graph-search')
        .locator('input');
      await searchInput.fill(term1.data.name);
      await searchInput.clear();
      await expect(searchInput).toHaveValue('');
    });

    test('should clear the search query by emptying the input', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      const searchInput = page
        .getByTestId('ontology-graph-search')
        .locator('input');
      await searchInput.fill('test-search');
      await searchInput.clear();
      await expect(searchInput).toHaveValue('');
    });
  });

  test.describe('Settings Panel', () => {
    test('should open settings panel when settings button is clicked', async ({
      page,
    }) => {
      await page.getByTestId('ontology-graph-settings').click();
      await expect(page.getByTestId('graph-settings-close')).toBeVisible();
      await expect(page.getByText('Graph Settings')).toBeVisible();
    });

    test('should close settings panel via close button', async ({ page }) => {
      await page.getByTestId('ontology-graph-settings').click();
      await expect(page.getByTestId('graph-settings-close')).toBeVisible();
      await page.getByTestId('graph-settings-close').click();
      await expect(page.getByTestId('graph-settings-close')).not.toBeVisible();
    });

    test('should close settings panel when clicking outside', async ({
      page,
    }) => {
      await page.getByTestId('ontology-graph-settings').click();
      await expect(page.getByTestId('graph-settings-close')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('graph-settings-close')).not.toBeVisible();
    });

    test('should display layout options in settings panel', async ({
      page,
    }) => {
      await page.getByTestId('ontology-graph-settings').click();
      await expect(page.getByText('Layout')).toBeVisible();
    });

    test('should display edge labels toggle in settings panel', async ({
      page,
    }) => {
      await page.getByTestId('ontology-graph-settings').click();
      await expect(page.getByText('Edge Labels')).toBeVisible();
    });

    test('should toggle edge labels off and back on', async ({ page }) => {
      await page.getByTestId('ontology-graph-settings').click();
      await expect(page.getByTestId('graph-settings-close')).toBeVisible();

      const toggle = page.getByTestId('graph-settings-edge-labels-toggle');
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveAttribute('data-selected', 'true');

      await toggle.click();
      await expect(toggle).not.toHaveAttribute('data-selected', 'true');

      await toggle.click();
      await expect(toggle).toHaveAttribute('data-selected', 'true');
    });

    test('should change layout to Circular and back to Hierarchical', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await page.getByTestId('ontology-graph-settings').click();
      await expect(page.getByTestId('graph-settings-close')).toBeVisible();

      const layoutSelect = page.getByTestId('graph-settings-layout-select');
      await layoutSelect.click();
      await expect(
        page.getByRole('option', { name: 'Circular' })
      ).toBeVisible();
      await page.getByRole('option', { name: 'Circular' }).click();
      await expect(layoutSelect).toContainText('Circular');
      await waitForGraphLoaded(page);

      await layoutSelect.click();
      await page.getByRole('option', { name: 'Hierarchical' }).click();
      await expect(layoutSelect).toContainText('Hierarchical');
    });
  });

  test.describe('View Mode - Filter Toolbar Select', () => {
    test('should have Overview selected by default', async ({ page }) => {
      await expect(page.getByTestId('view-mode-select')).toContainText(
        'Overview'
      );
    });

    test('should switch to Hierarchy view mode', async ({ page }) => {
      await waitForGraphLoaded(page);
      await page.getByTestId('view-mode-select').click();
      await page.getByRole('option', { name: 'Hierarchy' }).click();
      await expect(page.getByTestId('view-mode-select')).toContainText(
        'Hierarchy'
      );
    });

    test('should switch to Cross Glossary view mode', async ({ page }) => {
      await waitForGraphLoaded(page);
      await page.getByTestId('view-mode-select').click();
      await page.getByRole('option', { name: 'Cross Glossary' }).click();
      await expect(page.getByTestId('view-mode-select')).toContainText(
        'Cross Glossary'
      );
    });

    test('should return to Overview from Hierarchy', async ({ page }) => {
      await waitForGraphLoaded(page);
      await page.getByTestId('view-mode-select').click();
      await page.getByRole('option', { name: 'Hierarchy' }).click();
      await page.getByTestId('view-mode-select').click();
      await page.getByRole('option', { name: 'Overview' }).click();
      await expect(page.getByTestId('view-mode-select')).toContainText(
        'Overview'
      );
    });

    test('should update selected option when view mode changes from Overview', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await page.getByTestId('view-mode-select').click();
      await page.getByRole('option', { name: 'Hierarchy' }).click();
      await expect(page.getByTestId('view-mode-select')).toContainText(
        'Hierarchy'
      );
    });
  });

  test.describe('Isolated Nodes Filter', () => {
    test('should toggle isolated nodes off and back on', async ({ page }) => {
      const toggle = page.getByTestId('ontology-isolated-toggle');
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveAttribute('data-selected', 'true');

      await toggle.click();
      await expect(toggle).not.toHaveAttribute('data-selected', 'true');

      await toggle.click();
      await expect(toggle).toHaveAttribute('data-selected', 'true');
    });

    test('should remove isolated nodes from stats when toggled off', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await applyGlossaryFilter(page, glossary2.responseData.id);
      await waitForGraphLoaded(page);

      await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
        '2 Terms'
      );

      await page.getByTestId('ontology-isolated-toggle').click();

      await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
        '0 Terms'
      );
    });
  });

  test.describe('Clear All Filters', () => {
    test('should show and clear all filters', async ({ page }) => {
      await waitForGraphLoaded(page);
      await applyGlossaryFilter(page, glossary.responseData.id);
      const clearAll = page.getByTestId('ontology-clear-all-btn');
      await expect(clearAll).toBeVisible();
      await clearAll.click();
      await expect(clearAll).not.toBeVisible();
    });

    test('should show clear all when both glossary and relation type filters are active', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);

      await applyGlossaryFilter(page, glossary.responseData.id);
      await waitForGraphLoaded(page);

      await applyRelationTypeFilter(page, 'Synonym');

      const clearAll = page.getByTestId('ontology-clear-all-btn');
      await expect(clearAll).toBeVisible();

      await clearAll.click();
      await expect(clearAll).not.toBeVisible();

      await expect(page.getByTestId('view-mode-select')).toContainText(
        'Overview'
      );
    });
  });

  test.describe('Export Graph', () => {
    test('should show export options', async ({ page }) => {
      await waitForGraphLoaded(page);
      await page.getByTestId('ontology-export-graph').click();
      await expect(page.getByText('PNG', { exact: true })).toBeVisible();
      await expect(page.getByText('SVG', { exact: true })).toBeVisible();
    });
  });

  test.describe('Glossary Filter Dropdown', () => {
    test('should display Glossary filter label', async ({ page }) => {
      await expect(page.getByTestId('search-dropdown-Glossary')).toBeVisible();
    });

    test('should open glossary dropdown and show glossary options', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await page.getByTestId('search-dropdown-Glossary').click();
      await expect(page.getByTestId('drop-down-menu')).toBeVisible();
      await expect(page.getByTestId(glossary.responseData.id)).toBeVisible();
      await page.getByTestId('close-btn').click();
    });

    test('should filter the graph to the selected glossary (stats match canvas data)', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await applyGlossaryFilter(page, glossary.responseData.id);
      await waitForGraphLoaded(page);

      const stats = page.getByTestId('ontology-explorer-stats');
      await expect(stats).toContainText('2 Terms');
      await expect(stats).toContainText('1 Relations');
    });
  });

  test.describe('Relation Type Filter Dropdown', () => {
    test('should display Relationship Type filter label', async ({ page }) => {
      await expect(
        page.getByTestId('search-dropdown-Relationship Type')
      ).toBeVisible();
    });

    test('should open relation type dropdown and show options', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await page.getByTestId('search-dropdown-Relationship Type').click();
      await expect(page.getByTestId('drop-down-menu')).toBeVisible();
      await page.getByTestId('close-btn').click();
    });

    test('should filter graph edges by relation type (stats match canvas data)', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await applyGlossaryFilter(page, glossary.responseData.id);
      await waitForGraphLoaded(page);

      const stats = page.getByTestId('ontology-explorer-stats');
      await expect(stats).toContainText('1 Relations');

      await applyRelationTypeFilter(page, 'Synonym');
      await expect(stats).toContainText('0 Relations');

      await applyRelationTypeFilter(page, 'Synonym');
      await expect(stats).toContainText('1 Relations');
    });
  });

  test.describe('Exploration Mode Switching', () => {
    test('should have Model mode selected by default', async ({ page }) => {
      await expect(page.getByRole('tab', { name: 'Model' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });

    test('should switch to Data exploration mode', async ({ page }) => {
      await waitForGraphLoaded(page);
      await page.getByRole('tab', { name: 'Data' }).click();
      await expect(page.getByRole('tab', { name: 'Data' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });

    test('should switch back to Model exploration mode', async ({ page }) => {
      await waitForGraphLoaded(page);
      await page.getByRole('tab', { name: 'Data' }).click();
      await waitForGraphLoaded(page);
      await page.getByRole('tab', { name: 'Model' }).click();
      await expect(page.getByRole('tab', { name: 'Model' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });

    test('should show graph stats after switching to Data mode', async ({
      page,
    }) => {
      test.slow();
      await waitForGraphLoaded(page);
      await applyGlossaryFilter(page, glossary.responseData.id);
      await waitForGraphLoaded(page);

      await page.getByRole('tab', { name: 'Data' }).click();
      await waitForGraphLoaded(page);

      await expect(page.getByTestId('ontology-explorer-stats')).toBeVisible();
    });

    test('clicking a term node in Data mode opens the entity summary panel', async ({
      page,
    }) => {
      test.slow();
      await waitForGraphLoaded(page);

      await page.getByRole('tab', { name: 'Data' }).click();
      await waitForGraphLoaded(page);
      await page.getByTestId('fit-view').click();

      await clickFirstGraphNode(page);

      await expect(
        page.getByTestId('entity-summary-panel-container')
      ).toBeVisible();
      await expect(
        page.getByTestId('permission-error-placeholder')
      ).not.toBeVisible();
    });

    test('should retain glossary filter when switching between Model and Data modes', async ({
      page,
    }) => {
      test.slow();
      await waitForGraphLoaded(page);
      await applyGlossaryFilter(page, glossary.responseData.id);
      await waitForGraphLoaded(page);

      const stats = page.getByTestId('ontology-explorer-stats');
      await expect(stats).toContainText('2 Terms');

      await page.getByRole('tab', { name: 'Data' }).click();
      await waitForGraphLoaded(page);
      await expect(page.getByTestId('ontology-clear-all-btn')).toBeVisible();

      await page.getByRole('tab', { name: 'Model' }).click();
      await waitForGraphLoaded(page);
      await expect(stats).toContainText('2 Terms');
    });
  });

  test.describe('Term Click - Entity Summary Panel', () => {
    test('clicking a term node opens the entity summary panel without a permission error', async ({
      page,
    }) => {
      test.slow();
      await waitForGraphLoaded(page);
      await applyGlossaryFilter(page, glossary.responseData.id);
      await waitForGraphLoaded(page);
      await page.getByTestId('fit-view').click();

      await clickFirstGraphNode(page);

      await expect(
        page.getByTestId('entity-summary-panel-container')
      ).toBeVisible();

      await expect(
        page.getByTestId('permission-error-placeholder')
      ).not.toBeVisible();
    });

    test('entity panel should display outgoing or incoming relations section for a connected term', async ({
      page,
    }) => {
      test.slow();
      await waitForGraphLoaded(page);
      await applyGlossaryFilter(page, glossary.responseData.id);
      await waitForGraphLoaded(page);
      await page.getByTestId('fit-view').click();

      await clickFirstGraphNode(page);

      await expect(
        page.getByTestId('entity-summary-panel-container')
      ).toBeVisible();

      await page.getByTestId('ontology-relations-tab').click();

      const outgoing = page.getByTestId('outgoing-relation-label');
      const incoming = page.getByTestId('incoming-relation-label');

      await expect(
        outgoing.or(incoming),
        'Expected the selected term to have at least one outgoing or incoming relation'
      ).toBeVisible({ timeout: 5000 });
    });

    test('entity panel Relations tab should show the related term by name', async ({
      page,
    }) => {
      test.slow();
      await waitForGraphLoaded(page);
      await applyGlossaryFilter(page, glossary.responseData.id);
      await waitForGraphLoaded(page);
      await page.getByTestId('fit-view').click();

      const positions = await readNodePositions(page);
      const term1Pos = positions[term1.responseData.id];

      expect(
        term1Pos,
        'term1 node must be present in graph positions'
      ).toBeDefined();
      await page.mouse.click(term1Pos.x, term1Pos.y);

      await expect(
        page.getByTestId('entity-summary-panel-container')
      ).toBeVisible();

      await page.getByTestId('ontology-relations-tab').click();

      const outgoing = page.getByTestId('outgoing-relation-label');
      const incoming = page.getByTestId('incoming-relation-label');
      await expect(outgoing.or(incoming)).toBeVisible({ timeout: 5000 });

      const relatedName =
        term2.responseData.displayName ?? term2.responseData.name;
      await expect(
        page
          .getByTestId('entity-summary-panel-container')
          .getByText(relatedName)
      ).toBeVisible();
    });
  });

  test.describe('Hierarchy View', () => {
    test('should show hierarchy empty state when no hierarchical relations', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await applyGlossaryFilter(page, glossary.responseData.id);
      await waitForGraphLoaded(page);
      await page.getByTestId('view-mode-select').click();
      await page.getByRole('option', { name: 'Hierarchy' }).click();
      await expect(
        page.getByTestId('ontology-graph-hierarchy-empty')
      ).toBeVisible();
    });
  });

  test.describe('Search Filtering', () => {
    test('should show only the matching node and its neighbours when a search query is entered', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await applyGlossaryFilter(page, glossary.responseData.id);
      await waitForGraphLoaded(page);

      const searchInput = page
        .getByTestId('ontology-graph-search')
        .locator('input');
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

      const searchInput = page
        .getByTestId('ontology-graph-search')
        .locator('input');
      await searchInput.fill(term1.data.name);
      const filteredCount = Object.keys(await readNodePositions(page)).length;

      await searchInput.clear();
      const restoredCount = Object.keys(await readNodePositions(page)).length;
      expect(restoredCount).toBeGreaterThanOrEqual(filteredCount);
    });

    test('should show empty graph state when the search matches nothing', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      const searchInput = page
        .getByTestId('ontology-graph-search')
        .locator('input');
      await searchInput.fill('__nonexistent_term_xyz__');

      await expect(page.getByTestId('ontology-graph-empty')).toBeVisible();
      await expect(
        page.locator('.ontology-g6-container canvas').first()
      ).not.toBeAttached();
    });

    test('should recover from a no-match state when the search is cleared', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      const searchInput = page
        .getByTestId('ontology-graph-search')
        .locator('input');
      await searchInput.fill('__nonexistent_term_xyz__');
      await expect(page.getByTestId('ontology-graph-empty')).toBeVisible();

      await searchInput.clear();
      await expect(page.getByTestId('ontology-graph-empty')).not.toBeVisible();
    });
  });

  test.describe('Multi-select Glossary Filter', () => {
    test('should show terms from both glossaries when both are selected', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);

      await page.getByTestId('search-dropdown-Glossary').click();
      await page.getByTestId(glossary.responseData.id).click();
      await page.getByTestId(glossary2.responseData.id).click();
      await page.getByTestId('update-btn').click();
      await waitForGraphLoaded(page);

      await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
        '4 Terms'
      );
    });

    test('should show only one glossary terms when one is deselected', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);

      await page.getByTestId('search-dropdown-Glossary').click();
      await page.getByTestId(glossary.responseData.id).click();
      await page.getByTestId(glossary2.responseData.id).click();
      await page.getByTestId('update-btn').click();
      await waitForGraphLoaded(page);

      await page.getByTestId('search-dropdown-Glossary').click();
      await page.getByTestId(glossary2.responseData.id).click();
      await page.getByTestId('update-btn').click();
      await waitForGraphLoaded(page);

      await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
        '2 Terms'
      );
    });
  });

  test.describe('Multi-select Relation Type Filter', () => {
    test('should filter to only matching relation type when Synonym is selected', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await applyGlossaryFilter(page, glossary.responseData.id);
      await waitForGraphLoaded(page);

      await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
        '1 Relations'
      );

      await applyRelationTypeFilter(page, 'Synonym');

      await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
        '0 Relations'
      );
    });

    test('should show relatedTo edge when Related To filter is selected', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await applyGlossaryFilter(page, glossary.responseData.id);
      await waitForGraphLoaded(page);

      await applyRelationTypeFilter(page, 'Related To');

      await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
        '1 Relations'
      );
    });
  });

  test.describe('View Mode Disabled in Data Mode', () => {
    test('should disable the view mode select when Data tab is active', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await page.getByRole('tab', { name: 'Data' }).click();
      await waitForGraphLoaded(page);

      await expect(page.getByTestId('view-mode-select')).toHaveAttribute(
        'data-disabled',
        'true'
      );
    });

    test('should re-enable view mode select when switching back to Model tab', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await page.getByRole('tab', { name: 'Data' }).click();
      await waitForGraphLoaded(page);
      await page.getByRole('tab', { name: 'Model' }).click();

      await expect(page.getByTestId('view-mode-select')).not.toHaveAttribute(
        'data-disabled',
        'true'
      );
    });
  });

  test.describe('Export Downloads', () => {
    test('should trigger PNG download when PNG option is clicked', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await page.getByTestId('ontology-export-graph').click();

      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByText('PNG', { exact: true }).click(),
      ]);

      expect(download.suggestedFilename()).toMatch(/\.png$/i);
    });

    test('should trigger SVG download when SVG option is clicked', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await page.getByTestId('ontology-export-graph').click();

      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByText('SVG', { exact: true }).click(),
      ]);

      expect(download.suggestedFilename()).toMatch(/\.svg$/i);
    });
  });

  test.describe('Entity Panel Close', () => {
    test('should close entity summary panel when close button is clicked', async ({
      page,
    }) => {
      test.slow();
      await waitForGraphLoaded(page);
      await applyGlossaryFilter(page, glossary.responseData.id);
      await waitForGraphLoaded(page);
      await page.getByTestId('fit-view').click();

      await clickFirstGraphNode(page);

      await expect(
        page.getByTestId('entity-summary-panel-container')
      ).toBeVisible();
      await page.getByTestId('drawer-close-icon').click();
      await expect(
        page.getByTestId('entity-summary-panel-container')
      ).not.toBeVisible();
    });
  });

  test.describe('Filter Combinations', () => {
    test('should retain relation type filter after glossary filter is cleared and re-applied', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await applyGlossaryFilter(page, glossary.responseData.id);
      await waitForGraphLoaded(page);

      await applyRelationTypeFilter(page, 'Synonym');

      await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
        '0 Relations'
      );

      await page.getByTestId('search-dropdown-Glossary').click();
      await page.getByTestId(glossary.responseData.id).click();
      await page.getByTestId('update-btn').click();
      await waitForGraphLoaded(page);

      await applyGlossaryFilter(page, glossary.responseData.id);
      await waitForGraphLoaded(page);

      await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
        '0 Relations'
      );
    });
  });

  test.describe('Stats Accuracy', () => {
    test('should show 2 terms and 1 relation for the test glossary', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await applyGlossaryFilter(page, glossary.responseData.id);
      await waitForGraphLoaded(page);

      const stats = page.getByTestId('ontology-explorer-stats');
      await expect(stats).toContainText('2 Terms');
      await expect(stats).toContainText('1 Relations');
    });

    test('should show 2 terms and 0 relations for glossary2', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await applyGlossaryFilter(page, glossary2.responseData.id);
      await waitForGraphLoaded(page);

      const stats = page.getByTestId('ontology-explorer-stats');
      await expect(stats).toContainText('2 Terms');
      await expect(stats).toContainText('0 Relations');
    });
  });

  test.describe('Glossary Dropdown Search', () => {
    test('should filter glossary options by name in the dropdown search', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await page.getByTestId('search-dropdown-Glossary').click();
      await expect(page.getByTestId('drop-down-menu')).toBeVisible();

      const searchInput = page
        .getByTestId('drop-down-menu')
        .locator('input[type="text"]');
      await searchInput.fill(glossary.data.displayName ?? glossary.data.name);

      await expect(page.getByTestId(glossary.responseData.id)).toBeVisible();

      await page.getByTestId('close-btn').click();
    });

    test('should show no results when search does not match any glossary', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await page.getByTestId('search-dropdown-Glossary').click();
      await expect(page.getByTestId('drop-down-menu')).toBeVisible();

      const searchInput = page
        .getByTestId('drop-down-menu')
        .locator('input[type="text"]');
      await searchInput.fill('__nonexistent_glossary_xyz__');

      await expect(
        page.getByTestId(glossary.responseData.id)
      ).not.toBeVisible();

      await page.getByTestId('close-btn').click();
    });
  });
});
