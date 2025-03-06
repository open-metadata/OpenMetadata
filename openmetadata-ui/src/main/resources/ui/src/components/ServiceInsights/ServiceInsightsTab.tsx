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

import { Col, Row } from 'antd';
import { AxiosError } from 'axios';
import { isUndefined, last, round } from 'lodash';
import { ServiceTypes } from 'Models';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  PLATFORM_INSIGHTS_CHART,
  SERVICE_INSIGHTS_CHART,
} from '../../constants/ServiceInsightsTab.constants';
import { SystemChartType } from '../../enums/DataInsight.enum';
import { getMultiChartsPreviewByName } from '../../rest/DataInsightAPI';
import {
  getCurrentMillis,
  getEpochMillisForPastDays,
} from '../../utils/date-time/DateTimeUtils';
import serviceUtilClassBase from '../../utils/ServiceUtilClassBase';
import { showErrorToast } from '../../utils/ToastUtils';
import {
  ChartData,
  ChartSeriesData,
} from './PlatformInsightsWidget/PlatformInsightsWidget.interface';
import './service-insights-tab.less';
import { ServiceInsightsTabProps } from './ServiceInsightsTab.interface';

const ServiceInsightsTab = ({ serviceDetails }: ServiceInsightsTabProps) => {
  const { serviceCategory } = useParams<{
    serviceCategory: ServiceTypes;
    tab: string;
  }>();
  const [chartsResults, setChartsResults] = useState<{
    platformInsightsChart: ChartSeriesData[];
    piiDistributionChart: ChartData[];
    tierDistributionChart: ChartData[];
  }>();
  const [isLoading, setIsLoading] = useState(false);

  const serviceName = serviceDetails.name;

  const fetchChartsData = async () => {
    try {
      setIsLoading(true);
      const currentTimestampInMs = getCurrentMillis();
      const sevenDaysAgoTimestampInMs = getEpochMillisForPastDays(7);

      const chartsData = await getMultiChartsPreviewByName(
        SERVICE_INSIGHTS_CHART,
        {
          start: sevenDaysAgoTimestampInMs,
          end: currentTimestampInMs,
          filter: `{"query":{"match":{"service.name.keyword":"${serviceName}"}}}`,
        }
      );

      const platformInsightsChart = PLATFORM_INSIGHTS_CHART.map((chartType) => {
        const summaryChartData = chartsData[chartType];

        const data = summaryChartData.results;

        const firstDayValue = data.length > 1 ? data[0]?.count : 0;
        const lastDayValue = data[data.length - 1]?.count;

        const percentageChange =
          ((lastDayValue - firstDayValue) /
            (firstDayValue === 0 ? lastDayValue : firstDayValue)) *
          100;

        const isIncreased = lastDayValue >= firstDayValue;

        return {
          chartType,
          data,
          isIncreased,
          percentageChange: isNaN(percentageChange)
            ? 0
            : round(Math.abs(percentageChange), 2),
          currentCount: round(last(summaryChartData.results)?.count ?? 0, 2),
        };
      });

      const piiDistributionChart =
        chartsData[SystemChartType.PIIDistribution].results;
      const tierDistributionChart =
        chartsData[SystemChartType.TierDistribution].results;

      setChartsResults({
        platformInsightsChart,
        piiDistributionChart,
        tierDistributionChart,
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChartsData();
  }, []);

  const widgets = serviceUtilClassBase.getInsightsTabWidgets(serviceCategory);

  const arrayOfWidgets = [
    { Widget: widgets.PlatformInsightsWidget, name: 'PlatformInsightsWidget' },
    { Widget: widgets.CollateAIWidget, name: 'CollateAIWidget' },
    { Widget: widgets.PIIDistributionWidget, name: 'PIIDistributionWidget' },
    { Widget: widgets.TierDistributionWidget, name: 'TierDistributionWidget' },
    { Widget: widgets.MostUsedAssetsWidget, name: 'MostUsedAssetsWidget' },
    {
      Widget: widgets.MostExpensiveQueriesWidget,
      name: 'MostExpensiveQueriesWidget',
    },
    { Widget: widgets.DataQualityWidget, name: 'DataQualityWidget' },
  ];

  const getChartsDataFromWidgetName = (widgetName: string) => {
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

  return (
    <Row className="service-insights-tab" gutter={[16, 16]}>
      {arrayOfWidgets.map(
        ({ Widget, name }) =>
          !isUndefined(Widget) && (
            <Col
              key={name}
              span={
                ['PIIDistributionWidget', 'TierDistributionWidget'].includes(
                  name
                )
                  ? 12
                  : 24
              }>
              <Widget
                chartsData={getChartsDataFromWidgetName(name)}
                isLoading={isLoading}
                serviceName={serviceName}
              />
            </Col>
          )
      )}
    </Row>
  );
};

export default ServiceInsightsTab;
