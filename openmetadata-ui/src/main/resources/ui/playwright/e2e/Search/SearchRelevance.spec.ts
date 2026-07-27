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

import test, {
  expect,
  type APIRequestContext,
  type Page,
  type Response,
} from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { getApiContext, redirectToHomePage } from '../../utils/common';
import { sidebarClick } from '../../utils/sidebar';

const RELEVANCE_QUERY = 'provider address texas';
const STOPWORD_RELEVANCE_QUERY = 'provider address in texas';
const CUSTOMER_QUERY = 'customer';
const CUSTOMERS_QUERY = 'customers';
const CUSTOMER_PROFILE_QUERY = 'customer profile';
const CUSTOMER_PROFILE_STATUS_QUERY = 'customer profile status';
const CUSTOMER_PROFILES_QUERY = 'customer profiles';
const CLEAR_NAME_TABLE_FQN =
  'sample_data.ecommerce_db.shopify.provider_address';
const EXACT_TABLE_FQN =
  'sample_data.ecommerce_db.shopify.provider_address_texas';
const STRUCTURAL_TABLE_FQN =
  'sample_data.ecommerce_db.shopify.provider_directory';
const STRUCTURAL_ONLY_TABLE_FQN =
  'sample_data.ecommerce_db.shopify.service_job_registry';
const TIER_USAGE_DESCRIPTION_TABLE_FQN =
  'sample_data.ecommerce_db.shopify.regional_directory_tier1_usage';
const WEAK_TIER_USAGE_DESCRIPTION_TABLE_FQN =
  'sample_data.ecommerce_db.shopify.work';
const CUSTOMER_TABLE_FQN = 'sample_data.ecommerce_db.shopify.customer';
const CUSTOMERS_TABLE_FQN = 'sample_data.ecommerce_db.shopify.customers';
const CUSTOMER_PROFILE_TABLE_FQN =
  'sample_data.ecommerce_db.shopify.customer_profile';
const CUSTOMER_PROFILES_TABLE_FQN =
  'sample_data.ecommerce_db.shopify.customer_profiles';
const CUSTOMER_STRUCTURAL_TABLE_FQN =
  'sample_data.ecommerce_db.shopify.identity_resolution_registry';
const CUSTOMER_WEAK_TIER_USAGE_TABLE_FQN =
  'sample_data.ecommerce_db.shopify.support_case_rollup_tier1_usage';

interface SearchFixture {
  fqn: string;
  index: string;
}

interface RankedFixture {
  key: string;
  fqn: string;
}

const RELEVANCE_FIXTURES: ReadonlyArray<SearchFixture> = [
  {
    fqn: EXACT_TABLE_FQN,
    index: 'table',
  },
  {
    fqn: 'sample_kafka.provider_address_texas_events',
    index: 'topic',
  },
  {
    fqn: 'sample_superset.provider_address_texas_dashboard',
    index: 'dashboard',
  },
  {
    fqn: 'sample_airflow.provider_address_texas_pipeline',
    index: 'pipeline',
  },
  {
    fqn: 'mlflow_svc.provider_address_texas_model',
    index: 'mlmodel',
  },
  {
    fqn: 's3_storage_sample.departments.provider_address_texas_exports',
    index: 'container',
  },
  {
    fqn: 'elasticsearch_sample.provider_address_texas_index',
    index: 'searchIndex',
  },
  {
    fqn: 'sample_api_service.pet.provider_address_texas_endpoint',
    index: 'apiEndpoint',
  },
];

const CUSTOMER_RELEVANCE_FIXTURES: ReadonlyArray<SearchFixture> = [
  {
    fqn: CUSTOMER_PROFILES_TABLE_FQN,
    index: 'table',
  },
  {
    fqn: 'sample_kafka.customer_profiles_events',
    index: 'topic',
  },
  {
    fqn: 'sample_superset.customer_profiles_dashboard',
    index: 'dashboard',
  },
  {
    fqn: 'sample_airflow.customer_profiles_pipeline',
    index: 'pipeline',
  },
  {
    fqn: 'mlflow_svc.customer_profiles_model',
    index: 'mlmodel',
  },
  {
    fqn: 's3_storage_sample.departments.customer_profiles_exports',
    index: 'container',
  },
  {
    fqn: 'elasticsearch_sample.customer_profiles_index',
    index: 'searchIndex',
  },
  {
    fqn: 'sample_api_service.pet.customer_profiles_endpoint',
    index: 'apiEndpoint',
  },
];

interface SearchHitSource {
  fullyQualifiedName?: string;
  name?: string;
}

