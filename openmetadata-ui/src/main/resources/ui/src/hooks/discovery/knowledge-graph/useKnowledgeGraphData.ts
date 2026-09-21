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

export interface KnowledgeGraphDataResult {
  data: GraphData | null;
  unfiltered: GraphData | null;
  appliedQuery?: EntityGraphParams;
  loading: boolean;
  error: unknown;
}

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
  const unfilteredKey = [
    ...KNOWLEDGE_GRAPH_ASSETS_KEY,
    query.entityType,
    query.entityId,
    query.depth,
    refresh,
  ];
  const filteredKey = filtered
    ? [
        ...unfilteredKey,
        query.entityTypes ?? [],
        query.relationshipTypes ?? [],
      ]
    : unfilteredKey;

  const unfilteredQuery = useQuery({
    queryKey: unfilteredKey,
    queryFn: async ({ signal }) => {
      const data = await getEntityGraphData(unfilteredParams, { signal });

      return { params: unfilteredParams, data };
    },
    enabled,
  });
  const filteredQuery = useQuery({
    queryKey: filteredKey,
    queryFn: async ({ signal }) => {
      const data = await getEntityGraphData(filteredParams, { signal });

      return { params: filteredParams, data };
    },
    enabled: enabled && filtered,
  });
  const dataQuery = filtered ? filteredQuery : unfilteredQuery;

  // Retain the last successful fetch per query so the panel doesn't blank
  // during an in-flight update or after a rejection. Reset when the entity
  // changes so we never show a different entity's rows as stale placeholder.
  const previousEntity = useRef(query.entityId);
  const lastData = useRef<FetchedGraph | null>(null);
  const lastUnfiltered = useRef<FetchedGraph | null>(null);
  if (previousEntity.current !== query.entityId) {
    previousEntity.current = query.entityId;
    lastData.current = null;
    lastUnfiltered.current = null;
  }
  if (dataQuery.data && lastData.current !== dataQuery.data) {
    lastData.current = dataQuery.data;
  }
  if (unfilteredQuery.data && lastUnfiltered.current !== unfilteredQuery.data) {
    lastUnfiltered.current = unfilteredQuery.data;
  }

  if (!enabled) {
    return {
      data: null,
      unfiltered: null,
      loading: false,
      error: null,
    };
  }

  const effectiveData = dataQuery.data ?? lastData.current;
  const effectiveUnfiltered =
    unfilteredQuery.data ?? lastUnfiltered.current;
  const loading =
    unfilteredQuery.isFetching || (filtered && filteredQuery.isFetching);
  const error =
    dataQuery.error ?? (filtered ? unfilteredQuery.error : null) ?? null;

  return {
    data: effectiveData?.data ?? null,
    unfiltered: effectiveUnfiltered?.data ?? null,
    appliedQuery: effectiveData?.params,
    loading,
    error,
  };
};
