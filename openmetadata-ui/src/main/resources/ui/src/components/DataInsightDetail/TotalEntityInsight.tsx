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

import { Card, Typography } from 'antd';
import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ENTITIES_DATA } from '../../pages/DataInsightPage/DataInsight.mock';

const TotalEntityInsight = () => {
  return (
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
            <Bar barSize={20} dataKey="pipelines" fill="#9cc5e9" stackId="a" />
            <Bar barSize={20} dataKey="dashboards" fill="#e99c9c" stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default TotalEntityInsight;
