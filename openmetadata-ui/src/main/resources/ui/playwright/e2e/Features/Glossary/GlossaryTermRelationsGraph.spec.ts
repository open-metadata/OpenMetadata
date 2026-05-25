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
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { redirectToHomePage } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import {
  addTermRelation,
  createApiContext,
  deleteEntities,
  disposeApiContext,
  readGraphEdges,
  readNodePositions,
  waitForGraphLoaded,
} from '../../../utils/ontologyExplorer';

test.use({ storageState: 'playwright/.auth/admin.json' });

const glossary = new Glossary();
const termA = new GlossaryTerm(glossary);
const termB = new GlossaryTerm(glossary);
const termC = new GlossaryTerm(glossary);
const termD = new GlossaryTerm(glossary);

const glossaryX = new Glossary();
const glossaryY = new Glossary();
const termInX = new GlossaryTerm(glossaryX);
const termInY = new GlossaryTerm(glossaryY);

test.beforeAll('Seed test data', async ({ browser }) => {
  const { page, apiContext } = await createApiContext(browser);

  await glossary.create(apiContext);
  await termA.create(apiContext);
  await termB.create(apiContext);
  await termC.create(apiContext);
  await termD.create(apiContext);
  await addTermRelation(apiContext, termA, termB, 'relatedTo');
  await addTermRelation(apiContext, termA, termD, 'seeAlso');

  await glossaryX.create(apiContext);
  await glossaryY.create(apiContext);
  await termInX.create(apiContext);
  await termInY.create(apiContext);
  await addTermRelation(apiContext, termInX, termInY, 'relatedTo');

  await disposeApiContext(page, apiContext);
});

test.afterAll('Cleanup test data', async ({ browser }) => {
  const { page, apiContext } = await createApiContext(browser);

  await deleteEntities(
    apiContext,
    termA,
    termB,
    termC,
    termD,
    termInX,
    termInY
  );
  await glossary.delete(apiContext);
  await glossaryX.delete(apiContext);
  await glossaryY.delete(apiContext);

  await disposeApiContext(page, apiContext);
});

