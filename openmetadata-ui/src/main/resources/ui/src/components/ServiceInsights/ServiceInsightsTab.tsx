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

import { CloseOutlined } from '@ant-design/icons';
import { Alert, Col, Row } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import { ServiceTypes } from 'Models';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PLATFORM_INSIGHTS_CHART } from '../../constants/ServiceInsightsTab.constants';
import { SystemChartType } from '../../enums/DataInsight.enum';
import { WorkflowStatus } from '../../generated/governance/workflows/workflowInstance';
import { getMultiChartsPreviewByName } from '../../rest/DataInsightAPI';
import {
  getCurrentDayStartGMTinMillis,
  getDayAgoStartGMTinMillis,
} from '../../utils/date-time/DateTimeUtils';
import { updateAutoPilotStatus } from '../../utils/LocalStorageUtils';
import {
  checkIfAutoPilotStatusIsDismissed,
  filterDistributionChartItem,
  getPlatformInsightsChartDataFormattingMethod,
  getStatusIconFromStatusType,
} from '../../utils/ServiceInsightsTabUtils';
import serviceUtilClassBase from '../../utils/ServiceUtilClassBase';
import { showErrorToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import {
  ChartData,
  ChartSeriesData,
} from './PlatformInsightsWidget/PlatformInsightsWidget.interface';
import './service-insights-tab.less';
import { ServiceInsightsTabProps } from './ServiceInsightsTab.interface';

const ServiceInsightsTab = ({
  serviceDetails,
  workflowStatesData,
  isWorkflowStatusLoading,
}: ServiceInsightsTabProps) => {
  const { serviceCategory } =
    useRequiredParams<{ serviceCategory: ServiceTypes }>();
  const [chartsResults, setChartsResults] = useState<{
    platformInsightsChart: ChartSeriesData[];
    piiDistributionChart: ChartData[];
    tierDistributionChart: ChartData[];
  }>();
  const [isLoading, setIsLoading] = useState(false);

  const serviceName = serviceDetails.name;

  const widgets = serviceUtilClassBase.getInsightsTabWidgets(serviceCategory);

  const fetchChartsData = async () => {
    try {
      setIsLoading(true);
      const currentTimestampInMs = getCurrentDayStartGMTinMillis();
      const sevenDaysAgoTimestampInMs = getDayAgoStartGMTinMillis(6);

      const chartsList = [
        ...PLATFORM_INSIGHTS_CHART,
        ...(widgets.PIIDistributionWidget
          ? [SystemChartType.PIIDistribution]
          : []),
        ...(widgets.TierDistributionWidget
          ? [SystemChartType.TierDistribution]
          : []),
      ];

      const chartsData = await getMultiChartsPreviewByName(chartsList, {
        start: sevenDaysAgoTimestampInMs,
        end: currentTimestampInMs,
        filter: `{"query":{"match":{"service.name.keyword":"${serviceName}"}}}`,
      });

      const platformInsightsChart = PLATFORM_INSIGHTS_CHART.map(
        getPlatformInsightsChartDataFormattingMethod(chartsData)
      );

      const piiDistributionChart = chartsData[
        SystemChartType.PIIDistribution
      ]?.results.filter(filterDistributionChartItem);
      const tierDistributionChart = chartsData[
        SystemChartType.TierDistribution
      ]?.results.filter(filterDistributionChartItem);

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

  const {
    Icon: StatusIcon,
    message,
    description,
  } = getStatusIconFromStatusType(
    workflowStatesData?.mainInstanceState?.status
  );

  const showAutoPilotStatus = useMemo(() => {
    const isDataPresent =
      !isWorkflowStatusLoading && !isUndefined(workflowStatesData);
    const isStatusDismissed = checkIfAutoPilotStatusIsDismissed(
      serviceDetails.fullyQualifiedName,
      workflowStatesData?.mainInstanceState?.status
    );

    return isDataPresent && !isStatusDismissed;
  }, [
    isWorkflowStatusLoading,
    workflowStatesData,
    serviceDetails.fullyQualifiedName,
    workflowStatesData?.mainInstanceState?.status,
  ]);

  const onStatusBannerClose = useCallback(() => {
    if (
      serviceDetails.fullyQualifiedName &&
      workflowStatesData?.mainInstanceState?.status
    ) {
      updateAutoPilotStatus({
        serviceFQN: serviceDetails.fullyQualifiedName,
        status: workflowStatesData?.mainInstanceState?.status,
      });
    }
  }, [
    serviceDetails.fullyQualifiedName,
    workflowStatesData?.mainInstanceState?.status,
  ]);

  return (
    <Row className="service-insights-tab" gutter={[16, 16]}>
      {showAutoPilotStatus && (
        <Alert
          closable
          showIcon
          className={classNames(
            'status-banner',
            workflowStatesData?.mainInstanceState?.status ??
              WorkflowStatus.Running
          )}
          closeIcon={
            <CloseOutlined
              className="text-md"
              data-testid="status-banner-close-icon"
            />
          }
          data-testid="auto-pilot-status-banner"
          description={description}
          icon={
            <div
              className="status-banner-icon"
              data-testid={`status-banner-icon-${workflowStatesData?.mainInstanceState?.status}`}>
              <StatusIcon height={20} width={20} />
            </div>
          }
          message={message}
          onClose={onStatusBannerClose}
        />
      )}
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
                workflowStatesData={workflowStatesData}
              />
            </Col>
          )
      )}
    </Row>
  );
};

export default ServiceInsightsTab;
