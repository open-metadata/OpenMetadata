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
import { Typography } from '@openmetadata/ui-core-components';
import { Card } from 'antd';
import { startCase, uniqBy } from 'lodash';
import { GRAYED_OUT_COLOR, HOVER_CHART_OPACITY } from '../constants/constants';
import {
  DataInsightChartTooltipProps,
  DataInsightLegendProps,
} from '../interface/data-insight.interface';
import './DataInsightChartUtils.style.less';
import { getEntryFormattedValue } from './DataInsightPureUtils';
import {
  chartTooltipRows,
  DQTooltipContent,
} from './DataQuality/CustomDQTooltip.component';
import { formatDate } from './date-time/DateTimeUtils';

export const renderLegend = (
  legendData: DataInsightLegendProps,
  activeKeys = [] as string[],
  valueFormatter?: (value: string) => string,
  inactiveColor = GRAYED_OUT_COLOR
) => {
  const { payload = [] } = legendData;

  return (
    <ul className="custom-data-insight-legend">
      {payload.map((entry, index) => {
        const isActive =
          activeKeys.length === 0 || activeKeys.includes(entry.value);

        return (
          <li
            className="recharts-legend-item custom-data-insight-legend-item"
            key={`item-${entry.value}`}
            role="presentation"
            onClick={(e) =>
              legendData.onClick && legendData.onClick(entry, index, e)
            }
            onMouseEnter={(e) =>
              legendData.onMouseEnter &&
              legendData.onMouseEnter(entry, index, e)
            }
            onMouseLeave={(e) =>
              legendData.onMouseLeave &&
              legendData.onMouseLeave(entry, index, e)
            }>
            <svg aria-hidden className="m-r-xss" height={14} width={14}>
              <rect
                fill={isActive ? entry.color : inactiveColor}
                height="14"
                rx="2"
                width="14"
              />
            </svg>
            <span style={{ color: isActive ? 'inherit' : inactiveColor }}>
              {valueFormatter ? valueFormatter(entry.value) : entry.value}
            </span>
          </li>
        );
      })}
    </ul>
  );
};

export const CustomTooltip = (props: DataInsightChartTooltipProps) => {
  const {
    active,
    cardStyles,
    customValueKey,
    dateTimeFormatter = formatDate,
    isPercentage,
    labelStyles,
    listContainerStyles,
    payload = [],
    timeStampKey = 'timestampValue',
    titleStyles,
    transformLabel = true,
    valueFormatter,
    valueStyles,
  } = props;

  if (active && payload && payload.length) {
    const timestamp =
      timeStampKey === 'term'
        ? payload[0].payload[timeStampKey]
        : dateTimeFormatter(payload[0].payload[timeStampKey] || 0);
    const payloadValue = uniqBy(payload, 'dataKey');

    return (
      <Card
        className="custom-data-insight-tooltip"
        style={cardStyles}
        title={
          <Typography
            as="h5"
            className="custom-data-insight-tooltip-title"
            size="text-md"
            style={titleStyles}
            weight="semibold">
            {timestamp}
          </Typography>
        }>
        <ul
          className="custom-data-insight-tooltip-container"
          style={listContainerStyles}>
          {payloadValue.map((entry) => {
            const value = customValueKey
              ? entry.payload[customValueKey]
              : entry.value;

            return (
              <li
                className="d-flex items-center justify-between gap-6 p-b-xss text-sm"
                key={`item-${entry.name ?? entry.dataKey}`}>
                <span className="flex items-center text-grey-muted">
                  <svg aria-hidden className="mr-2" height={12} width={12}>
                    <rect fill={entry.color} height="14" rx="2" width="14" />
                  </svg>
                  <span style={labelStyles}>
                    {transformLabel
                      ? startCase((entry.name ?? entry.dataKey) as string)
                      : entry.name ?? (entry.dataKey as string)}
                  </span>
                </span>
                <span className="font-medium" style={valueStyles}>
                  {valueFormatter
                    ? valueFormatter(
                        value,
                        (entry.name ?? entry.dataKey) as string
                      )
                    : getEntryFormattedValue(value, isPercentage)}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
    );
  }

  return null;
};

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

// Same rule the recharts charts used: with keys toggled, only those (and the
// hovered one) are drawn.
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
            seriesOption:
              hoverKey && key !== hoverKey
                ? { lineStyle: { opacity: HOVER_CHART_OPACITY } }
                : undefined,
          },
        ]
      : []
  );

export interface DataInsightTooltipOptions<T> {
  /** Field of the row holding the epoch millis shown as the header. */
  timeKey: keyof T & string;
  isPercentage?: boolean;
  valueFormatter?: DataInsightChartTooltipProps['valueFormatter'];
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
