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

import type { CSSProperties } from 'react';
import { reduceColorOpacity } from '../../../../utils/ColorUtils';
import type { TagSize } from './Tag.interface';

/**
 * Derives the three inline-style color values used across all tag components
 * from a single hex color.
 *
 * Opacities:
 *   bg        →  5%   (very light tint for chip background)
 *   border    → 32%   (readable border against the tinted bg)
 *   closeIcon → 60%   (muted relative to text, clearly distinct from bg)
 *   text      → raw hex (full opacity for accessible contrast)
 */
export const computeTagColors = (color: string) => ({
  bg: reduceColorOpacity(color, 0.05),
  border: reduceColorOpacity(color, 0.32),
  closeIcon: reduceColorOpacity(color, 0.60),
  text: color,
});

/**
 * Inline style overrides applied to Badge/BadgeWithButton to produce exact
 * heights and font sizes, overriding Badge's built-in padding classes.
 *
 * xs → 10 px font / 16 px height
 * sm → 12 px font / 20 px height
 * md → 14 px font / 24 px height
 */
export const SIZE_INLINE: Record<TagSize, CSSProperties> = {
  xs: {
    fontSize: '10px',
    height: '16px',
    lineHeight: '16px',
    paddingLeft: '4px',
    paddingRight: '4px',
    paddingTop: '0',
    paddingBottom: '0',
  },
  sm: {
    fontSize: '12px',
    height: '20px',
    lineHeight: '20px',
    paddingLeft: '6px',
    paddingRight: '6px',
    paddingTop: '0',
    paddingBottom: '0',
  },
  md: {
    fontSize: '14px',
    height: '24px',
    lineHeight: '24px',
    paddingLeft: '8px',
    paddingRight: '8px',
    paddingTop: '0',
    paddingBottom: '0',
  },
};

/** Icon pixel size matching each tag size. */
export const ICON_PX: Record<TagSize, number> = { xs: 10, sm: 12, md: 14 };
