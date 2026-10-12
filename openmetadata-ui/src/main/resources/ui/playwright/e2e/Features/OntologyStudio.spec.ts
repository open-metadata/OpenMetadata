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

import { OntologyStudioPageData as PageData } from '../../support/entity/OntologyStudioDataClass';
import { expect, test } from '../../support/fixtures/base';
import {
  applyGlossaryFilter,
  clickGraphNode,
  createApiContext,
  disposeApiContext,
  navigateToOntologyStudio,
  readGraphEdges,
  readGraphZoom,
  readNodePositions,
  releaseOntologyEditLease,
  waitForGraphLoaded,
} from '../../utils/ontologyStudio';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Ontology Studio', () => {
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createApiContext(browser);
    await PageData.setup(apiContext);
    await disposeApiContext(afterAction, apiContext);
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createApiContext(browser);
    await PageData.teardown(apiContext);
    await disposeApiContext(afterAction, apiContext);
  });

  test.beforeEach(async ({ page }) => {
    await navigateToOntologyStudio(page);
    await waitForGraphLoaded(page);
  });

  test('opens with the View, Graph, and Model surfaces selected', async ({
    page,
  }) => {
    await expect(page.getByTestId('ontology-studio-shell')).toBeVisible();
    await expect(page.getByTestId('heading')).toHaveText('Ontology Studio');
    await expect(page.getByTestId('mode-tab-view')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(page.getByTestId('submode-tab-graph')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(
      page.getByRole('tab', { name: 'Model', exact: true })
    ).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.ontology-g6-container')).toBeVisible();
  });

  test('switches between Graph and Tree view surfaces', async ({ page }) => {
    await page.getByTestId('submode-tab-tree').click();
    await expect(page.getByTestId('ontology-tree-view')).toBeVisible();
    await expect(page.getByTestId('submode-tab-tree')).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    await page.getByTestId('submode-tab-graph').click();
    await waitForGraphLoaded(page);
    await expect(page.locator('.ontology-g6-container')).toBeVisible();
  });

  test('preserves the loaded graph through View, Edit, Query, Edit and View', async ({
    page,
  }) => {
    const graph = page.locator('.ontology-g6-container');
    const stats = page.getByTestId('ontology-explorer-stats');
    const nodesBefore = Object.keys(await readNodePositions(page)).sort();
    const edgesBefore = await readGraphEdges(page, 0);
    const statsBefore = await stats.innerText();
    const zoomBefore = await readGraphZoom(page);
    await expect(
      page.getByTestId('ontology-glossary-menu-trigger')
    ).toHaveAttribute('data-selected-glossary-id', '');

    // Once loaded, mode changes must work even when the catalog cannot be fetched again.
    await page.route('**/api/v1/glossaries?*', (route) =>
      route.abort('failed')
    );

    await test.step('Visit Query and return to the loaded graph', async () => {
      await page.getByTestId('mode-tab-edit').click();
      await expect(graph).toBeVisible();
      await page.getByTestId('mode-tab-query').click();
      await expect(page.getByTestId('mode-tab-query')).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      await expect(graph).not.toBeVisible();
      await page.getByTestId('mode-tab-edit').click();
      await expect(graph).toBeVisible();
      await expect(
        page.getByTestId('ontology-graph-loading')
      ).not.toBeVisible();
      await expect(stats).toHaveText(statsBefore);
      await page.getByTestId('mode-tab-view').click();
      await expect(graph).toBeVisible();
      await expect(stats).toHaveText(statsBefore);
    });

    await test.step('Opening and closing Library leaves the graph usable', async () => {
      await page.getByTestId('ontology-library-trigger').click();
      await expect(page.getByTestId('ontology-library')).toBeVisible();
      await page.getByTestId('ontology-library-close').click();
      await expect(page.getByTestId('ontology-library')).not.toBeVisible();
      await expect(graph).toBeVisible();
    });

    expect(Object.keys(await readNodePositions(page)).sort()).toEqual(
      nodesBefore
    );
    expect(await readGraphEdges(page, 0)).toEqual(edgesBefore);
    expect(await readGraphZoom(page)).toBeCloseTo(zoomBefore);
    await expect(
      page.getByTestId('ontology-graph-render-error')
    ).not.toBeVisible();
  });

  test('scopes the Studio graph and stats to a glossary', async ({ page }) => {
    await page.getByTestId('ontology-glossary-menu-trigger').click();
    await expect(
      page.getByTestId(PageData.glossary.responseData.id)
    ).toBeVisible();
    await expect(
      page.getByTestId(PageData.glossary2.responseData.id)
    ).toBeVisible();

    await applyGlossaryFilter(page, PageData.glossary.responseData.id);
    await waitForGraphLoaded(page);

    const stats = page.getByTestId('ontology-explorer-stats');
    await expect(stats).toContainText(/2\s+terms/i);
    await expect(stats).toContainText(/1\s+relations?/i);
  });

  test('switches between Model and Data layers', async ({ page }) => {
    const modelTab = page.getByRole('tab', { name: 'Model', exact: true });
    const dataTab = page.getByRole('tab', { name: 'Data', exact: true });

    await applyGlossaryFilter(page, PageData.glossary2.responseData.id);
    await waitForGraphLoaded(page);
    await dataTab.click();
    await waitForGraphLoaded(page);

    await expect(dataTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('ontology-graph-empty')).toBeVisible();

    await modelTab.click();
    await waitForGraphLoaded(page);

    await expect(modelTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.ontology-g6-container')).toBeVisible();
  });

  test('covers Edit Graph authoring and the Model workbench', async ({
    page,
  }) => {
    test.slow();

    await applyGlossaryFilter(page, PageData.glossary.responseData.id);
    await waitForGraphLoaded(page);
    await page.getByTestId('mode-tab-edit').click();

    try {
      await expect(page.getByTestId('mode-tab-edit')).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      await expect(
        page.getByTestId('ontology-edit-lease-status')
      ).toContainText('Active');
      // Edit mode authors concepts, so it hides the Model/Data switch.
      await expect(
        page.getByRole('tab', { name: 'Data', exact: true })
      ).toHaveCount(0);

      const addConcept = page.getByTestId('ontology-add-concept');
      await expect(addConcept).toBeEnabled();
      await addConcept.click();

      const draftInspector = page.getByTestId(
        'ontology-concept-draft-inspector'
      );
      const saveConcept = page.getByTestId('ontology-draft-save');
      await expect(draftInspector).toBeVisible();
      await expect(
        page.getByTestId('ontology-draft-glossary-field')
      ).toBeVisible();
      await expect(saveConcept).toBeDisabled();

      const conceptName = `StudioDraftConcept${Date.now()}`;
      await page
        .getByTestId('ontology-draft-name-field')
        .getByRole('textbox')
        .fill(conceptName);
      await page
        .getByTestId('ontology-draft-description-field')
        .getByRole('textbox')
        .fill('A draft concept created while validating Ontology Studio.');
      await expect(saveConcept).toBeEnabled();

      const createConceptResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/glossaryTerms') &&
          response.request().method() === 'POST'
      );
      await saveConcept.click();
      const response = await createConceptResponse;
      expect(response.ok(), await response.text()).toBe(true);
      await expect(draftInspector).not.toBeVisible();
      await expect(
        page.getByTestId('ontology-authoring-inspector')
      ).toContainText(conceptName);

      await page.getByTestId('submode-tab-model').click();
      await expect(
        page.getByTestId('ontology-modeling-workbench')
      ).toBeVisible();

      await page.getByTestId('submode-tab-graph').click();
      await waitForGraphLoaded(page);
      await clickGraphNode(page, PageData.term1.responseData.id);
      await expect(
        page.getByTestId('ontology-authoring-inspector')
      ).toBeVisible();
    } finally {
      await releaseOntologyEditLease(page, PageData.glossary.responseData.id);
    }
  });

  test('preserves the scoped Model graph search across Query and clears it', async ({
    page,
  }) => {
    await applyGlossaryFilter(page, PageData.glossary.responseData.id);
    await waitForGraphLoaded(page);

    const searchInput = page.getByTestId('ontology-graph-search');
    const edgesBefore = await readGraphEdges(page);
    await searchInput.fill(PageData.term1.data.name);
    await expect(searchInput).toHaveValue(PageData.term1.data.name);

    await page.getByTestId('mode-tab-query').click();
    await expect(searchInput).not.toBeVisible();
    await page.getByTestId('mode-tab-view').click();
    await expect(searchInput).toHaveValue(PageData.term1.data.name);
    await expect(
      page.getByTestId('ontology-glossary-menu-trigger')
    ).toHaveAttribute(
      'data-selected-glossary-id',
      PageData.glossary.responseData.id
    );
    expect(await readGraphEdges(page)).toEqual(edgesBefore);

    await searchInput.clear();
    await expect(searchInput).toHaveValue('');
  });

  test('renders every relation type between the same concepts', async ({
    page,
  }) => {
    await applyGlossaryFilter(page, PageData.multiRelGlossary.responseData.id);
    await waitForGraphLoaded(page);

    const edges = await readGraphEdges(page);
    const fromId = PageData.multiRelTermA.responseData.id;
    const toId = PageData.multiRelTermB.responseData.id;
    const edgesForPair = edges.filter(
      (edge) =>
        (edge.from === fromId && edge.to === toId) ||
        (edge.from === toId && edge.to === fromId)
    );
    const relationTypes = new Set<string>();

    edgesForPair.forEach((edge) => {
      relationTypes.add(edge.relationType);
      if (edge.inverseRelationType) {
        relationTypes.add(edge.inverseRelationType);
      }
    });

    expect(relationTypes.has('relatedTo')).toBe(true);
    expect(relationTypes.has('partOf') || relationTypes.has('hasPart')).toBe(
      true
    );
  });
});
