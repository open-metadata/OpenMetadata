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
import { Typography } from '@openmetadata/ui-core-components';
import { PieChart } from '@openmetadata/ui-core-components/charts';
import { ChartData } from './SummaryPanel.interface';

export interface SummaryDonutProps {
  /** Accessible name of the chart, e.g. the card title. Translated by the caller. */
  ariaLabel: string;
  chartData: ChartData[];
  percentage: number | string;
  paddingAngle?: number;
  size?: number;
}

const LEGEND_HIDDEN = { show: false };
// ECharts expands hovered slices by 5px; leave another pixel for the stroke.
const HOVER_PADDING = 6;

/**
 * Donut ring (grey track + coloured data) with a centred percentage. Shared by
 * the OSS SummaryPieChartCard and the AI DqSummaryPanel so both render the same
 * chart; `size` scales the ring and the centre label.
 */
export const SummaryDonut = ({
  ariaLabel,
  chartData,
  percentage,
  paddingAngle = 0,
  size = 120,
}: SummaryDonutProps) => {
  const outerRadius = size / 2 - HOVER_PADDING;

  return (
    <div style={{ width: size }}>
      <PieChart
        track
        ariaLabel={ariaLabel}
        centerLabel={
          <Typography
            className="tw:text-primary"
            style={{ fontSize: Math.round(size * 0.135) }}
            weight="semibold">
            {percentage}
          </Typography>
        }
        data={chartData}
        height={size}
        innerRadius={outerRadius * 0.75}
        legend={LEGEND_HIDDEN}
        outerRadius={outerRadius}
        padAngle={paddingAngle}
      />
    </div>
  );
};

export default SummaryDonut;
