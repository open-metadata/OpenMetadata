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
import { isUndefined, round } from 'lodash';
import { ServiceTypes } from 'Models';
import { SystemChartType } from '../enums/DataInsight.enum';
import { EntityType } from '../enums/entity.enum';
import { DataInsightCustomChartResult } from '../rest/DataInsightAPI';
import i18n from '../utils/i18next/LocalUtil';
import { getSevenDaysStartGMTArrayInMillis } from './date-time/DateTimeUtils';

const { t } = i18n;

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

export const getTitleByChartType = (chartType: SystemChartType) => {
  switch (chartType) {
    case SystemChartType.DescriptionCoverage:
      return t('label.entity-coverage', {
        entity: t('label.description'),
      });
    case SystemChartType.OwnersCoverage:
      return t('label.entity-coverage', {
        entity: t('label.ownership'),
      });
    case SystemChartType.PIICoverage:
      return t('label.entity-coverage', {
        entity: t('label.pii-uppercase'),
      });
    case SystemChartType.TierCoverage:
      return t('label.entity-coverage', {
        entity: t('label.tier'),
      });
    default:
      return '';
  }
};

export const getPlatformInsightsChartDataFormattingMethod =
  (
    chartsData: Record<SystemChartType, DataInsightCustomChartResult>,
    startTime: number,
    endTime: number
  ) =>
  (chartType: SystemChartType) => {
    const summaryChartData = chartsData[chartType];

    // Get the seven days start GMT array in milliseconds
    const sevenDaysStartGMTArrayInMillis = getSevenDaysStartGMTArrayInMillis();

    // Get the data for the seven days
    // If the data is not available for a day, fill in the data with the count as 0
    const data = sevenDaysStartGMTArrayInMillis.map((day) => {
      const item = summaryChartData.results.find((item) => item.day === day);

      return item ? item : { day, count: 0 };
    });

    // This is the data for the day 7 days ago
    const sevenDaysAgoData = data.find((item) => item.day === startTime)?.count;
    // This is the data for the current day
    const currentData = data.find((item) => item.day === endTime)?.count;

    // This is the percentage change for the last 7 days
    // This is undefined if the data is not available for all the days
    const percentageChangeInSevenDays =
      !isUndefined(currentData) && !isUndefined(sevenDaysAgoData)
        ? round(Math.abs(currentData - sevenDaysAgoData), 2)
        : undefined;

    // This is true if the current data is greater than the earliest day data
    // This is false if the data is not available for more than 1 day
    const isIncreased = !isUndefined(currentData)
      ? currentData >= (sevenDaysAgoData ?? 0)
      : false;

    return {
      chartType,
      data,
      isIncreased,
      percentageChange: percentageChangeInSevenDays,
      currentPercentage: round(currentData ?? 0, 2),
    };
  };
