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
  toNumberOrNull,
} from './options/cartesian';
export {
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
export { mergeOption } from './options/merge';
export { buildPieOption, isPieEmpty } from './options/pie';

// Palette, theme, formatting
export { formatTooltipValue, formatYAxisTick } from './format';
export { CHART_PALETTE, getSeriesColor } from './palette';
export { registerEChartsParts } from './register';
export { buildChartTheme, DARK_CHART_THEME, LIGHT_CHART_THEME } from './theme';
export { useIsDarkMode } from './use-is-dark-mode';

// Types
export type {
  BarChartProps,
  CartesianBuildInput,
  CartesianChartProps,
  ChartAxisProps,
  ChartLegendProps,
  ChartOption,
  ChartReferenceLine,
  ChartSeries,
  ChartSeriesType,
  ChartTheme,
  ChartTooltipProps,
  ChartXAxisProps,
  ChartYAxisProps,
  PieBuildInput,
  PieChartProps,
  PieDatum,
} from './types';
export type {
  DefaultLabelFormatterCallbackParams,
  ECElementEvent,
  TooltipComponentFormatterCallbackParams,
} from 'echarts';
