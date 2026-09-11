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
import { t } from '../../../../utils/i18next/LocalUtil';
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

// Narrowest a lone Field control may get before its name reads as ellipses.
export const QUERY_BUILDER_FIELD_MIN_WIDTH = 'tw:min-w-[140px]';

// Control height, so the delete button sits level with the row's first line.
export const QUERY_BUILDER_CONTROL_HEIGHT = 'tw:h-10';

// Narrowest a value slot may get before a two-valued operator's slots wrap.
export const QUERY_BUILDER_VALUE_MIN_WIDTH = 'tw:min-w-[130px]';

// Explore: the only surface with user-created brackets.
export const EXPLORE_BUTTON_PRESET: QueryBuilderButtonPreset = {
  addRuleLabel: () => t('label.add-new-entity', { entity: t('label.field') }),
  testIds: {
    addRule: 'advanced-search-add-rule',
    delRule: 'advanced-search-delete-rule',
    addGroup: 'advanced-search-add-group',
    delGroup: 'advanced-search-delete-group',
  },
};

// Every form-embedded builder.
export const CONDITION_BUTTON_PRESET: QueryBuilderButtonPreset = {
  addRuleLabel: EXPLORE_BUTTON_PRESET.addRuleLabel,
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
