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

import { Col, Row } from 'antd';
import { Fragment, useMemo, useState } from 'react';
import {
  Bar,
  Brush,
  CartesianGrid,
  ComposedChart,
  Legend,
  LegendProps,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { GRAPH_BACKGROUND_COLOR } from '../../../constants/constants';
import { PROFILER_CHART_DATA_SIZE } from '../../../constants/profiler.constant';
import {
  tooltipFormatter,
  updateActiveChartFilter,
} from '../../../utils/ChartUtils';
import { CustomTooltip } from '../../../utils/DataInsightUtils';
import { formatDateTimeLong } from '../../../utils/date-time/DateTimeUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { CustomBarChartProps } from './Chart.interface';

const OperationDateBarChart = ({
  chartCollection,
  name,
  noDataPlaceholderText,
}: CustomBarChartProps) => {
  const { data, information } = chartCollection;
  const [activeKeys, setActiveKeys] = useState<string[]>([]);

  const { showBrush, endIndex } = useMemo(() => {
    return {
      showBrush: data.length > PROFILER_CHART_DATA_SIZE,
      endIndex: PROFILER_CHART_DATA_SIZE,
    };
  }, [data.length]);

  const handleClick: LegendProps['onClick'] = (event) => {
    setActiveKeys((prevActiveKeys) =>
      updateActiveChartFilter(event.dataKey, prevActiveKeys)
    );
  };

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
    <ResponsiveContainer
      className="custom-legend"
      debounce={200}
      id={`${name}_graph`}
      minHeight={300}>
      <ComposedChart className="w-full" data={data} margin={{ left: 16 }}>
        <XAxis
          dataKey="name"
          padding={{ left: 16, right: 16 }}
          tick={{ fontSize: 12 }}
        />
        <YAxis
          allowDataOverflow
          padding={{ top: 16, bottom: 16 }}
          tick={{ fontSize: 12 }}
          // need to show empty string to hide the tick value, to align the chart with other charts
          tickFormatter={() => ''}
          tickLine={false}
        />
        <CartesianGrid stroke={GRAPH_BACKGROUND_COLOR} />
        <Tooltip
          content={
            <CustomTooltip
              customValueKey="data"
              dateTimeFormatter={formatDateTimeLong}
              timeStampKey="timestamp"
              valueFormatter={(value) => tooltipFormatter(value)}
            />
          }
        />

        {information.map((info) => (
          <Fragment key={info.dataKey}>
            <Bar
              barSize={1}
              dataKey={info.dataKey}
              fill={info.color}
              hide={
                activeKeys.length ? !activeKeys.includes(info.dataKey) : false
              }
              key={`${info.dataKey}-bar`}
              name={info.title}
              stackId="data"
            />
            <Scatter
              dataKey={info.dataKey}
              fill={info.color}
              hide={
                activeKeys.length ? !activeKeys.includes(info.dataKey) : false
              }
              key={`${info.dataKey}-scatter`}
              name={info.title}
            />
          </Fragment>
        ))}
        <Legend payloadUniqBy onClick={handleClick} />
        {showBrush && (
          <Brush
            data={data}
            endIndex={endIndex}
            gap={5}
            height={30}
            padding={{ left: 16, right: 16 }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
};

export default OperationDateBarChart;
