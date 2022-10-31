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

import { Col, Dropdown, Row, Space } from 'antd';
import React from 'react';
import {
  DAY_FILTER,
  ORG_FILTER,
  TEAM_FILTER,
  TIER_FILTER,
} from './DataInsight.mock';

import PageLayoutV1 from '../../components/containers/PageLayoutV1';
import DataInsightSummary from '../../components/DataInsightDetail/DataInsightSummary';
import DescriptionInsight from '../../components/DataInsightDetail/DescriptionInsight';
import OwnerInsight from '../../components/DataInsightDetail/OwnerInsight';
import TierInsight from '../../components/DataInsightDetail/TierInsight';
import TopActiveUsers from '../../components/DataInsightDetail/TopActiveUsers';
import TopViewEntities from '../../components/DataInsightDetail/TopViewEntities';
import TotalEntityInsight from '../../components/DataInsightDetail/TotalEntityInsight';
import { getMenuItems } from '../../utils/DataInsightUtils';
import { dropdownIcon as DropDownIcon } from '../../utils/svgconstant';

const DropDownLabel = ({ label }: { label: string }) => {
  return (
    <Space>
      {label}
      <DropDownIcon />
    </Space>
  );
};

const DataInsightPage = () => {
  return (
    <PageLayoutV1>
      <Row data-testid="dataInsight-container" gutter={[16, 16]}>
        <Col span={24}>
          <Space className="w-full justify-end" size={12}>
            <Dropdown
              className="cursor-pointer"
              overlay={getMenuItems(DAY_FILTER, '7')}>
              <DropDownLabel label="Last 7 Days" />
            </Dropdown>
            <Dropdown
              className="cursor-pointer"
              overlay={getMenuItems(TEAM_FILTER, 'team1')}>
              <DropDownLabel label="Cloud Infra" />
            </Dropdown>
            <Dropdown
              className="cursor-pointer"
              overlay={getMenuItems(ORG_FILTER, 'org1')}>
              <DropDownLabel label="Organization1" />
            </Dropdown>
            <Dropdown
              className="cursor-pointer"
              overlay={getMenuItems(TIER_FILTER, 'Tier.Tier1')}>
              <DropDownLabel label="Tier1" />
            </Dropdown>
          </Space>
        </Col>
        <Col span={24}>
          <DataInsightSummary />
        </Col>
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
        <Col span={24}>
          <TopViewEntities />
        </Col>
        <Col span={24}>
          <TopActiveUsers />
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default DataInsightPage;
