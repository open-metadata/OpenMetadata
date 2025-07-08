/*
 *  Copyright 2022 Collate.
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

import { Col, Row, Typography } from 'antd';
import { AxiosError } from 'axios';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { WEB_CHARTS } from '../../constants/DataInsight.constants';
import { SystemChartType } from '../../enums/DataInsight.enum';
import { DataReportIndex } from '../../generated/dataInsight/dataInsightChart';
import {
  DataInsightChartResult,
  DataInsightChartType,
} from '../../generated/dataInsight/dataInsightChartResult';
import { MostActiveUsers } from '../../generated/dataInsight/type/mostActiveUsers';
import { Team } from '../../generated/entity/teams/team';
import {
  ChartFilter,
  DataInsightTabs,
} from '../../interface/data-insight.interface';
import { useDataInsightProvider } from '../../pages/DataInsightPage/DataInsightProvider';
import {
  getAggregateChartData,
  getMultiChartsPreviewByName,
} from '../../rest/DataInsightAPI';
import { getTeamByName } from '../../rest/teamsAPI';
import {
  getEntitiesChartSummary,
  getQueryFilterForDataInsightChart,
  getWebChartSummary,
} from '../../utils/DataInsightUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import UserPopOverCard from '../common/PopOverCard/UserPopOverCard';
import { SummaryCard } from '../common/SummaryCard/SummaryCard.component';
import './data-insight-detail.less';

interface Props {
  chartFilter: ChartFilter;
  onScrollToChart: (chartType: SystemChartType | DataInsightChartType) => void;
}

const DataInsightSummary: FC<Props> = ({ chartFilter, onScrollToChart }) => {
  const { tab = DataInsightTabs.DATA_ASSETS } =
    useParams<{ tab: DataInsightTabs }>();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [webCharts, setWebCharts] = useState<
    (DataInsightChartResult | undefined)[]
  >([]);
  const { entitiesSummary, updateEntitySummary } = useDataInsightProvider();

  const [mostActiveUser, setMostActiveUser] = useState<MostActiveUsers>();

  const [OrganizationDetails, setOrganizationDetails] = useState<Team>();

  const entitiesSummaryList = useMemo(
    () => getEntitiesChartSummary(entitiesSummary),
    [entitiesSummary, chartFilter]
  );

  const webSummaryList = useMemo(
    () => getWebChartSummary(webCharts),
    [webCharts, chartFilter]
  );

  const { t } = useTranslation();

  const fetchOrganizationDetails = async () => {
    try {
      const data = await getTeamByName('Organization');
      setOrganizationDetails(data);
    } catch (err) {
      // for this API do not show the toast message
    }
  };

  const fetchEntitiesChartData = async () => {
    setIsLoading(true);
    try {
      const filter = getQueryFilterForDataInsightChart(
        chartFilter.team,
        chartFilter.tier
      );
      const chartsData = await getMultiChartsPreviewByName(
        [
          SystemChartType.TotalDataAssetsSummaryCard,
          SystemChartType.DataAssetsWithDescriptionSummaryCard,
          SystemChartType.DataAssetsWithOwnerSummaryCard,
          SystemChartType.TotalDataAssetsWithTierSummaryCard,
        ],
        {
          start: chartFilter.startTs,
          end: chartFilter.endTs,
          filter,
        }
      );

      updateEntitySummary(chartsData);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMostActiveUser = async () => {
    try {
      const params = {
        ...chartFilter,
        dataInsightChartName: DataInsightChartType.MostActiveUsers,
        dataReportIndex: DataReportIndex.WebAnalyticUserActivityReportDataIndex,
      };
      const response = await getAggregateChartData(params);
      if (response.data?.length) {
        setMostActiveUser(response.data[0]);
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWebChartData = async () => {
    setIsLoading(true);
    try {
      const promises = WEB_CHARTS.map((chart) => {
        const params = {
          ...chartFilter,
          dataInsightChartName: chart.chart,
          dataReportIndex: chart.index,
        };

        return getAggregateChartData(params);
      });

      const responses = await Promise.allSettled(promises);

      const chartDataList = responses
        .map((response) => {
          if (response.status === 'fulfilled') {
            return response.value;
          }

          return;
        })
        .filter(Boolean);

      setWebCharts(chartDataList);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizationDetails();
  }, []);

  useEffect(() => {
    tab === DataInsightTabs.DATA_ASSETS && fetchEntitiesChartData();
    tab === DataInsightTabs.APP_ANALYTICS && fetchMostActiveUser();
    tab === DataInsightTabs.APP_ANALYTICS && fetchWebChartData();
  }, [chartFilter, tab]);

  return (
    <div data-testid="summary-card">
      <Typography.Paragraph className="font-medium">
        {t('label.data-insight-summary', {
          organization:
            getEntityName(OrganizationDetails) ?? t('label.open-metadata'),
        })}
      </Typography.Paragraph>
      <Row data-testid="summary-card-content" gutter={[16, 16]}>
        {tab === DataInsightTabs.DATA_ASSETS && (
          <>
            {/* summary of entity charts */}
            {entitiesSummaryList.map((summary) => (
              <Col
                data-testid="data-assets-summary"
                key={summary.id}
                span={6}
                onClick={() => onScrollToChart(summary.id)}>
                <SummaryCard
                  className="summary-card-item"
                  isLoading={isLoading}
                  showProgressBar={false}
                  title={summary.label}
                  total={0}
                  value={`${summary.latest}
                    ${
                      summary.id === SystemChartType.TotalDataAssets ? '' : '%'
                    }`}
                />
              </Col>
            ))}
          </>
        )}
        {tab === DataInsightTabs.APP_ANALYTICS && (
          <>
            {/* summary for web charts */}
            {webSummaryList.map((summary) => (
              <Col
                data-testid="app-analytics-summary"
                key={summary.id}
                span={6}
                onClick={() => onScrollToChart(summary.id)}>
                <SummaryCard
                  className="summary-card-item h-full"
                  isLoading={isLoading}
                  showProgressBar={false}
                  title={summary.label}
                  total={0}
                  value={`${summary.latest}
                  ${summary.id.startsWith('Percentage') ? '%' : ''}`}
                />
              </Col>
            ))}

            {/* summary of most active user */}
            {mostActiveUser?.userName && (
              <Col
                className="data-insight-active-user"
                data-testid={`summary-item-${DataInsightChartType.MostActiveUsers}`}
                key={DataInsightChartType.MostActiveUsers}
                span={6}>
                <SummaryCard
                  isLoading={isLoading}
                  showProgressBar={false}
                  title={t('label.most-active-user')}
                  total={0}
                  value={
                    <UserPopOverCard
                      showUserName
                      profileWidth={36}
                      userName={mostActiveUser.userName}
                    />
                  }
                />
              </Col>
            )}
          </>
        )}
      </Row>
    </div>
  );
};

export default DataInsightSummary;
