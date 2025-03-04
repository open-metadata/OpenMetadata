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
import { Card, Skeleton } from 'antd';
import { t } from 'i18next';
import { isEmpty } from 'lodash';
import { ServiceTypes } from 'Models';
import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import ErrorPlaceHolder from '../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { ChartData } from '../components/ServiceInsights/PlatformInsightsWidget/PlatformInsightsWidget.interface';
import { GRAY_1, LIGHT_GRAY } from '../constants/Color.constants';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../enums/common.enum';
import { EntityType } from '../enums/entity.enum';
import { SystemChartType } from '../rest/DataInsightAPI';
import { RoundedCornerBar } from './TierDistributionWidgetUtils';

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

export const getDistributionChart = (
  chartsData: ChartData[],
  isLoading: boolean
) => {
  const noData = (
    <ErrorPlaceHolder
      className="h-full"
      placeholderText={t('message.no-service-insights-data')}
      size={SIZE.MEDIUM}
      type={ERROR_PLACEHOLDER_TYPE.NO_DATA}
    />
  );

  return (
    <Card className="widget-info-card distribution-widget">
      <Skeleton active loading={isLoading} paragraph={{ rows: 10 }}>
        {isEmpty(chartsData) ? (
          noData
        ) : (
          <ResponsiveContainer className="p-t-md" height={350} width="100%">
            <BarChart
              data={chartsData}
              margin={{ top: 0, right: 0, left: -24, bottom: 12 }}>
              <CartesianGrid stroke={LIGHT_GRAY} vertical={false} />
              <XAxis
                axisLine={{
                  stroke: LIGHT_GRAY,
                }}
                dataKey="term"
                tickLine={false}
              />
              <YAxis
                axisLine={false}
                stroke={GRAY_1}
                tickLine={{
                  stroke: LIGHT_GRAY,
                }}
              />
              <Bar
                activeBar={<RoundedCornerBar />}
                background={{ fill: LIGHT_GRAY }}
                barSize={20}
                dataKey="count"
                fill="#3538CD"
                shape={<RoundedCornerBar />}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Skeleton>
    </Card>
  );
};
