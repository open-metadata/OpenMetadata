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
/** A colour that carries meaning, e.g. a test result. */
export type ChartStatus =
  | 'success'
  | 'warning'
  | 'failed'
  | 'info'
  | 'neutral'
  | 'muted';

export interface ChartPalette {
  /** Categorical colours, cycled by series or slice index. */
  series: readonly string[];
  /** Colours that carry meaning. */
  status: Readonly<Record<ChartStatus, string>>;
  /** Low and high ends of a continuous scale, e.g. a geo map. */
  scale: readonly [string, string];
}

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
  /** Every series, slice and scale colour comes from here. */
  palette: ChartPalette;
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

/**
 * `band` (`ComposedChart` only) reads `datum[key]` as `[low, high]` and fills
 * the range between them, under every other series. It takes no palette
 * colour and is left out of the legend.
 */
export type ChartSeriesType = 'line' | 'area' | 'bar' | 'band';

/** A position in pixels, relative to the chart's top-left corner. */
export interface ChartPixel {
  x: number;
  y: number;
}

/** How one point of a line or area series is drawn. */
export interface ChartPointStyle {
  /** Status colour of the dot. Without one it takes the series colour. */
  status?: ChartStatus;
  /** A ring instead of a filled dot, e.g. for a run that produced no value. */
  hollow?: boolean;
  /** A soft halo around the dot, e.g. for the selected point. */
  selected?: boolean;
}

export interface ChartSeries {
  /** Field read from each datum. */
  key: string;
  /** Legend and tooltip label. Translated by the caller. */
  name: string;
  /** Status colour; without one the series takes the next palette colour. */
  status?: ChartStatus;
  /**
   * Overrides the palette and `status`, in both colour modes. A concrete
   * colour (hex or rgb): ECharts cannot parse CSS variables.
   */
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
  /**
   * Line and area only. The dot of each point; `undefined` draws none for
   * that point. Turns the series' dots on, whatever `showDots` says.
   */
  pointStyle?: (
    datum: Record<string, unknown>,
    index: number
  ) => ChartPointStyle | undefined;
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

export type ChartYAxisProps = ChartAxisProps<YAXisComponentOption> & {
  /**
   * `'category'` plots string values (e.g. the min / max of a date column);
   * the categories are the distinct values, sorted. Defaults to `'value'`.
   */
  type?: 'value' | 'category';
};

export interface ChartTooltipProps {
  show?: boolean;
  /**
   * Formats one value. Receives the series key of the value. Not applied to
   * `tooltip.render`, which receives raw values and formats its own.
   */
  valueFormatter?: (value: number | string, seriesKey: string) => string;
  /** Replaces the whole tooltip body. */
  formatter?: (params: TooltipComponentFormatterCallbackParams) => string;
  /**
   * Drops ECharts' own tooltip box (padding, border, background, shadow), so
   * content that brings its own card is not boxed twice. Set by
   * `tooltip.render`.
   */
  bare?: boolean;
}

/** One series' value at the hovered point, as handed to `tooltip.render`. */
export interface ChartTooltipItem {
  /** `ChartSeries.key`; the slice name on a pie. */
  seriesKey: string;
  /** Legend label of the series, or the slice name. */
  name: string;
  /** `null` for a gap (missing value). */
  value: number | string | null;
  /** Resolved colour of the series or slice. */
  color: string;
  /** Index of the hovered row in the chart's `data`. */
  dataIndex: number;
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
  /** Status colour of the line. Defaults to the axis text colour. */
  status?: ChartStatus;
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
  /**
   * `'auto'` turns zoom on above `zoomVisiblePoints` points (15 by default).
   * Defaults to false.
   */
  zoom?: boolean | 'auto';
  /**
   * With zoom on, how many points the window shows at first; `'auto'` turns
   * zoom on above this many. Defaults to 15.
   */
  zoomVisiblePoints?: number;
  /** Category-axis labels emit click events. Set by `onCategoryClick`. */
  categoryClickable?: boolean;
  /** Merged into the built option last. Objects merge, arrays replace. */
  option?: ChartOption;
  /** Bar charts only. */
  layout?: 'vertical' | 'horizontal';
  /** Bar charts only. Status of one bar; `undefined` keeps the series colour. */
  getBarStatus?: (datum: T, index: number) => ChartStatus | undefined;
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
  /** Status colour; without one the slice takes the next palette colour. */
  status?: ChartStatus;
  /**
   * Overrides the palette and `status`, in both colour modes. A concrete
   * colour (hex or rgb): ECharts cannot parse CSS variables.
   */
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
  /** Slices show a pointer cursor. `PieChart` sets it when `onSliceClick` is given. */
  clickable?: boolean;
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
  tooltip?: ChartTooltipProps;
  /** Merged into the built option last. Objects merge, arrays replace. */
  option?: ChartOption;
}
