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
import { APIEndpoint } from '../../generated/entity/data/apiEndpoint';
import { getApiEndPointByFQN } from '../apiEndpointsAPI';

// Field list the detail page reads on mount. Mirrors the explicit list in
// {@code APIEndpointPage} (kept inline there rather than in a Utils file).
export const API_ENDPOINT_DEFAULT_FIELDS = [
  TabSpecificField.OWNERS,
  TabSpecificField.FOLLOWERS,
  TabSpecificField.TAGS,
  TabSpecificField.DOMAINS,
  TabSpecificField.DATA_PRODUCTS,
  TabSpecificField.VOTES,
  TabSpecificField.EXTENSION,
].join(',');

/**
 * Shared query plumbing for a single API Endpoint by FQN. Mirrors {@code tableQuery.ts} —
 * see that file for the rationale behind keying on {@code (fqn, fields)} and the
 * prefetch / cache-hit story.
 */
export const apiEndpointQueryKey = (fqn: string, fields: string) =>
  ['apiEndpoint', fqn, fields] as const;

export const apiEndpointQueryFn = (fqn: string, fields: string) => () =>
  getApiEndPointByFQN(fqn, { fields });

export const prefetchApiEndpointByFqn = (
  queryClient: QueryClient,
  fqn: string,
  fields: string
) =>
  queryClient
    .prefetchQuery({
      queryKey: apiEndpointQueryKey(fqn, fields),
      queryFn: apiEndpointQueryFn(fqn, fields),
    })
    .catch(() => undefined);

export type ApiEndpointQueryData = APIEndpoint | undefined;

export const prefetchApiEndpoint = (queryClient: QueryClient, fqn: string) =>
  prefetchApiEndpointByFqn(queryClient, fqn, API_ENDPOINT_DEFAULT_FIELDS);
