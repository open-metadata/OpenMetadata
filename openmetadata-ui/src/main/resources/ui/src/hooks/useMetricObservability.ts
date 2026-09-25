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
import { useQuery } from '@tanstack/react-query';
import { getMetricTabObservability } from '../rest/metricTabsAPI';

export const metricObservabilityQueryKey = (metricId: string) => [
  'metric-observability',
  metricId,
];

interface UseMetricObservabilityOptions {
  enabled?: boolean;
}

export const useMetricObservability = (
  metricId?: string,
  { enabled = true }: UseMetricObservabilityOptions = {}
) => {
  const query = useQuery({
    queryKey: metricObservabilityQueryKey(metricId ?? ''),
    queryFn: () => getMetricTabObservability(metricId as string),
    enabled: Boolean(metricId) && enabled,
  });

  return {
    observability: query.data,
    error: query.error,
    isFetching: query.isFetching,
    isPending: query.isPending,
    refetch: query.refetch,
  };
};