interface SearchHit {
  _score?: number;
  _source?: SearchHitSource;
  matched_queries?: string[];
}

interface SearchResponse {
  hits?: {
    hits?: SearchHit[];
  };
}

interface SearchPreviewRequest {
  explain?: boolean;
}

const isSearchPreviewResponse = (response: Response, explain?: boolean) => {
  if (
    !response.url().includes('/api/v1/search/preview') ||
    response.status() !== 200
  ) {
    return false;
  }

  const postData = response.request().postData();

  if (!postData) {
    return false;
  }

  const payload = JSON.parse(postData) as SearchPreviewRequest;

  return explain === undefined || Boolean(payload.explain) === explain;
};

const getSearchHits = async (
  apiContext: APIRequestContext,
  index: string,
  query: string,
  options?: { explain?: boolean; size?: number }
) => {
  const params: Record<string, boolean | number | string> = {
    deleted: false,
    from: 0,
    index,
    q: query,
    size: options?.size ?? 20,
    sort_field: '_score',
    sort_order: 'desc',
  };

  if (options?.explain !== undefined) {
    params.explain = options.explain;
  }

  const response = await apiContext.get('/api/v1/search/query', {
    params,
  });

  if (!response.ok()) {
    throw new Error(
      `Search API failed with ${response.status()}: ${await response.text()}`
    );
  }

  const payload = (await response.json()) as SearchResponse;

  return payload.hits?.hits ?? [];
};

const fqnOf = (hit: SearchHit) => hit._source?.fullyQualifiedName ?? '';

const findRank = (fqns: string[], fqn: string) =>
  fqns.findIndex((value) => value === fqn);

const compareTableFixtureRanks = async (
  apiContext: APIRequestContext,
  query: string,
  fixtures: ReadonlyArray<RankedFixture>,
  weakFixtureFqn: string
): Promise<Record<string, boolean>> => {
  const hits = await getSearchHits(apiContext, 'table', query, { size: 100 });
  const fqns = hits.map(fqnOf);
  const weakFixtureRank = findRank(fqns, weakFixtureFqn);
  const rankComparison: Record<string, boolean> = {};

  for (const fixture of fixtures) {
    const fixtureRank = findRank(fqns, fixture.fqn);

    rankComparison[fixture.key] =
      fixtureRank >= 0 && weakFixtureRank >= 0 && fixtureRank < weakFixtureRank;
  }

  return rankComparison;
};

const searchTableFixtures = async (
  apiContext: APIRequestContext,
  query = RELEVANCE_QUERY
) => {
  const hits = await getSearchHits(apiContext, 'table', query, { size: 50 });
  const fqns = hits.map(fqnOf);
  const clearNameRank = findRank(fqns, CLEAR_NAME_TABLE_FQN);
  const exactRank = findRank(fqns, EXACT_TABLE_FQN);
  const structuralRank = findRank(fqns, STRUCTURAL_TABLE_FQN);
  const structuralOnlyRank = findRank(fqns, STRUCTURAL_ONLY_TABLE_FQN);
  const descriptionRank = findRank(fqns, TIER_USAGE_DESCRIPTION_TABLE_FQN);
  const weakDescriptionRank = findRank(
    fqns,
    WEAK_TIER_USAGE_DESCRIPTION_TABLE_FQN
  );

  return {
    exactBeforeDescription:
      exactRank >= 0 && descriptionRank >= 0 && exactRank < descriptionRank,
    exactBeforeWeakDescription:
      exactRank >= 0 &&
      weakDescriptionRank >= 0 &&
      exactRank < weakDescriptionRank,
    exactBeforeStructural:
      exactRank >= 0 && structuralRank >= 0 && exactRank < structuralRank,
    clearNameBeforeWeakDescription:
      clearNameRank >= 0 &&
      weakDescriptionRank >= 0 &&
      clearNameRank < weakDescriptionRank,
    structuralBeforeDescription:
      structuralRank >= 0 &&
      descriptionRank >= 0 &&
      structuralRank < descriptionRank,
    structuralBeforeWeakDescription:
      structuralRank >= 0 &&
      weakDescriptionRank >= 0 &&
      structuralRank < weakDescriptionRank,
    structuralOnlyBeforeWeakDescription:
      structuralOnlyRank >= 0 &&
      weakDescriptionRank >= 0 &&
      structuralOnlyRank < weakDescriptionRank,
  };
};

const searchFixture = async (
  apiContext: APIRequestContext,
  fixture: SearchFixture,
  query = RELEVANCE_QUERY
) => {
  const hits = await getSearchHits(apiContext, fixture.index, query);

  return hits.some((hit) => fqnOf(hit) === fixture.fqn);
};

