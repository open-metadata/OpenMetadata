/*
 *  Copyright 2026 Collate.
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
import { Cell, Pie, PieChart, Tooltip } from 'recharts';
import { GREY_200 } from '../../../constants/Color.constants';
import { ChartData } from './SummaryPanel.interface';

export interface SummaryDonutProps {
  chartData: ChartData[];
  percentage: number | string;
  paddingAngle?: number;
  size?: number;
}

/**
 * Donut ring (grey track + coloured data) with a centred percentage. Shared by
 * the OSS SummaryPieChartCard and the AI DqSummaryPanel so both render the same
 * chart; `size` scales the ring and the centre label.
 */
export const SummaryDonut = ({
  chartData,
  percentage,
  paddingAngle = 0,
  size = 120,
}: SummaryDonutProps) => {
  const innerRadius = (size * 45) / 120;
  const outerRadius = (size * 60) / 120;

  return (
    <PieChart height={size} width={size}>
      <Pie
        cx="50%"
        cy="50%"
        // empty grey ring shown as the track behind the data
        data={[{ value: 1 }]}
        dataKey="value"
        endAngle={-270}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        paddingAngle={paddingAngle}
        pointerEvents="none"
        startAngle={90}>
        <Cell fill={GREY_200} />
      </Pie>
      <Pie
        cx="50%"
        cy="50%"
        data={chartData}
        dataKey="value"
        endAngle={-270}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        paddingAngle={paddingAngle}
        startAngle={90}>
        {chartData.map((entry, index) => (
          <Cell fill={entry.color} key={`cell-${index}`} />
        ))}
      </Pie>
      <Tooltip />
      <text
        dominantBaseline="middle"
        style={{
          fill: 'var(--color-text-primary, #181d27)',
          fontSize: Math.round(size * 0.135),
          fontWeight: 600,
        }}
        textAnchor="middle"
        x="50%"
        y="50%">
        {percentage}
      </text>
    </PieChart>
  );
};

export default SummaryDonut;
