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

import { expect, Page, test } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import {
  getAuthContext,
  getToken,
  redirectToHomePage,
} from '../../utils/common';
import { sidebarClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

const glossary = new Glossary();
const term1 = new GlossaryTerm(glossary);
const term2 = new GlossaryTerm(glossary);

const glossary2 = new Glossary();
const term3 = new GlossaryTerm(glossary2);
const term4 = new GlossaryTerm(glossary2);

async function applyGlossaryFilter(page: Page, glossaryId: string) {
  await page.getByTestId('search-dropdown-Glossary').click();
  await page.getByTestId(glossaryId).click();
  await page.getByTestId('update-btn').click();
}

async function navigateToOntologyExplorer(page: Page) {
  await redirectToHomePage(page);
  const glossaryResponse = page.waitForResponse('/api/v1/glossaries*');
  await sidebarClick(page, SidebarItem.ONTOLOGY_EXPLORER);
  await glossaryResponse;
}

async function waitForGraphLoaded(page: Page) {
  await expect(page.getByTestId('ontology-graph-loading')).not.toBeVisible({
    timeout: 15000,
  });
}

async function readNodePositions(
  page: Page
): Promise<Record<string, { x: number; y: number }>> {
  await page.waitForFunction(
    () => {
      const el = document.querySelector<HTMLElement>('.ontology-g6-container');
      const pos = el?.dataset.nodePositions;
      if (!pos) {
        return false;
      }
      try {
        return Object.keys(JSON.parse(pos)).length > 0;
      } catch {
        return false;
      }
    },
    { timeout: 10000 }
  );

  return page
    .locator('.ontology-g6-container')
    .evaluate(
      (el: HTMLElement) =>
        JSON.parse(el.dataset.nodePositions ?? '{}') as Record<
          string,
          { x: number; y: number }
        >
    );
}

async function clickFirstGraphNode(page: Page): Promise<void> {
  const positions = await readNodePositions(page);
  const firstPos = Object.values(positions)[0];
  await page.mouse.click(firstPos.x, firstPos.y);
}

test.describe('Ontology Explorer', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({
      storageState: 'playwright/.auth/admin.json',
    });
    await redirectToHomePage(page);
    const token = await getToken(page);
    const apiContext = await getAuthContext(token);

    await glossary.create(apiContext);
    await term1.create(apiContext);
    await term2.create(apiContext);

    await glossary2.create(apiContext);
    await term3.create(apiContext);
    await term4.create(apiContext);

    await term1.patch(apiContext, [
      {
        op: 'add',
        path: '/relatedTerms/0',
        value: {
          relationType: 'relatedTo',
          term: {
            id: term2.responseData.id,
            type: 'glossaryTerm',
            name: term2.responseData.name,
            displayName: term2.responseData.displayName,
            fullyQualifiedName: term2.responseData.fullyQualifiedName,
          },
        },
      },
    ]);

    await apiContext.dispose();
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage({
      storageState: 'playwright/.auth/admin.json',
    });
    await redirectToHomePage(page);
    const token = await getToken(page);
    const apiContext = await getAuthContext(token);

    if (term1.responseData?.id) {
      await term1.delete(apiContext);
    }
    if (term2.responseData?.id) {
      await term2.delete(apiContext);
    }
    if (glossary.responseData?.id) {
      await glossary.delete(apiContext);
    }

    if (term3.responseData?.id) {
      await term3.delete(apiContext);
    }
    if (term4.responseData?.id) {
      await term4.delete(apiContext);
    }
    if (glossary2.responseData?.id) {
      await glossary2.delete(apiContext);
    }

    await apiContext.dispose();
    await page.close();
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

      await page.getByTestId('search-dropdown-Relationship Type').click();
      await page.getByTestId('drop-down-menu').getByText('Synonym').click();
      await page.getByTestId('update-btn').click();
      await waitForGraphLoaded(page);

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

      await page.getByTestId('search-dropdown-Relationship Type').click();
      await page.getByTestId('drop-down-menu').getByText('Synonym').click();
      await page.getByTestId('update-btn').click();
      await waitForGraphLoaded(page);
      await expect(stats).toContainText('0 Relations');

      await page.getByTestId('search-dropdown-Relationship Type').click();
      await page.getByTestId('drop-down-menu').getByText('Synonym').click();
      await page.getByTestId('update-btn').click();
      await waitForGraphLoaded(page);
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

      // Section label only renders when rows.length > 0, so its visibility already
      // implies a non-zero count. Confirm the related term (term2) appears by name.
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

  test.describe('Search Graph Overlay', () => {
    test('should show overlay when search query is entered', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      const searchInput = page
        .getByTestId('ontology-graph-search')
        .locator('input');
      await searchInput.fill(term1.data.name);
      await expect(page.getByTestId('ontology-search-overlay')).toBeVisible();
    });

    test('should hide overlay when search query is cleared', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      const searchInput = page
        .getByTestId('ontology-graph-search')
        .locator('input');
      await searchInput.fill(term1.data.name);
      await expect(page.getByTestId('ontology-search-overlay')).toBeVisible();
      await searchInput.clear();
      await expect(
        page.getByTestId('ontology-search-overlay')
      ).not.toBeVisible();
    });

    test('matched term node should remain rendered in the graph during search', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await applyGlossaryFilter(page, glossary.responseData.id);
      await waitForGraphLoaded(page);

      const searchInput = page
        .getByTestId('ontology-graph-search')
        .locator('input');
      await searchInput.fill(term1.data.name);
      await expect(page.getByTestId('ontology-search-overlay')).toBeVisible();

      const positions = await readNodePositions(page);

      expect(
        positions,
        'term1 node must still be present in node positions while its name is the active search query'
      ).toHaveProperty(term1.responseData.id);
    });

    test('should keep overlay visible and not crash when search term matches nothing', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      const searchInput = page
        .getByTestId('ontology-graph-search')
        .locator('input');
      await searchInput.fill('__nonexistent_term_xyz__');

      await expect(page.getByTestId('ontology-search-overlay')).toBeVisible();
      await expect(
        page.locator('.ontology-g6-container canvas').first()
      ).toBeVisible();
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

      await page.getByTestId('search-dropdown-Relationship Type').click();
      await page.getByTestId('drop-down-menu').getByText('Synonym').click();
      await page.getByTestId('update-btn').click();
      await waitForGraphLoaded(page);

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

      await page.getByTestId('search-dropdown-Relationship Type').click();
      await page.getByTestId('drop-down-menu').getByText('Related To').click();
      await page.getByTestId('update-btn').click();
      await waitForGraphLoaded(page);

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

      await page.getByTestId('search-dropdown-Relationship Type').click();
      await page.getByTestId('drop-down-menu').getByText('Synonym').click();
      await page.getByTestId('update-btn').click();
      await waitForGraphLoaded(page);

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

test.describe('Relation Sync with OntologyExplorer', () => {
  const syncGlossary = new Glossary();
  const syncTerm1 = new GlossaryTerm(syncGlossary);
  const syncTerm2 = new GlossaryTerm(syncGlossary);

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({
      storageState: 'playwright/.auth/admin.json',
    });
    await redirectToHomePage(page);
    const token = await getToken(page);
    const apiContext = await getAuthContext(token);

    await syncGlossary.create(apiContext);
    await syncTerm1.create(apiContext);
    await syncTerm2.create(apiContext);

    await apiContext.dispose();
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage({
      storageState: 'playwright/.auth/admin.json',
    });
    await redirectToHomePage(page);
    const token = await getToken(page);
    const apiContext = await getAuthContext(token);

    if (syncTerm1.responseData?.id) {
      await syncTerm1.delete(apiContext);
    }
    if (syncTerm2.responseData?.id) {
      await syncTerm2.delete(apiContext);
    }
    if (syncGlossary.responseData?.id) {
      await syncGlossary.delete(apiContext);
    }

    await apiContext.dispose();
    await page.close();
  });

  test('should reflect relation add and remove in the graph', async ({
    page,
  }) => {
    await navigateToOntologyExplorer(page);
    await waitForGraphLoaded(page);
    await applyGlossaryFilter(page, syncGlossary.responseData.id);

    await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
      /0\s*Relations?/i
    );

    const token = await getToken(page);
    const apiContext = await getAuthContext(token);
    await syncTerm1.patch(apiContext, [
      {
        op: 'add',
        path: '/relatedTerms/0',
        value: {
          relationType: 'synonym',
          term: {
            id: syncTerm2.responseData.id,
            type: 'glossaryTerm',
            name: syncTerm2.responseData.name,
            fullyQualifiedName: syncTerm2.responseData.fullyQualifiedName,
          },
        },
      },
    ]);
    await apiContext.dispose();

    await page.getByTestId('refresh').click();
    await waitForGraphLoaded(page);

    await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
      /1\s*Relations?/i
    );

    const apiContext2 = await getAuthContext(await getToken(page));
    await syncTerm1.patch(apiContext2, [
      { op: 'remove', path: '/relatedTerms/0' },
    ]);
    await apiContext2.dispose();

    await page.getByTestId('refresh').click();
    await waitForGraphLoaded(page);

    await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
      /0\s*Relations?/i
    );
  });
});

