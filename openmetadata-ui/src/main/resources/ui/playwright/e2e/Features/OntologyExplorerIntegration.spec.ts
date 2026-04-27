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
import { getAuthContext, getToken } from '../../utils/common';
import {
  addTermRelation,
  applyRelationTypeFilter,
  createApiContext,
  deleteEntities,
  disposeApiContext,
  navigateAndFilterByGlossary,
  navigateToOntologyExplorer,
  readNodePositions,
  waitForGraphLoaded,
} from '../../utils/ontologyExplorer';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Relation Sync with OntologyExplorer', () => {
  const syncGlossary = new Glossary();
  const syncTerm1 = new GlossaryTerm(syncGlossary);
  const syncTerm2 = new GlossaryTerm(syncGlossary);

  test.beforeAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);
    await syncGlossary.create(apiContext);
    await syncTerm1.create(apiContext);
    await syncTerm2.create(apiContext);
    await disposeApiContext(page, apiContext);
  });

  test.afterAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);
    await deleteEntities(apiContext, syncTerm1, syncTerm2, syncGlossary);
    await disposeApiContext(page, apiContext);
  });

  test('should reflect relation add and remove in the graph', async ({
    page,
  }) => {
    await navigateAndFilterByGlossary(page, syncGlossary.responseData.id);

    await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
      /0\s*Relations?/i
    );

    const token = await getToken(page);
    const apiContext = await getAuthContext(token);
    await addTermRelation(apiContext, syncTerm1, syncTerm2, 'synonym');
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
    const { page, apiContext } = await createApiContext(browser);
    await hierarchyGlossary.create(apiContext);
    await parentTerm.create(apiContext);
    await childTerm.create(apiContext);
    await addTermRelation(apiContext, parentTerm, childTerm, 'narrower');
    await disposeApiContext(page, apiContext);
  });

  test.afterAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);
    await deleteEntities(apiContext, childTerm, parentTerm, hierarchyGlossary);
    await disposeApiContext(page, apiContext);
  });

  test('should display terms with narrower relation in Hierarchy view', async ({
    page,
  }) => {
    await navigateAndFilterByGlossary(page, hierarchyGlossary.responseData.id);

    await page.getByTestId('view-mode-select').click();
    await page.getByRole('option', { name: 'Hierarchy' }).click();
    await waitForGraphLoaded(page);

    await expect(
      page.getByTestId('ontology-graph-hierarchy-empty')
    ).not.toBeVisible();
  });
});

test.describe('Ontology Explorer - Relation Type Filter Prunes Nodes', () => {
  const filterGlossary = new Glossary();
  const termA = new GlossaryTerm(filterGlossary);
  const termB = new GlossaryTerm(filterGlossary);
  const termC = new GlossaryTerm(filterGlossary);

  test.beforeAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);
    await filterGlossary.create(apiContext);
    await termA.create(apiContext);
    await termB.create(apiContext);
    await termC.create(apiContext);
    await addTermRelation(apiContext, termA, termB, 'relatedTo');
    await addTermRelation(apiContext, termB, termC, 'synonym');
    await disposeApiContext(page, apiContext);
  });

  test.afterAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);
    await deleteEntities(apiContext, termA, termB, termC, filterGlossary);
    await disposeApiContext(page, apiContext);
  });

  test('filtering by relatedTo should show only terms connected by that relation and hide others', async ({
    page,
  }) => {
    await navigateAndFilterByGlossary(page, filterGlossary.responseData.id);

    await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
      '3 Terms'
    );

    await applyRelationTypeFilter(page, 'Related To');

    await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
      '2 Terms'
    );
    await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
      '1 Relations'
    );

    const positions = await readNodePositions(page);
    expect(positions).toHaveProperty(termA.responseData.id);
    expect(positions).toHaveProperty(termB.responseData.id);
    expect(positions).not.toHaveProperty(termC.responseData.id);
  });

  test('filtering by synonym should show only terms connected by synonym and hide others', async ({
    page,
  }) => {
    await navigateAndFilterByGlossary(page, filterGlossary.responseData.id);

    await applyRelationTypeFilter(page, 'Synonym');

    await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
      '2 Terms'
    );
    await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
      '1 Relations'
    );

    const positions = await readNodePositions(page);
    expect(positions).not.toHaveProperty(termA.responseData.id);
    expect(positions).toHaveProperty(termB.responseData.id);
    expect(positions).toHaveProperty(termC.responseData.id);
  });

  test('clearing relation type filter should restore all connected nodes', async ({
    page,
  }) => {
    await navigateAndFilterByGlossary(page, filterGlossary.responseData.id);

    await applyRelationTypeFilter(page, 'Synonym');

    await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
      '2 Terms'
    );

    await applyRelationTypeFilter(page, 'Synonym');

    await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
      '3 Terms'
    );

    const positions = await readNodePositions(page);
    expect(positions).toHaveProperty(termA.responseData.id);
    expect(positions).toHaveProperty(termB.responseData.id);
    expect(positions).toHaveProperty(termC.responseData.id);
  });
});

