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

/**
 * Figma gives the three columns 320 / 164 / 320 at a 901px modal — so not
 * equal thirds. Kept as ratios rather than pixels so the row still fills a
 * narrower panel.
 */
export const QUERY_BUILDER_COLUMN_RATIOS = '80fr 41fr 80fr';

/** What each further drill level adds to the Field column's share. */
const QUERY_BUILDER_DRILL_COLUMN_RATIO = 40;

/**
 * Floor for the operator column once the Field column grows. Without it a
 * drilled rule in a narrow panel truncates the operator to `Operato`.
 */
const QUERY_BUILDER_OPERATOR_MIN_WIDTH = 120;

/**
 * The row's columns for a rule showing `fieldCells` Field controls. Figma
 * only draws the single-field case; a drilled rule would otherwise split that
 * one column three ways and truncate every label, so the Field column grows
 * with the levels and the value column gives up the room.
 */
export const getQueryBuilderColumnRatios = (fieldCells: number): string =>
  fieldCells > 1
    ? `${
        80 + QUERY_BUILDER_DRILL_COLUMN_RATIO * (fieldCells - 1)
      }fr minmax(${QUERY_BUILDER_OPERATOR_MIN_WIDTH}px, 41fr) 80fr`
    : QUERY_BUILDER_COLUMN_RATIOS;

/** Widget-less operators (`is null`) still occupy their column, empty. */
export const QUERY_BUILDER_OPERATOR_NO_VALUE = 0;

/**
 * Base testid of a row's Field control. Levels beyond the first are suffixed
 * with their depth (`-1`, `-2`), so a drilled rule stays addressable without
 * a positional locator while an ordinary rule keeps the plain id.
 */
export const QUERY_BUILDER_FIELD_TEST_ID = 'advanced-search-field-select';

/**
 * Narrowest a Field control may get before its level wraps to the next line.
 * Below this the entity and property names read as ellipses.
 */
export const QUERY_BUILDER_FIELD_MIN_WIDTH = 'tw:min-w-[140px]';
