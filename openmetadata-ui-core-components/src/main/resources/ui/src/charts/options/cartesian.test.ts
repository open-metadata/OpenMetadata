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
  DataZoomComponentOption,
  LegendComponentOption,
  LineSeriesOption,
  TooltipComponentOption,
  XAXisComponentOption,
  YAXisComponentOption,
} from 'echarts';
import { describe, expect, it } from 'vitest';
import { DARK_CHART_PALETTE, LIGHT_CHART_PALETTE } from '../palette';
import { DARK_CHART_THEME, LIGHT_CHART_THEME } from '../theme';
import type { ChartOption } from '../types';
import {
  buildAreaOption,
  buildBarOption,
  buildComposedOption,
  buildLineOption,
  toNumberOrNull,
} from './cartesian';

interface Row {
  day: string;
  passed: number | null;
  failed?: number | string | null;
}

const rows: Row[] = [
  { day: 'Mon', passed: 3, failed: 1 },
  { day: 'Tue', passed: 5, failed: null },
  { day: 'Wed', passed: 4, failed: 2 },
];

const base = {
  data: rows,
  xKey: 'day' as const,
  ariaLabel: 'Test results',
  series: [
    { key: 'passed', name: 'Passed' },
    { key: 'failed', name: 'Failed' },
  ],
};

const seriesOf = (option: ChartOption) =>
  option.series as Array<LineSeriesOption & BarSeriesOption>;
const xAxisOf = (option: ChartOption) => option.xAxis as XAXisComponentOption;
const yAxesOf = (option: ChartOption) =>
  (Array.isArray(option.yAxis)
    ? option.yAxis
    : [option.yAxis]) as YAXisComponentOption[];

describe('toNumberOrNull', () => {
  it('keeps finite numbers and numeric strings', () => {
    expect(toNumberOrNull(4)).toBe(4);
    expect(toNumberOrNull('2.5')).toBe(2.5);
    expect(toNumberOrNull(0)).toBe(0);
  });

  it('turns missing and non-numeric values into null', () => {
    expect(toNumberOrNull(' ')).toBeNull();
    expect(toNumberOrNull(true)).toBeNull();
    expect(toNumberOrNull([])).toBeNull();
    expect(toNumberOrNull(null)).toBeNull();
    expect(toNumberOrNull(undefined)).toBeNull();
    expect(toNumberOrNull('')).toBeNull();
    expect(toNumberOrNull('abc')).toBeNull();
    expect(toNumberOrNull(Number.NaN)).toBeNull();
  });
});