test.describe('Ontology Explorer - Cross Glossary Edges', () => {
  const crossGlossary1 = new Glossary();
  const crossTerm1 = new GlossaryTerm(crossGlossary1);
  const crossGlossary2 = new Glossary();
  const crossTerm2 = new GlossaryTerm(crossGlossary2);

  test.beforeAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);
    await crossGlossary1.create(apiContext);
    await crossTerm1.create(apiContext);
    await crossGlossary2.create(apiContext);
    await crossTerm2.create(apiContext);
    await addTermRelation(apiContext, crossTerm1, crossTerm2, 'relatedTo');
    await disposeApiContext(page, apiContext);
  });

  test.afterAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);
    await deleteEntities(
      apiContext,
      crossTerm1,
      crossTerm2,
      crossGlossary1,
      crossGlossary2
    );
    await disposeApiContext(page, apiContext);
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

test.describe('Ontology Explorer - Search Filtering - Node Visibility', () => {
  const highlightGlossary = new Glossary();
  const termAlpha = new GlossaryTerm(highlightGlossary);
  const termBeta = new GlossaryTerm(highlightGlossary);
  const termGamma = new GlossaryTerm(highlightGlossary);

  test.beforeAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);
    await highlightGlossary.create(apiContext);
    await termAlpha.create(apiContext);
    await termBeta.create(apiContext);
    await termGamma.create(apiContext);
    // alpha — relatedTo → beta; gamma stays isolated
    await addTermRelation(apiContext, termAlpha, termBeta, 'relatedTo');
    await disposeApiContext(page, apiContext);
  });

  test.afterAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);
    await deleteEntities(
      apiContext,
      termAlpha,
      termBeta,
      termGamma,
      highlightGlossary
    );
    await disposeApiContext(page, apiContext);
  });

  test('searching by a term name shows only that term and its connected neighbour', async ({
    page,
  }) => {
    await navigateAndFilterByGlossary(page, highlightGlossary.responseData.id);

    const searchInput = page
      .getByTestId('ontology-graph-search')
      .locator('input');
    await searchInput.fill(termAlpha.data.name);

    const positions = await readNodePositions(page);

    expect(
      positions,
      'termAlpha must be visible — it matches the search query'
    ).toHaveProperty(termAlpha.responseData.id);
    expect(
      positions,
      'termBeta must be visible — it is directly connected to termAlpha'
    ).toHaveProperty(termBeta.responseData.id);
    expect(
      positions,
      'termGamma must be hidden — it is unrelated to the search query'
    ).not.toHaveProperty(termGamma.responseData.id);
  });

  test('searching by the isolated term shows only that term', async ({
    page,
  }) => {
    await navigateAndFilterByGlossary(page, highlightGlossary.responseData.id);

    const searchInput = page
      .getByTestId('ontology-graph-search')
      .locator('input');
    await searchInput.fill(termGamma.data.name);

    const positions = await readNodePositions(page);

    expect(
      positions,
      'termGamma must be visible — it matches the search query'
    ).toHaveProperty(termGamma.responseData.id);
    expect(
      positions,
      'termAlpha must be hidden — it does not match and has no edge to termGamma'
    ).not.toHaveProperty(termAlpha.responseData.id);
    expect(
      positions,
      'termBeta must be hidden — it does not match and has no edge to termGamma'
    ).not.toHaveProperty(termBeta.responseData.id);
  });

  test('clearing the search restores all three terms to the graph', async ({
    page,
  }) => {
    await navigateAndFilterByGlossary(page, highlightGlossary.responseData.id);

    const searchInput = page
      .getByTestId('ontology-graph-search')
      .locator('input');
    await searchInput.fill(termAlpha.data.name);

    await searchInput.clear();

    const positions = await readNodePositions(page);
    expect(positions).toHaveProperty(termAlpha.responseData.id);
    expect(positions).toHaveProperty(termBeta.responseData.id);
    expect(positions).toHaveProperty(termGamma.responseData.id);
  });
});

test.describe('Ontology Explorer - Data Mode Stats', () => {
  const dataModeGlossary = new Glossary();
  const dataTerm1 = new GlossaryTerm(dataModeGlossary);
  const dataTerm2 = new GlossaryTerm(dataModeGlossary);

  test.beforeAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);
    await dataModeGlossary.create(apiContext);
    await dataTerm1.create(apiContext);
    await dataTerm2.create(apiContext);
    await addTermRelation(apiContext, dataTerm1, dataTerm2, 'relatedTo');
    await disposeApiContext(page, apiContext);
  });

  test.afterAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);
    await deleteEntities(apiContext, dataTerm1, dataTerm2, dataModeGlossary);
    await disposeApiContext(page, apiContext);
  });

  test('Data mode stats do not show Data Assets when no assets are tagged', async ({
    page,
  }) => {
    await navigateAndFilterByGlossary(page, dataModeGlossary.responseData.id);

    await page.getByRole('tab', { name: 'Data' }).click();
    await waitForGraphLoaded(page);

    await expect(page.getByTestId('ontology-explorer-stats')).not.toContainText(
      /data.asset/i
    );
  });

  test('switching back from Data to Model mode restores stats', async ({
    page,
  }) => {
    await navigateAndFilterByGlossary(page, dataModeGlossary.responseData.id);

    await page.getByRole('tab', { name: 'Data' }).click();
    await waitForGraphLoaded(page);
    await page.getByRole('tab', { name: 'Model' }).click();
    await waitForGraphLoaded(page);

    const stats = page.getByTestId('ontology-explorer-stats');
    await expect(stats).toContainText('2 Terms');
    await expect(stats).toContainText('1 Relations');
  });
});
