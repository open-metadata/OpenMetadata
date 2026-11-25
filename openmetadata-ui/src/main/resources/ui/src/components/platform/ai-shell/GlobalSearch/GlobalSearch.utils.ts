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
import { escapeRegExp } from 'lodash';
import { getQuickFilterQuery } from '../../../../utils/ExplorePureUtils';
import {
  ASSETS_CATEGORY,
  MAX_VISIBLE_TABS,
  QUERY_ACTION_OPTION_ID,
} from './GlobalSearch.constants';
import {
  GlobalSearchCategory,
  GlobalSearchFacetSelection,
  GlobalSearchFilter,
  GlobalSearchQueryActionContribution,
  GlobalSearchResults,
  GlobalSearchRow,
  GlobalSearchSourceContribution,
} from './GlobalSearch.types';

export interface HighlightPart {
  text: string;
  isMatch: boolean;
  /** Character offset in the source text; a stable React key. */
  offset: number;
}

/**
 * Tabs for the types the query matched, biggest first; ties keep `order` (the
 * order the API returned them in). The active type stays listed even at zero
 * so the bar doesn't jump under the cursor mid-typing.
 */
export const getVisibleTabs = (
  results: GlobalSearchResults,
  active: GlobalSearchFilter,
  order: GlobalSearchCategory[]
): { shown: GlobalSearchCategory[]; more: GlobalSearchCategory[] } => {
  const hits = order
    .filter((key) => (results[key]?.count ?? 0) > 0 || key === active)
    .sort(
      (a, b) =>
        (results[b]?.count ?? 0) - (results[a]?.count ?? 0) ||
        order.indexOf(a) - order.indexOf(b)
    );

  return {
    shown: hits.slice(0, MAX_VISIBLE_TABS),
    more: hits.slice(MAX_VISIBLE_TABS),
  };
};

export const getTotalCount = (results: GlobalSearchResults) =>
  Object.values(results).reduce((sum, section) => sum + section.count, 0);

/** Next tab for Tab / Shift+Tab, wrapping at both ends. */
export const getAdjacentFilter = (
  order: GlobalSearchFilter[],
  current: GlobalSearchFilter,
  backwards: boolean
): GlobalSearchFilter => {
  const index = Math.max(0, order.indexOf(current));
  const step = backwards ? order.length - 1 : 1;

  return order[(index + step) % order.length];
};

export const clampIndex = (index: number, count: number) =>
  Math.min(Math.max(0, index), Math.max(0, count - 1));

export const splitHighlight = (
  text: string,
  query: string
): HighlightPart[] => {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) {
    return [{ text, isMatch: false, offset: 0 }];
  }
  const lowered = new Set(tokens.map((token) => token.toLowerCase()));
  const pattern = new RegExp(`(${tokens.map(escapeRegExp).join('|')})`, 'ig');
  let offset = 0;

  return text
    .split(pattern)
    .filter(Boolean)
    .map((part) => {
      const piece = {
        text: part,
        isMatch: lowered.has(part.toLowerCase()),
        offset,
      };
      offset += part.length;

      return piece;
    });
};

/** ES query filter in the shape Explore's `quickFilter` URL param expects. */
export const getFacetQueryFilter = (
  selection: GlobalSearchFacetSelection,
  exceptField?: string
) =>
  getQuickFilterQuery(
    Object.entries(selection)
      .filter(([field]) => field !== exceptField)
      .map(([field, values]) => ({
        key: field,
        label: field,
        value: values,
      }))
  );

export const getExploreParams = (
  selection: GlobalSearchFacetSelection,
  sort: string,
  sortOrder: string
): Record<string, string> => {
  const quickFilter = getFacetQueryFilter(selection);

  return {
    sort,
    sortOrder,
    ...(quickFilter ? { quickFilter: JSON.stringify(quickFilter) } : {}),
  };
};

export const getPageSize = (
  category: GlobalSearchCategory,
  isActive: boolean,
  sizes: { active: number; assets: number; other: number }
) => {
  if (isActive) {
    return sizes.active;
  }

  return category === ASSETS_CATEGORY ? sizes.assets : sizes.other;
};

export type GlobalSearchKeyAction =
  | 'next'
  | 'previous'
  | 'run-action'
  | 'select'
  | 'next-tab'
  | 'previous-tab'
  | 'show-all'
  | 'clear'
  | 'close';

export interface GlobalSearchKeyContext {
  query: string;
  filter: GlobalSearchFilter;
  isScoped: boolean;
  isActionActive: boolean;
  tabCount: number;
}

interface KeyInput {
  key: string;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
}

const getEnterAction = (event: KeyInput, context: GlobalSearchKeyContext) =>
  event.metaKey || event.ctrlKey || context.isActionActive
    ? 'run-action'
    : 'select';

const getTabAction = (event: KeyInput, context: GlobalSearchKeyContext) => {
  if (!context.query.trim() || context.tabCount < 2) {
    return undefined;
  }

  return event.shiftKey ? 'previous-tab' : 'next-tab';
};

// Opened scoped to one source, an empty Backspace leaves search; elsewhere it widens a
// scoped tab back to All.
const getBackspaceAction = (context: GlobalSearchKeyContext) => {
  if (context.query) {
    return undefined;
  }
  if (context.isScoped) {
    return 'close';
  }

  return context.filter === 'all' ? undefined : 'show-all';
};

