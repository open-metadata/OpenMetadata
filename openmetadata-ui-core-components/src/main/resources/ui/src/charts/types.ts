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
  GridComponentOption,
  LegendComponentOption,
  LineSeriesOption,
  MapSeriesOption,
  MarkLineComponentOption,
  PieSeriesOption,
  TooltipComponentFormatterCallbackParams,
  TooltipComponentOption,
  VisualMapComponentOption,
  XAXisComponentOption,
  YAXisComponentOption,
} from 'echarts';

// No React here, not even type-only: the Collate email renderer compiles the
// option builders and this file without React installed.

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
  | MapSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | DataZoomComponentOption
  | MarkLineComponentOption
  | AriaComponentOption
  | VisualMapComponentOption
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

export interface CartesianBuildInput<T extends object> {
  data: T[];
  xKey: keyof T & string;
  series: ChartSeries[];
  /** Accessible name of the chart. Translated by the caller. */
  ariaLabel: string;
  xAxis?: ChartXAxisProps;
  yAxis?: ChartYAxisProps | [ChartYAxisProps, ChartYAxisProps];
  tooltip?: ChartTooltipProps;
  legend?: ChartLegendProps;
  referenceLines?: ChartReferenceLine[];
  /** `'auto'` turns zoom on above 15 points. Defaults to false. */
  zoom?: boolean | 'auto';
  /** Merged into the built option last. Objects merge, arrays replace. */
  option?: ChartOption;
  /** Bar charts only. */
  layout?: 'vertical' | 'horizontal';
  /** Bar charts only. Colour of one bar; `undefined` keeps the series colour. */
  getBarColor?: (datum: T, index: number) => string | undefined;
  /** Bar charts only. */
  showValueLabels?:
    | boolean
    | ((params: DefaultLabelFormatterCallbackParams) => string);
  /** Bar charts only. Radius of the bar's outer end. 4, or 0 when stacked. */
  radius?: number;
}

export interface PieDatum {
  /** Slice label. Translated by the caller. */
  name: string;
  value: number;
  /** Defaults to `getSeriesColor(index)`. */
  color?: string;
}

export interface PieBuildInput {
  data: PieDatum[];
  /** Accessible name of the chart. Translated by the caller. */
  ariaLabel: string;
  /** Set for a donut, e.g. `'55%'`. Defaults to a full pie. */
  innerRadius?: number | string;
  /** Outer radius, e.g. `'100%'`. Defaults to `'72%'`. */
  outerRadius?: number | string;
  /** Smallest angle in degrees a non-zero slice is drawn with. Defaults to 0. */
  minAngle?: number;
  /** Gap in degrees between slices. Defaults to 0. */
  padAngle?: number;
  /**
   * Draws a grey ring behind the slices. With a track, all-zero data shows
   * the ring (and any centre label) instead of the empty state.
   */
  track?: boolean;
  /** Whole-percent labels beside each slice. */
  showLabels?: boolean;
  legend?: ChartLegendProps;
  tooltip?: ChartTooltipProps;
  /** Merged into the built option last. Objects merge, arrays replace. */
  option?: ChartOption;
}

/** Minimal GeoJSON FeatureCollection shape ECharts' `registerMap` accepts. */
export interface GeoJson {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: { name?: string } & Record<string, unknown>;
    geometry: unknown;
  }>;
}

export interface GeoMapDatum {
  /** Raw region value; resolved to a GeoJSON feature name via `resolveRegion`. */
  region: string;
  value: number;
}

export interface GeoMapBuildInput {
  data: GeoMapDatum[];
  /** Accessible name of the chart. Translated by the caller. */
  ariaLabel: string;
  /**
   * Key the map geometry is registered under. Different geometry (e.g. a
   * differently trimmed map) needs a different key.
   */
  mapName: string;
  /**
   * Maps a raw region value (`'CA'`, `'06'`) to its GeoJSON feature name.
   * `undefined` means unmatched. Defaults to the raw value itself.
   */
  resolveRegion?: (raw: string) => string | undefined;
  /** Colour-scale legend under the map. Defaults to true. */
  showScale?: boolean;
  /** Low → high colours of the scale. Defaults to `GEO_COLOR_RANGE`. */
  colorRange?: string[];
  tooltip?: ChartTooltipProps;
  /** Merged into the built option last. Objects merge, arrays replace. */
  option?: ChartOption;
}
