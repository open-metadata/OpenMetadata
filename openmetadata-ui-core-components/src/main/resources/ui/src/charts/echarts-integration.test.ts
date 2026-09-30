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
import { BarChart, LineChart, MapChart } from 'echarts/charts';
import {
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildBarOption,
  buildComposedOption,
  buildLineOption,
} from './options/cartesian';
import { applyZoomWindow } from './options/common';
import { buildGeoMapOption } from './options/geo';
import { REPLACE_MERGE_KEYS } from './options/merge';
import { LIGHT_CHART_THEME } from './theme';
import type { CartesianBuildInput, ChartOption, GeoJson } from './types';

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
  MapChart,
  VisualMapComponent,
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

describe('geo map on a real chart', () => {
  const square = (name: string, x: number): GeoJson['features'][number] => ({
    type: 'Feature',
    properties: { name },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [x, 0],
          [x + 1, 0],
          [x + 1, 1],
          [x, 1],
          [x, 0],
        ],
      ],
    },
  });

  it('shades the regions of a caller-registered map', () => {
    echarts.registerMap('integration-squares', {
      type: 'FeatureCollection',
      features: [square('Alpha', 0), square('Beta', 2)],
    } as Parameters<typeof echarts.registerMap>[1]);
    const { option } = buildGeoMapOption(
      {
        ariaLabel: 'Squares',
        mapName: 'integration-squares',
        data: [
          { region: 'Alpha', value: 1 },
          { region: 'Beta', value: 9 },
        ],
      },
      LIGHT_CHART_THEME
    );
    const svg = mount(option).renderToSVGString();

    // Lowest value → first colour of the range, highest → the last.
    expect(svg).toContain('fill="rgb(227,237,253)"');
    expect(svg).toContain('fill="rgb(21,112,239)"');
  });

  const geoInput = (option?: ChartOption) => ({
    ariaLabel: 'Squares',
    mapName: 'integration-squares-2',
    data: [
      { region: 'Alpha', value: 1 },
      { region: 'Beta', value: 9 },
    ],
    option,
  });

  it('drops a visualMap override the caller removed', () => {
    echarts.registerMap('integration-squares-2', {
      type: 'FeatureCollection',
      features: [square('Alpha', 0), square('Beta', 2)],
    } as Parameters<typeof echarts.registerMap>[1]);
    const chart = mount(
      buildGeoMapOption(
        geoInput({ visualMap: { text: ['High', 'Low'] } }),
        LIGHT_CHART_THEME
      ).option
    );
    chart.setOption(
      buildGeoMapOption(geoInput(), LIGHT_CHART_THEME).option,
      MERGE
    );
    const model = chart.getOption() as {
      visualMap: Array<{ text?: string[] }>;
    };

    expect(model.visualMap[0].text).toBeFalsy();
  });

  it('removes the colour scale when the same chart switches to bars', () => {
    const chart = mount(
      buildGeoMapOption(geoInput(), LIGHT_CHART_THEME).option
    );
    chart.setOption(
      buildBarOption(
        {
          data: [{ day: 'Mon', a: 3 }],
          xKey: 'day',
          ariaLabel: 'Bars',
          series: [{ key: 'a', name: 'A' }],
        },
        LIGHT_CHART_THEME
      ),
      MERGE
    );

    expect(
      (chart.getOption() as { visualMap?: unknown[] }).visualMap ?? []
    ).toHaveLength(0);
  });
});
