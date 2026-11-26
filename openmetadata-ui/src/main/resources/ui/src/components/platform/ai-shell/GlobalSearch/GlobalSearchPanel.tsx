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
import { Box, Divider } from '@openmetadata/ui-core-components';
import {
  KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { entitySortingFields } from '../../../../constants/explore.constants';
import { SORT_ORDER } from '../../../../enums/common.enum';
import { TaskStatus, TaskType } from '../../../../generated/entity/tasks/task';
import { usePersistentStorage } from '../../../../hooks/currentUserStore/useCurrentUserStore';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { ExploreQuickFilterField } from '../../../../interface/quickFilter.interface';
import { addToRecentSearched } from '../../../../utils/RecentActivityUtils';
import { getExplorePath } from '../../../../utils/RouterUtils';
import { PERSONAL_SPACE_ROUTES } from '../../../discovery/personal-space/personalSpace.constants';
import ExploreSortDropdown from '../../../Explore/ExploreSortDropdown/ExploreSortDropdown';
import {
  useGlobalSearchQueryAction,
  useGlobalSearchSources,
} from '../appModeExtensions';
import AssetSummaryPanel from './AssetSummaryPanel';
import {
  ASSETS_CATEGORY,
  DEFAULT_ASSET_SORT,
  QUERY_ACTION_LIST_ID,
  QUERY_ACTION_OPTION_ID,
  TASKS_CATEGORY,
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
  getActiveOption,
  getAdjacentFilter,
  getContributedLabelKeys,
  getExploreParams,
  getKeyAction,
  getListboxIds,
  getNavigableRows,
  getPanelView,
  getSearchScope,
  getTabCounts,
  getTotalCount,
  getVisibleTabs,
  GlobalSearchKeyAction,
  hasFacetSelection,
} from './GlobalSearch.utils';
import GlobalSearchFilterBar from './GlobalSearchFilterBar';
import GlobalSearchFooter from './GlobalSearchFooter';
import GlobalSearchInput from './GlobalSearchInput';
import GlobalSearchResultList from './GlobalSearchResultList';
import GlobalSearchTabBar from './GlobalSearchTabBar';
import GlobalSearchTaskBar from './GlobalSearchTaskBar';
import { useGlobalSearchItems } from './useGlobalSearchItems';
import { useGlobalSearchResults } from './useGlobalSearchResults';
import { useGlobalSearchStore } from './useGlobalSearchStore';
import { useSourceRecents } from './useSourceRecents';

const NO_RECENT: never[] = [];

/** Built-in categories; API ones carry their own label, plugins their key. */
const BUILT_IN_LABEL_KEY: Record<string, string> = {
  [ASSETS_CATEGORY]: 'label.data-asset-plural',
  [TASKS_CATEGORY]: 'label.task-plural',
};

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
  if (filter === ASSETS_CATEGORY) {
    return {
      label: t('label.open-count-results-in-explore', {
        count: results[ASSETS_CATEGORY]?.count ?? 0,
      }),
      onPress: onExplore,
    };
  }
  if (filter === TASKS_CATEGORY) {
    return {
      label: t('label.open-task-inbox'),
      onPress: () => onNavigate(PERSONAL_SPACE_ROUTES.INBOX_TASKS),
    };
  }
  const footer = source?.footer;

  return footer
    ? { label: t(footer.labelKey), onPress: () => onNavigate(footer.path) }
    : undefined;
};

