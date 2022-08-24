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

import { Col, Row, Space, Typography } from 'antd';
import moment from 'moment';
import React, { useEffect, useState } from 'react';
import {
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TestCaseStatus } from '../../../generated/tests/tableTest';
import RichTextEditorPreviewer from '../../common/rich-text-editor/RichTextEditorPreviewer';
import { TestSummaryProps } from '../profilerDashboard.interface';

type ChartDataType = {
  information: string[];
  data: { [key: string]: string }[];
};

const TestSummary: React.FC<TestSummaryProps> = ({ data, results }) => {
  const [chartData, setChartData] = useState<ChartDataType>(
    {} as ChartDataType
  );

  const generateChartData = () => {
    const test: { [key: string]: string }[] = [];
    results.forEach((result) => {
      const values = result.testResultValue?.reduce((acc, curr) => {
        return {
          ...acc,
          [curr.name || 'value']: parseInt(curr.value || '') || 0,
        };
      }, {});

      test.push({
        name: moment.unix(result.timestamp || 0).format('DD/MMM HH:mm'),
        status: result.testCaseStatus || '',
        ...values,
      });
    });
    setChartData({
      information:
        results[0]?.testResultValue?.map((info) => info.name || '') || [],
      data: test,
    });
  };
  useEffect(() => {
    generateChartData();
  }, [results]);

  const referenceArea = () => {
    const yValues = data.parameterValues?.reduce((acc, curr, i) => {
      return { ...acc, [`y${i + 1}`]: parseInt(curr.value || '') };
    }, {});

    return (
      <ReferenceArea
        fill="#28A745"
        fillOpacity={0.3}
        stroke="#E6F4EB"
        {...yValues}
      />
    );
  };

  return (
    <Row gutter={16}>
      <Col span={14}>
        <ResponsiveContainer minHeight={300}>
          <LineChart data={chartData.data}>
            <XAxis dataKey="name" padding={{ left: 16, right: 16 }} />
            <YAxis allowDataOverflow padding={{ top: 16, bottom: 16 }} />
            <Tooltip />

            {data.parameterValues?.length === 2 && referenceArea()}
            {chartData?.information?.map((info: string) => (
              <Line
                dataKey={info}
                dot={(props) => {
                  const { cx = 0, cy = 0, payload } = props;
                  const fill =
                    payload.status === TestCaseStatus.Success
                      ? '#28A745'
                      : payload.status === TestCaseStatus.Failed
                      ? '#CB2431'
                      : '#EFAE2F';

                  return (
                    <svg
                      fill="none"
                      height={8}
                      width={8}
                      x={cx - 4}
                      xmlns="http://www.w3.org/2000/svg"
                      y={cy - 4}>
                      <circle cx={4} cy={4} fill={fill} r={4} />
                    </svg>
                  );
                }}
                key={info}
                stroke="#82ca9d"
                type="monotone"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Col>
      <Col span={10}>
        <Row gutter={[8, 8]}>
          <Col span={24}>
            <Typography.Text type="secondary">Name: </Typography.Text>
            <Typography.Text>{data.displayName || data.name}</Typography.Text>
          </Col>
          <Col span={24}>
            <Typography.Text type="secondary">Parameter: </Typography.Text>
            <Space size={8}>
              {data.parameterValues?.map((param) => (
                <Typography key={param.name}>
                  <Typography.Text>{param.name}: </Typography.Text>
                  <Typography.Text>{param.value}</Typography.Text>
                </Typography>
              ))}
            </Space>
          </Col>

          <Col className="tw-flex tw-gap-2" span={24}>
            <Typography.Text type="secondary">Description: </Typography.Text>
            <RichTextEditorPreviewer markdown={data.description || ''} />
          </Col>
        </Row>
      </Col>
    </Row>
  );
};

export default TestSummary;
