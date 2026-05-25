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
import { AdminClass } from '../../../support/user/AdminClass';
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import {
  addTermRelation,
  readGraphEdges,
  readNodePositions,
  waitForGraphLoaded,
} from '../../../utils/ontologyExplorer';

const adminUser = new AdminClass();

const glossaryA = new Glossary();
const termA1 = new GlossaryTerm(glossaryA);
const termA2 = new GlossaryTerm(glossaryA);
const termAIso = new GlossaryTerm(glossaryA);
// parent set in beforeAll after termA1 / termA1Child are created
const termA1Child = new GlossaryTerm(glossaryA);
const termA1Grandchild = new GlossaryTerm(glossaryA);

const glossaryB = new Glossary();
const termB1 = new GlossaryTerm(glossaryB);

const glossaryC = new Glossary();
const termFromC = new GlossaryTerm(glossaryC);
// termC2: cross-glossary relation target for termA1Child (nested-child cross-glossary path)
const termC2 = new GlossaryTerm(glossaryC);

test.beforeAll('Seed test data', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);

  await glossaryA.create(apiContext);
  await termA1.create(apiContext);
  await termA2.create(apiContext);
  await termAIso.create(apiContext);
  await addTermRelation(apiContext, termA1, termA2, 'relatedTo');

  // Nested terms: set parent after the parent term exists.
  termA1Child.data.parent = termA1.responseData.fullyQualifiedName;
  await termA1Child.create(apiContext);
  termA1Grandchild.data.parent = termA1Child.responseData.fullyQualifiedName;
  await termA1Grandchild.create(apiContext);

  await glossaryB.create(apiContext);
  await termB1.create(apiContext);

  await glossaryC.create(apiContext);
  await termFromC.create(apiContext);
  await addTermRelation(apiContext, termA1, termFromC, 'relatedTo');
  await termC2.create(apiContext);
  await addTermRelation(apiContext, termA1Child, termC2, 'relatedTo');

  await afterAction();
});

test.afterAll('Cleanup test data', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);

  await termA1Grandchild.delete(apiContext);
  await termA1Child.delete(apiContext);
  await termA1.delete(apiContext);
  await termA2.delete(apiContext);
  await termAIso.delete(apiContext);
  await glossaryA.delete(apiContext);

  await termB1.delete(apiContext);
  await glossaryB.delete(apiContext);

  await termFromC.delete(apiContext);
  await termC2.delete(apiContext);
  await glossaryC.delete(apiContext);

  await afterAction();
});

