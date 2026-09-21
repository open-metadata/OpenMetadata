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

import { InfiniteData, useInfiniteQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { Include } from '../../../generated/type/include';
import { getTableColumnsById } from '../../../rest/tableAPI';

const COLUMN_PAGE_SIZE = 1000;

type ColumnPage = Awaited<ReturnType<typeof getTableColumnsById>>;

/**
 * Fetches a table's columns as an infinite React Query — each page is one
 * REST call capped at {@link COLUMN_PAGE_SIZE}. Consumers get an aggregated
 * `columns` list and a `loadMore` callback that fetches the next page. The
 * previous rows and total stay on screen across a refresh — including a
 * refresh that fails — so the details panel doesn't blink; switching to a
 * different entity clears them.
 */
export const useKnowledgeGraphColumns = (
  entityId: string,
  enabled: boolean,
  refresh: number
) => {
  const queryEnabled = enabled && Boolean(entityId);
  const query = useInfiniteQuery({
    queryKey: ['knowledge-graph', 'columns', entityId, refresh],
    queryFn: async ({ signal, pageParam }) =>
      getTableColumnsById(
        entityId,
        {
          limit: COLUMN_PAGE_SIZE,
          offset: pageParam,
          fields: 'tags',
          include: Include.NonDeleted,
        },
        signal
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage: ColumnPage, pages: ColumnPage[]) => {
      const loaded = pages.reduce(
        (total, page) => total + (page.data?.length ?? 0),
        0
      );
      const knownTotal = lastPage.paging.total;
      if (loaded >= knownTotal || (lastPage.data?.length ?? 0) === 0) {
        return undefined;
      }

      return loaded;
    },
    enabled: queryEnabled,
  });

  // Retain the last successful pages so the panel doesn't blank while a
  // refresh is in flight — or after that refresh rejects. Reset when the
  // entity changes so we never show one table's columns under another.
  const previousEntity = useRef(entityId);
  const lastData = useRef<InfiniteData<ColumnPage> | null>(null);
  if (previousEntity.current !== entityId) {
    previousEntity.current = entityId;
    lastData.current = null;
  }
  if (query.data && lastData.current !== query.data) {
    lastData.current = query.data;
  }

  const effective = query.data ?? lastData.current;
  const columns = effective?.pages.flatMap((page) => page.data ?? []) ?? [];
  const total = effective?.pages[effective.pages.length - 1]?.paging.total ?? 0;

  return {
    columns,
    total,
    loading: query.isFetching,
    error: query.error ?? null,
    loadMore: () => {
      void query.fetchNextPage();
    },
  };
};
