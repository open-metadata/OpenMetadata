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
  DataZoomComponentOption,
  GridComponentOption,
  LegendComponentOption,
  MarkLineComponentOption,
  TooltipComponentOption,
  XAXisComponentOption,
  YAXisComponentOption,
} from 'echarts';
import { formatTooltipValue, formatYAxisTick } from '../format';
import type {
  ChartAxisProps,
  ChartLegendProps,
  ChartReferenceLine,
  ChartTheme,
  ChartTooltipProps,
} from '../types';
import { mergeOption } from './merge';

/** Above this many points `zoom: 'auto'` adds a dataZoom window. */
export const DATAZOOM_THRESHOLD = 15;

const SLIDER_HEIGHT = 28;
const SLIDER_GAP = 8;
const LEGEND_BAND = 28;
const TOOLTIP_MAX_HEIGHT = 320;

interface LinearGradient {
  type: 'linear';
  x: number;
  y: number;
  x2: number;
  y2: number;
  colorStops: Array<{ offset: number; color: string }>;
}

/** `#RGB` / `#RRGGBB` → `rgba(r, g, b, alpha)`. */
export const hexToRgba = (hex: string, alpha: number): string => {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const channel = (start: number) =>
    Number.parseInt(full.slice(start, start + 2), 16) || 0;

  return `rgba(${channel(0)}, ${channel(2)}, ${channel(4)}, ${alpha})`;
};

/** Area fill: the series colour at 20% opacity fading to transparent. */
export const areaGradient = (color: string): LinearGradient => ({
  type: 'linear',
  x: 0,
  y: 0,
  x2: 0,
  y2: 1,
  colorStops: [
    { offset: 0, color: hexToRgba(color, 0.2) },
    { offset: 1, color: hexToRgba(color, 0) },
  ],
});

export const tooltipConfig = (
  trigger: 'axis' | 'item',
  theme: ChartTheme,
  props: ChartTooltipProps = {}
): TooltipComponentOption => ({
  show: props.show ?? true,
  trigger,
  // Appended to <body> so a card with `overflow: hidden` cannot clip it.
  appendTo: 'body',
  backgroundColor: theme.tooltipBg,
  borderColor: theme.tooltipBorder,
  textStyle: { color: theme.tooltipText },
  extraCssText: `max-height:${TOOLTIP_MAX_HEIGHT}px;overflow:auto;`,
  valueFormatter: (value) => formatTooltipValue(value),
  ...(props.formatter ? { formatter: props.formatter } : {}),
});

const axisRest = <A>({
  label: _label,
  formatter: _formatter,
  ...rest
}: ChartAxisProps<A> & { type?: unknown }) => {
  const { type: _type, ...withoutType } = rest as Record<string, unknown>;

  return withoutType;
};

export const categoryAxis = (
  categories: string[] | undefined,
  theme: ChartTheme,
  props: ChartAxisProps<XAXisComponentOption> & {
    type?: 'category' | 'time';
  } = {}
): XAXisComponentOption => {
  const isTime = props.type === 'time';
  const base: XAXisComponentOption = {
    type: isTime ? 'time' : 'category',
    ...(isTime ? {} : { data: categories }),
    name: props.label,
    nameLocation: 'middle',
    nameGap: 32,
    nameTextStyle: { color: theme.xAxisTitle, fontSize: 12, fontWeight: 600 },
    axisLabel: {
      color: theme.axisTick,
      hideOverlap: true,
      ...(props.formatter ? { formatter: props.formatter } : {}),
    },
    axisTick: { show: false },
  };

  return mergeOption(base, axisRest(props));
};

export const valueAxis = (
  theme: ChartTheme,
  props: ChartAxisProps<YAXisComponentOption> = {},
  position: 'left' | 'right' | 'bottom' = 'left'
): YAXisComponentOption => {
  const vertical = position !== 'bottom';
  const base = {
    type: 'value',
    position,
    name: props.label,
    nameLocation: 'middle',
    nameGap: vertical ? 44 : 32,
    nameRotate: vertical ? (position === 'left' ? 90 : -90) : 0,
    nameTextStyle: { color: theme.axisTitle, fontSize: 12, fontWeight: 500 },
    axisLabel: {
      color: theme.axisTick,
      formatter: props.formatter ?? ((value: number) => formatYAxisTick(value)),
    },
    splitLine: { show: true, lineStyle: { color: theme.grid } },
  } as YAXisComponentOption;

  return mergeOption(base, axisRest(props));
};

export const legendConfig = (
  names: string[],
  theme: ChartTheme,
  props: ChartLegendProps = {}
): LegendComponentOption => ({
  show: props.show ?? names.length > 1,
  type: 'scroll',
  [props.position ?? 'bottom']: 0,
  data: names,
  textStyle: { color: theme.axisText },
});

export interface GridLayout {
  hasZoom: boolean;
  legend?: LegendComponentOption;
  /** Horizontal bars put the zoom slider on the right edge. */
  horizontal?: boolean;
}

/**
 * Plot area. `outerBoundsMode: 'same'` keeps tick labels and axis names inside
 * the rect — the ECharts 6 replacement for `containLabel`, which needs the
 * legacy module under `echarts/core`. Bands for the legend and zoom slider
 * are reserved outside it so they never overlap the labels.
 */
export const gridFor = ({
  hasZoom,
  legend,
  horizontal,
}: GridLayout): GridComponentOption => {
  const legendShown = Boolean(legend?.show);
  const legendTop = legendShown && legend?.top === 0;
  const legendBottom = legendShown && !legendTop;
  const zoomBand = hasZoom ? SLIDER_HEIGHT + SLIDER_GAP : 0;

  return {
    left: 8,
    right: 16 + (horizontal ? zoomBand : 0),
    top: 16 + (legendTop ? LEGEND_BAND : 0),
    bottom: 8 + (horizontal ? 0 : zoomBand) + (legendBottom ? LEGEND_BAND : 0),
    outerBoundsMode: 'same',
    outerBoundsContain: 'all',
  };
};

export const dataZoomFor = (
  pointCount: number,
  { legend, horizontal }: Omit<GridLayout, 'hasZoom'>
): DataZoomComponentOption[] => {
  const end = Math.min(100, (DATAZOOM_THRESHOLD / pointCount) * 100);
  const legendBottom = Boolean(legend?.show) && legend?.top !== 0;
  const axis = horizontal ? { yAxisIndex: 0 } : { xAxisIndex: 0 };
  const slider = horizontal
    ? { right: SLIDER_GAP, width: SLIDER_HEIGHT }
    : {
        bottom: (legendBottom ? LEGEND_BAND : 0) + SLIDER_GAP,
        height: SLIDER_HEIGHT,
      };

  return [
    { type: 'inside', start: 0, end, ...axis },
    { type: 'slider', start: 0, end, ...axis, ...slider },
  ];
};

export const referenceLinesToMarkLine = (
  lines: ChartReferenceLine[],
  theme: ChartTheme
): MarkLineComponentOption => ({
  symbol: 'none',
  silent: true,
  data: lines.map((line) => ({
    [line.axis === 'x' ? 'xAxis' : 'yAxis']: line.value,
    label: {
      show: Boolean(line.label),
      formatter: line.label,
      position: 'insideEndTop',
      color: theme.axisText,
    },
    lineStyle: {
      color: line.color ?? theme.axisText,
      type: 'dashed',
      width: 1,
    },
  })),
});
