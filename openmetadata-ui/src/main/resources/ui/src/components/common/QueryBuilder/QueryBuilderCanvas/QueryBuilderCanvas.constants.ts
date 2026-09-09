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

/** Widget-less operators (`is null`) still occupy their column, empty. */
export const QUERY_BUILDER_OPERATOR_NO_VALUE = 0;
