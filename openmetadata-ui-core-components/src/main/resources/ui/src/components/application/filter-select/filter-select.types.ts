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
import type { FC, ReactNode } from 'react';

export interface FilterSelectOption {
  /** Raw filter value (aggregation bucket key, FQN, …) — what onChange reports. */
  value: string;
  /** Display name — resolved by the consumer, never derived from `value` here. */
  label: ReactNode;
  /** Plain text for typeahead and local search when `label` is not a string. */
  textValue?: string;
  /** Result count shown as a trailing badge on the row. */
  count?: number;
  /**
   * Leading icon (service logo, domain color chip, entity icon, …) — an icon
   * component, or an already-rendered node.
   */
  icon?: FC<{ className?: string }> | ReactNode;
}

export type FilterSelectTriggerVariant = 'button' | 'chip' | 'input';

export type FilterSelectSelectionMode = 'single' | 'multiple';

/**
 * 'immediate' calls onChange on every toggle; 'staged' collects toggles and
 * commits them on Apply (Cancel discards). Single select always applies
 * immediately and closes.
 */
export type FilterSelectCommitMode = 'immediate' | 'staged';

export interface FilterSelectProps {
  /** Filter name — trigger text, menu aria-label, and input-variant caption. */
  label: string;
  options: FilterSelectOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  /**
   * Draw the button-variant trigger as a bordered secondary button. Defaults
   * to a borderless text button — the quick-filter look.
   */
  bordered?: boolean;
  className?: string;
  commitMode?: FilterSelectCommitMode;
  'data-testid'?: string;
  emptyState?: ReactNode;
  /** Muted helper line rendered under the search box. */
  helperText?: ReactNode;
  hideCounts?: boolean;
  isLoading?: boolean;
  isOpen?: boolean;
  /**
   * Pinned row above the value rows (e.g. "No Owner"). Rendered through the
   * same row component as value rows, so it cannot drift visually.
   */
  nullOption?: FilterSelectOption;
  popoverClassName?: string;
  /**
   * Label for a selected value missing from `options` (e.g. restored from a
   * URL before its option page is fetched). Defaults to the raw value.
   */
  resolveMissingLabel?: (value: string) => ReactNode;
  searchable?: boolean;
  selectionMode?: FilterSelectSelectionMode;
  /**
   * Tri-state header row that toggles every currently displayed value row
   * (the filtered list). The null option is an explicit choice and is not
   * included.
   */
  showSelectAll?: boolean;
  /** Leading icon on the button-variant trigger. */
  triggerIcon?: FC<{ className?: string }>;
  triggerVariant?: FilterSelectTriggerVariant;
  onOpenChange?: (open: boolean) => void;
  /** Async search — when set the parent filters `options`; otherwise local. */
  onSearch?: (text: string) => void;
}
