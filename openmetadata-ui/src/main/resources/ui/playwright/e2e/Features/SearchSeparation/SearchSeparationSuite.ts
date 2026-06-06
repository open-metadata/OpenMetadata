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
import { SidebarItem } from '../../../constant/sidebar';
import { EntityClass } from '../../../support/entity/EntityClass';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { ClassificationClass } from '../../../support/tag/ClassificationClass';
import { TagClass } from '../../../support/tag/TagClass';
import { createAdminApiContext } from '../../../utils/admin';
import { redirectToHomePage } from '../../../utils/common';
import {
  checkExploreSearchFilter,
  waitForAllLoadersToDisappear,
} from '../../../utils/entity';
import { searchAndClickOnOption } from '../../../utils/explore';
import { sidebarClick } from '../../../utils/sidebar';

const TIER_FQN = 'Tier.Tier1';
const CERTIFICATION_FQN = 'Certification.Gold';

/**
 * Structural shape every Playwright entity class implements. We don't extend {@link EntityClass}
 * directly because {@code create} / {@code delete} / {@code patch} are declared on the concrete
 * subclasses rather than on the abstract base.
 */
export type FilterSeparationEntity = EntityClass & {
  entityResponseData: { id: string; fullyQualifiedName?: string };
  serviceResponseData?: { name?: string; displayName?: string };
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
    // Each test does entity setup + reindex + multiple ES polls + Explore UI assertions,
    // which can legitimately exceed Playwright's default 30s per-test timeout. Configure
    // both the per-test timeout (covers the actual tests) and the per-hook timeout (covers
    // beforeAll's entity create + PATCH and afterAll's teardown) explicitly rather than
    // relying on test.slow() inside a hook, which is not a supported way to extend hook
    // timeouts.
    test.describe.configure({ timeout: 180_000 });

    let entity: FilterSeparationEntity;
    const classification = new ClassificationClass();
    const classificationTag = new TagClass({
      classification: classification.data.name,
    });
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);

    test.beforeAll(async () => {
      test.setTimeout(180_000);
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
      test.setTimeout(180_000);
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
      const { apiContext, afterAction } = await createAdminApiContext();
      let serviceDisplayName: string | undefined;
      try {
        ({ serviceDisplayName } = await waitForLiveIndex(apiContext, entity));
      } finally {
        await afterAction();
      }
      await redirectToHomePage(page);
      await assertAllFourFiltersWork(
        page,
        entity,
        classificationTag,
        glossaryTerm,
        serviceDisplayName
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

      const { serviceDisplayName } =
        await assertReindexedDocPreservesSeparation(
          apiContext,
          entity,
          classificationTag,
          glossaryTerm
        );

      await afterAction();
      await redirectToHomePage(page);
      await assertAllFourFiltersWorkWithRetry(
        page,
        entity,
        classificationTag,
        glossaryTerm,
        serviceDisplayName
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

async function waitForLiveIndex(
  apiContext: APIRequestContext,
  entity: FilterSeparationEntity
): Promise<{ serviceDisplayName?: string }> {
  let serviceDisplayName: string | undefined;

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
        if (source?.service?.displayName) {
          serviceDisplayName = source.service.displayName as string;
        }

        return source?.tier?.tagFQN;
      },
      {
        message: 'waiting for live indexing to propagate tier to ES',
        timeout: 60_000,
      }
    )
    .toEqual(TIER_FQN);

  return { serviceDisplayName };
}

async function assertReindexedDocPreservesSeparation(
  apiContext: APIRequestContext,
  entity: FilterSeparationEntity,
  classificationTag: TagClass,
  glossaryTerm: GlossaryTerm
): Promise<{ serviceDisplayName?: string }> {
  let serviceDisplayName: string | undefined;

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
        if (source?.service?.displayName) {
          serviceDisplayName = source.service.displayName as string;
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

  return { serviceDisplayName };
}

async function assertAllFourFiltersWorkWithRetry(
  page: Page,
  entity: FilterSeparationEntity,
  classificationTag: TagClass,
  glossaryTerm: GlossaryTerm,
  serviceDisplayName?: string,
  maxAttempts = 3
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await assertAllFourFiltersWork(
        page,
        entity,
        classificationTag,
        glossaryTerm,
        serviceDisplayName
      );

      return;
    } catch (err) {
      if (attempt === maxAttempts) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 8_000));
    }
  }
}

