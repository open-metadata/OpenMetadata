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

import { buildChartTheme } from './theme';
import type { ChartPalette } from './types';
import { useIsDarkMode } from './use-is-dark-mode';

// No element: the colour mode is read from `<html>` only.
const DOCUMENT_ROOT = { current: null };

/**
 * The palette charts are drawing with right now, for UI drawn next to a chart
 * — e.g. legend dots — that must match its colours. Pair with `chartColor`.
 */
export const useChartPalette = (): ChartPalette =>
  buildChartTheme({ isDark: useIsDarkMode(DOCUMENT_ROOT) }).palette;
