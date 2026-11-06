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
import { Dashboard } from '../../generated/entity/data/dashboard';
import { getDashboardByFqn } from '../dashboardAPI';

// Inlined here (not imported from {@code DashboardDetailsUtils}) to break a circular import:
// {@code DashboardDetailsUtils.tsx} pulls {@code ChartType} from
// {@code DashboardDetailsPage.component.tsx}, and the page imports {@code dashboardQueryFn} /
// {@code dashboardQueryKey} from this file. Importing back into Utils from here closes the
// cycle and triggers a TDZ "Cannot access X before initialization" error in production
// bundles. Keep this list in sync with {@code DashboardDetailsUtils.defaultFields}.
const DASHBOARD_DEFAULT_FIELDS = [
  TabSpecificField.DOMAINS,
  TabSpecificField.OWNERS,
  TabSpecificField.FOLLOWERS,
  TabSpecificField.TAGS,
  TabSpecificField.CHARTS,
  TabSpecificField.VOTES,
  TabSpecificField.DATA_PRODUCTS,
  TabSpecificField.EXTENSION,
].join(',');

/**
 * Shared query plumbing for a single Dashboard by FQN. Mirrors
 * {@code tableQuery.ts} — see that file for the rationale behind keying on
 * {@code (fqn, fields)} and the prefetch / cache-hit story.
 */
export const dashboardQueryKey = (fqn: string, fields: string) =>
  ['dashboard', fqn, fields] as const;

export const dashboardQueryFn = (fqn: string, fields: string) => () =>
  getDashboardByFqn(fqn, { fields });

export const prefetchDashboardByFqn = (
  queryClient: QueryClient,
  fqn: string,
  fields: string
) =>
  queryClient
    .prefetchQuery({
      queryKey: dashboardQueryKey(fqn, fields),
      queryFn: dashboardQueryFn(fqn, fields),
    })
    .catch(() => undefined);

export type DashboardQueryData = Dashboard | undefined;

const PREFETCH_DASHBOARD_FIELDS = `${DASHBOARD_DEFAULT_FIELDS},${TabSpecificField.USAGE_SUMMARY}`;

/**
 * Convenience wrapper for hover handlers — uses the maximal fields the
 * detail page reads when the viewer has {@code ViewUsage} permission.
 */
export const prefetchDashboard = (queryClient: QueryClient, fqn: string) =>
  prefetchDashboardByFqn(queryClient, fqn, PREFETCH_DASHBOARD_FIELDS);
