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
import {
  DataInsightCustomChartResult,
  getMultiChartsPreviewByName,
} from '../rest/DataInsightAPI';
import { postAggregateFieldOptions } from '../rest/miscAPI';
import { getFormattedDataAssetServiceType } from '../utils/DataAssetServiceUtils';
import { getAggregations } from '../utils/ExplorePureUtils';

const DAY_MS = 24 * 60 * 60 * 1000;

export const DATA_ESTATE_WINDOW_DAYS = 7;
/** Windows the card's range filter offers. */
export const DATA_ESTATE_WINDOW_OPTIONS = [DATA_ESTATE_WINDOW_DAYS, 30, 90];
export const DATA_ESTATE_QUERY_KEY = ['landingPage', 'widgets', 'dataEstate'];
export const DATA_ESTATE_CONNECTORS_QUERY_KEY = [
  'landingPage',
  'widgets',
  'dataEstateConnectors',
];
const DATA_ESTATE_TTL_MS = 5 * 60 * 1000;

const SERVICE_TYPE_FIELD = 'serviceType';

/**
 * Connectors the bar names individually. The rest fold into one "Other"
 * segment: past this many the slivers are unreadable, but their assets still
 * belong in the bar, or it would no longer add up to the estate.
 */
export const MAX_NAMED_CONNECTORS = 6;
/** Key of the folded remainder — the breakdown labels it in the reader's locale. */
export const OTHER_CONNECTORS_KEY = '__other__';

export interface ConnectorCount {
  /** The raw `serviceType`, e.g. `BigQuery` — stable across locales. */
  key: string;
  /** What the legend shows, e.g. `Big Query`. */
  name: string;
  count: number;
}

export interface DataEstate {
  /**
   * The newest Data Insights total, or — when Data Insights has no rows for the
   * window — the live sum of the per-connector counts.
   */
  totalAssets: number;
  /** Change in total assets across the window; null when there is no baseline. */
  totalDelta: number | null;
  /**
   * The window the figures on screen were measured over. Trails the selected
   * window while a switch is in flight, so a label never pairs the new range
   * with the previous range's delta.
   */
  windowDays: number;
  /** The largest connectors, then one `OTHER_CONNECTORS_KEY` entry for the rest. */
  connectors: ConnectorCount[];
  /** Every connector holding assets, not just the ones the bar names. */
  connectorCount: number;
  descriptionCoverage: number | null;
  /** Percentage-point change in coverage across the window. */
  descriptionCoverageDelta: number | null;
  /** Coverage per day, oldest first — the footprint of the trend line. */
  descriptionCoverageSeries: number[];
  /** First load only — a window switch keeps the previous figures on screen. */
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  refetch: () => void;
}

type ChartResults = DataInsightCustomChartResult['results'];

/**
 * The charts report one row per (day, group). Collapse to the newest day and
 * sum its groups: that day is the current estate, whatever slice it arrived in.
 */
const latestDay = (results: ChartResults): number =>
  results.reduce((newest, row) => Math.max(newest, row.day), 0);

const sumForDay = (results: ChartResults, day: number): number =>
  results
    .filter((row) => row.day === day)
    .reduce((total, row) => total + row.count, 0);

interface CoverageAccumulator {
  /** Σ (group percentage × group asset count). */
  weighted: number;
  /** Σ group asset count. */
  weight: number;
  /** Σ group percentage, for the unweighted fallback. */
  total: number;
  groups: number;
}

/**
 * Coverage for each day, oldest first.
 *
 * The chart reports one row per entity type, each already a percentage — so
 * `table: 100, database: 0, databaseSchema: 0` means "tables are fully
 * described", not "200%". Summing those rows is what put 240% on the card.
 *
 * Averaging them is the fix, weighted by how many assets each type holds:
 * `total_data_assets` groups by the same dimension with the same labels, so a
 * type with three assets cannot count for as much as one with eight hundred.
 * When no weight is available — an ungrouped series, or a group the totals
 * chart does not carry — it falls back to the plain mean, which for a single
 * ungrouped row per day is just that row's value.
 */
