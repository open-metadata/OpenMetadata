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

import { TableClass } from '../../support/entity/TableClass';
import { expect, test } from '../../support/fixtures/base';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { getAuthContext, getToken, uuid } from '../../utils/common';
import {
  addTermRelation,
  createApiContext,
  deleteEntities,
  disposeApiContext,
  navigateAndFilterByGlossary,
  readGraphEdges,
  readNodePositions,
  waitForGraphLoaded,
} from '../../utils/ontologyStudio';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Relation Sync with Ontology Studio', () => {
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

test.describe('Ontology Studio - Tree View', () => {
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

  test('should display terms with a narrower relation in Tree view', async ({
    page,
  }) => {
    await navigateAndFilterByGlossary(page, hierarchyGlossary.responseData.id);

    await page.getByTestId('submode-tab-tree').click();
    await expect(page.getByTestId('ontology-tree-view')).toBeVisible();
    await expect(page.getByTestId('ontology-tree-view')).toContainText(
      parentTerm.responseData.displayName ?? parentTerm.responseData.name
    );
    await expect(page.getByTestId('ontology-tree-view')).toContainText(
      childTerm.responseData.displayName ?? childTerm.responseData.name
    );
  });
});

test.describe('Ontology Studio - Cross Glossary Edges', () => {
  const crossGlossary1 = new Glossary();
  const crossTerm1 = new GlossaryTerm(crossGlossary1);
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
    await addTermRelation(apiContext, crossTerm1, crossTerm2, 'relatedTo');
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

  test('selected glossary scope shows edges to another glossary', async ({
    page,
  }) => {
    test.slow();
    await navigateAndFilterByGlossary(page, crossGlossary1.responseData.id);

    const edges = await readGraphEdges(page);
    expect(
      edges.some(
        (edge) =>
          (edge.from === crossTerm1.responseData.id &&
            edge.to === crossTerm2.responseData.id) ||
          (edge.from === crossTerm2.responseData.id &&
            edge.to === crossTerm1.responseData.id)
      )
    ).toBe(true);
  });

  test('a selected glossary hydrates connected terms from another glossary', async ({
    page,
  }) => {
    test.slow();
    await navigateAndFilterByGlossary(page, crossGlossary1.responseData.id);
    await page.getByTestId('fit-view').click();

    const positions = await readNodePositions(page);
    expect(
      positions[crossTerm1.responseData.id],
      'the scoped glossary term must be visible'
    ).toBeDefined();
    expect(
      positions[crossTerm2.responseData.id],
      'the connected cross-glossary term must be hydrated'
    ).toBeDefined();
    expect(
      positions[crossTerm3.responseData.id],
      'the same-glossary connected term must remain visible'
    ).toBeDefined();
  });
});

test.describe('Ontology Studio - Data Mode Asset Cards', () => {
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

  test('data mode renders tagged assets from the ontology data response', async ({
    page,
  }) => {
    test.slow();

    await navigateAndFilterByGlossary(page, spiralGlossary.responseData.id);

    const ontologyDataResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());

      return (
        url.pathname === '/api/v1/glossaryTerms/ontology/data' &&
        url.searchParams.get('limit') === '12' &&
        url.searchParams.get('offset') === '0' &&
        url.searchParams.get('assetPreviewSize') === '4'
      );
    });
    await page.getByRole('tab', { name: 'Data' }).click();
    expect((await ontologyDataResponse).ok()).toBe(true);
    await waitForGraphLoaded(page);

    const cluster = page.getByTestId(
      `ontology-data-cluster-${spiralTerm.responseData.id}`
    );
    await expect(cluster).toBeVisible();
    await expect(cluster).toContainText(/[1-9]\d*\s+assets?/i);
    await expect(
      cluster.getByTestId(
        `ontology-data-asset-${spiralTable.entityResponseData.id}`
      )
    ).toBeVisible();
  });
});

test.describe('Ontology Studio - Data Mode Stats', () => {
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
    await expect(stats).toContainText(/2\s+terms/i);
    await expect(stats).toContainText(/1\s+relations?/i);
  });
});
