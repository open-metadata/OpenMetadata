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

import { AxiosError } from 'axios';
import { Paging } from '../../../../generated/type/paging';
import { showErrorToast } from '../../../../utils/ToastUtils';
import {
  Dispatch,
  RefObject,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

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
  reload: () => void;
  setItems: Dispatch<SetStateAction<T[]>>;
  setTotal: Dispatch<SetStateAction<number>>;
}

const ROOT_MARGIN = '240px';

/**
 * Cursor-paginated infinite list with an IntersectionObserver-driven "load
 * more". `fetchPage(after)` returns one page; when its identity changes (e.g.
 * a filter switch) the list reloads from the first page.
 *
 * `canLoadMore(loadedItems)` is an optional stop condition checked before every
 * page fetch. It prevents runaway pagination when the rendered list is
 * client-side filtered (e.g. a date window): without it, the filtered list
 * stays short, the sentinel never leaves the viewport, and the observer pages
 * through the entire history. Return `false` once the loaded items already
 * cover everything the active filter could show.
 */
export function useInboxInfiniteList<T>(
  fetchPage: (after?: string) => Promise<InboxListPage<T> | undefined>,
  canLoadMore?: (loadedItems: T[]) => boolean
): UseInboxInfiniteList<T> {
  const [items, setItems] = useState<T[]>([]);
  const [after, setAfter] = useState<string | undefined>();
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadInitial = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchPage(undefined);
      if (!res) {
        setItems([]);
        setAfter(undefined);
        setTotal(0);

        return;
      }
      setItems(res.data);
      setAfter(res.paging?.after);
      setTotal(res.paging?.total ?? res.data.length);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (!after || isLoadingMore || canLoadMore?.(items) === false) {
      return;
    }
    setIsLoadingMore(true);
    try {
      const res = await fetchPage(after);
      if (!res) {
        return;
      }
      setItems((prev) => [...prev, ...res.data]);
      setAfter(res.paging?.after);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoadingMore(false);
    }
  }, [after, isLoadingMore, fetchPage, canLoadMore, items]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

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
    isLoading,
    isLoadingMore,
    total,
    scrollRef,
    sentinelRef,
    reload: loadInitial,
    setItems,
    setTotal,
  };
}
