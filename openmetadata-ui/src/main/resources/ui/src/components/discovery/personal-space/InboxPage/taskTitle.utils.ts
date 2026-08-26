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

import { Task } from '../../../../generated/entity/tasks/task';

/**
 * The human-written task title, or `undefined` when the task has none.
 *
 * Tasks nobody typed a title for — opened by a governance workflow with no
 * `taskName`/`taskDisplayName` start variable, migrated from the legacy
 * threads-based tasks, or POSTed without a `name` — get `name` defaulted to the
 * taskId server-side (`TaskRepository.prepare`). Rendering that beside
 * `#<taskId>` printed the same string twice, so treat it as titleless and let
 * callers show the id alone.
 */
export const getTaskTitle = (task: Task): string | undefined => {
  const title = task.displayName ?? task.name;

  return !title || title === task.taskId ? undefined : title;
};
