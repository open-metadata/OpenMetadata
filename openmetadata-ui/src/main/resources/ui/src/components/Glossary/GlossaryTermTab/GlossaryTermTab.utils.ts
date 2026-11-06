/*
 *  Copyright 2023 Collate.
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

import { getFirstLevelGlossaryTermsPaginated } from '../../../rest/glossaryAPI';

// A fetch response is stale when it no longer matches the search/status
// context the user is currently looking at (they typed/filtered again while
// the request was in flight) — applying it would repopulate or clear the
// table against the user's current intent.
export const isStaleFetchResponse = (
  data: unknown,
  fetchSearchTerm: string,
  currentSearchTerm: string,
  fetchStatusKey: string,
  currentStatusKey: string
) =>
  !data ||
  !Array.isArray(data) ||
  fetchSearchTerm !== currentSearchTerm ||
  fetchStatusKey !== currentStatusKey;

// When a status filter zeroes out the current page, the real total is not
// `0` — it's the unfiltered first-level count, fetched separately.
export const resolveTotalTermsCount = async (
  data: unknown[],
  isStatusFilterActive: boolean,
  pagingResponseTotal: number | undefined,
  glossaryFqn?: string
): Promise<number> => {
  if (data.length === 0 && isStatusFilterActive) {
    const countResponse = await getFirstLevelGlossaryTermsPaginated(
      glossaryFqn || '',
      0
    );

    return countResponse.paging?.total ?? 0;
  }

  return pagingResponseTotal ?? data.length;
};

export const hasActiveSearchTerm = (searchTerm: string) =>
  Boolean(searchTerm && searchTerm.trim().length > 0);

export const computeShowExpandTreeLoadMore = (
  toggleExpandBtn: boolean,
  after?: string
) => toggleExpandBtn && Boolean(after);

export const shouldShowEmptyPlaceholder = (
  hasNoTerms: boolean,
  isSearchActive: boolean,
  totalTermsCount: number,
  isTableLoading: boolean
) => hasNoTerms && !isSearchActive && totalTermsCount === 0 && !isTableLoading;
