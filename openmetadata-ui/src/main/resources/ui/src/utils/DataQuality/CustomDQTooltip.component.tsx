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

import type { ChartTooltipItem } from '@openmetadata/ui-core-components/charts';
import { startCase } from 'lodash';
import { ReactNode } from 'react';
import { DataInsightChartTooltipProps } from '../../interface/data-insight.interface';
import { getEntryFormattedValue } from '../DataInsightPureUtils';

export interface DQTooltipRow {
  key: string;
  name: string;
  value: number | string;
  color?: string;
}

export interface DQTooltipContentProps {
  header: ReactNode;
  rows: DQTooltipRow[];
  transformLabel?: boolean;
  isPercentage?: boolean;
  valueFormatter?: DataInsightChartTooltipProps['valueFormatter'];
}

/**
 * The Data Quality tooltip card. Plain markup, so core charts can render it
 * through `tooltip.render`.
 */
export const DQTooltipContent = ({
  header,
  rows,
  transformLabel = true,
  isPercentage,
  valueFormatter,
}: DQTooltipContentProps) => (
  <div className="tw:bg-primary tw:rounded-xl tw:border tw:border-border-secondary tw:shadow-md tw:p-2.5">
    <p className="tw:m-0 tw:text-primary tw:font-medium tw:text-xs">{header}</p>
    <hr className="tw:border-primary tw:my-2 tw:border-dashed" />
    <div className="tw:flex tw:flex-col tw:gap-1">
      {rows.map((row) => (
        <div
          className="tw:flex tw:items-center tw:justify-between tw:gap-6 tw:pb-1 tw:text-sm"
          key={`item-${row.key}`}>
          <span className="tw:flex tw:items-center">
            <svg aria-hidden className="tw:mr-2" height={14} width={4}>
              <rect fill={row.color} height="14" rx="2" width="4" />
            </svg>
            <span className="tw:text-tertiary tw:text-[11px]">
              {transformLabel ? startCase(row.name) : row.name}
            </span>
          </span>
          <span className="tw:font-medium tw:text-primary tw:text-[11px]">
            {valueFormatter
              ? valueFormatter(row.value, row.name)
              : getEntryFormattedValue(row.value, isPercentage)}
          </span>
        </div>
      ))}
    </div>
  </div>
);

/**
 * Core chart tooltip items as tooltip rows. Gaps (missing values) are dropped.
 */
export const chartTooltipRows = (items: ChartTooltipItem[]): DQTooltipRow[] =>
  items.flatMap((item) =>
    item.value === null
      ? []
      : [
          {
            key: item.seriesKey,
            name: item.name,
            value: item.value,
            color: item.color,
          },
        ]
  );
