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
import { colors, shadows } from './colors';
import { dataDisplayTheme } from './data-display-theme';
import { formTheme } from './form-theme';
import { navigationTheme } from './navigation-theme';

const theme = createTheme({
  palette: {
    primary: {
      main: colors.brand[600],
      light: colors.brand[400],
      dark: colors.brand[700],
      contrastText: colors.white,
    },
    secondary: {
      main: colors.gray[600],
      light: colors.gray[400],
      dark: colors.gray[700],
      contrastText: colors.white,
    },
    error: {
      main: colors.error[600],
      light: colors.error[400],
      dark: colors.error[700],
      contrastText: colors.white,
    },
    warning: {
      main: colors.warning[600],
      light: colors.warning[400],
      dark: colors.warning[700],
      contrastText: colors.white,
      600: colors.warning[600], // Add 600 shade for sx prop usage
    },
    success: {
      main: colors.success[600],
      light: colors.success[400],
      dark: colors.success[700],
      contrastText: colors.white,
    },
    grey: {
      50: colors.gray[50],
      100: colors.gray[100],
      200: colors.gray[200],
      300: colors.gray[300],
      400: colors.gray[400],
      500: colors.gray[500],
      600: colors.gray[600],
      700: colors.gray[700],
      800: colors.gray[800],
      900: colors.gray[900],
    },
    background: {
      default: colors.white,
      paper: colors.white,
    },
    text: {
      primary: colors.gray[900],
      secondary: colors.gray[700],
      disabled: colors.gray[500],
    },
  },
  typography: {
    fontFamily:
      'var(--font-inter, "Inter"), -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
    // Map MUI variants to native typography system exactly
    h1: {
      // display-xl: 60px with -1.2px letter spacing
      fontSize: '3.75rem', // --text-display-xl (60px)
      fontWeight: 600,
      lineHeight: '4.5rem', // --text-display-xl--line-height (72px)
      letterSpacing: '-1.2px', // --text-display-xl--letter-spacing
      color: 'var(--color-text-primary)', // Use native color system
    },
    h2: {
      // display-lg: 48px with -0.96px letter spacing
      fontSize: '3rem', // --text-display-lg (48px)
      fontWeight: 600,
      lineHeight: '3.75rem', // --text-display-lg--line-height (60px)
      letterSpacing: '-0.96px', // --text-display-lg--letter-spacing
      color: 'var(--color-text-primary)',
    },
    h3: {
      // display-md: 36px with -0.72px letter spacing
      fontSize: '2.25rem', // --text-display-md (36px)
      fontWeight: 600,
      lineHeight: '2.75rem', // --text-display-md--line-height (44px)
      letterSpacing: '-0.72px', // --text-display-md--letter-spacing
      color: 'var(--color-text-primary)',
    },
    h4: {
      // display-sm: 30px
      fontSize: '1.875rem', // --text-display-sm (30px)
      fontWeight: 600,
      lineHeight: '2.375rem', // --text-display-sm--line-height (38px)
      color: 'var(--color-text-primary)',
    },
    h5: {
      // display-xs: 24px
      fontSize: '1.5rem', // --text-display-xs (24px)
      fontWeight: 600,
      lineHeight: '2rem', // --text-display-xs--line-height (32px)
      color: 'var(--color-text-primary)',
    },
    h6: {
      // text-xl: 20px
      fontSize: '1.25rem', // --text-xl (20px)
      fontWeight: 600,
      lineHeight: '1.875rem', // --text-xl--line-height (30px)
      color: 'var(--color-text-primary)',
    },
    subtitle1: {
      // text-lg: 18px
      fontSize: '1.125rem', // --text-lg (18px)
      lineHeight: '1.75rem', // --text-lg--line-height (28px)
      fontWeight: 400,
      color: 'var(--color-text-secondary)',
    },
    subtitle2: {
      // text-md: 16px
      fontSize: '1rem', // --text-md (16px)
      lineHeight: '1.5rem', // --text-md--line-height (24px)
      fontWeight: 500,
      color: 'var(--color-text-secondary)',
    },
    body1: {
      // text-md: 16px (primary body text)
      fontSize: '1rem', // --text-md (16px)
      lineHeight: '1.5rem', // --text-md--line-height (24px)
      fontWeight: 400,
      color: 'var(--color-text-tertiary)',
    },
    body2: {
      // text-sm: 14px (secondary body text)
      fontSize: '0.875rem', // --text-sm (14px)
      lineHeight: '1.25rem', // --text-sm--line-height (20px)
      fontWeight: 400,
      color: 'var(--color-text-tertiary)',
    },
    caption: {
      // text-xs: 12px
      fontSize: '0.75rem', // --text-xs (12px)
      lineHeight: '1.125rem', // --text-xs--line-height (18px)
      fontWeight: 400,
      color: 'var(--color-text-quaternary)',
    },
    overline: {
      // text-xs: 12px, uppercase
      fontSize: '0.75rem', // --text-xs (12px)
      lineHeight: '1.125rem', // --text-xs--line-height (18px)
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      color: 'var(--color-text-quaternary)',
    },
    button: {
      // Keep existing button styling
      fontSize: '0.875rem', // text-sm
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  spacing: 4, // Base spacing unit is 4px
  shape: {
    borderRadius: 8, // radius-lg
  },
  shadows: [
    'none', // elevation 0
    shadows.xs, // shadow-xs - elevation 1
    shadows.sm, // shadow-sm - elevation 2
    shadows.md, // shadow-md - elevation 3
    shadows.lg, // shadow-lg - elevation 4
    shadows.xl, // shadow-xl - elevation 5
    shadows['2xl'], // shadow-2xl - elevation 6
    '0px 32px 64px -12px rgba(10, 13, 18, 0.14), 0px 5px 5px -2.5px rgba(10, 13, 18, 0.04)', // shadow-3xl - elevation 7
    // MUI requires 25 shadows, we'll repeat the pattern with increasing intensity
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
  components: {
    // Import all component themes from modular files
    ...buttonTheme,
    ...formTheme,
    ...navigationTheme,
    ...dataDisplayTheme,
  },
});

export default theme;
