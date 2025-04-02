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
import { isUndefined, toLower } from 'lodash';
import { ServiceTypes } from 'Models';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  PLATFORM_INSIGHTS_CHART,
  SERVICE_INSIGHTS_WORKFLOW_DEFINITION_NAME,
} from '../../constants/ServiceInsightsTab.constants';
import { SystemChartType } from '../../enums/DataInsight.enum';
import { WorkflowStatus } from '../../generated/governance/workflows/workflowInstance';
import { getMultiChartsPreviewByName } from '../../rest/DataInsightAPI';
import {
  getWorkflowInstancesForApplication,
  getWorkflowInstanceStateById,
} from '../../rest/workflowAPI';
import {
  getCurrentDayStartGMTinMillis,
  getCurrentMillis,
  getDayAgoStartGMTinMillis,
} from '../../utils/date-time/DateTimeUtils';
import { getEntityFeedLink } from '../../utils/EntityUtils';
import {
  getPlatformInsightsChartDataFormattingMethod,
  getStatusIconFromStatusType,
} from '../../utils/ServiceInsightsTabUtils';
import serviceUtilClassBase from '../../utils/ServiceUtilClassBase';
import { getEntityTypeFromServiceCategory } from '../../utils/ServiceUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import {
  ChartData,
  ChartSeriesData,
} from './PlatformInsightsWidget/PlatformInsightsWidget.interface';
import './service-insights-tab.less';
import {
  ServiceInsightsTabProps,
  WorkflowStatesData,
} from './ServiceInsightsTab.interface';

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
  const [workflowStatesData, setWorkflowStatesData] =
    useState<WorkflowStatesData>();
  const [isWorkflowStatusLoading, setIsWorkflowStatusLoading] = useState(false);

  const serviceName = serviceDetails.name;

  const widgets = serviceUtilClassBase.getInsightsTabWidgets(serviceCategory);

  const fetchWorkflowInstanceStates = async () => {
    try {
      setIsWorkflowStatusLoading(true);
      const startTs = getDayAgoStartGMTinMillis(6);
      const endTs = getCurrentMillis();
      const entityType = getEntityTypeFromServiceCategory(serviceCategory);
      const workflowInstances = await getWorkflowInstancesForApplication({
        startTs,
        endTs,
        workflowDefinitionName: SERVICE_INSIGHTS_WORKFLOW_DEFINITION_NAME,
        entityLink: getEntityFeedLink(
          entityType,
          serviceDetails.fullyQualifiedName
        ),
      });

      const workflowInstanceId = workflowInstances.data[0]?.id;

      if (workflowInstanceId) {
        const workflowInstanceStates = await getWorkflowInstanceStateById(
          SERVICE_INSIGHTS_WORKFLOW_DEFINITION_NAME,
          workflowInstanceId,
          {
            startTs,
            endTs,
          }
        );
        setWorkflowStatesData({
          mainInstanceState: workflowInstances.data[0],
          subInstanceStates: workflowInstanceStates.data,
        });
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsWorkflowStatusLoading(false);
    }
  };

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
      ]?.results.filter((item) => item.term.includes(toLower(item.group)));
      const tierDistributionChart = chartsData[
        SystemChartType.TierDistribution
      ]?.results.filter((item) => item.term.includes(toLower(item.group)));

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
    fetchWorkflowInstanceStates();
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

  return (
    <Row className="service-insights-tab" gutter={[16, 16]}>
      {!isWorkflowStatusLoading && !isUndefined(workflowStatesData) && (
        <Alert
          closable
          showIcon
          className={classNames(
            'status-banner',
            workflowStatesData?.mainInstanceState?.status ??
              WorkflowStatus.Running
          )}
          closeIcon={<CloseOutlined className="text-md" />}
          description={description}
          icon={
            <div className="status-banner-icon">
              <StatusIcon height={20} width={20} />
            </div>
          }
          message={message}
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