test.describe('Glossary Term — Relations Graph tab', () => {
  test('Relations Graph tab renders the ontology explorer for a term with a same-glossary relation', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await termA.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);
  });

  test('the term itself appears as a node in the Relations Graph', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await termA.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);

    const positions = await readNodePositions(page);

    expect(
      positions[termA.responseData.id],
      'termA (the viewed term) must be present as a node in the graph'
    ).toBeDefined();
  });

  test('the directly related term appears as a node in the Relations Graph', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await termA.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);

    const positions = await readNodePositions(page);

    expect(
      positions[termB.responseData.id],
      'termB (directly related via relatedTo) must appear as a node'
    ).toBeDefined();
  });

  test('an edge with the correct relationType exists between the term and its related term', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await termA.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);

    const edges = await readGraphEdges(page);
    const aId = termA.responseData.id;
    const bId = termB.responseData.id;

    const edge = edges.find(
      (e) =>
        (e.from === aId && e.to === bId) || (e.from === bId && e.to === aId)
    );

    expect(
      edge,
      'An edge between termA and termB must be rendered in the graph'
    ).toBeDefined();
    expect(
      edge?.relationType,
      'The edge relationType must be "relatedTo"'
    ).toBe('relatedTo');
  });

  test('all relation types from the same term appear as separate edges', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await termA.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);

    const positions = await readNodePositions(page);
    const edges = await readGraphEdges(page);
    const aId = termA.responseData.id;
    const bId = termB.responseData.id;
    const dId = termD.responseData.id;

    expect(
      positions[termB.responseData.id],
      'termB (relatedTo termA) must appear as a node'
    ).toBeDefined();
    expect(
      positions[termD.responseData.id],
      'termD (seeAlso from termA) must appear as a node'
    ).toBeDefined();

    const relatedToEdge = edges.find(
      (e) =>
        ((e.from === aId && e.to === bId) ||
          (e.from === bId && e.to === aId)) &&
        e.relationType === 'relatedTo'
    );
    const seeAlsoEdge = edges.find(
      (e) =>
        ((e.from === aId && e.to === dId) ||
          (e.from === dId && e.to === aId)) &&
        e.relationType === 'seeAlso'
    );

    expect(
      relatedToEdge,
      'A relatedTo edge to termB must be rendered'
    ).toBeDefined();
    expect(
      seeAlsoEdge,
      'A seeAlso edge to termD must be rendered'
    ).toBeDefined();
  });

  test('cross-glossary related term appears as a node in the Relations Graph', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await termInX.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);

    const positions = await readNodePositions(page);

    expect(
      positions[termInY.responseData.id],
      'termInY (from a different glossary) must appear as a node when it is related to termInX'
    ).toBeDefined();
  });

  test('cross-glossary related term has an edge to the viewed term', async ({
    page,
  }) => {
    test.slow();
    await redirectToHomePage(page);
    await termInX.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);

    const edges = await readGraphEdges(page);
    const xId = termInX.responseData.id;
    const yId = termInY.responseData.id;

    const hasEdge = edges.some(
      (e) =>
        (e.from === xId && e.to === yId) || (e.from === yId && e.to === xId)
    );

    expect(
      hasEdge,
      'An edge between termInX and the cross-glossary termInY must be rendered'
    ).toBe(true);
  });

  test('unrelated term from the same glossary is NOT shown in the Relations Graph', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await termA.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);

    const positions = await readNodePositions(page);

    expect(
      positions[termC.responseData.id],
      'termC has no relation to termA and must NOT appear in the graph'
    ).toBeUndefined();

    expect(
      positions[termA.responseData.id],
      'termA (the viewed term) must be present'
    ).toBeDefined();
    expect(
      positions[termB.responseData.id],
      'termB (directly related to termA) must be present'
    ).toBeDefined();
  });

  test('a term with no relations shows only itself as a node with no edges', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await termC.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);

    const positions = await readNodePositions(page);
    const edges = await readGraphEdges(page, 0);

    expect(
      positions[termC.responseData.id],
      'termC (the viewed term) must still appear as a node even with no relations'
    ).toBeDefined();
    expect(
      edges.length,
      'There must be no edges for a term with zero relations'
    ).toBe(0);
  });

  test('clicking a node in the Relations Graph opens the entity summary panel', async ({
    page,
  }) => {
    test.slow();
    await redirectToHomePage(page);
    await termA.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);

    const positions = await readNodePositions(page);
    const bPos = positions[termB.responseData.id];
    expect(bPos, 'termB must be present as a node').toBeDefined();

    await page.mouse.click(bPos.x, bPos.y);

    await expect(
      page.getByTestId('entity-summary-panel-container')
    ).toBeVisible();
  });

  test('search in the Relations Graph filters to matching node and its neighbours', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await termA.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);

    const searchInput = page
      .getByTestId('ontology-graph-search')
      .locator('input');
    await searchInput.fill(termB.data.name);

    const positions = await readNodePositions(page);

    expect(
      positions[termB.responseData.id],
      'termB matches the search query and must be visible'
    ).toBeDefined();
    expect(
      positions[termA.responseData.id],
      'termA is a direct neighbour of termB and must also be visible'
    ).toBeDefined();

    await searchInput.clear();
    const restoredPositions = await readNodePositions(page);
    expect(Object.keys(restoredPositions).length).toBeGreaterThanOrEqual(
      Object.keys(positions).length
    );
  });

  test('search in the term Relations Graph returns empty state when no term matches', async ({
    page,
  }) => {
    test.slow();
    await redirectToHomePage(page);
    await termA.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);

    const searchInput = page
      .getByTestId('ontology-graph-search')
      .locator('input');
    await searchInput.fill('__nonexistent_pw_term_xyz__');

    await expect(page.getByTestId('ontology-graph-empty')).toBeVisible();

    await searchInput.clear();
    await expect(page.getByTestId('ontology-graph-empty')).not.toBeVisible();
  });
});
