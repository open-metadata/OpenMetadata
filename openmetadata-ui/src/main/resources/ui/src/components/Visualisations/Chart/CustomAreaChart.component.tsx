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
import { Typography } from '@openmetadata/ui-core-components';
import {
  AreaChart,
  type ChartOption,
  type ChartSeries,
  type ChartTooltipRenderProps,
} from '@openmetadata/ui-core-components/charts';
import { useMemo } from 'react';
import { formatDate } from '../../../utils/date-time/DateTimeUtils';
import { CustomAreaChartData, CustomAreaChartProps } from './Chart.interface';

type AreaRow = CustomAreaChartData & { date: string };

const HIDDEN = { show: false };
// A sparkline: the plot fills the card, as the axis-less recharts chart did.
const SPARKLINE_OPTION: ChartOption = {
  grid: { left: 0, right: 0, top: 5, bottom: 5 },
};

const CustomAreaChart = ({
  data,
  name,
  ariaLabel,
  height,
  status = 'info',
  valueFormatter,
}: CustomAreaChartProps) => {
  // The tooltip header is the x value, so the hidden x axis is a readable date.
  const rows = useMemo(
    () =>
      data.map((point) => ({ ...point, date: formatDate(point.timestamp) })),
    [data]
  );

  const series = useMemo<ChartSeries[]>(
    () => [
      {
        key: 'count',
        name: ariaLabel,
        status,
        seriesOption: { connectNulls: true },
      },
    ],
    [ariaLabel, status]
  );

  const tooltip = useMemo<ChartTooltipRenderProps<AreaRow>>(
    () => ({
      render: (_items, row) =>
        row ? (
          <div className="tw:flex tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-secondary tw:bg-primary tw:p-2 tw:shadow-md">
            <Typography size="text-md" weight="medium">
              {valueFormatter ? valueFormatter(row.count) : row.count}
            </Typography>
            <span
              aria-hidden
              className="tw:h-6 tw:border-l tw:border-secondary"
            />
            <Typography size="text-xs">{row.date}</Typography>
          </div>
        ) : null,
    }),
    [valueFormatter]
  );

  return (
    <div className="w-full" id={`${name}-area-chart`}>
      <AreaChart
        ariaLabel={ariaLabel}
        data={rows}
        height={height ?? 150}
        legend={HIDDEN}
        option={SPARKLINE_OPTION}
        series={series}
        tooltip={tooltip}
        xAxis={HIDDEN}
        xKey="date"
        yAxis={HIDDEN}
      />
    </div>
  );
};

export default CustomAreaChart;
