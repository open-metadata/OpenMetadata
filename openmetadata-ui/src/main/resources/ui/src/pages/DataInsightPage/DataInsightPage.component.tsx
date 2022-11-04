/*
 *  Copyright 2021 Collate
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

import { Button, Card, Col, Radio, Row, Select, Space, Typography } from 'antd';
import React, { useState } from 'react';
import { DAY_FILTER, TEAM_FILTER, TIER_FILTER } from './DataInsight.mock';

import PageLayoutV1 from '../../components/containers/PageLayoutV1';
import DataInsightSummary from '../../components/DataInsightDetail/DataInsightSummary';
import DescriptionInsight from '../../components/DataInsightDetail/DescriptionInsight';
import OwnerInsight from '../../components/DataInsightDetail/OwnerInsight';
import TierInsight from '../../components/DataInsightDetail/TierInsight';
import TopActiveUsers from '../../components/DataInsightDetail/TopActiveUsers';
import TopViewEntities from '../../components/DataInsightDetail/TopViewEntities';
import TotalEntityInsight from '../../components/DataInsightDetail/TotalEntityInsight';
import './DataInsight.less';

const DataInsightPage = () => {
  const [activeTab, setActiveTab] = useState('Datasets');

  return (
    <PageLayoutV1>
      <Row data-testid="data-insight-container" gutter={[16, 16]}>
        <Col span={24}>
          <Space className="w-full justify-between">
            <div data-testid="data-insight-header">
              <Typography.Title level={5} style={{ marginBottom: '0px' }}>
                Data Insight
              </Typography.Title>
              <Typography.Text className="data-insight-label-text">
                Keep track of OKRs with charts built around OpenMetadata health.
              </Typography.Text>
            </div>
            <Button type="primary">Add KPIs</Button>
          </Space>
        </Col>
        <Col span={24}>
          <Card>
            <Space className="w-full justify-between">
              <Space className="w-full">
                <Select options={TEAM_FILTER} placeholder="Select teams" />
                <Select options={TIER_FILTER} placeholder="Select tier" />
              </Space>
              <Select options={DAY_FILTER} value="7" />
            </Space>
          </Card>
        </Col>
        <Col span={24}>
          <DataInsightSummary />
        </Col>
        <Col span={24}>
          <Radio.Group
            buttonStyle="solid"
            className="data-insight-switch"
            data-testid="data-insight-switch"
            optionType="button"
            options={['Datasets', 'Web Analytics']}
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
          />
        </Col>
        {activeTab === 'Datasets' && (
          <>
            <Col span={24}>
              <TotalEntityInsight />
            </Col>
            <Col span={24}>
              <DescriptionInsight />
            </Col>
            <Col span={24}>
              <OwnerInsight />
            </Col>
            <Col span={24}>
              <TierInsight />
            </Col>
          </>
        )}
        {activeTab === 'Web Analytics' && (
          <>
            <Col span={24}>
              <TopViewEntities />
            </Col>
            <Col span={24}>
              <TopActiveUsers />
            </Col>
          </>
        )}
      </Row>
    </PageLayoutV1>
  );
};

export default DataInsightPage;
