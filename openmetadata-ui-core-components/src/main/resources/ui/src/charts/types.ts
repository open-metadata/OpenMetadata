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
  AriaComponentOption,
  BarSeriesOption,
  ComposeOption,
  DataZoomComponentOption,
  DefaultLabelFormatterCallbackParams,
  ECElementEvent,
  GridComponentOption,
  LegendComponentOption,
  LineSeriesOption,
  MarkLineComponentOption,
  PieSeriesOption,
  TooltipComponentFormatterCallbackParams,
  TooltipComponentOption,
  XAXisComponentOption,
  YAXisComponentOption,
} from 'echarts';
import type { ReactNode } from 'react';

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

export type ChartSeriesType = 'line' | 'area' | 'bar';

export interface ChartSeries {
  /** Field read from each datum. */
  key: string;
  /** Legend and tooltip label. Translated by the caller. */
  name: string;
  /** Defaults to `getSeriesColor(index)`. */
  color?: string;
  /** Only read by `ComposedChart`; other charts fix the type. */
  type?: ChartSeriesType;
  /** Series with the same stack id are stacked. */
  stack?: string;
  /** Value axis the series is drawn against. */
  yAxisIndex?: 0 | 1;
  /** Line and area only. Defaults to true. */
  smooth?: boolean;
  /** Line and area only. Defaults to false. */
  showDots?: boolean;
  /** Merged into this series' ECharts option. */
  seriesOption?: Partial<LineSeriesOption | BarSeriesOption>;
}

/**
 * An ECharts axis option plus two shorthands. `label` becomes the axis name;
 * `formatter` formats tick labels.
 */
export type ChartAxisProps<A> = Omit<Partial<A>, 'type' | 'data'> & {
  label?: string;
  formatter?: (value: string | number) => string;
};

export type ChartXAxisProps = ChartAxisProps<XAXisComponentOption> & {
  type?: 'category' | 'time';
};

export type ChartYAxisProps = ChartAxisProps<YAXisComponentOption>;

export interface ChartTooltipProps {
  show?: boolean;
  /** Formats one value. Receives the series key of the value. */
  valueFormatter?: (value: number | string, seriesKey: string) => string;
  /** Replaces the whole tooltip body. */
  formatter?: (params: TooltipComponentFormatterCallbackParams) => string;
}

export interface ChartLegendProps {
  /** Defaults to true when there is more than one series. */
  show?: boolean;
  position?: 'top' | 'bottom';
}

export interface ChartReferenceLine {
  axis: 'x' | 'y';
  value: number | string;
  label?: string;
  color?: string;
}

interface ChartCommonProps {
  /** Accessible name of the chart. Translated by the caller. */
  ariaLabel: string;
  height?: number | string;
  /** Forces a colour mode. Detected from `.dark-mode` when omitted. */
  isDark?: boolean;
  loading?: boolean;
  /** Shown instead of the chart when there is no data. */
  emptyState?: ReactNode;
  /** Merged into the built option last. Objects merge, arrays replace. */
  option?: ChartOption;
  className?: string;
  'data-testid'?: string;
}

export interface CartesianChartProps<T extends object>
  extends ChartCommonProps {
  data: T[];
  xKey: keyof T & string;
  series: ChartSeries[];
  xAxis?: ChartXAxisProps;
  yAxis?: ChartYAxisProps | [ChartYAxisProps, ChartYAxisProps];
  tooltip?: ChartTooltipProps;
  legend?: ChartLegendProps;
  referenceLines?: ChartReferenceLine[];
  /** `'auto'` turns zoom on above 15 points. Defaults to false. */
  zoom?: boolean | 'auto';
  onPointClick?: (datum: T, seriesKey: string, event: ECElementEvent) => void;
}

export interface BarChartProps<T extends object>
  extends CartesianChartProps<T> {
  layout?: 'vertical' | 'horizontal';
  /** Colour of one bar. `undefined` keeps the series colour. */
  getBarColor?: (datum: T, index: number) => string | undefined;
  showValueLabels?:
    | boolean
    | ((params: DefaultLabelFormatterCallbackParams) => string);
  /** Corner radius of the bar's outer end. 4, or 0 for stacked bars. */
  radius?: number;
}

export type CartesianBuildInput<T extends object> = Pick<
  BarChartProps<T>,
  | 'data'
  | 'xKey'
  | 'series'
  | 'ariaLabel'
  | 'xAxis'
  | 'yAxis'
  | 'tooltip'
  | 'legend'
  | 'referenceLines'
  | 'zoom'
  | 'option'
  | 'layout'
  | 'getBarColor'
  | 'showValueLabels'
  | 'radius'
>;
