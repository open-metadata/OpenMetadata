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

import { Card, Col, Empty, Row, Statistic } from 'antd';
import React, { useMemo } from 'react';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ProfilerDetailsCardProps } from '../profilerDashboard.interface';

const ProfilerDetailsCard: React.FC<ProfilerDetailsCardProps> = ({
  title,
  chartCollection,
  tickFormatter,
}) => {
  const { data, color } = chartCollection;
  const latestValue = useMemo(() => data[data.length - 1]?.value || 0, [data]);

  return (
    <Card className="tw-rounded-md tw-border">
      <Row gutter={[16, 16]}>
        <Col span={4}>
          <Statistic
            title={<span className="tw-text-grey-body">{title}</span>}
            value={
              tickFormatter ? `${latestValue}${tickFormatter}` : latestValue
            }
            valueStyle={{ color }}
          />
        </Col>
        <Col span={20}>
          {data.length > 0 ? (
            <ResponsiveContainer minHeight={300}>
              <LineChart className="tw-w-full" data={data}>
                <XAxis dataKey="name" padding={{ left: 16, right: 16 }} />
                <YAxis
                  allowDataOverflow
                  padding={{ top: 16, bottom: 16 }}
                  tickFormatter={(props) => `${props}${tickFormatter}`}
                />
                <Tooltip />
                <Line dataKey="value" stroke={color} type="monotone" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Empty description="No Data Available" />
          )}
        </Col>
      </Row>
    </Card>
  );
};

export default ProfilerDetailsCard;
