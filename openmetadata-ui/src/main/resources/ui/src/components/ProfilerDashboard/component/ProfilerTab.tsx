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

import { Card, Col, Row, Statistic } from 'antd';
import { startCase } from 'lodash';
import React, { useMemo } from 'react';
import { TestCaseStatus } from '../../../generated/tests/tableTest';
import { formTwoDigitNmber } from '../../../utils/CommonUtils';
import TestIndicator from '../../common/TestIndicator/TestIndicator';
import { ProfilerTabProp } from '../profilerDashboard.interface';
import ProfilerDetailsCard from './ProfilerDetailsCard';

const ProfilerTab: React.FC<ProfilerTabProp> = ({
  chartData,
  tableProfiler,
}) => {
  const tableState = useMemo(
    () => [
      {
        title: 'Row Count',
        value: tableProfiler.rowCount || 0,
      },
      {
        title: 'Column Count',
        value: tableProfiler.columnCount || 0,
      },
      {
        title: 'Table Sample %',
        value: `${tableProfiler.profileSample || 100}%`,
      },
    ],
    [tableProfiler]
  );
  const testSummary = useMemo(
    () => [
      {
        title: 'Success',
        value: 0,
      },
      {
        title: 'Aborted',
        value: 0,
      },
      {
        title: 'Failed',
        value: 0,
      },
    ],
    []
  );

  return (
    <Row gutter={[16, 16]}>
      <Col span={8}>
        <Card className="tw-rounded-md tw-border">card</Card>
      </Col>
      <Col span={8}>
        <Card className="tw-rounded-md tw-border">
          <p className="tw-text-base tw-font-medium tw-mb-7">
            Table Metrics Summary
          </p>
          <Row className="table-profiler-summary">
            {tableState.map((item) => (
              <Col className="overall-summary-card" key={item.title} span={8}>
                <Statistic title={item.title} value={item.value} />
              </Col>
            ))}
          </Row>
        </Card>
      </Col>
      <Col span={8}>
        <Card className="tw-rounded-md tw-border">
          <p className="tw-text-base tw-font-medium tw-mb-7">
            Quality Tests Summary
          </p>
          <Row className="table-profiler-summary">
            {testSummary.map((item) => (
              <Col className="overall-summary-card" key={item.title} span={8}>
                <Statistic
                  title={item.title}
                  valueRender={() => (
                    <TestIndicator
                      type={item.title as TestCaseStatus}
                      value={formTwoDigitNmber(item.value)}
                    />
                  )}
                />
              </Col>
            ))}
          </Row>
        </Card>
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
