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

/** Narrowest a control in a drilled row may get before the row rewraps. */
const QUERY_BUILDER_DRILL_CONTROL_MIN_WIDTH = 150;

/**
 * The row's columns for a rule showing `fieldCells` Field controls. Figma draws
 * only the single-field case; holding its proportions once a level joins the
 * row pushed the value past the panel's edge, so a drilled row is sized to wrap.
 */
export const getQueryBuilderColumnRatios = (fieldCells: number): string =>
  fieldCells > 1
    ? `repeat(auto-fit, minmax(${QUERY_BUILDER_DRILL_CONTROL_MIN_WIDTH}px, 1fr))`
    : QUERY_BUILDER_COLUMN_RATIOS;

/**
 * Base testid of a row's Field control. Levels beyond the first are suffixed
 * with their depth (`-1`, `-2`), so a drilled rule stays addressable without
 * a positional locator while an ordinary rule keeps the plain id.
 */
export const QUERY_BUILDER_FIELD_TEST_ID = 'advanced-search-field-select';

/** Narrowest a lone Field control may get before its name reads as ellipses. */
export const QUERY_BUILDER_FIELD_MIN_WIDTH = 'tw:min-w-[140px]';

/** Control height, so the delete button sits level with the row's first line. */
export const QUERY_BUILDER_CONTROL_HEIGHT = 'tw:h-10';