test.describe('Ontology Explorer - Hierarchy View', () => {
  const hierarchyGlossary = new Glossary();
  const parentTerm = new GlossaryTerm(hierarchyGlossary);
  const childTerm = new GlossaryTerm(hierarchyGlossary);

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({
      storageState: 'playwright/.auth/admin.json',
    });
    await redirectToHomePage(page);
    const token = await getToken(page);
    const apiContext = await getAuthContext(token);

    await hierarchyGlossary.create(apiContext);
    await parentTerm.create(apiContext);
    await childTerm.create(apiContext);

    await parentTerm.patch(apiContext, [
      {
        op: 'add',
        path: '/relatedTerms/0',
        value: {
          relationType: 'narrower',
          term: {
            id: childTerm.responseData.id,
            type: 'glossaryTerm',
            name: childTerm.responseData.name,
            fullyQualifiedName: childTerm.responseData.fullyQualifiedName,
          },
        },
      },
    ]);

    await apiContext.dispose();
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage({
      storageState: 'playwright/.auth/admin.json',
    });
    await redirectToHomePage(page);
    const token = await getToken(page);
    const apiContext = await getAuthContext(token);

    if (childTerm.responseData?.id) {
      await childTerm.delete(apiContext);
    }
    if (parentTerm.responseData?.id) {
      await parentTerm.delete(apiContext);
    }
    if (hierarchyGlossary.responseData?.id) {
      await hierarchyGlossary.delete(apiContext);
    }

    await apiContext.dispose();
    await page.close();
  });

  test('should display terms with narrower relation in Hierarchy view', async ({
    page,
  }) => {
    await navigateToOntologyExplorer(page);
    await waitForGraphLoaded(page);

    await applyGlossaryFilter(page, hierarchyGlossary.responseData.id);

    await page.getByTestId('view-mode-select').click();
    await page.getByRole('option', { name: 'Hierarchy' }).click();
    await waitForGraphLoaded(page);

    await expect(
      page.getByTestId('ontology-graph-hierarchy-empty')
    ).not.toBeVisible();
  });
});

