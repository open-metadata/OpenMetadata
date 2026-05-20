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
  waitForGraphLoaded,
} from '../../utils/ontologyExplorer';

test.use({ storageState: 'playwright/.auth/admin.json' });

const glossary = new Glossary();
const term1 = new GlossaryTerm(glossary);
const term2 = new GlossaryTerm(glossary);

const glossary2 = new Glossary();
const term3 = new GlossaryTerm(glossary2);
const term4 = new GlossaryTerm(glossary2);

test.describe('Ontology Explorer - Filters and Tabs', () => {
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
    test.slow();
    await navigateToOntologyExplorer(page);
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
      await waitForGraphLoaded(page);
      await applyGlossaryFilter(page, glossary.responseData.id);
      await waitForGraphLoaded(page);

      await page.getByRole('tab', { name: 'Data' }).click();
      await waitForGraphLoaded(page);

      await expect(page.getByTestId('ontology-explorer-stats')).toBeVisible();
    });

    test('should retain glossary filter when switching between Model and Data modes', async ({
      page,
    }) => {
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