const KEY_ACTIONS: Record<
  string,
  (
    event: KeyInput,
    context: GlobalSearchKeyContext
  ) => GlobalSearchKeyAction | undefined
> = {
  ArrowDown: () => 'next',
  ArrowUp: () => 'previous',
  Enter: getEnterAction,
  Tab: getTabAction,
  Backspace: (_event, context) => getBackspaceAction(context),
  Escape: (_event, context) => (context.query ? 'clear' : 'close'),
};

/** What a key press in the search input does; `undefined` leaves it to the input. */
export const getKeyAction = (
  event: KeyInput,
  context: GlobalSearchKeyContext
): GlobalSearchKeyAction | undefined =>
  KEY_ACTIONS[event.key]?.(event, context);

/**
 * Resolves the highlighted option. The "Ask AI" row, when shown, is option 0
 * and the result rows follow it.
 */
export const getActiveOption = <T extends { key: string }>(
  rows: T[],
  activeIndex: number,
  hasQueryAction: boolean
) => {
  const offset = hasQueryAction ? 1 : 0;
  const count = rows.length + offset;
  const index = clampIndex(activeIndex, count);
  const isActionActive = hasQueryAction && index === 0;
  const row = isActionActive ? undefined : rows[index - offset];

  return {
    index,
    count,
    offset,
    isActionActive,
    row,
    optionId: isActionActive
      ? QUERY_ACTION_OPTION_ID
      : row && `global-search-option-${row.key}`,
  };
};

export interface GlobalSearchViewInput {
  query: string;
  filter: GlobalSearchFilter;
  isScoped: boolean;
  hasQueryAction: boolean;
  isLoading: boolean;
  hasError: boolean;
  rowCount: number;
  isPreviewOpen: boolean;
  order: GlobalSearchCategory[];
}

const getTabOrder = (
  isScoped: boolean,
  filter: GlobalSearchFilter,
  order: GlobalSearchCategory[]
): GlobalSearchFilter[] => (isScoped ? [filter] : ['all', ...order]);

const isEmptyResult = ({
  isLoading,
  hasError,
  rowCount,
}: Pick<GlobalSearchViewInput, 'isLoading' | 'hasError' | 'rowCount'>) =>
  !isLoading && !hasError && rowCount === 0;

/** The tab whose own filters show; none on "All" or before typing. */
const getFilterBarCategory = (hasQuery: boolean, filter: GlobalSearchFilter) =>
  hasQuery && filter !== 'all' ? filter : undefined;

/** Which parts of the search panel show for the current state. */
export const getPanelView = (input: GlobalSearchViewInput) => {
  const { query, filter, isScoped, hasQueryAction, hasError, isPreviewOpen } =
    input;
  const hasQuery = query.trim().length > 0;
  const tabOrder = getTabOrder(isScoped, filter, input.order);

  return {
    tabOrder,
    showTabBar: hasQuery || isScoped,
    showTaskBar: hasQuery && filter === 'tasks',
    filterBarCategory: getFilterBarCategory(hasQuery, filter),
    showQueryAction: hasQueryAction && hasQuery && !hasError,
    showTabHint: hasQuery && !isPreviewOpen && tabOrder.length > 1,
    isEmpty: hasQuery && isEmptyResult(input),
  };
};

/**
 * i18n keys for text the plugins own: the query action's hints and the scoped
 * source's placeholder and "recent" heading. OSS ships only neutral copy.
 */
export const getContributedLabelKeys = ({
  scopedSource,
  queryAction,
  isScoped,
}: {
  scopedSource?: GlobalSearchSourceContribution;
  queryAction?: GlobalSearchQueryActionContribution;
  isScoped: boolean;
}) => ({
  placeholder:
    (isScoped && scopedSource?.placeholderKey) ||
    'message.global-search-placeholder',
  recent: scopedSource?.recentLabelKey ?? scopedSource?.labelKey ?? '',
  actionHint: queryAction?.hintLabelKey ?? '',
  emptyHint: queryAction?.emptyHintKey,
});

/**
 * What the tab bar counts. Before typing, a scoped search lists its source's
 * recent rows, so its tab counts those ("Chats 10"); otherwise counts show once
 * a query has loaded.
 */
export const getTabCounts = ({
  query,
  scopedCategory,
  recents,
  results,
  isCounting,
}: {
  query: string;
  scopedCategory?: GlobalSearchCategory;
  recents: { key: string; rows: GlobalSearchRow[] }[];
  results: GlobalSearchResults;
  isCounting: boolean;
}): { results: GlobalSearchResults; hideCounts: boolean } => {
  const recent = query
    ? undefined
    : recents.find((item) => item.key === scopedCategory);
  if (recent) {
    return {
      results: {
        [recent.key]: { count: recent.rows.length, rows: recent.rows },
      },
      hideCounts: false,
    };
  }

  return { results, hideCounts: !query || isCounting };
};

/** Opened from a scoped trigger (e.g. a source's own search button) or not. */
export const getSearchScope = (entry: GlobalSearchFilter) => {
  const scopedCategory = entry === 'all' ? undefined : entry;

  return {
    scopedCategory,
    isScoped: Boolean(scopedCategory),
    scopedSources: scopedCategory ? [scopedCategory] : undefined,
  };
};
