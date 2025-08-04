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
import { isEmpty, isUndefined } from 'lodash';
import { ServiceTypes } from 'Models';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SOCKET_EVENTS } from '../../constants/constants';
import {
  LIVE_CHARTS_LIST,
  PLATFORM_INSIGHTS_CHARTS,
  PLATFORM_INSIGHTS_LIVE_CHARTS,
} from '../../constants/ServiceInsightsTab.constants';
import { totalDataAssetsWidgetColors } from '../../constants/TotalDataAssetsWidget.constants';
import { useWebSocketConnector } from '../../context/WebSocketProvider/WebSocketProvider';
import { SystemChartType } from '../../enums/DataInsight.enum';
import { SearchIndex } from '../../enums/search.enum';
import { AppRunRecord } from '../../generated/entity/applications/appRunRecord';
import { WorkflowStatus } from '../../generated/governance/workflows/workflowInstance';
import { getAgentRuns } from '../../rest/applicationAPI';
import {
  getMultiChartsPreviewByName,
  setChartDataStreamConnection,
  stopChartDataStreamConnection,
} from '../../rest/DataInsightAPI';
import { searchQuery } from '../../rest/searchAPI';
import {
  getFormattedAgentsList,
  getFormattedAgentsListFromAgentsLiveInfo,
} from '../../utils/AgentsStatusWidgetUtils';
import {
  getCurrentDayStartGMTinMillis,
  getCurrentMillis,
  getDayAgoStartGMTinMillis,
} from '../../utils/date-time/DateTimeUtils';
import { getEntityNameLabel } from '../../utils/EntityUtils';
import {
  filterDistributionChartItem,
  getAssetsByServiceType,
  getChartsDataFromWidgetName,
  getFormattedTotalAssetsDataFromSocketData,
  getPlatformInsightsChartDataFormattingMethod,
} from '../../utils/ServiceInsightsTabUtils';
import serviceUtilClassBase from '../../utils/ServiceUtilClassBase';
import { getServiceNameQueryFilter } from '../../utils/ServiceUtils';
import { getEntityIcon } from '../../utils/TableUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import { AgentsInfo } from './AgentsStatusWidget/AgentsStatusWidget.interface';
import './service-insights-tab.less';
import {
  ChartsResults,
  ServiceInsightsTabProps,
  TotalAssetsCount,
} from './ServiceInsightsTab.interface';

