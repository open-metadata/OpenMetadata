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
import { Space, Typography } from 'antd';
import { isString, isUndefined } from 'lodash';
import { useMemo } from 'react';
import { Cell, Pie, PieChart, Tooltip } from 'recharts';
import { CHART_SMALL_SIZE } from '../../../constants/Chart.constants';
import { GREY_200 } from '../../../constants/Color.constants';
import { TEXT_GREY_MUTED } from '../../../constants/constants';
import { formatNumberWithComma } from '../../../utils/CommonUtils';
import { CustomPieChartProps } from './Chart.interface';
import './chart.less';

const CustomPieChart = ({
  name,
  data,
  label,
  showLegends = false,
}: CustomPieChartProps) => {
  const centerLabel = useMemo(() => {
    if (isUndefined(label)) {
      return '';
    }

    if (isString(label)) {
      return (
        <text dy={8} fill={TEXT_GREY_MUTED} textAnchor="middle" x="50%" y="50%">
          {label}
        </text>
      );
    }

    return label;
  }, [label]);

  return (
    <div className="custom-pie-chart">
      <PieChart
        height={CHART_SMALL_SIZE}
        id={`${name}-pie-chart`}
        width={CHART_SMALL_SIZE}>
        <Pie
          cx="50%"
          cy="50%"
          data={data}
          dataKey="value"
          fill={GREY_200}
          innerRadius={55}
          outerRadius={80}>
          <Cell fill={GREY_200} />
        </Pie>
        <Pie
          cx="50%"
          cy="50%"
          data={data}
          dataKey="value"
          innerRadius={60}
          outerRadius={80}>
          {data.map((entry) => (
            <Cell fill={entry.color} key={`cell-${entry.name}`} />
          ))}
        </Pie>
        <Tooltip />
        {centerLabel}
      </PieChart>

      {showLegends && (
        <Space wrap size={16}>
          {data.map((item) => (
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
    </div>
  );
};

export default CustomPieChart;
