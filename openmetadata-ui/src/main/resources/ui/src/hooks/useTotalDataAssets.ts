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

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { Bucket } from 'Models';
import { useMemo } from 'react';
import { AGGREGATE_PAGE_SIZE_LARGE } from '../constants/constants';
import { SystemChartType } from '../enums/DataInsight.enum';
import { SearchIndex } from '../enums/search.enum';
import { DataAssetType } from '../generated/dataInsight/custom/dataAssetType';
import { postAggregateFieldOptions } from '../rest/miscAPI';
import { getAggregations } from '../utils/ExplorePureUtils';
import {
  ChartResults,
  dataEstateChartsQuery,
  DATA_ESTATE_TTL_MS,
  latestDay,
  sumForDay,
} from './useDataEstate';

export const TOTAL_DATA_ASSETS_WINDOW_DAYS = 7;
export const LIVE_ASSET_TYPES_QUERY_KEY = [
  'landingPage',
  'widgets',
  'liveAssetTypes',
];
const ENTITY_TYPE_FIELD = 'entityType';

/**
 * The types the `total_data_assets` chart counts: the Data Insights asset
 * types, less the `tag` and `glossaryTerm` groups the chart excludes and the
 * data-quality types Data Insights reads from their live index rather than
 * indexing. The live fallback counts the same population, so the total does
 * not drop the day the chart starts returning rows.
 */
const CHART_ASSET_TYPES: ReadonlySet<string> = new Set(
  Object.values(DataAssetType).filter(
    (type) =>
      ![
        DataAssetType.Tag,
        DataAssetType.GlossaryTerm,
        DataAssetType.TestCaseResult,
        DataAssetType.TestCaseResolutionStatus,
      ].includes(type)
  )
);

/** Windows the card's range filter offers. */
export const TOTAL_DATA_ASSETS_WINDOW_OPTIONS = [
  TOTAL_DATA_ASSETS_WINDOW_DAYS,
  14,
  30,
];

export interface AssetTypeCount {
  /**
   * The chart's raw group, e.g. `databaseSchema`. Stable across locales; the
   * card translates it for display with `getEntityNameLabel`.
   */
  key: string;
  count: number;
  /** Percentage of the total, 0–100. */
  share: number;
  /** Change across the window; null when the window has no baseline day. */
  delta: number | null;
}

export interface TotalDataAssets {
  totalAssets: number;
  /** Change in total assets across the window; null when there is no baseline. */
  totalDelta: number | null;
  /** Largest type first. Types holding nothing on the newest day are left out. */
  assetTypes: AssetTypeCount[];
  /** The type that grew the most across the window, when any grew at all. */
  fastestGrowing?: AssetTypeCount;
  /**
   * The window the figures on screen were measured over. Trails the selected
   * window while a switch is in flight, so a label never pairs the new range
   * with the previous range's delta.
   */
  windowDays: number;
  /** First load only — a window switch keeps the previous figures on screen. */
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  refetch: () => void;
}

const countsByGroup = (results: ChartResults, day: number) =>
  results
    .filter((row) => row.day === day)
    .reduce(
      (counts, row) =>
        counts.set(row.group, (counts.get(row.group) ?? 0) + row.count),
      new Map<string, number>()
    );

/** The card's figures from the totals chart — pure, so the hook can memoise it. */
export const deriveTotalDataAssets = (
  totals: ChartResults
): Pick<
  TotalDataAssets,
  'assetTypes' | 'fastestGrowing' | 'totalAssets' | 'totalDelta'
