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

/**
 * Locks in the doc-shape separation that both the live-indexing path and the SearchIndexApp
 * reindex path produce. The Explore page must be able to filter the same Table by Tier,
 * Certification, classification tags and glossary terms — using the dedicated fields
 * (`tier.tagFQN`, `certification.tagLabel.tagFQN`, `tags.tagFQN`) rather than treating `tags[]`
 * as an all-encompassing bag.
 *
 * The spec runs the filter assertions twice for the same Table: once after live updates
 * (post-PATCH), then again after a forced `recreate=true` reindex. Both paths must produce a
 * doc shape that all four filters can find — if either path drifts, the second pass fails.
 */

import test, { expect } from '@playwright/test';
import { TableClass } from '../../../support/entity/TableClass';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { ClassificationClass } from '../../../support/tag/ClassificationClass';
import { TagClass } from '../../../support/tag/TagClass';
import { createNewPage, redirectToHomePage } from '../../../utils/common';
import { checkExploreSearchFilter } from '../../../utils/entity';

test.use({ storageState: 'playwright/.auth/admin.json' });

const TIER_FQN = 'Tier.Tier1';
const CERTIFICATION_FQN = 'Certification.Gold';

test.describe
  .serial('Explore filters survive live update + recreate reindex', () => {
  const table = new TableClass();
  const classification = new ClassificationClass();
  const classificationTag = new TagClass({
    classification: classification.data.name,
  });
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);

  test.beforeAll(async ({ browser }) => {
    test.slow();
    const { apiContext, afterAction } = await createNewPage(browser);

    await classification.create(apiContext);
    await classificationTag.create(apiContext);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    await table.create(apiContext);

    await table.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/tags/0',
          value: {
            name: 'Tier1',
            tagFQN: TIER_FQN,
            labelType: 'Manual',
            state: 'Confirmed',
          },
        },
        {
          op: 'add',
          path: '/tags/1',
          value: {
            tagFQN: classificationTag.responseData.fullyQualifiedName,
            labelType: 'Manual',
            state: 'Confirmed',
            source: 'Classification',
          },
        },
        {
          op: 'add',
          path: '/tags/2',
          value: {
            tagFQN: glossaryTerm.responseData.fullyQualifiedName,
            labelType: 'Manual',
            state: 'Confirmed',
            source: 'Glossary',
          },
        },
        {
          op: 'add',
          path: '/certification',
          value: {
            tagLabel: {
              tagFQN: CERTIFICATION_FQN,
              labelType: 'Manual',
              state: 'Confirmed',
              source: 'Classification',
            },
          },
        },
      ],
    });

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await table.delete(apiContext);
    await glossaryTerm.delete(apiContext);
    await glossary.delete(apiContext);
    await classificationTag.delete(apiContext);
    await classification.delete(apiContext);
    await afterAction();
  });

  test('live indexing produces searchable separation for all four facets', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await assertAllFourFiltersWork(
      page,
      table,
      classificationTag,
      glossaryTerm
    );
  });

  test('SearchIndexApp recreate reindex preserves searchable separation', async ({
    page,
    browser,
  }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    const reindexRes = await apiContext.post(
      '/api/v1/search/reindexEntities?recreate=true',
      {
        data: [
          {
            id: table.entityResponseData.id,
            type: 'table',
            fullyQualifiedName: table.entityResponseData.fullyQualifiedName,
          },
        ],
      }
    );

    expect(reindexRes.status()).toBeLessThan(400);

    // Wait for the rebuilt doc to be searchable through every dedicated field. If reindex
    // produced a different shape than live indexing, one of the dedicated fields will be
    // missing or the wrong value.
    await expect
      .poll(
        async () => {
          const res = await apiContext.get(
            `/api/v1/search/query?q=fullyQualifiedName.keyword:%22${encodeURIComponent(
              table.entityResponseData.fullyQualifiedName ?? ''
            )}%22&index=dataAsset`
          );
          if (res.status() !== 200) {
            return undefined;
          }
          const body = await res.json();
          const source = body?.hits?.hits?.[0]?._source;
          if (!source) {
            return undefined;
          }

          return {
            tier: source.tier?.tagFQN,
            certification: source.certification?.tagLabel?.tagFQN,
            hasClassificationTag: (source.tags ?? []).some(
              (t: { tagFQN?: string }) =>
                t.tagFQN === classificationTag.responseData.fullyQualifiedName
            ),
            hasGlossaryTag: (source.tags ?? []).some(
              (t: { tagFQN?: string }) =>
                t.tagFQN === glossaryTerm.responseData.fullyQualifiedName
            ),
            tierNotInTagsBag: !(source.tags ?? []).some(
              (t: { tagFQN?: string }) => t.tagFQN === TIER_FQN
            ),
          };
        },
        {
          message:
            'post-reindex: tier must be on tier.tagFQN, certification on certification.tagLabel.tagFQN, classification + glossary tags in tags[], and Tier.* must NOT leak into tags[]',
          timeout: 60_000,
        }
      )
      .toEqual({
        tier: TIER_FQN,
        certification: CERTIFICATION_FQN,
        hasClassificationTag: true,
        hasGlossaryTag: true,
        tierNotInTagsBag: true,
      });

    await afterAction();
    await redirectToHomePage(page);
    await assertAllFourFiltersWork(
      page,
      table,
      classificationTag,
      glossaryTerm
    );
  });
});

async function assertAllFourFiltersWork(
  page: import('@playwright/test').Page,
  table: TableClass,
  classificationTag: TagClass,
  glossaryTerm: GlossaryTerm
) {
  // 1. Tier filter — uses `tier.tagFQN`, NOT `tags.tagFQN`.
  await checkExploreSearchFilter(page, 'Tier', 'tier.tagFQN', TIER_FQN, table);

  // 2. Certification filter — uses `certification.tagLabel.tagFQN`.
  await checkExploreSearchFilter(
    page,
    'Certification',
    'certification.tagLabel.tagFQN',
    CERTIFICATION_FQN,
    table
  );

  // 3. Classification tag filter — `tags.tagFQN` is for non-Tier classification + glossary tags.
  await checkExploreSearchFilter(
    page,
    'Tag',
    'tags.tagFQN',
    classificationTag.responseData.fullyQualifiedName,
    table
  );

  // 4. Glossary term filter — same `tags.tagFQN` path; the source distinguishes Classification
  // from Glossary inside the array.
  await checkExploreSearchFilter(
    page,
    'Tag',
    'tags.tagFQN',
    glossaryTerm.responseData.fullyQualifiedName,
    table
  );
}
