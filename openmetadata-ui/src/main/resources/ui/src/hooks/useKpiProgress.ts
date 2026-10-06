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
import { Kpi } from '../generated/dataInsight/kpi/kpi';
import { getListKpiResult, getListKPIs } from '../rest/KpiAPI';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Default window, and the option the card opens on. */
export const KPI_WINDOW_DAYS = 30;
/** Every result the KPI has recorded, i.e. from its own start date. */
export const KPI_ALL_TIME = 'all';
export type KpiWindow = number | typeof KPI_ALL_TIME;
/** Windows the card's range filter offers. */
export const KPI_WINDOW_OPTIONS: KpiWindow[] = [
  KPI_WINDOW_DAYS,
  90,
  KPI_ALL_TIME,
];
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
  daysLeft: number,
  current: number
): KpiStatus => {
  // The window has closed, so judge the KPI on what it actually reached. The
  // projection is null whenever the series holds a single point, and reading
  // that as a miss reported a finished KPI that had already beaten its target
  // as missed -- and counted it in `atRiskCount`.
  if (daysLeft <= 0) {
    return current >= target ? 'onTrack' : 'missed';
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

interface KpiResultWindow {
  /** End of the window actually fetched, not of the current clock. */
  end: number;
  /**
   * `start` is per entry, not shared: on "All time" each KPI is read from its
   * own start date, so one global bound could not describe the set.
   */
  entries: Array<{ kpi: Kpi; series: number[]; start: number }>;
}

/**
 * The KPIs and their results over one window.
 *
 * The window is anchored here, inside the fetch, rather than read from the
 * clock on every render: that keeps every value the hook derives — `daysLeft`,
 * the axis labels, the series — a pure function of the query result, which is
 * what lets the memo below hold its identity.
 *
 * `kpiResult` is a per-KPI endpoint with no bulk form, so one request per KPI
 * is the only shape available; `Promise.all` at least keeps them concurrent.
 */
const fetchKpiProgress = async (range: KpiWindow): Promise<KpiResultWindow> => {
  const end = Date.now();
  const { data: kpis } = await getListKPIs({ fields: 'dataInsightChart' });
  const startOf = (kpi: Kpi) =>
    range === KPI_ALL_TIME ? kpi.startDate : end - range * DAY_MS;

  const results = await Promise.all(
    kpis.map((kpi) =>
      // eslint-disable-next-line openmetadata-imports/no-api-calls-in-iteration -- no bulk kpiResult endpoint
      getListKpiResult(kpi.fullyQualifiedName ?? '', {
        endTs: end,
        startTs: startOf(kpi),
      })
    )
  );

  return {
    end,
    entries: kpis.map((kpi, index) => ({
      kpi,
      series: seriesFor(results[index]?.results ?? []),
      start: startOf(kpi),
    })),
  };
};

/** KPIs with their progress, pace and projection against their own targets. */
export const useKpiProgress = (
  range: KpiWindow = KPI_WINDOW_DAYS
): KpiOverview => {
  const { data, isPending, isError } = useQuery({
    queryFn: () => fetchKpiProgress(range),
    // The window is part of the identity: without it a switch to 90 days would
    // be served the cached 30-day series and silently project off the wrong rate.
    queryKey: [...KPI_QUERY_KEY, range],
    staleTime: TTL_MS,
  });

  // Memoised on the query result, not derived per render: `series` ends up as a
  // chart option, and `replaceMerge` rebuilds the series whenever that option's
  // identity changes — which replays the sparkline's entry animation. Deriving
  // fresh arrays per render made any unrelated re-render of the landing page —
  // a sibling widget resolving its own query — draw the trend a second time.
  return useMemo(() => {
    const end = data?.end ?? 0;
    const progress: KpiProgress[] = (data?.entries ?? []).map(
      ({ kpi, series, start }) => {
        // Measured off the bounds actually fetched rather than the argument:
        // while a window switch is in flight the series in hand is still the
        // previous window's, and projecting it over the newly selected span
        // would report a rate nobody measured.
        const spanDays = Math.max(1, Math.round((end - start) / DAY_MS));
        const current = series.length > 0 ? series[series.length - 1] : 0;
        const daysLeft = Math.max(0, Math.ceil((kpi.endDate - end) / DAY_MS));
        const projected = projectValue(series, spanDays, daysLeft);

        return {
          current,
          daysLeft,
          delta: series.length > 1 ? current - series[0] : null,
          endDate: kpi.endDate,
          fullyQualifiedName: kpi.fullyQualifiedName ?? '',
          // `Kpi.id` is optional on the generated type; the FQN identifies a KPI
          // just as well and is what its results are fetched by.
          id: kpi.id ?? kpi.fullyQualifiedName ?? kpi.name,
          name: kpi.displayName ?? kpi.name,
          projected,
          series,
          status: resolveStatus(projected, kpi.targetValue, daysLeft, current),
          target: kpi.targetValue,
          windowEnd: end,
          windowStart: start,
        };
      }
    );

    return {
      atRiskCount: progress.filter((kpi) => kpi.status !== 'onTrack').length,
      isError,
      isLoading: isPending,
      kpis: progress,
    };
  }, [data, isPending, isError]);
};
