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

import { Card, Col, Row, Typography } from 'antd';
import { AxiosError } from 'axios';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  Legend,
  LegendProps,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getAggregateChartData } from 'rest/DataInsightAPI';
import { GRAPH_BACKGROUND_COLOR } from '../../constants/constants';
import {
  BAR_CHART_MARGIN,
  DATA_INSIGHT_GRAPH_COLORS,
  DI_STRUCTURE,
} from '../../constants/DataInsight.constants';
import { DataReportIndex } from '../../generated/dataInsight/dataInsightChart';
import { DataInsightChartType } from '../../generated/dataInsight/dataInsightChartResult';
import { DailyActiveUsers } from '../../generated/dataInsight/type/dailyActiveUsers';
import { ChartFilter } from '../../interface/data-insight.interface';
import {
  CustomTooltip,
  getFormattedActiveUsersData,
  renderLegend,
} from '../../utils/DataInsightUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import CustomStatistic from './CustomStatistic';
import './DataInsightDetail.less';
import { EmptyGraphPlaceholder } from './EmptyGraphPlaceholder';

interface Props {
  chartFilter: ChartFilter;
  selectedDays: number;
}

const DailyActiveUsersChart: FC<Props> = ({ chartFilter, selectedDays }) => {
  const [dailyActiveUsers, setDailyActiveUsers] = useState<DailyActiveUsers[]>(
    []
  );

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const { t } = useTranslation();

  const { data, total, relativePercentage } = useMemo(
    () => getFormattedActiveUsersData(dailyActiveUsers),
    [dailyActiveUsers]
  );

  const fetchPageViewsByEntities = async () => {
    setIsLoading(true);
    try {
      const params = {
        ...chartFilter,
        dataInsightChartName: DataInsightChartType.DailyActiveUsers,
        dataReportIndex: DataReportIndex.WebAnalyticUserActivityReportDataIndex,
      };
      const response = await getAggregateChartData(params);

      setDailyActiveUsers(response.data ?? []);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPageViewsByEntities();
  }, [chartFilter]);

  return (
    <Card
      className="data-insight-card"
      data-testid="entity-active-user-card"
      id={DataInsightChartType.DailyActiveUsers}
      loading={isLoading}
      title={
        <>
          <Typography.Title level={5}>
            {t('label.daily-active-users-on-the-platform')}
          </Typography.Title>
          <Typography.Text className="data-insight-label-text">
            {t('message.active-users')}
          </Typography.Text>
        </>
      }>
      {dailyActiveUsers.length ? (
        <Row gutter={DI_STRUCTURE.rowContainerGutter}>
          <Col span={DI_STRUCTURE.leftContainerSpan}>
            <ResponsiveContainer debounce={1} minHeight={400}>
              <LineChart data={data} margin={BAR_CHART_MARGIN}>
                <CartesianGrid
                  stroke={GRAPH_BACKGROUND_COLOR}
                  vertical={false}
                />
                <Legend
                  align="left"
                  content={() =>
                    renderLegend({ payload: [] } as LegendProps, [])
                  }
                  layout="vertical"
                  verticalAlign="top"
                  wrapperStyle={{ left: '0px', top: '0px' }}
                />
                <XAxis dataKey="timestamp" />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  dataKey="activeUsers"
                  stroke={DATA_INSIGHT_GRAPH_COLORS[3]}
                  type="monotone"
                />
              </LineChart>
            </ResponsiveContainer>
          </Col>
          <Col span={DI_STRUCTURE.rightContainerSpan}>
            <CustomStatistic
              changeInValue={relativePercentage}
              duration={selectedDays}
              label={t('label.total-entity', {
                entity: t('label.active-user'),
              })}
              value={total}
            />
          </Col>
        </Row>
      ) : (
        <EmptyGraphPlaceholder />
      )}
    </Card>
  );
};

export default DailyActiveUsersChart;
