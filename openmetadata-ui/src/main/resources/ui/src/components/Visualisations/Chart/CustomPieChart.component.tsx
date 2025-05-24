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
import { isString, isUndefined } from 'lodash';
import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { CHART_BASE_SIZE } from '../../../constants/Chart.constants';
import { WHITE_SMOKE } from '../../../constants/Color.constants';
import { TEXT_GREY_MUTED } from '../../../constants/constants';
import { CustomPieChartProps } from './Chart.interface';

const CustomPieChart = ({ name, data, label }: CustomPieChartProps) => {
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
    <ResponsiveContainer
      height={CHART_BASE_SIZE}
      id={`${name}-pie-chart`}
      width={CHART_BASE_SIZE}>
      <PieChart height={CHART_BASE_SIZE} width={CHART_BASE_SIZE}>
        <Pie
          cx="50%"
          cy="50%"
          data={data}
          dataKey="value"
          fill={WHITE_SMOKE}
          innerRadius={78}
          outerRadius={107}>
          <Cell fill={WHITE_SMOKE} />
        </Pie>
        <Pie
          cx="50%"
          cy="50%"
          data={data}
          dataKey="value"
          innerRadius={85}
          outerRadius={100}>
          {data.map((entry) => (
            <Cell fill={entry.color} key={`cell-${entry.name}`} />
          ))}
        </Pie>
        <Tooltip />
        {centerLabel}
      </PieChart>
    </ResponsiveContainer>
  );
};

export default CustomPieChart;
