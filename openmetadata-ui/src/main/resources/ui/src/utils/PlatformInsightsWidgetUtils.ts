/*
 *  Copyright 2025 Collate.
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
import { t } from 'i18next';
import { isEqual, sortBy } from 'lodash';
import { ServiceTypes } from 'Models';
import { ChartData } from '../components/ServiceInsights/PlatformInsightsWidget/PlatformInsightsWidget.interface';
import { EntityType } from '../enums/entity.enum';
import {
  DataInsightCustomChartResult,
  SystemChartType,
} from '../rest/DataInsightAPI';

export const getAssetsByServiceType = (serviceType: ServiceTypes): string[] => {
  switch (serviceType) {
    case 'databaseServices':
      return [
        EntityType.DATABASE,
        EntityType.DATABASE_SCHEMA,
        EntityType.STORED_PROCEDURE,
        EntityType.TABLE,
      ];
    case 'messagingServices':
      return [EntityType.TOPIC];
    case 'dashboardServices':
      return [
        EntityType.CHART,
        EntityType.DASHBOARD,
        EntityType.DASHBOARD_DATA_MODEL,
      ];
    case 'pipelineServices':
      return [EntityType.PIPELINE];
    case 'mlmodelServices':
      return [EntityType.MLMODEL];
    case 'storageServices':
      return [EntityType.CONTAINER];
    case 'searchServices':
      return [EntityType.SEARCH_SERVICE];
    case 'apiServices':
      return [EntityType.API_COLLECTION, EntityType.API_ENDPOINT];
    default:
      return [];
  }
};

export const getTierChartAggregateData = (
  chartsData: DataInsightCustomChartResult
): ChartData[] => {
  const data = chartsData.results.filter((chart) => chart.group !== 'NoTier');

  const sortedData = sortBy(data, 'day');

  const uniqueDays = [...new Set(sortedData.map((chart) => chart.day))];

  const combinedAssetsData = uniqueDays.map((day) => {
    const dayData = sortedData.filter((chart) => chart.day === day);
    const value = dayData.reduce((acc, chart) => acc + chart.count, 0);

    return {
      day,
      value,
    };
  });

  return combinedAssetsData;
};

export const aggregateChartsDataByType = (
  chartsData: DataInsightCustomChartResult,
  serviceType: ServiceTypes,
  chartType: SystemChartType
): ChartData[] => {
  const assets = getAssetsByServiceType(serviceType);

  const data = chartsData.results.filter((chart) =>
    isEqual(chartType, SystemChartType.TotalDataAssetsByTier)
      ? chart.group !== 'NoTier'
      : assets.includes(chart.group)
  );

  const sortedData = sortBy(data, 'day');

  const uniqueDays = [...new Set(sortedData.map((chart) => chart.day))];

  const combinedAssetsData = uniqueDays.map((day) => {
    const dayData = sortedData.filter((chart) => chart.day === day);
    const value = dayData.reduce((acc, chart) => acc + chart.count, 0);

    return {
      day,
      value,
    };
  });

  return combinedAssetsData;
};

export const getTitleByChartType = (chartType: SystemChartType) => {
  switch (chartType) {
    case SystemChartType.PercentageOfDataAssetWithDescription:
      return t('label.entity-coverage', {
        entity: t('label.description'),
      });
    case SystemChartType.PercentageOfDataAssetWithOwner:
      return t('label.entity-coverage', {
        entity: t('label.ownership'),
      });
    case SystemChartType.PercentageOfServiceWithDescription: // TODO: Replace this with PII chart
      return t('label.entity-coverage', {
        entity: t('label.pii-uppercase'),
      });
    case SystemChartType.TotalDataAssetsByTier:
      return t('label.entity-coverage', {
        entity: t('label.tier'),
      });
    default:
      return '';
  }
};

export const getSummaryChartName = (chartType: SystemChartType) => {
  switch (chartType) {
    case SystemChartType.PercentageOfDataAssetWithDescription:
      return SystemChartType.NumberOfDataAssetWithDescription;
    case SystemChartType.PercentageOfDataAssetWithOwner:
      return SystemChartType.NumberOfDataAssetWithOwner;
    case SystemChartType.TotalDataAssetsByTier:
      return SystemChartType.TotalDataAssetsWithTierSummaryCard;
    case SystemChartType.PercentageOfServiceWithDescription: // TODO: Replace this with PII chart
    default:
      return SystemChartType.TotalDataAssetsWithTierSummaryCard;
  }
};
