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

import { DARK_CHART_PALETTE, LIGHT_CHART_PALETTE } from './palette';
import type { ChartTheme } from './types';

// Explicit colours also support the headless email renderer, which has no CSS tokens.
export const LIGHT_CHART_THEME: ChartTheme = {
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
  palette: LIGHT_CHART_PALETTE,
};

export const DARK_CHART_THEME: ChartTheme = {
  isDark: true,
  axisText: '#a8aeb9',
  axisTick: '#a8aeb9',
  axisTitle: '#cecfd2',
  xAxisTitle: '#cecfd2',
  grid: '#373a41',
  // Not the dark surface colour, or empty pie tracks and map regions vanish.
  emptyFill: '#373a41',
  // Blend segment outlines into the card surface rather than the page behind it.
  segmentBorder: '#22262f',
  tooltipBg: '#22262f',
  tooltipText: '#eef0f4',
  tooltipBorder: '#373a41',
  palette: DARK_CHART_PALETTE,
};

export const buildChartTheme = ({
  isDark = false,
}: { isDark?: boolean } = {}): ChartTheme =>
  isDark ? DARK_CHART_THEME : LIGHT_CHART_THEME;
