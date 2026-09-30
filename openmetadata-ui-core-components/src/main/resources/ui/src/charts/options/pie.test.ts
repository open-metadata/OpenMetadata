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
  LegendComponentOption,
  PieSeriesOption,
  TooltipComponentOption,
} from 'echarts';
import { describe, expect, it } from 'vitest';
import { CHART_PALETTE } from '../palette';
import { DARK_CHART_THEME, LIGHT_CHART_THEME } from '../theme';
import type { ChartOption, PieDatum } from '../types';
import { buildPieOption, isPieEmpty } from './pie';

const data: PieDatum[] = [
  { name: 'Success', value: 6, color: '#00aa00' },
  { name: 'Failed', value: 3 },
  { name: 'Aborted', value: 1 },
];

const base = { data, ariaLabel: 'Test status' };

const pieOf = (option: ChartOption) => (option.series as PieSeriesOption[])[0];

describe('buildPieOption', () => {
  it('builds one slice per datum with explicit or palette colours', () => {
    const slices = pieOf(buildPieOption(base, LIGHT_CHART_THEME))
      .data as Array<{ name: string; value: number; itemStyle: object }>;

    expect(slices).toEqual([
      { name: 'Success', value: 6, itemStyle: { color: '#00aa00' } },
      { name: 'Failed', value: 3, itemStyle: { color: CHART_PALETTE[1] } },
      { name: 'Aborted', value: 1, itemStyle: { color: CHART_PALETTE[2] } },
    ]);
  });

  it('is a full pie by default and a donut with innerRadius', () => {
    expect(pieOf(buildPieOption(base, LIGHT_CHART_THEME)).radius).toEqual([
      0,
      '72%',
    ]);
    expect(
      pieOf(buildPieOption({ ...base, innerRadius: '55%' }, LIGHT_CHART_THEME))
        .radius
    ).toEqual(['55%', '72%']);
  });

  it('shows whole-percent slice labels only when asked', () => {
    const hidden = pieOf(buildPieOption(base, LIGHT_CHART_THEME));
    const shown = pieOf(
      buildPieOption({ ...base, showLabels: true }, LIGHT_CHART_THEME)
    );
    const label = shown.label as {
      show: boolean;
      formatter: (p: { percent: number }) => string;
    };

    expect(hidden.label).toEqual({ show: false });
    expect(hidden.labelLine).toEqual({ show: false });
    expect(label.show).toBe(true);
    expect(label.formatter({ percent: 33.4 })).toBe('33%');
  });

  it('lists slice names in a legend shown by default', () => {
    const legend = buildPieOption(base, LIGHT_CHART_THEME)
      .legend as LegendComponentOption;

    expect(legend).toMatchObject({
      show: true,
      bottom: 0,
      data: ['Success', 'Failed', 'Aborted'],
    });
    expect(
      (
        buildPieOption({ ...base, legend: { show: false } }, LIGHT_CHART_THEME)
          .legend as LegendComponentOption
      ).show
    ).toBe(false);
  });

  it('uses an item tooltip', () => {
    const tooltip = buildPieOption(base, LIGHT_CHART_THEME)
      .tooltip as TooltipComponentOption;

    expect(tooltip.trigger).toBe('item');
  });

  it('separates slices with the theme segment border', () => {
    const border = (theme: typeof LIGHT_CHART_THEME) =>
      (pieOf(buildPieOption(base, theme)).itemStyle as { borderColor: string })
        .borderColor;

    expect(border(LIGHT_CHART_THEME)).toBe('#ffffff');
    expect(border(DARK_CHART_THEME)).toBe('#0c0e12');
  });

  it('describes the chart with its slice names', () => {
    expect(buildPieOption(base, LIGHT_CHART_THEME).aria).toEqual({
      enabled: true,
      label: { description: 'Test status. Success, Failed, Aborted' },
    });
  });

  it('merges the option override last', () => {
    const option = buildPieOption(
      { ...base, option: { legend: { top: 4 } } },
      LIGHT_CHART_THEME
    );

    expect(option.legend).toMatchObject({ top: 4, bottom: 0 });
  });
});

describe('isPieEmpty', () => {
  it('is empty with no slices', () => {
    expect(isPieEmpty([])).toBe(true);
  });

  it('is empty when every slice is zero', () => {
    expect(
      isPieEmpty([
        { name: 'A', value: 0 },
        { name: 'B', value: 0 },
      ])
    ).toBe(true);
  });

  it('is not empty when any slice has a value', () => {
    expect(
      isPieEmpty([
        { name: 'A', value: 0 },
        { name: 'B', value: 2 },
      ])
    ).toBe(false);
  });
});