const ServiceInsightsTab = ({
  serviceDetails,
  workflowStatesData,
  collateAIagentsList,
  ingestionPipelines,
  isIngestionPipelineLoading,
  isCollateAIagentsLoading,
}: ServiceInsightsTabProps) => {
  const { serviceCategory } =
    useRequiredParams<{ serviceCategory: ServiceTypes }>();
  const { socket } = useWebSocketConnector();
  const [chartsResults, setChartsResults] = useState<ChartsResults>();
  const [agentsInfo, setAgentsInfo] = useState<AgentsInfo[]>([]);
  const [collateAgentStatusLoading, setCollateAgentStatusLoading] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [totalAssetsCount, setTotalAssetsCount] =
    useState<Array<TotalAssetsCount>>();
  const sessionIdRef = useRef<string>();

  const serviceName = serviceDetails.name;

  const widgets = serviceUtilClassBase.getInsightsTabWidgets(serviceCategory);

  const getDataAssetsCount = useCallback(async () => {
    try {
      const response = await searchQuery({
        queryFilter: getServiceNameQueryFilter(serviceName),
        searchIndex: SearchIndex.ALL,
      });

      const assets = getAssetsByServiceType(serviceCategory);

      const buckets = response.aggregations['entityType'].buckets.filter(
        (bucket) => assets.includes(bucket.key)
      );

      const entityCountsArray = buckets.map((bucket, index) => ({
        name: getEntityNameLabel(bucket.key),
        value: bucket.doc_count ?? 0,
        fill: totalDataAssetsWidgetColors[index],
        icon: getEntityIcon(bucket.key, '', { height: 16, width: 16 }) ?? <></>,
      }));

      setTotalAssetsCount(entityCountsArray);
    } catch {
      // Error
    }
  }, []);

  const fetchChartsData = async () => {
    try {
      setIsLoading(true);
      const currentTimestampInMs = getCurrentDayStartGMTinMillis();
      const sevenDaysAgoTimestampInMs = getDayAgoStartGMTinMillis(6);

      const chartsList = [
        ...PLATFORM_INSIGHTS_CHARTS,
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

      await getDataAssetsCount();

      const platformInsightsChart = PLATFORM_INSIGHTS_CHARTS.map(
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

  const arrayOfWidgets = [
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

  const { PlatformInsightsWidget, TotalDataAssetsWidget, AgentsStatusWidget } =
    widgets;

  const triggerSocketConnection = useCallback(async () => {
    if (isUndefined(sessionIdRef.current)) {
      const { sessionId } = await setChartDataStreamConnection({
        chartNames: LIVE_CHARTS_LIST,
        serviceName,
        startTime: getCurrentDayStartGMTinMillis(),
        endTime: getCurrentDayStartGMTinMillis() + 360000000,
      });

      sessionIdRef.current = sessionId;
    }
  }, [serviceName, sessionIdRef.current]);

  const getAgentStatuses = async () => {
    try {
      setCollateAgentStatusLoading((prev) => prev + 1);
      let recentRunStatuses: Record<string, AppRunRecord[]> = {};

      if (!isEmpty(collateAIagentsList)) {
        const endTs = getCurrentMillis();
        const startTs = workflowStatesData?.mainInstanceState?.startedAt
          ? workflowStatesData.mainInstanceState.startedAt
          : getDayAgoStartGMTinMillis(6);
        const recentRunStatusesPromise = collateAIagentsList.map((app) =>
          getAgentRuns(app.name, {
            service: serviceDetails.id,
            startTs,
            endTs,
          })
        );

        const statusData = await Promise.allSettled(recentRunStatusesPromise);

        recentRunStatuses = statusData.reduce((acc, cv, index) => {
          const app = collateAIagentsList[index];

          return {
            ...acc,
            [app.name]: cv.status === 'fulfilled' ? cv.value.data : [],
          };
        }, {});
      }

      setAgentsInfo(
        getFormattedAgentsList(
          recentRunStatuses,
          ingestionPipelines,
          collateAIagentsList
        )
      );
    } finally {
      setCollateAgentStatusLoading((prev) => prev - 1);
    }
  };

  const onSocketDataUpdate = useCallback((newActivity: string) => {
    if (newActivity) {
      const data = JSON.parse(newActivity);

      const platformInsightsChart = PLATFORM_INSIGHTS_LIVE_CHARTS.map(
        getPlatformInsightsChartDataFormattingMethod(data.data)
      );

      setAgentsInfo(
        getFormattedAgentsListFromAgentsLiveInfo(
          data.ingestionPipelineStatus,
          data.appStatus
        )
      );

      setTotalAssetsCount(
        getFormattedTotalAssetsDataFromSocketData(
          data?.data?.total_data_assets_live
        )
      );

      setChartsResults((prev) => ({
        platformInsightsChart,
        piiDistributionChart: prev?.piiDistributionChart ?? [],
        tierDistributionChart: prev?.tierDistributionChart ?? [],
      }));
    }
  }, []);

  useEffect(() => {
    fetchChartsData();
  }, []);

  useEffect(() => {
    // Start the socket connection if the workflow is running
    if (
      workflowStatesData?.mainInstanceState.status === WorkflowStatus.Running
    ) {
      triggerSocketConnection();
    }

    return () => {
      // Stop the socket connection if it is started and set the sessionId to undefined
      if (sessionIdRef.current) {
        stopChartDataStreamConnection(sessionIdRef.current);
        sessionIdRef.current = undefined;
      }
    };
  }, [workflowStatesData?.mainInstanceState.status]);

  useEffect(() => {
    getAgentStatuses();
  }, [ingestionPipelines, collateAIagentsList]);

  useEffect(() => {
    if (socket) {
      try {
        socket.on(SOCKET_EVENTS.CHART_DATA_STREAM, onSocketDataUpdate);
      } catch {
        // Error handling
      }
    }

    return () => {
      socket?.off(SOCKET_EVENTS.CHART_DATA_STREAM);
    };
  }, [socket]);

  return (
    <Row className="service-insights-tab" gutter={[16, 16]}>
      <Col span={18}>
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <AgentsStatusWidget
              agentsInfo={agentsInfo}
              isLoading={
                collateAgentStatusLoading > 0 ||
                isCollateAIagentsLoading ||
                isIngestionPipelineLoading
              }
              workflowStatesData={workflowStatesData}
            />
          </Col>
          <Col span={24}>
            <PlatformInsightsWidget
              chartsData={getChartsDataFromWidgetName(
                'PlatformInsightsWidget',
                chartsResults
              )}
              isLoading={isLoading}
            />
          </Col>
        </Row>
      </Col>
      <Col span={6}>
        <TotalDataAssetsWidget
          isLoading={isLoading}
          totalAssetsCount={totalAssetsCount}
        />
      </Col>

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
                chartsData={getChartsDataFromWidgetName(name, chartsResults)}
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
