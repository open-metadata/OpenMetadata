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
import DataInsightDetail from '../../components/DataInsightDetail/DataInsightDetail.component';
import { getMenuItems } from '../../utils/DataInsightUtils';
import { dropdownIcon as DropDownIcon } from '../../utils/svgconstant';

const DataInsightPage = () => {
  return (
    <PageLayoutV1>
      <Row data-testid="dataInsight-container" gutter={[16, 16]}>
        <Col span={24}>
          <Space className="w-full justify-end" size={12}>
            <Dropdown
              className="cursor-pointer"
              overlay={getMenuItems(DAY_FILTER, '7')}>
              <Space>
                Last 7 Days
                <DropDownIcon />
              </Space>
            </Dropdown>
            <Dropdown
              className="cursor-pointer"
              overlay={getMenuItems(TEAM_FILTER, 'team1')}>
              <Space>
                Cloud Infra
                <DropDownIcon />
              </Space>
            </Dropdown>
            <Dropdown
              className="cursor-pointer"
              overlay={getMenuItems(ORG_FILTER, 'org1')}>
              <Space>
                Organization1
                <DropDownIcon />
              </Space>
            </Dropdown>
            <Dropdown
              className="cursor-pointer"
              overlay={getMenuItems(TIER_FILTER, 'Tier.Tier1')}>
              <Space>
                Tier1
                <DropDownIcon />
              </Space>
            </Dropdown>
          </Space>
        </Col>
        <Col span={24}>
          <DataInsightDetail />
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default DataInsightPage;
