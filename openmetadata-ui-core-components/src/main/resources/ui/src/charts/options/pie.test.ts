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
import { buildPieOption, isPieEmpty, PIE_TRACK_SERIES_ID } from './pie';

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

  it('shows a pointer cursor only on clickable slices', () => {
    expect(pieOf(buildPieOption(base, LIGHT_CHART_THEME)).cursor).toBe(
      'default'
    );
    expect(
      pieOf(buildPieOption({ ...base, clickable: true }, LIGHT_CHART_THEME))
        .cursor
    ).toBe('pointer');
  });

  it('uses a custom outer radius', () => {
    const pie = pieOf(
      buildPieOption(
        { ...base, innerRadius: '60%', outerRadius: '80%' },
        LIGHT_CHART_THEME
      )
    );

    expect(pie.radius).toEqual(['60%', '80%']);
  });

  it('passes minAngle and padAngle to the slices, defaulting to 0', () => {
    const plain = pieOf(buildPieOption(base, LIGHT_CHART_THEME));
    const spaced = pieOf(
      buildPieOption({ ...base, minAngle: 3, padAngle: 1 }, LIGHT_CHART_THEME)
    );

    expect(plain).toMatchObject({ minAngle: 0, padAngle: 0 });
    expect(spaced).toMatchObject({ minAngle: 3, padAngle: 1 });
  });

  it('draws a zero slice as missing so minAngle cannot give it an arc', () => {
    const pie = pieOf(
      buildPieOption(
        {
          ...base,
          minAngle: 3,
          data: [
            { name: 'Success', value: 5 },
            { name: 'Aborted', value: 0 },
          ],
        },
        LIGHT_CHART_THEME
      )
    );

    expect((pie.data as Array<{ value: unknown }>).map((d) => d.value)).toEqual(
      [5, '-']
    );
    expect(pie.stillShowZeroSum).toBe(false);
  });

  it('adds no track series by default', () => {
    expect(buildPieOption(base, LIGHT_CHART_THEME).series).toHaveLength(1);
  });

  it('adds a silent grey track ring behind the slices', () => {
    const series = buildPieOption(
      { ...base, innerRadius: '75%', outerRadius: '100%', track: true },
      DARK_CHART_THEME
    ).series as PieSeriesOption[];
    const track = series[1];

    expect(series[0].id).not.toBe(PIE_TRACK_SERIES_ID);
    expect(track).toMatchObject({
      id: PIE_TRACK_SERIES_ID,
      type: 'pie',
      silent: true,
      z: 1,
      radius: ['75%', '100%'],
      tooltip: { show: false },
      label: { show: false },
    });
    expect(track.data).toEqual([
      { name: '', value: 1, itemStyle: { color: DARK_CHART_THEME.emptyFill } },
    ]);
  });

  it('keeps the track out of the legend', () => {
    const legend = buildPieOption({ ...base, track: true }, LIGHT_CHART_THEME)
      .legend as LegendComponentOption;

    expect(legend.data).toEqual(['Success', 'Failed', 'Aborted']);
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
