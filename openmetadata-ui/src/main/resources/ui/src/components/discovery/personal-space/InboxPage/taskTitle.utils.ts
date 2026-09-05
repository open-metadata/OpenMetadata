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

import { TFunction } from 'i18next';
import { TASK_ENTITY_TYPES } from '../../../../constants/Task.constant';
import { Task } from '../../../../generated/entity/tasks/task';
import { getEntityName } from '../../../../utils/EntityNameUtils';

// `TASK_ENTITY_TYPES` is keyed by the createTask `TaskType` enum while a Task
// carries the identically-valued entity enum, so index it by the raw value.
const TASK_TYPE_MESSAGE_KEYS = TASK_ENTITY_TYPES as Record<string, string>;

/**
 * The title to show for a task.
 *
 * A Task has no title field, and `name` is defaulted to the taskId server-side
 * (`TaskRepository.prepare`) for anything opened without one — every governance
 * workflow — so `displayName ?? name` just repeats `#<taskId>`. For those,
 * compose the title from the task type and the entity the task is about, the
 * way the entity-page Task tab does, then fall back to the description.
 *
 * `t` is optional: without it the task-type prefix is skipped and the title
 * falls back to the authored value / description / taskId, so callers that
 * don't have a translator on hand still get a sensible title.
 */
export const getTaskTitle = (task: Task, t?: TFunction): string => {
  // An author-supplied title wins; the id-derived default is not a title.
  const authored = [task.displayName, task.name]
    .map((value) => value?.trim())
    .find((value) => value && value !== task.taskId);

  const typeKey = TASK_TYPE_MESSAGE_KEYS[task.type ?? ''];
  const typeLabel = typeKey && t ? t(typeKey) : '';
  // Several task-type message keys are unset upstream and i18next echoes the
  // key back — that must never reach the UI, so treat it as no label.
  const prefix = typeLabel && typeLabel !== typeKey ? typeLabel : '';
  const entityName = task.about ? getEntityName(task.about) : '';
  const prefixedEntity = prefix && entityName ? `${prefix} ${entityName}` : '';
  const preferredTitle = authored || prefixedEntity || task.description?.trim();

  return preferredTitle || task.taskId || '';
};
