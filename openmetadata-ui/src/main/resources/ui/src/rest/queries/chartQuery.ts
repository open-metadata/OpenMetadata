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
import { Chart } from '../../generated/entity/data/chart';
import { getChartByFqn } from '../chartsAPI';

// Inlined here (not imported from {@code ChartDetailsUtils}) to avoid the kind of circular
// import that broke production bundles for Dashboard (see {@code dashboardQuery.ts} for the
// detailed write-up). Keep this list in sync with {@code ChartDetailsUtils.defaultFields}.
const CHART_DEFAULT_FIELDS = [
  TabSpecificField.DOMAINS,
  TabSpecificField.OWNERS,
  TabSpecificField.FOLLOWERS,
  TabSpecificField.TAGS,
  TabSpecificField.VOTES,
  TabSpecificField.DATA_PRODUCTS,
  TabSpecificField.EXTENSION,
].join(',');

/**
 * Shared query plumbing for a single Chart entity by FQN. Mirrors {@code tableQuery.ts} —
 * see that file for the rationale behind keying on {@code (fqn, fields)} and the
 * prefetch / cache-hit story.
 */
export const chartQueryKey = (fqn: string, fields: string) =>
  ['chart', fqn, fields] as const;

export const chartQueryFn = (fqn: string, fields: string) => () =>
  getChartByFqn(fqn, { fields });

export const prefetchChartByFqn = (
  queryClient: QueryClient,
  fqn: string,
  fields: string
) =>
  queryClient
    .prefetchQuery({
      queryKey: chartQueryKey(fqn, fields),
      queryFn: chartQueryFn(fqn, fields),
    })
    .catch(() => undefined);

export type ChartQueryData = Chart | undefined;

const PREFETCH_CHART_FIELDS = `${CHART_DEFAULT_FIELDS},${TabSpecificField.USAGE_SUMMARY}`;

export const prefetchChart = (queryClient: QueryClient, fqn: string) =>
  prefetchChartByFqn(queryClient, fqn, PREFETCH_CHART_FIELDS);
