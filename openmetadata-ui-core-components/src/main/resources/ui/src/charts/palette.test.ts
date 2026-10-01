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

import { describe, expect, it } from 'vitest';
import {
  CHART_PALETTE,
  chartColor,
  DARK_CHART_PALETTE,
  getSeriesColor,
  LIGHT_CHART_PALETTE,
} from './palette';

describe('CHART_PALETTE', () => {
  // AI charts persist the colours they were painted with, so changing an entry
  // (or the order) silently recolours new charts. Pin the exact list.
  it('keeps the 15 series colours in order', () => {
    expect(CHART_PALETTE).toEqual([
      '#1570ef',
      '#7a5af8',
      '#067647',
      '#b54708',
      '#5925dc',
      '#15b79e',
      '#f04438',
      '#ee46bc',
      '#ef6820',
      '#175cd3',
      '#875bf7',
      '#6172f3',
      '#17b26a',
      '#f79009',
      '#cb5a50',
    ]);
  });

  it('is the light series palette', () => {
    expect(LIGHT_CHART_PALETTE.series).toBe(CHART_PALETTE);
  });
});

describe('light and dark palettes', () => {
  const HEX = /^#[0-9a-f]{6}$/;

  it.each([
    ['light', LIGHT_CHART_PALETTE],
    ['dark', DARK_CHART_PALETTE],
  ])('%s has 15 distinct hex series colours', (_, palette) => {
    expect(palette.series).toHaveLength(15);
    expect(new Set(palette.series).size).toBe(15);
    palette.series.forEach((color) => expect(color).toMatch(HEX));
  });

  it.each([
    ['light', LIGHT_CHART_PALETTE],
    ['dark', DARK_CHART_PALETTE],
  ])(
    '%s has a hex colour for every status and both scale ends',
    (_, palette) => {
      expect(Object.keys(palette.status).sort()).toEqual([
        'failed',
        'info',
        'neutral',
        'success',
        'warning',
      ]);
      [...Object.values(palette.status), ...palette.scale].forEach((color) =>
        expect(color).toMatch(HEX)
      );
    }
  );

  it('pins the light status colours to the design tokens charts used before', () => {
    expect(LIGHT_CHART_PALETTE.status).toEqual({
      success: '#17b26a',
      warning: '#f79009',
      failed: '#cb5a50',
      info: '#1570ef',
      neutral: '#e9eaeb',
    });
  });

  it('gives dark mode its own colours', () => {
    expect(DARK_CHART_PALETTE.series[0]).not.toBe(
      LIGHT_CHART_PALETTE.series[0]
    );
    expect(DARK_CHART_PALETTE.status.success).not.toBe(
      LIGHT_CHART_PALETTE.status.success
    );
  });
});

describe('chartColor', () => {
  it('cycles the series colours by index', () => {
    expect(chartColor(DARK_CHART_PALETTE, 0)).toBe(
      DARK_CHART_PALETTE.series[0]
    );
    expect(chartColor(DARK_CHART_PALETTE, 16)).toBe(
      DARK_CHART_PALETTE.series[1]
    );
  });

  it('uses the status colour when a status is given', () => {
    expect(chartColor(DARK_CHART_PALETTE, 3, 'failed')).toBe(
      DARK_CHART_PALETTE.status.failed
    );
  });
});

describe('getSeriesColor', () => {
  it('returns the light palette colour at the series index', () => {
    expect(getSeriesColor(0)).toBe('#1570ef');
    expect(getSeriesColor(14)).toBe('#cb5a50');
  });

  it('cycles back to the start past the last colour', () => {
    expect(getSeriesColor(15)).toBe('#1570ef');
    expect(getSeriesColor(31)).toBe('#7a5af8');
  });
});
