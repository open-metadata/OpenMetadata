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

import type { ThemeColors } from '../types';

export interface SemanticTokens {
  surface: {
    default: string;    // Main background
    body: string;       // Body/section muted bg (grey in light, darkest in dark)
    raised: string;     // Cards, elevated elements
    hover: string;      // Hover state
    selected: string;   // Selected items
    disabled: string;   // Disabled elements
    card: string;       // Card/panel background
    input: string;      // Input/form field background
    overlay: string;    // Dropdown/popover/modal background
    header: string;     // Navbar/header background
    sidebar: string;    // Sidebar background
  };
  text: {
    primary: string;    // Main content
    secondary: string;  // Less emphasized
    tertiary: string;   // Supporting text
    disabled: string;   // Disabled text
    inverse: string;    // On dark backgrounds
    link: string;       // Links
  };
  border: {
    default: string;    // Standard borders
    light: string;      // Subtle borders
    strong: string;     // Emphasized borders
    focus: string;      // Focus rings
    subtle: string;     // Very subtle borders (card edges)
  };
  status: {
    success: string;
    successBg: string;
    successBorder: string;
    warning: string;
    warningBg: string;
    warningBorder: string;
    error: string;
    errorBg: string;
    errorBorder: string;
    info: string;
    infoBg: string;
    infoBorder: string;
  };
  interactive: {
    primary: string;
    primaryHover: string;
    primaryActive: string;
  };
}

/**
 * Creates semantic tokens based on the color palette and mode.
 * Semantic tokens are purpose-based (e.g., "text-primary") rather than
 * color-based (e.g., "gray-900"), making them automatically adapt to themes.
 */
export function createSemanticTokens(
  colors: ThemeColors,
  mode: 'light' | 'dark'
): SemanticTokens {
  if (mode === 'dark') {
    // Dark mode: invert the color scale
    // In dark mode, lighter shades (800, 900) are used for text
    // and darker shades (100, 200) are used for backgrounds
    return {
      surface: {
        default: colors.page,                    // #0d1117 - main dark background
        body: colors.page,                       // #0d1117 - body/section muted bg
        raised: colors.surface,                  // #161b22 - cards, panels
        hover: colors.gray[200],                 // #30363d - hover state
        selected: colors.brand[100],             // subtle brand highlight
        disabled: colors.gray[100],              // #21262d - disabled bg
        card: colors.surface,                    // #161b22 - card/panel background
        input: colors.surfaceRaised,             // #21262d - input/form field bg
        overlay: colors.surfaceRaised,           // #21262d - dropdown/popover/modal bg
        header: colors.page,                     // #0d1117 - navbar/header bg (seamless)
        sidebar: colors.page,                    // #0d1117 - sidebar bg (seamless)
      },
      text: {
        primary: colors.gray[800],               // #e6edf3 - primary text (light on dark)
        secondary: colors.gray[500],             // #8b949e - secondary text
        tertiary: colors.gray[400],              // #6e7681 - tertiary text
        disabled: colors.gray[300],              // #484f58 - disabled text
        inverse: colors.gray[25],                // #0d1117 - dark text on light bg
        link: colors.brand[500],                 // #58a6ff - links
      },
      border: {
        default: colors.gray[200],               // #30363d - standard borders
        light: colors.gray[100],                 // #21262d - subtle borders
        strong: colors.gray[300],                // #484f58 - emphasized borders
        focus: colors.brand[500],                // #58a6ff - focus rings
        subtle: colors.gray[100],                // #21262d - very subtle borders
      },
      status: {
        success: colors.success[400],            // brighter in dark mode
        successBg: colors.success[100],          // dark green bg
        successBorder: colors.success[300],
        warning: colors.warning[400],
        warningBg: colors.warning[100],
        warningBorder: colors.warning[300],
        error: colors.error[400],
        errorBg: colors.error[100],
        errorBorder: colors.error[300],
        info: colors.info[400],
        infoBg: colors.info[100],
        infoBorder: colors.info[300],
      },
      interactive: {
        primary: colors.brand[500],              // #58a6ff
        primaryHover: colors.brand[400],
        primaryActive: colors.brand[600],
      },
    };
  }

  // Light mode: standard color scale
  return {
    surface: {
      default: colors.page,                      // #ffffff - main background
      body: colors.surfaceRaised,                 // #f8f9fc - body/section muted bg
      raised: colors.surfaceRaised,               // #f8f9fc - elevated surfaces
      hover: colors.gray[100],                   // light hover
      selected: colors.brand[50],                // light brand highlight
      disabled: colors.gray[100],                // disabled bg
      card: colors.white,                        // #ffffff - card/panel background
      input: colors.white,                       // #ffffff - input/form field bg
      overlay: colors.white,                     // #ffffff - dropdown/popover/modal bg
      header: colors.white,                      // #ffffff - navbar/header bg
      sidebar: colors.white,                     // #ffffff - sidebar bg
    },
    text: {
      primary: colors.gray[900],                 // #181d27 - dark text
      secondary: colors.gray[600],               // #535862 - secondary
      tertiary: colors.gray[500],                // #717680 - tertiary
      disabled: colors.gray[400],                // #a4a7ae - disabled
      inverse: colors.gray[50],                  // light text on dark bg
      link: colors.brand[600],                   // #1570ef - links
    },
    border: {
      default: colors.gray[200],                 // #e9eaeb - standard
      light: colors.gray[100],                   // #f5f5f5 - subtle
      strong: colors.gray[300],                  // #d5d7da - emphasized
      focus: colors.brand[500],                  // focus rings
      subtle: colors.gray[100],                  // #f5f5f5 - very subtle borders
    },
    status: {
      success: colors.success[600],
      successBg: colors.success[50],
      successBorder: colors.success[200],
      warning: colors.warning[600],
      warningBg: colors.warning[50],
      warningBorder: colors.warning[200],
      error: colors.error[600],
      errorBg: colors.error[50],
      errorBorder: colors.error[200],
      info: colors.info[600],
      infoBg: colors.info[50],
      infoBorder: colors.info[200],
    },
    interactive: {
      primary: colors.brand[600],                // #1570ef
      primaryHover: colors.brand[700],
      primaryActive: colors.brand[800],
    },
  };
}
