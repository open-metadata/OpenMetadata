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
import { Typography } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import React from 'react';
import { DATA_QUALITY_FILL_CLASS } from './DataQualityProgressSegment';
import { DataQualityLegendItemProps } from './DataQualitySection.interface';

export const DataQualityLegendItem: React.FC<DataQualityLegendItemProps> = ({
  count,
  label,
  type,
}) => {
  if (count <= 0) {
    return null;
  }

  return (
    <div className="legend-item tw:flex tw:items-center tw:gap-1">
      <span
        className={classNames(
          `legend-dot ${type}`,
          'tw:size-2 tw:shrink-0 tw:rounded-full',
          DATA_QUALITY_FILL_CLASS[type]
        )}
      />
      <span className="legend-text tw:font-medium">
        <Typography className="legend-text-label tw:text-[13px] tw:text-utility-gray-700">
          {label}
        </Typography>
        <Typography className="legend-text-value tw:ml-0.5 tw:text-[13px] tw:text-utility-gray-900">
          {count}
        </Typography>
      </span>
    </div>
  );
};
