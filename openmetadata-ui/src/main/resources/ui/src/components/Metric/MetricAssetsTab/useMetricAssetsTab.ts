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
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MetricAssetDirection } from '../../../generated/api/data/metricObservability';
import { EntityReference } from '../../../generated/entity/type';
import { BulkOperationResult } from '../../../generated/type/bulkOperationResult';
import {
  getMetricTabAssetDetails,
  getMetricTabAssets,
  removeMetricTabAssets,
} from '../../../rest/metricTabsAPI';
import {
  MetricAssetDetails,
  MetricAssetFilters,
  METRIC_ASSETS_PAGE_SIZE,
} from './MetricAssetsTab.types';
import {
  getBulkFailureCount,
  getBulkFailureIds,
  normalizeMetricAssetDetails,
} from './MetricAssetsTab.utils';

const DEFAULT_FILTERS: MetricAssetFilters = {
  direction: 'all',
  search: '',
  type: 'all',
};

export const metricAssetsQueryKey = (metricId: string) => [
  'metric-assets',
  metricId,
];

export const useMetricAssetsCount = (metricId?: string) => {
  const query = useQuery({
    queryKey: [...metricAssetsQueryKey(metricId ?? ''), 'count'],
    queryFn: ({ signal }) =>
      getMetricTabAssets(
        metricId as string,
        { limit: 1, offset: 0 },
        { signal }
      ),
    enabled: Boolean(metricId),
  });

  return {
    count: query.data?.paging.total ?? 0,
    error: query.error,
    isPending: query.isPending,
    refetch: query.refetch,
  };
};

export const metricAssetsPageQueryKey = (
  metricId: string,
  page: number,
  filters: MetricAssetFilters
) => [
  ...metricAssetsQueryKey(metricId),
  page,
  filters.search,
  filters.type,
  filters.direction,
];

export const metricAssetDetailsQueryKey = (asset: EntityReference) => [
  'metric-asset-details',
  asset.type,
  asset.fullyQualifiedName,
];

const getAssetDetails = async (
  asset: EntityReference,
  signal?: AbortSignal
): Promise<MetricAssetDetails> => {
  if (!asset.fullyQualifiedName) {
    return normalizeMetricAssetDetails(asset);
  }
  const entity = await getMetricTabAssetDetails(
    asset.type,
    asset.fullyQualifiedName,
    { signal }
  );

  return normalizeMetricAssetDetails(asset, entity);
};

export interface UseMetricAssetsTabParams {
  metricFqn: string;
  metricId: string;
  onAssetsChange?: () => void;
}

