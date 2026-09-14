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

import { TaskAvailableTransition } from '../../../../generated/entity/tasks/task';
import { TaskResolutionType } from '../../../../rest/tasksAPI';

export const formatEntityType = (type?: string): string => {
  if (!type) {
    return '';
  }

  return type
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
};

export const isApproveTransition = (
  transition: TaskAvailableTransition
): boolean =>
  transition.resolutionType === TaskResolutionType.Approved ||
  transition.resolutionType === TaskResolutionType.AutoApproved ||
  transition.id === 'approve';

export const isRejectTransition = (
  transition: TaskAvailableTransition
): boolean =>
  transition.resolutionType === TaskResolutionType.Rejected ||
  transition.resolutionType === TaskResolutionType.AutoRejected ||
  transition.id === 'reject';
