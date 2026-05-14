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
 * Reusable factory for per-entity "live indexing + SearchIndexApp reindex parity" suites.
 *
 * Each suite runs two tests against the same entity instance:
 *   1. After live PATCH (Tier + Certification + classification tag + glossary term), the four
 *      Explore filters that target dedicated fields (`tier.tagFQN`,
 *      `certification.tagLabel.tagFQN`, `tags.tagFQN` for classification + glossary) match the
 *      entity.
 *   2. After a forced `recreate=true` reindex through `/api/v1/search/reindexEntities`, the
 *      same four filters still match the entity, AND the rebuilt ES doc shape preserves the
 *      separation (Tier NOT in tags[], certification on certification.tagLabel.tagFQN, etc.).
 *
 * If either path drifts — live or reindex — one of the two passes will fail.
 *
 * Adding a new entity type to the coverage matrix is a ~20-line spec that calls
 * {@link registerFilterSeparationSuite} with an entity factory.
 */

import { APIRequestContext, expect, Page, test } from '@playwright/test';
import { Operation } from 'fast-json-patch';
import { EntityClass } from '../../../support/entity/EntityClass';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { ClassificationClass } from '../../../support/tag/ClassificationClass';
import { TagClass } from '../../../support/tag/TagClass';
import { createAdminApiContext } from '../../../utils/admin';
import { redirectToHomePage } from '../../../utils/common';
import { checkExploreSearchFilter } from '../../../utils/entity';

const TIER_FQN = 'Tier.Tier1';
const CERTIFICATION_FQN = 'Certification.Gold';

/**
 * Structural shape every Playwright entity class implements. We don't extend {@link EntityClass}
 * directly because {@code create} / {@code delete} / {@code patch} are declared on the concrete
 * subclasses rather than on the abstract base.
 */
export type FilterSeparationEntity = EntityClass & {
  entityResponseData: { id: string; fullyQualifiedName?: string };
  create(apiContext: APIRequestContext): Promise<unknown>;
  delete(apiContext: APIRequestContext): Promise<unknown>;
  patch(opts: {
    apiContext: APIRequestContext;
    patchData: Operation[];
  }): Promise<unknown>;
};

export interface FilterSeparationOptions {
  /** Suite label rendered in Playwright output — usually the entity-type display name. */
  suiteName: string;
  /** Reindex payload `type` — must match ENTITY_PATH values, e.g. 'dashboard', 'topic'. */
  reindexEntityType: string;
  /** Factory called once per suite to construct a fresh entity instance. */
  entityFactory: () => FilterSeparationEntity;
}

/**
 * Registers a `test.describe.serial` block that exercises both indexing paths for the given
 * entity factory. Tag/glossary/classification fixtures are created once in `beforeAll` and
 * torn down in `afterAll`.
 */
export function registerFilterSeparationSuite(
  options: FilterSeparationOptions
): void {
  const { suiteName, reindexEntityType, entityFactory } = options;

  test.describe
    .serial(`${suiteName} | live + reindex filter separation`, () => {
    let entity: FilterSeparationEntity;
    const classification = new ClassificationClass();
    const classificationTag = new TagClass({
      classification: classification.data.name,
    });
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);

    test.beforeAll(async () => {
      test.slow();
      const { apiContext, afterAction } = await createAdminApiContext();
      await classification.create(apiContext);
      await classificationTag.create(apiContext);
      await glossary.create(apiContext);
      await glossaryTerm.create(apiContext);
      entity = entityFactory();
      await entity.create(apiContext);
      await applyAllFacets(apiContext, entity, classificationTag, glossaryTerm);
      await afterAction();
    });

    test.afterAll(async () => {
      const { apiContext, afterAction } = await createAdminApiContext();
      await entity.delete(apiContext);
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
        entity,
        classificationTag,
        glossaryTerm
      );
    });

    test('SearchIndexApp recreate reindex preserves searchable separation', async ({
      page,
    }) => {
      // POST /api/v1/search/reindexEntities requires admin scope. createAdminApiContext fetches
      // a fresh admin JWT without opening a UI page; the test's `page` fixture handles the
      // post-reindex Explore filter UI assertions.
      const { apiContext, afterAction } = await createAdminApiContext();

      const reindexRes = await apiContext.post(
        '/api/v1/search/reindexEntities?recreate=true',
        {
          data: [
            {
              id: entity.entityResponseData.id,
              type: reindexEntityType,
              fullyQualifiedName: entity.entityResponseData.fullyQualifiedName,
            },
          ],
        }
      );

      expect(reindexRes.status()).toBeLessThan(400);

      await assertReindexedDocPreservesSeparation(
        apiContext,
        entity,
        classificationTag,
        glossaryTerm
      );

      await afterAction();
      await redirectToHomePage(page);
      await assertAllFourFiltersWork(
        page,
        entity,
        classificationTag,
        glossaryTerm
      );
    });
  });
}

async function applyAllFacets(
  apiContext: APIRequestContext,
  entity: FilterSeparationEntity,
  classificationTag: TagClass,
  glossaryTerm: GlossaryTerm
): Promise<void> {
  await entity.patch({
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
          source: 'Classification',
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
}

async function assertReindexedDocPreservesSeparation(
  apiContext: APIRequestContext,
  entity: FilterSeparationEntity,
  classificationTag: TagClass,
  glossaryTerm: GlossaryTerm
): Promise<void> {
  await expect
    .poll(
      async () => {
        const res = await apiContext.get(
          `/api/v1/search/query?q=fullyQualifiedName:%22${encodeURIComponent(
            entity.entityResponseData.fullyQualifiedName ?? ''
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
          'post-reindex: tier must be on tier.tagFQN, certification on certification.tagLabel.tagFQN, classification + glossary tags in tags[], Tier.* must NOT leak into tags[]',
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
}

async function assertAllFourFiltersWork(
  page: Page,
  entity: FilterSeparationEntity,
  classificationTag: TagClass,
  glossaryTerm: GlossaryTerm
): Promise<void> {
  await checkExploreSearchFilter(page, 'Tier', 'tier.tagFQN', TIER_FQN, entity);
  await checkExploreSearchFilter(
    page,
    'Certification',
    'certification.tagLabel.tagFQN',
    CERTIFICATION_FQN,
    entity
  );
  await checkExploreSearchFilter(
    page,
    'Tag',
    'tags.tagFQN',
    classificationTag.responseData.fullyQualifiedName,
    entity
  );
  await checkExploreSearchFilter(
    page,
    'Tag',
    'tags.tagFQN',
    glossaryTerm.responseData.fullyQualifiedName,
    entity
  );
}
