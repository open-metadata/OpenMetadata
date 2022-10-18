/*
 *  Copyright 2022 Collate
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

import { Card, Col, Row, Space, Statistic } from 'antd';
import React from 'react';
import {
  Legend,
  LegendValueFormatter,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatNumberWithComma } from '../../../utils/CommonUtils';
import ErrorPlaceHolder from '../../common/error-with-placeholder/ErrorPlaceHolder';
import { ProfilerDetailsCardProps } from '../profilerDashboard.interface';

const ProfilerDetailsCard: React.FC<ProfilerDetailsCardProps> = ({
  chartCollection,
  tickFormatter,
  name,
}) => {
  const { data, information } = chartCollection;

  const renderColorfulLegendText: LegendValueFormatter = (value, entry) => {
    return <span style={{ color: entry?.color }}>{value}</span>;
  };

  return (
    <Card className="tw-rounded-md tw-border">
      <Row gutter={[16, 16]}>
        <Col span={4}>
          <Space direction="vertical" size={16}>
            {information.map((info) => (
              <Statistic
                key={info.title}
                title={<span className="tw-text-grey-body">{info.title}</span>}
                value={
                  tickFormatter
                    ? `${info.latestValue}${tickFormatter}`
                    : formatNumberWithComma(info.latestValue as number)
                }
                valueStyle={{ color: info.color }}
              />
            ))}
          </Space>
        </Col>
        <Col span={20}>
          {data.length > 0 ? (
            <ResponsiveContainer id={`${name}_graph`} minHeight={300}>
              <LineChart
                className="tw-w-full"
                data={data}
                margin={{ left: 16 }}>
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
                    tickFormatter ? `${props}${tickFormatter}` : props
                  }
                />
                <Tooltip
                  formatter={(value) =>
                    tickFormatter
                      ? `${(value as number).toFixed(2)}${tickFormatter}`
                      : formatNumberWithComma(value as number)
                  }
                />
                {information.map((info) => (
                  <Line
                    dataKey={info.dataKey}
                    key={info.dataKey}
                    name={info.title}
                    stroke={info.color}
                    type="monotone"
                  />
                ))}
                <Legend formatter={renderColorfulLegendText} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Row
              align="middle"
              className="tw-h-full tw-w-full"
              justify="center">
              <Col>
                <ErrorPlaceHolder>
                  <p>No Data Available</p>
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
