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
import classNames from 'classnames';
import React from 'react';
import {
  DataQualityProgressSegmentProps,
  DataQualityType,
} from './DataQualitySection.interface';

export const DATA_QUALITY_FILL_CLASS: Record<DataQualityType, string> = {
  success: 'tw:bg-utility-success-500',
  aborted: 'tw:bg-utility-warning-500',
  failed: 'tw:bg-utility-error-500',
};

export const DataQualityProgressSegment: React.FC<
  DataQualityProgressSegmentProps
> = ({ percent, type }) => {
  if (percent <= 0) {
    return null;
  }

  return (
    <div
      className={classNames(
        `progress-segment ${type}`,
        'tw:h-full tw:transition-[width] tw:duration-300 tw:ease-[ease]',
        DATA_QUALITY_FILL_CLASS[type],
        type === 'aborted' && 'tw:mx-px'
      )}
      style={{ width: `${percent}%` }}
    />
  );
};
