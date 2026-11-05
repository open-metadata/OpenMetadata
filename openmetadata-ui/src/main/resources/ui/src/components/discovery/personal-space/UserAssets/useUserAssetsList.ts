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
import { uniqBy } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SearchIndex } from '../../../../enums/search.enum';
import { User } from '../../../../generated/entity/teams/user';
import { SearchSourceAlias } from '../../../../interface/search.interface';
import { searchQuery } from '../../../../rest/searchAPI';
import { escapeESReservedCharacters } from '../../../../utils/StringUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { SearchedDataProps } from '../../../SearchedData/SearchedData.interface';
import {
  getOwnerIdsKey,
  getUserAssetsQueryFilter,
  UserAssetsKind,
} from './UserAssets.utils';

const PAGE_SIZE = 15;

/**
 * Pages through the assets a user owns or follows, narrowed by a search text
 * and optional search indexes (empty = every data asset).
 */
export const useUserAssetsList = (
  kind: UserAssetsKind,
  user: User,
  search: string,
  indexes: string[]
) => {
  const [assets, setAssets] = useState<SearchSourceAlias[]>([]);
  const [total, setTotal] = useState(0);
  // The last page that loaded; a failed "load more" leaves it unchanged.
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown>();
  const requestRef = useRef(0);

  const ownerIdsKey = getOwnerIdsKey(user);
  // Keyed on ids so a refetched user object doesn't refire the search.
  const queryFilter = useMemo(
    () => getUserAssetsQueryFilter(kind, user),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, ownerIdsKey]
  );

  // Clear the previous list during render, so the frame before the new
  // request starts shows a loader rather than "no match".
  const listKey = `${kind}|${ownerIdsKey}|${search}|${indexes.join(',')}`;
  const [prevListKey, setPrevListKey] = useState(listKey);
  if (prevListKey !== listKey) {
    setPrevListKey(listKey);
    setPage(1);
    setAssets([]);
    setError(undefined);
    setIsLoading(true);
  }

  const fetchPage = useCallback(
    async (pageNumber: number) => {
      // Only the latest request may write state, so a slow earlier page or
      // search can't overwrite a newer one.
      const requestId = ++requestRef.current;
      const isCurrent = () => requestId === requestRef.current;
      setIsLoading(true);
      try {
        const res = await searchQuery({
          pageNumber,
          pageSize: PAGE_SIZE,
          query: search ? `*${escapeESReservedCharacters(search)}*` : '',
          queryFilter,
          searchIndex: indexes.length
            ? (indexes as SearchIndex[])
            : SearchIndex.DATA_ASSET,
        });
        if (!isCurrent()) {
          return;
        }
        const hits = (res.hits.hits as SearchedDataProps['data']).map(
          (hit) => hit._source
        );
        setTotal(res.hits.total.value ?? 0);
        setAssets((prev) =>
          pageNumber === 1 ? hits : uniqBy([...prev, ...hits], 'id')
        );
        setPage(pageNumber);
        setError(undefined);
      } catch (err) {
        if (!isCurrent()) {
          return;
        }
        showErrorToast(err as AxiosError);
        // A failed later page keeps the loaded list; only the first is fatal.
        if (pageNumber === 1) {
          setAssets([]);
          setTotal(0);
          setError(err);
        }
      } finally {
        if (isCurrent()) {
          setIsLoading(false);
        }
      }
    },
    [queryFilter, search, indexes]
  );

  useEffect(() => {
    fetchPage(1);
  }, [fetchPage]);

  return {
    assets,
    total,
    isLoading,
    error,
    hasMore: !isLoading && !error && assets.length < total,
    loadMore: () => fetchPage(page + 1),
    retry: () => fetchPage(1),
  };
};
