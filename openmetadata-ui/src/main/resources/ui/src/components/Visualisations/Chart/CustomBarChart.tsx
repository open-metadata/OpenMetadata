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

import { useTheme } from '@mui/material';
import { Col, Row } from 'antd';
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Legend,
  LegendProps,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { GRAPH_BACKGROUND_COLOR } from '../../../constants/constants';
import { PROFILER_CHART_DATA_SIZE } from '../../../constants/profiler.constant';
import {
  axisTickFormatter,
  createHorizontalGridLineRenderer,
  tooltipFormatter,
  updateActiveChartFilter,
} from '../../../utils/ChartUtils';
import { CustomDQTooltip } from '../../../utils/DataQuality/DataQualityUtils';
import { formatDateTimeLong } from '../../../utils/date-time/DateTimeUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { CustomBarChartProps } from './Chart.interface';

const CustomBarChart = ({
  chartCollection,
  tickFormatter,
  name,
  noDataPlaceholderText,
}: CustomBarChartProps) => {
  const theme = useTheme();
  const { data, information } = chartCollection;
  const [activeKeys, setActiveKeys] = useState<string[]>([]);

  const { showBrush, endIndex } = useMemo(() => {
    return {
      showBrush: data.length > PROFILER_CHART_DATA_SIZE,
      endIndex: PROFILER_CHART_DATA_SIZE,
    };
  }, [data.length]);

  const renderHorizontalGridLine = useMemo(
    () => createHorizontalGridLineRenderer(),
    []
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
  const handleClick: LegendProps['onClick'] = (event) => {
    setActiveKeys((prevActiveKeys) =>
      updateActiveChartFilter(event.dataKey, prevActiveKeys)
    );
  };

  return (
    <ResponsiveContainer
      className="custom-legend"
      debounce={200}
      id={`${name}_graph`}
      minHeight={300}>
      <BarChart className="w-full" data={data} margin={{ left: 16 }}>
        <CartesianGrid
          horizontal={renderHorizontalGridLine}
          stroke={GRAPH_BACKGROUND_COLOR}
          strokeDasharray="3 3"
          vertical={false}
        />
        <XAxis
          axisLine={false}
          dataKey="name"
          padding={{ left: 16, right: 16 }}
          tick={{ fontSize: 12 }}
          tickLine={false}
        />

        <YAxis
          allowDataOverflow
          axisLine={false}
          padding={{ top: 16, bottom: 16 }}
          tick={{ fontSize: 12 }}
          tickFormatter={(props) => axisTickFormatter(props, tickFormatter)}
          tickLine={false}
        />
        <Tooltip
          content={
            <CustomDQTooltip
              dateTimeFormatter={formatDateTimeLong}
              timeStampKey="timestamp"
              valueFormatter={(value) => tooltipFormatter(value, tickFormatter)}
            />
          }
          cursor={{
            fill: theme.palette.grey[100],
            stroke: theme.palette.grey[200],
            strokeDasharray: '3 3',
          }}
        />
        {information.map((info) => (
          <Bar
            dataKey={info.dataKey}
            fill={info.color}
            hide={
              activeKeys.length ? !activeKeys.includes(info.dataKey) : false
            }
            key={info.dataKey}
            name={info.title}
            stackId="custom-bar-chart"
          />
        ))}
        <Legend onClick={handleClick} />
        {showBrush && (
          <Brush
            data={data}
            endIndex={endIndex}
            gap={5}
            height={30}
            padding={{ left: 16, right: 16 }}
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
};

export default CustomBarChart;
