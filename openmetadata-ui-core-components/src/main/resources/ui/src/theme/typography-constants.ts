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
 * Typography constants for fontSize and lineHeight values
 * All values are in rem, calculated based on 14px root font size
 * Formula: (target_px / 14) = rem value
 */

// Root font size (in pixels)
export const ROOT_FONT_SIZE = 14;

// Base font size values (used across multiple components)
const FONT_SIZE = {
  XL: '4.286rem', // 60px
  LG: '3.429rem', // 48px
  MD: '2.571rem', // 36px
  SM: '2.143rem', // 30px
  XS: '1.714rem', // 24px
  XXS: '1.429rem', // 20px
  BASE_LARGE: '1.286rem', // 18px
  BASE: '1.143rem', // 16px
  BASE_SMALL: '1rem', // 14px
  SMALL: '0.875rem', // 12.25px
  CAPTION: '0.857rem', // 12px
} as const;

const LINE_HEIGHT = {
  XL: '5.143rem', // 72px
  LG: '4.286rem', // 60px
  MD: '3.143rem', // 44px
  SM: '2.714rem', // 38px
  XS: '2.286rem', // 32px
  XXS: '2.143rem', // 30px
  BASE_LARGE: '2rem', // 28px
  BASE: '1.714rem', // 24px
  BASE_MEDIUM: '1.429rem', // 20px
  BASE_SMALL: '1.429rem', // 20px
  CAPTION: '1.286rem', // 18px
  HELPER: '1.25rem', // 17.5px
} as const;

// Heading font sizes (fontSize)
export const HEADING_FONT_SIZES = {
  H1: FONT_SIZE.XL, // 60px
  H2: FONT_SIZE.LG, // 48px
  H3: FONT_SIZE.MD, // 36px
  H4: FONT_SIZE.SM, // 30px
  H5: FONT_SIZE.XS, // 24px
  H6: FONT_SIZE.XXS, // 20px
} as const;

// Heading line heights
export const HEADING_LINE_HEIGHTS = {
  H1: LINE_HEIGHT.XL, // 72px
  H2: LINE_HEIGHT.LG, // 60px
  H3: LINE_HEIGHT.MD, // 44px
  H4: LINE_HEIGHT.SM, // 38px
  H5: LINE_HEIGHT.XS, // 32px
  H6: LINE_HEIGHT.XXS, // 30px
} as const;

// Body text font sizes
export const BODY_FONT_SIZES = {
  SUBTITLE1: FONT_SIZE.BASE_LARGE, // 18px
  SUBTITLE2: FONT_SIZE.BASE, // 16px
  BODY1: FONT_SIZE.BASE, // 16px
  BODY2: FONT_SIZE.BASE_SMALL, // 14px
  CAPTION: FONT_SIZE.CAPTION, // 12px
  BUTTON: FONT_SIZE.BASE_SMALL, // 14px
  SMALL: FONT_SIZE.SMALL, // 12.25px
} as const;

// Body text line heights
export const BODY_LINE_HEIGHTS = {
  SUBTITLE1: LINE_HEIGHT.BASE_LARGE, // 28px
  SUBTITLE2: LINE_HEIGHT.BASE, // 24px
  BODY1: LINE_HEIGHT.BASE, // 24px
  BODY2: LINE_HEIGHT.BASE_SMALL, // 20px
  CAPTION: LINE_HEIGHT.CAPTION, // 18px
  HELPER: LINE_HEIGHT.HELPER, // 17.5px
} as const;

// Button/Form component sizes
export const COMPONENT_FONT_SIZES = {
  BUTTON_SMALL: FONT_SIZE.BASE_SMALL, // 14px
  BUTTON_MEDIUM: FONT_SIZE.BASE_SMALL, // 14px
  BUTTON_LARGE: FONT_SIZE.BASE, // 16px
  INPUT: FONT_SIZE.BASE, // 16px
  SELECT: FONT_SIZE.BASE, // 16px
} as const;

export const COMPONENT_LINE_HEIGHTS = {
  BUTTON_SMALL: LINE_HEIGHT.BASE_SMALL, // 20px
  BUTTON_MEDIUM: LINE_HEIGHT.BASE_SMALL, // 20px
  BUTTON_LARGE: LINE_HEIGHT.BASE, // 24px
  INPUT: LINE_HEIGHT.BASE, // 24px
  SELECT: LINE_HEIGHT.BASE_MEDIUM, // 20px
} as const;
