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

import { Box, Card, Skeleton } from '@openmetadata/ui-core-components';
import {
  AreaChart,
  LineChart,
  type ChartSeries,
  type ChartTooltipRenderProps,
  type ChartYAxisProps,
} from '@openmetadata/ui-core-components/charts';
import React, { useMemo } from 'react';
import { PROFILER_CHART_DATA_SIZE } from '../../../../constants/profiler.constant';
import {
  axisTickFormatter,
  tooltipFormatter,
} from '../../../../utils/ChartUtils';
import {
  chartTooltipRows,
  DQTooltipContent,
} from '../../../../utils/DataQuality/CustomDQTooltip.component';
import { formatDateTimeLong } from '../../../../utils/date-time/DateTimeUtils';
import NoDataPlaceholder from '../../../common/EmptyPlaceholder/NoDataPlaceholder';
import {
  MetricChartType,
  ProfilerDetailsCardProps,
} from '../ProfilerDashboard/profilerDashboard.interface';
import ProfilerLatestValue from '../ProfilerLatestValue/ProfilerLatestValue';

type MetricRow = MetricChartType['data'][number];

const CHART_HEIGHT = 300;
// Date columns: min / max are date strings, plotted as categories.
const CATEGORY_Y_AXIS: ChartYAxisProps = { type: 'category' };

const ProfilerDetailsCard: React.FC<ProfilerDetailsCardProps> = ({
  showYAxisCategory = false,
  chartCollection,
  tickFormatter,
  name,
  title,
  isLoading,
  noDataPlaceholderText,
  chartType = 'line',
}: ProfilerDetailsCardProps) => {
  const { data, information } = chartCollection;
  const Chart = chartType === 'area' ? AreaChart : LineChart;

  const series = useMemo<ChartSeries[]>(
    () =>
      information.map((info) => ({
        key: info.dataKey,
        name: info.title,
        status: info.status,
      })),
    [information]
  );

  const yAxis = useMemo<ChartYAxisProps>(
    () =>
      showYAxisCategory
        ? CATEGORY_Y_AXIS
        : {
            type: 'value',
            formatter: (value) =>
              String(axisTickFormatter(Number(value), tickFormatter)),
          },
    [showYAxisCategory, tickFormatter]
  );

  const tooltip = useMemo<ChartTooltipRenderProps<MetricRow>>(
    () => ({
      render: (items, row) => (
        <DQTooltipContent
          header={formatDateTimeLong(Number(row?.timestamp ?? 0))}
          rows={chartTooltipRows(items)}
          valueFormatter={(value) => tooltipFormatter(value, tickFormatter)}
        />
      ),
    }),
    [tickFormatter]
  );

  if (isLoading) {
    return <Skeleton height="95%" variant="rounded" width="100%" />;
  }

  return (
    <Box direction="col" gap={3}>
      {title && <p className="tw:m-0 tw:text-md tw:font-semibold">{title}</p>}
      {/* overflow-visible: chart tooltips near the edge must not be clipped. */}
      <Card
        className="tw:overflow-visible"
        data-testid="profiler-details-card-container">
        <Card.Content>
          <Box direction="col" gap={4}>
            <ProfilerLatestValue
              information={information}
              tickFormatter={tickFormatter}
            />

            {data.length > 0 ? (
              <div className="tw:w-full" id={`${name}_graph`}>
                <Chart
                  ariaLabel={title ?? name}
                  data={data}
                  height={CHART_HEIGHT}
                  series={series}
                  tooltip={tooltip}
                  xKey="name"
                  yAxis={yAxis}
                  zoom="auto"
                  zoomVisiblePoints={PROFILER_CHART_DATA_SIZE}
                />
              </div>
            ) : (
              <div className="tw:relative tw:h-full tw:w-full tw:min-h-60 tw:rounded-xl tw:bg-surface">
                <NoDataPlaceholder
                  data-testid="no-data-placeholder"
                  description={noDataPlaceholderText}
                />
              </div>
            )}
          </Box>
        </Card.Content>
      </Card>
    </Box>
  );
};

export default ProfilerDetailsCard;