const coverageSeries = (
  coverage: ChartResults,
  totals: ChartResults
): number[] => {
  const assetsPerGroup = new Map<string, number>();
  totals.forEach((row) =>
    assetsPerGroup.set(
      `${row.day}:${row.group}`,
      (assetsPerGroup.get(`${row.day}:${row.group}`) ?? 0) + row.count
    )
  );

  const byDay = new Map<number, CoverageAccumulator>();
  coverage.forEach((row) => {
    const day = byDay.get(row.day) ?? {
      groups: 0,
      total: 0,
      weight: 0,
      weighted: 0,
    };
    const assets = assetsPerGroup.get(`${row.day}:${row.group}`) ?? 0;

    byDay.set(row.day, {
      groups: day.groups + 1,
      total: day.total + row.count,
      weight: day.weight + assets,
      weighted: day.weighted + row.count * assets,
    });
  });

  return Array.from(byDay.entries())
    .sort(([a], [b]) => a - b)
    .map(([, day]) => {
      if (day.weight > 0) {
        return day.weighted / day.weight;
      }

      return day.groups > 0 ? day.total / day.groups : 0;
    });
};

/**
 * The estate's split by connector — Snowflake, Redshift, BigQuery — from a
 * `serviceType` terms aggregation over the data-asset index.
 *
 * Deliberately NOT the `total_data_assets` chart: that groups by *entity type*
 * (table, chart, databaseSchema), which is what the card was showing under a
 * "by connector" heading. Nothing in the data-insight charts carries the
 * service dimension, so this is a second request rather than a different read
 * of the first.
 *
 * The aggregate endpoint rather than the search query's built-in aggregation:
 * that one carries the engine's default of ten buckets, so an estate with an
 * eleventh connector under-reported both the split and "across N connectors".
 */
const fetchConnectorBreakdown = async (): Promise<ConnectorCount[]> => {
  const response = await postAggregateFieldOptions({
    deleted: false,
    fieldName: SERVICE_TYPE_FIELD,
    index: SearchIndex.DATA_ASSET,
    size: AGGREGATE_PAGE_SIZE_LARGE,
  });
  const buckets: Bucket[] =
    getAggregations(response.data.aggregations ?? {})[SERVICE_TYPE_FIELD]
      ?.buckets ?? [];

  return buckets
    .map((bucket) => ({
      count: bucket.doc_count,
      key: bucket.key,
      name: getFormattedDataAssetServiceType(bucket.key),
    }))
    .sort((a, b) => b.count - a.count);
};

/** Names the largest connectors and folds the tail into one "Other" entry. */
const foldConnectors = (connectors: ConnectorCount[]): ConnectorCount[] => {
  if (connectors.length <= MAX_NAMED_CONNECTORS) {
    return connectors;
  }
  const named = connectors.slice(0, MAX_NAMED_CONNECTORS - 1);
  const rest = connectors.slice(MAX_NAMED_CONNECTORS - 1);

  return [
    ...named,
    {
      count: rest.reduce((total, connector) => total + connector.count, 0),
      key: OTHER_CONNECTORS_KEY,
      name: '',
    },
  ];
};

const fetchDataEstate = async (windowDays: number) => {
  const end = Date.now();
  const charts = await getMultiChartsPreviewByName(
    [
      SystemChartType.TotalDataAssets,
      SystemChartType.PercentageOfDataAssetWithDescription,
    ],
    { end, start: end - windowDays * DAY_MS }
  );

  return { charts, windowDays };
};

