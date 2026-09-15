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

import type React from 'react';

/**
 * Color palette with UntitledUI-style shades (25-950)
 * All colors are hex strings (e.g., "#1570EF")
 */
export interface ColorPalette {
  25: string;
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
}

/**
 * Complete color system with all palettes
 */
export interface ThemeColors {
  white: string;
  brand: ColorPalette;
  gray: ColorPalette & { 725: string; 750: string }; // Gray has extra custom shades
  blueGray: Partial<ColorPalette> & {
    40: string; // Custom shade for search field background
    75: string; // Custom shade for chip background
    125: string; // Custom shade for card header fills
    150: string; // Custom shade for chip border
    250: string; // Custom shade for search field borders
  };
  blue: ColorPalette;
  blueLight: ColorPalette;
  indigo: ColorPalette;
  purple: ColorPalette;
  pink: ColorPalette;
  rose: ColorPalette;
  orange: ColorPalette;
  error: ColorPalette;
  warning: ColorPalette;
  success: ColorPalette;
  info: ColorPalette;
}

/**
 * User's custom color preferences from settings
 */
export interface CustomColors {
  primaryColor?: string;
  infoColor?: string;
  hoverColor?: string;
  selectedColor?: string;
  successColor?: string;
  warningColor?: string;
  errorColor?: string;
}

/**
 * Generated dynamic color palettes
 */
export interface DynamicPalettes {
  brand?: ColorPalette;
  info?: ColorPalette;
  success?: ColorPalette;
  warning?: ColorPalette;
  error?: ColorPalette;
}

export type OwnerKind = 'user' | 'team';

/** Pixel size for avatar display in compact contexts (16–64 px). */
export type AvatarSize = 16 | 18 | 20 | 24 | 32 | 40 | 48 | 56 | 64;

/** Minimal owner reference used across avatar group and chip components. */
export interface OwnerRef {
  id: string;
  name?: string;
  displayName?: string;
  type: OwnerKind;
  href?: string;
  /** URL to the user's profile picture, if available. */
  profileUrl?: string;
  /** Custom avatar icon component — overrides the default placeholder icon. */
  icon?: React.FC<{ className?: string }>;
}
