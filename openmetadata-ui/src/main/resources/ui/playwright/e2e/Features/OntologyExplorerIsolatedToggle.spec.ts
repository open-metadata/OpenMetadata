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
  createApiContext,
  deleteEntities,
  disposeApiContext,
  navigateAndFilterByGlossary,
  readNodePositions,
  waitForNodeAbsent,
  waitForNodePresent,
} from '../../utils/ontologyExplorer';

test.use({ storageState: 'playwright/.auth/admin.json' });

const toggleGlossary = new Glossary();
const toggleTermA = new GlossaryTerm(toggleGlossary);
const toggleTermB = new GlossaryTerm(toggleGlossary);
const toggleTermIso = new GlossaryTerm(toggleGlossary);

test.beforeAll(async ({ browser }) => {
  const { page, apiContext } = await createApiContext(browser);

  await toggleGlossary.create(apiContext);
  await toggleTermA.create(apiContext);
  await toggleTermB.create(apiContext);
  await toggleTermIso.create(apiContext);
  await addTermRelation(apiContext, toggleTermA, toggleTermB, 'relatedTo');

  await disposeApiContext(page, apiContext);
});

test.afterAll(async ({ browser }) => {
  const { page, apiContext } = await createApiContext(browser);
  await deleteEntities(
    apiContext,
    toggleTermA,
    toggleTermB,
    toggleTermIso,
    toggleGlossary
  );
  await disposeApiContext(page, apiContext);
});

test.describe('Ontology Explorer — isolated nodes toggle', () => {
  test('isolated term is visible by default (showIsolatedNodes = true)', async ({
    page,
  }) => {
    test.slow();
    await navigateAndFilterByGlossary(page, toggleGlossary.responseData.id);

    const positions = await readNodePositions(page);

    expect(
      positions[toggleTermIso.responseData.id],
      'isolated term must be visible because showIsolatedNodes defaults to true'
    ).toBeDefined();
    expect(
      positions[toggleTermA.responseData.id],
      'connected term A must also be visible'
    ).toBeDefined();
    expect(
      positions[toggleTermB.responseData.id],
      'connected term B must also be visible'
    ).toBeDefined();
  });

  test('toggling isolated nodes OFF hides the isolated term', async ({
    page,
  }) => {
    test.slow();
    await navigateAndFilterByGlossary(page, toggleGlossary.responseData.id);

    await page.getByTestId('ontology-isolated-toggle').click();
    await waitForNodeAbsent(page, toggleTermIso.responseData.id);

    const positions = await readNodePositions(page);

    expect(
      positions[toggleTermIso.responseData.id],
      'isolated term must be hidden after toggling showIsolatedNodes OFF'
    ).toBeUndefined();
    expect(
      positions[toggleTermA.responseData.id],
      'connected term A must still be visible'
    ).toBeDefined();
    expect(
      positions[toggleTermB.responseData.id],
      'connected term B must still be visible'
    ).toBeDefined();
  });

  test('toggling isolated nodes back ON restores the isolated term', async ({
    page,
  }) => {
    test.slow();
    await navigateAndFilterByGlossary(page, toggleGlossary.responseData.id);

    await page.getByTestId('ontology-isolated-toggle').click();
    await waitForNodeAbsent(page, toggleTermIso.responseData.id);

    await page.getByTestId('ontology-isolated-toggle').click();
    await waitForNodePresent(page, toggleTermIso.responseData.id);

    const positions = await readNodePositions(page);

    expect(
      positions[toggleTermIso.responseData.id],
      'isolated term must be restored after toggling showIsolatedNodes back ON'
    ).toBeDefined();
  });
});
