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

import { Menu, Typography } from 'antd';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import React from 'react';
import { LegendProps, Surface } from 'recharts';

export const getMenuItems = (items: ItemType[], defaultKey: string) => (
  <Menu selectable defaultSelectedKeys={[defaultKey]} items={items} />
);

export const renderLegend = (legendData: LegendProps, total: string) => {
  const { payload } = legendData;

  return (
    <>
      <Typography.Text type="secondary">Total</Typography.Text>
      <Typography.Title level={5} style={{ margin: '5px 0px' }}>
        {total}
      </Typography.Title>
      <ul className="mr-2">
        {(payload || []).map((entry, index) => (
          <li className="recharts-legend-item d-flex" key={`item-${index}`}>
            <Surface className="mr-2" height={14} version="1.1" width={14}>
              <path d="M0,4h32v24h-32z" fill={entry.color} stroke="none" />
            </Surface>
            <span style={{ color: `${entry.color}` }}>{entry.value}</span>
          </li>
        ))}
      </ul>
    </>
  );
};
