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
import {
  KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { TaskStatus, TaskType } from '../../../../generated/entity/tasks/task';
import { usePersistentStorage } from '../../../../hooks/currentUserStore/useCurrentUserStore';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { addToRecentSearched } from '../../../../utils/RecentActivityUtils';
import { getExplorePath } from '../../../../utils/RouterUtils';
import { PERSONAL_SPACE_ROUTES } from '../../../discovery/personal-space/personalSpace.constants';
import {
  useGlobalSearchAskAi,
  useGlobalSearchSources,
} from '../appModeExtensions';
import AssetSummaryPanel from './AssetSummaryPanel';
import {
  ASSET_SORT_OPTIONS,
  CATEGORY_LABEL_KEY,
  CATEGORY_ORDER,
} from './GlobalSearch.constants';
import {
  GlobalSearchCategory,
  GlobalSearchFacetSelection,
  GlobalSearchFilter,
  GlobalSearchFooterAction,
  GlobalSearchResults,
  GlobalSearchRow,
  GlobalSearchRowItem,
  GlobalSearchSourceContribution,
} from './GlobalSearch.types';
import {
  clampIndex,
  countSelectedFacets,
  getActiveOption,
  getContributedLabelKeys,
  getAdjacentFilter,
  getExploreParams,
  getKeyAction,
  getPanelView,
  getTotalCount,
  getVisibleTabs,
  GlobalSearchKeyAction,
} from './GlobalSearch.utils';
import GlobalSearchAskAiRow from './GlobalSearchAskAiRow';
import GlobalSearchAssetBar from './GlobalSearchAssetBar';
import GlobalSearchFooter from './GlobalSearchFooter';
import GlobalSearchInput from './GlobalSearchInput';
import GlobalSearchResultList from './GlobalSearchResultList';
import GlobalSearchTabBar from './GlobalSearchTabBar';
import GlobalSearchTaskBar from './GlobalSearchTaskBar';
import { useGlobalSearchItems } from './useGlobalSearchItems';
import { useGlobalSearchResults } from './useGlobalSearchResults';
import { useGlobalSearchStore } from './useGlobalSearchStore';

const NO_RECENT: never[] = [];

interface FooterActionParams {
  filter: GlobalSearchFilter;
  results: GlobalSearchResults;
  source?: GlobalSearchSourceContribution;
  t: (key: string, options?: Record<string, unknown>) => string;
  onExplore: () => void;
  onNavigate: (path: string) => void;
}

/** The contextual footer link: where "see more of this" lives for each type. */
const getFooterAction = ({
  filter,
  results,
  source,
  t,
  onExplore,
  onNavigate,
}: FooterActionParams): GlobalSearchFooterAction | undefined => {
  if (filter === 'assets') {
    return {
      label: t('label.open-count-results-in-explore', {
        count: results.assets?.count ?? 0,
      }),
      onPress: onExplore,
    };
  }
  if (filter === 'tasks') {
    return {
      label: t('label.open-task-inbox'),
      onPress: () => onNavigate(PERSONAL_SPACE_ROUTES.INBOX_TASKS),
    };
  }
  const footer = source?.footer;

  return footer
    ? {
        label: t(footer.labelKey),
        onPress: () => onNavigate(footer.path),
      }
    : undefined;
};

const GlobalSearchPanel = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const entry = useGlobalSearchStore((state) => state.entry);
  const close = useGlobalSearchStore((state) => state.close);
  const sources = useGlobalSearchSources();
  const askAi = useGlobalSearchAskAi();
  const userName = useApplicationStore((state) => state.currentUser?.name);
  const recentSearches = usePersistentStorage(
    (state) =>
      (userName && state.preferences[userName]?.recentlySearched) || NO_RECENT
  );
  const recentlyViewed = usePersistentStorage(
    (state) =>
      (userName && state.preferences[userName]?.recentlyViewed) || NO_RECENT
  );

  const isChatsOnly = entry === 'chats';
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<GlobalSearchFilter>(entry);
  const [facets, setFacets] = useState<GlobalSearchFacetSelection>({});
  const [sort, setSort] = useState(ASSET_SORT_OPTIONS[0].value);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [taskStatus, setTaskStatus] = useState<TaskStatus>();
  const [taskType, setTaskType] = useState<TaskType>();
  const [activeIndex, setActiveIndex] = useState(0);
  const [previewId, setPreviewId] = useState<string>();
  const [retryKey, setRetryKey] = useState(0);
  const [recentChats, setRecentChats] = useState<GlobalSearchRow[]>([]);

  const trimmed = query.trim();
  const sourceKeys = sources.map((source) => source.key).join();
  const sourceFor = useCallback(
    (key: GlobalSearchFilter) => sources.find((source) => source.key === key),
    // Contributions are fixed once plugins register; the keys identify them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sourceKeys]
  );
  const labelFor = useCallback(
    (key: GlobalSearchCategory) =>
      t(sourceFor(key)?.labelKey ?? CATEGORY_LABEL_KEY[key] ?? key),
    [sourceFor, t]
  );
  const categories = useMemo<GlobalSearchCategory[]>(
    () =>
      isChatsOnly
        ? ['chats']
        : CATEGORY_ORDER.filter((key) => key !== 'chats' || sourceFor(key)),
    [isChatsOnly, sourceFor]
  );

  const { results, isLoading, isFirstLoad, hasError } = useGlobalSearchResults({
    query,
    filter,
    categories,
    facets,
    sort,
    sortOrder,
    taskStatus,
    taskType,
    sources,
    retryKey,
  });

  useEffect(() => {
    const controller = new AbortController();
    sourceFor('chats')
      ?.recent?.(controller.signal)
      .then(setRecentChats)
      .catch(() => setRecentChats([]));

    return () => controller.abort();
  }, [sourceFor]);

  // A type with no hits leaves the bar, so fall back to All rather than
  // strand the user on a tab they can no longer see.
  useEffect(() => {
    const isStranded =
      trimmed && !isLoading && filter !== 'all' && !results[filter]?.count;
    if (isStranded && !isChatsOnly) {
      setFilter('all');
    }
  }, [trimmed, isLoading, isChatsOnly, filter, results]);

  const changeFilter = useCallback((next: GlobalSearchFilter) => {
    setFilter(next);
    setActiveIndex(0);
    setPreviewId(undefined);
  }, []);

  const changeQuery = useCallback((value: string) => {
    setQuery(value);
    setActiveIndex(0);
    setPreviewId(undefined);
  }, []);

  const changeFacet = useCallback((field: string, values: string[]) => {
    setFacets((previous) => ({ ...previous, [field]: values }));
    setActiveIndex(0);
  }, []);

  const reverseSort = useCallback(
    () => setSortOrder((current) => (current === 'desc' ? 'asc' : 'desc')),
    []
  );

  const searchEverything = useCallback(() => {
    useGlobalSearchStore.setState({ entry: 'all' });
    changeFilter('all');
  }, [changeFilter]);

  const goTo = useCallback(
    (path: string, state?: unknown) => {
      addToRecentSearched(trimmed);
      close();
      navigate(path, state ? { state } : undefined);
    },
    [trimmed, close, navigate]
  );

  const openRow = useCallback(
    (row: GlobalSearchRow) => (row.href ? goTo(row.href) : close()),
    [goTo, close]
  );

  const handleAskAi = useCallback(() => {
    if (askAi && trimmed) {
      close();
      navigate(askAi.getPath(trimmed));
    }
  }, [askAi, trimmed, close, navigate]);

  const openInExplore = useCallback(
    () =>
      goTo(
        getExplorePath({
          search: trimmed,
          isPersistFilters: false,
          extraParameters: getExploreParams(facets, sort, sortOrder),
        }),
        {
          fromGlobalSearch: {
            query: trimmed,
            filterCount: countSelectedFacets(facets),
          },
        }
      ),
    [goTo, trimmed, facets, sort, sortOrder]
  );

  const { shown, more } = useMemo(
    () => getVisibleTabs(results, filter),
    [results, filter]
  );
  const order = useMemo(() => [...shown, ...more], [shown, more]);

  const labelKeys = getContributedLabelKeys({
    scopedSource: sourceFor('chats'),
    askAi,
    filter,
    isScoped: isChatsOnly,
  });

  const items = useGlobalSearchItems({
    query: trimmed,
    filter,
    isChatsOnly,
    results,
    order,
    recentSearches,
    recentlyViewed,
    recentChats,
    recentChatsLabel: t(labelKeys.recent),
    previewId,
    labelFor,
    onOpen: openRow,
    onPreview: setPreviewId,
    onSearchTerm: changeQuery,
    onShowType: changeFilter,
  });

  const rows = items.filter(
    (item): item is GlobalSearchRowItem => item.kind === 'row'
  );
  const previewRow = rows.find((item) => item.row.id === previewId)?.row;
  const view = getPanelView({
    query,
    filter,
    isChatsOnly,
    canAskAi: Boolean(askAi),
    isLoading,
    hasError,
    rowCount: rows.length,
    isPreviewOpen: Boolean(previewRow),
    order,
  });
  const { tabOrder, showAskAi: showAi } = view;
  const {
    index: active,
    count: optionCount,
    offset: aiOffset,
    isAiActive,
    row: activeRow,
    optionId: activeOptionId,
  } = getActiveOption(rows, activeIndex, showAi);

  useEffect(() => {
    if (activeOptionId) {
      document
        .getElementById(activeOptionId)
        ?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [activeOptionId]);

  const keyActions: Record<GlobalSearchKeyAction, () => void> = {
    next: () => setActiveIndex(clampIndex(active + 1, optionCount)),
    previous: () => setActiveIndex(clampIndex(active - 1, optionCount)),
    'ask-ai': handleAskAi,
    select: () => activeRow?.onSelect(),
    'next-tab': () => changeFilter(getAdjacentFilter(tabOrder, filter, false)),
    'previous-tab': () =>
      changeFilter(getAdjacentFilter(tabOrder, filter, true)),
    'show-all': () => changeFilter('all'),
    clear: () => changeQuery(''),
    close,
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    const action = getKeyAction(event, {
      query,
      filter,
      isChatsOnly,
      isAiActive,
      tabCount: tabOrder.length,
    });
    if (action) {
      event.preventDefault();
      keyActions[action]();
    }
  };

  return (
    <div
      className="tw:flex tw:h-[min(804px,85vh)] tw:flex-col"
      data-testid="global-search-modal">
      <GlobalSearchInput
        activeOptionId={activeOptionId}
        isLoading={isLoading}
        placeholder={t(labelKeys.placeholder)}
        value={query}
        onChange={changeQuery}
        onClose={close}
        onKeyDown={handleKeyDown}
      />
      <GlobalSearchTabBar
        filter={filter}
        hideCounts={!trimmed}
        isChatsOnly={isChatsOnly}
        isCounting={isFirstLoad}
        isVisible={view.showTabBar}
        labelFor={labelFor}
        more={more}
        results={results}
        shown={shown}
        totalCount={getTotalCount(results)}
        onChange={changeFilter}
        onSearchEverything={searchEverything}
      />
      <GlobalSearchAssetBar
        facets={facets}
        isVisible={view.showAssetBar}
        query={trimmed}
        sort={sort}
        onFacetChange={changeFacet}
        onReverse={reverseSort}
        onSortChange={setSort}
      />
      <GlobalSearchTaskBar
        isVisible={view.showTaskBar}
        status={taskStatus}
        type={taskType}
        onStatusChange={setTaskStatus}
        onTypeChange={setTaskType}
      />
      <GlobalSearchAskAiRow
        isActive={isAiActive}
        isVisible={showAi}
        label={t(labelKeys.askAi)}
        query={trimmed}
        onHover={() => setActiveIndex(0)}
        onSelect={handleAskAi}
      />
      <div className="tw:flex tw:min-h-0 tw:flex-1">
        <div className="tw:min-w-0 tw:flex-1 tw:overflow-y-auto">
          <GlobalSearchResultList
            activeKey={activeRow?.key}
            emptyHintKey={labelKeys.emptyHint}
            hasError={hasError}
            isEmpty={view.isEmpty}
            isFirstLoad={isFirstLoad}
            isScoped={isChatsOnly}
            items={items}
            previewId={previewId}
            query={trimmed}
            scopeLabel={labelFor('chats')}
            onHover={(key) =>
              setActiveIndex(
                rows.findIndex((item) => item.key === key) + aiOffset
              )
            }
            onRetry={() => setRetryKey((key) => key + 1)}
            onSearchEverywhere={searchEverything}
          />
        </div>
        <AssetSummaryPanel
          row={previewRow}
          onClose={() => setPreviewId(undefined)}
          onOpen={openRow}
        />
      </div>
      <GlobalSearchFooter
        action={getFooterAction({
          filter,
          results,
          source: sourceFor(filter),
          t,
          onExplore: openInExplore,
          onNavigate: goTo,
        })}
        askAiLabel={t(labelKeys.askAiHint)}
        enterLabel={activeRow?.enterLabel}
        hasQuery={Boolean(query)}
        isAskAiActive={isAiActive}
        showAskAi={showAi}
        showTabHint={view.showTabHint}
      />
    </div>
  );
};

export default GlobalSearchPanel;
