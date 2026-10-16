/*
 *  Copyright 2025 Collate.
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
import { expect, test } from '../../../support/fixtures/base';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import {
  getDefaultAdminAPIContext,
  redirectToHomePage,
} from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { readNodePositions } from '../../../utils/ontologyStudio';

// Regression coverage for the Relations Graph loading path (#32962).
// The tab used to load the whole glossary and then hydrate related terms up to
// five levels deep through sequential /glossaryTerms/byIds batches, which on a
// dense ontology fetched the entire catalogue. It must now fetch only the
// focused term and draw cross-glossary neighbours from their references.

test.use({ storageState: 'playwright/.auth/admin.json' });

const glossaryA = new Glossary();
const glossaryB = new Glossary();
const termInA = new GlossaryTerm(glossaryA);
const termInB = new GlossaryTerm(glossaryB);

test.beforeAll(
  'Seed two glossaries with a cross-glossary relation',
  async ({ browser }) => {
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      browser
    );

    await glossaryA.create(apiContext);
    await glossaryB.create(apiContext);
    await termInA.create(apiContext);
    await termInB.create(apiContext);

    // Point termInA -> termInB so the Relations Graph for termInA has a node
    // whose Id wouldn't appear in glossaryA's term list — the exact shape
    // that triggered the old recursive resolution N+1. The /relatedTerms
    // path stores `TermRelation` objects ({relationType, term}), not bare
    // EntityReferences — matches the addTermRelation helper shape.
    await termInA.patch(apiContext, [
      {
        op: 'add',
        path: '/relatedTerms/0',
        value: {
          relationType: 'relatedTo',
          term: {
            id: termInB.responseData.id,
            type: 'glossaryTerm',
            name: termInB.responseData.name,
            displayName: termInB.responseData.displayName,
            fullyQualifiedName: termInB.responseData.fullyQualifiedName,
          },
        },
      },
    ]);

    await afterAction();
  }
);

test.afterAll('Cleanup glossaries', async ({ browser }) => {
  const { apiContext, afterAction } = await getDefaultAdminAPIContext(browser);

  await termInA.delete(apiContext);
  await termInB.delete(apiContext);
  await glossaryA.delete(apiContext);
  await glossaryB.delete(apiContext);

  await afterAction();
});

test.describe('Glossary Relations Graph — bounded loading guard', () => {
  test('loads only the focused term and draws cross-glossary neighbours without hydration', async ({
    page,
  }) => {
    test.slow();

    await redirectToHomePage(page);
    await termInA.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    const termFetches: string[] = [];
    const byIdsRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (/\/api\/v1\/glossaryTerms\/byIds\?/.test(url)) {
        byIdsRequests.push(url);
      }
      if (
        /\/api\/v1\/glossaryTerms\/[0-9a-f-]{36}\?fields=/.test(url) &&
        url.includes('relatedTerms')
      ) {
        termFetches.push(url);
      }
    });

    const focusedTermResponse = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes(`/api/v1/glossaryTerms/${termInA.responseData.id}?`) &&
        response.url().includes('relatedTerms')
    );
    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await focusedTermResponse;

    await expect
      .poll(async () => Object.keys(await readNodePositions(page)), {
        message: 'the cross-glossary neighbour must be drawn in the graph',
      })
      .toEqual(
        expect.arrayContaining([
          termInA.responseData.id,
          termInB.responseData.id,
        ])
      );

    expect(
      termFetches,
      'Only the focused term should be fetched with its relations'
    ).toHaveLength(1);
    expect(
      byIdsRequests,
      'Related terms must be drawn from their references, not hydrated via /glossaryTerms/byIds'
    ).toHaveLength(0);
  });
});