const GlobalSearchPanel = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const entry = useGlobalSearchStore((state) => state.entry);
  const close = useGlobalSearchStore((state) => state.close);
  const sources = useGlobalSearchSources();
  const queryAction = useGlobalSearchQueryAction();
  const sourceRecents = useSourceRecents(sources);
  const userName = useApplicationStore((state) => state.currentUser?.name);
  const recentSearches = usePersistentStorage(
    (state) =>
      (userName && state.preferences[userName]?.recentlySearched) || NO_RECENT
  );
  const recentlyViewed = usePersistentStorage(
    (state) =>
      (userName && state.preferences[userName]?.recentlyViewed) || NO_RECENT
  );

  const { scopedCategory, isScoped, scopedSources } = getSearchScope(entry);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<GlobalSearchFilter>(entry);
  const [facets, setFacets] = useState<GlobalSearchFacetSelection>({});
  const [sort, setSort] = useState(DEFAULT_ASSET_SORT);
  const [sortOrder, setSortOrder] = useState<SORT_ORDER>(SORT_ORDER.DESC);
  const [taskStatus, setTaskStatus] = useState<TaskStatus>();
  const [taskType, setTaskType] = useState<TaskType>();
  const [activeIndex, setActiveIndex] = useState(0);
  const [previewId, setPreviewId] = useState<string>();
  const [retryKey, setRetryKey] = useState(0);

  const trimmed = query.trim();
  const sourceKeys = sources.map((source) => source.key).join();
  const sourceFor = useCallback(
    (key: GlobalSearchFilter) => sources.find((source) => source.key === key),
    // Contributions are fixed once plugins register; the keys identify them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sourceKeys]
  );

  const {
    results,
    isLoading,
    isQueryLoading,
    isListLoading,
    isCounting,
    hasError,
  } = useGlobalSearchResults({
    query,
    filter,
    scopedSources,
    facets,
    sort,
    sortOrder,
    taskStatus,
    taskType,
    sources,
    retryKey,
  });

  const labelFor = useCallback(
    (key: GlobalSearchCategory) => {
      const labelKey = sourceFor(key)?.labelKey ?? BUILT_IN_LABEL_KEY[key];

      return labelKey ? t(labelKey) : results[key]?.label ?? key;
    },
    [sourceFor, results, t]
  );

  // A type with no hits leaves the bar, so fall back to All rather than
  // strand the user on a tab they can no longer see. A zero the user's own
  // filters caused keeps the tab, so they can see and undo the selection.
  useEffect(() => {
    const hasOwnFilters =
      hasFacetSelection(facets) || Boolean(taskStatus || taskType);
    const isTypeEmpty = filter !== 'all' && !results[filter]?.count;
    const isStranded = trimmed && !isLoading && !hasOwnFilters && isTypeEmpty;
    if (isStranded && !isScoped) {
      setFilter('all');
    }
  }, [
    trimmed,
    isLoading,
    isScoped,
    filter,
    facets,
    taskStatus,
    taskType,
    results,
  ]);

  const changeFilter = useCallback((next: GlobalSearchFilter) => {
    setFilter(next);
    // Filters and sort belong to one type; a new tab starts unfiltered.
    setFacets({});
    setTaskStatus(undefined);
    setTaskType(undefined);
    setSort(DEFAULT_ASSET_SORT);
    setSortOrder(SORT_ORDER.DESC);
    setActiveIndex(0);
    setPreviewId(undefined);
    // Pressing a tab focuses it after this runs; hand focus back to the input
    // on the next frame so typing and arrow keys keep working.
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const changeQuery = useCallback((value: string) => {
    setQuery(value);
    setActiveIndex(0);
    setPreviewId(undefined);
  }, []);

  /** Clear starts the search over: text, tab, filters, sort and preview. */
  const resetSearch = useCallback(() => {
    setQuery('');
    setFilter(entry);
    setFacets({});
    setSort(DEFAULT_ASSET_SORT);
    setSortOrder(SORT_ORDER.DESC);
    setTaskStatus(undefined);
    setTaskType(undefined);
    setPreviewId(undefined);
    setActiveIndex(0);
    inputRef.current?.focus();
  }, [entry]);

  const changeFacet = useCallback((field: ExploreQuickFilterField) => {
    setFacets((previous) => ({ ...previous, [field.key]: field.value ?? [] }));
    setActiveIndex(0);
  }, []);

  const changeSort = useCallback((field: string, order: SORT_ORDER) => {
    setSort(field);
    setSortOrder(order);
    setActiveIndex(0);
  }, []);

  const sortFields = useMemo(
    () =>
      entitySortingFields.map((field) => ({ ...field, name: t(field.name) })),
    [t]
  );

  const searchEverything = useCallback(() => {
    useGlobalSearchStore.setState({ entry: 'all' });
    changeFilter('all');
  }, [changeFilter]);

  const goTo = useCallback(
    (path: string) => {
      addToRecentSearched(trimmed);
      close();
      navigate(path);
    },
    [trimmed, close, navigate]
  );

  const openRow = useCallback(
    (row: GlobalSearchRow) => {
      // A row with nowhere to go keeps the search open instead of just closing.
      if (row.href) {
        goTo(row.href);
      }
    },
    [goTo]
  );

  const runQueryAction = useCallback(() => {
    if (queryAction && trimmed) {
      close();
      navigate(queryAction.getPath(trimmed));
    }
  }, [queryAction, trimmed, close, navigate]);

  const openInExplore = useCallback(
    () =>
      goTo(
        getExplorePath({
          search: trimmed,
          isPersistFilters: false,
          extraParameters: getExploreParams(facets, sort, sortOrder),
        })
      ),
    [goTo, trimmed, facets, sort, sortOrder]
  );

  const categoryOrder = useMemo(() => Object.keys(results), [results]);
  const { shown, more } = useMemo(
    () => getVisibleTabs(results, filter, categoryOrder),
    [results, filter, categoryOrder]
  );
  const order = useMemo(() => [...shown, ...more], [shown, more]);

  const labelKeys = getContributedLabelKeys({
    scopedSource: scopedCategory ? sourceFor(scopedCategory) : undefined,
    queryAction,
    isScoped,
  });

  const items = useGlobalSearchItems({
    query: trimmed,
    filter,
    scopedCategory,
    results,
    order,
    recentSearches,
    recentlyViewed,
    sourceRecents,
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
    isScoped,
    hasQueryAction: Boolean(queryAction),
    isLoading,
    hasError,
    rowCount: rows.length,
    isPreviewOpen: Boolean(previewRow),
    order,
  });
  const {
    index: active,
    count: optionCount,
    offset: actionOffset,
    isActionActive,
    row: activeRow,
    optionId: activeOptionId,
  } = getActiveOption(
    getNavigableRows(rows, isListLoading, isCounting),
    activeIndex,
    view.showQueryAction
  );

  useEffect(() => {
    if (activeOptionId) {
      document
        .getElementById(activeOptionId)
        ?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [activeOptionId]);

  const keyActions: Record<GlobalSearchKeyAction, () => void> = {
    next: () =>
      setActiveIndex(clampIndex(active + 1, optionCount) - actionOffset),
    previous: () =>
      setActiveIndex(clampIndex(active - 1, optionCount) - actionOffset),
    'run-action': runQueryAction,
    select: () => activeRow?.onSelect(),
    'next-tab': () =>
      changeFilter(getAdjacentFilter(view.tabOrder, filter, false)),
    'previous-tab': () =>
      changeFilter(getAdjacentFilter(view.tabOrder, filter, true)),
    'show-all': () => changeFilter('all'),
    close,
  };

  // Esc closes search wherever focus is in the dialog (a filter trigger, the
  // sort menu button, or nowhere after a recent search is removed), not only in
  // the input. An open popover handles its own Esc first and marks it handled.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== 'Escape' ||
        event.defaultPrevented ||
        event.target === inputRef.current
      ) {
        return;
      }
      event.preventDefault();
      close();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [close]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    // Enter and Esc confirm or cancel an IME composition (Japanese, Chinese,
    // Korean); they must not act on the list. 229 is the composing keyCode
    // some browsers report instead of isComposing.
    if (event.nativeEvent.isComposing || event.keyCode === 229) {
      return;
    }
    const action = getKeyAction(event, {
      query,
      filter,
      isScoped,
      isActionActive: isActionActive,
      tabCount: view.tabOrder.length,
    });
    if (action) {
      event.preventDefault();
      keyActions[action]();
    }
  };

  const QueryAction = queryAction?.component;

  const tabCounts = getTabCounts({
    query: trimmed,
    scopedCategory,
    recents: sourceRecents,
    results,
    isCounting,
  });

  return (
    <Box
      className="tw:h-[min(804px,85vh)]"
      data-testid="global-search-modal"
      direction="col">
      <GlobalSearchInput
        activeOptionId={activeOptionId}
        inputRef={inputRef}
        isLoading={isQueryLoading}
        listboxIds={getListboxIds(items, view.showQueryAction)}
        placeholder={t(labelKeys.placeholder)}
        value={query}
        onChange={changeQuery}
        onClear={resetSearch}
        onClose={close}
        onKeyDown={handleKeyDown}
      />
      <GlobalSearchTabBar
        filter={filter}
        hideCounts={tabCounts.hideCounts}
        isLoading={isCounting}
        isVisible={view.showTabBar}
        labelFor={labelFor}
        more={more}
        results={tabCounts.results}
        scopedCategory={scopedCategory}
        shown={shown}
        totalCount={getTotalCount(results)}
        onChange={changeFilter}
        onSearchEverything={searchEverything}
      />
      <GlobalSearchFilterBar
        category={view.filterBarCategory}
        facets={facets}
        query={trimmed}
        onFacetChange={changeFacet}
      />
      <GlobalSearchTaskBar
        isVisible={view.showTaskBar}
        status={taskStatus}
        type={taskType}
        onStatusChange={setTaskStatus}
        onTypeChange={setTaskType}
      />
      {view.showTabBar ? <Divider /> : null}
      {QueryAction && view.showQueryAction ? (
        <Box
          aria-label={t(labelKeys.actionHint)}
          direction="col"
          id={QUERY_ACTION_LIST_ID}
          role="listbox">
          <QueryAction
            filter={filter}
            id={QUERY_ACTION_OPTION_ID}
            isActive={isActionActive}
            query={trimmed}
            onHover={() => setActiveIndex(-1)}
            onSelect={runQueryAction}
          />
        </Box>
      ) : null}
      <Box className="tw:min-h-0 tw:flex-1">
        <Box className="tw:relative tw:min-w-0 tw:flex-1" direction="col">
          <Box
            className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:pb-19"
            direction="col">
            <GlobalSearchResultList
              activeKey={activeRow?.key}
              emptyHintKey={labelKeys.emptyHint}
              hasError={hasError}
              isEmpty={view.isEmpty}
              isFirstLoad={isListLoading || isCounting}
              isScoped={isScoped}
              items={items}
              previewId={previewId}
              query={trimmed}
              scopeLabel={scopedCategory ? labelFor(scopedCategory) : ''}
              sortControl={
                <ExploreSortDropdown
                  fieldList={sortFields}
                  sortField={sort}
                  sortOrder={sortOrder}
                  onChange={changeSort}
                />
              }
              onHover={(key) =>
                setActiveIndex(rows.findIndex((item) => item.key === key))
              }
              onRetry={() => setRetryKey((key) => key + 1)}
              onSearchEverywhere={searchEverything}
            />
          </Box>
          <GlobalSearchFooter
            action={getFooterAction({
              filter,
              results,
              source: sourceFor(filter),
              t,
              onExplore: openInExplore,
              onNavigate: goTo,
            })}
            actionHint={t(labelKeys.actionHint)}
            enterLabel={activeRow?.enterLabel}
            showActionHint={view.showQueryAction}
            showTabHint={view.showTabHint}
          />
        </Box>
        <AssetSummaryPanel
          row={previewRow}
          onClose={() => {
            setPreviewId(undefined);
            // The close button took focus; the arrows and Enter live on the input.
            inputRef.current?.focus();
          }}
          onOpen={openRow}
        />
      </Box>
    </Box>
  );
};

export default GlobalSearchPanel;
