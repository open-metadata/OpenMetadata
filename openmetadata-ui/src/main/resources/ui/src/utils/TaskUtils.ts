/*
 *  Copyright 2024 Collate.
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
import { EntityType } from '../enums/entity.enum';
import { Task, TaskEntityStatus } from '../rest/tasksAPI';

/**
 * Check if a task is closed (any terminal status)
 */
export const isTaskClosed = (status?: TaskEntityStatus): boolean => {
  return (
    status === TaskEntityStatus.Completed ||
    status === TaskEntityStatus.Approved ||
    status === TaskEntityStatus.Rejected ||
    status === TaskEntityStatus.Cancelled
  );
};

/**
 * Get the entity type from a task's about reference
 */
export const getTaskEntityType = (task: Task): EntityType | undefined => {
  if (!task.about?.type) {
    return undefined;
  }

  return task.about.type as EntityType;
};

/**
 * Get the entity FQN from a task's about reference
 */
export const getTaskEntityFQN = (task: Task): string | undefined => {
  return task.about?.fullyQualifiedName;
};

/**
 * Get the detail path for a task
 */
export const getTaskDetailPath = (task: Task): string => {
  const entityType = getTaskEntityType(task);
  const entityFQN = getTaskEntityFQN(task);

  if (!entityType || !entityFQN) {
    return `/tasks/${task.id}`;
  }

  return `/${entityType}/${encodeURIComponent(entityFQN)}/activity_feed/tasks/${
    task.taskId
  }`;
};
