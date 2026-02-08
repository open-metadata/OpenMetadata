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

/**
 * @fileoverview RESTRICTED: This file should only be imported by createMuiTheme.ts
 * @internal Use theme.palette.allShades for accessing colors in components
 *
 * This file contains dark mode colors that are used when the theme is set to dark mode.
 * These colors are designed to work well with dark backgrounds and provide good contrast.
 */

import type { ThemeColors } from '../types';

/**
 * Dark mode colors for theme system
 * Used when themeMode is 'dark'
 * @internal Only for use by createMuiTheme.ts
 */
export const darkColors: ThemeColors = {
  white: '#e6edf3', // Light text color in dark mode
  page: '#0d1117', // Main dark background
  surface: '#161b22', // Card/elevated surface
  surfaceRaised: '#21262d', // Higher elevation surface
  brand: {
    25: '#0a2540',
    50: '#0d3158',
    100: '#0f3d6e',
    200: '#174b85',
    300: '#1d5a9c',
    400: '#2e7bc9',
    500: '#58a6ff',
    600: '#79b8ff',
    700: '#a5d6ff',
    800: '#c8e1ff',
    900: '#ddf4ff',
    950: '#f0f9ff',
  },
  gray: {
    25: '#0d1117', // Darkest - main bg
    50: '#161b22', // Slightly lighter
    100: '#21262d', // Card bg
    200: '#30363d', // Borders, hover
    300: '#484f58', // Disabled text
    400: '#6e7681', // Tertiary text
    500: '#8b949e', // Secondary text
    600: '#b1bac4', // Lighter text
    700: '#c9d1d9', // Near primary text
    725: '#d0d7de',
    750: '#d8dee4',
    800: '#e6edf3', // Primary text
    900: '#f0f6fc', // Bright text
    950: '#ffffff', // White text
  },
  blueGray: {
    25: '#0d1117',
    40: '#161b22',
    50: '#1c2128',
    75: '#21262d',
    100: '#30363d',
    125: '#373e47',
    150: '#444c56',
    200: '#545d68',
    250: '#636e7b',
    300: '#768390',
    400: '#8b949e',
    500: '#9eaab6',
    600: '#adbac7',
    700: '#c9d1d9',
    800: '#e6edf3',
    900: '#f0f6fc',
    950: '#ffffff',
  },
  blue: {
    25: '#0a2540',
    50: '#0d3158',
    100: '#0f3d6e',
    200: '#174b85',
    300: '#1d5a9c',
    400: '#2e7bc9',
    500: '#58a6ff',
    600: '#79b8ff',
    700: '#a5d6ff',
    800: '#c8e1ff',
    900: '#ddf4ff',
    950: '#f0f9ff',
  },
  blueLight: {
    25: '#052d49',
    50: '#0a3d62',
    100: '#0d4f7e',
    200: '#1268a3',
    300: '#1f7fc9',
    400: '#36bffa',
    500: '#7cd4fd',
    600: '#a8e3ff',
    700: '#c8edff',
    800: '#e0f6ff',
    900: '#f0fbff',
    950: '#f8fdff',
  },
  indigo: {
    25: '#1e1f4f',
    50: '#2d2e6b',
    100: '#3d3f8a',
    200: '#5055a9',
    300: '#6875c9',
    400: '#8098f9',
    500: '#a4bcfd',
    600: '#c7d7fe',
    700: '#dde6ff',
    800: '#eef2ff',
    900: '#f5f8ff',
    950: '#fbfcff',
  },
  purple: {
    25: '#2a1a4e',
    50: '#3d2670',
    100: '#4f3390',
    200: '#6542b5',
    300: '#7c58d6',
    400: '#9b8afb',
    500: '#bdb4fe',
    600: '#d9d6fe',
    700: '#ebe9fe',
    800: '#f4f3ff',
    900: '#fafaff',
    950: '#fdfcff',
  },
  pink: {
    25: '#4a0d3a',
    50: '#6b1650',
    100: '#8c1d66',
    200: '#b5277f',
    300: '#dd3599',
    400: '#f670c7',
    500: '#faa7e0',
    600: '#fcceee',
    700: '#fde3f4',
    800: '#fef0fa',
    900: '#fff5fc',
    950: '#fffafd',
  },
  rose: {
    25: '#4d0d22',
    50: '#6f1532',
    100: '#911d44',
    200: '#b52a5a',
    300: '#d93b73',
    400: '#fd6f8e',
    500: '#fea3b4',
    600: '#fecdd6',
    700: '#fee2e8',
    800: '#fff1f3',
    900: '#fff5f6',
    950: '#fffafb',
  },
  orange: {
    25: '#4d1a06',
    50: '#6f250b',
    100: '#913210',
    200: '#b54018',
    300: '#d95220',
    400: '#fd853a',
    500: '#feb273',
    600: '#fddcab',
    700: '#fee9d1',
    800: '#fff3e8',
    900: '#fffaf5',
    950: '#fffcfa',
  },
  error: {
    25: '#4d100d',
    50: '#6f1813',
    100: '#912219',
    200: '#b52e20',
    300: '#d93d28',
    400: '#f97066',
    500: '#fda29b',
    600: '#fecdca',
    700: '#fee4e2',
    800: '#fef3f2',
    900: '#fffbfa',
    950: '#fffdfd',
  },
  warning: {
    25: '#4d2a05',
    50: '#6f3b08',
    100: '#914e0b',
    200: '#b56310',
    300: '#d97a16',
    400: '#fdb022',
    500: '#fec84b',
    600: '#fedf89',
    700: '#fef0c7',
    800: '#fffaeb',
    900: '#fffcf5',
    950: '#fffefa',
  },
  success: {
    25: '#052e1e',
    50: '#0a4027',
    100: '#0f5331',
    200: '#166b3e',
    300: '#1e854d',
    400: '#32d583',
    500: '#6ce9a6',
    600: '#a6f4c5',
    700: '#d1fadf',
    800: '#ecfdf3',
    900: '#f6fef9',
    950: '#fbfefc',
  },
  info: {
    25: '#0a2540',
    50: '#0d3158',
    100: '#0f3d6e',
    200: '#174b85',
    300: '#1d5a9c',
    400: '#58a6ff',
    500: '#79b8ff',
    600: '#a5d6ff',
    700: '#c8e1ff',
    800: '#ddf4ff',
    900: '#f0f9ff',
    950: '#f8fcff',
  },
};
