/*
 *  Copyright 2024 Collate.
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
import { entries, omit, startCase } from 'lodash';
import React from 'react';
import { TooltipProps } from 'recharts';

const TestSummaryCustomTooltip = (
  props: TooltipProps<string | number, string>
) => {
  const { active, payload = [] } = props;
  const data = payload.length ? entries(omit(payload[0].payload, 'name')) : [];

  return active && payload.length ? (
    <Card
      className="custom-data-insight-tooltip"
      title={
        <Typography.Title level={5}>{payload[0].payload.name}</Typography.Title>
      }>
      <ul className="custom-data-insight-tooltip-container">
        {data.map(([key, value]) => (
          <li
            className="d-flex items-center justify-between gap-6 p-b-xss text-sm"
            key={`item-${key}`}>
            <span className="flex items-center text-grey-muted">
              {startCase(key)}
            </span>
            <span className="font-medium">{value}</span>
          </li>
        ))}
      </ul>
    </Card>
  ) : null;
};

export default TestSummaryCustomTooltip;
