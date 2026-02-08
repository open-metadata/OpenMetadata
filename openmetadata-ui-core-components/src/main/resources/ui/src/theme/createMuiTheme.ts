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

import type { Shadows } from "@mui/material/styles";
import { createTheme } from "@mui/material/styles";
import { darkColors } from "../colors/darkColors";
import { defaultColors } from "../colors/defaultColors";
import { generateAllMuiPalettes } from "../colors/generateMuiPalettes";
import type { CustomColors, ThemeColors } from "../types";
import { buttonTheme } from "./button-theme";
import { dataDisplayTheme } from "./data-display-theme";
import { formTheme } from "./form-theme";
import "./mui-theme-types";
import { navigationTheme } from "./navigation-theme";
import { tabTheme } from "./tab-theme";
import { shadows } from "./shadows";
import {
  BODY_FONT_SIZES,
  BODY_LINE_HEIGHTS,
  HEADING_FONT_SIZES,
  HEADING_LINE_HEIGHTS,
  ROOT_FONT_SIZE,
} from "./typography-constants";

/**
 * Creates dynamic MUI theme with user customizations or default colors
 * @param customColors User's custom color preferences
 * @param defaultTheme Optional default theme colors (uses built-in fallback if not provided)
 * @param mode Theme mode - 'light' or 'dark'
 * @returns MUI Theme with dynamic or default color palettes
 */
