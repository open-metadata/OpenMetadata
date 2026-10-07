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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { compact } from 'lodash';
import { useCallback } from 'react';
import { getMetricTabAssets } from '../rest/metricTabsAPI';
import {
  BULK_ACTION_CONCURRENCY,
  runWithConcurrencyLimit,
} from '../utils/AsyncUtils';
import { metricObservabilityQueryKey } from './useMetricObservability';

// The server caps a single page of linked assets at 1000.
export const METRIC_LINKED_ASSETS_PAGE_LIMIT = 1000;

export const metricLinkedAssetsQueryKey = (metricId: string) => [
  'metric-linked-assets',
  metricId,
];

export const fetchMetricLinkedAssetIds = async (
  metricId: string
): Promise<string[]> => {
  const firstPage = await getMetricTabAssets(metricId, {
    limit: METRIC_LINKED_ASSETS_PAGE_LIMIT,
    offset: 0,
  });
  const total = firstPage.paging?.total ?? firstPage.data.length;
  const remainingOffsets = Array.from(
    {
      length: Math.max(
        Math.ceil(total / METRIC_LINKED_ASSETS_PAGE_LIMIT) - 1,
        0
      ),
    },
    (_, index) => (index + 1) * METRIC_LINKED_ASSETS_PAGE_LIMIT
  );
  const remainingPages = await runWithConcurrencyLimit(
    remainingOffsets,
    BULK_ACTION_CONCURRENCY,
    (offset) =>
      getMetricTabAssets(metricId, {
        limit: METRIC_LINKED_ASSETS_PAGE_LIMIT,
        offset,
      })
  );

  return [firstPage, ...compact(remainingPages)].flatMap(({ data }) =>
    data.map(({ asset }) => asset.id)
  );
};

export const useMetricLinkedAssets = (metricId?: string) => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: metricLinkedAssetsQueryKey(metricId ?? ''),
    queryFn: () => fetchMetricLinkedAssetIds(metricId as string),
    enabled: Boolean(metricId),
  });

  // Linking or unlinking an asset also changes which upstream assets feed the health rollup.
  const refresh = useCallback(async () => {
    if (!metricId) {
      return;
    }
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: metricLinkedAssetsQueryKey(metricId),
      }),
      queryClient.invalidateQueries({
        queryKey: metricObservabilityQueryKey(metricId),
      }),
    ]);
  }, [metricId, queryClient]);

  return {
    assetIds: query.data,
    assetCount: query.data?.length ?? 0,
    isPending: query.isPending,
    refresh,
  };
};
