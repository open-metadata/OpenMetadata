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
import { TagSize } from './tag.types';

/**
 * Tailwind font-size classes for size variants, applied to the label span.
 * Vertical sizing (padding/height) comes from Badge's own `size` prop instead
 * of a fixed height class here — a fixed height overrides Badge's
 * padding-driven sizing and misaligns its vertical padding.
 */
export const SIZE_CLASS: Record<TagSize, string> = {
  xs: 'tw:text-[10px]',
  sm: 'tw:text-xs',
  md: 'tw:text-sm',
};

/** Icon pixel size matching each tag size. */
export const ICON_PX: Record<TagSize, number> = { xs: 10, sm: 12, md: 14 };

/**
 * Fallback color used when no explicit `color` prop is provided — references
 * the gray-cool-500 design token rather than a hardcoded hex. All four
 * user-colorable tag components share this default so they look consistent
 * when rendered without an explicit color. Consumed as a plain CSS custom
 * property value (`style={{ '--tag-color': DEFAULT_TAG_COLOR }}`); the nested
 * `var()` reference resolves automatically wherever the shared tag CSS reads
 * `var(--tag-color)`, so no runtime color resolution is needed here.
 */
export const DEFAULT_TAG_COLOR = 'var(--tw-color-gray-cool-500)';

/**
 * Auto-classification brand identity — references the brand-900 design
 * token (exact value match for the hex it replaces, so no visual change).
 */
export const AUTO_CLASSIFICATION_TAG_COLOR = 'var(--tw-color-brand-700)';

/**
 * Single truncation width for every tag rendered in a flowing list. Call sites
 * previously passed 120/130/140/nothing, so the same term truncated differently
 * depending on which surface it appeared on. Override only where the container
 * is genuinely wider (e.g. a full-width section).
 */
export const DEFAULT_TAG_MAX_WIDTH = 130;
