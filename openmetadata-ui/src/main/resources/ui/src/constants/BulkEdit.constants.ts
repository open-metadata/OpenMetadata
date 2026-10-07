/*
 *  Copyright 2025 Collate.
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
import { VALIDATION_STEP } from './BulkImport.constant';

export const ENTITY_BULK_EDIT_STEPS = [
  {
    name: 'label.preview-and-edit',
    step: VALIDATION_STEP.EDIT_VALIDATE,
  },
  {
    name: 'label.update',
    step: VALIDATION_STEP.UPDATE,
  },
];

// The spreadsheet owns its cells; scope token overrides to its boundary while
// retaining the published light palette and the grid's keyboard/editing behavior.
export const CSV_GRID_DARK_CLASS = [
  'tw:dark:border-secondary!',
  'tw:dark:[&_.rdg]:bg-primary! tw:dark:[&_.rdg]:text-primary!',
  'tw:dark:[&_.rdg]:[--rdg-row-hover-background-color:var(--tw-color-bg-primary_hover)]! ' +
    'tw:dark:[&_.rdg]:[--rdg-row-selected-background-color:var(--tw-color-bg-primary)]! ' +
    'tw:dark:[&_.rdg]:[--rdg-row-selected-hover-background-color:var(--tw-color-bg-primary_hover)]!',
  'tw:dark:[&_.rdg-row]:bg-primary! tw:dark:[&_.rdg-header-row]:bg-secondary! tw:dark:[&_.rdg-header-row]:text-secondary!',
  'tw:dark:[&_.rdg-cell]:border-secondary! tw:dark:[&_.rdg-cell]:text-primary!',
  'tw:dark:[&_.rdg-cell-edited]:bg-primary! tw:dark:[&_.rdg-cell[aria-selected=true]]:bg-primary! tw:dark:[&_.rdg-cell-selected]:bg-primary!',
  'tw:dark:[&_.rdg-cell-locked]:bg-secondary! tw:dark:[&_.rdg-cell-locked]:text-tertiary!',
  // Legacy operation tints are painted on cells, not rows. Leave locked and
  // actively edited/error cells to their dedicated states below.
  'tw:dark:[&_.bulk-edit-op-row-update_.rdg-cell]:bg-success-primary! ' +
    'tw:dark:[&_.bulk-edit-op-row-create_.rdg-cell]:bg-brand-primary! ' +
    'tw:dark:[&_.bulk-edit-op-row-skip_.rdg-cell]:bg-error-primary!',
  'tw:dark:[&_.bulk-edit-row-highlight_.rdg-cell]:bg-brand-primary!',
  'tw:dark:[&_.rdg-row_.rdg-cell.rdg-cell-edited]:bg-primary! ' +
    'tw:dark:[&_.rdg-row_.rdg-cell[aria-selected=true]]:bg-primary! ' +
    'tw:dark:[&_.rdg-row_.rdg-cell.rdg-cell-selected]:bg-primary! ' +
    'tw:dark:[&_.rdg-row_.rdg-cell.rdg-cell-locked]:bg-secondary! ' +
    'tw:dark:[&_.rdg-row_.rdg-cell.rdg-cell-required-error]:bg-error-primary!',
  'tw:dark:[&_input]:text-primary! tw:dark:[&_textarea]:text-primary! tw:dark:[&_.ant-select-selection-item]:text-primary!',
].join(' ');
