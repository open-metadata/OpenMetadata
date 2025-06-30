/*
 *  Copyright 2024 Collate.
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
import { Card, Space, Typography } from 'antd';
import classNames from 'classnames';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatNumberWithComma } from '../../../../utils/CommonUtils';
import { SummaryPieChartCardProps } from '../SummaryPanel.interface';
import './summary-pie-chart-card.style.less';

const SummaryPieChartCard = ({
  title,
  value,
  percentage,
  chartData,
  isLoading = false,
  showLegends = false,
  paddingAngle = 0,
}: SummaryPieChartCardProps) => {
  return (
    <Card className="pie-chart-summary-panel h-full" loading={isLoading}>
      <div className="d-flex justify-between items-center">
        <div>
          <Typography.Paragraph className="summary-title">
            {title}
          </Typography.Paragraph>

          <Typography.Paragraph className="summary-value m-b-0">
            {formatNumberWithComma(value)}
          </Typography.Paragraph>
        </div>

        <div
          className={classNames('chart-container', {
            'd-flex items-center': showLegends,
          })}>
          {showLegends && (
            <Space className="m-r-md" direction="vertical" size={4}>
              {chartData.map((item) => (
                <Space key={item.name} size={8}>
                  <div
                    className="legend-dot"
                    style={{ backgroundColor: item.color }}
                  />
                  <Typography.Paragraph className="text-grey-muted m-b-0">
                    {item.name}{' '}
                    <Typography.Text strong className="text-grey-muted">
                      {formatNumberWithComma(item.value)}
                    </Typography.Text>
                  </Typography.Paragraph>
                </Space>
              ))}
            </Space>
          )}

          <ResponsiveContainer height={120} width={120}>
            <PieChart>
              <Pie
                cx="50%"
                cy="50%"
                data={chartData}
                dataKey="value"
                innerRadius={45}
                outerRadius={60}
                paddingAngle={paddingAngle}>
                {chartData.map((entry, index) => (
                  <Cell fill={entry.color} key={`cell-${index}`} />
                ))}
              </Pie>
              <Tooltip />
              <text
                className="chart-center-text"
                dominantBaseline="middle"
                textAnchor="middle"
                x="50%"
                y="50%">
                {`${percentage}%`}
              </text>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
};

export default SummaryPieChartCard;
