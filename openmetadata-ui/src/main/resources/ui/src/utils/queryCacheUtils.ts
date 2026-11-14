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
  InvalidateOptions,
  InvalidateQueryFilters,
  QueryClient,
} from '@tanstack/react-query';

/**
 * React Query deduplicates invalidation against an active initial fetch when the query has no data,
 * so that pre-mutation response can otherwise settle as fresh. Cancel only that observed initial
 * request (silently) before normal invalidation; unobserved imperative awaiters remain detached.
 */
export const invalidateQueriesWithoutInitialRace = (
  queryClient: QueryClient,
  filters: InvalidateQueryFilters,
  options?: InvalidateOptions
): Promise<void> => {
  if (filters.refetchType !== 'none') {
    queryClient
      .getQueryCache()
      .findAll(filters)
      .filter(
        (query) =>
          query.isActive() &&
          query.state.data === undefined &&
          query.state.fetchStatus === 'fetching'
      )
      .forEach((query) => {
        void query.cancel({ revert: true, silent: true });
      });
  }

  return options
    ? queryClient.invalidateQueries(filters, options)
    : queryClient.invalidateQueries(filters);
};
