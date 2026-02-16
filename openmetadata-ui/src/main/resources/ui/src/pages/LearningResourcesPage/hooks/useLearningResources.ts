/*
 *  Copyright 2024 Collate.
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
import {
  MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { MAX_CHAIN_PAGES } from '../../../constants/Learning.constants';
import { Paging } from '../../../generated/type/paging';
import {
  getLearningResourcesList,
  LearningResource,
} from '../../../rest/learningResourceAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import type { LearningResourceFilterState } from './useLearningResourceFilters';

const FIELDS = 'categories,contexts,difficulty,estimatedDuration,owners';

const INITIAL_PAGING: Paging = { total: 0 };

const isAbortError = (error: unknown): boolean =>
  error instanceof Error &&
  (error.name === 'CanceledError' || error.name === 'AbortError');

function applyResponseToRefs(
  page: number,
  list: LearningResource[],
  nextPaging: Paging,
  refs: {
    itemsByPageRef: MutableRefObject<Map<number, LearningResource[]>>;
    cursorsByPageRef: MutableRefObject<Map<number, string>>;
    beforeCursorsByPageRef: MutableRefObject<Map<number, string>>;
    totalFromPage1Ref: MutableRefObject<number>;
  }
): void {
  refs.itemsByPageRef.current.set(page, list);
  if (nextPaging.after != null) {
    refs.cursorsByPageRef.current.set(page, nextPaging.after);
  }
  if (page >= 2 && nextPaging.before != null) {
    refs.beforeCursorsByPageRef.current.set(page, nextPaging.before);
  }
  if (page === 1) {
    refs.totalFromPage1Ref.current = nextPaging.total ?? 0;
  }
}

interface UseLearningResourcesParams {
  searchText: string;
  filterState: LearningResourceFilterState;
  pageSize: number;
  currentPage: number;
}

interface UseLearningResourcesReturn {
  resources: LearningResource[];
  paging: Paging;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

function buildListParams(
  searchText: string,
  filterState: LearningResourceFilterState,
  pageSize: number,
  cursor?: { after?: string; before?: string }
): Parameters<typeof getLearningResourcesList>[0] {
  const hasCursor = cursor && (cursor.after ?? cursor.before);

  return {
    limit: pageSize,
    fields: FIELDS,
    q: searchText || undefined,
    category: filterState.category?.length ? filterState.category : undefined,
    pageId: filterState.context?.length ? filterState.context : undefined,
    type: filterState.type?.length ? filterState.type : undefined,
    status: filterState.status?.length ? filterState.status : undefined,
    ...(hasCursor ? cursor : undefined),
  };
}

export const useLearningResources = ({
  searchText,
  filterState,
  pageSize,
  currentPage,
}: UseLearningResourcesParams): UseLearningResourcesReturn => {
  const { t } = useTranslation();
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [paging, setPaging] = useState<Paging>(INITIAL_PAGING);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const prevRequestKeyRef = useRef<string>('');

  const cursorsByPageRef = useRef<Map<number, string>>(new Map());
  const beforeCursorsByPageRef = useRef<Map<number, string>>(new Map());
  const itemsByPageRef = useRef<Map<number, LearningResource[]>>(new Map());
  const totalFromPage1Ref = useRef<number>(0);

  const loadData = useCallback(
    async (
      page: number,
      options?: { skipGridItemsUpdate?: boolean; signal?: AbortSignal }
    ): Promise<void> => {
      const before = beforeCursorsByPageRef.current.get(2);
      const after = cursorsByPageRef.current.get(page - 1);
      let cursor: { before?: string; after?: string } | undefined;
      if (page === 1) {
        cursor = before ? { before } : undefined;
      } else {
        cursor = after ? { after } : undefined;
      }

      const signal = options?.signal;

      try {
        const apiParams = buildListParams(
          searchText,
          filterState,
          pageSize,
          cursor
        );
        const response = await getLearningResourcesList(apiParams, {
          ...(signal && { signal }),
        });

        if (signal?.aborted) {
          return;
        }

        const list = response?.data ?? [];
        const nextPaging = response?.paging ?? INITIAL_PAGING;

        applyResponseToRefs(page, list, nextPaging, {
          itemsByPageRef,
          cursorsByPageRef,
          beforeCursorsByPageRef,
          totalFromPage1Ref,
        });

        if (!options?.skipGridItemsUpdate) {
          setResources(list);
          setPaging({
            ...nextPaging,
            total: totalFromPage1Ref.current || nextPaging.total,
          });
        }
      } catch (error) {
        if (!isAbortError(error)) {
          showErrorToast(
            error as AxiosError,
            t('server.learning-resources-fetch-error')
          );
        }

        throw error;
      }
    },
    [t, searchText, filterState, pageSize]
  );

  const loadPageWithChain = useCallback(
    async (signal: AbortSignal): Promise<void> => {
      const opts = { signal };
      if (currentPage === 1) {
        await loadData(1, opts);

        return;
      }
      if (cursorsByPageRef.current.has(currentPage - 1)) {
        await loadData(currentPage, opts);

        return;
      }
      if (currentPage > MAX_CHAIN_PAGES) {
        await loadData(1, opts);
        setResources(itemsByPageRef.current.get(1) ?? []);
        setPaging((prev) => ({
          ...prev,
          total: totalFromPage1Ref.current,
        }));
        showErrorToast(t('message.please-refresh-the-page'));

        return;
      }
      for (let p = 1; p < currentPage; p++) {
        if (signal.aborted) {
          return;
        }
        await loadData(p, { skipGridItemsUpdate: true, signal });
      }
      if (signal.aborted) {
        return;
      }
      await loadData(currentPage, opts);
    },
    [loadData, currentPage, t]
  );

  useEffect(() => {
    abortControllerRef.current?.abort();

    const requestKey = JSON.stringify({ searchText, filterState, pageSize });
    const filtersChanged = prevRequestKeyRef.current !== requestKey;
    if (filtersChanged) {
      prevRequestKeyRef.current = requestKey;
      cursorsByPageRef.current = new Map();
      beforeCursorsByPageRef.current = new Map();
      itemsByPageRef.current = new Map();
      totalFromPage1Ref.current = 0;
    }

    const cachedItems = itemsByPageRef.current.get(currentPage);
    if (cachedItems && !filtersChanged) {
      setResources(cachedItems);
      setIsLoading(false);
      setPaging((prev) => ({
        ...prev,
        total: totalFromPage1Ref.current || prev.total,
      }));

      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoading(true);

    const run = async () => {
      try {
        await loadPageWithChain(controller.signal);
      } catch {
        if (!cancelled && abortControllerRef.current === controller) {
          setResources([]);
          setPaging(INITIAL_PAGING);
        }
      } finally {
        if (abortControllerRef.current === controller && !cancelled) {
          setIsLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [currentPage, searchText, filterState, pageSize, loadPageWithChain]);

  const refetch = useCallback(async () => {
    cursorsByPageRef.current = new Map();
    beforeCursorsByPageRef.current = new Map();
    itemsByPageRef.current = new Map();
    totalFromPage1Ref.current = 0;
    prevRequestKeyRef.current = '';

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoading(true);
    try {
      await loadPageWithChain(controller.signal);
    } catch (error) {
      if (!isAbortError(error)) {
        setResources([]);
        setPaging(INITIAL_PAGING);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
      }
    }
  }, [loadPageWithChain]);

  return {
    resources,
    paging,
    isLoading,
    refetch,
  };
};
