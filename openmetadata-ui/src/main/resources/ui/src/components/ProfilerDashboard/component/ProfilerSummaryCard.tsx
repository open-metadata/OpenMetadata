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

import { Card, Col, Row, Statistic } from 'antd';
import React from 'react';
import { TestCaseStatus } from '../../../generated/tests/testCase';
import { formTwoDigitNmber } from '../../../utils/CommonUtils';
import TestIndicator from '../../common/TestIndicator/TestIndicator';
import { ProfilerSummaryCardProps } from '../profilerDashboard.interface';

const ProfilerSummaryCard: React.FC<ProfilerSummaryCardProps> = ({
  data,
  title,
  showIndicator = false,
}) => {
  return (
    <Card className="tw-rounded-md tw-border">
      <p className="tw-text-base tw-font-medium tw-mb-4">{title}</p>
      <Row className="table-profiler-summary">
        {data.map((item) => (
          <Col className="overall-summary-card" key={item.title} span={8}>
            <Statistic
              title={item.title}
              value={item.value}
              valueRender={(prop) =>
                showIndicator ? (
                  <TestIndicator
                    type={item.title as TestCaseStatus}
                    value={formTwoDigitNmber(item.value as number)}
                  />
                ) : (
                  prop
                )
              }
            />
          </Col>
        ))}
      </Row>
    </Card>
  );
};

export default ProfilerSummaryCard;
