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

import { useQueries, useQuery } from '@tanstack/react-query';
import { Kpi } from '../generated/dataInsight/kpi/kpi';
import { getListKpiResult, getListKPIs } from '../rest/KpiAPI';

const DAY_MS = 24 * 60 * 60 * 1000;

export const KPI_WINDOW_DAYS = 30;
export const KPI_QUERY_KEY = ['landingPage', 'widgets', 'kpis'];
const TTL_MS = 5 * 60 * 1000;

export type KpiStatus = 'onTrack' | 'atRisk' | 'missed';

export interface KpiProgress {
  id: string;
  name: string;
  fullyQualifiedName: string;
  /** Latest observed value, in the KPI's own units. */
  current: number;
  target: number;
  endDate: number;
  /** Change across the window; null when there is no earlier point. */
  delta: number | null;
  daysLeft: number;
  /**
   * Where the current rate lands by `endDate`. Null when there is nothing to
   * extrapolate from — one data point is a value, not a trend.
   */
  projected: number | null;
  status: KpiStatus;
  /** Value per day, oldest first — the sparkline's footprint. */
  series: number[];
  /** The window the series covers, for the sparkline's axis labels. */
  windowStart: number;
  windowEnd: number;
}

export interface KpiOverview {
  kpis: KpiProgress[];
  atRiskCount: number;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Linear extrapolation of the observed rate to the KPI's end date.
 *
 * This is deliberately client-side arithmetic over data the KPI endpoints
 * already return — no projection field exists on the API, and none is needed.
 */
export const projectValue = (
  series: number[],
  windowDays: number,
  daysLeft: number
): number | null => {
  if (series.length < 2 || windowDays <= 0) {
    return null;
  }
  const first = series[0];
  const last = series[series.length - 1];
  const perDay = (last - first) / windowDays;

  return last + perDay * daysLeft;
};

export const resolveStatus = (
  projected: number | null,
  target: number,
  daysLeft: number
): KpiStatus => {
  // The window has closed: the KPI either made its target or it did not.
  if (daysLeft <= 0) {
    return projected !== null && projected >= target ? 'onTrack' : 'missed';
  }

  // No trend yet, so there is nothing to call at risk.
  if (projected === null) {
    return 'onTrack';
  }

  return projected >= target ? 'onTrack' : 'atRisk';
};

const seriesFor = (
  results: Array<{ count: number; day: number }>
): number[] => {
  const byDay = new Map<number, number>();
  results.forEach((row) => byDay.set(row.day, row.count));

  return Array.from(byDay.entries())
    .sort(([a], [b]) => a - b)
    .map(([, value]) => value);
};

/** KPIs with their progress, pace and projection against their own targets. */
export const useKpiProgress = (): KpiOverview => {
  const listQuery = useQuery({
    queryFn: () => getListKPIs({ fields: 'dataInsightChart' }),
    queryKey: [...KPI_QUERY_KEY, 'list'],
    staleTime: TTL_MS,
  });

  const kpis: Kpi[] = listQuery.data?.data ?? [];
  const end = Date.now();
  const start = end - KPI_WINDOW_DAYS * DAY_MS;

  const resultQueries = useQueries({
    queries: kpis.map((kpi) => ({
      queryFn: () =>
        getListKpiResult(kpi.fullyQualifiedName ?? '', {
          endTs: end,
          startTs: start,
        }),
      queryKey: [...KPI_QUERY_KEY, 'result', kpi.fullyQualifiedName],
      staleTime: TTL_MS,
    })),
  });

  const progress: KpiProgress[] = kpis.map((kpi, index) => {
    const series = seriesFor(resultQueries[index]?.data?.results ?? []);
    const current = series.length > 0 ? series[series.length - 1] : 0;
    const daysLeft = Math.max(0, Math.ceil((kpi.endDate - end) / DAY_MS));
    const projected = projectValue(series, KPI_WINDOW_DAYS, daysLeft);

    return {
      current,
      daysLeft,
      delta: series.length > 1 ? current - series[0] : null,
      endDate: kpi.endDate,
      fullyQualifiedName: kpi.fullyQualifiedName ?? '',
      // `Kpi.id` is optional on the generated type; the FQN identifies a KPI
      // just as well and is already what its result query is keyed on.
      id: kpi.id ?? kpi.fullyQualifiedName ?? kpi.name,
      name: kpi.displayName ?? kpi.name,
      projected,
      series,
      status: resolveStatus(projected, kpi.targetValue, daysLeft),
      target: kpi.targetValue,
      windowEnd: end,
      windowStart: start,
    };
  });

  return {
    atRiskCount: progress.filter((kpi) => kpi.status !== 'onTrack').length,
    isError: listQuery.isError || resultQueries.some((q) => q.isError),
    isLoading:
      listQuery.isPending || resultQueries.some((query) => query.isPending),
    kpis: progress,
  };
};
