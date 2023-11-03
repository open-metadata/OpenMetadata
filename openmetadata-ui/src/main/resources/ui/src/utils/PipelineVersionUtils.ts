/*
 *  Copyright 2023 Collate.
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

import { cloneDeep, isEqual, uniqBy } from 'lodash';
import { EntityField } from '../constants/Feeds.constants';
import { ChangeDescription, Pipeline } from '../generated/entity/data/pipeline';
import { TagLabel } from '../generated/type/tagLabel';
import { EntityDiffProps } from '../interface/EntityVersion.interface';
import { VersionData } from '../pages/EntityVersionPage/EntityVersionPage.component';
import {
  getAllChangedEntityNames,
  getAllDiffByFieldName,
  getChangeColumnNameFromDiffValue,
  getChangedEntityNewValue,
  getChangedEntityOldValue,
  getDiffByFieldName,
  getTagsDiff,
  getTextDiff,
  isEndsWithField,
} from './EntityVersionUtils';
import { TagLabelWithStatus } from './EntityVersionUtils.interface';

const handleTaskDescriptionChangeDiff = (
  tasksDiff: EntityDiffProps,
  taskList: Pipeline['tasks'] = [],
  changedTaskName?: string
) => {
  const oldDescription = getChangedEntityOldValue(tasksDiff);
  const newDescription = getChangedEntityNewValue(tasksDiff);

  taskList?.forEach((i) => {
    if (isEqual(i.name, changedTaskName)) {
      i.description = getTextDiff(
        oldDescription,
        newDescription,
        i.description
      );
    }
  });

  return taskList;
};

const handleTaskTagChangeDiff = (
  tasksDiff: EntityDiffProps,
  taskList: Pipeline['tasks'] = [],
  changedTaskName?: string
) => {
  const oldTags: Array<TagLabel> = JSON.parse(
    getChangedEntityOldValue(tasksDiff) ?? '[]'
  );
  const newTags: Array<TagLabel> = JSON.parse(
    getChangedEntityNewValue(tasksDiff) ?? '[]'
  );

  taskList?.forEach((i) => {
    if (isEqual(i.name, changedTaskName)) {
      const flag: { [x: string]: boolean } = {};
      const uniqueTags: Array<TagLabelWithStatus> = [];
      const tagsDiff = getTagsDiff(oldTags, newTags);
      [...tagsDiff, ...(i.tags as Array<TagLabelWithStatus>)].forEach(
        (elem: TagLabelWithStatus) => {
          if (!flag[elem.tagFQN]) {
            flag[elem.tagFQN] = true;
            uniqueTags.push(elem);
          }
        }
      );
      i.tags = uniqueTags;
    }
  });

  return taskList;
};

const handleTaskDiffAdded = (
  tasksDiff: EntityDiffProps,
  taskList: Pipeline['tasks'] = []
) => {
  const newTask: Pipeline['tasks'] = JSON.parse(
    tasksDiff.added?.newValue ?? '[]'
  );
  newTask?.forEach((task) => {
    const formatTaskData = (arr: Pipeline['tasks']) => {
      arr?.forEach((i) => {
        if (isEqual(i.name, task.name)) {
          i.tags = task.tags?.map((tag) => ({ ...tag, added: true }));
          i.description = getTextDiff('', task.description ?? '');
          i.taskType = getTextDiff('', task.taskType ?? '');
          i.name = getTextDiff('', task.name);
          i.displayName = getTextDiff('', task.displayName ?? '');
        }
      });
    };
    formatTaskData(taskList);
  });

  return taskList;
};

const getDeletedTasks = (tasksDiff: EntityDiffProps) => {
  const newTask: Pipeline['tasks'] = JSON.parse(
    tasksDiff.deleted?.oldValue ?? '[]'
  );

  return newTask?.map((task) => ({
    ...task,
    tags: task.tags?.map((tag) => ({ ...tag, removed: true })),
    description: getTextDiff(task.description ?? '', ''),
    taskType: getTextDiff(task.taskType ?? '', ''),
    name: getTextDiff(task.name, ''),
    displayName: getTextDiff(task.displayName ?? '', ''),
  }));
};

export const getUpdatedPipelineTasks = (
  currentVersionData: VersionData,
  changeDescription: ChangeDescription
) => {
  const taskList = cloneDeep((currentVersionData as Pipeline).tasks ?? []);
  const tasksDiff = getAllDiffByFieldName(EntityField.TASKS, changeDescription);
  const changedFields = getAllChangedEntityNames(tasksDiff);

  let newTasksList = cloneDeep(taskList);

  changedFields?.forEach((changedField) => {
    const taskDiff = getDiffByFieldName(changedField, changeDescription);
    const changedTaskName = getChangeColumnNameFromDiffValue(changedField);

    if (isEndsWithField(EntityField.DESCRIPTION, changedField)) {
      newTasksList = handleTaskDescriptionChangeDiff(
        taskDiff,
        taskList,
        changedTaskName
      );
    } else if (isEndsWithField(EntityField.TAGS, changedField)) {
      newTasksList = handleTaskTagChangeDiff(
        taskDiff,
        taskList,
        changedTaskName
      );
    } else {
      const tasksDiff = getDiffByFieldName(
        EntityField.TASKS,
        changeDescription,
        true
      );
      if (tasksDiff.added) {
        newTasksList = handleTaskDiffAdded(tasksDiff, taskList);
      }
      if (tasksDiff.deleted) {
        const deletedTasks = getDeletedTasks(tasksDiff);
        newTasksList.unshift(...(deletedTasks ?? []));
      }
    }
  });

  return uniqBy(newTasksList, 'name');
};
