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
import { EntityType } from '../../../../enums/entity.enum';
import {
  Task,
  TaskCategory,
  TaskType,
} from '../../../../generated/entity/tasks/task';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import Fqn from '../../../../utils/Fqn';
import {
  getPlainDescription,
  resolveIncidentTestCaseFqn,
} from './taskDetail.utils';

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

export interface TaskTitleParts {
  title: string;
  /**
   * The kind of asset a composed title names ("testCase"), shown beside the
   * title as a badge. Unset for a title someone wrote.
   */
  entityType?: string;
}

// "<type message> <entity>", as the entity-page task card reads it:
// "Request TestCase Failure Resolution for orders_rows", with the entity type
// returned apart so it can be drawn as a badge.
const getPrefixedEntityTitle = (
  task: Task,
  t?: TFunction
): TaskTitleParts | undefined => {
  const prefix = getTaskTypeLabel(task, t);
  const entity = getTitleEntity(task);

  return prefix && entity?.name
    ? { title: `${prefix} ${entity.name}`, entityType: entity.type }
    : undefined;
};

/**
 * The title to show for a task, and — when it is composed rather than written
 * — the type of the asset it names.
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
export const getTaskTitleParts = (
  task: Task,
  t?: TFunction
): TaskTitleParts => {
  const authored = getAuthoredTaskTitle(task);
  if (authored) {
    return { title: authored };
  }

  return (
    getPrefixedEntityTitle(task, t) ?? {
      // A title is one run of text; the description's lines join with spaces.
      title: getPlainDescription(task).replace(/\n/g, ' ') || task.taskId || '',
    }
  );
};

export const getTaskTitle = (task: Task, t?: TFunction): string =>
  getTaskTitleParts(task, t).title;

// Fewer leading words than this are too common ("Request") to read as a type.
const MIN_TYPE_WORDS = 2;

export interface TaskTitleSearch {
  // Task types whose composed title the search opens with; empty for plain text.
  types: string[];
  // What is left for the server to match against the task's stored fields.
  text: string;
}

const toWords = (value: string) => value.trim().split(/\s+/).filter(Boolean);

// How many of the search's leading words a title prefix starts with. The last
// search word may be half-typed, so it need only start that prefix word.
const countPrefixWords = (search: string[], prefix: string[]) => {
  let count = 0;
  while (count < search.length && count < prefix.length) {
    const isLast = count === search.length - 1;
    const word = search[count];
    const matches = isLast
      ? prefix[count].startsWith(word)
      : prefix[count] === word;
    if (!matches) {
      break;
    }
    count++;
  }

  return count;
};

/**
 * Read a search the way a composed task title reads. A composed title opens
 * with its task type ("Request TestCase Failure Resolution for orders"), which
 * the server never stores. A search that opens with at least two words of a
 * type's prefix names that type, and the words after it go to the server; any
 * other search is plain text. The prefix is compared in the viewer's language.
 */
export const splitTaskTitleSearch = (
  query: string,
  t: TFunction
): TaskTitleSearch => {
  const words = toWords(query);
  const lowered = words.map((word) => word.toLowerCase());
  let best = 0;
  let types: string[] = [];

  Object.entries(TASK_TYPE_MESSAGE_KEYS).forEach(([type, key]) => {
    const label = t(key);
    if (!label || label === key) {
      return;
    }
    const count = countPrefixWords(lowered, toWords(label.toLowerCase()));
    if (count > best) {
      best = count;
      types = [type];
    } else if (count === best && count > 0) {
      types.push(type);
    }
  });

  return best >= MIN_TYPE_WORDS
    ? { types, text: words.slice(best).join(' ') }
    : { types: [], text: words.join(' ') };
};