const searchForExactTableWithRankingDetails = async (page: Page) => {
  await sidebarClick(page, SidebarItem.EXPLORE);

  await page.getByRole('button', { name: 'Tools' }).click();
  await page.getByRole('menuitemradio', { name: 'Ranking Details' }).click();

  await page.getByTestId('global-search-selector').click();
  await page.getByTestId('global-search-select-option-Table').click();

  const searchResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('index=table') &&
      response.url().includes('q=provider_address_texas') &&
      response.url().includes('explain=true') &&
      response.status() === 200
  );

  const searchBox = page
    .getByTestId('navbar-search-container')
    .getByTestId('searchBox');

  await searchBox.fill('provider_address_texas');
  await searchBox.press('Enter');
  await searchResponse;

  await page.getByTestId('search-container').getByTestId('loader').waitFor({
    state: 'detached',
  });
  await page.getByTestId('search-results').waitFor({
    state: 'visible',
  });
};

const openTableSearchSettings = async (page: Page) => {
  await page.goto('/settings/preferences/search-settings/tables');
  await expect(page.getByTestId('entity-search-settings-header')).toBeVisible();
};

test.describe(
  'Search relevance sample data',
  { tag: ['@search-nightly'] },
  () => {
    test.use({ storageState: 'playwright/.auth/admin.json' });

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
    });

    test('ranks name and structural table matches before tier and usage description matches', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);

      try {
        await expect
          .poll(() => searchTableFixtures(apiContext), {
            intervals: [2_000, 5_000],
            timeout: 90_000,
          })
          .toEqual({
            clearNameBeforeWeakDescription: true,
            exactBeforeDescription: true,
            exactBeforeWeakDescription: true,
            exactBeforeStructural: true,
            structuralBeforeDescription: true,
            structuralBeforeWeakDescription: true,
            structuralOnlyBeforeWeakDescription: true,
          });
      } finally {
        await afterAction();
      }
    });

    test('ranks clear provider address intent above weak high-signal description matches with stopwords', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);

      try {
        await expect
          .poll(
            () => searchTableFixtures(apiContext, STOPWORD_RELEVANCE_QUERY),
            {
              intervals: [2_000, 5_000],
              timeout: 90_000,
            }
          )
          .toEqual({
            clearNameBeforeWeakDescription: true,
            exactBeforeDescription: true,
            exactBeforeWeakDescription: true,
            exactBeforeStructural: true,
            structuralBeforeDescription: true,
            structuralBeforeWeakDescription: true,
            structuralOnlyBeforeWeakDescription: true,
          });
      } finally {
        await afterAction();
      }
    });

    test('ranks customer and customers identity matches before high-signal description matches', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const singularPluralFixtures: ReadonlyArray<RankedFixture> = [
        {
          key: 'customerBeforeWeakDescription',
          fqn: CUSTOMER_TABLE_FQN,
        },
        {
          key: 'customersBeforeWeakDescription',
          fqn: CUSTOMERS_TABLE_FQN,
        },
      ];

      try {
        await expect
          .poll(
            () =>
              compareTableFixtureRanks(
                apiContext,
                CUSTOMER_QUERY,
                singularPluralFixtures,
                CUSTOMER_WEAK_TIER_USAGE_TABLE_FQN
              ),
            {
              intervals: [2_000, 5_000],
              timeout: 90_000,
            }
          )
          .toEqual({
            customerBeforeWeakDescription: true,
            customersBeforeWeakDescription: true,
          });

        await expect
          .poll(
            () =>
              compareTableFixtureRanks(
                apiContext,
                CUSTOMERS_QUERY,
                singularPluralFixtures,
                CUSTOMER_WEAK_TIER_USAGE_TABLE_FQN
              ),
            {
              intervals: [2_000, 5_000],
              timeout: 90_000,
            }
          )
          .toEqual({
            customerBeforeWeakDescription: true,
            customersBeforeWeakDescription: true,
          });
      } finally {
        await afterAction();
      }
    });

    test('ranks customer profile name and column matches before high-signal description matches', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const customerProfileFixtures: ReadonlyArray<RankedFixture> = [
        {
          key: 'customerProfileBeforeWeakDescription',
          fqn: CUSTOMER_PROFILE_TABLE_FQN,
        },
        {
          key: 'customerProfilesBeforeWeakDescription',
          fqn: CUSTOMER_PROFILES_TABLE_FQN,
        },
        {
          key: 'structuralBeforeWeakDescription',
          fqn: CUSTOMER_STRUCTURAL_TABLE_FQN,
        },
      ];

      try {
        await expect
          .poll(
            () =>
              compareTableFixtureRanks(
                apiContext,
                CUSTOMER_PROFILE_QUERY,
                customerProfileFixtures,
                CUSTOMER_WEAK_TIER_USAGE_TABLE_FQN
              ),
            {
              intervals: [2_000, 5_000],
              timeout: 90_000,
            }
          )
          .toEqual({
            customerProfileBeforeWeakDescription: true,
            customerProfilesBeforeWeakDescription: true,
            structuralBeforeWeakDescription: true,
          });

        await expect
          .poll(
            () =>
              compareTableFixtureRanks(
                apiContext,
                CUSTOMER_PROFILE_STATUS_QUERY,
                customerProfileFixtures,
                CUSTOMER_WEAK_TIER_USAGE_TABLE_FQN
              ),
            {
              intervals: [2_000, 5_000],
              timeout: 90_000,
            }
          )
          .toEqual({
            customerProfileBeforeWeakDescription: true,
            customerProfilesBeforeWeakDescription: true,
            structuralBeforeWeakDescription: true,
          });
      } finally {
        await afterAction();
      }
    });

    test('finds provider address texas fixtures across searchable asset indexes', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);

      try {
        for (const fixture of RELEVANCE_FIXTURES) {
          await test.step(`Find ${fixture.fqn}`, async () => {
            await expect
              .poll(() => searchFixture(apiContext, fixture), {
                intervals: [2_000, 5_000],
                timeout: 90_000,
              })
              .toBe(true);
          });
        }
      } finally {
        await afterAction();
      }
    });

    test('finds customer profiles fixtures across searchable asset indexes', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);

      try {
        for (const fixture of CUSTOMER_RELEVANCE_FIXTURES) {
          await test.step(`Find ${fixture.fqn}`, async () => {
            await expect
              .poll(
                () =>
                  searchFixture(apiContext, fixture, CUSTOMER_PROFILES_QUERY),
                {
                  intervals: [2_000, 5_000],
                  timeout: 90_000,
                }
              )
              .toBe(true);
          });
        }
      } finally {
        await afterAction();
      }
    });

    test('shows readable ranking details for exact table matches', async ({
      page,
    }) => {
      await searchForExactTableWithRankingDetails(page);

      const exactTableCard = page.getByTestId(
        `table-data-card_${EXACT_TABLE_FQN}`
      );

      await expect(exactTableCard).toBeVisible();
      await expect(exactTableCard.getByTestId('ranking-details')).toContainText(
        /Exact name|Close name/
      );
    });

    test('shows configurable ranking stages in table search settings', async ({
      page,
    }) => {
      await openTableSearchSettings(page);

      await expect(page.getByTestId('ranking-settings')).toBeVisible();
      await expect(page.getByTestId('ranking-stage-exactName')).toContainText(
        'Exact Name'
      );
      await expect(page.getByTestId('ranking-stage-closeName')).toContainText(
        'Close Name'
      );
      await expect(page.getByTestId('ranking-signals')).toContainText(
        /Tier|usage|votes/i
      );
    });

    test('toggles ranking details in search settings preview', async ({
      page,
    }) => {
      await openTableSearchSettings(page);

      const previewResponse = page.waitForResponse((response) =>
        isSearchPreviewResponse(response, false)
      );

      await page.getByTestId('searchbar').fill(STOPWORD_RELEVANCE_QUERY);
      await previewResponse;
      await expect(page.getByTestId('ranking-details')).toHaveCount(0);

      const rankingDetailsResponse = page.waitForResponse((response) =>
        isSearchPreviewResponse(response, true)
      );

      await page.getByTestId('ranking-details-switch').click();
      await rankingDetailsResponse;
      await expect(page.getByTestId('ranking-details').first()).toBeVisible();
      await expect(page.getByTestId('ranking-details').first()).toContainText(
        /Exact name|Close name|Structural context|Score/i
      );
    });

    test('returns ranking stage matched queries without explain', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);

      try {
        await expect
          .poll(
            async () => {
              const hits = await getSearchHits(
                apiContext,
                'table',
                'provider_address_texas'
              );
              const exactTable = hits.find(
                (hit) => fqnOf(hit) === EXACT_TABLE_FQN
              );

              return (
                exactTable?.matched_queries?.some((queryName) =>
                  queryName.startsWith('ranking:exactName:')
                ) ?? false
              );
            },
            {
              intervals: [2_000, 5_000],
              timeout: 90_000,
            }
          )
          .toBe(true);
      } finally {
        await afterAction();
      }
    });
  }
);
