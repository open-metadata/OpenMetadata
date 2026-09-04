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
 * xs — 10 px font / 16 px height
 * sm — 12 px font / 20 px height
 * md — 14 px font / 24 px height
 */
export type TagSize = 'xs' | 'sm' | 'md';

/**
 * Fallback color used when no explicit `color` prop is provided.
 * All four tag components share this default so they look consistent
 * when rendered without a palette color.
 */
export const DEFAULT_TAG_COLOR = '#5D6B98';
export const AUTO_CLASSIFICATION_TAG_COLOR = '#194185';

export interface BaseTagProps {
  label: string;
  /** Hex color from ENTITY_PALETTE_HEX. Omit to use DEFAULT_TAG_COLOR. */
  color?: string;
  /**
   * ICON_MAP key or image URL. Overrides the component's default icon.
   * The default icon is always rendered; this replaces it.
   */
  icon?: string;
  size?: TagSize;
  onDelete?: (e: Event) => void;
  /** When provided, wraps the label in a react-router Link. */
  href?: string;
  maxWidth?: string | number;
  disabled?: boolean;
  className?: string;
  tooltip?: string;
  'data-testid'?: string;
  'data-tag-index'?: number;
}
