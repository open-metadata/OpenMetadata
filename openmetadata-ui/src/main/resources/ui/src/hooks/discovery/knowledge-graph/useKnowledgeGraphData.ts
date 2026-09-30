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

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { useRef } from 'react';
import { getEntityGraphData } from '../../../rest/rdfAPI';
import { EntityGraphParams, GraphData } from '../../../rest/rdfAPI.interface';

interface FetchedGraph {
  params: EntityGraphParams;
  data: GraphData;
}

const KNOWLEDGE_GRAPH_ASSETS_KEY = ['knowledge-graph', 'assets'] as const;

const hasFilters = (query: EntityGraphParams): boolean =>
  Boolean(query.entityTypes?.length || query.relationshipTypes?.length);

const toUnfilteredParams = (query: EntityGraphParams): EntityGraphParams => ({
  entityId: query.entityId,
  entityType: query.entityType,
  depth: query.depth,
});

const buildKeys = (
  query: EntityGraphParams,
  refresh: number,
  filtered: boolean
) => {
  const unfilteredKey = [
    ...KNOWLEDGE_GRAPH_ASSETS_KEY,
    query.entityType,
    query.entityId,
    query.depth,
    refresh,
  ];
  const filteredKey = filtered
    ? [...unfilteredKey, query.entityTypes ?? [], query.relationshipTypes ?? []]
    : unfilteredKey;

  return { unfilteredKey, filteredKey };
};

/**
 * Keeps a ref pointing at the last non-null value seen. When the identity key
 * (usually `entityId`) changes the ref is cleared so a stale value from one
 * entity never leaks into the next.
 *
 * The write happens in render on purpose: the retained value must be readable
 * on the SAME render that observes the new query result — a `useEffect` write
 * would land one render later and briefly flash a blank pane. The write is
 * idempotent (same input → same ref content) so React 18 strict-mode's
 * double-invoke and any future concurrent-render discard are both safe.
 */
const useRetainedValue = <T>(value: T | undefined | null, resetKey: string) => {
  const previousResetKey = useRef(resetKey);
  const stored = useRef<T | null>(null);
  if (previousResetKey.current !== resetKey) {
    previousResetKey.current = resetKey;
    stored.current = null;
  }
  if (value && stored.current !== value) {
    stored.current = value;
  }

  return stored.current;
};

export interface KnowledgeGraphDataResult {
  data: GraphData | null;
  unfiltered: GraphData | null;
  appliedQuery?: EntityGraphParams;
  loading: boolean;
  error: unknown;
}

const buildResult = (input: {
  dataQuery: UseQueryResult<FetchedGraph>;
  unfilteredQuery: UseQueryResult<FetchedGraph>;
  retainedData: FetchedGraph | null;
  retainedUnfiltered: FetchedGraph | null;
  filtered: boolean;
}): KnowledgeGraphDataResult => {
  const {
    dataQuery,
    unfilteredQuery,
    retainedData,
    retainedUnfiltered,
    filtered,
  } = input;
  const effectiveData = dataQuery.data ?? retainedData;
  const effectiveUnfiltered = unfilteredQuery.data ?? retainedUnfiltered;

  return {
    data: effectiveData?.data ?? null,
    unfiltered: effectiveUnfiltered?.data ?? null,
    appliedQuery: effectiveData?.params,
    loading: unfilteredQuery.isFetching || (filtered && dataQuery.isFetching),
    error: dataQuery.error ?? (filtered ? unfilteredQuery.error : null) ?? null,
  };
};

/**
 * Fetches an entity's knowledge graph via React Query. The hook always runs
 * an unfiltered traversal (used for the export scope and the full node set)
 * and — when the caller supplied filters — a second filtered traversal.
 * When no filters are set the "filtered" view is served directly from the
 * unfiltered result, so a filter-free view fires exactly one request.
 *
 * Previous rows stay on screen while a new depth or filter is loading —
 * including across a rejection — so the panel doesn't blank between
 * updates; switching to a different entity clears them so stale data is
 * never attributed to the wrong asset.
 */
export const useKnowledgeGraphData = (
  query: EntityGraphParams,
  refresh: number
): KnowledgeGraphDataResult => {
  const enabled = Boolean(query.entityId);
  const unfilteredParams = toUnfilteredParams(query);
  const filtered = hasFilters(query);
  const filteredParams = filtered ? query : unfilteredParams;
  const { unfilteredKey, filteredKey } = buildKeys(query, refresh, filtered);

  // Opt out of the app's default retry policy: a KG traversal is expensive,
  // and the pre-migration hand-rolled code failed immediately. Two retries
  // with backoff would delay the error banner by ~3s and re-send the heavy
  // request three times on a 5xx.
  const unfilteredQuery = useQuery({
    queryKey: unfilteredKey,
    queryFn: async ({ signal }) => {
      const data = await getEntityGraphData(unfilteredParams, { signal });

      return { params: unfilteredParams, data };
    },
    enabled,
    retry: false,
  });
  const filteredQuery = useQuery({
    queryKey: filteredKey,
    queryFn: async ({ signal }) => {
      const data = await getEntityGraphData(filteredParams, { signal });

      return { params: filteredParams, data };
    },
    enabled: enabled && filtered,
    retry: false,
  });
  const dataQuery = filtered ? filteredQuery : unfilteredQuery;
  const retainedData = useRetainedValue(dataQuery.data, query.entityId);
  const retainedUnfiltered = useRetainedValue(
    unfilteredQuery.data,
    query.entityId
  );

  if (!enabled) {
    return { data: null, unfiltered: null, loading: false, error: null };
  }

  return buildResult({
    dataQuery,
    unfilteredQuery,
    retainedData,
    retainedUnfiltered,
    filtered,
  });
};
