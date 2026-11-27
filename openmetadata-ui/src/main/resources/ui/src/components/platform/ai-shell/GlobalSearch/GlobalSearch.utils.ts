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
import { EntityType } from '../../../../enums/entity.enum';
import { getQuickFilterQuery } from '../../../../utils/ExplorePureUtils';
import {
  ASSETS_CATEGORY,
  MAX_VISIBLE_TABS,
  QUERY_ACTION_LIST_ID,
  QUERY_ACTION_OPTION_ID,
  RESULTS_LIST_ID,
  TASKS_CATEGORY,
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

export const hasFacetSelection = (selection: GlobalSearchFacetSelection) =>
  Object.values(selection).some((values) => values.length > 0);

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

// Only ⌘↵ / Ctrl+↵ runs the query action; a plain Enter opens the highlighted
// result and does nothing on the action row, so it never starts a chat by accident.
const getEnterAction = (event: KeyInput, context: GlobalSearchKeyContext) => {
  if (event.metaKey || event.ctrlKey) {
    return 'run-action';
  }

  return context.isActionActive ? undefined : 'select';
};

const getTabAction = (event: KeyInput, context: GlobalSearchKeyContext) => {
  if (!context.query.trim() || context.tabCount < 2) {
    return undefined;
  }

  return event.shiftKey ? 'previous-tab' : 'next-tab';
};

// An empty Backspace widens a type tab back to All. It never closes search:
// holding Backspace to clear the text keeps repeating once the input is empty.
const getBackspaceAction = (context: GlobalSearchKeyContext) =>
  context.query || context.isScoped || context.filter === 'all'
    ? undefined
    : 'show-all';

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
  Escape: () => 'close',
};

/** What a key press in the search input does; `undefined` leaves it to the input. */
export const getKeyAction = (
  event: KeyInput,
  context: GlobalSearchKeyContext
): GlobalSearchKeyAction | undefined =>
  KEY_ACTIONS[event.key]?.(event, context);

/**
 * Resolves the highlighted option. `activeIndex` is a row index: 0 is the
 * first result (the default), and -1 is the query action row above it, which
 * the user reaches with ArrowUp. With no rows the action row is highlighted.
 * `index` and `count` are in option space (action row first).
 */
export const getActiveOption = <T extends { key: string }>(
  rows: T[],
  activeIndex: number,
  hasQueryAction: boolean
) => {
  const offset = hasQueryAction ? 1 : 0;
  const count = rows.length + offset;
  const index = clampIndex(activeIndex + offset, count);
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

const RESERVED_SOURCE_KEYS = new Set<string>([
  'all',
  ASSETS_CATEGORY,
  TASKS_CATEGORY,
  ...Object.values(EntityType),
]);

/**
 * A contributed source's key is its tab id, so it must not collide with a
 * built-in category, an entity type or another source; such a contribution is
 * dropped (the first one with a key wins).
 */
export const getUsableSources = (sources: GlobalSearchSourceContribution[]) => {
  const seen = new Set<string>();

  return sources.filter((source) => {
    const isUsable =
      !RESERVED_SOURCE_KEYS.has(source.key) && !seen.has(source.key);
    seen.add(source.key);

    return isUsable;
  });
};

/** Id of the listbox holding one section's rows (the combobox controls each). */
export const getListboxId = (sectionKey?: string) =>
  sectionKey ? `${RESULTS_LIST_ID}-${sectionKey}` : RESULTS_LIST_ID;

/**
 * Rows the keyboard can reach. While the list reloads it shows skeletons, so
 * the previous rows are not on screen and must not be highlighted or opened.
 */
export const getNavigableRows = <T>(
  rows: T[],
  isListLoading: boolean,
  isCounting: boolean
): T[] => (isListLoading || isCounting ? [] : rows);

/** Rows grouped under the section heading that precedes them. */
export const groupBySection = <
  T extends { kind: 'section' | 'row'; key: string }
>(
  items: T[]
) => {
  type Section = Extract<T, { kind: 'section' }>;
  type Row = Extract<T, { kind: 'row' }>;
  const groups: { section?: Section; rows: Row[] }[] = [];
  items.forEach((item) => {
    if (item.kind === 'section') {
      groups.push({ section: item as Section, rows: [] });
    } else {
      if (groups.length === 0) {
        groups.push({ rows: [] });
      }
      groups[groups.length - 1].rows.push(item as Row);
    }
  });

  return groups;
};

/** Every listbox the search input controls: the query action's, then each section's. */
export const getListboxIds = <
  T extends { kind: 'section' | 'row'; key: string }
>(
  items: T[],
  hasQueryAction: boolean
) => [
  ...(hasQueryAction ? [QUERY_ACTION_LIST_ID] : []),
  ...groupBySection(items).map((group) => getListboxId(group.section?.key)),
];

/** Opened from a scoped trigger (e.g. a source's own search button) or not. */
export const getSearchScope = (entry: GlobalSearchFilter) => {
  const scopedCategory = entry === 'all' ? undefined : entry;

  return {
    scopedCategory,
    isScoped: Boolean(scopedCategory),
    scopedSources: scopedCategory ? [scopedCategory] : undefined,
  };
};
