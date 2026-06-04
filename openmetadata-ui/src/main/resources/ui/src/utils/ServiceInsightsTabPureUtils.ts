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

import { first, isEmpty, isNil, last, round, sortBy, toLower } from 'lodash';
import type { ServiceTypes } from 'Models';
import type { ChartsResults } from '../components/ServiceInsights/ServiceInsightsTab.interface';
import { SERVICE_AUTOPILOT_AGENT_TYPES } from '../constants/Services.constant';
import { SystemChartType } from '../enums/DataInsight.enum';
import { EntityType } from '../enums/entity.enum';
import {
  ProviderType,
  type IngestionPipeline,
} from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
import type { DataInsightCustomChartResult } from '../rest/DataInsightAPI';
import Fqn from './Fqn';
import { t } from './i18next/LocalUtil';

export const getAssetsByServiceType = (serviceType: ServiceTypes): string[] => {
  switch (serviceType) {
    case 'databaseServices':
      return [
        EntityType.DATABASE,
        EntityType.DATABASE_SCHEMA,
        EntityType.STORED_PROCEDURE,
        EntityType.TABLE,
        EntityType.TABLE_COLUMN,
        EntityType.QUERY,
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
    case 'driveServices':
      return [
        EntityType.DIRECTORY,
        EntityType.FILE,
        EntityType.SPREADSHEET,
        EntityType.WORKSHEET,
      ];
    default:
      return [];
  }
};

export const getTitleByChartType = (chartType: SystemChartType) => {
  switch (chartType) {
    case SystemChartType.DescriptionCoverage:
    case SystemChartType.AssetsWithDescriptionLive:
      return t('label.entity-coverage', {
        entity: t('label.description'),
      });
    case SystemChartType.OwnersCoverage:
    case SystemChartType.AssetsWithOwnerLive:
      return t('label.entity-coverage', {
        entity: t('label.ownership'),
      });
    case SystemChartType.PIICoverage:
    case SystemChartType.AssetsWithPIILive:
      return t('label.entity-coverage', {
        entity: t('label.pii-uppercase'),
      });
    case SystemChartType.TierCoverage:
    case SystemChartType.AssetsWithTierLive:
      return t('label.entity-coverage', {
        entity: t('label.tier'),
      });
    case SystemChartType.HealthyDataAssets:
      return t('label.healthy-data-asset-plural');
    default:
      return '';
  }
};

export const getChartTypeForWidget = (chartType: SystemChartType) => {
  switch (chartType) {
    case SystemChartType.AssetsWithDescriptionLive:
      return SystemChartType.DescriptionCoverage;
    case SystemChartType.AssetsWithOwnerLive:
      return SystemChartType.OwnersCoverage;
    case SystemChartType.AssetsWithPIILive:
      return SystemChartType.PIICoverage;
    case SystemChartType.AssetsWithTierLive:
      return SystemChartType.TierCoverage;
    default:
      return chartType;
  }
};

export const getPlatformInsightsChartDataFormattingMethod =
  (chartsData: Record<SystemChartType, DataInsightCustomChartResult>) =>
  (chartType: SystemChartType) => {
    if (
      isNil(chartsData) ||
      isNil(chartsData[chartType]) ||
      isEmpty(chartsData[chartType].results)
    ) {
      return {
        isIncreased: false,
        percentageChange: 0,
        currentPercentage: 0,
        noRecords: true,
        numberOfDays: 0,
      };
    }

    const summaryChartData = chartsData[chartType];
    const lastDay = last(summaryChartData?.results)?.day ?? 1;

    const sortedResults = sortBy(summaryChartData?.results, 'day');

    let data = sortedResults.length >= 2 ? sortedResults : [];

    if (summaryChartData?.results.length === 1) {
      const previousDay = sortedResults[0].day - 86400000; // 1 day in milliseconds

      data = [
        {
          day: previousDay,
          count: 0,
          group: sortedResults[0].group,
          term: sortedResults[0].term,
        },
        {
          day: lastDay,
          count: sortedResults[0].count,
          group: sortedResults[0].group,
          term: sortedResults[0].term,
        },
      ];
    }

    // Data for the earliest day
    const earliestDayData = first(data)?.count ?? 0;
    // Data for the last day
    const lastDayData = last(data)?.count ?? 0;

    // Percentage change for the last 7 days
    const percentageChangeOverall = round(
      Math.abs(lastDayData - earliestDayData),
      1
    );

    // This is true if the current data is greater than or equal to the earliest day data
    const isIncreased = (lastDayData ?? 0) >= (earliestDayData ?? 0);

    return {
      chartType: getChartTypeForWidget(chartType),
      isIncreased,
      percentageChange: percentageChangeOverall,
      currentPercentage: round(lastDayData ?? 0, 1),
      noRecords: summaryChartData?.results.every((item) => isEmpty(item)),
      numberOfDays: data.length > 0 ? data.length - 1 : 0,
    };
  };

export const filterDistributionChartItem = (item: {
  term: string;
  group: string;
}) => {
  // Add input validation to prevent DOS vulnerabilities | typescript:S5852
  if (
    !item.term ||
    !item.group ||
    item.term.length > 1000 ||
    item.group.length > 1000
  ) {
    return false;
  }

  // Split once and cache the result
  const termParts = Fqn.split(item.term);
  if (termParts.length !== 2) {
    // Invalid Tag FQN
    return false;
  }

  // clean start and end quotes
  const tag_name = termParts[1].replaceAll(/(^["']+|["']+$)/g, '');

  return toLower(tag_name) === toLower(item.group);
};

export const getChartsDataFromWidgetName = (
  widgetName: string,
  chartsResults?: ChartsResults
) => {
  switch (widgetName) {
    case 'PlatformInsightsWidget':
      return chartsResults?.platformInsightsChart ?? [];
    case 'PIIDistributionWidget':
      return chartsResults?.piiDistributionChart ?? [];
    case 'TierDistributionWidget':
      return chartsResults?.tierDistributionChart ?? [];
    default:
      return [];
  }
};

export const getAutoPilotIngestionPipelines = (
  ingestionPipelines?: IngestionPipeline[]
) => {
  if (isEmpty(ingestionPipelines)) {
    return undefined;
  }

  return ingestionPipelines?.filter(
    (pipeline) =>
      SERVICE_AUTOPILOT_AGENT_TYPES.includes(pipeline.pipelineType) &&
      pipeline.provider === ProviderType.Automation
  );
};
