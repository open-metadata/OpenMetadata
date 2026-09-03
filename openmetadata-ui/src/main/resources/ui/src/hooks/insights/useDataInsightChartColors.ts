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
import {
  DATA_INSIGHT_GRAPH_COLOR_TOKENS,
  KPI_WIDGET_GRAPH_BG_COLOR_TOKENS,
  KPI_WIDGET_GRAPH_COLOR_TOKENS,
} from '../../constants/DataInsight.constants';
import { useTheme } from '../../context/UntitledUIThemeProvider/theme-provider';
import { resolveCssColor } from '../../utils/common/cssColor.utils';
import { useChartColors } from '../useChartColors';

const PROGRESS_COLOR = 'var(--om-color-brand-200, #B3D4F4)';

const resolveColorTokens = (
  definitions: ReadonlyArray<{ token: string; fallback: string }>
) => definitions.map(({ token, fallback }) => resolveCssColor(token, fallback));

export const useDataInsightChartColors = () => {
  const { theme } = useTheme();
  const chartColors = useChartColors();

  return useMemo(() => {
    // SVG presentation attributes need concrete values, so resolve them again
    // after the root theme class changes instead of passing CSS variables.
    void theme;

    return {
      ...chartColors,
      dataInsightSeries: resolveColorTokens(DATA_INSIGHT_GRAPH_COLOR_TOKENS),
      kpiBackgrounds: resolveColorTokens(KPI_WIDGET_GRAPH_BG_COLOR_TOKENS),
      kpiSeries: resolveColorTokens(KPI_WIDGET_GRAPH_COLOR_TOKENS),
      progress: resolveCssColor(PROGRESS_COLOR, '#B3D4F4'),
    };
  }, [chartColors, theme]);
};
