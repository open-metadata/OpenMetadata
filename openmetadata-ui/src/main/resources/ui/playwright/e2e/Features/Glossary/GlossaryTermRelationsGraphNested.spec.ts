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
import { getDefaultAdminAPIContext, redirectToHomePage } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import {
  readGraphEdges,
  readNodePositions,
  waitForGraphLoaded,
} from '../../../utils/ontologyExplorer';

test.use({ storageState: 'playwright/.auth/admin.json' });

const nestedGlossary = new Glossary();
const parentTerm = new GlossaryTerm(nestedGlossary);
// parent set in beforeAll after parentTerm is created
const childTerm = new GlossaryTerm(nestedGlossary);

test.beforeAll('Seed test data', async ({ browser }) => {
  const { apiContext, afterAction } = await getDefaultAdminAPIContext(browser);

  await nestedGlossary.create(apiContext);
  await parentTerm.create(apiContext);

  childTerm.data.parent = parentTerm.responseData.fullyQualifiedName;
  await childTerm.create(apiContext);

  await afterAction();
});

test.afterAll('Cleanup test data', async ({ browser }) => {
  const { apiContext, afterAction } = await getDefaultAdminAPIContext(browser);

  await childTerm.delete(apiContext);
  await parentTerm.delete(apiContext);
  await nestedGlossary.delete(apiContext);

  await afterAction();
});

test.describe('Glossary Term — Relations Graph (nested / parent-child)', () => {
  test('viewing a child term: parent appears as a 1-hop neighbour via parentOf edge', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await childTerm.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);

    const positions = await readNodePositions(page);

    expect(
      positions[childTerm.responseData.id],
      'the viewed child term must be present as a node'
    ).toBeDefined();
    expect(
      positions[parentTerm.responseData.id],
      'the parent term must appear as a 1-hop neighbour of the child'
    ).toBeDefined();
  });

  test('viewing a child term: parentOf edge is rendered between parent and child', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await childTerm.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);

    const edges = await readGraphEdges(page);
    const pId = parentTerm.responseData.id;
    const cId = childTerm.responseData.id;

    const edge = edges.find(
      (e) =>
        (e.from === pId && e.to === cId) || (e.from === cId && e.to === pId)
    );

    expect(
      edge,
      'a parentOf edge between parentTerm and childTerm must be rendered'
    ).toBeDefined();
    expect(edge?.relationType, 'edge relationType must be "parentOf"').toBe(
      'parentOf'
    );
  });

  test('viewing the parent term: child appears as a 1-hop neighbour via parentOf edge', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await parentTerm.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);

    const positions = await readNodePositions(page);

    expect(
      positions[parentTerm.responseData.id],
      'the viewed parent term must be present as a node'
    ).toBeDefined();
    expect(
      positions[childTerm.responseData.id],
      'the child term must appear as a 1-hop neighbour of the parent'
    ).toBeDefined();
  });

  test('viewing the parent term: parentOf edge is rendered between parent and child', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await parentTerm.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await waitForGraphLoaded(page);

    const edges = await readGraphEdges(page);
    const pId = parentTerm.responseData.id;
    const cId = childTerm.responseData.id;

    const edge = edges.find(
      (e) =>
        (e.from === pId && e.to === cId) || (e.from === cId && e.to === pId)
    );

    expect(
      edge,
      'a parentOf edge between parentTerm and childTerm must be rendered'
    ).toBeDefined();
    expect(edge?.relationType, 'edge relationType must be "parentOf"').toBe(
      'parentOf'
    );
  });
});
