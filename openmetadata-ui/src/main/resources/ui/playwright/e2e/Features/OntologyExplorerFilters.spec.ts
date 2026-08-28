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

test.describe('Ontology Studio - Scope and view controls', () => {
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
    await waitForGraphLoaded(page);
  });

  test('starts in View, Graph, and Model', async ({ page }) => {
    await expect(page.getByTestId('mode-tab-view')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(page.getByTestId('submode-tab-graph')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(page.getByRole('tab', { name: 'Model' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  test('switches between Graph and Tree surfaces', async ({ page }) => {
    await page.getByTestId('submode-tab-tree').click();
    await expect(page.getByTestId('ontology-tree-view')).toBeVisible();
    await expect(page.getByTestId('submode-tab-tree')).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    await page.getByTestId('submode-tab-graph').click();
    await expect(page.locator('.ontology-g6-container canvas')).toBeVisible();
  });

  test('opens the glossary scope menu with both glossaries', async ({
    page,
  }) => {
    await page.getByTestId('ontology-glossary-menu-trigger').click();

    await expect(page.getByTestId(glossary.responseData.id)).toBeVisible();
    await expect(page.getByTestId(glossary2.responseData.id)).toBeVisible();
  });

  test('filters the graph to the selected glossary', async ({ page }) => {
    await applyGlossaryFilter(page, glossary.responseData.id);

    const stats = page.getByTestId('ontology-explorer-stats');
    await expect(stats).toContainText(/2\s+terms/i);
    await expect(stats).toContainText(/1\s+relations?/i);
  });

  test('updates stats when a different glossary is selected', async ({
    page,
  }) => {
    await applyGlossaryFilter(page, glossary2.responseData.id);

    const stats = page.getByTestId('ontology-explorer-stats');
    await expect(stats).toContainText(/2\s+terms/i);
    await expect(stats).toContainText(/0\s+relations?/i);
  });

  test('switches between Model and Data layers', async ({ page }) => {
    const modelTab = page.getByRole('tab', { name: 'Model' });
    const dataTab = page.getByRole('tab', { name: 'Data' });

    await applyGlossaryFilter(page, glossary2.responseData.id);
    await dataTab.click();
    await expect(dataTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('ontology-graph-empty')).toBeVisible();

    await modelTab.click();
    await expect(modelTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.ontology-g6-container canvas')).toBeVisible();
  });
});
