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

import { useEffect, useRef, useState } from 'react';
import { getEntityGraphData } from '../../rest/rdfAPI';
import { EntityGraphParams, GraphData } from '../../rest/rdfAPI.interface';

interface GraphResult {
  entityKey: string;
  queryKey: string;
  data: GraphData | null;
  unfiltered: GraphData | null;
  appliedQuery?: EntityGraphParams;
  loading: boolean;
  error: unknown;
}

export const useKnowledgeGraphData = (
  query: EntityGraphParams,
  refresh: number
) => {
  const entityKey = JSON.stringify([query.entityType, query.entityId]);
  const queryKey = JSON.stringify(query);
  const unfilteredKey = JSON.stringify([entityKey, query.depth, refresh]);
  const unfilteredRef = useRef<{ key: string; data: GraphData } | null>(null);
  const [result, setResult] = useState<GraphResult>({
    entityKey,
    queryKey,
    data: null,
    unfiltered: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    const params: EntityGraphParams = JSON.parse(queryKey);
    if (!params.entityId) {
      setResult({
        entityKey,
        queryKey,
        data: null,
        unfiltered: null,
        loading: false,
        error: null,
      });

      return () => controller.abort();
    }
    setResult((previous) => ({
      ...(previous.entityKey === entityKey
        ? previous
        : { data: null, unfiltered: null }),
      entityKey,
      queryKey,
      loading: true,
      error: null,
    }));
    const cached = unfilteredRef.current;
    if (cached?.key !== unfilteredKey) {
      unfilteredRef.current = null;
    }
    const allNodes =
      cached?.key === unfilteredKey
        ? Promise.resolve(cached.data)
        : getEntityGraphData(
            {
              entityId: params.entityId,
              entityType: params.entityType,
              depth: params.depth,
            },
            { signal: controller.signal }
          );
    const hasFilters = Boolean(
      params.entityTypes?.length || params.relationshipTypes?.length
    );
    const filtered = hasFilters
      ? getEntityGraphData(params, { signal: controller.signal })
      : allNodes;
    void Promise.all([allNodes, filtered])
      .then(([unfiltered, data]) => {
        if (controller.signal.aborted) {
          return;
        }
        // Only the current traversal is retained; filtering never grows a cache.
        unfilteredRef.current = { key: unfilteredKey, data: unfiltered };
        setResult({
          entityKey,
          queryKey,
          data,
          unfiltered,
          appliedQuery: params,
          loading: false,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setResult((previous) => ({ ...previous, loading: false, error }));
        }
      });

    return () => controller.abort();
  }, [entityKey, queryKey, unfilteredKey]);

  if (result.entityKey !== entityKey) {
    return {
      ...result,
      data: null,
      unfiltered: null,
      appliedQuery: undefined,
      loading: true,
      error: null,
    };
  }

  return { ...result, loading: result.loading || result.queryKey !== queryKey };
};
