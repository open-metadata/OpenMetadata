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

import {
  InfiniteData,
  keepPreviousData,
  QueryKey,
  useInfiniteQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { AxiosError } from 'axios';
import {
  RefObject,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { Paging } from '../../../../generated/type/paging';
import { showErrorToast } from '../../../../utils/ToastUtils';

export interface InboxListPage<T> {
  data: T[];
  paging?: Paging;
}

export interface UseInboxInfiniteList<T> {
  items: T[];
  isLoading: boolean;
  isLoadingMore: boolean;
  total: number;
  // Attach to the scroll container and to a sentinel element at the end of the
  // list; crossing the sentinel triggers the next page fetch.
  scrollRef: RefObject<HTMLDivElement>;
  sentinelRef: RefObject<HTMLDivElement>;
  setItems: (update: SetStateAction<T[]>) => void;
  setTotal: (update: SetStateAction<number>) => void;
}

type ListData<T> = InfiniteData<InboxListPage<T>, string | undefined>;

const ROOT_MARGIN = '240px';
// Revisiting a list inside this window reads the cache instead of refetching.
const LIST_STALE_TIME = 30_000;

const resolve = <V>(update: SetStateAction<V>, prev: V): V =>
  typeof update === 'function' ? (update as (value: V) => V)(prev) : update;

/**
 * Cursor-paginated infinite list with an IntersectionObserver-driven "load
 * more", cached per `queryKey` so switching back to a list is instant. A new
 * key keeps the previous rows on screen until its first page lands, so a
 * filter switch never blanks the list.
 *
 * `canLoadMore(loadedItems)` is an optional stop condition checked before every
 * page fetch. It prevents runaway pagination when the rendered list is
 * client-side filtered (e.g. a date window): without it, the filtered list
 * stays short, the sentinel never leaves the viewport, and the observer pages
 * through the entire history. Return `false` once the loaded items already
 * cover everything the active filter could show.
 */
export function useInboxInfiniteList<T>(
  queryKey: QueryKey,
  fetchPage: (after?: string) => Promise<InboxListPage<T> | undefined>,
  canLoadMore?: (loadedItems: T[]) => boolean
): UseInboxInfiniteList<T> {
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Callers pass a fresh key array each render; edits target whichever list is
  // showing when they run.
  const queryKeyRef = useRef(queryKey);
  queryKeyRef.current = queryKey;

  const query = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) =>
      (await fetchPage(pageParam)) ?? { data: [] },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.paging?.after,
    placeholderData: keepPreviousData,
    staleTime: LIST_STALE_TIME,
  });
  const { data, error, hasNextPage, isFetchingNextPage, fetchNextPage } =
    query;

  useEffect(() => {
    if (error) {
      showErrorToast(error as AxiosError);
    }
  }, [error]);

  const items = useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data]
  );
  const total = data?.pages[0]?.paging?.total ?? items.length;

  // Optimistic edits write through to the cache, so they survive a tab switch
  // and the next background refetch replaces them with the server's answer.
  const updateCache = useCallback(
    (update: (current: ListData<T>) => ListData<T>) =>
      queryClient.setQueryData<ListData<T>>(queryKeyRef.current, (current) =>
        current ? update(current) : current
      ),
    [queryClient]
  );

  // The edited list goes into the first page; later pages keep only their
  // cursors, so "load more" continues from where it was.
  const setItems = useCallback(
    (update: SetStateAction<T[]>) =>
      updateCache(({ pages, pageParams }) => {
        const [first, ...rest] = pages;
        const next = resolve(
          update,
          pages.flatMap((page) => page.data)
        );

        return {
          pageParams,
          pages: [
            { ...first, data: next },
            ...rest.map((page) => ({ ...page, data: [] })),
          ],
        };
      }),
    [updateCache]
  );

  const setTotal = useCallback(
    (update: SetStateAction<number>) =>
      updateCache(({ pages, pageParams }) => {
        const [first, ...rest] = pages;
        const current = first.paging?.total ?? 0;
        const paging = { ...first.paging, total: resolve(update, current) };

        return { pageParams, pages: [{ ...first, paging }, ...rest] };
      }),
    [updateCache]
  );

  const loadMore = useCallback(() => {
    const allowed = canLoadMore?.(items) !== false;
    if (hasNextPage && !isFetchingNextPage && allowed) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, canLoadMore, items, fetchNextPage]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { root, rootMargin: ROOT_MARGIN }
    );
    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [loadMore]);

  return {
    items,
    // Only a list with nothing to show yet; a key switch keeps the old rows.
    isLoading: query.isPending,
    isLoadingMore: isFetchingNextPage,
    total,
    scrollRef,
    sentinelRef,
    setItems,
    setTotal,
  };
}
