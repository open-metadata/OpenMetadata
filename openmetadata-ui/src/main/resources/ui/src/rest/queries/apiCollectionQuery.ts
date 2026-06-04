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
import { APICollection } from '../../generated/entity/data/apiCollection';
import { Include } from '../../generated/type/include';
import { getApiCollectionByFQN } from '../apiCollectionsAPI';

// Field list the detail page reads on mount. Inlined here (not imported from a Utils file)
// to avoid the kind of circular-import problem that bit DashboardDetailsUtils (see
// {@code dashboardQuery.ts} for the write-up). Keep in sync with the explicit list used
// in {@code APICollectionPage}.
export const API_COLLECTION_DEFAULT_FIELDS = [
  TabSpecificField.OWNERS,
  TabSpecificField.TAGS,
  TabSpecificField.DOMAINS,
  TabSpecificField.VOTES,
  TabSpecificField.EXTENSION,
  TabSpecificField.DATA_PRODUCTS,
].join(',');

/**
 * Shared query plumbing for a single API Collection by FQN. Mirrors {@code tableQuery.ts} —
 * see that file for the rationale behind keying on {@code (fqn, fields)} and the
 * prefetch / cache-hit story.
 *
 * Unlike other detail pages, API Collections always pass {@code include: Include.All} so
 * the page can render both live and soft-deleted collections without an extra round-trip.
 * Bake the include into the query function so callers don't have to remember.
 */
export const apiCollectionQueryKey = (fqn: string, fields: string) =>
  ['apiCollection', fqn, fields] as const;

export const apiCollectionQueryFn = (fqn: string, fields: string) => () =>
  getApiCollectionByFQN(fqn, { fields, include: Include.All });

export const prefetchApiCollectionByFqn = (
  queryClient: QueryClient,
  fqn: string,
  fields: string
) =>
  queryClient
    .prefetchQuery({
      queryKey: apiCollectionQueryKey(fqn, fields),
      queryFn: apiCollectionQueryFn(fqn, fields),
    })
    .catch(() => undefined);

export type ApiCollectionQueryData = APICollection | undefined;

export const prefetchApiCollection = (queryClient: QueryClient, fqn: string) =>
  prefetchApiCollectionByFqn(queryClient, fqn, API_COLLECTION_DEFAULT_FIELDS);