> => {
  const newestDay = latestDay(totals);
  const oldestDay = totals.reduce(
    (oldest, row) => Math.min(oldest, row.day),
    newestDay
  );
  // A single-day window has no baseline to compare against, so report no
  // movement rather than the whole estate's worth of it.
  const hasBaseline = totals.length > 0 && oldestDay !== newestDay;
  const totalAssets = sumForDay(totals, newestDay);
  const baseline = countsByGroup(totals, oldestDay);

  const assetTypes = Array.from(countsByGroup(totals, newestDay).entries())
    .filter(([, count]) => count > 0)
    .map(([group, count]) => ({
      count,
      delta: hasBaseline ? count - (baseline.get(group) ?? 0) : null,
      key: group,
      share: totalAssets > 0 ? (count / totalAssets) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const fastestGrowing = assetTypes.reduce<AssetTypeCount | undefined>(
    (fastest, type) =>
      (type.delta ?? 0) > (fastest?.delta ?? 0) ? type : fastest,
    undefined
  );

  return {
    assetTypes,
    fastestGrowing,
    totalAssets,
    totalDelta: hasBaseline ? totalAssets - sumForDay(totals, oldestDay) : null,
  };
};

/**
 * The live split by entity type, from a terms aggregation over the data-asset
 * index. Only the fallback: it has no history, so no type carries a change.
 */
const fetchLiveAssetTypes = async (): Promise<ChartResults> => {
  const response = await postAggregateFieldOptions({
    deleted: false,
    fieldName: ENTITY_TYPE_FIELD,
    index: SearchIndex.DATA_ASSET,
    size: AGGREGATE_PAGE_SIZE_LARGE,
  });
  const buckets: Bucket[] =
    getAggregations(response.data.aggregations ?? {})[ENTITY_TYPE_FIELD]
      ?.buckets ?? [];

  // Shaped as one chart day so the same derivation reads both sources.
  return buckets
    .filter((bucket) => CHART_ASSET_TYPES.has(bucket.key))
    .map((bucket) => ({
      count: bucket.doc_count,
      day: 0,
      group: bucket.key,
      term: bucket.key,
    }));
};

/**
 * Total assets and their split by asset type for the "Total data assets"
 * card. The `total_data_assets` system chart already groups by entity type, so
 * this reads the same answer "Your data estate" does rather than asking again.
 *
 * Data Insights only has rows once its pipeline has run. Until then the card
 * would read zero above an estate full of assets, so it falls back to a live
 * count by entity type — the same fallback "Your data estate" makes for its
 * total. That second request is only made when the chart comes back empty.
 */
export const useTotalDataAssets = (options?: {
  windowDays?: number;
}): TotalDataAssets => {
  const windowDays = options?.windowDays ?? TOTAL_DATA_ASSETS_WINDOW_DAYS;
  const { data, isPending, isFetching, isError, refetch } = useQuery({
    // Keeps the previous window's figures on screen while the next one loads,
    // so a range switch dims the card instead of swapping it for a skeleton.
    placeholderData: keepPreviousData,
    ...dataEstateChartsQuery(windowDays),
  });
  const totals = data?.charts?.[SystemChartType.TotalDataAssets]?.results;
  const needsLiveCount = data !== undefined && (totals ?? []).length === 0;

  const {
    data: liveTypes,
    isPending: isLivePending,
    isFetching: isLiveFetching,
    isError: isLiveError,
    refetch: refetchLive,
  } = useQuery({
    enabled: needsLiveCount,
    queryFn: fetchLiveAssetTypes,
    queryKey: LIVE_ASSET_TYPES_QUERY_KEY,
    staleTime: DATA_ESTATE_TTL_MS,
  });

  // The fallback's state only counts while the card is reading from it.
  const live = needsLiveCount
    ? {
        isError: isLiveError,
        isFetching: isLiveFetching,
        isLoading: isLivePending,
      }
    : { isError: false, isFetching: false, isLoading: false };
  const rows = needsLiveCount ? liveTypes : totals;

  // Memoised on the query result: `assetTypes` ends up as a chart option, and
  // a fresh array per render replays the share bar's entry animation.
  return useMemo(
    () => ({
      ...deriveTotalDataAssets(rows ?? []),
      isError: isError || live.isError,
      isFetching: isFetching || live.isFetching,
      isLoading: isPending || live.isLoading,
      refetch: () => {
        void refetch();
        if (needsLiveCount) {
          void refetchLive();
        }
      },
      windowDays: data?.windowDays ?? windowDays,
    }),
    [
      data,
      rows,
      needsLiveCount,
      isPending,
      isFetching,
      isError,
      live.isError,
      live.isFetching,
      live.isLoading,
      refetch,
      refetchLive,
      windowDays,
    ]
  );
};
