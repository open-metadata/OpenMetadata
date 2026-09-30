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

import type { PieSeriesOption } from 'echarts';
import { getSeriesColor } from '../palette';
import type {
  ChartOption,
  ChartTheme,
  PieBuildInput,
  PieDatum,
} from '../types';
import { legendConfig, tooltipConfig } from './common';
import { mergeOption } from './merge';

const OUTER_RADIUS = '72%';

/** Id of the grey ring `track` draws behind the slices. */
export const PIE_TRACK_SERIES_ID = 'pie-track';

type PieRadius = [number | string, number | string];

/** Nothing to draw: no slices, or every slice is zero or negative. */
export const isPieEmpty = (data: PieDatum[]): boolean =>
  data.every((datum) => !(datum.value > 0));

// ECharts gives even a zero slice `minAngle`; '-' marks it missing, so it draws
// no arc while keeping its data index for click mapping.
const sliceValue = (value: number): number | '-' => (value > 0 ? value : '-');

const sliceLabel = (show: boolean): PieSeriesOption['label'] =>
  show
    ? {
        show: true,
        formatter: (params: { percent?: number }) =>
          `${Math.round(params.percent ?? 0)}%`,
      }
    : { show: false };

const trackSeries = (
  radius: PieRadius,
  theme: ChartTheme
): PieSeriesOption => ({
  id: PIE_TRACK_SERIES_ID,
  type: 'pie',
  silent: true,
  z: 1,
  radius,
  center: ['50%', '50%'],
  label: { show: false },
  labelLine: { show: false },
  tooltip: { show: false },
  emphasis: { disabled: true },
  data: [{ name: '', value: 1, itemStyle: { color: theme.emptyFill } }],
});

export const buildPieOption = (
  input: PieBuildInput,
  theme: ChartTheme
): ChartOption => {
  const names = input.data.map((datum) => datum.name);
  const showLabels = Boolean(input.showLabels);
  const radius: PieRadius = [
    input.innerRadius ?? 0,
    input.outerRadius ?? OUTER_RADIUS,
  ];

  const slices: PieSeriesOption = {
    type: 'pie',
    radius,
    center: ['50%', '50%'],
    minAngle: input.minAngle ?? 0,
    padAngle: input.padAngle ?? 0,
    stillShowZeroSum: false,
    itemStyle: { borderColor: theme.segmentBorder, borderWidth: 1 },
    label: sliceLabel(showLabels),
    labelLine: { show: showLabels },
    data: input.data.map((datum, index) => ({
      name: datum.name,
      value: sliceValue(datum.value),
      itemStyle: { color: datum.color ?? getSeriesColor(index) },
    })),
  };

  const option: ChartOption = {
    aria: {
      enabled: true,
      label: { description: `${input.ariaLabel}. ${names.join(', ')}` },
    },
    tooltip: tooltipConfig('item', theme, input.tooltip),
    legend: legendConfig(names, theme, { show: true, ...input.legend }),
    series: input.track ? [slices, trackSeries(radius, theme)] : [slices],
  };

  return mergeOption(option, input.option);
};
