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
  Box,
  Card,
  Skeleton,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import React, { Fragment, useMemo, useState } from 'react';
import {
  Area,
  Brush,
  CartesianGrid,
  ComposedChart,
  Legend,
  LegendProps,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { GRAPH_BACKGROUND_COLOR } from '../../../../constants/constants';
import { PROFILER_CHART_DATA_SIZE } from '../../../../constants/profiler.constant';
import {
  axisTickFormatter,
  createHorizontalGridLineRenderer,
  tooltipFormatter,
  updateActiveChartFilter,
} from '../../../../utils/ChartUtils';
import { CustomDQTooltip } from '../../../../utils/DataQuality/DataQualityUtils';
import { formatDateTimeLong } from '../../../../utils/date-time/DateTimeUtils';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { ProfilerDetailsCardProps } from '../ProfilerDashboard/profilerDashboard.interface';
import ProfilerLatestValue from '../ProfilerLatestValue/ProfilerLatestValue';

const ProfilerDetailsCard: React.FC<ProfilerDetailsCardProps> = ({
  showYAxisCategory = false,
  chartCollection,
  tickFormatter,
  name,
  curveType,
  title,
  isLoading,
  noDataPlaceholderText,
  chartType = 'line',
}: ProfilerDetailsCardProps) => {
  const theme = useTheme();
  const { data, information } = chartCollection;
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const { showBrush, endIndex } = useMemo(() => {
    return {
      showBrush: data.length > PROFILER_CHART_DATA_SIZE,
      endIndex: PROFILER_CHART_DATA_SIZE,
    };
  }, [data]);

  const handleClick: LegendProps['onClick'] = (event) => {
    setActiveKeys((prevActiveKeys) =>
      updateActiveChartFilter(event.dataKey, prevActiveKeys)
    );
  };

  const renderHorizontalGridLine = useMemo(
    () => createHorizontalGridLineRenderer(),
    []
  );

  if (isLoading) {
    return <Skeleton height={380} variant="rounded" width="100%" />;
  }

  return (
    <Box>
      {title && (
        <Typography
          sx={{
            fontSize: '16px',
            color: theme.palette.grey[900],
            fontWeight: 600,
            mb: 3,
          }}
          variant="h6">
          {title}
        </Typography>
      )}
      <Card
        data-testid="profiler-details-card-container"
        sx={{
          p: 4,
          borderRadius: '10px',
          border: `1px solid ${theme.palette.grey[200]}`,
          boxShadow: 'none',
        }}>
        <Stack spacing={4}>
          <ProfilerLatestValue
            information={information}
            tickFormatter={tickFormatter}
          />

          {data.length > 0 ? (
            <ResponsiveContainer
              className="custom-legend"
              debounce={200}
              id={`${name}_graph`}
              minHeight={300}>
              <ComposedChart
                className="w-full"
                data={data}
                margin={{ left: 0 }}>
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
                  tickFormatter={(props) =>
                    axisTickFormatter(props, tickFormatter)
                  }
                  tickLine={false}
                  type={showYAxisCategory ? 'category' : 'number'}
                  width={showYAxisCategory ? undefined : 50}
                />
                <Tooltip
                  content={
                    <CustomDQTooltip
                      dateTimeFormatter={formatDateTimeLong}
                      timeStampKey="timestamp"
                      valueFormatter={(value) =>
                        tooltipFormatter(value, tickFormatter)
                      }
                    />
                  }
                  cursor={{
                    stroke: theme.palette.grey[200],
                    strokeDasharray: '3 3',
                  }}
                />
                {information.map((info) => (
                  <Fragment key={info.dataKey}>
                    {chartType === 'area' && (
                      <Area
                        dataKey={info.dataKey}
                        fill={info.fill ?? info.color}
                        fillOpacity={info.fill ? 1 : 0.1}
                        hide={
                          activeKeys.length
                            ? !activeKeys.includes(info.dataKey)
                            : false
                        }
                        key={info.dataKey}
                        name={info.title}
                        stroke={info.color}
                        type={curveType ?? 'monotone'}
                      />
                    )}
                    <Line
                      dataKey={info.dataKey}
                      hide={
                        activeKeys.length
                          ? !activeKeys.includes(info.dataKey)
                          : false
                      }
                      key={info.dataKey}
                      name={info.title}
                      stroke={info.color}
                      type={curveType ?? 'monotone'}
                    />
                  </Fragment>
                ))}
                {chartType === 'line' && (
                  <Legend iconType="rect" onClick={handleClick} />
                )}
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
          ) : (
            <ErrorPlaceHolder
              className="mt-0-important"
              placeholderText={noDataPlaceholderText}
            />
          )}
        </Stack>
      </Card>
    </Box>
  );
};

export default ProfilerDetailsCard;
