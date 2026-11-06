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
import { Database } from '../../generated/entity/data/database';
import { Include } from '../../generated/type/include';
import { getDatabaseDetailsByFQN } from '../databaseAPI';

export const DATABASE_DEFAULT_FIELDS = [
  TabSpecificField.OWNERS,
  TabSpecificField.TAGS,
  TabSpecificField.DOMAINS,
  TabSpecificField.VOTES,
  TabSpecificField.EXTENSION,
  TabSpecificField.DATA_PRODUCTS,
  TabSpecificField.FOLLOWERS,
].join(',');

export const databaseQueryKey = (fqn: string, fields: string) =>
  ['database', fqn, fields] as const;

export const databaseQueryFn = (fqn: string, fields: string) => () =>
  getDatabaseDetailsByFQN(fqn, { fields, include: Include.All });

export const prefetchDatabaseByFqn = (
  queryClient: QueryClient,
  fqn: string,
  fields: string
) =>
  queryClient
    .prefetchQuery({
      queryKey: databaseQueryKey(fqn, fields),
      queryFn: databaseQueryFn(fqn, fields),
    })
    .catch(() => undefined);

export type DatabaseQueryData = Database | undefined;

export const prefetchDatabase = (queryClient: QueryClient, fqn: string) =>
  prefetchDatabaseByFqn(queryClient, fqn, DATABASE_DEFAULT_FIELDS);
