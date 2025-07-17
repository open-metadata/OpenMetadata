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
import { Col, Progress, Row, Space, Typography } from 'antd';
import { toNumber } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { KPI_WIDGET_GRAPH_COLORS } from '../../../../../constants/Widgets.constant';
import { KpiTargetType } from '../../../../../generated/api/dataInsight/kpi/createKpiRequest';
import { UIKpiResult } from '../../../../../interface/data-insight.interface';
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

  return (
    <div
      className={`w-full kpi-legend d-flex items-center justify-center ${
        isFullSize ? 'gap-6' : 'gap-4'
      }`}>
      {entries.map(([key, resultData], index) => {
        const color =
          KPI_WIDGET_GRAPH_COLORS[index % KPI_WIDGET_GRAPH_COLORS.length];
        const daysLeft = getDaysRemaining(resultData.endDate);

        const isPercentage = resultData.metricType === KpiTargetType.Percentage;

        const current = toNumber(resultData.targetResult[0]?.value);
        const target = toNumber(resultData.target);

        const currentProgress = (current / target) * 100;
        const suffix = isPercentage ? '%' : '';

        if (isFullSize) {
          return (
            <Row
              className="kpi-full-legend text-center p-y-xs p-x-sm d-flex items-center border-radius-sm"
              gutter={16}
              key={key}>
              <Col flex="auto">
                <Space className="w-full justify-between">
                  <Typography.Text className="text-xs font-semibold">
                    {resultData.displayName}
                  </Typography.Text>
                </Space>

                <Progress
                  percent={Number(currentProgress)}
                  showInfo={false}
                  size="small"
                  strokeColor={color}
                />

                <div className="d-flex justify-space-between">
                  <Typography.Text className="text-xs">
                    {current.toFixed(2)}
                    {suffix}
                  </Typography.Text>
                  <Typography.Text className="text-xs">
                    {target.toFixed(2)}
                    {suffix}
                  </Typography.Text>
                </div>
              </Col>

              <Col className="d-flex flex-column items-end gap-5">
                <Typography.Text className="days-left text-xs font-normal">
                  {t('label.days-left')}
                </Typography.Text>
                <Typography.Text
                  className="days-remaining text-md font-semibold"
                  style={{ color }}>
                  {daysLeft <= 0 ? 0 : daysLeft}
                </Typography.Text>
              </Col>
            </Row>
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
