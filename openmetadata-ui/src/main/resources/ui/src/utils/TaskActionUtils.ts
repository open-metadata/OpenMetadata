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
import { Duration } from 'luxon';
import { ReactComponent as CancelColored } from '../assets/svg/cancel-colored.svg';
import { ReactComponent as EditSuggestionIcon } from '../assets/svg/edit-new.svg';
import { ReactComponent as CloseIcon } from '../assets/svg/ic-close-circle.svg';
import { ReactComponent as CheckIcon } from '../assets/svg/ic-tick-circle.svg';
import { TaskType } from '../generated/entity/feed/thread';
import {
  TaskActionMode,
  type TaskAction,
} from '../pages/TasksPage/TasksPage.interface';
import { TaskEntityType, type Task as TaskEntity } from '../rest/tasksAPI';
import { t } from './i18next/LocalUtil';

export const TASK_ACTION_COMMON_ITEM: TaskAction[] = [
  {
    label: t('label.close'),
    key: TaskActionMode.CLOSE,
    icon: CancelColored,
  },
];

export const TASK_ACTION_LIST: TaskAction[] = [
  {
    label: t('label.accept-suggestion'),
    key: TaskActionMode.VIEW,
    icon: CheckIcon,
  },
  {
    label: t('label.edit-suggestion'),
    key: TaskActionMode.EDIT,
    icon: EditSuggestionIcon,
  },
  {
    label: t('label.close'),
    key: TaskActionMode.CLOSE,
    icon: CloseIcon,
  },
];

export const GLOSSARY_TASK_ACTION_LIST: TaskAction[] = [
  {
    label: t('label.approve'),
    key: TaskActionMode.RESOLVE,
    icon: CheckIcon,
  },
  {
    label: t('label.reject'),
    key: TaskActionMode.CLOSE,
    icon: CloseIcon,
  },
];

export const INCIDENT_TASK_ACTION_LIST: TaskAction[] = [
  {
    label: t('label.re-assign'),
    key: TaskActionMode.RE_ASSIGN,
    icon: EditSuggestionIcon,
  },
  {
    label: t('label.resolve'),
    key: TaskActionMode.RESOLVE,
    icon: CloseIcon,
  },
];

export const isDescriptionTask = (taskType: TaskType) =>
  [TaskType.RequestDescription, TaskType.UpdateDescription].includes(taskType);

export const isTagsTask = (taskType: TaskType) =>
  [TaskType.RequestTag, TaskType.UpdateTag].includes(taskType);

export const isDescriptionTaskType = (taskType: TaskEntityType) =>
  [TaskEntityType.DescriptionUpdate].includes(taskType);

export const isTagsTaskType = (taskType: TaskEntityType) =>
  [TaskEntityType.TagUpdate].includes(taskType);

export const isRecognizerFeedbackTask = (task: TaskEntity) => {
  const taskType = task.type as unknown as string;
  const hasFeedbackPayload =
    Boolean(task.payload) &&
    typeof task.payload === 'object' &&
    'feedback' in (task.payload as Record<string, unknown>);

  return (
    hasFeedbackPayload &&
    (task.type === TaskEntityType.DataQualityReview ||
      taskType === 'RecognizerFeedbackApproval')
  );
};

export const isDarApprovalActive = (
  approvedAt?: number,
  duration?: string,
  expirationDate?: number
): boolean => {
  const now = Date.now();

  if (expirationDate != null) {
    return now <= expirationDate;
  }

  if (!duration || !approvedAt) {
    return true;
  }

  const parsed = Duration.fromISO(duration);

  return parsed.isValid && now <= approvedAt + parsed.toMillis();
};

export const getDarButtonTooltip = (
  isDarDisabled: boolean,
  isDarGranted: boolean,
  isDarAwaitingGrant: boolean,
  t: (key: string) => string
): string | undefined => {
  if (!isDarDisabled) {
    return undefined;
  }
  if (isDarGranted) {
    return t('message.data-access-request-already-granted');
  }
  if (isDarAwaitingGrant) {
    return t('message.data-access-request-awaiting-grant-message');
  }

  return t('message.data-access-request-already-exists');
};
