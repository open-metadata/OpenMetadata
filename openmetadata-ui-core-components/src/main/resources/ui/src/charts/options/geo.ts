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
import type { MapSeriesOption, VisualMapComponentOption } from 'echarts';
import { CHART_PALETTE } from '../palette';
import type {
  ChartOption,
  ChartTheme,
  GeoMapBuildInput,
  GeoMapDatum,
} from '../types';
import { tooltipConfig } from './common';
import { mergeOption } from './merge';

/** Default scale: light blue → the primary palette colour. */
export const GEO_COLOR_RANGE: readonly string[] = [
  '#e3edfd',
  '#93b8f9',
  CHART_PALETTE[0],
];

// Room under the map for the scale bar (24px) plus its end labels above it.
const SCALE_BAND = 76;
const SCALE_THICKNESS = 24;
const SCALE_LENGTH = 220;

export interface ResolvedGeoData {
  /** One entry per GeoJSON feature, values summed across rows. */
  data: Array<{ name: string; value: number }>;
  /** Raw region values that resolved to no feature, each listed once. */
  unmatched: string[];
}

const identity = (raw: string) => raw;

/**
 * Resolves raw region values to feature names and sums rows per region: a map
 * shades a region once, so without summing the last row naming it would win.
 * Rows with a blank region or a non-numeric value are skipped.
 */
export const resolveGeoData = (
  rows: GeoMapDatum[],
  resolveRegion: (raw: string) => string | undefined = identity
): ResolvedGeoData => {
  const totals = new Map<string, number>();
  const unmatched: string[] = [];
  for (const { region, value } of rows) {
    const raw = String(region ?? '');
    const usable = raw.trim() !== '' && Number.isFinite(value);
    const name = usable ? resolveRegion(raw) : undefined;
    if (usable && name === undefined && !unmatched.includes(raw)) {
      unmatched.push(raw);
    }
    if (name !== undefined) {
      totals.set(name, (totals.get(name) ?? 0) + value);
    }
  }

  return {
    data: Array.from(totals, ([name, value]) => ({ name, value })),
    unmatched,
  };
};

// The data's own extent, not clamped to 0, so close values still read as
// different shades. A zero-width domain is widened so the scale still works.
const scaleDomain = (values: number[]) => {
  if (!values.length) {
    return { min: 0, max: 1 };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);

  return min === max ? { min: min - 1, max: max + 1 } : { min, max };
};

/**
 * Builds a choropleth over a map the caller registered under `mapName`.
 * Returns the raw region values that matched no feature next to the option.
 */
export const buildGeoMapOption = (
  input: GeoMapBuildInput,
  theme: ChartTheme
): { option: ChartOption; unmatched: string[] } => {
  const { data, unmatched } = resolveGeoData(input.data, input.resolveRegion);
  const showScale = input.showScale ?? true;
  const visualMap: VisualMapComponentOption = {
    type: 'continuous',
    ...scaleDomain(data.map((point) => point.value)),
    show: showScale,
    calculable: true,
    orient: 'horizontal',
    left: 'center',
    bottom: 8,
    // Horizontal orientation rotates the bar, so itemHeight is its length.
    itemWidth: SCALE_THICKNESS,
    itemHeight: SCALE_LENGTH,
    textStyle: { color: theme.axisText },
    inRange: { color: [...(input.colorRange ?? GEO_COLOR_RANGE)] },
  };
  const series: MapSeriesOption = {
    type: 'map',
    id: 'geo-map',
    map: input.mapName,
    roam: false,
    // Clicks go to onRegionClick; a sticky selection would hide the shade.
    selectedMode: false,
    // Fit the map across the whole box, reserving a band for the scale.
    left: 0,
    right: 0,
    top: 0,
    bottom: showScale ? SCALE_BAND : 0,
    data,
    itemStyle: {
      areaColor: theme.emptyFill,
      borderColor: theme.segmentBorder,
      borderWidth: 0.5,
    },
    emphasis: { label: { show: true } },
    label: { show: false },
  };

  const option: ChartOption = {
    aria: {
      enabled: true,
      label: {
        description: `${input.ariaLabel}. ${data
          .map((point) => point.name)
          .join(', ')}`,
      },
    },
    tooltip: tooltipConfig('item', theme, input.tooltip),
    visualMap,
    series: [series],
  };

  return { option: mergeOption(option, input.option), unmatched };
};
