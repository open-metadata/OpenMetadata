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

import { Card, Col, Row, Typography } from 'antd';
import React, { useMemo, useState } from 'react';
import {
  Brush,
  CartesianGrid,
  Legend,
  LegendProps,
  Line,
  LineChart,
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
}: ProfilerDetailsCardProps) => {
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

  return (
    <Card
      className="shadow-none global-border-radius"
      data-testid="profiler-details-card-container"
      loading={isLoading}>
      <Row gutter={[16, 16]}>
        {title && (
          <Col span={24}>
            <Typography.Title level={5}>{title}</Typography.Title>
          </Col>
        )}
        <Col span={4}>
          <ProfilerLatestValue
            information={information}
            tickFormatter={tickFormatter}
          />
        </Col>
        <Col span={20}>
          {data.length > 0 ? (
            <ResponsiveContainer
              className="custom-legend"
              debounce={200}
              id={`${name}_graph`}
              minHeight={300}>
              <LineChart className="w-full" data={data} margin={{ left: 16 }}>
                <CartesianGrid stroke={GRAPH_BACKGROUND_COLOR} />
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
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Row align="middle" className="h-full w-full" justify="center">
              <Col>
                <ErrorPlaceHolder
                  className="mt-0-important"
                  placeholderText={noDataPlaceholderText}
                />
              </Col>
            </Row>
          )}
        </Col>
      </Row>
    </Card>
  );
};

export default ProfilerDetailsCard;
