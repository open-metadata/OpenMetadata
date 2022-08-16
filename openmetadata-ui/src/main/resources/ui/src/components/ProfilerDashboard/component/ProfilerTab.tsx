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

import { Card, Col, Row } from 'antd';
import { startCase } from 'lodash';
import React from 'react';
import { ProfilerTabProp } from '../profilerDashboard.interface';
import ProfilerDetailsCard from './ProfilerDetailsCard';

const ProfilerTab: React.FC<ProfilerTabProp> = ({ chartData }) => {
  return (
    <Row>
      <Col span={8}>
        <Card className="tw-rounded-md tw-border">card</Card>
      </Col>
      <Col span={8}>
        <Card className="tw-rounded-md tw-border">card</Card>
      </Col>
      <Col span={8}>
        <Card className="tw-rounded-md tw-border">card</Card>
      </Col>

      {Object.entries(chartData).map(([key, value], index) => (
        <Col key={index} span={24}>
          <ProfilerDetailsCard
            chartCollection={value}
            tickFormatter={key === 'nullProportion' ? '%' : ''}
            title={startCase(key)}
          />
        </Col>
      ))}
    </Row>
  );
};

export default ProfilerTab;
