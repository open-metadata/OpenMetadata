/*
 *  Copyright 2025 Collate.
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
import { Typography } from 'antd';
import React from 'react';
import { DataQualityStatCardProps } from './DataQualitySection.interface';

export const DataQualityStatCard: React.FC<DataQualityStatCardProps> = ({
  count,
  label,
  type,
  isActive,
  onClick,
}) => (
  <button
    className={`data-quality-stat-card ${type}-card ${
      isActive ? 'active' : ''
    }`}
    data-testid={`data-quality-stat-card-${type}`}
    type="button"
    onClick={onClick}>
    <Typography.Text
      className={`stat-count ${type}`}
      data-testid={`data-quality-stat-card-count-${type}`}>
      {count}
    </Typography.Text>
    <Typography.Text
      className={`stat-label ${type}`}
      data-testid={`data-quality-stat-card-label-${type}`}>
      {label}
    </Typography.Text>
  </button>
);
