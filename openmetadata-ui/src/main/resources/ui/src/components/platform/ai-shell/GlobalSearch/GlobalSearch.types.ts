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
import type { ComponentType, ReactNode } from 'react';
import type { SearchDropdownOption } from '../../../../interface/quickFilter.interface';
import type { SearchSourceAlias } from '../../../../interface/search.interface';

/**
 * A result type: `assets` (every data asset type rolled up), `tasks`, an
 * entity type the search API returned (e.g. `glossaryTerm`), or a key a
 * plugin contributes (e.g. `chats`).
 */
export type GlobalSearchCategory = string;

export type GlobalSearchFilter = 'all' | GlobalSearchCategory;

export interface GlobalSearchRow {
  id: string;
  title: string;
  meta?: string;
  /** Parent breadcrumb, e.g. `service › database › schema`. */
  path?: string;
  icon: ReactNode;
  badges?: string[];
  /** Right-aligned trailing text, e.g. a relative time. */
  trailing?: ReactNode;
  /** Shown before `trailing`, e.g. a participant avatar stack. */
  addon?: ReactNode;
  /** What Enter does on this row, e.g. "Open chat"; defaults to "Open". */
  enterLabel?: string;
  href?: string;
  /** Present on data-asset rows; drives the summary panel. */
  source?: SearchSourceAlias;
}

export interface GlobalSearchSection {
  count: number;
  rows: GlobalSearchRow[];
  /** Display name for categories that come from the API. */
  label?: string;
}

export type GlobalSearchResults = Record<
  GlobalSearchCategory,
  GlobalSearchSection
>;

/**
 * A result type a downstream build adds to the search (e.g. Collate's chats).
 * Contributed to `EXTENSION_POINTS.APP_MODE_GLOBAL_SEARCH_SOURCES`.
 */
export interface GlobalSearchSourceContribution {
  key: GlobalSearchCategory;
  labelKey: string;
  search: (query: string, signal: AbortSignal) => Promise<GlobalSearchSection>;
  /** Rows shown before the user types, under `recentLabelKey`. */
  recent?: (signal: AbortSignal) => Promise<GlobalSearchRow[]>;
  recentLabelKey?: string;
  /** Input placeholder when search is opened scoped to this type. */
  placeholderKey?: string;
  /** ⌥⌘K opens search scoped to this source. */
  hasScopeShortcut?: boolean;
  /** Footer link shown on this type's tab, e.g. "New chat". */
  footer?: { labelKey: string; path: string };
}

export interface GlobalSearchQueryActionProps {
  /** DOM id the search input points `aria-activedescendant` at. */
  id: string;
  query: string;
  filter: GlobalSearchFilter;
  isActive: boolean;
  onHover: () => void;
  onSelect: () => void;
}

/**
 * An action on the typed query shown above the results (Collate: "Ask Collate
 * AI"). The plugin owns its row and copy; OSS only places it first in the list,
 * keeps it keyboard reachable and runs it on ⌘↵. Contributed to
 * `EXTENSION_POINTS.APP_MODE_GLOBAL_SEARCH_QUERY_ACTION`.
 */
export interface GlobalSearchQueryActionContribution {
  component: ComponentType<GlobalSearchQueryActionProps>;
  /** Where running the action goes. */
  getPath: (query: string) => string;
  /** Short name for the footer key hint. */
  hintLabelKey: string;
  /** Replaces the default no-results hint. */
  emptyHintKey?: string;
}

/** Selected facet values per field, kept with their labels for the triggers. */
export type GlobalSearchFacetSelection = Record<string, SearchDropdownOption[]>;

export type GlobalSearchListItem =
  | {
      kind: 'section';
      key: string;
      label: string;
      seeAll?: { label: string; onPress: () => void };
      /** Shows the asset sort control on this heading. */
      hasSort?: boolean;
    }
  | {
      kind: 'row';
      key: string;
      row: GlobalSearchRow;
      enterLabel: string;
      onSelect: () => void;
      onRemove?: () => void;
    };

export type GlobalSearchRowItem = Extract<
  GlobalSearchListItem,
  { kind: 'row' }
>;

export interface GlobalSearchFooterAction {
  label: string;
  onPress: () => void;
}
