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
import { SystemChartType } from '../enums/DataInsight.enum';
import {
  DataInsightCustomChartResult,
  getMultiChartsPreviewByName,
} from '../rest/DataInsightAPI';

const DAY_MS = 24 * 60 * 60 * 1000;

export const DATA_ESTATE_WINDOW_DAYS = 7;
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

// Coverage is already a percentage per day, so the series is the per-day value
// rather than a sum — averaging across groups would flatten a real movement.
const coverageSeries = (results: ChartResults): number[] => {
  const byDay = new Map<number, number>();
  results.forEach((row) =>
    byDay.set(row.day, (byDay.get(row.day) ?? 0) + row.count)
  );

  return Array.from(byDay.entries())
    .sort(([a], [b]) => a - b)
    .map(([, value]) => value);
};

const fetchDataEstate = async () => {
  const end = Date.now();

  return getMultiChartsPreviewByName(
    [
      SystemChartType.TotalDataAssets,
      SystemChartType.PercentageOfDataAssetWithDescription,
    ],
    { end, start: end - DATA_ESTATE_WINDOW_DAYS * DAY_MS }
  );
};

/**
 * Totals, per-connector split and description coverage for the "Your data
 * estate" card, from the two system charts that already carry them.
 */
export const useDataEstate = (options?: { enabled?: boolean }): DataEstate => {
  const { data, isPending, isError } = useQuery({
    enabled: options?.enabled ?? true,
    queryFn: fetchDataEstate,
    queryKey: DATA_ESTATE_QUERY_KEY,
    staleTime: DATA_ESTATE_TTL_MS,
  });

  const totals = data?.[SystemChartType.TotalDataAssets]?.results ?? [];
  const coverage =
    data?.[SystemChartType.PercentageOfDataAssetWithDescription]?.results ?? [];

  const newestDay = latestDay(totals);
  const oldestDay = totals.reduce(
    (oldest, row) => Math.min(oldest, row.day),
    newestDay
  );

  const totalAssets = sumForDay(totals, newestDay);
  const baseline = sumForDay(totals, oldestDay);
  const series = coverageSeries(coverage);

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
};
