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
import { Mlmodel } from '../../generated/entity/data/mlmodel';
import { getMlModelByFQN } from '../mlModelAPI';

// Inlined here (not imported from {@code MlModelDetailsUtils}) to avoid the kind of
// circular import that broke production bundles for Dashboard (see {@code dashboardQuery.ts}
// for the detailed write-up). Keep this list in sync with
// {@code MlModelDetailsUtils.defaultFields}.
const MLMODEL_DEFAULT_FIELDS = [
  TabSpecificField.FOLLOWERS,
  TabSpecificField.TAGS,
  TabSpecificField.DOMAINS,
  TabSpecificField.OWNERS,
  TabSpecificField.DASHBOARD,
  TabSpecificField.DATA_PRODUCTS,
  TabSpecificField.VOTES,
  TabSpecificField.EXTENSION,
].join(',');

export const mlModelQueryKey = (fqn: string, fields: string) =>
  ['mlModel', fqn, fields] as const;

export const mlModelQueryFn = (fqn: string, fields: string) => () =>
  getMlModelByFQN(fqn, { fields });

export const prefetchMlModelByFqn = (
  queryClient: QueryClient,
  fqn: string,
  fields: string
) =>
  queryClient
    .prefetchQuery({
      queryKey: mlModelQueryKey(fqn, fields),
      queryFn: mlModelQueryFn(fqn, fields),
    })
    .catch(() => undefined);

export type MlModelQueryData = Mlmodel | undefined;

const PREFETCH_MLMODEL_FIELDS = `${MLMODEL_DEFAULT_FIELDS},${TabSpecificField.USAGE_SUMMARY}`;

export const prefetchMlModel = (queryClient: QueryClient, fqn: string) =>
  prefetchMlModelByFqn(queryClient, fqn, PREFETCH_MLMODEL_FIELDS);
