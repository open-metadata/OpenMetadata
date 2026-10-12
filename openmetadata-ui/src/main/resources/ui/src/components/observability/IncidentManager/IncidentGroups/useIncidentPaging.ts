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

import { useCallback, useState } from 'react';

interface PageState {
  /** The query the page belongs to; a page of another query is page 1. */
  queryKey: string;
  currentPage: number;
}

/**
 * Page state for the incident listings, which take a 1-based page. Any change
 * to the query — or to the page size — reads as the first page again. That
 * reset is derived rather than set from an effect, so the stale page is never
 * fetched on the way.
 */
export const useIncidentPaging = (
  queryKey: string,
  defaultPageSize: number
) => {
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const pagedKey = `${queryKey}|${pageSize}`;
  const [page, setPage] = useState<PageState>({
    queryKey: pagedKey,
    currentPage: 1,
  });
  const currentPage = page.queryKey === pagedKey ? page.currentPage : 1;

  const goToPage = useCallback(
    (nextPage: number) =>
      setPage({ queryKey: pagedKey, currentPage: nextPage }),
    [pagedKey]
  );

  return { currentPage, pageSize, setPageSize, goToPage };
};
