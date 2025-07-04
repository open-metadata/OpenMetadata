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
import { Card, Divider, Typography } from 'antd';
import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
} from 'recharts';
import { BLUE_2, PRIMARY_COLOR } from '../../../constants/Color.constants';
import { WHITE_COLOR } from '../../../constants/constants';
import { formatDate } from '../../../utils/date-time/DateTimeUtils';
import { CustomAreaChartProps } from './Chart.interface';
import './chart.less';

const CustomAreaChart = ({
  data,
  name,
  height,
  colorScheme,
  valueFormatter,
}: CustomAreaChartProps) => {
  const CustomTooltip = (props: TooltipProps<string, number | string>) => {
    const { active, payload = [] } = props;

    if (active && payload && payload.length) {
      const payloadData = payload[0].payload;

      return (
        <Card className="custom-tooltip-area-chart">
          <div className="flex-center gap-2">
            <Typography.Text className="font-medium text-md">
              {valueFormatter
                ? valueFormatter(payloadData['count'])
                : payloadData['count']}
            </Typography.Text>
            <Divider type="vertical" />
            <Typography.Text className="text-xs">
              {formatDate(payloadData.timestamp)}
            </Typography.Text>
          </div>
        </Card>
      );
    }

    return null;
  };
  const gradientId = `${name}-splitColor`;

  const gradientArea = useMemo(() => {
    return (
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop
            offset="0%"
            stopColor={colorScheme?.gradientStartColor ?? BLUE_2}
            stopOpacity="0.7"
          />
          <stop
            offset="100%"
            stopColor={colorScheme?.gradientEndColor ?? WHITE_COLOR}
            stopOpacity="0.2"
          />
        </linearGradient>
      </defs>
    );
  }, [colorScheme, gradientId]);

  return (
    <ResponsiveContainer
      className="w-full"
      height={height ?? 150}
      id={`${name}-area-chart`}>
      <AreaChart
        data={data}
        margin={{
          top: 5,
          right: 0,
          left: 0,
          bottom: 5,
        }}>
        <Tooltip content={<CustomTooltip />} />

        {gradientArea}
        <Area
          connectNulls
          dataKey="count"
          dot={false}
          fill={`url(#${gradientId})`}
          isAnimationActive={false}
          stroke={colorScheme?.strokeColor ?? PRIMARY_COLOR}
          strokeWidth={2}
          type="monotone"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default CustomAreaChart;
