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
import { expect, test } from '../../support/fixtures/base';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import {
  addTermRelation,
  createApiContext,
  deleteEntities,
  disposeApiContext,
  navigateAndFilterByGlossary,
  readNodePositions,
} from '../../utils/ontologyStudio';

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

test.describe('Ontology Studio — isolated concepts', () => {
  test('shows isolated concepts in the graph, health panel, and header count', async ({
    page,
  }) => {
    test.slow();
    await navigateAndFilterByGlossary(page, toggleGlossary.responseData.id);

    await expect
      .poll(
        async () => {
          const positions = await readNodePositions(page);

          return [toggleTermIso, toggleTermA, toggleTermB].every(
            (term) => positions[term.responseData.id]
          );
        },
        { message: 'all scoped concepts must be visible in the graph' }
      )
      .toBe(true);
    await expect(page.getByTestId('ontology-health-panel')).toBeVisible();
    await expect(
      page.getByTestId(`ontology-connect-${toggleTermIso.responseData.id}`)
    ).toBeVisible();
    await expect(page.getByTestId('ontology-isolated-count')).toHaveText('1');
    await expect(
      page.getByTestId('ontology-header-isolated-count')
    ).toContainText(/1\s*isolated/i);
  });
});
