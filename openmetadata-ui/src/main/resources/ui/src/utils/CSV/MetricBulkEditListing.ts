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
import { Metric } from '../../generated/entity/data/metric';
import { Include } from '../../generated/type/include';
import { getMetrics } from '../../rest/metricsAPI';
import { fetchAllPages } from '../AsyncUtils';
import { getMetricColumnsAndDataSourceFromMetrics } from './CSV.utils';
import type {
  BulkEditListingFilters,
  BulkEditListingGrid,
  BulkEditListingGridArgs,
} from './EntityBulkEditConfigClassBase';

const LISTING_PAGE_SIZE = 1000;

const matchesListingFilters = (
  metric: Metric,
  filters: BulkEditListingFilters
) => {
  const searchValue = filters.searchText?.trim().toLowerCase();
  const matchesSearch = searchValue
    ? [
        metric.name,
        metric.displayName,
        metric.fullyQualifiedName,
        metric.description,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(searchValue))
    : true;
  const matchesStatus = filters.statusFilter
    ? metric.entityStatus === filters.statusFilter
    : true;

  return matchesSearch && matchesStatus;
};

/**
 * Pages through the metric listing and builds the bulk edit grid for the
 * requested scope — either the explicitly selected metrics or everything that
 * matches the list page's filters. Registered on the metric entry of
 * EntityBulkEditConfigClassBase.
 */
export const fetchMetricBulkEditGrid = async ({
  scope,
  headers,
  multipleOwner,
  isBulkEdit,
  signal,
  onProgress,
}: BulkEditListingGridArgs): Promise<BulkEditListingGrid> => {
  const selectedIds =
    scope.mode === 'selected' ? new Set(scope.ids) : new Set<string>();
  const selectedNames =
    scope.mode === 'selected' ? new Set(scope.names) : new Set<string>();
  const foundIds = new Set<string>();
  const foundNames = new Set<string>();
  let loadedCount = 0;
  let matchedCount = 0;

  const hasFoundSelectedMetrics = () =>
    scope.mode === 'selected' &&
    (selectedIds.size
      ? [...selectedIds].every((id) => foundIds.has(id))
      : [...selectedNames].every((name) => foundNames.has(name)));

  const { data: matchedMetrics } = await fetchAllPages(
    async (after) => {
      const { data, paging } = await getMetrics(
        {
          after,
          fields: '*',
          limit: LISTING_PAGE_SIZE,
          include: Include.All,
        },
        { signal }
      );

      const pageMatches = data.filter((metric) =>
        scope.mode === 'selected'
          ? selectedIds.has(metric.id) || selectedNames.has(metric.name)
          : matchesListingFilters(metric, scope.filters)
      );

      pageMatches.forEach((metric) => {
        if (selectedIds.has(metric.id)) {
          foundIds.add(metric.id);
        }

        if (selectedNames.has(metric.name)) {
          foundNames.add(metric.name);
        }
      });

      loadedCount += data.length;
      matchedCount += pageMatches.length;
      onProgress?.(loadedCount, matchedCount);

      return { data: pageMatches, paging };
    },
    { signal, shouldStop: hasFoundSelectedMetrics }
  );

  const { columns, dataSource } = getMetricColumnsAndDataSourceFromMetrics(
    matchedMetrics,
    headers,
    multipleOwner,
    true,
    isBulkEdit
  );

  return {
    columns,
    dataSource,
    loadedCount,
    matchedCount: matchedMetrics.length,
  };
};
