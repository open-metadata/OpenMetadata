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

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { TestCaseStatus } from '../generated/tests/testCase';
import type { QueryFilterInterface } from '../interface/queryFilter.interface';
import { postAggregateFieldOptions } from '../rest/miscAPI';
import { searchQuery } from '../rest/searchAPI';
import { getModifiedQueryFilterWithSelectedAssets } from '../utils/CuratedAssetsPureUtils';
import { buildCuratedQueryFilter, CuratedRule } from '../utils/curatedRule';
import { getAggregations } from '../utils/ExplorePureUtils';

export const CURATED_ASSETS_QUERY_KEY = [
  'landingPage',
  'widgets',
  'curatedAssets',
];
const TTL_MS = 5 * 60 * 1000;
const PAGE_SIZE = 10;

export interface CuratedAsset {
  id: string;
  name: string;
  fullyQualifiedName: string;
  entityType: string;
  serviceType?: string;
  tier?: string;
  /**
   * False when a test case on the asset is currently failing. Undefined until
   * that lookup answers — and for good if it fails — so the row shows no
   * health at all rather than a green it never confirmed.
   */
  isHealthy?: boolean;
}

/**
 * Where a Curated Assets card gets its filter.
 *
 * `KnowledgePanel.CuratedAssets` predates this card: the persona editor's
 * {@code CuratedAssetsModal} saves an advanced filter onto the widget's layout
 * entry, and those saved configs are still out in the wild. A saved filter
 * therefore wins; the chip rule is only the fallback for a widget that has
 * never been configured.
 */
export interface CuratedAssetsSource {
  /** Chip-driven rule, shown as `<field> is <value>` chips on the card. */
  rule: CuratedRule;
  /** Advanced filter JSON saved by the persona editor, if any. */
  queryFilter?: string;
  /** Entity types the saved config restricts to; empty means all data assets. */
  resources?: string[];
}

export interface CuratedAssets {
  assets: CuratedAsset[];
  /** Everything the rule matches, not just the page shown. */
  totalCount: number;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

interface SearchHit {
  _source: {
    id: string;
    name: string;
    displayName?: string;
    fullyQualifiedName: string;
    entityType: string;
    serviceType?: string;
    tier?: { tagFQN?: string };
  };
}

/** Test cases point at their table through this field; it is lowercased on the index. */
const ORIGIN_ENTITY_FIELD = 'originEntityFQN';

// `Tier.Tier1` reads as noise in a chip; the leaf is what the mock shows.
const tierLeaf = (tagFQN?: string): string | undefined =>
  tagFQN?.split('.').pop();

/**
 * A saved filter that fails to parse must not take the card down with it — fall
 * back to the chip rule, which is always renderable.
 */
const parseSavedFilter = (
  queryFilter?: string
): Record<string, unknown> | undefined => {
  if (!queryFilter) {
    return undefined;
  }

  try {
    return JSON.parse(queryFilter) as Record<string, unknown>;
  } catch {
    return undefined;
  }
};

const fetchCuratedAssets = async ({
  rule,
  queryFilter,
  resources,
}: CuratedAssetsSource) => {
  const savedFilter = parseSavedFilter(queryFilter);

  // The selected entity types narrow the *filter*, not the index. Querying the
  // resources as indices instead drops any type the search index map has no
  // entry for, and loses the entityType aggregation the saved filter is scored
  // against; `dataAsset` (or `all`, which also carries the non-asset types)
  // with an entityType clause is the shape the persona editor has always saved.
  const searchIndex = resources?.includes(EntityType.ALL)
    ? SearchIndex.ALL
    : SearchIndex.DATA_ASSET;

  return searchQuery({
    pageNumber: 1,
    pageSize: PAGE_SIZE,
    queryFilter: getModifiedQueryFilterWithSelectedAssets(
      (savedFilter ?? buildCuratedQueryFilter(rule)) as QueryFilterInterface,
      resources
    ) as Record<string, unknown>,
    searchIndex,
  });
};

/**
 * Which of the listed assets have a failing test right now, as a set of
 * lowercased FQNs.
 *
 * The data-asset documents carry no test outcome at all — `failedTestCases`,
 * which the row used to read, is on no index — so the answer comes from the
 * test-case index: one aggregation over the page's FQNs, keeping only test
 * cases whose latest result failed. One request for the page, not one per row.
 */
const fetchFailingAssets = async (fqns: string[]): Promise<Set<string>> => {
  const response = await postAggregateFieldOptions({
    deleted: false,
    fieldName: ORIGIN_ENTITY_FIELD,
    index: SearchIndex.TEST_CASE,
    query: JSON.stringify({
      query: {
        bool: {
          must: [
            { terms: { [ORIGIN_ENTITY_FIELD]: fqns } },
            {
              term: { 'testCaseResult.testCaseStatus': TestCaseStatus.Failed },
            },
          ],
        },
      },
    }),
    size: fqns.length,
  });
  const buckets =
    getAggregations(response.data.aggregations ?? {})[ORIGIN_ENTITY_FIELD]
      ?.buckets ?? [];

  return new Set(buckets.map((bucket) => bucket.key.toLowerCase()));
};

/** The assets matching a curated rule, with a health dot per row. */
export const useCuratedAssets = (
  source: CuratedAssetsSource
): CuratedAssets => {
  const { data, isPending, isError, refetch } = useQuery({
    queryFn: () => fetchCuratedAssets(source),
    queryKey: [...CURATED_ASSETS_QUERY_KEY, source],
    staleTime: TTL_MS,
  });

  const hits = useMemo(
    () => (data?.hits?.hits ?? []) as unknown as SearchHit[],
    [data]
  );
  const fqns = useMemo(
    () => hits.map(({ _source: hit }) => hit.fullyQualifiedName),
    [hits]
  );

  // Supplementary: a failure here costs the rows their health dot, never the
  // card — so it is neither part of `isLoading` nor of `isError`.
  const { data: failing } = useQuery({
    enabled: fqns.length > 0,
    queryFn: () => fetchFailingAssets(fqns),
    queryKey: [...CURATED_ASSETS_QUERY_KEY, 'failing', fqns],
    retry: false,
    staleTime: TTL_MS,
  });

  return useMemo(
    () => ({
      assets: hits.map(({ _source: hit }) => ({
        entityType: hit.entityType,
        fullyQualifiedName: hit.fullyQualifiedName,
        id: hit.id,
        isHealthy: failing
          ? !failing.has(hit.fullyQualifiedName.toLowerCase())
          : undefined,
        name: hit.displayName || hit.name,
        serviceType: hit.serviceType,
        tier: tierLeaf(hit.tier?.tagFQN),
      })),
      isError,
      isLoading: isPending,
      refetch: () => void refetch(),
      totalCount: data?.hits?.total?.value ?? 0,
    }),
    [hits, failing, isError, isPending, refetch, data]
  );
};
