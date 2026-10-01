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
  BarSeriesOption,
  LineSeriesOption,
  XAXisComponentOption,
  YAXisComponentOption,
} from 'echarts';
import { chartColor } from '../palette';
import type {
  CartesianBuildInput,
  ChartOption,
  ChartSeries,
  ChartSeriesType,
  ChartTheme,
  ChartYAxisProps,
} from '../types';
import {
  areaGradient,
  categoryAxis,
  dataZoomFor,
  DATAZOOM_THRESHOLD,
  gridFor,
  legendConfig,
  referenceLinesToMarkLine,
  tooltipConfig,
  valueAxis,
} from './common';
import { mergeOption } from './merge';

const BAR_MAX_WIDTH = 60;
const DEFAULT_BAR_RADIUS = 4;
const LINE_WIDTH = 2.5;
const Z_BAR = 1;
const Z_LINE = 3;

type Datum = Record<string, unknown>;
type CartesianSeriesOption = LineSeriesOption | BarSeriesOption;

/** Missing or non-numeric values become `null`, which ECharts draws as a gap. */
export const toNumberOrNull = (value: unknown): number | null => {
  const isNumericString = typeof value === 'string' && value.trim() !== '';
  const n =
    typeof value === 'number' || isNumericString ? Number(value) : Number.NaN;

  return Number.isFinite(n) ? n : null;
};

interface SeriesContext<T extends object> {
  input: CartesianBuildInput<T>;
  theme: ChartTheme;
  isTime: boolean;
  horizontal: boolean;
  composed: boolean;
}

const pointValue = <T extends object>(
  ctx: SeriesContext<T>,
  datum: T,
  key: string
) => {
  const value = toNumberOrNull((datum as Datum)[key]);

  return ctx.isTime ? [(datum as Datum)[ctx.input.xKey], value] : value;
};

const barRadius = (radius: number, horizontal: boolean) =>
  horizontal ? [0, radius, radius, 0] : [radius, radius, 0, 0];

const barLabel = <T extends object>({
  input,
  horizontal,
}: SeriesContext<T>) => {
  const { showValueLabels } = input;
  if (!showValueLabels) {
    return undefined;
  }

  return {
    show: true,
    position: horizontal ? 'right' : 'top',
    ...(typeof showValueLabels === 'function'
      ? { formatter: showValueLabels }
      : {}),
  } as BarSeriesOption['label'];
};

const barSeries = <T extends object>(
  ctx: SeriesContext<T>,
  series: ChartSeries,
  color: string
): BarSeriesOption => {
  const { input, horizontal } = ctx;
  const radius = input.radius ?? (series.stack ? 0 : DEFAULT_BAR_RADIUS);

  return {
    type: 'bar',
    barMaxWidth: BAR_MAX_WIDTH,
    itemStyle: { color, borderRadius: barRadius(radius, horizontal) },
    label: barLabel(ctx),
    ...(ctx.composed ? { z: Z_BAR } : {}),
    data: input.data.map((datum, index) => {
      const value = pointValue(ctx, datum, series.key);
      const status = input.getBarStatus?.(datum, index);

      return status
        ? { value, itemStyle: { color: ctx.theme.palette.status[status] } }
        : value;
    }) as BarSeriesOption['data'],
  };
};

const lineSeries = <T extends object>(
  ctx: SeriesContext<T>,
  series: ChartSeries,
  color: string,
  filled: boolean
): LineSeriesOption => ({
  type: 'line',
  smooth: series.smooth ?? true,
  showSymbol: series.showDots ?? false,
  lineStyle: { color, width: LINE_WIDTH, cap: 'round', join: 'round' },
  itemStyle: { color },
  // Always set, so a re-render that drops the fill clears the old one.
  areaStyle: filled ? { color: areaGradient(color) } : undefined,
  ...(ctx.composed ? { z: Z_LINE } : {}),
  data: ctx.input.data.map((datum) =>
    pointValue(ctx, datum, series.key)
  ) as LineSeriesOption['data'],
});

const buildSeries = <T extends object>(
  ctx: SeriesContext<T>,
  series: ChartSeries,
  index: number,
  type: ChartSeriesType
): CartesianSeriesOption => {
  const color =
    series.color ?? chartColor(ctx.theme.palette, index, series.status);
  const body =
    type === 'bar'
      ? barSeries(ctx, series, color)
      : lineSeries(ctx, series, color, type === 'area');
  const { valueFormatter } = ctx.input.tooltip ?? {};
  const common = {
    id: series.key,
    name: series.name,
    stack: series.stack,
    [ctx.horizontal ? 'xAxisIndex' : 'yAxisIndex']: series.yAxisIndex ?? 0,
    // Always set, so a re-render that drops the formatter clears the old one.
    tooltip: valueFormatter
      ? {
          valueFormatter: (value: number | string) =>
            valueFormatter(value, series.key),
        }
      : undefined,
  };

  return mergeOption(
    { ...common, ...body } as CartesianSeriesOption,
    series.seriesOption
  );
};

