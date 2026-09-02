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

import { ComponentType } from 'react';

/**
 * Visual variant for the Tag atom.
 * - classification: 1 px border, tinted bg/border/text from `color` prop (inline styles)
 * - glossary: 1 px border, always blue-gray tokens, book icon
 * - tier: 1 px border, always purple tokens
 * - domain: 1 px border + 2 px left accent, inline color styles
 * - dataProduct: 1 px border + 2 px left accent, inline color styles
 * - pill: rounded-full, no border, semantic color
 */
export type TagVariant =
  | 'classification'
  | 'glossary'
  | 'tier'
  | 'domain'
  | 'dataProduct'
  | 'pill';

export type TagSize = 'sm' | 'md' | 'lg';

export interface TagProps {
  label: string;
  /** Hex color from the backend. Used for inline styles on classification/domain/dataProduct. */
  color?: string;
  variant?: TagVariant;
  /**
   * Icon to display. Accepts:
   * - A string key from ICON_MAP (e.g. 'Tag01')
   * - An image URL (https:// or data:)
   * - A React component type
   */
  icon?: string | ComponentType<{ size?: number; className?: string }>;
  size?: TagSize;
  onDelete?: (e: Event) => void;
  /** When provided, wraps the label in a router Link. */
  href?: string;
  showIcon?: boolean;
  maxWidth?: string | number;
  disabled?: boolean;
  className?: string;
  'data-testid'?: string;
  'data-tag-index'?: number;
}
