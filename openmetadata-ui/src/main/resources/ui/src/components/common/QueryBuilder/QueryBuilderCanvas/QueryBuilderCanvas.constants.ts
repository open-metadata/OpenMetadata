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
import type { QueryBuilderButtonPreset } from './QueryBuilderCanvas.types';

// Figma gives the three columns 320 / 164 / 320 at a 901px modal — so not equal thirds.
export const QUERY_BUILDER_COLUMN_RATIOS = '80fr 41fr 80fr';

// Narrowest a control in a drilled row may get before the row rewraps.
const QUERY_BUILDER_DRILL_CONTROL_MIN_WIDTH = 150;

// The row's columns for a rule showing `fieldCells` Field controls.
export const getQueryBuilderColumnRatios = (fieldCells: number): string =>
  fieldCells > 1
    ? `repeat(auto-fit, minmax(${QUERY_BUILDER_DRILL_CONTROL_MIN_WIDTH}px, 1fr))`
    : QUERY_BUILDER_COLUMN_RATIOS;

// Base testid of a row's Field control.
export const QUERY_BUILDER_FIELD_TEST_ID = 'advanced-search-field-select';

// Explore: the only surface with user-created brackets.
export const EXPLORE_BUTTON_PRESET: QueryBuilderButtonPreset = {
  testIds: {
    addRule: 'advanced-search-add-rule',
    delRule: 'advanced-search-delete-rule',
    addGroup: 'advanced-search-add-group',
    delGroup: 'advanced-search-delete-group',
  },
};

// Every form-embedded builder.
export const CONDITION_BUTTON_PRESET: QueryBuilderButtonPreset = {
  testIds: {
    addRule: 'add-condition-button',
    delRule: 'delete-condition-button',
    addGroup: 'add-group-condition-button',
    delGroup: 'delete-group-condition-button',
  },
};

// Persona AI Context differs only in the add-rule testid Playwright uses.
export const PERSONA_BUTTON_PRESET: QueryBuilderButtonPreset = {
  ...CONDITION_BUTTON_PRESET,
  testIds: {
    ...CONDITION_BUTTON_PRESET.testIds,
    addRule: 'add-context-condition',
  },
};
