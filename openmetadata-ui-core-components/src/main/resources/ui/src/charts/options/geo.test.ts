/*
 *  Copyright 2025 Collate.
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
  MapSeriesOption,
  TooltipComponentOption,
  VisualMapComponentOption,
} from 'echarts';
import { describe, expect, it } from 'vitest';
import { DARK_CHART_THEME, LIGHT_CHART_THEME } from '../theme';
import type { GeoMapBuildInput } from '../types';
import { buildGeoMapOption, GEO_COLOR_RANGE, resolveGeoData } from './geo';

const ALIASES: Record<string, string> = {
  CA: 'California',
  TX: 'Texas',
};
const resolveAlias = (raw: string) => ALIASES[raw] ?? undefined;

const base: GeoMapBuildInput = {
  ariaLabel: 'Revenue by state',
  mapName: 'USA#abc',
  data: [
    { region: 'California', value: 10 },
    { region: 'Texas', value: 4 },
  ],
};

const mapOf = (input: GeoMapBuildInput, theme = LIGHT_CHART_THEME) =>
  (buildGeoMapOption(input, theme).option.series as MapSeriesOption[])[0];
const scaleOf = (input: GeoMapBuildInput) =>
  buildGeoMapOption(input, LIGHT_CHART_THEME).option
    .visualMap as VisualMapComponentOption & {
    min: number;
    max: number;
    show: boolean;
    inRange: { color: string[] };
  };

describe('resolveGeoData', () => {
  it('uses the raw region as the feature name by default', () => {
    expect(resolveGeoData(base.data).data).toEqual([
      { name: 'California', value: 10 },
      { name: 'Texas', value: 4 },
    ]);
  });

  it('resolves raw values through resolveRegion', () => {
    const { data } = resolveGeoData(
      [
        { region: 'CA', value: 3 },
        { region: 'TX', value: 1 },
      ],
      resolveAlias
    );

    expect(data).toEqual([
      { name: 'California', value: 3 },
      { name: 'Texas', value: 1 },
    ]);
  });

  it('sums rows that resolve to the same region', () => {
    const { data } = resolveGeoData(
      [
        { region: 'CA', value: 3 },
        { region: 'California', value: 2 },
      ],
      (raw) => resolveAlias(raw) ?? raw
    );

    expect(data).toEqual([{ name: 'California', value: 5 }]);
  });

  it('skips blank regions and non-numeric values', () => {
    const { data, unmatched } = resolveGeoData([
      { region: ' ', value: 3 },
      { region: 'Texas', value: Number.NaN },
      { region: 'California', value: 1 },
    ]);

    expect(data).toEqual([{ name: 'California', value: 1 }]);
    expect(unmatched).toEqual([]);
  });

  it('collects each unmatched raw value once', () => {
    const { unmatched } = resolveGeoData(
      [
        { region: 'ZZ', value: 1 },
        { region: 'ZZ', value: 2 },
        { region: 'CA', value: 1 },
        { region: 'Atlantis', value: 1 },
      ],
      resolveAlias
    );

    expect(unmatched).toEqual(['ZZ', 'Atlantis']);
  });
});

describe('buildGeoMapOption', () => {
  it('draws a map series on the registered map with the resolved data', () => {
    const map = mapOf(base);

    expect(map).toMatchObject({
      type: 'map',
      map: 'USA#abc',
      roam: false,
      data: [
        { name: 'California', value: 10 },
        { name: 'Texas', value: 4 },
      ],
    });
  });

  it('returns the unmatched raw values next to the option', () => {
    const { unmatched } = buildGeoMapOption(
      {
        ...base,
        data: [{ region: 'ZZ', value: 1 }],
        resolveRegion: resolveAlias,
      },
      LIGHT_CHART_THEME
    );

    expect(unmatched).toEqual(['ZZ']);
  });

  it("spans the colour scale over the data's own range", () => {
    const scale = scaleOf(base);

    expect([scale.min, scale.max]).toEqual([4, 10]);
    expect(scale.inRange.color).toEqual([...GEO_COLOR_RANGE]);
  });

  it('widens the scale by one either side when every value is equal', () => {
    const scale = scaleOf({
      ...base,
      data: [
        { region: 'California', value: 5 },
        { region: 'Texas', value: 5 },
      ],
    });

    expect([scale.min, scale.max]).toEqual([4, 6]);
  });

  it('uses a custom colour range', () => {
    expect(
      scaleOf({ ...base, colorRange: ['#fff', '#000'] }).inRange.color
    ).toEqual(['#fff', '#000']);
  });

  it('hides the scale and its bottom band when showScale is false', () => {
    const hidden = { ...base, showScale: false };

    expect(scaleOf(hidden).show).toBe(false);
    expect(mapOf(hidden).bottom).toBe(0);
    expect(mapOf(base).bottom).toBeGreaterThan(0);
  });

  it('fills regions without data and draws borders from the theme', () => {
    expect(mapOf(base, LIGHT_CHART_THEME).itemStyle).toMatchObject({
      areaColor: LIGHT_CHART_THEME.emptyFill,
      borderColor: LIGHT_CHART_THEME.segmentBorder,
    });
    expect(mapOf(base, DARK_CHART_THEME).itemStyle).toMatchObject({
      areaColor: DARK_CHART_THEME.emptyFill,
      borderColor: DARK_CHART_THEME.segmentBorder,
    });
  });

  it('uses an item tooltip', () => {
    const tooltip = buildGeoMapOption(base, LIGHT_CHART_THEME).option
      .tooltip as TooltipComponentOption;

    expect(tooltip.trigger).toBe('item');
  });

  it('describes the chart with the regions it shades', () => {
    expect(buildGeoMapOption(base, LIGHT_CHART_THEME).option.aria).toEqual({
      enabled: true,
      label: { description: 'Revenue by state. California, Texas' },
    });
  });

  it('merges the option override last', () => {
    const option = buildGeoMapOption(
      { ...base, option: { visualMap: { left: 'right' } } },
      LIGHT_CHART_THEME
    ).option;

    expect(option.visualMap).toMatchObject({ left: 'right', min: 4 });
  });
});
