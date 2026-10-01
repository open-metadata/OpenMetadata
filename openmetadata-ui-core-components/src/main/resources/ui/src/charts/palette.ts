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

import type { ChartPalette, ChartStatus } from './types';

/**
 * Light categorical series colours, cycled by series or slice index.
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

/**
 * Charts take their colours from one of these two palettes, chosen by colour
 * mode: a series or slice names a status or takes the next series colour.
 * A series or slice can override this with its own `color`, e.g. for a brand
 * colour scale.
 */
export const LIGHT_CHART_PALETTE: ChartPalette = {
  series: CHART_PALETTE,
  status: {
    success: '#17b26a', // success-500
    warning: '#f79009', // warning-500
    failed: '#cb5a50', // visualization-dq-failed
    info: '#1570ef', // brand-600
    neutral: '#e9eaeb', // gray-200
  },
  scale: ['#e3edfd', '#1570ef'],
};

// The same hues, two to three steps lighter, so they hold contrast on the
// dark chart background.
export const DARK_CHART_PALETTE: ChartPalette = {
  series: [
    '#53b1fd', // blue-400
    '#9b8afb', // purple-400
    '#47cd89', // success-400
    '#fdb022', // warning-400
    '#8098f9', // indigo-400
    '#2ed3b7', // teal-400
    '#f97066', // error-400
    '#f670c7', // pink-400
    '#fd853a', // orange-400
    '#84caff', // blue-300
    '#bdb4fe', // purple-300
    '#a4bcfd', // indigo-300
    '#75e0a7', // success-300
    '#fec84b', // warning-300
    '#e1877e', // muted red, lighter
  ],
  status: {
    success: '#47cd89', // success-400
    warning: '#fdb022', // warning-400
    failed: '#f97066', // error-400
    info: '#53b1fd', // blue-400
    neutral: '#373a41', // gray-700
  },
  scale: ['#1a2a4a', '#53b1fd'],
};

/** The colour of the series or slice at `index`, or of its `status`. */
export const chartColor = (
  palette: ChartPalette,
  index: number,
  status?: ChartStatus
): string =>
  status
    ? palette.status[status]
    : palette.series[index % palette.series.length];

/** Light series colour at `index`; for Node callers without a theme. */
export const getSeriesColor = (index: number): string =>
  chartColor(LIGHT_CHART_PALETTE, index);
