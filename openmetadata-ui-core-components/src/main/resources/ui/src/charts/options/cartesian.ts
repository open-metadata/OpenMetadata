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
import { getSeriesColor } from '../palette';
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
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const n = typeof value === 'number' ? value : Number(value);

  return Number.isFinite(n) ? n : null;
};

interface SeriesContext<T extends object> {
  input: CartesianBuildInput<T>;
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
      const barColor = input.getBarColor?.(datum, index);

      return barColor ? { value, itemStyle: { color: barColor } } : value;
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
  ...(filled ? { areaStyle: { color: areaGradient(color) } } : {}),
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
  const color = series.color ?? getSeriesColor(index);
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
    ...(valueFormatter
      ? {
          tooltip: {
            valueFormatter: (value: number | string) =>
              valueFormatter(value, series.key),
          },
        }
      : {}),
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

const withReferenceLines = <T extends object>(
  series: CartesianSeriesOption[],
  input: CartesianBuildInput<T>,
  theme: ChartTheme
): CartesianSeriesOption[] => {
  if (!input.referenceLines?.length || !series.length) {
    return series;
  }
  const [first, ...rest] = series;

  return [
    {
      ...first,
      markLine: referenceLinesToMarkLine(input.referenceLines, theme),
    } as CartesianSeriesOption,
    ...rest,
  ];
};

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
  const ctx: SeriesContext<T> = { input, isTime, horizontal, composed };
  const built = input.series.map((series, index) =>
    buildSeries(
      ctx,
      series,
      index,
      composed ? series.type ?? defaultType : defaultType
    )
  );
  const series = withReferenceLines(
    composed ? linesLast(built) : built,
    input,
    theme
  );
  const names = input.series.map((s) => s.name);
  const legend = legendConfig(names, theme, input.legend);
  const hasZoom =
    input.zoom === true ||
    (input.zoom === 'auto' && input.data.length > DATAZOOM_THRESHOLD);
  const categories = isTime
    ? undefined
    : input.data.map((datum) => String((datum as Datum)[input.xKey]));
  const category = categoryAxis(categories, theme, input.xAxis);
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
    ...(hasZoom ? { dataZoom: dataZoomFor(input.data.length, layout) } : {}),
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
