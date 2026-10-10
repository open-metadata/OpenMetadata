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
import { BadgeWithDot, Typography } from '@openmetadata/ui-core-components';
import React from 'react';
import {
  DataQualityLegendItemProps,
  DataQualityType,
} from './DataQualitySection.interface';

const LEGEND_BADGE_COLOR: Record<
  DataQualityType,
  'success' | 'warning' | 'error'
> = {
  success: 'success',
  aborted: 'warning',
  failed: 'error',
};

export const DataQualityLegendItem: React.FC<DataQualityLegendItemProps> = ({
  count,
  label,
  type,
}) => {
  if (count <= 0) {
    return null;
  }

  return (
    <BadgeWithDot
      className={`legend-item ${type}`}
      color={LEGEND_BADGE_COLOR[type]}
      size="sm">
      <Typography>{label}</Typography>
      <Typography>{count}</Typography>
    </BadgeWithDot>
  );
};
