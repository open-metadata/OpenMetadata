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

import { Col, Progress, Row, Statistic, Table } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { startCase } from 'lodash';
import moment from 'moment';
import React, { useMemo } from 'react';
import {
  ChartCollection,
  ChartData,
  ProfilerLatestDetailsProps,
} from '../profilerDashboard.interface';

const ShowCards: React.FC<{ value: ChartCollection; title: string }> = ({
  value,
  title,
}) => {
  const { data, color } = value;
  const latestValue = data[data.length - 1];

  const columns: ColumnsType<ChartData> = useMemo(() => {
    return [
      {
        title: 'Date',
        dataIndex: 'timestamp',
        key: 'date',
        width: '50%',
        render: (timestamp: number) =>
          moment.unix(timestamp).format('YYYY-MM-DD'),
      },
      {
        title: 'Value',
        dataIndex: 'value',
        key: 'value',
        width: '50%',
        render: (_, record) => (
          <Row gutter={16}>
            <Col span={12}>
              <Progress
                percent={(record.proportion || 0) * 100}
                showInfo={false}
                size="small"
                strokeColor={color}
              />
            </Col>
            <Col span={12}>{record.value}</Col>
          </Row>
        ),
      },
    ];
  }, [value]);

  return (
    <div className="tw-bg-white tw-border tw-rounded-md">
      <div className="tw-p-4">
        <Statistic
          title={title}
          value={latestValue.value}
          valueStyle={{ color: color }}
        />
      </div>

      <Table
        bordered={false}
        columns={columns}
        dataSource={data}
        pagination={false}
        size="small"
      />
    </div>
  );
};

const ProfilerLatestDetails: React.FC<ProfilerLatestDetailsProps> = ({
  chartData,
}) => {
  const updateChartData = useMemo(() => {
    const newData = { ...chartData };

    delete newData['nullProportion'];

    return newData;
  }, [chartData]);

  return (
    <Row className="latest-profiler-data-container" gutter={[16, 16]}>
      {Object.entries(updateChartData).map(([key, value]) => (
        <Col key={key} span={8}>
          <ShowCards title={startCase(key)} value={value} />
        </Col>
      ))}
    </Row>
  );
};

export default ProfilerLatestDetails;