describe('buildLineOption', () => {
  it('maps rows onto a category x-axis and one series per key', () => {
    const option = buildLineOption(base, LIGHT_CHART_THEME);

    expect(xAxisOf(option)).toMatchObject({
      type: 'category',
      data: ['Mon', 'Tue', 'Wed'],
    });
    expect(seriesOf(option).map((s) => [s.id, s.name, s.type])).toEqual([
      ['passed', 'Passed', 'line'],
      ['failed', 'Failed', 'line'],
    ]);
    expect(seriesOf(option)[0].data).toEqual([3, 5, 4]);
  });

  it('leaves a gap for missing or non-numeric values instead of zero', () => {
    const option = buildLineOption(
      { ...base, data: [...rows, { day: 'Thu', passed: 1, failed: 'n/a' }] },
      LIGHT_CHART_THEME
    );

    expect(seriesOf(option)[1].data).toEqual([1, null, 2, null]);
  });

  it('pairs x and y values on a time axis', () => {
    const option = buildLineOption(
      {
        data: [
          { ts: 1000, value: 1 },
          { ts: 2000, value: 3 },
        ],
        xKey: 'ts',
        ariaLabel: 'Runtime',
        series: [{ key: 'value', name: 'Value' }],
        xAxis: { type: 'time' },
      },
      LIGHT_CHART_THEME
    );

    expect(xAxisOf(option).type).toBe('time');
    expect(xAxisOf(option)).not.toHaveProperty('data');
    expect(seriesOf(option)[0].data).toEqual([
      [1000, 1],
      [2000, 3],
    ]);
  });

  it('cycles palette colours past 15 series and lets a status colour win', () => {
    const series = Array.from({ length: 16 }, (_, i) => ({
      key: `s${i}`,
      name: `S${i}`,
    }));
    series[1] = { ...series[1], status: 'failed' } as (typeof series)[number];
    const option = buildLineOption(
      { data: [], xKey: 'x', ariaLabel: 'Many', series },
      LIGHT_CHART_THEME
    );
    const colors = seriesOf(option).map(
      (s) => (s.itemStyle as { color: string }).color
    );

    expect(colors[0]).toBe(LIGHT_CHART_PALETTE.series[0]);
    expect(colors[1]).toBe(LIGHT_CHART_PALETTE.status.failed);
    expect(colors[15]).toBe(LIGHT_CHART_PALETTE.series[0]);
  });

  it('takes series colours from the dark palette in dark mode', () => {
    const option = buildLineOption(
      {
        data: [],
        xKey: 'x',
        ariaLabel: 'Dark',
        series: [
          { key: 'a', name: 'A' },
          { key: 'b', name: 'B', status: 'success' },
        ],
      },
      DARK_CHART_THEME
    );
    const colors = seriesOf(option).map(
      (s) => (s.itemStyle as { color: string }).color
    );

    expect(colors).toEqual([
      DARK_CHART_PALETTE.series[0],
      DARK_CHART_PALETTE.status.success,
    ]);
  });

  it('uses a series colour override before its status or the palette', () => {
    const option = buildLineOption(
      {
        data: [],
        xKey: 'x',
        ariaLabel: 'Override',
        series: [
          { key: 'a', name: 'A', color: '#123456' },
          { key: 'b', name: 'B', status: 'success', color: '#abcdef' },
          { key: 'c', name: 'C' },
        ],
      },
      LIGHT_CHART_THEME
    );
    const colors = seriesOf(option).map(
      (s) => (s.itemStyle as { color: string }).color
    );

    expect(colors).toEqual([
      '#123456',
      '#abcdef',
      LIGHT_CHART_PALETTE.series[2],
    ]);
  });

  it('sizes the zoom window and the auto threshold from zoomVisiblePoints', () => {
    const many = Array.from({ length: 600 }, (_, i) => ({
      day: `d${i}`,
      passed: i,
    }));
    const zoomed = buildBarOption(
      { ...base, data: many, zoom: 'auto', zoomVisiblePoints: 500 },
      LIGHT_CHART_THEME
    );
    const notZoomed = buildBarOption(
      {
        ...base,
        data: many.slice(0, 500),
        zoom: 'auto',
        zoomVisiblePoints: 500,
      },
      LIGHT_CHART_THEME
    );
    const zooms = zoomed.dataZoom as DataZoomComponentOption[];

    expect(zooms.map((zoom) => zoom.end)).toEqual([
      (500 / 600) * 100,
      (500 / 600) * 100,
    ]);
    expect(notZoomed.dataZoom).toBeUndefined();
  });

  it('lets category labels trigger events only when categoryClickable', () => {
    const clickable = buildBarOption(
      { ...base, layout: 'horizontal', categoryClickable: true },
      LIGHT_CHART_THEME
    );
    const plain = buildBarOption(
      { ...base, layout: 'horizontal' },
      LIGHT_CHART_THEME
    );

    expect(yAxesOf(clickable)[0].triggerEvent).toBe(true);
    expect(yAxesOf(plain)[0].triggerEvent).toBeUndefined();
  });

  it('hides dots and smooths lines unless the series says otherwise', () => {
    const option = buildLineOption(
      {
        ...base,
        series: [
          { key: 'passed', name: 'Passed' },
          { key: 'failed', name: 'Failed', smooth: false, showDots: true },
        ],
      },
      LIGHT_CHART_THEME
    );
    const [first, second] = seriesOf(option);

    expect([first.smooth, first.showSymbol]).toEqual([true, false]);
    expect([second.smooth, second.showSymbol]).toEqual([false, true]);
  });

  it('shows the legend only when there is more than one series', () => {
    const one = buildLineOption(
      { ...base, series: [base.series[0]] },
      LIGHT_CHART_THEME
    );
    const two = buildLineOption(base, LIGHT_CHART_THEME);

    expect((one.legend as LegendComponentOption).show).toBe(false);
    expect(two.legend as LegendComponentOption).toMatchObject({
      show: true,
      bottom: 0,
      data: ['Passed', 'Failed'],
    });
  });

  it('puts the legend on top when asked', () => {
    const option = buildLineOption(
      { ...base, legend: { position: 'top' } },
      LIGHT_CHART_THEME
    );

    expect(option.legend as LegendComponentOption).toMatchObject({ top: 0 });
  });

  it('binds the series key into a custom tooltip value formatter', () => {
    const option = buildLineOption(
      {
        ...base,
        tooltip: { valueFormatter: (value, key) => `${key}:${value}` },
      },
      LIGHT_CHART_THEME
    );
    const tooltip = seriesOf(option)[1].tooltip as {
      valueFormatter: (v: number) => string;
    };

    expect(tooltip.valueFormatter(7)).toBe('failed:7');
  });

  it('uses the axis label as the axis name and applies axis formatters', () => {
    const option = buildLineOption(
      {
        ...base,
        xAxis: { label: 'Day', formatter: (v) => `d-${v}` },
        yAxis: { label: 'Count', formatter: (v) => `${v}!` },
      },
      LIGHT_CHART_THEME
    );
    const xLabel = xAxisOf(option).axisLabel as {
      formatter: (v: string) => string;
    };
    const yLabel = yAxesOf(option)[0].axisLabel as {
      formatter: (v: number) => string;
    };

    expect(xAxisOf(option).name).toBe('Day');
    expect(yAxesOf(option)[0].name).toBe('Count');
    expect(xLabel.formatter('Mon')).toBe('d-Mon');
    expect(yLabel.formatter(3)).toBe('3!');
  });

  it('formats value ticks with K/M/B suffixes by default', () => {
    const option = buildLineOption(base, LIGHT_CHART_THEME);
    const yLabel = yAxesOf(option)[0].axisLabel as {
      formatter: (v: number) => string;
    };

    expect(yLabel.formatter(2500)).toBe('2.5K');
  });

  it('adds a second value axis for series on yAxisIndex 1', () => {
    const option = buildLineOption(
      {
        ...base,
        series: [
          { key: 'passed', name: 'Passed' },
          { key: 'failed', name: 'Failed', yAxisIndex: 1 },
        ],
        yAxis: [{ label: 'Passed' }, { label: 'Failed' }],
      },
      LIGHT_CHART_THEME
    );
    const axes = yAxesOf(option);

    expect(axes.map((a) => [a.position, a.name])).toEqual([
      ['left', 'Passed'],
      ['right', 'Failed'],
    ]);
    expect(seriesOf(option)[1].yAxisIndex).toBe(1);
  });

  it('draws grid lines from the left axis only when there are two', () => {
    const option = buildLineOption(
      {
        ...base,
        series: [
          { key: 'passed', name: 'Passed' },
          { key: 'failed', name: 'Failed', yAxisIndex: 1 },
        ],
        yAxis: [{}, {}],
      },
      LIGHT_CHART_THEME
    );
    const [left, right] = yAxesOf(option);

    expect(left.splitLine).toMatchObject({ show: true });
    expect(right.splitLine).toMatchObject({ show: false });
  });

  it('draws reference lines on their own hidden series, not a data series', () => {
    const option = buildLineOption(
      {
        ...base,
        referenceLines: [
          { axis: 'y', value: 80, label: 'Target', status: 'failed' },
          { axis: 'x', value: 'Tue' },
        ],
      },
      LIGHT_CHART_THEME
    );
    const all = seriesOf(option);
    const reference = all[all.length - 1];
    const markLine = reference.markLine as {
      symbol: string;
      silent: boolean;
      data: Array<Record<string, unknown>>;
    };

    expect(all).toHaveLength(3);
    expect(reference).toMatchObject({
      id: '__reference-lines',
      type: 'line',
      data: [],
      silent: true,
      xAxisIndex: 0,
      yAxisIndex: 0,
    });
    expect(markLine.symbol).toBe('none');
    expect(markLine.data[0]).toMatchObject({
      yAxis: 80,
      label: { formatter: 'Target' },
      lineStyle: { color: LIGHT_CHART_PALETTE.status.failed, type: 'dashed' },
    });
    expect(markLine.data[1]).toMatchObject({ xAxis: 'Tue' });
    expect(all[0].markLine).toBeUndefined();
    expect((option.legend as LegendComponentOption).data).toEqual([
      'Passed',
      'Failed',
    ]);
  });

  it('measures reference lines against the first value axis in a composed chart', () => {
    const option = buildComposedOption(
      {
        ...base,
        series: [
          { key: 'passed', name: 'Passed', type: 'line' },
          { key: 'failed', name: 'Failed', type: 'bar', yAxisIndex: 1 },
        ],
        yAxis: [{}, {}],
        referenceLines: [{ axis: 'y', value: 4 }],
      },
      LIGHT_CHART_THEME
    );
    const reference = seriesOf(option).find(
      (s) => s.id === '__reference-lines'
    );

    expect(reference?.yAxisIndex).toBe(0);
  });

  it("turns on zoom with 'auto' only above 15 points", () => {
    const make = (count: number) =>
      buildLineOption(
        {
          ...base,
          data: Array.from({ length: count }, (_, i) => ({
            day: `d${i}`,
            passed: i,
          })),
          zoom: 'auto',
        },
        LIGHT_CHART_THEME
      );

    expect(make(15).dataZoom).toBeUndefined();
    expect(make(16).dataZoom as DataZoomComponentOption[]).toHaveLength(2);
  });

  it('turns zoom on for any size when zoom is true, off by default', () => {
    expect(
      buildLineOption({ ...base, zoom: true }, LIGHT_CHART_THEME).dataZoom
    ).toBeDefined();
    expect(buildLineOption(base, LIGHT_CHART_THEME).dataZoom).toBeUndefined();
  });

  it('merges a per-series seriesOption into that series only', () => {
    const option = buildLineOption(
      {
        ...base,
        series: [
          { key: 'passed', name: 'Passed', seriesOption: { step: 'end' } },
          { key: 'failed', name: 'Failed' },
        ],
      },
      LIGHT_CHART_THEME
    );

    expect(seriesOf(option)[0].step).toBe('end');
    expect(seriesOf(option)[1].step).toBeUndefined();
  });

  it('merges the option override last, replacing arrays', () => {
    const option = buildLineOption(
      {
        ...base,
        option: {
          grid: { top: 99 },
          legend: { data: ['Only'] },
        },
      },
      LIGHT_CHART_THEME
    );

    expect(option.grid).toMatchObject({ top: 99, left: 8 });
    expect((option.legend as LegendComponentOption).data).toEqual(['Only']);
  });

  it('paints axes, grid and tooltip with the dark theme', () => {
    const option = buildLineOption(base, DARK_CHART_THEME);
    const tooltip = option.tooltip as TooltipComponentOption;
    const yAxis = yAxesOf(option)[0];

    expect(tooltip.backgroundColor).toBe(DARK_CHART_THEME.tooltipBg);
    expect(tooltip.borderColor).toBe(DARK_CHART_THEME.tooltipBorder);
    expect(yAxis.splitLine).toMatchObject({
      lineStyle: { color: DARK_CHART_THEME.grid },
    });
    expect((yAxis.axisLabel as { color: string }).color).toBe(
      DARK_CHART_THEME.axisTick
    );
  });

  it('attaches the tooltip to the body with the default value formatter', () => {
    const tooltip = buildLineOption(base, LIGHT_CHART_THEME)
      .tooltip as TooltipComponentOption & {
      valueFormatter: (v: number) => string;
    };

    expect(tooltip.trigger).toBe('axis');
    expect(tooltip.appendTo).toBe('body');
    expect(tooltip.valueFormatter(1.23456)).toBe('1.23');
  });

  it('describes the chart for screen readers with its series names', () => {
    const option = buildLineOption(base, LIGHT_CHART_THEME);

    expect(option.aria).toEqual({
      enabled: true,
      label: { description: 'Test results. Passed, Failed' },
    });
  });
});

