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
import { SystemChartType } from '../enums/DataInsight.enum';
import {
  DataInsightCustomChartResult,
  getMultiChartsPreviewByName,
} from '../rest/DataInsightAPI';

const DAY_MS = 24 * 60 * 60 * 1000;

export const DATA_ESTATE_WINDOW_DAYS = 7;
/** Windows the card's range filter offers. */
export const DATA_ESTATE_WINDOW_OPTIONS = [DATA_ESTATE_WINDOW_DAYS, 30, 90];
export const DATA_ESTATE_QUERY_KEY = ['landingPage', 'widgets', 'dataEstate'];
const DATA_ESTATE_TTL_MS = 5 * 60 * 1000;

export interface ConnectorCount {
  name: string;
  count: number;
}

export interface DataEstate {
  totalAssets: number;
  /** Change in total assets across the window; null when there is no baseline. */
  totalDelta: number | null;
  connectors: ConnectorCount[];
  descriptionCoverage: number | null;
  /** Percentage-point change in coverage across the window. */
  descriptionCoverageDelta: number | null;
  /** Coverage per day, oldest first — the footprint of the trend line. */
  descriptionCoverageSeries: number[];
  isLoading: boolean;
  isError: boolean;
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

const connectorsForDay = (
  results: ChartResults,
  day: number
): ConnectorCount[] => {
  const byConnector = new Map<string, number>();
  results
    .filter((row) => row.day === day && row.group)
    .forEach((row) =>
      byConnector.set(row.group, (byConnector.get(row.group) ?? 0) + row.count)
    );

  return Array.from(byConnector, ([name, count]) => ({ count, name })).sort(
    (a, b) => b.count - a.count
  );
};

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

const fetchDataEstate = async (windowDays: number) => {
  const end = Date.now();

  return getMultiChartsPreviewByName(
    [
      SystemChartType.TotalDataAssets,
      SystemChartType.PercentageOfDataAssetWithDescription,
    ],
    { end, start: end - windowDays * DAY_MS }
  );
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
  const { data, isPending, isError } = useQuery({
    enabled: options?.enabled ?? true,
    queryFn: () => fetchDataEstate(windowDays),
    // The window is part of the key: two ranges are two different answers, and
    // sharing one entry would serve the previous range's data on a switch.
    queryKey: [...DATA_ESTATE_QUERY_KEY, windowDays],
    staleTime: DATA_ESTATE_TTL_MS,
  });

  // Memoised on the query result, not derived per render: `connectors` and the
  // coverage series end up as a chart option, and `replaceMerge` rebuilds the
  // series whenever that option's identity changes — which replays the bar's
  // entry animation. Deriving fresh arrays per render made any unrelated
  // re-render of the landing page — a sibling widget resolving its own query —
  // animate the bar a second time.
  return useMemo(() => {
    const totals = data?.[SystemChartType.TotalDataAssets]?.results ?? [];
    const coverage =
      data?.[SystemChartType.PercentageOfDataAssetWithDescription]?.results ??
      [];

    const newestDay = latestDay(totals);
    const oldestDay = totals.reduce(
      (oldest, row) => Math.min(oldest, row.day),
      newestDay
    );

    const totalAssets = sumForDay(totals, newestDay);
    const baseline = sumForDay(totals, oldestDay);
    const series = coverageSeries(coverage, totals);

    return {
      connectors: connectorsForDay(totals, newestDay),
      descriptionCoverage: series.length > 0 ? series[series.length - 1] : null,
      descriptionCoverageDelta:
        series.length > 1 ? series[series.length - 1] - series[0] : null,
      descriptionCoverageSeries: series,
      isError,
      isLoading: isPending,
      // A single-day window has no baseline to compare against, so report no
      // movement rather than the whole estate's worth of it.
      totalDelta: oldestDay === newestDay ? null : totalAssets - baseline,
      totalAssets,
    };
  }, [data, isPending, isError]);
};
