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
 * This file contains default static colors that are used as fallbacks when
 * no custom colors are provided. These should not be used directly in components.
 * Instead, use the MUI theme system:
 *
 * ✅ Correct usage:
 * const theme = useTheme();
 * theme.palette.allShades.brand[600]
 *
 * ❌ Incorrect usage:
 * import { defaultColors } from './defaultColors';
 * defaultColors.brand[600]
 */

import type { ThemeColors } from './types';

/**
 * Default static colors for theme system
 * Used as fallback when no custom colors are provided
 * @internal Only for use by createMuiTheme.ts
 */
export const defaultColors: ThemeColors = {
  white: '#ffffff',
  brand: {
    25: '#F5FAFF',
    50: '#EFF8FF',
    100: '#D1E9FF',
    200: '#B2DDFF',
    300: '#84CAFF',
    400: '#53B1FD',
    500: '#2E90FA',
    600: '#1570EF',
    700: '#175CD3',
    800: '#1849A9',
    900: '#194185',
    950: '#102A56',
  },
  gray: {
    25: '#FDFDFD',
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#E9EAEB',
    300: '#D5D7DA',
    400: '#A4A7AE',
    500: '#717680',
    600: '#535862',
    700: '#414651',
    750: '#404040', // custom shade
    800: '#252B37',
    900: '#101828',
    950: '#0C111D',
  },
  blueGray: {
    25: '#FCFCFD',
    50: '#F8F9FC',
    75: '#EFF4FA', // custom shade for chips
    100: '#EAECF5',
    150: '#D2DBEA', // custom shade for chip borders
    200: '#D5D9EB',
    300: '#AFB5D9',
    400: '#717BBC',
    500: '#4E5BA6',
    600: '#3E4784',
    700: '#363F72',
    800: '#293056',
    900: '#101323',
    950: '#0C111D',
  },
  error: {
    25: '#FFFBFA',
    50: '#FEF3F2',
    100: '#FEE4E2',
    200: '#FECDCA',
    300: '#FDA29B',
    400: '#F97066',
    500: '#F04438',
    600: '#D92D20',
    700: '#B42318',
    800: '#912018',
    900: '#7A271A',
    950: '#55160C',
  },
  warning: {
    25: '#FFFCF5',
    50: '#FFFAEB',
    100: '#FEF0C7',
    200: '#FEDF89',
    300: '#FEC84B',
    400: '#FDB022',
    500: '#F79009',
    600: '#DC6803',
    700: '#B54708',
    800: '#93370D',
    900: '#7A2E0E',
    950: '#511C10',
  },
  success: {
    25: '#F6FEF9',
    50: '#ECFDF3',
    100: '#D1FADF',
    200: '#A6F4C5',
    300: '#6CE9A6',
    400: '#32D583',
    500: '#12B76A',
    600: '#039855',
    700: '#027A48',
    800: '#05603A',
    900: '#054F31',
    950: '#052E16',
  },
  info: {
    25: '#F5FAFF',
    50: '#EFF8FF',
    100: '#D1E9FF',
    200: '#B2DDFF',
    300: '#84CAFF',
    400: '#53B1FD',
    500: '#2E90FA',
    600: '#1570EF',
    700: '#175CD3',
    800: '#1849A9',
    900: '#194185',
    950: '#102A56',
  },
};
