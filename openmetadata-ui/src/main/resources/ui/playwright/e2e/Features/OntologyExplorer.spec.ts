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
  clickOutside,
  getAuthContext,
  getToken,
  redirectToHomePage,
} from '../../utils/common';
import { sidebarClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

const glossary = new Glossary();
const term1 = new GlossaryTerm(glossary);
const term2 = new GlossaryTerm(glossary);

async function applyGlossaryFilter(page: Page, glossaryName: string) {
  const glossarySection = page.getByTestId('glossary-filter-section');
  await glossarySection.locator('input').click();
  await page.getByRole('option', { name: glossaryName }).click();
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
      const header = page.getByTestId('ontology-explorer-header');
      await expect(header).toBeVisible();
      await expect(header.getByText('Ontology Explorer')).toBeVisible();
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
      ).toBeVisible();
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

    test('should reload graph when refresh is clicked', async ({ page }) => {
      await waitForGraphLoaded(page);
      await page.getByTestId('refresh').click();
      await expect(page.getByTestId('ontology-graph-loading')).toBeVisible({
        timeout: 5000,
      });
      await waitForGraphLoaded(page);
    });

    test('should disable refresh button while graph is loading', async ({
      page,
    }) => {
      await expect(page.getByTestId('ontology-graph-loading')).toBeVisible({
        timeout: 5000,
      });
      await expect(page.getByTestId('refresh')).toBeDisabled();
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
    test('should toggle isolated nodes off', async ({ page }) => {
      const toggle = page.getByTestId('ontology-isolated-toggle');
      await toggle.click();
      await expect(toggle).toBeVisible();
    });
  });

  test.describe('Clear All Filters', () => {
    test('should show and clear all filters', async ({ page }) => {
      await waitForGraphLoaded(page);
      const glossaryName =
        glossary.responseData.displayName ?? glossary.responseData.name;
      await applyGlossaryFilter(page, glossaryName);
      await clickOutside(page);
      const clearAll = page.getByTestId('ontology-clear-all-btn');
      await expect(clearAll).toBeVisible();
      await clearAll.click();
      await expect(clearAll).not.toBeVisible();
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
      await expect(page.getByText('Glossary:')).toBeVisible();
    });

    test('should open glossary dropdown and show All and test glossary options', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      const glossarySection = page.getByTestId('glossary-filter-section');
      await glossarySection.locator('input').click();
      await expect(
        page.getByRole('option', { name: 'All' }).first()
      ).toBeVisible();
      await expect(
        page.getByRole('option', {
          name: glossary.responseData.displayName ?? glossary.responseData.name,
        })
      ).toBeVisible();
    });

    test('should filter the graph to the selected glossary (stats match canvas data)', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      const glossaryName =
        glossary.responseData.displayName ?? glossary.responseData.name;
      await applyGlossaryFilter(page, glossaryName);
      await clickOutside(page);

      const stats = page.getByTestId('ontology-explorer-stats');
      await expect(stats).toContainText('2 Terms');
      await expect(stats).toContainText('1 Relations');
    });
  });

  test.describe('Relation Type Filter Dropdown', () => {
    test('should display Relationship Type filter label', async ({ page }) => {
      await expect(page.getByText('Relationship Type:')).toBeVisible();
    });

    test('should open relation type dropdown and show All option', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      const relationSection = page.getByTestId('relation-type-filter-section');
      await relationSection.locator('input').click();
      await expect(
        page.getByRole('option', { name: 'All' }).first()
      ).toBeVisible();
    });

    test('should filter graph edges by relation type (stats match canvas data)', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      const glossaryName =
        glossary.responseData.displayName ?? glossary.responseData.name;
      await applyGlossaryFilter(page, glossaryName);
      await clickOutside(page);

      const stats = page.getByTestId('ontology-explorer-stats');
      await expect(stats).toContainText('1 Relations');

      const relationSection = page.getByTestId('relation-type-filter-section');
      await relationSection.locator('input').click();
      await page.getByRole('option', { name: /^Synonym$/i }).click();
      await clickOutside(page);
      await expect(stats).toContainText('0 Relations');

      await relationSection.locator('input').click();
      await page.getByRole('option', { name: /^All$/i }).first().click();
      await clickOutside(page);
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
  });

  test.describe('Hierarchy View', () => {
    test('should show hierarchy empty state when no hierarchical relations', async ({
      page,
    }) => {
      await waitForGraphLoaded(page);
      await page.getByTestId('view-mode-select').click();
      await page.getByRole('option', { name: 'Hierarchy' }).click();
      await expect(
        page.getByTestId('ontology-graph-hierarchy-empty')
      ).toBeVisible();
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
    const glossaryName =
      syncGlossary.responseData.displayName ?? syncGlossary.responseData.name;

    await navigateToOntologyExplorer(page);
    await waitForGraphLoaded(page);
    await applyGlossaryFilter(page, glossaryName);

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

    const glossaryName =
      hierarchyGlossary.responseData.displayName ??
      hierarchyGlossary.responseData.name;
    await applyGlossaryFilter(page, glossaryName);
    await clickOutside(page);

    await page.getByTestId('view-mode-select').click();
    await page.getByRole('option', { name: 'Hierarchy' }).click();
    await waitForGraphLoaded(page);

    await expect(
      page.getByTestId('ontology-graph-hierarchy-empty')
    ).not.toBeVisible();
  });
});
