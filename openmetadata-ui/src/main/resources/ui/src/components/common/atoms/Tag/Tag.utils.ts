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
  closeIcon: reduceColorOpacity(color, 0.6),
  text: color,
});

/**
 * Tailwind classes for size variants applied to the Badge wrapper and label span.
 *
 * xs → 16px height / 10px font
 * sm → 20px height / 12px font
 * md → 24px height / 14px font
 */
export const SIZE_CLASS: Record<TagSize, string> = {
  xs: 'tw:h-4 tw:text-[10px]',
  sm: 'tw:h-5 tw:text-xs',
  md: 'tw:h-6 tw:text-sm',
};

/** Icon pixel size matching each tag size. */
export const ICON_PX: Record<TagSize, number> = { xs: 10, sm: 12, md: 14 };
