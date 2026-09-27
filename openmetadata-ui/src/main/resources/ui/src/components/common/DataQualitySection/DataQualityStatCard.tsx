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
import {
  DataQualityStatCardProps,
  DataQualityType,
} from './DataQualitySection.interface';

// Count and label inherit the button colour, so hover/active tint both at once.
const TYPE_ACCENT_CLASS: Record<
  DataQualityType,
  { hover: string; active: string }
> = {
  success: {
    hover:
      'tw:hover:text-[var(--om-legacy-color-027a48)] tw:dark:hover:text-utility-success-700',
    active:
      'tw:bg-utility-success-50 tw:text-[var(--om-legacy-color-027a48)] tw:dark:text-utility-success-700',
  },
  aborted: {
    hover: 'tw:hover:text-utility-warning-700',
    active: 'tw:bg-utility-warning-50 tw:text-utility-warning-700',
  },
  failed: {
    hover: 'tw:hover:text-utility-error-700',
    active: 'tw:bg-utility-error-50 tw:text-utility-error-700',
  },
};

export const DataQualityStatCard: React.FC<DataQualityStatCardProps> = ({
  count,
  label,
  type,
  isActive,
  onClick,
}) => (
  <button
    className={classNames(
      `data-quality-stat-card ${type}-card`,
      'tw:m-2 tw:flex tw:flex-1 tw:cursor-pointer tw:appearance-none tw:flex-col tw:items-center tw:justify-center',
      'tw:border tw:border-transparent tw:bg-transparent tw:p-0 tw:text-[13px] tw:text-utility-gray-600 tw:outline-none',
      'tw:transition-[background-color,border-color,border-radius] tw:duration-200 tw:ease-[ease]',
      TYPE_ACCENT_CLASS[type].hover,
      isActive && ['active tw:rounded-md', TYPE_ACCENT_CLASS[type].active]
    )}
    data-testid={`data-quality-stat-card-${type}`}
    type="button"
    onClick={onClick}>
    <Typography
      className={`stat-count ${type} tw:block tw:font-semibold`}
      data-testid={`data-quality-stat-card-count-${type}`}>
      {count}
    </Typography>
    <Typography
      className={`stat-label ${type} tw:block tw:font-normal`}
      data-testid={`data-quality-stat-card-label-${type}`}>
      {label}
    </Typography>
  </button>
);
