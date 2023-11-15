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

import { Space, Statistic, Typography } from 'antd';
import React from 'react';
import { getStatisticsDisplayValue } from '../../../utils/CommonUtils';
import { ProfilerLatestValueProps } from '../profilerDashboard.interface';

import '../profilerDashboard.less';

const ProfilerLatestValue = ({
  information,
  tickFormatter,
  stringValue = false,
}: ProfilerLatestValueProps) => {
  return (
    <Space data-testid="data-summary-container" direction="vertical" size={16}>
      {information.map((info) => (
        <Statistic
          className="profiler-latest-value"
          key={info.title}
          title={
            <Typography.Text className="text-grey-body" data-testid="title">
              {info.title}
            </Typography.Text>
          }
          value={
            tickFormatter || stringValue
              ? `${info.latestValue}${tickFormatter ?? ''}`
              : getStatisticsDisplayValue(info.latestValue)
          }
          valueStyle={{ color: info.color, fontSize: '18px', fontWeight: 700 }}
        />
      ))}
    </Space>
  );
};

export default ProfilerLatestValue;
