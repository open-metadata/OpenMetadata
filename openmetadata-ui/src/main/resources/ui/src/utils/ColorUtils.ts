/*
 *  Copyright 2022 Collate.
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

import { BASE_COLORS } from '../constants/DataInsight.constants';

export const getFirstAlphanumeric = (name: string): string => {
  /**
   * \p{L} → matches any kind of letter from any language (Latin, Cyrillic, Chinese, etc.).
   * \p{N} → matches any kind of numeric digit (Arabic-Indic, Roman numerals, etc.).
   * u flag → required for Unicode property escapes to work.
   */
  const match = name.match(/[\p{L}\p{N}]/u);

  return match ? match[0].toLowerCase() : name.charAt(0).toLowerCase();
};

export const getRandomColor = (name: string) => {
  const firstAlphabet = getFirstAlphanumeric(name);
  // Convert the user's name to a numeric value
  let nameValue = 0;
  for (let i = 0; i < name.length; i++) {
    nameValue += name.charCodeAt(i) * 8;
  }

  // Generate a random hue based on the name value
  const hue = nameValue % 360;

  return {
    color: `hsl(${hue}, 70%, 40%)`,
    backgroundColor: `hsl(${hue}, 100%, 92%)`,
    character: firstAlphabet.toUpperCase(),
  };
};

/**
 * @param color hex have color code
 * @param opacity take opacity how much to reduce it
 * @returns hex color string
 */
export const reduceColorOpacity = (hex: string, opacity: number): string => {
  hex = hex.replace(/^#/, ''); // Remove the "#" if it's there
  hex = hex.length === 3 ? hex.replace(/./g, '$&$&') : hex; // Expand short hex to full hex format
  const [red, green, blue] = [0, 2, 4].map((i) =>
    parseInt(hex.slice(i, i + 2), 16)
  ); // Parse hex values

  return `rgba(${red}, ${green}, ${blue}, ${opacity})`; // Create RGBA color
};

/**
 * Convert hex color to RGBA
 * @param hex - Hex color string
 * @param opacity - Opacity value (0-1)
 * @returns {string} - RGBA color string
 */
const hexToRgba = (hex: string, opacity: number): string => {
  const bigint = parseInt(hex.replace('#', ''), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;

  return `rgba(${r}, ${g}, ${b}, ${opacity.toFixed(2)})`;
};

/**
 * Generate a color with decreasing opacity after the first 24 colors.
 * @param index - The index of the label
 * @returns {string} - RGBA color string
 */
export const entityChartColor = (index: number): string => {
  const baseColor = BASE_COLORS[index % BASE_COLORS.length]; // Cycle through base colors
  const opacity =
    index < BASE_COLORS.length
      ? 1 // Full opacity for the first 24 labels
      : Math.max(1 - Math.floor(index / BASE_COLORS.length) * 0.1, 0.1); // Decrease opacity for subsequent labels

  return hexToRgba(baseColor, opacity);
};

/**
 * Check if the color is a linear gradient
 * @param color - Color string
 * @returns {boolean} - True if the color is a linear gradient, false otherwise
 */
export const isLinearGradient = (color: string) => {
  return color.toLowerCase().includes('linear-gradient');
};