test.describe('Glossary — Relations Graph tab', () => {
  test('Relations Graph tab renders the ontology explorer for a glossary with related terms', async ({
    browser,
  }) => {
    const page = await browser.newPage();
    await adminUser.login(page);

    await redirectToHomePage(page);
    await glossaryA.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);

    await page.close();
  });

  test('related terms from the glossary appear as nodes in the Relations Graph', async ({
    browser,
  }) => {
    const page = await browser.newPage();
    await adminUser.login(page);

    await redirectToHomePage(page);
    await glossaryA.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);

    const positions = await readNodePositions(page);

    expect(
      positions[termA1.responseData.id],
      'termA1 must appear as a node in the glossaryA Relations Graph'
    ).toBeDefined();
    expect(
      positions[termA2.responseData.id],
      'termA2 must appear as a node in the glossaryA Relations Graph'
    ).toBeDefined();

    await page.close();
  });

  test('an edge with the correct relationType exists between the related terms', async ({
    browser,
  }) => {
    const page = await browser.newPage();
    await adminUser.login(page);

    await redirectToHomePage(page);
    await glossaryA.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);

    const edges = await readGraphEdges(page);
    const a1Id = termA1.responseData.id;
    const a2Id = termA2.responseData.id;

    const edge = edges.find(
      (e) =>
        (e.from === a1Id && e.to === a2Id) || (e.from === a2Id && e.to === a1Id)
    );

    expect(
      edge,
      'An edge between termA1 and termA2 must be rendered in the graph'
    ).toBeDefined();
    expect(
      edge?.relationType,
      'The edge relationType must be "relatedTo"'
    ).toBe('relatedTo');

    await page.close();
  });

  test('isolated term within the same glossary IS shown in the Relations Graph by default', async ({
    browser,
  }) => {
    const page = await browser.newPage();
    await adminUser.login(page);

    await redirectToHomePage(page);
    await glossaryA.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);

    const positions = await readNodePositions(page);
    expect(
      positions[termAIso.responseData.id],
      'termAIso has no relations but showIsolatedNodes defaults to true so it must appear'
    ).toBeDefined();

    expect(
      positions[termA1.responseData.id],
      'termA1 must still be visible'
    ).toBeDefined();
    expect(
      positions[termA2.responseData.id],
      'termA2 must still be visible'
    ).toBeDefined();

    await page.close();
  });

  test('cross-glossary related term appears as a node in the glossary Relations Graph', async ({
    browser,
  }) => {
    const page = await browser.newPage();
    await adminUser.login(page);

    await redirectToHomePage(page);
    await glossaryA.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);

    const positions = await readNodePositions(page);

    expect(
      positions[termFromC.responseData.id],
      'termFromC (from a different glossary, related to termA1) must appear as a node'
    ).toBeDefined();

    await page.close();
  });

  test('cross-glossary related term has an edge to the term in the viewed glossary', async ({
    browser,
  }) => {
    const page = await browser.newPage();
    await adminUser.login(page);

    await redirectToHomePage(page);
    await glossaryA.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);

    const edges = await readGraphEdges(page);
    const a1Id = termA1.responseData.id;
    const cId = termFromC.responseData.id;

    const hasEdge = edges.some(
      (e) =>
        (e.from === a1Id && e.to === cId) || (e.from === cId && e.to === a1Id)
    );

    expect(
      hasEdge,
      'An edge between termA1 and the cross-glossary termFromC must be rendered'
    ).toBe(true);

    await page.close();
  });

  test('term from an unrelated glossary is NOT shown in the Relations Graph', async ({
    browser,
  }) => {
    const page = await browser.newPage();
    await adminUser.login(page);

    await redirectToHomePage(page);
    await glossaryA.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);

    const positions = await readNodePositions(page);

    // termB1 belongs to glossaryB which has no relation to any glossaryA term.
    // scope='glossary' fetches only glossaryA's data — termB1 must not appear.
    expect(
      positions[termB1.responseData.id],
      'termB1 from unrelated glossaryB must NOT appear in the glossaryA Relations Graph'
    ).toBeUndefined();

    expect(
      positions[termA1.responseData.id],
      'termA1 must still be visible'
    ).toBeDefined();
    expect(
      positions[termA2.responseData.id],
      'termA2 must still be visible'
    ).toBeDefined();

    await page.close();
  });

  test('clicking a node in the Relations Graph opens the entity summary panel', async ({
    browser,
  }) => {
    const page = await browser.newPage();
    await adminUser.login(page);

    await redirectToHomePage(page);
    await glossaryA.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);

    const positions = await readNodePositions(page);
    const a2Pos = positions[termA2.responseData.id];
    expect(a2Pos, 'termA2 must be present as a node').toBeDefined();

    await page.mouse.click(a2Pos.x, a2Pos.y);

    await expect(
      page.getByTestId('entity-summary-panel-container')
    ).toBeVisible();

    await page.close();
  });

  test('search in the Relations Graph filters to the matching node and its neighbours', async ({
    browser,
  }) => {
    const page = await browser.newPage();
    await adminUser.login(page);

    await redirectToHomePage(page);
    await glossaryA.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);

    const searchInput = page
      .getByTestId('ontology-graph-search')
      .locator('input');
    await searchInput.fill(termA2.data.name);

    const filtered = await readNodePositions(page);

    expect(
      filtered[termA2.responseData.id],
      'termA2 matches the search query and must be visible'
    ).toBeDefined();
    expect(
      filtered[termA1.responseData.id],
      'termA1 is a direct neighbour of termA2 and must also be visible'
    ).toBeDefined();

    await searchInput.clear();
    const restored = await readNodePositions(page);
    expect(Object.keys(restored).length).toBeGreaterThanOrEqual(
      Object.keys(filtered).length
    );

    await page.close();
  });

  test('search returns empty state when no term matches the query', async ({
    browser,
  }) => {
    test.slow();
    const page = await browser.newPage();
    await adminUser.login(page);

    await redirectToHomePage(page);
    await glossaryA.visitEntityPage(page);
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

    await page.close();
  });

  test('global filter toolbar is NOT shown in glossary scope', async ({
    browser,
  }) => {
    test.slow();
    const page = await browser.newPage();
    await adminUser.login(page);

    await redirectToHomePage(page);
    await glossaryA.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);

    await expect(
      page.getByTestId('ontology-explorer-header')
    ).not.toBeVisible();

    await page.close();
  });

  test('zoom and fit-view controls are visible in glossary scope', async ({
    browser,
  }) => {
    test.slow();
    const page = await browser.newPage();
    await adminUser.login(page);

    await redirectToHomePage(page);
    await glossaryA.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);

    await expect(page.getByTestId('fit-view')).toBeVisible();
    await expect(page.getByTestId('zoom-in')).toBeVisible();
    await expect(page.getByTestId('zoom-out')).toBeVisible();

    await page.close();
  });

  test('nested child term appears as a node in the glossary Relations Graph', async ({
    browser,
  }) => {
    const page = await browser.newPage();
    await adminUser.login(page);

    await redirectToHomePage(page);
    await glossaryA.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);

    const positions = await readNodePositions(page);

    expect(
      positions[termA1Child.responseData.id],
      'termA1Child (nested under termA1) must appear as a node'
    ).toBeDefined();
    expect(
      positions[termA1.responseData.id],
      'termA1 (parent) must still be visible'
    ).toBeDefined();

    await page.close();
  });

  test('a parentOf edge exists between a parent term and its child in the Relations Graph', async ({
    browser,
  }) => {
    const page = await browser.newPage();
    await adminUser.login(page);

    await redirectToHomePage(page);
    await glossaryA.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);

    const edges = await readGraphEdges(page);
    const parentId = termA1.responseData.id;
    const childId = termA1Child.responseData.id;

    const edge = edges.find(
      (e) =>
        (e.from === parentId && e.to === childId) ||
        (e.from === childId && e.to === parentId)
    );

    expect(
      edge,
      'A parentOf edge between termA1 and termA1Child must be rendered'
    ).toBeDefined();
    expect(edge?.relationType, 'The edge relationType must be "parentOf"').toBe(
      'parentOf'
    );

    await page.close();
  });

  test('deeply nested grandchild term appears as a node in the glossary Relations Graph', async ({
    browser,
  }) => {
    const page = await browser.newPage();
    await adminUser.login(page);

    await redirectToHomePage(page);
    await glossaryA.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);

    const positions = await readNodePositions(page);

    expect(
      positions[termA1Grandchild.responseData.id],
      'termA1Grandchild (two levels deep under termA1) must appear as a node'
    ).toBeDefined();
    expect(
      positions[termA1Child.responseData.id],
      'termA1Child (intermediate parent) must also be visible'
    ).toBeDefined();

    await page.close();
  });

  test('cross-glossary term related to a nested child appears as a node in the glossary Relations Graph', async ({
    browser,
  }) => {
    const page = await browser.newPage();
    await adminUser.login(page);

    await redirectToHomePage(page);
    await glossaryA.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);

    const positions = await readNodePositions(page);

    expect(
      positions[termC2.responseData.id],
      'termC2 (from glossaryC, related to the nested termA1Child) must appear via cross-glossary resolution'
    ).toBeDefined();
    expect(
      positions[termA1Child.responseData.id],
      'termA1Child (the nested term that holds the relation) must also be visible'
    ).toBeDefined();

    await page.close();
  });

  test('an edge exists between a nested child and its cross-glossary related term', async ({
    browser,
  }) => {
    const page = await browser.newPage();
    await adminUser.login(page);

    await redirectToHomePage(page);
    await glossaryA.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);

    const edges = await readGraphEdges(page);
    const childId = termA1Child.responseData.id;
    const c2Id = termC2.responseData.id;

    const hasEdge = edges.some(
      (e) =>
        (e.from === childId && e.to === c2Id) ||
        (e.from === c2Id && e.to === childId)
    );

    expect(
      hasEdge,
      'A relatedTo edge between the nested termA1Child and the cross-glossary termC2 must be rendered'
    ).toBe(true);

    await page.close();
  });
});
