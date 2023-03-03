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

import { Card, Col, Row } from 'antd';
import { t } from 'i18next';
import React, { useState } from 'react';
import {
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
import { GRAPH_BACKGROUND_COLOR } from '../../../constants/constants';
import {
  axisTickFormatter,
  tooltipFormatter,
  updateActiveChartFilter,
} from '../../../utils/ChartUtils';
import ErrorPlaceHolder from '../../common/error-with-placeholder/ErrorPlaceHolder';
import { ProfilerDetailsCardProps } from '../profilerDashboard.interface';
import ProfilerLatestValue from './ProfilerLatestValue';

const ProfilerDetailsCard: React.FC<ProfilerDetailsCardProps> = ({
  chartCollection,
  tickFormatter,
  name,
  curveType,
}) => {
  const { data, information } = chartCollection;
  const [activeKeys, setActiveKeys] = useState<string[]>([]);

  const handleClick: LegendProps['onClick'] = (event) => {
    setActiveKeys((prevActiveKeys) =>
      updateActiveChartFilter(event.dataKey, prevActiveKeys)
    );
  };

  return (
    <Card
      className="tw-rounded-md tw-border"
      data-testid="profiler-details-card-container">
      <Row gutter={[16, 16]}>
        <Col span={4}>
          <ProfilerLatestValue
            information={information}
            tickFormatter={tickFormatter}
          />
        </Col>
        <Col span={20}>
          {data.length > 0 ? (
            <ResponsiveContainer
              debounce={200}
              id={`${name}_graph`}
              minHeight={300}>
              <LineChart
                className="tw-w-full"
                data={data}
                margin={{ left: 16 }}>
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
                />
                <Tooltip
                  formatter={(value: number) =>
                    tooltipFormatter(value, tickFormatter)
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
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Row
              align="middle"
              className="tw-h-full tw-w-full"
              justify="center">
              <Col>
                <ErrorPlaceHolder>
                  <p>{t('message.no-data-available')}</p>
                </ErrorPlaceHolder>
              </Col>
            </Row>
          )}
        </Col>
      </Row>
    </Card>
  );
};

export default ProfilerDetailsCard;