/** The card's figures from the two answers in hand — pure, so the hook can memoise it. */
const deriveEstate = (
  charts: Awaited<ReturnType<typeof getMultiChartsPreviewByName>> | undefined,
  allConnectors: ConnectorCount[]
) => {
  const totals = charts?.[SystemChartType.TotalDataAssets]?.results ?? [];
  const coverage =
    charts?.[SystemChartType.PercentageOfDataAssetWithDescription]?.results ??
    [];

  const newestDay = latestDay(totals);
  const oldestDay = totals.reduce(
    (oldest, row) => Math.min(oldest, row.day),
    newestDay
  );
  const liveTotal = allConnectors.reduce(
    (total, connector) => total + connector.count,
    0
  );
  // Data Insights only has rows once its pipeline has run. Without them the
  // header would print 0 above a populated breakdown, so it falls back to the
  // live connector sum — which leaves out assets with no service (glossary
  // terms and the like), so it is a floor rather than the same figure.
  const hasInsights = totals.length > 0;
  const totalAssets = hasInsights ? sumForDay(totals, newestDay) : liveTotal;
  const series = coverageSeries(coverage, totals);
  // A single-day window has no baseline to compare against, so report no
  // movement rather than the whole estate's worth of it.
  const hasBaseline = hasInsights && oldestDay !== newestDay;

  return {
    connectorCount: allConnectors.length,
    connectors: foldConnectors(allConnectors),
    descriptionCoverage: series.length > 0 ? series[series.length - 1] : null,
    descriptionCoverageDelta:
      series.length > 1 ? series[series.length - 1] - series[0] : null,
    descriptionCoverageSeries: series,
    totalAssets,
    totalDelta: hasBaseline ? totalAssets - sumForDay(totals, oldestDay) : null,
  };
};

/**
 * Totals, per-connector split and description coverage for the "Your data
 * estate" card, from the two system charts that already carry them.
 */
export const useDataEstate = (options?: {
  enabled?: boolean;
  /** Window the totals delta and the coverage trend are measured over. */
  windowDays?: number;
}): DataEstate => {
  const windowDays = options?.windowDays ?? DATA_ESTATE_WINDOW_DAYS;
  const enabled = options?.enabled ?? true;
  const { data, isPending, isFetching, isError, refetch } = useQuery({
    enabled,
    // Keeps the previous window's figures on screen while the next one loads,
    // so a range switch dims the card instead of swapping it for a skeleton —
    // which unmounted the range filter mid-interaction and dropped its focus.
    placeholderData: keepPreviousData,
    queryFn: () => fetchDataEstate(windowDays),
    // The window is part of the key: two ranges are two different answers, and
    // sharing one entry would serve the previous range's data on a switch.
    queryKey: [...DATA_ESTATE_QUERY_KEY, windowDays],
    staleTime: DATA_ESTATE_TTL_MS,
  });

  // A live count, so no window in the key — the range filter moves the totals
  // delta and the coverage trend, both of which are time series. "How much of
  // the estate is Snowflake" is not.
  const {
    data: connectors,
    isPending: isConnectorsPending,
    isError: isConnectorsError,
    refetch: refetchConnectors,
  } = useQuery({
    enabled,
    queryFn: fetchConnectorBreakdown,
    queryKey: DATA_ESTATE_CONNECTORS_QUERY_KEY,
    staleTime: DATA_ESTATE_TTL_MS,
  });

  // Memoised on the query result, not derived per render: `connectors` and the
  // coverage series end up as a chart option, and `replaceMerge` rebuilds the
  // series whenever that option's identity changes — which replays the bar's
  // entry animation. Deriving fresh arrays per render made any unrelated
  // re-render of the landing page — a sibling widget resolving its own query —
  // animate the bar a second time.
  return useMemo(
    () => ({
      ...deriveEstate(data?.charts, connectors ?? []),
      isError: isError || isConnectorsError,
      isFetching,
      isLoading: isPending || isConnectorsPending,
      refetch: () => {
        void refetch();
        void refetchConnectors();
      },
      windowDays: data?.windowDays ?? windowDays,
    }),
    [
      windowDays,
      data,
      isPending,
      isFetching,
      isError,
      refetch,
      connectors,
      isConnectorsPending,
      isConnectorsError,
      refetchConnectors,
    ]
  );
};
