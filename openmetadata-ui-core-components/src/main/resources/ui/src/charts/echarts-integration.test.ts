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

// @vitest-environment node
import { BarChart, LineChart } from 'echarts/charts';
import {
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import { afterEach, describe, expect, it } from 'vitest';
import { buildComposedOption, buildLineOption } from './options/cartesian';
import { applyZoomWindow } from './options/common';
import { REPLACE_MERGE_KEYS } from './options/merge';
import { LIGHT_CHART_THEME } from './theme';
import type { CartesianBuildInput, ChartOption } from './types';

// These run the builders against a real (server-side) ECharts instance with
// the same merge policy EChart uses, so re-render behaviour is checked on
// ECharts itself rather than on the props handed to a mock.
echarts.use([
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkLineComponent,
  AriaComponent,
  SVGRenderer,
]);

const MERGE = { notMerge: false, replaceMerge: REPLACE_MERGE_KEYS };

interface Row {
  day: string;
  a: number;
  b: number;
}

const rows: Row[] = Array.from({ length: 40 }, (_, i) => ({
  day: `d${i}`,
  a: i,
  b: i * 2,
}));

const input = (
  extra: Partial<CartesianBuildInput<Row>> = {}
): CartesianBuildInput<Row> => ({
  data: rows,
  xKey: 'day',
  ariaLabel: 'Chart',
  series: [
    { key: 'a', name: 'A' },
    { key: 'b', name: 'B' },
  ],
  ...extra,
});

const charts: echarts.ECharts[] = [];

const mount = (option: ChartOption) => {
  const chart = echarts.init(null as unknown as HTMLElement, null, {
    renderer: 'svg',
    ssr: true,
    width: 600,
    height: 300,
  });
  charts.push(chart);
  chart.setOption(option, MERGE);

  return chart;
};

type Model = {
  series: Array<Record<string, unknown>>;
  dataZoom?: Array<{ start: number; end: number }>;
  legend: Array<{ selected: Record<string, boolean> }>;
};
const modelOf = (chart: echarts.ECharts) => chart.getOption() as Model;

afterEach(() => {
  charts.splice(0).forEach((chart) => chart.dispose());
});

describe('reference lines on a real chart', () => {
  it('stay drawn when the user hides the first series', () => {
    const chart = mount(
      buildLineOption(
        input({ referenceLines: [{ axis: 'y', value: 10, label: 'LIMIT' }] }),
        LIGHT_CHART_THEME
      )
    );
    chart.dispatchAction({ type: 'legendUnSelect', name: 'A' });

    expect(chart.renderToSVGString()).toContain('LIMIT');
  });

  it('disappear when the caller removes them', () => {
    const chart = mount(
      buildLineOption(
        input({ referenceLines: [{ axis: 'y', value: 10, label: 'LIMIT' }] }),
        LIGHT_CHART_THEME
      )
    );
    chart.setOption(buildLineOption(input(), LIGHT_CHART_THEME), MERGE);

    expect(chart.renderToSVGString()).not.toContain('LIMIT');
  });
});

describe('re-rendering with changed series settings', () => {
  it('drops the area fill when a composed series turns into a line', () => {
    const chart = mount(
      buildComposedOption(
        input({ series: [{ key: 'a', name: 'A', type: 'area' }] }),
        LIGHT_CHART_THEME
      )
    );
    chart.setOption(
      buildComposedOption(
        input({ series: [{ key: 'a', name: 'A', type: 'line' }] }),
        LIGHT_CHART_THEME
      ),
      MERGE
    );

    expect(modelOf(chart).series[0].areaStyle).toBeFalsy();
  });

  it('drops a custom tooltip formatter the caller removed', () => {
    const chart = mount(
      buildLineOption(
        input({ tooltip: { valueFormatter: (v) => `${v}%` } }),
        LIGHT_CHART_THEME
      )
    );
    chart.setOption(buildLineOption(input(), LIGHT_CHART_THEME), MERGE);

    expect(modelOf(chart).series[0].tooltip).toBeFalsy();
  });

  it('keeps the series the user hid through the legend', () => {
    const chart = mount(buildLineOption(input(), LIGHT_CHART_THEME));
    chart.dispatchAction({ type: 'legendUnSelect', name: 'B' });
    chart.setOption(buildLineOption(input(), LIGHT_CHART_THEME), MERGE);

    expect(modelOf(chart).legend[0].selected).toMatchObject({ B: false });
  });
});

describe('zoom window on a real chart', () => {
  it('survives a re-render when the current window is re-applied', () => {
    const chart = mount(
      buildLineOption(input({ zoom: true }), LIGHT_CHART_THEME)
    );
    chart.dispatchAction({ type: 'dataZoom', start: 50, end: 80 });
    const [{ start, end }] = modelOf(chart).dataZoom ?? [];
    chart.setOption(
      applyZoomWindow(
        buildLineOption(input({ zoom: true }), LIGHT_CHART_THEME),
        {
          start,
          end,
        }
      ),
      MERGE
    );

    expect(modelOf(chart).dataZoom?.[0]).toMatchObject({ start: 50, end: 80 });
  });
});
