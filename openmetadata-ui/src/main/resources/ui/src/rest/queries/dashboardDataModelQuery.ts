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
import { DashboardDataModel } from '../../generated/entity/data/dashboardDataModel';
import { Include } from '../../generated/type/include';
import { getDataModelByFqn } from '../dataModelsAPI';

// Inlined here (not imported from {@code DataModelsUtils}) to avoid the kind of
// circular import that broke production bundles for Dashboard (see
// {@code dashboardQuery.ts} for the detailed write-up). Keep this list in sync
// with the fields read by {@code DataModelPage.component}.
const DASHBOARD_DATA_MODEL_DEFAULT_FIELDS = [
  TabSpecificField.OWNERS,
  TabSpecificField.TAGS,
  TabSpecificField.FOLLOWERS,
  TabSpecificField.VOTES,
  TabSpecificField.DOMAINS,
  TabSpecificField.DATA_PRODUCTS,
  TabSpecificField.EXTENSION,
].join(',');

export const dashboardDataModelQueryKey = (fqn: string, fields: string) =>
  ['dashboardDataModel', fqn, fields] as const;

export const dashboardDataModelQueryFn = (fqn: string, fields: string) => () =>
  getDataModelByFqn(fqn, { fields, include: Include.All });

export const prefetchDashboardDataModelByFqn = (
  queryClient: QueryClient,
  fqn: string,
  fields: string
) =>
  queryClient
    .prefetchQuery({
      queryKey: dashboardDataModelQueryKey(fqn, fields),
      queryFn: dashboardDataModelQueryFn(fqn, fields),
    })
    .catch(() => undefined);

export type DashboardDataModelQueryData = DashboardDataModel | undefined;

export const prefetchDashboardDataModel = (
  queryClient: QueryClient,
  fqn: string
) =>
  prefetchDashboardDataModelByFqn(
    queryClient,
    fqn,
    DASHBOARD_DATA_MODEL_DEFAULT_FIELDS
  );
