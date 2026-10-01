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
import { SearchIndex } from '../enums/search.enum';
import { searchQuery } from '../rest/searchAPI';
import { buildCuratedQueryFilter, CuratedRule } from '../utils/curatedRule';

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
  /** False when the asset has an open incident or a failing test. */
  isHealthy: boolean;
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
    totalTestCases?: number;
    failedTestCases?: number;
  };
}

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
  const searchIndex =
    savedFilter && resources?.length
      ? (resources as unknown as SearchIndex)
      : SearchIndex.DATA_ASSET;

  return searchQuery({
    pageNumber: 1,
    pageSize: PAGE_SIZE,
    queryFilter: savedFilter ?? buildCuratedQueryFilter(rule),
    searchIndex,
  });
};

/** The assets matching a curated rule, with a health dot per row. */
export const useCuratedAssets = (
  source: CuratedAssetsSource
): CuratedAssets => {
  const { data, isPending, isError } = useQuery({
    queryFn: () => fetchCuratedAssets(source),
    queryKey: [...CURATED_ASSETS_QUERY_KEY, source],
    staleTime: TTL_MS,
  });

  const hits = (data?.hits?.hits ?? []) as unknown as SearchHit[];

  return {
    assets: hits.map(({ _source: source }) => ({
      entityType: source.entityType,
      fullyQualifiedName: source.fullyQualifiedName,
      id: source.id,
      // Absent test counts mean "nothing is known to be failing", which reads
      // as healthy rather than as a warning the user cannot act on.
      isHealthy: (source.failedTestCases ?? 0) === 0,
      name: source.displayName || source.name,
      serviceType: source.serviceType,
      tier: tierLeaf(source.tier?.tagFQN),
    })),
    isError,
    isLoading: isPending,
    totalCount: data?.hits?.total?.value ?? 0,
  };
};
