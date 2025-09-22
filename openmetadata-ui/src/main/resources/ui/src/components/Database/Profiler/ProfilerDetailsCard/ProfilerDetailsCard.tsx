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
  tooltipFormatter,
  updateActiveChartFilter,
} from '../../../../utils/ChartUtils';
import { CustomTooltip } from '../../../../utils/DataInsightUtils';
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

  const handleClick = (dataKey: string) => {
    setActiveKeys((prevActiveKeys) =>
      updateActiveChartFilter(dataKey, prevActiveKeys)
    );
  };

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
            fontWeight: theme.typography.fontWeightBold,
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
            onClick={handleClick}
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
                margin={{ left: 16 }}>
                <CartesianGrid
                  stroke={GRAPH_BACKGROUND_COLOR}
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  padding={{ left: 16, right: 16 }}
                  tick={{ fontSize: 12 }}
                />

                <YAxis
                  allowDataOverflow
                  padding={{ top: 16, bottom: 16 }}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(props) =>
                    axisTickFormatter(props, tickFormatter)
                  }
                  type={showYAxisCategory ? 'category' : 'number'}
                />
                <Tooltip
                  content={
                    <CustomTooltip
                      dateTimeFormatter={formatDateTimeLong}
                      timeStampKey="timestamp"
                      valueFormatter={(value) =>
                        tooltipFormatter(value, tickFormatter)
                      }
                    />
                  }
                />
                {information.map((info) => (
                  <Fragment key={info.dataKey}>
                    {chartType === 'area' && (
                      <Area
                        dataKey={info.dataKey}
                        fill={info.color}
                        fillOpacity={0.1}
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
