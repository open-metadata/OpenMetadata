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
import { DatabaseSchema } from '../../generated/entity/data/databaseSchema';
import { Include } from '../../generated/type/include';
import { getDatabaseSchemaDetailsByFQN } from '../databaseAPI';

export const DATABASE_SCHEMA_DEFAULT_FIELDS = [
  TabSpecificField.OWNERS,
  TabSpecificField.TAGS,
  TabSpecificField.DOMAINS,
  TabSpecificField.VOTES,
  TabSpecificField.EXTENSION,
  TabSpecificField.FOLLOWERS,
  TabSpecificField.DATA_PRODUCTS,
].join(',');

export const databaseSchemaQueryKey = (fqn: string, fields: string) =>
  ['databaseSchema', fqn, fields] as const;

export const databaseSchemaQueryFn = (fqn: string, fields: string) => () =>
  getDatabaseSchemaDetailsByFQN(fqn, { fields, include: Include.All });

export const prefetchDatabaseSchemaByFqn = (
  queryClient: QueryClient,
  fqn: string,
  fields: string
) =>
  queryClient
    .prefetchQuery({
      queryKey: databaseSchemaQueryKey(fqn, fields),
      queryFn: databaseSchemaQueryFn(fqn, fields),
    })
    .catch(() => undefined);

export type DatabaseSchemaQueryData = DatabaseSchema | undefined;

const PREFETCH_DATABASE_SCHEMA_FIELDS = `${DATABASE_SCHEMA_DEFAULT_FIELDS},${TabSpecificField.USAGE_SUMMARY}`;

export const prefetchDatabaseSchema = (queryClient: QueryClient, fqn: string) =>
  prefetchDatabaseSchemaByFqn(
    queryClient,
    fqn,
    PREFETCH_DATABASE_SCHEMA_FIELDS
  );
