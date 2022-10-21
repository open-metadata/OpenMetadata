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

import { Card, Col, Row, Typography } from 'antd';
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
import { BAR_CHART_MARGIN } from '../../constants/DataInsight.constants';
import {
  COLORS,
  ENTITIES_DATA_DESCRIPTION_PERCENTAGE,
  PIE_DATA,
} from '../../pages/DataInsightPage/DataInsight.mock';

const OwnerInsight = () => {
  return (
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
              margin={BAR_CHART_MARGIN}>
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
  );
};

export default OwnerInsight;
