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

import type { Shadows } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import { buttonTheme } from './button-theme';
import { dataDisplayTheme } from './data-display-theme';
import { formTheme } from './form-theme';
import { generateAllMuiPalettes } from './generateMuiPalettes';
import { navigationTheme } from './navigation-theme';
import { shadows } from './shadows';

// Extend MUI palette to include allShades
declare module '@mui/material/styles' {
  interface Palette {
    allShades: any;
  }
  interface PaletteOptions {
    allShades?: any;
  }
}

// Internal colors - not exported, only used for theme generation
const staticColors = {
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

/**
 * Creates dynamic MUI theme with user customizations or default colors
 * @param customColors User's custom color preferences
 * @returns MUI Theme with dynamic or default color palettes
 */
export const createMuiTheme = (customColors?: {
  primaryColor?: string;
  infoColor?: string;
  successColor?: string;
  warningColor?: string;
  errorColor?: string;
}) => {
  // Generate dynamic palettes or use static defaults
  const dynamicPalettes = customColors
    ? generateAllMuiPalettes(customColors, staticColors)
    : null;

  // Create final theme colors for components
  const themeColors = {
    ...staticColors,
    ...(dynamicPalettes && {
      brand: dynamicPalettes.brand,
      success: dynamicPalettes.success,
      error: dynamicPalettes.error,
      warning: dynamicPalettes.warning,
      info: dynamicPalettes.info,
    }),
  };

  // Generate component themes with dynamic colors
  const componentThemes = {
    ...buttonTheme(themeColors),
    ...formTheme(themeColors),
    ...navigationTheme(themeColors),
    ...dataDisplayTheme(themeColors),
  };

  return createTheme({
    palette: {
      primary: {
        main: themeColors.brand[600],
        light: themeColors.brand[400],
        dark: themeColors.brand[700],
        contrastText: themeColors.white,
      },
      secondary: {
        main: themeColors.gray[600],
        light: themeColors.gray[400],
        dark: themeColors.gray[700],
        contrastText: themeColors.white,
      },
      error: {
        main: themeColors.error[600],
        light: themeColors.error[400],
        dark: themeColors.error[700],
        contrastText: themeColors.white,
      },
      warning: {
        main: themeColors.warning[600],
        light: themeColors.warning[400],
        dark: themeColors.warning[700],
        contrastText: themeColors.white,
      },
      success: {
        main: themeColors.success[600],
        light: themeColors.success[400],
        dark: themeColors.success[700],
        contrastText: themeColors.white,
      },
      info: {
        main: themeColors.info[600],
        light: themeColors.info[400],
        dark: themeColors.info[700],
        contrastText: themeColors.white,
      },
      grey: {
        50: themeColors.gray[50],
        100: themeColors.gray[100],
        200: themeColors.gray[200],
        300: themeColors.gray[300],
        400: themeColors.gray[400],
        500: themeColors.gray[500],
        600: themeColors.gray[600],
        700: themeColors.gray[700],
        800: themeColors.gray[800],
        900: themeColors.gray[900],
      },
      background: {
        default: themeColors.white,
        paper: themeColors.white,
      },
      text: {
        primary: themeColors.gray[900],
        secondary: themeColors.gray[700],
        disabled: themeColors.gray[500],
      },
      // Full color scales accessible via theme.palette.allShades
      allShades: themeColors,
    },
    typography: {
      fontFamily:
        'var(--font-inter, "Inter"), -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
      h1: {
        fontSize: '3.75rem',
        fontWeight: 600,
        lineHeight: '4.5rem',
        letterSpacing: '-1.2px',
        color: 'var(--color-text-primary)',
      },
      h2: {
        fontSize: '3rem',
        fontWeight: 600,
        lineHeight: '3.75rem',
        letterSpacing: '-0.96px',
        color: 'var(--color-text-primary)',
      },
      h3: {
        fontSize: '2.25rem',
        fontWeight: 600,
        lineHeight: '2.75rem',
        letterSpacing: '-0.72px',
        color: 'var(--color-text-primary)',
      },
      h4: {
        fontSize: '1.875rem',
        fontWeight: 600,
        lineHeight: '2.375rem',
        color: 'var(--color-text-primary)',
      },
      h5: {
        fontSize: '1.5rem',
        fontWeight: 600,
        lineHeight: '2rem',
        color: 'var(--color-text-primary)',
      },
      h6: {
        fontSize: '1.25rem',
        fontWeight: 600,
        lineHeight: '1.875rem',
        color: 'var(--color-text-primary)',
      },
      subtitle1: {
        fontSize: '1.125rem',
        lineHeight: '1.75rem',
        fontWeight: 400,
        color: 'var(--color-text-secondary)',
      },
      subtitle2: {
        fontSize: '1rem',
        lineHeight: '1.5rem',
        fontWeight: 500,
        color: 'var(--color-text-secondary)',
      },
      body1: {
        fontSize: '1rem',
        lineHeight: '1.5rem',
        fontWeight: 400,
        color: 'var(--color-text-tertiary)',
      },
      body2: {
        fontSize: '0.875rem',
        lineHeight: '1.25rem',
        fontWeight: 400,
        color: 'var(--color-text-tertiary)',
      },
      caption: {
        fontSize: '0.75rem',
        lineHeight: '1.125rem',
        fontWeight: 400,
        color: 'var(--color-text-quaternary)',
      },
      overline: {
        fontSize: '0.75rem',
        lineHeight: '1.125rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color: 'var(--color-text-quaternary)',
      },
      button: {
        fontSize: '0.875rem',
        textTransform: 'none',
        fontWeight: 600,
      },
    },
    spacing: 4,
    shape: {
      borderRadius: 8,
    },
    shadows: [
      'none',
      shadows.xs,
      shadows.sm,
      shadows.md,
      shadows.lg,
      shadows.xl,
      shadows['2xl'],
      '0px 32px 64px -12px rgba(10, 13, 18, 0.14), 0px 5px 5px -2.5px rgba(10, 13, 18, 0.04)',
      // Additional shadows for MUI's 25-shadow requirement
      '0px 1px 3px rgba(10, 13, 18, 0.1), 0px 1px 2px -1px rgba(10, 13, 18, 0.1)',
      '0px 4px 6px -1px rgba(10, 13, 18, 0.1), 0px 2px 4px -2px rgba(10, 13, 18, 0.06)',
      '0px 12px 16px -4px rgba(10, 13, 18, 0.08), 0px 4px 6px -2px rgba(10, 13, 18, 0.03), 0px 2px 2px -1px rgba(10, 13, 18, 0.04)',
      '0px 12px 16px -4px rgba(10, 13, 18, 0.08), 0px 4px 6px -2px rgba(10, 13, 18, 0.03), 0px 2px 2px -1px rgba(10, 13, 18, 0.04)',
      '0px 20px 24px -4px rgba(10, 13, 18, 0.08), 0px 8px 8px -4px rgba(10, 13, 18, 0.03), 0px 3px 3px -1.5px rgba(10, 13, 18, 0.04)',
      '0px 20px 24px -4px rgba(10, 13, 18, 0.08), 0px 8px 8px -4px rgba(10, 13, 18, 0.03), 0px 3px 3px -1.5px rgba(10, 13, 18, 0.04)',
      '0px 24px 48px -12px rgba(10, 13, 18, 0.18), 0px 4px 4px -2px rgba(10, 13, 18, 0.04)',
      '0px 24px 48px -12px rgba(10, 13, 18, 0.18), 0px 4px 4px -2px rgba(10, 13, 18, 0.04)',
      '0px 32px 64px -12px rgba(10, 13, 18, 0.14), 0px 5px 5px -2.5px rgba(10, 13, 18, 0.04)',
      '0px 32px 64px -12px rgba(10, 13, 18, 0.14), 0px 5px 5px -2.5px rgba(10, 13, 18, 0.04)',
      '0px 32px 64px -12px rgba(10, 13, 18, 0.14), 0px 5px 5px -2.5px rgba(10, 13, 18, 0.04)',
      '0px 32px 64px -12px rgba(10, 13, 18, 0.14), 0px 5px 5px -2.5px rgba(10, 13, 18, 0.04)',
      '0px 32px 64px -12px rgba(10, 13, 18, 0.14), 0px 5px 5px -2.5px rgba(10, 13, 18, 0.04)',
      '0px 32px 64px -12px rgba(10, 13, 18, 0.14), 0px 5px 5px -2.5px rgba(10, 13, 18, 0.04)',
      '0px 32px 64px -12px rgba(10, 13, 18, 0.14), 0px 5px 5px -2.5px rgba(10, 13, 18, 0.04)',
      '0px 32px 64px -12px rgba(10, 13, 18, 0.14), 0px 5px 5px -2.5px rgba(10, 13, 18, 0.04)',
      '0px 32px 64px -12px rgba(10, 13, 18, 0.14), 0px 5px 5px -2.5px rgba(10, 13, 18, 0.04)',
    ] as Shadows,
    components: componentThemes,
  });
};
