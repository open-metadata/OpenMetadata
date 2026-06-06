/*
 *  Copyright 2024 Collate.
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
import { startCase, uniqBy } from 'lodash';
import { Surface } from 'recharts';
import { DataInsightChartTooltipProps } from '../../interface/data-insight.interface';
import { getEntryFormattedValue } from '../DataInsightUtils';
import { formatDate } from '../date-time/DateTimeUtils';

export const CustomDQTooltip = (props: DataInsightChartTooltipProps) => {
  const {
    active,
    dateTimeFormatter = formatDate,
    isPercentage,
    payload = [],
    timeStampKey = 'timestampValue',
    transformLabel = true,
    valueFormatter,
    displayDateInHeader = true,
  } = props;

  if (active && payload?.length) {
    const timestamp = displayDateInHeader
      ? dateTimeFormatter(payload[0].payload[timeStampKey] || 0)
      : payload[0].payload[timeStampKey];

    const payloadValue = uniqBy(payload, 'dataKey');

    return (
      <div className="tw:bg-primary tw:rounded-xl tw:border tw:border-border-secondary tw:shadow-md tw:p-2.5">
        <p className="tw:m-0 tw:text-primary tw:font-medium tw:text-xs">
          {timestamp}
        </p>
        <hr className="tw:border-primary tw:my-2 tw:border-dashed" />
        <div className="tw:flex tw:flex-col tw:gap-1">
          {payloadValue.map((entry, index) => {
            const value = entry.value;

            return (
              <div
                className="tw:flex tw:items-center tw:justify-between tw:gap-6 tw:pb-1 tw:text-sm"
                key={`item-${index}`}>
                <span className="tw:flex tw:items-center">
                  <Surface
                    className="tw:mr-2"
                    height={14}
                    version="1.1"
                    width={4}>
                    <rect fill={entry.color} height="14" rx="2" width="4" />
                  </Surface>
                  <span className="tw:text-tertiary tw:text-[11px]">
                    {transformLabel
                      ? startCase(entry.name ?? (entry.dataKey as string))
                      : entry.name ?? (entry.dataKey as string)}
                  </span>
                </span>
                <span className="tw:font-medium tw:text-primary tw:text-[11px]">
                  {valueFormatter
                    ? valueFormatter(value, entry.name ?? entry.dataKey)
                    : getEntryFormattedValue(value, isPercentage)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
};
