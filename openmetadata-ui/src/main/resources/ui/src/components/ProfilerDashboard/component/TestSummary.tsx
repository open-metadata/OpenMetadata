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
import React from 'react';
import RichTextEditorPreviewer from '../../common/rich-text-editor/RichTextEditorPreviewer';
import { TestSummaryProps } from '../profilerDashboard.interface';

const TestSummary: React.FC<TestSummaryProps> = ({ data }) => {
  return (
    <Row gutter={16}>
      <Col span={12}>chart</Col>
      <Col span={12}>
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
