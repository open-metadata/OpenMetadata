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
  BarChart,
  type ChartSeries,
  type ChartTooltipRenderProps,
  type ChartYAxisProps,
} from '@openmetadata/ui-core-components/charts';
import { Col, Row } from 'antd';
import { useMemo } from 'react';
import { PROFILER_CHART_DATA_SIZE } from '../../../constants/profiler.constant';
import { axisTickFormatter, tooltipFormatter } from '../../../utils/ChartUtils';
import {
  chartTooltipRows,
  DQTooltipContent,
} from '../../../utils/DataQuality/CustomDQTooltip.component';
import { formatDateTimeLong } from '../../../utils/date-time/DateTimeUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { CustomBarChartProps } from './Chart.interface';

type OperationRow = CustomBarChartProps['chartCollection']['data'][number];

const STACK_ID = 'custom-bar-chart';
const CHART_HEIGHT = 300;

const CustomBarChart = ({
  chartCollection,
  tickFormatter,
  name,
  ariaLabel,
  noDataPlaceholderText,
}: CustomBarChartProps) => {
  const { data, information } = chartCollection;

  // `info.color` is a CSS variable, which ECharts cannot paint; the series
  // take palette colours in order instead.
  const series = useMemo<ChartSeries[]>(
    () =>
      information.map((info) => ({
        key: info.dataKey,
        name: info.title,
        stack: STACK_ID,
      })),
    [information]
  );

  const yAxis = useMemo<ChartYAxisProps>(
    () => ({
      formatter: (value) =>
        String(axisTickFormatter(Number(value), tickFormatter)),
    }),
    [tickFormatter]
  );

  const tooltip = useMemo<ChartTooltipRenderProps<OperationRow>>(
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

  if (data.length === 0) {
    return (
      <Row align="middle" className="h-full w-full" justify="center">
        <Col>
          <ErrorPlaceHolder
            className="mt-0-important"
            placeholderText={noDataPlaceholderText}
          />
        </Col>
      </Row>
    );
  }

  return (
    <div className="w-full" id={`${name}_graph`}>
      <BarChart
        ariaLabel={ariaLabel}
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
  );
};

export default CustomBarChart;
