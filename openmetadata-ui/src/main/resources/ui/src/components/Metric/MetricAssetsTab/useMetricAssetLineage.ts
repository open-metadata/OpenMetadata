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
import { useMemo } from 'react';
import { getMetricTabLineage } from '../../../rest/metricTabsAPI';
import { MetricAssetLineageColumn } from './MetricAssetsTab.types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getEntityId = (entity: unknown): string | undefined => {
  if (typeof entity === 'string') {
    return entity;
  }

  return isRecord(entity) && typeof entity.id === 'string'
    ? entity.id
    : undefined;
};

const getEntityFqn = (entity: unknown): string | undefined =>
  isRecord(entity) && typeof entity.fullyQualifiedName === 'string'
    ? entity.fullyQualifiedName
    : undefined;

const getCurrentMetricId = (
  lineage: unknown,
  metricFqn: string
): string | undefined => {
  if (!isRecord(lineage)) {
    return;
  }

  const legacyMetricId = getEntityId(lineage.entity);
  if (legacyMetricId) {
    return legacyMetricId;
  }

  let nodes: unknown[] = [];
  if (Array.isArray(lineage.nodes)) {
    nodes = lineage.nodes;
  } else if (isRecord(lineage.nodes)) {
    nodes = Object.values(lineage.nodes);
  }

  for (const node of nodes) {
    if (!isRecord(node)) {
      continue;
    }

    const entity = isRecord(node.entity) ? node.entity : node;
    if (getEntityFqn(entity) === metricFqn) {
      return getEntityId(entity);
    }
  }
};

const getUpstreamEdges = (lineage: unknown): unknown[] => {
  if (!isRecord(lineage)) {
    return [];
  }

  if (Array.isArray(lineage.upstreamEdges)) {
    return lineage.upstreamEdges;
  }

  return isRecord(lineage.upstreamEdges)
    ? Object.values(lineage.upstreamEdges)
    : [];
};

const getColumns = (edge: Record<string, unknown>): unknown[] => {
  if (Array.isArray(edge.columns)) {
    return edge.columns;
  }

  return isRecord(edge.lineageDetails) &&
    Array.isArray(edge.lineageDetails.columnsLineage)
    ? edge.lineageDetails.columnsLineage
    : [];
};

const normalizeColumn = (
  column: unknown
): MetricAssetLineageColumn | undefined => {
  if (!isRecord(column)) {
    return;
  }

  const fromColumns = Array.isArray(column.fromColumns)
    ? column.fromColumns.filter(
        (fromColumn): fromColumn is string => typeof fromColumn === 'string'
      )
    : [];

  return {
    fromColumns,
    ...(typeof column.toColumn === 'string'
      ? { toColumn: column.toColumn }
      : {}),
  };
};

export const metricAssetLineageQueryKey = (metricFqn: string) => [
  'metric-asset-lineage-columns',
  metricFqn,
];

export const useMetricAssetLineage = (metricFqn: string, assetId?: string) => {
  const query = useQuery({
    queryKey: metricAssetLineageQueryKey(metricFqn),
    queryFn: () => getMetricTabLineage(metricFqn),
    enabled: Boolean(metricFqn && assetId),
    staleTime: 60_000,
  });

  const columns = useMemo<MetricAssetLineageColumn[]>(() => {
    if (!assetId || !query.data) {
      return [];
    }

    const metricId = getCurrentMetricId(query.data, metricFqn);

    return getUpstreamEdges(query.data).flatMap((edge) => {
      if (!isRecord(edge) || getEntityId(edge.fromEntity) !== assetId) {
        return [];
      }

      const targetMatchesMetric = metricId
        ? getEntityId(edge.toEntity) === metricId
        : getEntityFqn(edge.toEntity) === metricFqn;
      if (!targetMatchesMetric) {
        return [];
      }

      return getColumns(edge).flatMap((column) => {
        const normalizedColumn = normalizeColumn(column);

        return normalizedColumn ? [normalizedColumn] : [];
      });
    });
  }, [assetId, metricFqn, query.data]);

  return {
    columns,
    error: query.error,
    isLoading: query.isPending && query.isFetching,
    refetch: query.refetch,
  };
};
