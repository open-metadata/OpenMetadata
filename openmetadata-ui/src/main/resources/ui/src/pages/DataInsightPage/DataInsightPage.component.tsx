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

import { Card, Col, Dropdown, Menu, Row, Space, Typography } from 'antd';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  COLORS,
  DAY_FILTER,
  ENTITIES_DATA,
  ENTITIES_DATA_DESCRIPTION_PERCENTAGE,
  ORG_FILTER,
  PIE_DATA,
  SUMMARY_DATA,
  TEAM_FILTER,
} from './DataInsight.mock';

import { dropdownIcon as DropDownIcon } from '../../utils/svgconstant';

const getMenuItems = (items: ItemType[], defaultKey: string) => (
  <Menu selectable defaultSelectedKeys={[defaultKey]} items={items} />
);

const DataInsightPage = () => {
  return (
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
        </Space>
      </Col>
      <Col span={24}>
        <Card data-testid="summary-card">
          <div data-testid="summary-card-heder">
            <Typography.Title level={5}>
              OpenMetadata health at a glance
            </Typography.Title>
            <Typography.Text>
              Some description over here could be helpful
            </Typography.Text>
          </div>
          <Row
            className="mt-4"
            data-testid="summary-card-content"
            gutter={[16, 16]}>
            {SUMMARY_DATA.map((summary, id) => (
              <Col data-testid="summary-item" key={id} span={4}>
                <Typography.Text>{summary.key}</Typography.Text>
                <Typography className="tw-font-semibold">
                  {summary.value}
                </Typography>
              </Col>
            ))}
          </Row>
        </Card>
        <Card className="mt-4" data-testid="entity-summary-card">
          <div data-testid="entity-summary-card-heder">
            <Typography.Title level={5}>Total Entities</Typography.Title>
          </div>
          <div className="mt-4" data-testid="entity-summary-card-content">
            <ResponsiveContainer minHeight={400}>
              <BarChart
                data={ENTITIES_DATA}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend className="mt-4" />
                <Bar barSize={20} dataKey="tables" fill="#8884d8" stackId="a" />
                <Bar barSize={20} dataKey="topics" fill="#82ca9d" stackId="a" />
                <Bar
                  barSize={20}
                  dataKey="pipelines"
                  fill="#9cc5e9"
                  stackId="a"
                />
                <Bar
                  barSize={20}
                  dataKey="dashboards"
                  fill="#e99c9c"
                  stackId="a"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="mt-4" data-testid="entity-summary-card-percentage">
          <div data-testid="entity-summary-card-percentage-heder">
            <Typography.Title level={5}>
              Percentage of Entities With Description
            </Typography.Title>
          </div>
          <Row
            className="mt-4"
            data-testid="entity-summary-card-percentage-content">
            <Col span={18}>
              <ResponsiveContainer minHeight={400}>
                <BarChart
                  data={ENTITIES_DATA_DESCRIPTION_PERCENTAGE}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend className="mt-4" />
                  <Bar barSize={20} dataKey="tables" fill="#8884d8" />
                  <Bar barSize={20} dataKey="topics" fill="#82ca9d" />
                  <Bar barSize={20} dataKey="pipelines" fill="#9cc5e9" />
                  <Bar barSize={20} dataKey="dashboards" fill="#e99c9c" />
                </BarChart>
              </ResponsiveContainer>
            </Col>
            <Col span={6}>
              <ResponsiveContainer minHeight={400}>
                <PieChart>
                  <Pie
                    cx="50%"
                    cy="50%"
                    data={PIE_DATA}
                    dataKey="value"
                    innerRadius={120}
                    nameKey="name"
                    outerRadius={130}>
                    {PIE_DATA.map((_, index) => (
                      <Cell
                        fill={COLORS[index % COLORS.length]}
                        key={`cell-${index}`}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend className="mt-4" />
                </PieChart>
              </ResponsiveContainer>
            </Col>
          </Row>
        </Card>
        <Card className="mt-4" data-testid="entity-summary-card-percentage">
          <div data-testid="entity-summary-card-percentage-heder">
            <Typography.Title level={5}>
              Percentage of Entities With Owners
            </Typography.Title>
          </div>
          <Row
            className="mt-4"
            data-testid="entity-summary-card-percentage-content">
            <Col span={6}>
              <ResponsiveContainer minHeight={400}>
                <PieChart>
                  <Pie
                    cx="50%"
                    cy="50%"
                    data={PIE_DATA}
                    dataKey="value"
                    fill="#8884d8"
                    innerRadius={120}
                    nameKey="name"
                    outerRadius={130}>
                    {PIE_DATA.map((_, index) => (
                      <Cell
                        fill={COLORS[index % COLORS.length]}
                        key={`cell-${index}`}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend className="mt-4" />
                </PieChart>
              </ResponsiveContainer>
            </Col>
            <Col span={18}>
              <ResponsiveContainer minHeight={400}>
                <BarChart
                  data={ENTITIES_DATA_DESCRIPTION_PERCENTAGE}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend className="mt-4" />
                  <Bar barSize={20} dataKey="tables" fill="#8884d8" />
                  <Bar barSize={20} dataKey="topics" fill="#82ca9d" />
                  <Bar barSize={20} dataKey="pipelines" fill="#9cc5e9" />
                  <Bar barSize={20} dataKey="dashboards" fill="#e99c9c" />
                </BarChart>
              </ResponsiveContainer>
            </Col>
          </Row>
        </Card>
      </Col>
    </Row>
  );
};

export default DataInsightPage;
