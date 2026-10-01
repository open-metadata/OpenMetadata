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
import { buildChartTheme, DARK_CHART_THEME, LIGHT_CHART_THEME } from './theme';

describe('buildChartTheme', () => {
  it('returns the light theme by default', () => {
    expect(buildChartTheme()).toBe(LIGHT_CHART_THEME);
    expect(buildChartTheme({ isDark: false })).toBe(LIGHT_CHART_THEME);
  });

  it('returns the dark theme when isDark is set', () => {
    expect(buildChartTheme({ isDark: true })).toBe(DARK_CHART_THEME);
  });
});

describe('chart themes', () => {
  // Values moved unchanged from chart-core's LIGHT/DARK_THEME_COLORS so the
  // AI-automation email PNGs keep rendering the same.
  it('keeps the light chrome colours', () => {
    expect(LIGHT_CHART_THEME).toEqual({
      isDark: false,
      axisText: '#6b7280',
      axisTick: undefined,
      axisTitle: '#535862',
      xAxisTitle: '#374151',
      grid: '#f1f2f4',
      emptyFill: '#f1f2f4',
      segmentBorder: '#ffffff',
      tooltipBg: '#ffffff',
      tooltipText: '#374151',
      tooltipBorder: '#e5e7eb',
    });
  });

  it('keeps the dark chrome colours', () => {
    expect(DARK_CHART_THEME).toEqual({
      isDark: true,
      axisText: '#94979c',
      axisTick: '#94979c',
      axisTitle: '#cecfd2',
      xAxisTitle: '#cecfd2',
      grid: '#373a41',
      emptyFill: '#22262f',
      segmentBorder: '#0c0e12',
      tooltipBg: '#22262f',
      tooltipText: '#f7f7f7',
      tooltipBorder: '#373a41',
    });
  });
});
