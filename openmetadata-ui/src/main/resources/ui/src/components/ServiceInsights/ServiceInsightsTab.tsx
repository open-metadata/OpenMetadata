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
import { useFqn } from '../../hooks/useFqn';
import {
  getMultiChartsPreviewByName,
  SystemChartType,
} from '../../rest/DataInsightAPI';
import Fqn from '../../utils/Fqn';
import serviceUtilClassBase from '../../utils/ServiceUtilClassBase';
import { showErrorToast } from '../../utils/ToastUtils';
import {
  ChartData,
  ChartSeriesData,
} from './PlatformInsightsWidget/PlatformInsightsWidget.interface';
import './service-insights-tab.less';
import { ServiceInsightsTabProps } from './ServiceInsightsTab.interface';

const ServiceInsightsTab: React.FC<ServiceInsightsTabProps> = () => {
  const { fqn: serviceName } = useFqn();
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

  const nameWithoutQuotes = Fqn.getNameWithoutQuotes(serviceName);

  const fetchChartsData = async () => {
    try {
      setIsLoading(true);
      const currentTimestampInMs = Date.now();
      const sevenDaysAgoTimestampInMs =
        currentTimestampInMs - 7 * 24 * 60 * 60 * 1000;

      const chartsData = await getMultiChartsPreviewByName(
        SERVICE_INSIGHTS_CHART,
        {
          start: sevenDaysAgoTimestampInMs,
          end: currentTimestampInMs,
          filter: `{"query":{"bool":{"must":[{"term":{"service.name.keyword":"${nameWithoutQuotes}"}}]}}}`,
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

  const {
    PlatformInsightsWidget,
    PIIDistributionWidget,
    TierDistributionWidget,
    MostUsedAssetsWidget,
    MostExpensiveQueriesWidget,
    DataQualityWidget,
    CollateAIWidget,
  } = serviceUtilClassBase.getInsightsTabWidgets(serviceCategory);

  return (
    <Row className="service-insights-tab" gutter={[16, 16]}>
      <Col span={24}>
        <PlatformInsightsWidget
          chartsData={chartsResults?.platformInsightsChart ?? []}
          isLoading={isLoading}
        />
      </Col>
      {!isUndefined(CollateAIWidget) && (
        <Col span={24}>
          <CollateAIWidget />
        </Col>
      )}
      {!isUndefined(PIIDistributionWidget) && (
        <Col span={12}>
          <PIIDistributionWidget
            chartsData={chartsResults?.piiDistributionChart ?? []}
            isLoading={isLoading}
          />
        </Col>
      )}
      {!isUndefined(TierDistributionWidget) && (
        <Col span={12}>
          <TierDistributionWidget
            chartsData={chartsResults?.tierDistributionChart ?? []}
            isLoading={isLoading}
          />
        </Col>
      )}
      {!isUndefined(MostUsedAssetsWidget) && (
        <Col span={24}>
          <MostUsedAssetsWidget />
        </Col>
      )}
      {!isUndefined(MostExpensiveQueriesWidget) && (
        <Col span={24}>
          <MostExpensiveQueriesWidget />
        </Col>
      )}
      {!isUndefined(DataQualityWidget) && (
        <Col span={24}>
          <DataQualityWidget />
        </Col>
      )}
    </Row>
  );
};

export default ServiceInsightsTab;
