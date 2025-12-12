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
 * Validates if a string is a valid hex color
 * @param color Color string to validate
 * @returns True if valid hex color
 */
export const isValidHexColor = (color: string): boolean => {
  if (!color || typeof color !== 'string') {
    return false;
  }

  // Remove # if present
  const hex = color.replace('#', '');

  // Check if it's 3 or 6 character hex
  if (!/^[0-9A-Fa-f]{3}$/.test(hex) && !/^[0-9A-Fa-f]{6}$/.test(hex)) {
    return false;
  }

  return true;
};

/**
 * Normalizes hex color to 6-character format with #
 * @param color Hex color string
 * @returns Normalized hex color or null if invalid
 */
export const normalizeHexColor = (color: string): string | null => {
  if (!isValidHexColor(color)) {
    return null;
  }

  let hex = color.replace('#', '');

  // Convert 3-char hex to 6-char
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((char) => char + char)
      .join('');
  }

  return `#${hex.toUpperCase()}`;
};

/**
 * Calculates luminance of a color for accessibility checks
 * @param hex Hex color string
 * @returns Luminance value (0-1)
 */
export const getLuminance = (hex: string): number => {
  const normalizedHex = normalizeHexColor(hex);
  if (!normalizedHex) {
    return 0;
  }

  const r = parseInt(normalizedHex.slice(1, 3), 16) / 255;
  const g = parseInt(normalizedHex.slice(3, 5), 16) / 255;
  const b = parseInt(normalizedHex.slice(5, 7), 16) / 255;

  // Apply gamma correction
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
};

/**
 * Calculates contrast ratio between two colors
 * @param color1 First hex color
 * @param color2 Second hex color
 * @returns Contrast ratio (1-21)
 */
export const getContrastRatio = (color1: string, color2: string): number => {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);

  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);

  return (brightest + 0.05) / (darkest + 0.05);
};

/**
 * Checks if color meets WCAG AA accessibility standards
 * @param foreground Foreground color hex
 * @param background Background color hex
 * @returns True if meets WCAG AA (4.5:1 ratio)
 */
export const meetsWCAGAA = (
  foreground: string,
  background: string
): boolean => {
  return getContrastRatio(foreground, background) >= 4.5;
};
