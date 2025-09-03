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
import { defaultColors } from '../colors/defaultColors';
import { formTheme } from './form-theme';
import { generateAllMuiPalettes } from '../colors/generateMuiPalettes';
import { navigationTheme } from './navigation-theme';
import { shadows } from './shadows';
import type { CustomColors, ThemeColors } from '../types';
import './mui-theme-types';

/**
 * Creates dynamic MUI theme with user customizations or default colors
 * @param customColors User's custom color preferences
 * @param defaultTheme Optional default theme colors (uses built-in fallback if not provided)
 * @returns MUI Theme with dynamic or default color palettes
 */
export const createMuiTheme = (
  customColors?: CustomColors,
  defaultTheme?: {
    primaryColor: string;
    infoColor: string;
    successColor: string;
    warningColor: string;
    errorColor: string;
  }
) => {
  // Generate dynamic palettes or use static defaults
  const dynamicPalettes = customColors
    ? generateAllMuiPalettes(customColors, defaultColors, defaultTheme)
    : null;

  // Create final theme colors for components
  const themeColors: ThemeColors = {
    ...defaultColors,
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
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
        color: 'var(--color-text-quaternary)',
      },
      button: {
        fontSize: '0.875rem',
        textTransform: 'none' as const,
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
