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
import type { ReactNode } from 'react';
import type { SearchSourceAlias } from '../../../../interface/search.interface';

export type GlobalSearchCategory =
  | 'assets'
  | 'chats'
  | 'tasks'
  | 'glossary'
  | 'people'
  | 'domains'
  | 'products'
  | 'articles';

export type GlobalSearchFilter = 'all' | GlobalSearchCategory;

export interface GlobalSearchRow {
  id: string;
  title: string;
  meta?: string;
  icon: ReactNode;
  badges?: string[];
  /** Right-aligned trailing content, e.g. a relative time or avatars. */
  trailing?: ReactNode;
  href?: string;
  /** Present on data-asset rows; drives the summary panel. */
  source?: SearchSourceAlias;
}

export interface GlobalSearchSection {
  count: number;
  rows: GlobalSearchRow[];
}

export type GlobalSearchResults = Partial<
  Record<GlobalSearchCategory, GlobalSearchSection>
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
  /** Footer link shown on this type's tab, e.g. "New chat". */
  footer?: { labelKey: string; path: string };
}

/**
 * Hands a question to the AI assistant. Contributed to
 * `EXTENSION_POINTS.APP_MODE_GLOBAL_SEARCH_ASK_AI`; without one the
 * "Ask AI" row is hidden.
 */
export interface GlobalSearchAskAiContribution {
  /** Where the question opens, e.g. a new chat with it prefilled. */
  getPath: (question: string) => string;
  /** Row text before the quoted question, e.g. "Ask the assistant about". */
  labelKey: string;
  /** Per-tab overrides of `labelKey`, e.g. "Start a new chat about" on chats. */
  labelKeyByFilter?: Partial<Record<GlobalSearchFilter, string>>;
  /** Short name for the footer key hint. */
  hintLabelKey: string;
  /** No-results hint that points at the assistant. */
  emptyHintKey?: string;
}

export interface GlobalSearchFacetSelection {
  [field: string]: string[];
}

export type GlobalSearchListItem =
  | {
      kind: 'section';
      key: string;
      label: string;
      seeAll?: { label: string; onPress: () => void };
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
