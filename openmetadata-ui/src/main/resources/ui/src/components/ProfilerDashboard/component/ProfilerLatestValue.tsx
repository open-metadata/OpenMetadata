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

import { Space, Statistic } from 'antd';
import React from 'react';
import { formatNumberWithComma } from '../../../utils/CommonUtils';
import { ProfilerLatestValueProps } from '../profilerDashboard.interface';

const ProfilerLatestValue = ({
  information,
  tickFormatter,
  stringValue = false,
}: ProfilerLatestValueProps) => {
  return (
    <Space direction="vertical" size={16}>
      {information.map((info) => (
        <Statistic
          key={info.title}
          title={<span className="tw-text-grey-body">{info.title}</span>}
          value={
            tickFormatter || stringValue
              ? `${info.latestValue}${tickFormatter ?? ''}`
              : formatNumberWithComma(info.latestValue as number)
          }
          valueStyle={{ color: info.color }}
        />
      ))}
    </Space>
  );
};

export default ProfilerLatestValue;
