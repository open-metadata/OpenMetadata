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

// `@openmetadata/ui-core-components/charts` — ECharts-based charts.
// Deliberately not re-exported from the root entry, so apps that render no
// chart never pull echarts into their bundle.

// Components
export { AreaChart } from './area-chart';
export { BarChart } from './bar-chart';
export { ComposedChart } from './composed-chart';
export { EChart } from './echart';
export { GeoMapChart } from './geo-map-chart';
export type { EChartProps } from './echart';
export { LineChart } from './line-chart';
export { PieChart } from './pie-chart';

// Option builders (pure — also usable outside React, e.g. server rendering)
export {
  buildAreaOption,
  buildBarOption,
  buildCartesianOption,
  buildComposedOption,
  buildLineOption,
  REFERENCE_SERIES_ID,
  toNumberOrNull,
} from './options/cartesian';
export {
  applyZoomWindow,
  areaGradient,
  categoryAxis,
  dataZoomFor,
  DATAZOOM_THRESHOLD,
  gridFor,
  hexToRgba,
  legendConfig,
  referenceLinesToMarkLine,
  tooltipConfig,
  valueAxis,
} from './options/common';
export { buildGeoMapOption, resolveGeoData } from './options/geo';
export type { ResolvedGeoData } from './options/geo';
export { mergeOption, REPLACE_MERGE_KEYS } from './options/merge';
export { buildPieOption, isPieEmpty, PIE_TRACK_SERIES_ID } from './options/pie';
export { toTooltipItems } from './tooltip-render';
export type {
  ChartTooltipRender,
  ChartTooltipRenderProps,
} from './tooltip-render';

// Palette, theme, formatting
export { formatTooltipValue, formatYAxisTick } from './format';
export {
  CHART_PALETTE,
  chartColor,
  DARK_CHART_PALETTE,
  getSeriesColor,
  LIGHT_CHART_PALETTE,
} from './palette';
export { registerEChartsParts, registerGeoMap } from './register';
export { buildChartTheme, DARK_CHART_THEME, LIGHT_CHART_THEME } from './theme';
export { useChartPalette } from './use-chart-palette';
export { useIsDarkMode } from './use-is-dark-mode';

// Types
export type { ZoomWindow } from './options/common';
export type {
  BarChartProps,
  CartesianChartProps,
  ChartCommonProps,
  GeoMapChartProps,
  PieChartProps,
} from './props';
export type {
  CartesianBuildInput,
  ChartAxisProps,
  ChartLegendProps,
  ChartOption,
  ChartPalette,
  ChartPointStyle,
  ChartReferenceLine,
  ChartSeries,
  ChartSeriesType,
  ChartStatus,
  ChartTheme,
  ChartTooltipItem,
  ChartTooltipProps,
  ChartXAxisProps,
  ChartYAxisProps,
  GeoJson,
  GeoMapBuildInput,
  GeoMapDatum,
  PieBuildInput,
  PieDatum,
} from './types';
export type {
  DefaultLabelFormatterCallbackParams,
  ECElementEvent,
  TooltipComponentFormatterCallbackParams,
} from 'echarts';
