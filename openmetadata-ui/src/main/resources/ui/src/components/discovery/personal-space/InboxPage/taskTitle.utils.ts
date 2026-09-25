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
import {
  Task,
  TaskCategory,
  TaskType,
} from '../../../../generated/entity/tasks/task';
import { EntityType } from '../../../../enums/entity.enum';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import Fqn from '../../../../utils/Fqn';
import { resolveIncidentTestCaseFqn } from './taskDetail.utils';

// `TASK_ENTITY_TYPES` is keyed by the createTask `TaskType` enum while a Task
// carries the identically-valued entity enum, so index it by the raw value.
const TASK_TYPE_MESSAGE_KEYS = TASK_ENTITY_TYPES as Record<string, string>;

// The server names incident tasks itself ("Test Case Incident - <test case
// display name>"), and a test case usually has no display name, so the title
// reads "… - null". Nobody wrote it: compose one instead, as the entity-page
// task card does.
const isSystemTitled = (task: Task) =>
  task.category === TaskCategory.Incident ||
  task.type === TaskType.TestCaseResolution ||
  task.type === TaskType.IncidentResolution;

// An author-supplied title wins; the id-derived default is not a title.
// Extracted so this lookup doesn't add to the cyclomatic complexity of
// getTaskTitle that calls it.
const getAuthoredTaskTitle = (task: Task) =>
  isSystemTitled(task)
    ? undefined
    : [task.displayName, task.name]
        .map((value) => value?.trim())
        .find((value) => value && value !== task.taskId);

// Several task-type message keys are unset upstream and i18next echoes the
// key back — that must never reach the UI, so treat it as no label.
const getTaskTypeLabel = (task: Task, t?: TFunction) => {
  const typeKey = TASK_TYPE_MESSAGE_KEYS[task.type ?? ''];
  const typeLabel = typeKey && t ? t(typeKey) : '';

  return typeLabel && typeLabel !== typeKey ? typeLabel : '';
};

// What the task is about: its `about` reference, or — for an incident that
// names none — the failing test case read off its description.
const getTitleEntity = (task: Task) => {
  if (task.about) {
    return { name: getEntityName(task.about), type: task.about.type };
  }
  const testCaseFqn = resolveIncidentTestCaseFqn(task);

  return testCaseFqn
    ? { name: Fqn.split(testCaseFqn).pop() ?? '', type: EntityType.TEST_CASE }
    : undefined;
};

// "<type message> <entity> (<entity type>)", as the entity-page task card
// reads: "Request TestCase Failure Resolution for orders_rows (testCase)".
const getPrefixedEntityTitle = (task: Task, t?: TFunction) => {
  const prefix = getTaskTypeLabel(task, t);
  const entity = getTitleEntity(task);
  const entityType = entity?.type ? ` (${entity.type})` : '';

  return prefix && entity?.name ? `${prefix} ${entity.name}${entityType}` : '';
};

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
  const authored = getAuthoredTaskTitle(task);
  const prefixedEntity = getPrefixedEntityTitle(task, t);
  const preferredTitle = authored || prefixedEntity || task.description?.trim();

  return preferredTitle || task.taskId || '';
};