const valueAxes = (
  theme: ChartTheme,
  yAxis: CartesianBuildInput<object>['yAxis'],
  horizontal: boolean
): YAXisComponentOption[] => {
  const props: ChartYAxisProps[] = Array.isArray(yAxis) ? yAxis : [yAxis ?? {}];

  return props.map((axis, index) =>
    valueAxis(theme, axis, horizontal ? 'bottom' : index ? 'right' : 'left')
  );
};

export const REFERENCE_SERIES_ID = '__reference-lines';

/**
 * Reference lines ride on their own empty series on the first axes. On a data
 * series they would vanish when the user hides that series through the
 * legend, and would be measured against that series' axis. Not listed in the
 * legend, so it cannot be toggled.
 */
const referenceSeries = <T extends object>(
  input: CartesianBuildInput<T>,
  theme: ChartTheme
): LineSeriesOption[] =>
  input.referenceLines?.length
    ? [
        {
          id: REFERENCE_SERIES_ID,
          type: 'line',
          data: [],
          silent: true,
          xAxisIndex: 0,
          yAxisIndex: 0,
          tooltip: { show: false },
          markLine: referenceLinesToMarkLine(input.referenceLines, theme),
        },
      ]
    : [];

// Lines are drawn after bars so they sit on top in a composed chart.
const linesLast = (series: CartesianSeriesOption[]) =>
  [...series].sort(
    (a, b) => Number(a.type === 'line') - Number(b.type === 'line')
  );

/**
 * Builds the ECharts option for a line, area, bar or composed chart.
 * `defaultType` is the type of a series that does not set its own — only a
 * composed chart lets series choose.
 */
export const buildCartesianOption = <T extends object>(
  input: CartesianBuildInput<T>,
  theme: ChartTheme,
  defaultType: ChartSeriesType,
  composed = false
): ChartOption => {
  const isTime = input.xAxis?.type === 'time';
  const horizontal = input.layout === 'horizontal';
  const ctx: SeriesContext<T> = { input, theme, isTime, horizontal, composed };
  const built = input.series.map((series, index) =>
    buildSeries(
      ctx,
      series,
      index,
      composed ? series.type ?? defaultType : defaultType
    )
  );
  const series = [
    ...(composed ? linesLast(built) : built),
    ...referenceSeries(input, theme),
  ];
  const names = input.series.map((s) => s.name);
  const legend = legendConfig(names, theme, input.legend);
  const visiblePoints = input.zoomVisiblePoints ?? DATAZOOM_THRESHOLD;
  const hasZoom =
    input.zoom === true ||
    (input.zoom === 'auto' && input.data.length > visiblePoints);
  const categories = isTime
    ? undefined
    : input.data.map((datum) => String((datum as Datum)[input.xKey]));
  const axis = categoryAxis(categories, theme, input.xAxis, horizontal);
  const category = input.categoryClickable
    ? { ...axis, triggerEvent: true }
    : axis;
  const values = valueAxes(theme, input.yAxis, horizontal);
  const valueSlot = values.length === 1 ? values[0] : values;
  const layout = { legend, horizontal };

  const option: ChartOption = {
    aria: {
      enabled: true,
      label: { description: `${input.ariaLabel}. ${names.join(', ')}` },
    },
    grid: gridFor({ ...layout, hasZoom }),
    tooltip: {
      ...tooltipConfig('axis', theme, input.tooltip),
      axisPointer: { type: defaultType === 'bar' ? 'shadow' : 'line' },
    },
    legend,
    xAxis: horizontal
      ? (valueSlot as XAXisComponentOption)
      : (category as XAXisComponentOption),
    yAxis: horizontal
      ? (category as YAXisComponentOption)
      : (valueSlot as YAXisComponentOption),
    ...(hasZoom
      ? { dataZoom: dataZoomFor(input.data.length, layout, visiblePoints) }
      : {}),
    series,
  };

  return mergeOption(option, input.option);
};

export const buildLineOption = <T extends object>(
  input: CartesianBuildInput<T>,
  theme: ChartTheme
) => buildCartesianOption(input, theme, 'line');

export const buildAreaOption = <T extends object>(
  input: CartesianBuildInput<T>,
  theme: ChartTheme
) => buildCartesianOption(input, theme, 'area');

export const buildBarOption = <T extends object>(
  input: CartesianBuildInput<T>,
  theme: ChartTheme
) => buildCartesianOption(input, theme, 'bar');

export const buildComposedOption = <T extends object>(
  input: CartesianBuildInput<T>,
  theme: ChartTheme
) => buildCartesianOption(input, theme, 'line', true);
