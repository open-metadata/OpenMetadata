/*
 *  Copyright 2026 Collate.
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

import {
  AlertTriangle,
  Archive,
  CheckCircle,
  File02,
  Key01,
  Star01,
  Tag01,
  Users01,
} from '@untitledui/icons';
import classNames from 'classnames';
import React from 'react';
import { TaskTypeBadge, TaskTypeIconKey } from '../taskDetail.types';

export const TASK_TYPE_ICON: Record<TaskTypeIconKey, typeof CheckCircle> = {
  access: Key01,
  approval: CheckCircle,
  deprecation: Archive,
  description: File02,
  incident: AlertTriangle,
  ownership: Users01,
  tag: Tag01,
  tier: Star01,
};

// Tint per badge colour, so a row's icon, its group's dot and the detail
// header's chip all read as the same type.
const TINT_CLASS: Record<string, string> = {
  error: 'tw:bg-utility-error-50 tw:text-utility-error-600',
  blue: 'tw:bg-utility-blue-50 tw:text-utility-blue-600',
  'blue-light': 'tw:bg-utility-blue-light-50 tw:text-utility-blue-light-600',
  purple: 'tw:bg-utility-purple-50 tw:text-utility-purple-600',
  orange: 'tw:bg-utility-orange-50 tw:text-utility-orange-600',
  indigo: 'tw:bg-utility-indigo-50 tw:text-utility-indigo-600',
  brand: 'tw:bg-utility-brand-50 tw:text-utility-brand-600',
  gray: 'tw:bg-utility-gray-50 tw:text-utility-gray-600',
};

/** Solid tone for a group header's dot, matching the type's tint. */
export const TASK_TYPE_DOT_CLASS: Record<string, string> = {
  error: 'tw:bg-utility-error-500',
  blue: 'tw:bg-utility-blue-500',
  'blue-light': 'tw:bg-utility-blue-light-500',
  purple: 'tw:bg-utility-purple-500',
  orange: 'tw:bg-utility-orange-500',
  indigo: 'tw:bg-utility-indigo-500',
  brand: 'tw:bg-utility-brand-500',
  gray: 'tw:bg-utility-gray-500',
};

export interface TaskTypeIconProps {
  badge: TaskTypeBadge;
}

/** The task type as a small tinted tile, shown at the start of each list row. */
const TaskTypeIcon: React.FC<TaskTypeIconProps> = ({ badge }) => {
  const Icon = TASK_TYPE_ICON[badge.icon];

  return (
    <span
      aria-hidden
      className={classNames(
        'tw:flex tw:size-7 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg',
        TINT_CLASS[badge.color] ?? TINT_CLASS.gray
      )}
      data-testid="task-type-icon">
      <Icon height={14} width={14} />
    </span>
  );
};

export default TaskTypeIcon;
