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

import { ViewDataInterface } from '../../../../utils/executionUtils';

// Task metrics come only from producers that push them through the status API
// (no built-in connector sends them), so their columns appear only when the
// listed runs report them (ADR:2026-11-04-pipeline-execution-metric-columns-render-only-when-reported).
export const OPTIONAL_COLUMN_KEYS: ReadonlyArray<keyof ViewDataInterface> = [
  'rowsRead',
  'rowsWritten',
  'logLink',
];

export const LIST_VIEW_SCROLL = { x: 'max-content' } as const;
