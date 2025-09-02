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
  white: 'rgb(255 255 255)',
  brand: {
    25: 'rgb(252 250 255)',
    50: 'rgb(249 245 255)',
    100: 'rgb(244 235 255)',
    200: 'rgb(233 215 254)',
    300: 'rgb(214 187 251)',
    400: 'rgb(182 146 246)',
    500: 'rgb(158 119 237)',
    600: 'rgb(127 86 217)',
    700: 'rgb(105 65 198)',
    800: 'rgb(83 56 158)',
    900: 'rgb(66 48 125)',
    950: 'rgb(44 28 95)',
  },
  gray: {
    25: 'rgb(253 253 253)',
    50: 'rgb(250 250 250)',
    100: 'rgb(245 245 245)',
    200: 'rgb(233 234 235)',
    300: 'rgb(213 215 218)',
    400: 'rgb(164 167 174)',
    500: 'rgb(113 118 128)',
    600: 'rgb(83 88 98)',
    700: 'rgb(65 70 81)',
    750: 'rgb(64 64 64)', // #404040
    800: 'rgb(37 43 55)',
    900: 'rgb(24 29 39)',
    950: 'rgb(10 13 18)',
  },
  blueGray: {
    25: 'rgb(252 252 253)',
    50: 'rgb(248 249 252)',
    75: 'rgb(239 244 250)', // #eff4fa
    100: 'rgb(234 236 245)',
    150: 'rgb(210 219 234)', // #d2dbea
    200: 'rgb(213 217 235)',
    300: 'rgb(179 184 219)',
    400: 'rgb(113 123 188)',
    500: 'rgb(78 91 166)',
    600: 'rgb(62 71 132)',
    700: 'rgb(54 63 114)',
    800: 'rgb(41 48 86)',
    900: 'rgb(16 19 35)',
    950: 'rgb(13 15 28)',
  },
  error: {
    25: 'rgb(255 251 250)',
    50: 'rgb(254 243 242)',
    100: 'rgb(254 228 226)',
    200: 'rgb(254 205 202)',
    300: 'rgb(253 162 155)',
    400: 'rgb(249 112 102)',
    500: 'rgb(240 68 56)',
    600: 'rgb(217 45 32)',
    700: 'rgb(180 35 24)',
    800: 'rgb(145 32 24)',
    900: 'rgb(122 39 26)',
    950: 'rgb(85 22 12)',
  },
  warning: {
    25: 'rgb(255 252 245)',
    50: 'rgb(255 250 235)',
    100: 'rgb(254 240 199)',
    200: 'rgb(254 223 137)',
    300: 'rgb(254 200 75)',
    400: 'rgb(253 176 34)',
    500: 'rgb(247 144 9)',
    600: 'rgb(220 104 3)',
    700: 'rgb(181 71 8)',
    800: 'rgb(147 55 13)',
    900: 'rgb(122 46 14)',
    950: 'rgb(78 29 9)',
  },
  success: {
    25: 'rgb(246 254 249)',
    50: 'rgb(236 253 243)',
    100: 'rgb(220 250 230)',
    200: 'rgb(171 239 198)',
    300: 'rgb(117 224 167)',
    400: 'rgb(71 205 137)',
    500: 'rgb(23 178 106)',
    600: 'rgb(7 148 85)',
    700: 'rgb(6 118 71)',
    800: 'rgb(8 93 58)',
    900: 'rgb(7 77 49)',
    950: 'rgb(5 51 33)',
  },
  info: {
    25: 'rgb(245 250 255)',
    50: 'rgb(239 248 255)',
    100: 'rgb(209 233 255)',
    200: 'rgb(178 221 255)',
    300: 'rgb(132 202 255)',
    400: 'rgb(83 177 253)',
    500: 'rgb(46 144 250)',
    600: 'rgb(21 112 239)',
    700: 'rgb(23 92 211)',
    800: 'rgb(24 73 169)',
    900: 'rgb(25 65 133)',
    950: 'rgb(16 42 86)',
  },
};
