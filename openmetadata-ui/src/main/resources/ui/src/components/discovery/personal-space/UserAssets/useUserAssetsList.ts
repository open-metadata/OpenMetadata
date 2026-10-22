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

import { useEffect, useMemo, useRef, useState } from 'react';
import { SearchIndex } from '../../../../enums/search.enum';
import { User } from '../../../../generated/entity/teams/user';
import { SearchSourceAlias } from '../../../../interface/search.interface';
import { searchQuery } from '../../../../rest/searchAPI';
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
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const requestRef = useRef(0);

  const ownerIdsKey = getOwnerIdsKey(user);
  // Keyed on ids so a refetched user object doesn't refire the search.
  const queryFilter = useMemo(
    () => getUserAssetsQueryFilter(kind, user),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, ownerIdsKey]
  );

  // Any change to what is listed starts again from the first page. Reset
  // during render so the fetch effect never runs with a stale page.
  const listKey = `${kind}|${ownerIdsKey}|${search}|${indexes.join(',')}`;
  const [prevListKey, setPrevListKey] = useState(listKey);
  if (prevListKey !== listKey) {
    setPrevListKey(listKey);
    setPage(1);
    setAssets([]);
  }

  useEffect(() => {
    // Only the latest request may write state, so a slow earlier page or
    // search can't overwrite a newer one.
    const requestId = ++requestRef.current;
    const isCurrent = () => requestId === requestRef.current;
    setIsLoading(true);
    searchQuery({
      pageNumber: page,
      pageSize: PAGE_SIZE,
      query: search ? `*${search}*` : '',
      queryFilter,
      searchIndex: indexes.length
        ? (indexes as SearchIndex[])
        : SearchIndex.DATA_ASSET,
    })
      .then((res) => {
        if (!isCurrent()) {
          return;
        }
        const hits = (res.hits.hits as SearchedDataProps['data']).map(
          (hit) => hit._source
        );
        setTotal(res.hits.total.value ?? 0);
        setAssets((prev) => (page === 1 ? hits : [...prev, ...hits]));
      })
      .catch(() => {
        if (isCurrent() && page === 1) {
          setAssets([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (isCurrent()) {
          setIsLoading(false);
        }
      });
  }, [queryFilter, search, indexes, page]);

  return {
    assets,
    total,
    isLoading,
    hasMore: !isLoading && assets.length < total,
    loadMore: () => setPage((current) => current + 1),
  };
};
