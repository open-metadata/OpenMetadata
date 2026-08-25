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
import { StoredProcedure } from '../../generated/entity/data/storedProcedure';
import { Include } from '../../generated/type/include';
import { STORED_PROCEDURE_DEFAULT_FIELDS } from '../../utils/StoredProceduresUtils';
import { getStoredProceduresByFqn } from '../storedProceduresAPI';

export const storedProcedureQueryKey = (fqn: string, fields: string) =>
  ['storedProcedure', fqn, fields] as const;

export const storedProcedureQueryFn = (fqn: string, fields: string) => () =>
  getStoredProceduresByFqn(fqn, { fields, include: Include.All });

export const prefetchStoredProcedureByFqn = (
  queryClient: QueryClient,
  fqn: string,
  fields: string
) =>
  queryClient
    .prefetchQuery({
      queryKey: storedProcedureQueryKey(fqn, fields),
      queryFn: storedProcedureQueryFn(fqn, fields),
    })
    .catch(() => undefined);

export type StoredProcedureQueryData = StoredProcedure | undefined;

export const prefetchStoredProcedure = (
  queryClient: QueryClient,
  fqn: string
) =>
  prefetchStoredProcedureByFqn(
    queryClient,
    fqn,
    STORED_PROCEDURE_DEFAULT_FIELDS
  );
