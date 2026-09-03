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

import { useMemo } from 'react';
import { useTheme } from '../context/UntitledUIThemeProvider/theme-provider';
import { resolveCssColor } from '../utils/common/cssColor.utils';

const CHART_COLOR_TOKENS = {
  activeDotBorder: ['var(--om-color-bg-primary)', '#FFFFFF'],
  axis: ['var(--om-color-text-tertiary)', '#535862'],
  cursorFill: ['var(--om-color-bg-tertiary)', '#F5F5F5'],
  emptyFill: ['var(--om-color-bg-quaternary)', '#E9EAEB'],
  grid: ['var(--om-color-border-secondary)', '#E9EAEB'],
  inactive: ['var(--om-color-text-disabled)', '#717680'],
  primary: ['var(--om-color-fg-brand)', '#1570EF'],
  primaryArea: ['var(--om-color-bg-brand)', '#EFF8FF'],
} as const;

export const useChartColors = () => {
  const { theme } = useTheme();

  return useMemo(() => {
    // Recharts passes these values through SVG presentation attributes, which
    // need concrete colors and therefore must be refreshed with the root theme.
    void theme;

    return Object.fromEntries(
      Object.entries(CHART_COLOR_TOKENS).map(([key, [token, fallback]]) => [
        key,
        resolveCssColor(token, fallback),
      ])
    ) as Record<keyof typeof CHART_COLOR_TOKENS, string>;
  }, [theme]);
};
