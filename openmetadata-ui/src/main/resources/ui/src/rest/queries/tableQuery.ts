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

import { QueryClient } from '@tanstack/react-query';
import { TabSpecificField } from '../../enums/entity.enum';
import { Table } from '../../generated/entity/data/table';
import { defaultFieldsWithColumns } from '../../utils/DatasetDetailsUtils';
import { getTableDetailsByFQN } from '../tableAPI';

/**
 * Shared query plumbing for a single Table entity by FQN. Any consumer that wants a
 * cache-aware read — the detail page, a sidebar widget, a hover prefetch — should go
 * through {@link tableQueryKey} + {@link tableQueryFn} so they all hit the same normalized
 * cache slot. If two callers ask for the same {@code (fqn, fields)} combo, the second
 * doesn't re-fire the network request; if a mutation patches the cache via
 * {@link QueryClient.setQueryData}, every consumer sees the update.
 *
 * The {@code fields} list is part of the key on purpose: a "lite" caller that asks for
 * fewer fields shouldn't read a "heavy" caller's cached body (it might not contain the
 * fields the lite caller's UI actually needs — that's intentional, otherwise stale derived
 * state would surface). React Query's {@code structuralSharing} keeps the cost of a wider
 * key cheap — overlapping field sets aren't deduped at the cache layer, but the underlying
 * HTTP layer's ETag interceptor will translate a duplicate-content request into a 304.
 */
export const tableQueryKey = (fqn: string, fields: string) =>
  ['table', fqn, fields] as const;

export const tableQueryFn = (fqn: string, fields: string) => () =>
  getTableDetailsByFQN(fqn, { fields });

/**
 * Imperatively populate the cache for {@code fqn} so the next consumer reading the same key
 * gets a hit. Use from hover handlers on entity links — by the time the user clicks the
 * link and the detail page mounts, the data is already there. Falls through to a normal
 * background refetch when the cache entry is stale, so prefetch is idempotent.
 *
 * Errors are intentionally swallowed: a failed prefetch shouldn't surface a toast (the user
 * didn't ask for anything; we predicted they might). The page's own {@code useQuery} will
 * surface the same error if it really matters.
 */
export const prefetchTableByFqn = (
  queryClient: QueryClient,
  fqn: string,
  fields: string
) =>
  queryClient
    .prefetchQuery({
      queryKey: tableQueryKey(fqn, fields),
      queryFn: tableQueryFn(fqn, fields),
    })
    .catch(() => undefined);

export type TableQueryData = Table | undefined;

/**
 * Field set used for hover-prefetch. Matches the maximal {@code tableFields} the detail page
 * reads when the viewer has both {@code ViewUsage} and {@code ViewTests} permissions — the
 * common case for engineering / data users. Restricted viewers (no usage/test perms) read a
 * narrower {@code tableFields} on the page, so a hover-prefetch by them lands in a cache slot
 * the page won't consume; that's acceptable since prefetch is best-effort and the wasted
 * bytes are bounded to one request per hover.
 */
const PREFETCH_TABLE_FIELDS = `${defaultFieldsWithColumns},${TabSpecificField.USAGE_SUMMARY},${TabSpecificField.TESTSUITE}`;

/**
 * Convenience wrapper around {@link prefetchTableByFqn} for hover handlers. Uses the
 * canonical {@link PREFETCH_TABLE_FIELDS} so the warmed cache slot matches what
 * {@code TableDetailsPageV1} reads on mount for a permitted viewer.
 */
export const prefetchTable = (queryClient: QueryClient, fqn: string) =>
  prefetchTableByFqn(queryClient, fqn, PREFETCH_TABLE_FIELDS);