export const createMuiTheme = (
  customColors?: CustomColors,
  defaultTheme?: {
    primaryColor: string;
    infoColor: string;
    hoverColor:string;
    selectedColor:string;
    successColor: string;
    warningColor: string;
    errorColor: string;
  },
  mode: 'light' | 'dark' = 'light'
) => {
  // Select base colors based on mode
  const baseColors = mode === 'dark' ? darkColors : defaultColors;

  // Generate dynamic palettes or use static defaults
  const dynamicPalettes = customColors
    ? generateAllMuiPalettes(customColors, baseColors, defaultTheme)
    : null;

  // Create final theme colors for components
  const themeColors: ThemeColors = {
    ...baseColors,
    ...(dynamicPalettes && {
      brand: dynamicPalettes.brand,
      success: dynamicPalettes.success,
      error: dynamicPalettes.error,
      warning: dynamicPalettes.warning,
      info: dynamicPalettes.info,
    }),
  };

  // For dark mode buttons, use light-mode brand colors so primary buttons
  // stay vibrant (#1570EF) instead of washed-out (#79b8ff).
  const buttonColors = mode === 'dark'
    ? { ...themeColors, brand: defaultColors.brand }
    : themeColors;

  // Generate component themes with dynamic colors
  const componentThemes = {
    ...buttonTheme(buttonColors, mode),
    ...formTheme(themeColors, mode),
    ...navigationTheme(themeColors, mode),
    ...dataDisplayTheme(themeColors, mode),
    ...tabTheme(themeColors, mode),
  };

  // Background and text colors based on mode
  const backgroundColors = mode === 'dark'
    ? {
        default: themeColors.page,      // #0d1117
        paper: themeColors.surface,     // #161b22
      }
    : {
        default: themeColors.white,
        paper: themeColors.white,
      };

  const textColors = mode === 'dark'
    ? {
        primary: themeColors.gray[800],   // #e6edf3 - light text
        secondary: themeColors.gray[500], // #8b949e
        disabled: themeColors.gray[400],  // #6e7681
      }
    : {
        primary: themeColors.gray[900],   // #181d27 - dark text
        secondary: themeColors.gray[700], // #414651
        disabled: themeColors.gray[500],  // #717680
      };

  return createTheme({
    palette: {
      mode,
      primary: {
        // Use the same vibrant blue for buttons in both modes.
        // The dark mode brand scale is inverted (lighter = higher number),
        // so brand[600] in dark = #79b8ff (washed out). We use the light
        // mode values (#1570EF) which have excellent contrast on dark bgs.
        main: mode === 'dark' ? defaultColors.brand[600] : themeColors.brand[600],
        light: mode === 'dark' ? defaultColors.brand[400] : themeColors.brand[400],
        dark: mode === 'dark' ? defaultColors.brand[700] : themeColors.brand[700],
        contrastText: '#ffffff',
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
      background: backgroundColors,
      text: textColors,
      // Full color scales accessible via theme.palette.allShades
      allShades: themeColors,
    },
    typography: {
      fontSize: ROOT_FONT_SIZE,
      htmlFontSize: ROOT_FONT_SIZE,
      fontFamily:
        'var(--font-inter, "Inter"), -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
      h1: {
        fontSize: HEADING_FONT_SIZES.H1,
        fontWeight: 600,
        lineHeight: HEADING_LINE_HEIGHTS.H1,
        letterSpacing: "-1.2px",
        color: "var(--om-text-primary)",
      },
      h2: {
        fontSize: HEADING_FONT_SIZES.H2,
        fontWeight: 600,
        lineHeight: HEADING_LINE_HEIGHTS.H2,
        letterSpacing: "-0.96px",
        color: "var(--om-text-primary)",
      },
      h3: {
        fontSize: HEADING_FONT_SIZES.H3,
        fontWeight: 600,
        lineHeight: HEADING_LINE_HEIGHTS.H3,
        letterSpacing: "-0.72px",
        color: "var(--om-text-primary)",
      },
      h4: {
        fontSize: HEADING_FONT_SIZES.H4,
        fontWeight: 600,
        lineHeight: HEADING_LINE_HEIGHTS.H4,
        color: "var(--om-text-primary)",
      },
      h5: {
        fontSize: HEADING_FONT_SIZES.H5,
        fontWeight: 600,
        lineHeight: HEADING_LINE_HEIGHTS.H5,
        color: "var(--om-text-primary)",
      },
      h6: {
        fontSize: HEADING_FONT_SIZES.H6,
        fontWeight: 600,
        lineHeight: HEADING_LINE_HEIGHTS.H6,
        color: "var(--om-text-primary)",
      },
      subtitle1: {
        fontSize: BODY_FONT_SIZES.SUBTITLE1,
        lineHeight: BODY_LINE_HEIGHTS.SUBTITLE1,
        fontWeight: 400,
        color: "var(--om-text-secondary)",
      },
      subtitle2: {
        fontSize: BODY_FONT_SIZES.SUBTITLE2,
        lineHeight: BODY_LINE_HEIGHTS.SUBTITLE2,
        fontWeight: 500,
        color: "var(--om-text-secondary)",
      },
      body1: {
        fontSize: BODY_FONT_SIZES.BODY1,
        lineHeight: BODY_LINE_HEIGHTS.BODY1,
        fontWeight: 400,
        color: "var(--om-text-tertiary)",
      },
      body2: {
        fontSize: BODY_FONT_SIZES.BODY2,
        lineHeight: BODY_LINE_HEIGHTS.BODY2,
        fontWeight: 400,
        color: "var(--om-text-tertiary)",
      },
      caption: {
        fontSize: BODY_FONT_SIZES.CAPTION,
        lineHeight: BODY_LINE_HEIGHTS.CAPTION,
        fontWeight: 400,
        color: "var(--om-text-tertiary)",
      },
      overline: {
        fontSize: BODY_FONT_SIZES.CAPTION,
        lineHeight: BODY_LINE_HEIGHTS.CAPTION,
        fontWeight: 600,
        textTransform: "uppercase" as const,
        letterSpacing: "0.5px",
        color: "var(--om-text-tertiary)",
      },
      button: {
        fontSize: BODY_FONT_SIZES.BUTTON,
        textTransform: "none" as const,
        fontWeight: 600,
      },
    },
    spacing: 4,
    shape: {
      borderRadius: 8,
    },
    shadows: [
      "none",
      shadows.xs,
      shadows.sm,
      shadows.md,
      shadows.lg,
      shadows.xl,
      shadows["2xl"],
      "0px 32px 64px -12px rgba(10, 13, 18, 0.14), 0px 5px 5px -2.5px rgba(10, 13, 18, 0.04)",
      // Additional shadows for MUI's 25-shadow requirement
      "0px 1px 3px rgba(10, 13, 18, 0.1), 0px 1px 2px -1px rgba(10, 13, 18, 0.1)",
      "0px 4px 6px -1px rgba(10, 13, 18, 0.1), 0px 2px 4px -2px rgba(10, 13, 18, 0.06)",
      "0px 12px 16px -4px rgba(10, 13, 18, 0.08), 0px 4px 6px -2px rgba(10, 13, 18, 0.03), 0px 2px 2px -1px rgba(10, 13, 18, 0.04)",
      "0px 12px 16px -4px rgba(10, 13, 18, 0.08), 0px 4px 6px -2px rgba(10, 13, 18, 0.03), 0px 2px 2px -1px rgba(10, 13, 18, 0.04)",
      "0px 20px 24px -4px rgba(10, 13, 18, 0.08), 0px 8px 8px -4px rgba(10, 13, 18, 0.03), 0px 3px 3px -1.5px rgba(10, 13, 18, 0.04)",
      "0px 20px 24px -4px rgba(10, 13, 18, 0.08), 0px 8px 8px -4px rgba(10, 13, 18, 0.03), 0px 3px 3px -1.5px rgba(10, 13, 18, 0.04)",
      "0px 24px 48px -12px rgba(10, 13, 18, 0.18), 0px 4px 4px -2px rgba(10, 13, 18, 0.04)",
      "0px 24px 48px -12px rgba(10, 13, 18, 0.18), 0px 4px 4px -2px rgba(10, 13, 18, 0.04)",
      "0px 32px 64px -12px rgba(10, 13, 18, 0.14), 0px 5px 5px -2.5px rgba(10, 13, 18, 0.04)",
      "0px 32px 64px -12px rgba(10, 13, 18, 0.14), 0px 5px 5px -2.5px rgba(10, 13, 18, 0.04)",
      "0px 32px 64px -12px rgba(10, 13, 18, 0.14), 0px 5px 5px -2.5px rgba(10, 13, 18, 0.04)",
      "0px 32px 64px -12px rgba(10, 13, 18, 0.14), 0px 5px 5px -2.5px rgba(10, 13, 18, 0.04)",
      "0px 32px 64px -12px rgba(10, 13, 18, 0.14), 0px 5px 5px -2.5px rgba(10, 13, 18, 0.04)",
      "0px 32px 64px -12px rgba(10, 13, 18, 0.14), 0px 5px 5px -2.5px rgba(10, 13, 18, 0.04)",
      "0px 32px 64px -12px rgba(10, 13, 18, 0.14), 0px 5px 5px -2.5px rgba(10, 13, 18, 0.04)",
      "0px 32px 64px -12px rgba(10, 13, 18, 0.14), 0px 5px 5px -2.5px rgba(10, 13, 18, 0.04)",
      "0px 32px 64px -12px rgba(10, 13, 18, 0.14), 0px 5px 5px -2.5px rgba(10, 13, 18, 0.04)",
    ] as Shadows,
    components: componentThemes,
  });
};
