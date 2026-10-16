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
import { SearchIndex } from '../../generated/entity/data/searchIndex';
import { getSearchIndexDetailsByFQN } from '../SearchIndexAPI';

// Inlined here (not imported from {@code SearchIndexUtils}) to avoid the kind of
// circular import that broke production bundles for Dashboard (see {@code dashboardQuery.ts}
// for the detailed write-up). Keep this list in sync with
// {@code SearchIndexUtils.defaultFields}.
export const SEARCH_INDEX_DEFAULT_FIELDS = [
  TabSpecificField.FIELDS,
  TabSpecificField.FOLLOWERS,
  TabSpecificField.TAGS,
  TabSpecificField.OWNERS,
  TabSpecificField.DOMAINS,
  TabSpecificField.VOTES,
  TabSpecificField.DATA_PRODUCTS,
  TabSpecificField.EXTENSION,
].join(',');

export const searchIndexQueryKey = (fqn: string, fields: string) =>
  ['searchIndex', fqn, fields] as const;

export const searchIndexQueryFn = (fqn: string, fields: string) => () =>
  getSearchIndexDetailsByFQN(fqn, { fields });

export const prefetchSearchIndexByFqn = (
  queryClient: QueryClient,
  fqn: string,
  fields: string
) =>
  queryClient
    .prefetchQuery({
      queryKey: searchIndexQueryKey(fqn, fields),
      queryFn: searchIndexQueryFn(fqn, fields),
    })
    .catch(() => undefined);

export type SearchIndexQueryData = SearchIndex | undefined;

export const prefetchSearchIndex = (queryClient: QueryClient, fqn: string) =>
  prefetchSearchIndexByFqn(queryClient, fqn, SEARCH_INDEX_DEFAULT_FIELDS);
