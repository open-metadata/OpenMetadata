/*
 *  Copyright 2026 Collate.
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
import { TagSize } from './Tag.interface';

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

/**
 * Fallback color used when no explicit `color` prop is provided.
 * All four tag components share this default so they look consistent
 * when rendered without a palette color.
 */
export const DEFAULT_TAG_COLOR = '#5D6B98';
export const AUTO_CLASSIFICATION_TAG_COLOR = '#194185';
