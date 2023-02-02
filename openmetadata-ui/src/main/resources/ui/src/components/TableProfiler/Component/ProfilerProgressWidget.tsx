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

import { Col, Progress, Row } from 'antd';
import React from 'react';
import { ProfilerProgressWidgetProps } from '../TableProfiler.interface';

const ProfilerProgressWidget: React.FC<ProfilerProgressWidgetProps> = ({
  value,
  strokeColor,
}) => {
  const modifedValue = Math.round(value * 100);

  return (
    <Row data-testid="profiler-progress-bar-container">
      <Col span={6}>
        <p className="percent-info" data-testid="percent-info">
          {modifedValue}%
        </p>
      </Col>
      <Col span={16}>
        <Progress
          data-testid="progress-bar"
          percent={modifedValue}
          showInfo={false}
          size="small"
          strokeColor={strokeColor}
        />
      </Col>
    </Row>
  );
};

export default ProfilerProgressWidget;
