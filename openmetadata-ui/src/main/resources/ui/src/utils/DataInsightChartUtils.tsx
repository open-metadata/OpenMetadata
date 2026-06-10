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

import { Card, Typography } from 'antd';
import { isEmpty, startCase, uniqBy } from 'lodash';
import {
  CartesianGrid,
  LegendProps,
  Line,
  LineChart,
  Surface,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  DEFAULT_CHART_OPACITY,
  GRAPH_BACKGROUND_COLOR,
  GRAYED_OUT_COLOR,
  HOVER_CHART_OPACITY,
} from '../constants/constants';
import { BAR_CHART_MARGIN } from '../constants/DataInsight.constants';
import { DataInsightChartTooltipProps } from '../interface/data-insight.interface';
import { axisTickFormatter } from './ChartUtils';
import { entityChartColor } from './ColorUtils';
import { getEntryFormattedValue, getRandomHexColor } from './DataInsightPureUtils';
import { customFormatDateTime, formatDate } from './date-time/DateTimeUtils';

export const renderLegend = (
  legendData: LegendProps,
  activeKeys = [] as string[],
  valueFormatter?: (value: string) => string
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
            key={`item-${index}`}
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
            <Surface className="m-r-xss" height={14} version="1.1" width={14}>
              <rect
                fill={isActive ? entry.color : GRAYED_OUT_COLOR}
                height="14"
                rx="2"
                width="14"
              />
            </Surface>
            <span style={{ color: isActive ? 'inherit' : GRAYED_OUT_COLOR }}>
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
          <Typography.Title level={5} style={titleStyles}>
            {timestamp}
          </Typography.Title>
        }>
        <ul
          className="custom-data-insight-tooltip-container"
          style={listContainerStyles}>
          {payloadValue.map((entry, index) => {
            const value = customValueKey
              ? entry.payload[customValueKey]
              : entry.value;

            return (
              <li
                className="d-flex items-center justify-between gap-6 p-b-xss text-sm"
                key={`item-${index}`}>
                <span className="flex items-center text-grey-muted">
                  <Surface
                    className="mr-2"
                    height={12}
                    version="1.1"
                    width={12}>
                    <rect fill={entry.color} height="14" rx="2" width="14" />
                  </Surface>
                  <span style={labelStyles}>
                    {transformLabel
                      ? startCase(entry.name ?? (entry.dataKey as string))
                      : entry.name ?? (entry.dataKey as string)}
                  </span>
                </span>
                <span className="font-medium" style={valueStyles}>
                  {valueFormatter
                    ? valueFormatter(value, entry.name ?? entry.dataKey)
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

export const renderDataInsightLineChart = (
  graphData: Array<Record<string, number>>,
  labels: string[],
  activeKeys: string[],
  activeMouseHoverKey: string,
  isPercentage: boolean
) => {
  return (
    <LineChart data={graphData} margin={BAR_CHART_MARGIN}>
      <CartesianGrid stroke={GRAPH_BACKGROUND_COLOR} vertical={false} />
      <Tooltip
        content={
          <CustomTooltip isPercentage={isPercentage} timeStampKey="day" />
        }
        wrapperStyle={{ pointerEvents: 'auto' }}
      />
      <XAxis
        allowDuplicatedCategory={false}
        dataKey="day"
        tickFormatter={(value: number) => customFormatDateTime(value, 'MMM dd')}
        type="category"
      />
      <YAxis
        tickFormatter={
          isPercentage
            ? (value: number) => axisTickFormatter(value, '%')
            : undefined
        }
      />

      {labels.map((s, i) => (
        <Line
          dataKey={s}
          hide={
            activeKeys.length && s !== activeMouseHoverKey
              ? !activeKeys.includes(s)
              : false
          }
          key={s}
          name={s}
          stroke={entityChartColor(i) ?? getRandomHexColor()}
          strokeOpacity={
            isEmpty(activeMouseHoverKey) || s === activeMouseHoverKey
              ? DEFAULT_CHART_OPACITY
              : HOVER_CHART_OPACITY
          }
          type="monotone"
        />
      ))}
    </LineChart>
  );
};
