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
import Ellipses from '../../common/Ellipses/Ellipses';
import { ProfilerTabProps } from '../profilerDashboard.interface';
import ProfilerDetailsCard from './ProfilerDetailsCard';
import ProfilerSummaryCard from './ProfilerSummaryCard';

const ProfilerTab: React.FC<ProfilerTabProps> = ({
  activeColumnDetails,
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
        <Card className="tw-rounded-md tw-border tw-h-full">
          <Row gutter={16}>
            <Col span={18}>
              <p className="tw-font-medium tw-text-base">Column summary</p>
              <Ellipses className="tw-text-grey-muted" rows={4}>
                {activeColumnDetails.description}
              </Ellipses>
            </Col>
            <Col span={6}>
              <Statistic
                title="Data type"
                value={activeColumnDetails.dataTypeDisplay || ''}
                valueStyle={{
                  color: '#1890FF',
                  fontSize: '24px',
                  fontWeight: 600,
                }}
              />
            </Col>
          </Row>
        </Card>
      </Col>
      <Col span={8}>
        <ProfilerSummaryCard data={tableState} title="Table Metrics Summary" />
      </Col>
      <Col span={8}>
        <ProfilerSummaryCard
          showIndicator
          data={testSummary}
          title="Quality Tests Summary"
        />
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
