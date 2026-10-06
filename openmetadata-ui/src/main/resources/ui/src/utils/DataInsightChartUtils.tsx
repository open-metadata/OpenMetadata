/*
 *  Copyright 2022 Collate.
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

import {
  chartColor,
  type ChartPalette,
  type ChartSeries,
  type ChartTooltipRenderProps,
} from '@openmetadata/ui-core-components/charts';
import {
  DEFAULT_CHART_OPACITY,
  HOVER_CHART_OPACITY,
} from '../constants/constants';
import { DataInsightValueFormatter } from '../interface/data-insight.interface';
import {
  chartTooltipRows,
  DQTooltipContent,
} from './DataQuality/CustomDQTooltip.component';
import { formatDate } from './date-time/DateTimeUtils';

// The chart title already names the card and the side panel is the legend, so
// the built-in one stays off.
export const HIDDEN_CHART_LEGEND = { show: false } as const;

export const dataInsightColor = (
  palette: ChartPalette,
  keys: string[],
  key: string
) => chartColor(palette, Math.max(keys.indexOf(key), 0));

export interface DataInsightLineSeriesInput {
  /** Every series, in colour order (rank). Colours follow this order. */
  keys: string[];
  palette: ChartPalette;
  /** Toggled in the side panel; empty shows every key. */
  activeKeys?: string[];
  /** Hovered in the side panel; '' or undefined highlights none. */
  hoverKey?: string;
  /** Keys left after a search; undefined keeps all. Does not change colours. */
  visibleKeys?: string[];
}

// With keys toggled, only those (and the hovered one) are drawn.
const isShown = (key: string, activeKeys: string[], hoverKey: string) =>
  activeKeys.length === 0 || key === hoverKey || activeKeys.includes(key);

export const getDataInsightLineSeries = ({
  keys,
  palette,
  activeKeys = [],
  hoverKey = '',
  visibleKeys,
}: DataInsightLineSeriesInput): ChartSeries[] =>
  keys.flatMap((key, index) =>
    isShown(key, activeKeys, hoverKey) &&
    (visibleKeys === undefined || visibleKeys.includes(key))
      ? [
          {
            key,
            name: key,
            color: chartColor(palette, index),
            // Always sent: ECharts deep-merges a series that keeps its id, so an
            // omitted opacity would leave the previous dimmed value in place.
            seriesOption: {
              lineStyle: {
                opacity:
                  hoverKey && key !== hoverKey
                    ? HOVER_CHART_OPACITY
                    : DEFAULT_CHART_OPACITY,
              },
            },
          },
        ]
      : []
  );

export interface DataInsightTooltipOptions<T> {
  /** Field of the row holding the epoch millis shown as the header. */
  timeKey: keyof T & string;
  isPercentage?: boolean;
  valueFormatter?: DataInsightValueFormatter;
  className?: string;
}

export const getDataInsightTooltip = <T extends object>({
  timeKey,
  isPercentage,
  valueFormatter,
  className,
}: DataInsightTooltipOptions<T>): ChartTooltipRenderProps<T> => ({
  render: (items, row) => (
    <DQTooltipContent
      className={className}
      header={formatDate(Number(row?.[timeKey] ?? 0))}
      isPercentage={isPercentage}
      rows={chartTooltipRows(items)}
      valueFormatter={valueFormatter}
    />
  ),
});