describe('buildAreaOption', () => {
  it('fills each line with a fading gradient of its colour', () => {
    const option = buildAreaOption(base, LIGHT_CHART_THEME);
    const area = seriesOf(option)[0].areaStyle as {
      color: { colorStops: Array<{ color: string }> };
    };

    expect(seriesOf(option)[0].type).toBe('line');
    expect(area.color.colorStops.map((s) => s.color)).toEqual([
      'rgba(21, 112, 239, 0.2)',
      'rgba(21, 112, 239, 0)',
    ]);
  });

  it('stacks series that share a stack id', () => {
    const option = buildAreaOption(
      {
        ...base,
        series: [
          { key: 'passed', name: 'Passed', stack: 'total' },
          { key: 'failed', name: 'Failed', stack: 'total' },
        ],
      },
      LIGHT_CHART_THEME
    );

    expect(seriesOf(option).map((s) => s.stack)).toEqual(['total', 'total']);
  });
});

describe('buildBarOption', () => {
  it('builds rounded bars with a max width', () => {
    const option = buildBarOption(base, LIGHT_CHART_THEME);
    const bar = seriesOf(option)[0];

    expect(bar.type).toBe('bar');
    expect(bar.barMaxWidth).toBe(60);
    expect((bar.itemStyle as { borderRadius: number[] }).borderRadius).toEqual([
      4, 4, 0, 0,
    ]);
  });

  it('squares stacked bars unless a radius is given', () => {
    const stacked = buildBarOption(
      {
        ...base,
        series: [{ key: 'passed', name: 'Passed', stack: 'a' }],
      },
      LIGHT_CHART_THEME
    );
    const rounded = buildBarOption(
      {
        ...base,
        radius: 2,
        series: [{ key: 'passed', name: 'Passed', stack: 'a' }],
      },
      LIGHT_CHART_THEME
    );
    const radiusOf = (o: ChartOption) =>
      (seriesOf(o)[0].itemStyle as { borderRadius: number[] }).borderRadius;

    expect(radiusOf(stacked)).toEqual([0, 0, 0, 0]);
    expect(radiusOf(rounded)).toEqual([2, 2, 0, 0]);
  });

  it('swaps the axes for a horizontal layout', () => {
    const option = buildBarOption(
      { ...base, layout: 'horizontal' },
      LIGHT_CHART_THEME
    );
    const xAxes = (
      Array.isArray(option.xAxis) ? option.xAxis : [option.xAxis]
    ) as XAXisComponentOption[];

    expect(xAxes[0].type).toBe('value');
    // inverse puts the first row at the top, as a ranked list reads.
    expect(yAxesOf(option)[0]).toMatchObject({
      type: 'category',
      data: ['Mon', 'Tue', 'Wed'],
      inverse: true,
    });
    expect(
      (seriesOf(option)[0].itemStyle as { borderRadius: number[] }).borderRadius
    ).toEqual([0, 4, 4, 0]);
  });

  it('colours each bar from getBarStatus', () => {
    const option = buildBarOption(
      {
        ...base,
        series: [base.series[0]],
        getBarStatus: (row: Row) => (row.passed === 5 ? 'success' : undefined),
      },
      LIGHT_CHART_THEME
    );

    expect(seriesOf(option)[0].data).toEqual([
      3,
      { value: 5, itemStyle: { color: LIGHT_CHART_PALETTE.status.success } },
      4,
    ]);
  });

  it('shows value labels above vertical bars and beside horizontal ones', () => {
    const vertical = buildBarOption(
      { ...base, showValueLabels: true },
      LIGHT_CHART_THEME
    );
    const horizontal = buildBarOption(
      {
        ...base,
        layout: 'horizontal',
        showValueLabels: (p) => `${p.value}%`,
      },
      LIGHT_CHART_THEME
    );
    const hLabel = seriesOf(horizontal)[0].label as {
      position: string;
      formatter: (p: { value: number }) => string;
    };

    expect(seriesOf(vertical)[0].label).toMatchObject({
      show: true,
      position: 'top',
    });
    expect(hLabel.position).toBe('right');
    expect(hLabel.formatter({ value: 12 })).toBe('12%');
  });
});

describe('buildComposedOption', () => {
  it('uses each series type and draws lines above bars', () => {
    const option = buildComposedOption(
      {
        ...base,
        series: [
          { key: 'failed', name: 'Failed', type: 'line' },
          { key: 'passed', name: 'Passed', type: 'bar' },
        ],
      },
      LIGHT_CHART_THEME
    );

    expect(seriesOf(option).map((s) => [s.type, s.z])).toEqual([
      ['bar', 1],
      ['line', 3],
    ]);
  });

  it('defaults a series without a type to line and supports area', () => {
    const option = buildComposedOption(
      {
        ...base,
        series: [
          { key: 'passed', name: 'Passed', type: 'area' },
          { key: 'failed', name: 'Failed' },
        ],
      },
      LIGHT_CHART_THEME
    );

    expect(seriesOf(option).map((s) => s.type)).toEqual(['line', 'line']);
    expect(seriesOf(option)[0].areaStyle).toBeDefined();
    expect(seriesOf(option)[1].areaStyle).toBeUndefined();
  });
});
