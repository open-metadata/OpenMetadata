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
import { Container } from '../../generated/entity/data/container';
import { Include } from '../../generated/type/include';
import { getContainerByName } from '../storageAPI';

// {@code ContainerPage} historically passes {@code fields} as a {@code string[]} rather than
// a comma-joined string — Axios serializes either form to repeated query params, but the
// existing component test asserts the array shape. Keep the array so the migration is a
// no-op for snapshot/argument matchers.
export const CONTAINER_DEFAULT_FIELDS: string[] = [
  TabSpecificField.PARENT,
  TabSpecificField.DATAMODEL,
  TabSpecificField.OWNERS,
  TabSpecificField.TAGS,
  TabSpecificField.FOLLOWERS,
  TabSpecificField.EXTENSION,
  TabSpecificField.DOMAINS,
  TabSpecificField.DATA_PRODUCTS,
  TabSpecificField.VOTES,
];

export const containerQueryKey = (fqn: string, fields: string | string[]) =>
  [
    'container',
    fqn,
    Array.isArray(fields) ? fields.join(',') : fields,
  ] as const;

export const containerQueryFn =
  (fqn: string, fields: string | string[]) => () =>
    getContainerByName(fqn, { fields, include: Include.All });

export const prefetchContainerByFqn = (
  queryClient: QueryClient,
  fqn: string,
  fields: string | string[]
) =>
  queryClient
    .prefetchQuery({
      queryKey: containerQueryKey(fqn, fields),
      queryFn: containerQueryFn(fqn, fields),
    })
    .catch(() => undefined);

export type ContainerQueryData = Container | undefined;

export const prefetchContainer = (queryClient: QueryClient, fqn: string) =>
  prefetchContainerByFqn(queryClient, fqn, CONTAINER_DEFAULT_FIELDS);
