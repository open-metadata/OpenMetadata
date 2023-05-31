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

import { Col, Progress, Row, Space, Typography } from 'antd';
import { toNumber } from 'lodash';

import {
  KPI_WIDGET_GRAPH_BG_COLORS,
  KPI_WIDGET_GRAPH_COLORS,
} from 'constants/DataInsight.constants';
import React, { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { KpiTargetType } from '../../generated/api/dataInsight/kpi/createKpiRequest';
import { UIKpiResult } from '../../interface/data-insight.interface';
import { getNumberOfDaysForTimestamp } from '../../utils/TimeUtils';
import './kpi-latest-results.less';

interface Props {
  kpiLatestResultsRecord: Record<string, UIKpiResult>;
}

const KPILatestResultsV1: FC<Props> = ({ kpiLatestResultsRecord }) => {
  const { t } = useTranslation();
  const { latestResultsList } = useMemo(() => {
    return { latestResultsList: Object.entries(kpiLatestResultsRecord) };
  }, [kpiLatestResultsRecord]);

  return (
    <Space className="w-full p-t-lg p-r-xs" direction="vertical" size={48}>
      {latestResultsList.map((result, index) => {
        const name = result[0];
        const resultData = result[1];

        const isPercentage = resultData.metricType === KpiTargetType.Percentage;

        const targetResult = resultData.targetResult[0];

        const targetValue = toNumber(targetResult.value);
        const targetMetValue = toNumber(resultData.target);

        const targetPercentValue = isPercentage
          ? (targetValue * 100).toFixed(2)
          : targetValue;
        const targetMetPercentValue = isPercentage
          ? (targetMetValue * 100).toFixed(2)
          : targetMetValue;

        const suffix = isPercentage ? '%' : '';

        const currentProgress = (targetValue / targetMetValue) * 100;

        const daysLeft = getNumberOfDaysForTimestamp(resultData.endDate);

        return (
          <Row key={name}>
            <Col className="d-flex items-center" span={4}>
              <div
                className="kpi-days-section"
                style={{
                  color: KPI_WIDGET_GRAPH_COLORS[index],
                  backgroundColor: KPI_WIDGET_GRAPH_BG_COLORS[index],
                }}>
                <Typography.Text className="days-remaining">
                  {daysLeft}
                </Typography.Text>
                <Typography.Text className="days-left">
                  {t('label.day-left', { day: 'days' })}
                </Typography.Text>
              </div>
            </Col>
            <Col span={20}>
              <div className="m-l-sm">
                <Typography.Text>
                  {resultData.displayName ?? name}
                </Typography.Text>
                <Progress
                  className=" data-insight-progress-bar"
                  percent={Number(currentProgress)}
                  showInfo={false}
                  strokeColor={KPI_WIDGET_GRAPH_COLORS[index]}
                />
                <div className="d-flex justify-space-between">
                  <div className="flex-1">
                    <Typography.Text>
                      {targetPercentValue}
                      {suffix}
                    </Typography.Text>
                  </div>
                  <div>
                    <Typography.Text>
                      {targetMetPercentValue}
                      {suffix}
                    </Typography.Text>
                  </div>
                </div>
              </div>
            </Col>
          </Row>
        );
      })}
    </Space>
  );
};

export default KPILatestResultsV1;
