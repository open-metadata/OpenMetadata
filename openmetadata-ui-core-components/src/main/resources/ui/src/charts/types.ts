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

import type {
  ComposeOption,
  AriaComponentOption,
  BarSeriesOption,
  DataZoomComponentOption,
  GridComponentOption,
  LegendComponentOption,
  LineSeriesOption,
  MarkLineComponentOption,
  PieSeriesOption,
  TooltipComponentOption,
} from 'echarts';

/**
 * Neutral chart chrome (axes, grid, tooltip, borders) for one colour mode.
 * Series colours are not part of the theme — they come from the palette and
 * stay the same in light and dark.
 */
export interface ChartTheme {
  isDark: boolean;
  axisText: string;
  /** Tick label colour. `undefined` keeps the ECharts default. */
  axisTick?: string;
  axisTitle: string;
  xAxisTitle: string;
  grid: string;
  /** Fill for "no value" areas, e.g. regions without data on a map. */
  emptyFill: string;
  /** Border between adjacent segments (pie slices, treemap cells). */
  segmentBorder: string;
  tooltipBg: string;
  tooltipText: string;
  tooltipBorder: string;
}

/**
 * The ECharts option shape the charts module builds: only the chart types and
 * components `registerChartParts` registers, so an option using anything else
 * fails the type check.
 */
export type ChartOption = ComposeOption<
  | LineSeriesOption
  | BarSeriesOption
  | PieSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | DataZoomComponentOption
  | MarkLineComponentOption
  | AriaComponentOption
>;
