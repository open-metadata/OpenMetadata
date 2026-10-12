/*
 *  Copyright 2024 Collate.
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
import { DataInsightChart } from '../../generated/api/dataInsight/kpi/createKpiRequest';
import { Kpi, KpiTargetType } from '../../generated/dataInsight/kpi/kpi';
import { UIKpiResult } from '../../interface/data-insight.interface';
import i18n from '../i18next/LocalUtil';

export type KpiChartRow = { day: number } & Record<string, number | null>;

/**
 * Latest result per KPI, keyed by KPI FQN, from a list fetched with the `kpiResult` field. A KPI
 * without a result (no data yet) is left out, so the legend lists only KPIs that can show a value.
 */
export const getKpiLatestResults = (
  kpiList: Kpi[]
): Record<string, UIKpiResult> =>
  kpiList.reduce<Record<string, UIKpiResult>>((latestResults, kpi) => {
    const kpiFqn = kpi.fullyQualifiedName;

    if (kpi.kpiResult && kpiFqn) {
      latestResults[kpiFqn] = {
        ...kpi.kpiResult,
        target: kpi.targetValue,
        metricType: kpi.metricType,
        startDate: kpi.startDate,
        endDate: kpi.endDate,
        displayName: kpi.displayName ?? kpiFqn,
      };
    }

    return latestResults;
  }, {});

export enum KPIChartType {
  Description = 'description',
  Owner = 'owner',
}

export const KPIMetricTypeOptions = [
  {
    label: i18n.t('label.percentage'),
    value: KpiTargetType.Percentage,
  },
  {
    label: i18n.t('label.number'),
    value: KpiTargetType.Number,
  },
];

export const KPIChartOptions = [
  {
    label: i18n.t('label.description-kpi'),
    value: KPIChartType.Description,
  },
  {
    label: i18n.t('label.owner-kpi'),
    value: KPIChartType.Owner,
  },
];

export const filterChartOptions = (list: Kpi[]) => {
  const addedCharts = list.map(
    (kpi) => kpi.dataInsightChart.fullyQualifiedName
  );

  return KPIChartOptions.filter((option) => {
    return addedCharts.every((kpi) => {
      if (kpi?.includes(option.value)) {
        return false;
      }

      return true;
    });
  });
};

export const getDataInsightChartForKPI = (
  chartType: KPIChartType,
  metricType: KpiTargetType
) => {
  if (chartType === KPIChartType.Description) {
    switch (metricType) {
      case KpiTargetType.Percentage:
        return DataInsightChart.PercentageOfDataAssetWithDescriptionKpi;
      case KpiTargetType.Number:
        return DataInsightChart.NumberOfDataAssetWithDescriptionKpi;
    }
  } else {
    switch (metricType) {
      case KpiTargetType.Percentage:
        return DataInsightChart.PercentageOfDataAssetWithOwnerKpi;
      case KpiTargetType.Number:
        return DataInsightChart.NumberOfDataAssetWithOwnerKpi;
    }
  }
};

export const getKPIChartType = (kpiFQN: DataInsightChart) => {
  switch (kpiFQN) {
    case DataInsightChart.PercentageOfDataAssetWithDescriptionKpi:
    case DataInsightChart.NumberOfDataAssetWithDescriptionKpi:
      return KPIChartType.Description;
    case DataInsightChart.PercentageOfDataAssetWithOwnerKpi:
    case DataInsightChart.NumberOfDataAssetWithOwnerKpi:
      return KPIChartType.Owner;
    default:
      return KPIChartType.Description;
  }
};

export const getYAxisTicks = (
  kpiResults: Record<string, { count: number }[]>,
  stepSize = 10
): { domain: [number, number]; ticks: number[] } => {
  const allCounts = Object.values(kpiResults)
    .flat()
    .map((d) => d.count);
  const max = Math.max(...allCounts, 10); // fallback if no data

  const roundedMax = Math.ceil(max / stepSize) * stepSize;

  const ticks: number[] = [];
  for (let i = 0; i <= roundedMax; i += stepSize) {
    ticks.push(i);
  }

  return {
    domain: [0, roundedMax],
    ticks,
  };
};

export const buildKpiChartRows = (
  kpiResults: Record<string, Array<{ day: number; count: number }>>
): KpiChartRow[] => {
  const names = Object.keys(kpiResults);
  const days = [
    ...new Set(
      Object.values(kpiResults).flatMap((data) => data.map((d) => d.day))
    ),
  ].sort((a, b) => a - b);

  return days.map((day) => {
    const row: KpiChartRow = { day };
    names.forEach((name) => {
      row[name] = kpiResults[name].find((d) => d.day === day)?.count ?? null;
    });

    return row;
  });
};
