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
import i18n from '../i18next/LocalUtil';

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
