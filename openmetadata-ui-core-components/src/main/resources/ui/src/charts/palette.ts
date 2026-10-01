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
 * Default categorical series colours. A series without an explicit colour
 * takes `getSeriesColor(index)`.
 *
 * Moved unchanged from `@collate/chart-core`'s `DEFAULT_CHART_COLORS`. AI charts
 * record the colours they were painted with, so changing an entry or the order
 * recolours every new chart — the test pins the list. Add colours at the end.
 */
export const CHART_PALETTE: readonly string[] = [
  '#1570ef', // blue-600 — primary brand
  '#7a5af8', // purple-500
  '#067647', // success-600
  '#b54708', // warning-700
  '#5925dc', // indigo deep
  '#15b79e', // teal
  '#f04438', // error-500
  '#ee46bc', // pink
  '#ef6820', // orange
  '#175cd3', // blue-700
  '#875bf7', // purple-400
  '#6172f3', // indigo-500
  '#17b26a', // success-500
  '#f79009', // warning-500
  '#cb5a50', // muted red
];

export const getSeriesColor = (index: number): string =>
  CHART_PALETTE[index % CHART_PALETTE.length];
