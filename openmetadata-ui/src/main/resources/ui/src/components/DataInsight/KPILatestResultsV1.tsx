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

import { CheckCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { Col, Progress, Row, Space, Typography } from 'antd';
import { toNumber } from 'lodash';
import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    KPI_WIDGET_GRAPH_BG_COLORS,
    KPI_WIDGET_GRAPH_COLORS
} from '../../constants/DataInsight.constants';
import { KpiTargetType } from '../../generated/api/dataInsight/kpi/createKpiRequest';
import { UIKpiResult } from '../../interface/data-insight.interface';
import { getKpiResultFeedback } from '../../utils/DataInsightUtils';
import { getDaysRemaining } from '../../utils/date-time/DateTimeUtils';
import { Tooltip } from '../common/AntdCompat';
import './kpi-latest-results.less';
;

interface Props {
  kpiLatestResultsRecord: Record<string, UIKpiResult>;
}

const KPILatestResultsV1: FC<Props> = ({ kpiLatestResultsRecord }) => {
  const { t } = useTranslation();
  const { latestResultsList } = useMemo(() => {
    return { latestResultsList: Object.entries(kpiLatestResultsRecord) };
  }, [kpiLatestResultsRecord]);

  return (
    <Space
      className="w-full p-t-lg p-r-xs"
      data-testid="kpi-latest-result-container"
      direction="vertical"
      size={48}>
      {latestResultsList.map((result, index) => {
        const name = result[0];
        const resultData = result[1];

        const isPercentage = resultData.metricType === KpiTargetType.Percentage;

        const targetResult = resultData.targetResult[0];

        const targetValue = toNumber(targetResult.value);
        const targetMetValue = toNumber(resultData.target);

        const targetPercentValue = isPercentage
          ? targetValue.toFixed(2)
          : targetValue;
        const targetMetPercentValue = isPercentage
          ? targetMetValue.toFixed(2)
          : targetMetValue;

        const suffix = isPercentage ? '%' : '';

        const currentProgress = (targetValue / targetMetValue) * 100;

        const daysLeft = getDaysRemaining(resultData.endDate);

        const isTargetMet = targetResult.targetMet;

        return (
          <Row data-testid={name} key={name}>
            <Col className="d-flex items-center" span={24}>
              <div
                className="kpi-days-section"
                style={{
                  color: KPI_WIDGET_GRAPH_COLORS[index],
                  backgroundColor: KPI_WIDGET_GRAPH_BG_COLORS[index],
                }}>
                {isTargetMet ? (
                  <>
                    <Typography.Text
                      className="days-remaining"
                      data-testid="kpi-success">
                      <CheckCircleOutlined style={{ fontSize: '20px' }} />
                    </Typography.Text>
                  </>
                ) : (
                  <>
                    <Typography.Text
                      className="days-remaining"
                      data-testid="kpi-days-remaining">
                      {daysLeft <= 0 ? 0 : daysLeft}
                    </Typography.Text>
                    <Typography.Text className="days-left">
                      {t('label.day-left', { day: 'days' })}
                    </Typography.Text>
                  </>
                )}
              </div>
              <div className="m-l-sm flex-1">
                <Space className="w-full justify-between">
                  <Typography.Text className="text-xs">
                    {resultData.displayName ?? name}
                  </Typography.Text>
                  {daysLeft <= 0 || isTargetMet ? (
                    <Tooltip
                      placement="bottom"
                      title={getKpiResultFeedback(
                        daysLeft,
                        Boolean(isTargetMet)
                      )}
                      trigger="hover">
                      <InfoCircleOutlined style={{ fontSize: '14px' }} />
                    </Tooltip>
                  ) : null}
                </Space>
                <Progress
                  percent={Number(currentProgress)}
                  showInfo={false}
                  size="small"
                  strokeColor={KPI_WIDGET_GRAPH_COLORS[index]}
                />
                <div className="d-flex justify-space-between">
                  <div className="flex-1">
                    <Typography.Text className="text-xs">
                      {targetPercentValue}
                      {suffix}
                    </Typography.Text>
                  </div>
                  <div>
                    <Typography.Text className="text-xs">
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
