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

import type { ThemeColors } from '../types';

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
    725: '#363636', // custom shade for search icon
    750: '#404040', // custom shade
    800: '#252B37',
    900: '#181D27',
    950: '#0A0D12',
  },
  blueGray: {
    25: '#FCFCFD',
    40: '#FAFAFA', // custom shade for search field background
    50: '#F8F9FC',
    75: '#EFF4FA', // custom shade for chips
    100: '#EAECF5',
    125: '#ECEDF7', // custom shade for card header fills
    150: '#D2DBEA', // custom shade for chip borders
    200: '#D5D9EB',
    250: '#DFDFDF', // custom shade for search field borders
    300: '#AFB5D9',
    400: '#717BBC',
    500: '#4E5BA6',
    600: '#3E4784',
    700: '#363F72',
    800: '#293056',
    900: '#101323',
    950: '#0C111D',
  },
  blue: {
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
  blueLight: {
    25: '#F5FBFF',
    50: '#F0F9FF',
    100: '#E0F2FE',
    200: '#B9E6FE',
    300: '#7CD4FD',
    400: '#36BFFA',
    500: '#0BA5EC',
    600: '#0086C9',
    700: '#026AA2',
    800: '#065986',
    900: '#0B4A6F',
    950: '#0B4A6F',
  },
  indigo: {
    25: '#F5F8FF',
    50: '#EEF4FF',
    100: '#E0EAFF',
    200: '#C7D7FE',
    300: '#A4BCFD',
    400: '#8098F9',
    500: '#6172F3',
    600: '#444CE7',
    700: '#3538CD',
    800: '#2D31A6',
    900: '#2D3282',
    950: '#2D3282',
  },
  purple: {
    25: '#FAFAFF',
    50: '#F4F3FF',
    100: '#EBE9FE',
    200: '#D9D6FE',
    300: '#BDB4FE',
    400: '#9B8AFB',
    500: '#7A5AF8',
    600: '#6938EF',
    700: '#5925DC',
    800: '#4A1FB8',
    900: '#3E1C96',
    950: '#3E1C96',
  },
  pink: {
    25: '#FEF6FB',
    50: '#FDF2FA',
    100: '#FCE7F6',
    200: '#FCCEEE',
    300: '#FAA7E0',
    400: '#F670C7',
    500: '#EE46BC',
    600: '#DD2590',
    700: '#C11574',
    800: '#9E165F',
    900: '#851651',
    950: '#851651',
  },
  rose: {
    25: '#FFF5F6',
    50: '#FFF1F3',
    100: '#FFE4E8',
    200: '#FECDD6',
    300: '#FEA3B4',
    400: '#FD6F8E',
    500: '#F63D68',
    600: '#E31B54',
    700: '#C01048',
    800: '#A11043',
    900: '#89123E',
    950: '#89123E',
  },
  orange: {
    25: '#FFFAF5',
    50: '#FFF6ED',
    100: '#FFEAD5',
    200: '#FDDCAB',
    300: '#FEB273',
    400: '#FD853A',
    500: '#FB6514',
    600: '#EC4A0A',
    700: '#C4320A',
    800: '#9C2A10',
    900: '#7E2410',
    950: '#7E2410',
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
    500: '#17B26A',
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
