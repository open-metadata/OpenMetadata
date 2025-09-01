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
} from '@material/material-color-utilities';
import { DEFAULT_THEME } from '../constants/Appearance.constants';

/**
 * Generates a brand color palette using Google's Material color utilities (AI-based)
 * @param baseColor HEX like "#9E77ED"
 * @returns Tailwind-style 12-step color palette
 */
export const generateAIShades = (baseColor: string) => {
  const source = argbFromHex(baseColor);
  const theme = themeFromSourceColor(source);

  const palette = theme.palettes.primary;
  const tones = [99, 95, 90, 80, 70, 60, 50, 40, 30, 20, 10, 5];

  const shadeKeys = [25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

  const result: Record<number, string> = {};
  shadeKeys.forEach((key, index) => {
    if (key === 600) {
      // Shade 600 should exactly match user input
      result[key] = hexToRgbString(baseColor);
    } else {
      // Generate other shades using Material Design
      result[key] = hexToRgbString(hexFromArgb(palette.tone(tones[index])));
    }
  });

  return result;
};

// Converts hex to Tailwind-style "rgb(R G B)" string
function hexToRgbString(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return `rgb(${r} ${g} ${b})`;
}

/**
 * Generates MUI color palette from hex color using Material Design color utilities
 * @param baseColor Hex color string (e.g., "#1570ef")
 * @returns Object with UntitledUI-style color shades (25-950)
 */
export const generateMuiPalette = (baseColor: string) => {
  try {
    return generateAIShades(baseColor);
  } catch (error) {
    // Return a basic palette on error
    return {
      25: 'rgb(248 250 252)',
      50: 'rgb(241 245 249)',
      100: 'rgb(226 232 240)',
      200: 'rgb(203 213 225)',
      300: 'rgb(148 163 184)',
      400: 'rgb(100 116 139)',
      500: 'rgb(71 85 105)',
      600: 'rgb(51 65 85)',
      700: 'rgb(30 41 59)',
      800: 'rgb(15 23 42)',
      900: 'rgb(2 6 23)',
      950: 'rgb(1 2 6)',
    };
  }
};

/**
 * Generates all color palettes for MUI theme
 * Uses user customizations or falls back to static colors from theme
 */
export const generateAllMuiPalettes = (
  customColors?: {
    primaryColor?: string;
    infoColor?: string;
    successColor?: string;
    warningColor?: string;
    errorColor?: string;
  },
  staticColors?: any
) => {
  const result = {
    brand:
      DEFAULT_THEME.primaryColor !== customColors?.primaryColor
        ? generateMuiPalette(
            customColors?.primaryColor || DEFAULT_THEME.primaryColor
          )
        : staticColors?.brand,

    info:
      DEFAULT_THEME.infoColor !== customColors?.infoColor
        ? generateMuiPalette(customColors?.infoColor || DEFAULT_THEME.infoColor)
        : staticColors?.info,

    success:
      DEFAULT_THEME.successColor !== customColors?.successColor
        ? generateMuiPalette(
            customColors?.successColor || DEFAULT_THEME.successColor
          )
        : staticColors?.success,

    warning:
      DEFAULT_THEME.warningColor !== customColors?.warningColor
        ? generateMuiPalette(
            customColors?.warningColor || DEFAULT_THEME.warningColor
          )
        : staticColors?.warning,

    error:
      DEFAULT_THEME.errorColor !== customColors?.errorColor
        ? generateMuiPalette(
            customColors?.errorColor || DEFAULT_THEME.errorColor
          )
        : staticColors?.error,
  };

  return result;
};
