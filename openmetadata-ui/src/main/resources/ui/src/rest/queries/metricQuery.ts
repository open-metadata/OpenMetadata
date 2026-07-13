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
import { Metric } from '../../generated/entity/data/metric';
import { getMetricByFqn } from '../metricsAPI';

// Field list the detail page reads on mount. Inlined here rather than imported from a
// Utils file to keep the cache-key surface stable across edits to unrelated UI code.
export const METRIC_DEFAULT_FIELDS = [
  TabSpecificField.DATA_PRODUCTS,
  TabSpecificField.DERIVED_FROM,
  TabSpecificField.DOMAINS,
  TabSpecificField.EXTENSION,
  TabSpecificField.FOLLOWERS,
  TabSpecificField.OWNERS,
  TabSpecificField.RELATED_METRICS,
  TabSpecificField.REVIEWERS,
  TabSpecificField.TAGS,
  TabSpecificField.VOTES,
].join(',');

/**
 * Shared query plumbing for a single Metric entity by FQN. Mirrors {@code tableQuery.ts} —
 * see that file for the rationale behind keying on {@code (fqn, fields)} and the
 * prefetch / cache-hit story.
 */
export const metricQueryKey = (fqn: string, fields: string) =>
  ['metric', fqn, fields] as const;

export const metricQueryFn = (fqn: string, fields: string) => () =>
  getMetricByFqn(fqn, { fields });

export const prefetchMetricByFqn = (
  queryClient: QueryClient,
  fqn: string,
  fields: string
) =>
  queryClient
    .prefetchQuery({
      queryKey: metricQueryKey(fqn, fields),
      queryFn: metricQueryFn(fqn, fields),
    })
    .catch(() => undefined);

export type MetricQueryData = Metric | undefined;

export const prefetchMetric = (queryClient: QueryClient, fqn: string) =>
  prefetchMetricByFqn(queryClient, fqn, METRIC_DEFAULT_FIELDS);