async function checkExploreFilterWithServiceBase(
  page: Page,
  filterLabel: string,
  filterKey: string,
  filterValue: string,
  entity: FilterSeparationEntity,
  serviceName: string
): Promise<void> {
  await sidebarClick(page, SidebarItem.EXPLORE);

  await page.getByTestId('search-dropdown-Service').click();
  await searchAndClickOnOption(
    page,
    {
      label: 'Service',
      key: 'service.displayName.keyword',
      value: serviceName,
    },
    true
  );
  await page.click('[data-testid="update-btn"]');
  await waitForAllLoadersToDisappear(page);

  await page.getByTestId(`search-dropdown-${filterLabel}`).click();
  await searchAndClickOnOption(
    page,
    { label: filterLabel, key: filterKey, value: filterValue },
    true
  );
  await page.click('[data-testid="update-btn"]');
  await waitForAllLoadersToDisappear(page);

  await expect(
    page.getByTestId(
      `table-data-card_${entity.entityResponseData.fullyQualifiedName}`
    )
  ).toBeVisible();

  await page.click('[data-testid="clear-filters"]');
  await entity.visitEntityPage(page);
}
async function checkExploreFilterWithTagBase(
  page: Page,
  filterLabel: string,
  filterKey: string,
  filterValue: string,
  entity: FilterSeparationEntity,
  uniqueTagFqn: string
): Promise<void> {
  await sidebarClick(page, SidebarItem.EXPLORE);

  await page.getByTestId('search-dropdown-Tag').click();
  await searchAndClickOnOption(
    page,
    { label: 'Tag', key: 'tags.tagFQN', value: uniqueTagFqn },
    true
  );
  await page.click('[data-testid="update-btn"]');
  await waitForAllLoadersToDisappear(page);

  await page.getByTestId(`search-dropdown-${filterLabel}`).click();
  await searchAndClickOnOption(
    page,
    { label: filterLabel, key: filterKey, value: filterValue },
    true
  );
  await page.click('[data-testid="update-btn"]');
  await waitForAllLoadersToDisappear(page);

  await expect(
    page.getByTestId(
      `table-data-card_${entity.entityResponseData.fullyQualifiedName}`
    )
  ).toBeVisible();

  await page.click('[data-testid="clear-filters"]');
  await entity.visitEntityPage(page);
}

async function assertAllFourFiltersWork(
  page: Page,
  entity: FilterSeparationEntity,
  classificationTag: TagClass,
  glossaryTerm: GlossaryTerm,
  serviceDisplayName?: string
): Promise<void> {
  const svcData = entity.serviceResponseData;
  const serviceName =
    serviceDisplayName || svcData?.displayName || svcData?.name;

  const classificationTagFqn =
    classificationTag.responseData.fullyQualifiedName;
  const glossaryTermFqn = glossaryTerm.responseData.fullyQualifiedName;

  // Tier and Certification are constant values shared across all parallel test runs.
  // classificationTag and glossaryTerm FQNs contain a per-run UUID so they are unique.
  const sharedFilters: Array<{ label: string; key: string; value: string }> = [
    { label: 'Tier', key: 'tier.tagFQN', value: TIER_FQN },
    {
      label: 'Certification',
      key: 'certification.tagLabel.tagFQN',
      value: CERTIFICATION_FQN,
    },
  ];

  const uniqueFilters: Array<{ label: string; key: string; value: string }> = [
    { label: 'Tag', key: 'tags.tagFQN', value: classificationTagFqn },
    { label: 'Tag', key: 'tags.tagFQN', value: glossaryTermFqn },
  ];

  if (serviceName) {
    await checkExploreSearchFilter(
      page,
      'Service',
      'service.displayName.keyword',
      serviceName,
      entity
    );
    for (const filter of [...sharedFilters, ...uniqueFilters]) {
      await checkExploreFilterWithServiceBase(
        page,
        filter.label,
        filter.key,
        filter.value,
        entity,
        serviceName
      );
    }
  } else {
    // Shared filters: pre-narrow by the per-run unique classificationTag so the
    // target entity is always on page 1, regardless of how many other parallel-run
    // entities also carry Tier.Tier1 or Certification.Gold.
    for (const filter of sharedFilters) {
      await checkExploreFilterWithTagBase(
        page,
        filter.label,
        filter.key,
        filter.value,
        entity,
        classificationTagFqn
      );
    }
    // Unique filters: classificationTag and glossaryTerm FQNs are unique per run,
    // so a standalone check is sufficient — only this test's entity has them.
    for (const filter of uniqueFilters) {
      await checkExploreSearchFilter(
        page,
        filter.label,
        filter.key,
        filter.value,
        entity
      );
    }
  }
}
