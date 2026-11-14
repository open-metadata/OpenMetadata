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

/** The Typography sizes a task title is set in. */
export type TaskTitleSize = 'text-sm' | 'text-md';

// The title's own text size on the badge's box, so `1lh` is one title line.
export const TASK_TITLE_LINE_CLASS: Record<TaskTitleSize, string> = {
  'text-sm': 'tw:text-sm',
  'text-md': 'tw:text-md',
};
