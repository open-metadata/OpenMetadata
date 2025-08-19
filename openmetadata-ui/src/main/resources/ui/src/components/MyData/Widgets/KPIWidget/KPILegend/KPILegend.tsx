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
import { InfoCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { Col, Progress, Row, Typography } from 'antd';
import { Tooltip } from '../../../../common/AntdCompat';;
import { toNumber } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CheckIcon } from '../../../../../assets/svg/ic-check-circle-new.svg';
import { KPI_WIDGET_GRAPH_COLORS } from '../../../../../constants/Widgets.constant';
import { KpiTargetType } from '../../../../../generated/api/dataInsight/kpi/createKpiRequest';
import { UIKpiResult } from '../../../../../interface/data-insight.interface';
import { getKpiResultFeedback } from '../../../../../utils/DataInsightUtils';
import { getDaysRemaining } from '../../../../../utils/date-time/DateTimeUtils';
import './kpi-legend.less';

interface KPILegendProps {
  kpiLatestResultsRecord: Record<string, UIKpiResult>;
  isFullSize: boolean;
}

const KPILegend: React.FC<KPILegendProps> = ({
  kpiLatestResultsRecord,
  isFullSize,
}) => {
  const { t } = useTranslation();
  const entries = Object.entries(kpiLatestResultsRecord);

  const GoalCompleted = () => {
    return (
      <div className="goal-completed-container d-flex items-center gap-1">
        <CheckIcon />
        <Typography.Text>{t('label.goal-completed')}</Typography.Text>
      </div>
    );
  };

  const GoalMissed = () => {
    return (
      <div className="goal-missed-container d-flex items-center gap-1">
        <WarningOutlined />
        <Typography.Text>{t('label.goal-missed')}</Typography.Text>
      </div>
    );
  };

  return (
    <div className="w-full h-full kpi-legend d-flex flex-column p-sm">
      {entries.map(([key, resultData], index) => {
        const color =
          KPI_WIDGET_GRAPH_COLORS[index % KPI_WIDGET_GRAPH_COLORS.length];
        const daysLeft = getDaysRemaining(resultData.endDate);
        const targetResult = resultData.targetResult[0];

        const isPercentage = resultData.metricType === KpiTargetType.Percentage;

        const current = toNumber(targetResult?.value);
        const target = toNumber(resultData.target);

        const currentProgress = (current / target) * 100;
        const suffix = isPercentage ? '%' : '';

        const isTargetMet = targetResult.targetMet;
        const isTargetMissed = !targetResult.targetMet && daysLeft <= 0;

        if (isFullSize) {
          return (
            <div className="kpi-full-legend p-xs m-b-sm" key={key}>
              <Row className="items-center" gutter={8}>
                <Col span={24}>
                  <div className="d-flex justify-between">
                    <Typography.Text
                      className="kpi-legend-title"
                      ellipsis={{ tooltip: true }}>
                      {resultData.displayName}
                    </Typography.Text>

                    {daysLeft <= 0 || isTargetMet ? (
                      <Tooltip
                        placement="bottom"
                        title={getKpiResultFeedback(
                          daysLeft,
                          Boolean(isTargetMet)
                        )}
                        trigger="hover">
                        <InfoCircleOutlined className="kpi-legend-info-icon" />
                      </Tooltip>
                    ) : null}
                  </div>

                  <Progress
                    percent={Number(currentProgress)}
                    showInfo={false}
                    size="small"
                    strokeColor={color}
                    strokeWidth={4}
                  />

                  <div className="d-flex justify-between m-t-xxs">
                    <Typography.Text className="text-xss kpi-legend-value">
                      {current.toFixed(0)}
                      {suffix}
                    </Typography.Text>
                    {isTargetMet ? (
                      <GoalCompleted />
                    ) : isTargetMissed ? (
                      <GoalMissed />
                    ) : (
                      <Typography.Text className="text-xss font-semibold kpi-legend-days-left">
                        {daysLeft <= 0 ? 0 : daysLeft}{' '}
                        {t('label.days-left').toUpperCase()}
                      </Typography.Text>
                    )}
                    <Typography.Text className="text-xss kpi-legend-value">
                      {target.toFixed(0)}
                      {suffix}
                    </Typography.Text>
                  </div>
                </Col>
              </Row>
            </div>
          );
        }

        // Compact Mode
        return (
          <div className="legend-item p-sm d-flex items-center justify-center gap-1 text-xs flex-wrap ">
            <span
              className="legend-dot h-3 w-3 m-r-xss"
              style={{ backgroundColor: color }}
            />
            <Typography.Text strong className="text-xs font-semibold">
              {`${resultData.displayName}:`}
            </Typography.Text>
            <Typography.Text className="text-xs font-normal" type="secondary">
              {daysLeft <= 0 ? 0 : daysLeft} {t('label.days-left')}
            </Typography.Text>
          </div>
        );
      })}
    </div>
  );
};

export default KPILegend;
