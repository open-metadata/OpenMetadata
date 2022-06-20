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

import { TabSpecificField } from '../enums/entity.enum';
import {
  Pipeline,
  StatusType,
  TaskStatus,
} from '../generated/entity/data/pipeline';
import { Icons } from './SvgUtils';

export const defaultFields = `${TabSpecificField.FOLLOWERS}, ${TabSpecificField.TAGS}, ${TabSpecificField.OWNER},
${TabSpecificField.TASKS}, ${TabSpecificField.PIPELINE_STATUS}`;

export const pipelineDetailsTabs = [
  {
    name: 'Details',
    path: 'details',
  },
  {
    name: 'Activity Feed',
    path: 'activity_feed',
    field: TabSpecificField.ACTIVITY_FEED,
  },
  {
    name: 'Lineage',
    path: 'lineage',
    field: TabSpecificField.LINEAGE,
  },
  {
    name: 'Manage',
    path: 'manage',
  },
];

export const getCurrentPipelineTab = (tab: string) => {
  let currentTab = 1;
  switch (tab) {
    case 'activity_feed':
      currentTab = 2;

      break;

    case 'lineage':
      currentTab = 3;

      break;

    case 'manage':
      currentTab = 4;

      break;

    case 'details':
    default:
      currentTab = 1;

      break;
  }

  return currentTab;
};

export const getModifiedPipelineStatus = (
  status: StatusType,
  pipelineStatus: Pipeline['pipelineStatus'] = []
) => {
  const data = pipelineStatus
    .map((statusValue) => {
      return statusValue.taskStatus?.map((task) => ({
        executionDate: statusValue.executionDate,
        executionStatus: task.executionStatus,
        name: task.name,
      }));
    })
    .flat(1);

  if (!status) {
    return data;
  } else {
    return data.filter((d) => d?.executionStatus === status);
  }
};

export const getFilteredPipelineStatus = (
  status: StatusType,
  pipelineStatus: Pipeline['pipelineStatus'] = []
) => {
  if (!status) {
    return pipelineStatus;
  } else {
    return pipelineStatus.filter((d) => d?.executionStatus === status);
  }
};

export const getTaskExecStatus = (taskName: string, tasks: TaskStatus[]) => {
  return tasks.find((task) => task.name === taskName)?.executionStatus || '';
};

export const STATUS_OPTIONS = [
  { value: StatusType.Successful, label: StatusType.Successful },
  { value: StatusType.Failed, label: StatusType.Failed },
  { value: StatusType.Pending, label: StatusType.Pending },
];

export const getStatusBadgeIcon = (status: StatusType) => {
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