test.describe('Ontology Explorer - Cross Glossary Edges', () => {
  const crossGlossary1 = new Glossary();
  const crossTerm1 = new GlossaryTerm(crossGlossary1);
  const crossGlossary2 = new Glossary();
  const crossTerm2 = new GlossaryTerm(crossGlossary2);

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({
      storageState: 'playwright/.auth/admin.json',
    });
    await redirectToHomePage(page);
    const token = await getToken(page);
    const apiContext = await getAuthContext(token);

    await crossGlossary1.create(apiContext);
    await crossTerm1.create(apiContext);
    await crossGlossary2.create(apiContext);
    await crossTerm2.create(apiContext);

    await crossTerm1.patch(apiContext, [
      {
        op: 'add',
        path: '/relatedTerms/0',
        value: {
          relationType: 'relatedTo',
          term: {
            id: crossTerm2.responseData.id,
            type: 'glossaryTerm',
            name: crossTerm2.responseData.name,
            displayName: crossTerm2.responseData.displayName,
            fullyQualifiedName: crossTerm2.responseData.fullyQualifiedName,
          },
        },
      },
    ]);

    await apiContext.dispose();
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage({
      storageState: 'playwright/.auth/admin.json',
    });
    await redirectToHomePage(page);
    const token = await getToken(page);
    const apiContext = await getAuthContext(token);

    if (crossTerm1.responseData?.id) {
      await crossTerm1.delete(apiContext);
    }
    if (crossTerm2.responseData?.id) {
      await crossTerm2.delete(apiContext);
    }
    if (crossGlossary1.responseData?.id) {
      await crossGlossary1.delete(apiContext);
    }
    if (crossGlossary2.responseData?.id) {
      await crossGlossary2.delete(apiContext);
    }

    await apiContext.dispose();
    await page.close();
  });

  test('Cross Glossary view should show edges between terms from different glossaries', async ({
    page,
  }) => {
    test.slow();
    await navigateToOntologyExplorer(page);
    await waitForGraphLoaded(page);

    await page.getByTestId('search-dropdown-Glossary').click();
    await page.getByTestId(crossGlossary1.responseData.id).click();
    await page.getByTestId(crossGlossary2.responseData.id).click();
    await page.getByTestId('update-btn').click();
    await waitForGraphLoaded(page);

    await page.getByTestId('view-mode-select').click();
    await page.getByRole('option', { name: 'Cross Glossary' }).click();
    await waitForGraphLoaded(page);

    await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
      /[1-9]\d*\s*Relations?/i
    );
  });
});