export const useMetricAssetsTab = ({
  metricFqn,
  metricId,
  onAssetsChange,
}: UseMetricAssetsTabParams) => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<MetricAssetFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [selectedAssets, setSelectedAssets] = useState<
    Map<string, MetricAssetDirection>
  >(new Map());
  const [activeAssetId, setActiveAssetId] = useState<string>();
  const [bulkResult, setBulkResult] = useState<BulkOperationResult>();

  const assetsQuery = useQuery({
    queryKey: metricAssetsPageQueryKey(metricId, page, filters),
    queryFn: ({ signal }) =>
      getMetricTabAssets(
        metricId,
        {
          direction:
            filters.direction === 'all' ? undefined : filters.direction,
          entityType: filters.type === 'all' ? undefined : filters.type,
          limit: METRIC_ASSETS_PAGE_SIZE,
          offset: (page - 1) * METRIC_ASSETS_PAGE_SIZE,
          q: filters.search.trim() || undefined,
        },
        { signal }
      ),
    enabled: Boolean(metricId),
    placeholderData: (previousData) => previousData,
  });

  const assets = assetsQuery.data?.data ?? [];
  const totalAssets = assetsQuery.data?.paging.total ?? 0;
  const totalPages = Math.max(
    1,
    Math.ceil(totalAssets / METRIC_ASSETS_PAGE_SIZE)
  );
  const pageAssets = assets;

  useEffect(() => {
    setPage(1);
  }, [filters]);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (
      activeAssetId &&
      !pageAssets.some(({ asset }) => asset.id === activeAssetId)
    ) {
      setActiveAssetId(undefined);
    }
  }, [activeAssetId, pageAssets]);

  const detailQueries = useQueries({
    queries: pageAssets.map(({ asset }) => ({
      queryKey: metricAssetDetailsQueryKey(asset),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        getAssetDetails(asset, signal),
      enabled: Boolean(asset.fullyQualifiedName),
      staleTime: 60_000,
    })),
  });

  const detailsById = useMemo(() => {
    return new Map(
      pageAssets.map(({ asset }, index) => [
        asset.id,
        detailQueries[index]?.data ?? normalizeMetricAssetDetails(asset),
      ])
    );
  }, [detailQueries, pageAssets]);
  const detailLoadingIds = useMemo(
    () =>
      new Set(
        pageAssets.flatMap(({ asset }, index) =>
          detailQueries[index]?.isFetching ? [asset.id] : []
        )
      ),
    [detailQueries, pageAssets]
  );
  const detailErrorIds = useMemo(
    () =>
      new Set(
        pageAssets.flatMap(({ asset }, index) =>
          detailQueries[index]?.error ? [asset.id] : []
        )
      ),
    [detailQueries, pageAssets]
  );

  const unlinkMutation = useMutation({
    mutationFn: (selectedAssets: MetricAssetDirection[]) =>
      removeMetricTabAssets(
        metricFqn,
        selectedAssets.map(({ asset }) => ({
          id: asset.id,
          type: asset.type,
          fullyQualifiedName: asset.fullyQualifiedName,
          name: asset.name,
        }))
      ),
    onSuccess: (result) => {
      const failureIds = getBulkFailureIds(result);
      const failureCount = getBulkFailureCount(result);
      setBulkResult(result);
      setSelectedAssets((current) => {
        if (failureIds.size > 0) {
          return new Map(
            [...current].filter(([assetId]) => failureIds.has(assetId))
          );
        }

        return failureCount > 0 ? current : new Map();
      });
      queryClient.invalidateQueries({
        queryKey: metricAssetsQueryKey(metricId),
      });
      onAssetsChange?.();
    },
  });

  const selectedIds = useMemo(
    () => new Set(selectedAssets.keys()),
    [selectedAssets]
  );

  const toggleAsset = useCallback((relation: MetricAssetDirection) => {
    setSelectedAssets((current) => {
      const next = new Map(current);
      if (next.has(relation.asset.id)) {
        next.delete(relation.asset.id);
      } else {
        next.set(relation.asset.id, relation);
      }

      return next;
    });
  }, []);

  const areAllPageAssetsSelected =
    pageAssets.length > 0 &&
    pageAssets.every(({ asset }) => selectedIds.has(asset.id));

  const togglePage = useCallback(() => {
    setSelectedAssets((current) => {
      const next = new Map(current);
      const selectPage = !pageAssets.every(({ asset }) => next.has(asset.id));
      pageAssets.forEach((relation) => {
        if (selectPage) {
          next.set(relation.asset.id, relation);
        } else {
          next.delete(relation.asset.id);
        }
      });

      return next;
    });
  }, [pageAssets]);

  return {
    activeAssetId,
    areAllPageAssetsSelected,
    assets,
    bulkResult,
    detailErrorIds,
    detailLoadingIds,
    detailsById,
    error: assetsQuery.error,
    filters,
    isLoading: assetsQuery.isPending,
    isActiveDetailsLoading: Boolean(
      activeAssetId && detailLoadingIds.has(activeAssetId)
    ),
    isRefetching: assetsQuery.isRefetching,
    isUnlinking: unlinkMutation.isPending,
    page,
    pageAssets,
    selectedIds,
    totalAssets,
    totalPages,
    unlinkError: unlinkMutation.error,
    clearBulkResult: () => setBulkResult(undefined),
    refetch: assetsQuery.refetch,
    refetchAssetDetails: (assetId: string) => {
      const assetIndex = pageAssets.findIndex(
        ({ asset }) => asset.id === assetId
      );
      if (assetIndex >= 0) {
        detailQueries[assetIndex]?.refetch();
      }
    },
    setActiveAssetId,
    setFilters,
    setPage,
    toggleAsset,
    togglePage,
    unlinkSelected: () =>
      unlinkMutation.mutateAsync([...selectedAssets.values()]),
  };
};
