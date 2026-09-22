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
import { HTMLAttributes, ReactNode } from 'react';

/**
 * xs — 10 px font / 16 px badge padding
 * sm — 12 px font / 20 px badge padding
 * md — 14 px font / 24 px badge padding
 */
export type TagSize = 'xs' | 'sm' | 'md';

export interface EntityTagProps extends HTMLAttributes<HTMLSpanElement> {
  label: string;
  /**
   * Rich label content rendered in place of `label` text (e.g. a version-diff
   * decorated node). `label` is still used for the accessible/tooltip text.
   */
  labelNode?: ReactNode;
  /** Hex color from ENTITY_PALETTE_HEX. Omit to use DEFAULT_TAG_COLOR. */
  color?: string;
  /**
   * ICON_MAP key or image URL. Overrides the component's default icon.
   * The default icon is always rendered; this replaces it.
   */
  icon?: string;
  size?: TagSize;
  onDelete?: (e: Event) => void;
  /**
   * When provided (and `onDelete` is not), the entire badge renders as a
   * link to this URL — the whole clickable/focusable surface, not just the
   * label text.
   */
  href?: string;
  maxWidth?: string | number;
  /** Spans have no native `disabled` attribute, so `HTMLAttributes` doesn't carry it. */
  disabled?: boolean;
  tooltip?: string;
  'data-tag-index'?: number;
  /** data-testid for the close/remove button when onDelete is provided. */
  closeButtonTestId?: string;
  /**
   * Marks the entity as inherited (e.g. a domain propagated from a parent),
   * rendering a trailing inherit glyph inside the chip.
   */
  inherited?: boolean;
  /**
   * Accessible name for the inherit glyph, supplied translated by the consumer
   * (the library does not own this app string). When omitted the glyph is
   * decorative (`aria-hidden`).
   */
  inheritedLabel?: string;
}
