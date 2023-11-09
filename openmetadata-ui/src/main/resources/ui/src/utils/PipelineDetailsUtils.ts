/*
 *  Copyright 2022 Collate.
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

import { isUndefined } from 'lodash';
import { TabSpecificField } from '../enums/entity.enum';
import {
  Pipeline,
  StatusType,
  TaskStatus,
} from '../generated/entity/data/pipeline';
import { sortTagsCaseInsensitive } from './CommonUtils';
import { Icons } from './SvgUtils';

export const defaultFields = `${TabSpecificField.FOLLOWERS}, ${TabSpecificField.TAGS}, ${TabSpecificField.OWNER},
${TabSpecificField.TASKS}, ${TabSpecificField.PIPELINE_STATUS}, ${TabSpecificField.DOMAIN},${TabSpecificField.DATA_PRODUCTS},${TabSpecificField.VOTES}`;

export const getTaskExecStatus = (taskName: string, tasks: TaskStatus[]) => {
  return tasks.find((task) => task.name === taskName)?.executionStatus || '';
};

export const getStatusBadgeIcon = (status?: StatusType) => {
  switch (status) {
    case StatusType.Successful:
      return Icons.SUCCESS_BADGE;

    case StatusType.Failed:
      return Icons.FAIL_BADGE;

    case StatusType.Pending:
      return Icons.PENDING_BADGE;

    default:
      return '';
  }
};

export const getFormattedPipelineDetails = (
  pipelineDetails: Pipeline
): Pipeline => {
  if (pipelineDetails.tasks) {
    const updatedTasks = pipelineDetails.tasks.map((task) => ({
      ...task,
      // Sorting tags as the response of PATCH request does not return the sorted order
      // of tags, but is stored in sorted manner in the database
      // which leads to wrong PATCH payload sent after further tags removal
      tags: isUndefined(task.tags)
        ? undefined
        : sortTagsCaseInsensitive(task.tags),
    }));

    return { ...pipelineDetails, tasks: updatedTasks };
  } else {
    return pipelineDetails;
  }
};
