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
import { DataProduct } from '../../generated/entity/domains/dataProduct';
import { getDataProductByName } from '../dataProductAPI';

export const DATA_PRODUCT_DEFAULT_FIELDS: TabSpecificField[] = [
  TabSpecificField.DOMAINS,
  TabSpecificField.OWNERS,
  TabSpecificField.EXPERTS,
  TabSpecificField.ASSETS,
  TabSpecificField.EXTENSION,
  TabSpecificField.TAGS,
  TabSpecificField.FOLLOWERS,
  TabSpecificField.REVIEWERS,
  TabSpecificField.VOTES,
  TabSpecificField.CERTIFICATION,
];

export const dataProductQueryKey = (fqn: string, fields: string[]) =>
  ['dataProduct', fqn, fields.join(',')] as const;

export const dataProductQueryFn = (fqn: string, fields: string[]) => () =>
  getDataProductByName(fqn, { fields });

export const prefetchDataProductByFqn = (
  queryClient: QueryClient,
  fqn: string,
  fields: string[]
) =>
  queryClient
    .prefetchQuery({
      queryKey: dataProductQueryKey(fqn, fields),
      queryFn: dataProductQueryFn(fqn, fields),
    })
    .catch(() => undefined);

export type DataProductQueryData = DataProduct | undefined;

export const prefetchDataProduct = (queryClient: QueryClient, fqn: string) =>
  prefetchDataProductByFqn(queryClient, fqn, DATA_PRODUCT_DEFAULT_FIELDS);
