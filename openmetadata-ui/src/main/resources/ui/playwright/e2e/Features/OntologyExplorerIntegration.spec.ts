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
import { TableClass } from '../../support/entity/TableClass';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { getAuthContext, getToken, uuid } from '../../utils/common';
import {
  addTermRelation,
  applyMultiGlossaryFilter,
  applyRelationTypeFilter,
  clickDataModeAssetBadge,
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
  // crossTerm3 lives in crossGlossary1 but has only a same-glossary relation
  const crossTerm3 = new GlossaryTerm(crossGlossary1);
  const crossGlossary2 = new Glossary();
  const crossTerm2 = new GlossaryTerm(crossGlossary2);

  test.beforeAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);
    await crossGlossary1.create(apiContext);
    await crossTerm1.create(apiContext);
    await crossTerm3.create(apiContext);
    await crossGlossary2.create(apiContext);
    await crossTerm2.create(apiContext);
    // crossTerm1 <-> crossTerm2: cross-glossary edge
    await addTermRelation(apiContext, crossTerm1, crossTerm2, 'relatedTo');
    // crossTerm3 <-> crossTerm1: same-glossary edge — must be hidden in Cross Glossary mode
    await addTermRelation(apiContext, crossTerm3, crossTerm1, 'relatedTo');
    await disposeApiContext(page, apiContext);
  });

  test.afterAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);
    await deleteEntities(
      apiContext,
      crossTerm1,
      crossTerm3,
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

    await applyMultiGlossaryFilter(
      page,
      crossGlossary1.responseData.id,
      crossGlossary2.responseData.id
    );
    await waitForGraphLoaded(page);

    await page.getByTestId('view-mode-select').click();
    await page.getByRole('option', { name: 'Cross Glossary' }).click();
    await waitForGraphLoaded(page);

    await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
      /[1-9]\d*\s*Relations?/i
    );
  });

  test('Cross Glossary view hides terms that only have same-glossary edges', async ({
    page,
  }) => {
    test.slow();
    await navigateToOntologyExplorer(page);
    await waitForGraphLoaded(page);

    await applyMultiGlossaryFilter(
      page,
      crossGlossary1.responseData.id,
      crossGlossary2.responseData.id
    );
    await waitForGraphLoaded(page);

    // In overview mode crossTerm3 should be visible (has a same-glossary edge).
    const overviewPositions = await readNodePositions(page);
    expect(
      overviewPositions[crossTerm3.responseData.id],
      'crossTerm3 must be visible in Overview mode'
    ).toBeDefined();

    await page.getByTestId('view-mode-select').click();
    await page.getByRole('option', { name: 'Cross Glossary' }).click();
    await waitForGraphLoaded(page);

    const crossPositions = await readNodePositions(page);

    // crossTerm3 only has a same-glossary edge and must not appear.
    expect(
      crossPositions[crossTerm3.responseData.id],
      'crossTerm3 (same-glossary-only) must NOT appear in Cross Glossary view'
    ).toBeUndefined();

    // crossTerm1 and crossTerm2 share a cross-glossary edge and must appear.
    expect(
      crossPositions[crossTerm1.responseData.id],
      'crossTerm1 (has a cross-glossary edge) must be visible'
    ).toBeDefined();
    expect(
      crossPositions[crossTerm2.responseData.id],
      'crossTerm2 (has a cross-glossary edge) must be visible'
    ).toBeDefined();
  });

  test('isolated nodes toggle is disabled when Cross Glossary view is active', async ({
    page,
  }) => {
    test.slow();
    await navigateToOntologyExplorer(page);
    await waitForGraphLoaded(page);

    // The toggle is enabled in Overview mode.
    await expect(
      page.getByTestId('ontology-isolated-toggle')
    ).not.toBeDisabled();

    await page.getByTestId('view-mode-select').click();
    await page.getByRole('option', { name: 'Cross Glossary' }).click();
    await waitForGraphLoaded(page);

    // showCrossGlossaryOnly=true disables the isolated nodes toggle.
    await expect(page.getByTestId('ontology-isolated-toggle')).toBeDisabled();
  });
});

test.describe('Ontology Explorer - Data Mode Asset Spiral View', () => {
  const spiralGlossary = new Glossary(`PWSpiral${uuid()}`);
  const spiralTerm = new GlossaryTerm(spiralGlossary);
  const spiralTable = new TableClass();

  test.beforeAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);
    await spiralGlossary.create(apiContext);
    await spiralTerm.create(apiContext);
    await spiralTable.create(apiContext);
    await spiralTable.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/tags/-',
          value: {
            tagFQN: spiralTerm.responseData.fullyQualifiedName,
            labelType: 'Manual',
            state: 'Confirmed',
            source: 'Glossary',
          },
        },
      ],
    });
    const glossaryFqn = spiralGlossary.responseData.fullyQualifiedName;
    const termFqn = spiralTerm.responseData.fullyQualifiedName;
    await expect(async () => {
      const response = await apiContext.get(
        '/api/v1/glossaryTerms/assets/counts',
        { params: { parent: glossaryFqn } }
      );
      const counts = (await response.json()) as Record<string, number>;
      expect(counts[termFqn] ?? 0).toBeGreaterThan(0);
    }).toPass({ timeout: 60000, intervals: [2000] });

    await disposeApiContext(page, apiContext);
  });

  test.afterAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);
    await deleteEntities(apiContext, spiralTerm, spiralGlossary);
    await spiralTable.delete(apiContext);
    await disposeApiContext(page, apiContext);
  });

  test('clicking asset count badge in data mode triggers asset search query', async ({
    page,
  }) => {
    test.slow();

    await navigateAndFilterByGlossary(page, spiralGlossary.responseData.id);

    const assetCountsResponse = page.waitForResponse(
      (res) =>
        res.url().includes('/api/v1/glossaryTerms/assets/counts') &&
        res.request().method() === 'GET',
      { timeout: 30000 }
    );
    await page.getByRole('tab', { name: 'Data' }).click();
    await assetCountsResponse;
    await waitForGraphLoaded(page);

    await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
      /[1-9]\d*\s*Terms?/i
    );
    await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
      /[1-9]\d*\s*Data\s*Assets?/i
    );

    const searchResponse = page.waitForResponse(
      (res) =>
        res.url().includes('/api/v1/search/query') &&
        res.request().method() === 'GET',
      { timeout: 30000 }
    );
    await clickDataModeAssetBadge(
      page,
      spiralTerm.responseData.fullyQualifiedName
    );
    await searchResponse;
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
