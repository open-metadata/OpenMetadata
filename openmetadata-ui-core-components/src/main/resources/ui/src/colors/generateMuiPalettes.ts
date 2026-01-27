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

import {
  argbFromHex,
  hexFromArgb,
  themeFromSourceColor,
} from "@material/material-color-utilities";
import { normalizeHexColor } from "./colorValidation";
import type {
  ColorPalette,
  CustomColors,
  DynamicPalettes,
  ThemeColors,
} from "../types";

// No conversion needed - return hex directly
function normalizeHex(hex: string): string {
  return hex.toUpperCase();
}

/**
 * Generates a color palette using Google's Material Design color utilities
 * Uses perceptually uniform color science for harmonious color relationships
 * @param baseColor HEX like "#9E77ED"
 * @returns UntitledUI-style 12-step color palette
 */
export const generateMaterialPalette = (baseColor: string): ColorPalette => {
  const source = argbFromHex(baseColor);
  const theme = themeFromSourceColor(source);

  const palette = theme.palettes.primary;
  const tones = [99, 95, 90, 80, 70, 60, 50, 40, 30, 20, 10, 5];

  const shadeKeys = [25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

  const result = {} as ColorPalette;
  shadeKeys.forEach((key, index) => {
    if (key === 600) {
      // Shade 600 should exactly match user input
      (result as any)[key] = normalizeHex(baseColor);
    } else {
      // Generate other shades using Material Design
      (result as any)[key] = normalizeHex(
        hexFromArgb(palette.tone(tones[index]))
      );
    }
  });

  return result as ColorPalette;
};

/**
 * Generates MUI color palette from hex color using Material Design color utilities
 * @param baseColor Hex color string (e.g., "#1570ef")
 * @returns Object with UntitledUI-style color shades (25-950)
 */
// Default fallback palette
const getDefaultPalette = (): ColorPalette => ({
  25: '#F8FAFC',
  50: '#F1F5F9',
  100: '#E2E8F0',
  200: '#CBD5E1',
  300: '#94A3B8',
  400: '#64748B',
  500: '#475569',
  600: '#334155',
  700: '#1E293B',
  800: '#0F172A',
  900: '#020617',
  950: '#010206',
});

export const generateMuiPalette = (baseColor: string): ColorPalette => {
  // Validate and normalize input color
  const normalizedColor = normalizeHexColor(baseColor);
  if (!normalizedColor) {
    // eslint-disable-next-line no-console
    console.warn(`Invalid hex color provided: ${baseColor}`);

    return getDefaultPalette();
  }

  try {
    return generateMaterialPalette(normalizedColor);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`Failed to generate palette for ${baseColor}:`, error);

    return getDefaultPalette();
  }
};

/**
 * Default theme colors fallback
 */
const DEFAULT_THEME_FALLBACK = {
  primaryColor: '#1570ef',
  hoverColor: '#d1e9ff',
  selectedColor: '#175cd3',
  infoColor: '#84caff',
  successColor: '#039855',
  warningColor: '#DC6803',
  errorColor: '#D92D20',
};

/**
 * Generates all color palettes for MUI theme
 * Uses user customizations or falls back to static colors from theme
 */
export const generateAllMuiPalettes = (
  customColors?: CustomColors,
  staticColors?: ThemeColors,
  defaultTheme = DEFAULT_THEME_FALLBACK
): DynamicPalettes => {
  let brandPalette: ColorPalette | undefined;

  if (defaultTheme.primaryColor !== customColors?.primaryColor) {
    brandPalette = generateMuiPalette(
      customColors?.primaryColor || defaultTheme.primaryColor
    );
  } else {
    brandPalette = staticColors?.brand;
  }

  if (
    brandPalette &&
    customColors?.hoverColor &&
    defaultTheme.hoverColor !== customColors.hoverColor
  ) {
    brandPalette = {
      ...brandPalette,
      100: normalizeHex(customColors.hoverColor),
    };
  }

  if (
    brandPalette &&
    customColors?.selectedColor &&
    defaultTheme.selectedColor !== customColors.selectedColor
  ) {
    brandPalette = {
      ...brandPalette,
      700: normalizeHex(customColors.selectedColor),
    };
  }

  const result: DynamicPalettes = {
    brand: brandPalette,

    info:
      defaultTheme.infoColor !== customColors?.infoColor
        ? generateMuiPalette(customColors?.infoColor || defaultTheme.infoColor)
        : staticColors?.info,

    success:
      defaultTheme.successColor !== customColors?.successColor
        ? generateMuiPalette(
            customColors?.successColor || defaultTheme.successColor
          )
        : staticColors?.success,

    warning:
      defaultTheme.warningColor !== customColors?.warningColor
        ? generateMuiPalette(
            customColors?.warningColor || defaultTheme.warningColor
          )
        : staticColors?.warning,

    error:
      defaultTheme.errorColor !== customColors?.errorColor
        ? generateMuiPalette(
            customColors?.errorColor || defaultTheme.errorColor
          )
        : staticColors?.error,
  };

  return result;
};
