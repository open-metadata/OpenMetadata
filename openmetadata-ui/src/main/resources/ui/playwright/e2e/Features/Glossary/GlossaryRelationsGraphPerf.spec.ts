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
import { expect, test } from '@playwright/test';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import {
  getDefaultAdminAPIContext,
  redirectToHomePage,
} from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';

// Regression coverage for the Sentry N+1 on the Relations Graph tab.
// Before: opening the tab on a term with cross-glossary relatedTerms fanned
// out 8+ sequential `GET /api/v1/glossaryTerms/{id}?fields=...` calls
// (~180ms each, ~1.4s total). The fix routes those through the new batch
// endpoint `GET /api/v1/glossaryTerms/byIds?ids=...`. This spec asserts
// zero per-Id by-Id fetches with the resolution-loop fields signature when
// visiting the tab — failing if anyone re-introduces a per-Id loop.

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

test.describe('Glossary Relations Graph — N+1 regression guard', () => {
  test('opening Relations Graph tab does NOT fan out per-Id glossary term fetches', async ({
    page,
  }) => {
    test.slow();
    const perIdRequests: string[] = [];
    const byIdsRequests: string[] = [];

    page.on('request', (request) => {
      const url = request.url();
      // Match the by-Id endpoint that the resolution loop used to fire.
      // Path shape: /api/v1/glossaryTerms/<uuid>?fields=relatedTerms,...
      const perIdMatch =
        /\/api\/v1\/glossaryTerms\/[0-9a-f-]{36}\?fields=/.test(url);
      // Match the new batch endpoint.
      const byIdsMatch = /\/api\/v1\/glossaryTerms\/byIds\?/.test(url);

      if (perIdMatch && url.includes('relatedTerms')) {
        perIdRequests.push(url);
      }
      if (byIdsMatch) {
        byIdsRequests.push(url);
      }
    });

    await redirectToHomePage(page);
    await termInA.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    // The new path's resolution loop calls /glossaryTerms/byIds once the
    // initial paginated load finds termInB's Id missing from termInA's
    // accumulated set. Using that response as the wait signal makes the
    // test deterministic regardless of how long graph rendering takes.
    const byIdsResponse = page.waitForResponse(
      (response) => /\/api\/v1\/glossaryTerms\/byIds\?/.test(response.url()),
      { timeout: 60_000 }
    );
    await page.getByRole('tab', { name: 'Relations Graph' }).click();
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    await byIdsResponse;
    await waitForAllLoadersToDisappear(page);

    // The old N+1 issued ≥8 of these. With the batch endpoint in place we
    // expect zero. Allow 0 strictly — a non-zero count means somebody added
    // a new per-Id resolution path or reverted the fix.
    expect(
      perIdRequests,
      'Per-Id /glossaryTerms/{id}?fields=relatedTerms,... requests must be zero — use /glossaryTerms/byIds instead'
    ).toHaveLength(0);

    // At least one batch call should be present, evidencing the new path.
    expect(
      byIdsRequests.length,
      '/glossaryTerms/byIds should be called at least once when resolving cross-glossary related terms'
    ).toBeGreaterThan(0);
  });
});
