/*
 *  Copyright 2023 Collate.
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
  Alert,
  Badge,
  Box,
  Button,
  Card as CoreCard,
  Dialog,
  Divider,
  Dropdown,
  Modal,
  ModalOverlay,
  PaginationCardWithControls,
  RadioButton,
  RadioGroup,
  Skeleton,
  Tabs,
  Toggle,
  Typography as CoreTypography,
} from '@openmetadata/ui-core-components';
import {
  ChevronDown,
  Download01,
  FilterFunnel01,
  InfoCircle,
  Trash01,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEmpty, isString, isUndefined, lowerCase, noop, omit } from 'lodash';
import Qs from 'qs';
import { lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdvanceSearch } from '../../components/Explore/AdvanceSearchProvider/AdvanceSearchProvider.component';
import AppliedFilterText from '../../components/Explore/AppliedFilterText/AppliedFilterText';
import ExploreQueryFilterChips from '../../components/Explore/ExploreQueryFilterChips/ExploreQueryFilterChips.component';
import ExploreQuickFilters from '../../components/Explore/ExploreQuickFilters';
import SortingDropDown from '../../components/Explore/SortingDropDown';
import {
  PAGE_SIZE_BASE,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
} from '../../constants/constants';
import {
  entitySortingFields,
  SUPPORTED_EMPTY_FILTER_FIELDS,
  TAG_FQN_KEY,
} from '../../constants/explore.constants';
import { EntityFields } from '../../enums/AdvancedSearch.enum';
import { SIZE, SORT_ORDER } from '../../enums/common.enum';
import { EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import { useQuickFilterLabels } from '../../hooks/useQuickFilterLabels';
import { ExploreSearchIndex } from '../../interface/discovery/explore.interface';
import type { QueryFilterInterface } from '../../interface/queryFilter.interface';
import { exportSearchResultsAsync, searchQuery } from '../../rest/searchAPI';
import { getDropDownItems } from '../../utils/AdvancedSearchUtils';
import { parseExportErrorMessage } from '../../utils/APIUtils';
import { highlightEntityNameAndDescription } from '../../utils/EntitySearchUtils';
import { getCombinedQueryFilterObject } from '../../utils/ExplorePage/ExplorePageUtils';
import {
  getExploreQueryFilterMust,
  getSelectedValuesFromQuickFilter,
  truncateBrowsePath,
} from '../../utils/ExplorePureUtils';
import searchClassBase from '../../utils/SearchClassBase';
import { showSuccessToast } from '../../utils/ToastUtils';
import withSuspenseFallback from '../AppRouter/withSuspenseFallback';
import {
  CSV_JOBS_REFRESH_EVENT,
  markCsvJobOwned,
} from '../common/EntityImport/CsvJobsTray/CsvJobsTray.constants';
import FilterErrorPlaceHolder from '../common/ErrorWithPlaceholder/FilterErrorPlaceHolder';
import Loader from '../common/Loader/Loader';
import ResizableLeftPanels from '../common/ResizablePanels/ResizableLeftPanels';
import {
  ExploreProps,
  ExploreQuickFilterField,
} from '../Explore/ExplorePage.interface';
import ExploreTree from '../Explore/ExploreTree/ExploreTree';
import SearchedData from '../SearchedData/SearchedData';
import { SearchedDataProps } from '../SearchedData/SearchedData.interface';
import { ReactComponent as IconAscending } from './../../assets/svg/ic-ascending.svg';
import { ReactComponent as IconDescending } from './../../assets/svg/ic-descending.svg';
import './exploreV1.less';
import { IndexNotFoundBanner } from './IndexNotFoundBanner';
const EntitySummaryPanel = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../../components/Explore/EntitySummaryPanel/EntitySummaryPanel.component'
      )
  )
);

const EXPORT_ALL_ASSETS_LIMIT = 200000;
const EXPLORE_PAGE_SIZE_OPTIONS = [
  PAGE_SIZE_BASE,
  PAGE_SIZE_MEDIUM,
  PAGE_SIZE_LARGE,
];

interface ExploreExportScopeModalProps {
  open: boolean;
  exportScope: 'visible' | 'all';
  onExportScopeChange: (scope: 'visible' | 'all') => void;
  isSearchMode: boolean;
  isCountLoading: boolean;
  tabAssetsCount?: number;
  pageResultCount: number;
  allAssetsCount?: number;
  activeTabLabel: string;
  isExporting: boolean;
  isAllAssetsLimitExceeded: boolean;
  isTabScopeDisabled: boolean;
  exportError?: string;
  title: React.ReactNode;
  onCancel: () => void;
  onOk: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

const ExportScopeVisibleCount = ({
  isSearchMode,
  isCountLoading,
  tabAssetsCount,
  pageResultCount,
  t,
}: {
  isSearchMode: boolean;
  isCountLoading: boolean;
  tabAssetsCount?: number;
  pageResultCount: number;
  t: (key: string) => string;
}) =>
  isSearchMode && isCountLoading ? (
    <Skeleton height={16} variant="rounded" width={60} />
  ) : (
    <CoreTypography
      className="tw:text-tertiary"
      data-testid="export-scope-visible-count"
      size="text-sm"
      weight="regular">
      ({isSearchMode ? tabAssetsCount ?? '—' : pageResultCount}{' '}
      {t('label.result-plural')})
    </CoreTypography>
  );

const ExportScopeAllCount = ({
  isCountLoading,
  allAssetsCount,
  t,
}: {
  isCountLoading: boolean;
  allAssetsCount?: number;
  t: (key: string) => string;
}) =>
  isCountLoading ? (
    <Skeleton height={16} variant="rounded" width={60} />
  ) : (
    allAssetsCount !== undefined && (
      <CoreTypography
        className="tw:text-tertiary"
        data-testid="export-scope-all-count"
        size="text-sm"
        weight="regular">
        ({allAssetsCount} {t('label.result-plural')})
      </CoreTypography>
    )
  );

/** The "Export" modal: lets the user choose visible-page vs. all-matching-assets scope. */
const ExploreExportScopeModal = ({
  open,
  exportScope,
  onExportScopeChange,
  isSearchMode,
  isCountLoading,
  tabAssetsCount,
  pageResultCount,
  allAssetsCount,
  activeTabLabel,
  isExporting,
  isAllAssetsLimitExceeded,
  isTabScopeDisabled,
  exportError,
  title,
  onCancel,
  onOk,
  t,
}: ExploreExportScopeModalProps) => {
  return (
    <ModalOverlay
      isDismissable
      isOpen={open}
      onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <Modal>
        {/* Overrides reproduce the antd Modal (modal.less) this replaced. */}
        <Dialog
          showCloseButton
          data-testid="export-scope-modal"
          panelClassName="search-export-modal tw:rounded-lg tw:shadow-[2px_4px_12px_var(--om-legacy-color-0-0-0-0-2)] tw:dark:shadow-overlay"
          width={680}
          onClose={onCancel}>
          <Dialog.Header
            className={classNames(
              'tw:border-b tw:border-[var(--om-legacy-color-dde3ea)] tw:px-6 tw:py-4',
              'tw:sm:px-6 tw:sm:pt-4 tw:*:font-medium! tw:*:leading-[22px]!',
              'tw:*:text-black/85! tw:dark:border-subtle tw:dark:*:text-primary!'
            )}>
            <div className="tw:text-md" data-testid="export-scope-modal-title">
              {title}
            </div>
          </Dialog.Header>
          <Dialog.Content className="tw:gap-0 tw:px-6 tw:py-6 tw:sm:px-6">
            {isAllAssetsLimitExceeded && (
              <Alert
                className="m-b-sm"
                title={t('message.export-assets-limit-exceeded', {
                  limit: EXPORT_ALL_ASSETS_LIMIT,
                })}
                variant="error"
              />
            )}
            {exportError && (
              <Alert className="m-b-sm" title={exportError} variant="error" />
            )}
            <CoreTypography
              className="tw:text-secondary"
              size="text-sm"
              weight="medium">
              {t('label.export-scope')}
            </CoreTypography>
            <RadioGroup
              aria-label={t('label.export-scope')}
              className="tw:mt-3 tw:w-full tw:flex-row tw:gap-3"
              value={exportScope}
              onChange={(value) =>
                onExportScopeChange(value as 'visible' | 'all')
              }>
              <CoreCard
                isClickable
                className="export-scope-option-card tw:flex-1 tw:p-4"
                data-testid="export-scope-visible-card"
                isSelected={exportScope === 'visible'}
                onClick={() => onExportScopeChange('visible')}>
                <div className="d-flex items-start gap-1">
                  {/* Reproduces antd's 16x22 radio wrapper and its 8px gap. */}
                  <span className="tw:mr-2 tw:flex tw:h-[22px] tw:shrink-0 tw:items-center">
                    <RadioButton
                      aria-label={t('label.visible-result-plural')}
                      value="visible"
                    />
                  </span>
                  <div>
                    <div className="d-flex items-center gap-2">
                      <CoreTypography
                        className="tw:text-primary d-flex items-center tw:gap-0.5"
                        size="text-sm"
                        weight="semibold">
                        {isSearchMode
                          ? activeTabLabel
                          : t('label.visible-result-plural')}
                        <ExportScopeVisibleCount
                          isCountLoading={isCountLoading}
                          isSearchMode={isSearchMode}
                          pageResultCount={pageResultCount}
                          t={t}
                          tabAssetsCount={tabAssetsCount}
                        />
                      </CoreTypography>
                    </div>
                    <CoreTypography
                      className="tw:text-tertiary"
                      size="text-sm"
                      weight="regular">
                      {t('message.export-visible-results-description', {
                        dataAssetType: activeTabLabel,
                      })}
                    </CoreTypography>
                  </div>
                </div>
              </CoreCard>
              <CoreCard
                isClickable
                className="export-scope-option-card tw:flex-1 tw:p-4"
                data-testid="export-scope-all-card"
                isSelected={exportScope === 'all'}
                onClick={() => onExportScopeChange('all')}>
                <div className="d-flex items-start tw:gap-1">
                  {/* Reproduces antd's 16x22 radio wrapper and its 8px gap. */}
                  <span className="tw:mr-2 tw:flex tw:h-[22px] tw:shrink-0 tw:items-center">
                    <RadioButton
                      aria-label={t('label.all-asset-plural')}
                      value="all"
                    />
                  </span>
                  <div>
                    <CoreTypography
                      className="tw:text-primary d-flex items-center tw:gap-1"
                      size="text-sm"
                      weight="semibold">
                      {`${t('label.all-asset-plural')} `}
                      <ExportScopeAllCount
                        allAssetsCount={allAssetsCount}
                        isCountLoading={isCountLoading}
                        t={t}
                      />
                    </CoreTypography>
                    <CoreTypography
                      className="tw:text-tertiary"
                      size="text-sm"
                      weight="regular">
                      {t('message.export-all-matching-assets-description')}
                    </CoreTypography>
                  </div>
                </div>
              </CoreCard>
            </RadioGroup>
          </Dialog.Content>
          <Dialog.Footer className="tw:mt-0 tw:border-[var(--om-legacy-color-dde3ea)] tw:sm:mt-0 tw:dark:border-subtle tw:*:gap-[13px]! tw:*:px-[23px]! tw:*:py-4!">
            <Button
              className="tw:h-10 tw:rounded-lg tw:px-[15px] tw:py-0 tw:font-normal tw:text-[var(--ant-primary-color)] tw:hover:bg-transparent tw:hover:text-[var(--ant-primary-color-hover)]"
              color="tertiary"
              data-testid="export-scope-cancel-button"
              onPress={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              className="tw:h-10 tw:rounded-lg tw:px-[15px] tw:py-0 tw:font-normal"
              color="primary"
              data-testid="export-scope-ok-button"
              isDisabled={
                isExporting ||
                isCountLoading ||
                isAllAssetsLimitExceeded ||
                isTabScopeDisabled
              }
              isLoading={isExporting}
              onPress={onOk}>
              {t('label.export')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

interface ExploreFilterStatusRowProps {
  shouldShowQueryFilterChips: boolean;
  browseFields: ExploreQuickFilterField[];
  searchQueryParam: string;
  quickFilterFields: ExploreQuickFilterField[];
  clearFilters: () => void;
  handleRemoveBrowseLevel: (levelKey: string) => void;
  handleRemoveQuickFilterValue: (
    field: ExploreQuickFilterField,
    optionKey: string
  ) => void;
  isElasticSearchIssue?: boolean;
  sqlQuery?: string;
  onResetQueryFilter: () => void;
  onEditQueryFilter: () => void;
  t: (key: string) => string;
}

/** The row of applied-filter chips, the "index not found" banner, and the SQL filter text. */
const ExploreFilterStatusRow = ({
  shouldShowQueryFilterChips,
  browseFields,
  searchQueryParam,
  quickFilterFields,
  clearFilters,
  handleRemoveBrowseLevel,
  handleRemoveQuickFilterValue,
  isElasticSearchIssue,
  sqlQuery,
  onResetQueryFilter,
  onEditQueryFilter,
  t,
}: ExploreFilterStatusRowProps) => {
  return (
    <>
      {shouldShowQueryFilterChips && (
        <div className="tw:relative tw:max-w-full tw:min-h-px tw:flex-[0_0_100%]">
          <ExploreQueryFilterChips
            browseFields={browseFields}
            emptyText={
              searchQueryParam
                ? undefined
                : t('message.browse-estate-query-placeholder')
            }
            fields={quickFilterFields}
            onClearAll={clearFilters}
            onRemoveBrowseLevel={handleRemoveBrowseLevel}
            onRemoveValue={handleRemoveQuickFilterValue}
          />
        </div>
      )}
      {isElasticSearchIssue ? (
        <div className="tw:relative tw:max-w-full tw:min-h-px tw:flex-[0_0_100%]">
          <IndexNotFoundBanner />
        </div>
      ) : (
        <></>
      )}
      {sqlQuery && (
        <div className="tw:relative tw:max-w-full tw:min-h-px tw:flex-[0_0_100%]">
          <AppliedFilterText
            filterText={sqlQuery}
            onClear={onResetQueryFilter}
            onEdit={onEditQueryFilter}
          />
        </div>
      )}
    </>
  );
};

interface ExploreResultsPanelProps {
  loading?: boolean;
  isElasticSearchIssue?: boolean;
  searchResults: ExploreProps['searchResults'];
  parsedSearch: Qs.ParsedQs;
  handleSummaryPanelDisplay: (
    details: SearchedDataProps['data'][number]['_source']
  ) => void;
  hasActiveFilters: boolean;
  showSummaryPanel: boolean;
  entityDetails?: SearchedDataProps['data'][number]['_source'];
  showRankingDetails?: boolean;
  totalValue: number;
  totalPages: number;
  validCurrentPage: number;
  pageSize: number;
  handleExplorePageChange: (updatedPage: number) => void;
  handleExplorePageSizeChange: (updatedPageSize: number) => void;
  handleClosePanel: () => void;
  firstEntity?: SearchedDataProps['data'][number];
  selectedQuickFilters: ExploreQuickFilterField[];
}

/** Search results list + pagination on the left, entity summary panel on the right. */
interface ExploreResultsListPanelProps {
  loading?: boolean;
  isElasticSearchIssue?: boolean;
  searchResults: ExploreProps['searchResults'];
  parsedSearch: Qs.ParsedQs;
  handleSummaryPanelDisplay: (
    details: SearchedDataProps['data'][number]['_source']
  ) => void;
  hasActiveFilters: boolean;
  showSummaryPanel: boolean;
  entityDetails?: SearchedDataProps['data'][number]['_source'];
  showRankingDetails?: boolean;
  totalValue: number;
  totalPages: number;
  validCurrentPage: number;
  pageSize: number;
  handleExplorePageChange: (updatedPage: number) => void;
  handleExplorePageSizeChange: (updatedPageSize: number) => void;
}

/** Search results list (or loader) plus the pagination controls beneath it. */
const ExploreResultsListPanel = ({
  loading,
  isElasticSearchIssue,
  searchResults,
  parsedSearch,
  handleSummaryPanelDisplay,
  hasActiveFilters,
  showSummaryPanel,
  entityDetails,
  showRankingDetails,
  totalValue,
  totalPages,
  validCurrentPage,
  pageSize,
  handleExplorePageChange,
  handleExplorePageSizeChange,
}: ExploreResultsListPanelProps) => {
  return (
    <div className="h-full tw:flex tw:min-w-[300px] tw:flex-1 tw:flex-col tw:overflow-hidden tw:rounded-xl explore-main-card">
      <CoreCard className="tw:min-h-0 tw:flex-1 tw:rounded-b-none tw:border-b-0 tw:border-utility-gray-blue-100 tw:dark:border-subtle">
        <div className="tw:h-full tw:overflow-y-auto tw:p-5">
          {!loading && !isElasticSearchIssue ? (
            <SearchedData
              data={searchResults?.hits.hits ?? []}
              filter={parsedSearch}
              handleSummaryPanelDisplay={handleSummaryPanelDisplay}
              isFilterSelected={hasActiveFilters}
              isSummaryPanelVisible={showSummaryPanel}
              selectedEntityId={entityDetails?.id || ''}
              showRankingDetails={showRankingDetails}
              showResultCount={hasActiveFilters}
              totalValue={totalValue}
            />
          ) : (
            <></>
          )}
          {loading ? <Loader /> : <></>}
        </div>
      </CoreCard>
      {!loading && !isElasticSearchIssue && totalValue > 0 ? (
        <PaginationCardWithControls
          page={validCurrentPage}
          pageSize={pageSize}
          pageSizeOptions={EXPLORE_PAGE_SIZE_OPTIONS}
          total={totalPages}
          onPageChange={handleExplorePageChange}
          onPageSizeChange={handleExplorePageSizeChange}
        />
      ) : (
        <></>
      )}
    </div>
  );
};

const ExploreResultsPanel = ({
  loading,
  isElasticSearchIssue,
  searchResults,
  parsedSearch,
  handleSummaryPanelDisplay,
  hasActiveFilters,
  showSummaryPanel,
  entityDetails,
  showRankingDetails,
  totalValue,
  totalPages,
  validCurrentPage,
  pageSize,
  handleExplorePageChange,
  handleExplorePageSizeChange,
  handleClosePanel,
  firstEntity,
  selectedQuickFilters,
}: ExploreResultsPanelProps) => {
  return (
    <Box
      className="explore-results-row tw:h-full tw:min-w-0 tw:w-full"
      colGap={3}>
      <ExploreResultsListPanel
        entityDetails={entityDetails}
        handleExplorePageChange={handleExplorePageChange}
        handleExplorePageSizeChange={handleExplorePageSizeChange}
        handleSummaryPanelDisplay={handleSummaryPanelDisplay}
        hasActiveFilters={hasActiveFilters}
        isElasticSearchIssue={isElasticSearchIssue}
        loading={loading}
        pageSize={pageSize}
        parsedSearch={parsedSearch}
        searchResults={searchResults}
        showRankingDetails={showRankingDetails}
        showSummaryPanel={showSummaryPanel}
        totalPages={totalPages}
        totalValue={totalValue}
        validCurrentPage={validCurrentPage}
      />

      {showSummaryPanel && entityDetails && !loading && (
        <div className="explore-page-right-panel">
          <EntitySummaryPanel
            entityDetails={{ details: entityDetails }}
            handleClosePanel={handleClosePanel}
            highlights={omit(
              {
                ...firstEntity?.highlight, // highlights of firstEntity that we get from the query api
                'tag.name': (
                  selectedQuickFilters?.find(
                    (filterOption) => filterOption.key === TAG_FQN_KEY
                  )?.value ?? []
                ).map((tagFQN) => tagFQN.key), // finding the tags filter from SelectedQuickFilters and creating the array of selected Tags FQN
              },
              ['description', 'displayName']
            )}
            key={
              entityDetails.entityType + '-' + entityDetails.fullyQualifiedName
            }
            panelPath="explore"
          />
        </div>
      )}
    </Box>
  );
};

const ExploreV1: React.FC<ExploreProps> = ({
  aggregations,
  activeTabKey,
  tabItems = [],
  searchResults,
  showRankingDetails = false,
  onChangeShowRankingDetails,
  onChangeAdvancedSearchQuickFilters,
  searchIndex,
  sortOrder,
  currentPage = 1,
  onChangeSortOder,
  sortValue,
  onChangeSortValue,
  onChangeShowDeleted,
  onChangeSearchIndex,
  showDeleted,
  onChangePage = noop,
  onChangePageSize = noop,
  loading,
  pageSize = PAGE_SIZE_BASE,
  quickFilters,
  isElasticSearchIssue,
  browseFields = [],
  browseQueryFilter,
  onTreeSelect = noop,
}) => {
  const { t, i18n } = useTranslation();
  // getTabsInfo() bakes translated labels into its result, so recompute on a
  // language switch rather than freezing the first language for the mount.
  const tabsInfo = useMemo(
    () => searchClassBase.getTabsInfo(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- result bakes in t() output
    [i18n.language]
  );
  // The router location, not the global: the global's `search` is not a valid
  // hook dependency (mutating it never re-renders), so the memo below went
  // stale across in-app navigation.
  const location = useCustomLocation();
  const [selectedQuickFilters, setSelectedQuickFilters] = useState<
    ExploreQuickFilterField[]
  >([] as ExploreQuickFilterField[]);
  const [showSummaryPanel, setShowSummaryPanel] = useState(false);
  const [entityDetails, setEntityDetails] =
    useState<SearchedDataProps['data'][number]['_source']>();
  const firstEntity = searchResults?.hits
    ?.hits[0] as SearchedDataProps['data'][number];

  const parsedSearch = useMemo(
    () =>
      Qs.parse(
        location.search.startsWith('?')
          ? location.search.substring(1)
          : location.search
      ),
    [location.search]
  );

  const searchQueryParam = useMemo(
    () => (isString(parsedSearch.search) ? parsedSearch.search : ''),
    [parsedSearch.search]
  );
  const totalValue = searchResults?.hits.total.value ?? 0;

  const hitSources = useMemo(
    () => (searchResults?.hits?.hits ?? []).map((hit) => hit._source),
    [searchResults]
  );
  const totalPages = useMemo(
    () => Math.max(Math.ceil(totalValue / pageSize), 1),
    [pageSize, totalValue]
  );
  const validCurrentPage = useMemo(
    () => Math.min(Math.max(currentPage, 1), totalPages),
    [currentPage, totalPages]
  );

  const {
    toggleModal,
    sqlQuery,
    queryFilter,
    onResetQueryFilter,
    onResetAllFilters,
  } = useAdvanceSearch();

  const [showExportScopeModal, setShowExportScopeModal] = useState(false);
  const [exportScope, setExportScope] = useState<'visible' | 'all'>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [allAssetsCount, setAllAssetsCount] = useState<number>();
  const [tabAssetsCount, setTabAssetsCount] = useState<number>();
  const [exportError, setExportError] = useState<string | undefined>();
  const [isCountLoading, setIsCountLoading] = useState(false);

  const isSearchMode = useMemo(
    () => Boolean(searchQueryParam),
    [searchQueryParam]
  );
  const hasActiveFilters = useMemo(
    () => Boolean(queryFilter || quickFilters || sqlQuery || searchQueryParam),
    [queryFilter, quickFilters, sqlQuery, searchQueryParam]
  );
  const pageResultCount = useMemo(
    () => searchResults?.hits?.hits?.length ?? 0,
    [searchResults]
  );
  const visibleResultCount = useMemo(
    () => (isSearchMode ? tabAssetsCount ?? 0 : pageResultCount),
    [isSearchMode, tabAssetsCount, pageResultCount]
  );
  const isAllAssetsLimitExceeded = useMemo(
    () =>
      exportScope === 'all' &&
      allAssetsCount !== undefined &&
      allAssetsCount > EXPORT_ALL_ASSETS_LIMIT,
    [exportScope, allAssetsCount]
  );
  const isTabScopeDisabled = useMemo(
    () =>
      isSearchMode &&
      exportScope === 'visible' &&
      !isCountLoading &&
      !tabAssetsCount,
    [isSearchMode, exportScope, isCountLoading, tabAssetsCount]
  );
  const activeTabLabel = useMemo(
    () =>
      tabsInfo[searchIndex as ExploreSearchIndex]?.label ??
      t('label.visible-result-plural'),
    [tabsInfo, searchIndex, t]
  );

  const handleExportScopeChange = useCallback((scope: 'visible' | 'all') => {
    setExportScope(scope);
    setExportError(undefined);
  }, []);

  const handleOpenExportScopeModal = useCallback(async () => {
    setExportScope('all');
    setAllAssetsCount(undefined);
    setTabAssetsCount(undefined);
    setExportError(undefined);
    setShowExportScopeModal(true);
    setIsCountLoading(true);

    try {
      const combinedQueryFilter = getCombinedQueryFilterObject(
        quickFilters,
        queryFilter as QueryFilterInterface | undefined,
        browseQueryFilter
      );
      const allResponse = await searchQuery({
        query: searchQueryParam || '*',
        searchIndex: SearchIndex.DATA_ASSET,
        pageSize: 0,
        trackTotalHits: true,
        includeDeleted: showDeleted,
        queryFilter: combinedQueryFilter ?? undefined,
      });
      setAllAssetsCount(allResponse.hits.total.value);

      if (isSearchMode) {
        const entityTypeSearchIndexMapping =
          searchClassBase.getEntityTypeSearchIndexMapping();
        const tabBucket = (
          allResponse.aggregations?.['entityType']?.buckets ?? []
        ).find(
          (b: { key: string; doc_count: number }) =>
            entityTypeSearchIndexMapping[b.key as EntityType] === searchIndex
        );
        setTabAssetsCount(tabBucket?.doc_count ?? 0);
      }
    } catch {
      // Count fetch failed — modal still usable without count
    } finally {
      setIsCountLoading(false);
    }
  }, [
    searchQueryParam,
    showDeleted,
    quickFilters,
    queryFilter,
    browseQueryFilter,
    searchIndex,
    isSearchMode,
  ]);

  const handleExportScopeConfirm = useCallback(async () => {
    if (isAllAssetsLimitExceeded) {
      return;
    }

    const isVisibleScope = exportScope === 'visible';
    const combinedQueryFilter = getCombinedQueryFilterObject(
      quickFilters,
      queryFilter as QueryFilterInterface | undefined,
      browseQueryFilter
    );

    let exportSize = allAssetsCount ?? EXPORT_ALL_ASSETS_LIMIT;

    if (isVisibleScope) {
      exportSize = isSearchMode ? visibleResultCount : pageResultCount;
    }

    const exportFrom = (() => {
      if (!isVisibleScope || isSearchMode) {
        return undefined;
      }

      return (validCurrentPage - 1) * pageSize;
    })();

    const params: Parameters<typeof exportSearchResultsAsync>[0] = {
      q: searchQueryParam || '*',
      index: isVisibleScope ? searchIndex : SearchIndex.DATA_ASSET,
      sort_field: sortValue,
      sort_order: sortOrder,
      size: exportSize,
      ...(exportFrom !== undefined && { from: exportFrom }),
    };

    if (showDeleted !== undefined) {
      params.deleted = showDeleted;
    }

    if (combinedQueryFilter) {
      params.query_filter = JSON.stringify(combinedQueryFilter);
    }

    setExportError(undefined);
    setIsExporting(true);

    try {
      // The export runs as a background job; the Background jobs tray surfaces
      // progress and the Download action once it completes.
      const exportJob = await exportSearchResultsAsync(params);
      // Claim the just-started job so the tray always surfaces it, even if it
      // finishes before the tray's first fetch.
      markCsvJobOwned(exportJob?.jobId);
      window.dispatchEvent(new Event(CSV_JOBS_REFRESH_EVENT));
      showSuccessToast(t('message.search-export-job-started'));
      setShowExportScopeModal(false);
    } catch (error) {
      const message = await parseExportErrorMessage(
        error as AxiosError<Blob | { message?: string }>,
        t('server.unexpected-error')
      );
      setExportError(message);
    } finally {
      setIsExporting(false);
    }
  }, [
    exportScope,
    t,
    searchIndex,
    allAssetsCount,
    visibleResultCount,
    isSearchMode,
    pageResultCount,
    validCurrentPage,
    pageSize,
    searchQueryParam,
    sortValue,
    sortOrder,
    showDeleted,
    quickFilters,
    queryFilter,
    browseQueryFilter,
    isAllAssetsLimitExceeded,
  ]);

  const translatedSortingFields = useMemo(() => {
    const sortingFields =
      tabsInfo[searchIndex as ExploreSearchIndex]?.sortingFields ??
      entitySortingFields;

    return sortingFields.map((field) => ({
      ...field,
      name: t(field.name),
    }));
  }, [searchIndex, t, tabsInfo]);

  const handleClosePanel = () => {
    setShowSummaryPanel(false);
  };

  const isAscSortOrder = useMemo(
    () => sortOrder === SORT_ORDER.ASC,
    [sortOrder]
  );
  const sortProps = useMemo(
    () => ({
      className: 'text-base tw:text-fg-secondary',
      'data-testid': 'last-updated',
    }),
    []
  );

  const handleSummaryPanelDisplay = useCallback(
    (details: SearchedDataProps['data'][number]['_source']) => {
      setShowSummaryPanel(true);
      setEntityDetails(details);
    },
    []
  );

  const handleExplorePageChange = useCallback(
    (updatedPage: number) => {
      onChangePage(updatedPage);
    },
    [onChangePage]
  );

  const handleExplorePageSizeChange = useCallback(
    (updatedPageSize: number) => {
      onChangePageSize(updatedPageSize);
    },
    [onChangePageSize]
  );

  useEffect(() => {
    if (
      loading ||
      isElasticSearchIssue ||
      !searchResults ||
      currentPage === validCurrentPage
    ) {
      return;
    }

    onChangePage(validCurrentPage);
  }, [
    currentPage,
    isElasticSearchIssue,
    loading,
    onChangePage,
    searchResults,
    validCurrentPage,
  ]);

  const clearFilters = () => {
    onResetAllFilters();
  };

  const handleQuickFiltersChange = useCallback(
    (data: ExploreQuickFilterField[]) => {
      const must = getExploreQueryFilterMust(data);

      onChangeAdvancedSearchQuickFilters(
        isEmpty(must)
          ? undefined
          : {
              query: {
                bool: {
                  must,
                },
              },
            }
      );
    },
    [onChangeAdvancedSearchQuickFilters]
  );

  const handleQuickFiltersValueSelect = (field: ExploreQuickFilterField) => {
    setSelectedQuickFilters((pre) => {
      const data = pre.map((preField) => {
        if (preField.key === field.key) {
          return field;
        } else {
          return preField;
        }
      });

      handleQuickFiltersChange(data);

      return data;
    });
  };

  const handleRemoveQuickFilterValue = (
    field: ExploreQuickFilterField,
    optionKey: string
  ) => {
    const updatedValue = (field.value ?? []).filter(
      (option) => option.key !== optionKey
    );
    handleQuickFiltersValueSelect({ ...field, value: updatedValue });
  };

  // Tree selection: hierarchical levels update the browse location; a leaf
  // additionally sets the Type quick filter. The type is upserted into the
  // Data Assets slot (entityType.keyword) so existing dropdown filters
  // survive, and both URL params change in one navigation upstream.
  const handleExploreTreeSelect = useCallback(
    (payload: {
      browseFields: ExploreQuickFilterField[];
      typeField?: ExploreQuickFilterField;
    }) => {
      const { browseFields: updatedBrowseFields, typeField } = payload;
      if (isUndefined(typeField)) {
        onTreeSelect({ browseFields: updatedBrowseFields });
      } else {
        // The Data Assets dropdown options come from the entityType.keyword
        // aggregation, which returns lowercase values ("tablecolumn"); tree
        // leaf buckets are camelCase ("tableColumn"). Store lowercase so the
        // dropdown recognizes the selection.
        const typeValue = (typeField.value ?? []).map((option) => ({
          ...option,
          key: option.key.toLowerCase(),
        }));
        const hasTypeSlot = selectedQuickFilters.some(
          (field) => field.key === EntityFields.ENTITY_TYPE_KEYWORD
        );
        const merged = hasTypeSlot
          ? selectedQuickFilters.map((field) =>
              field.key === EntityFields.ENTITY_TYPE_KEYWORD
                ? { ...field, value: typeValue }
                : field
            )
          : [
              ...selectedQuickFilters,
              {
                key: EntityFields.ENTITY_TYPE_KEYWORD,
                label: 'label.data-asset-plural',
                value: typeValue,
              },
            ];

        setSelectedQuickFilters(merged);

        const must = getExploreQueryFilterMust(merged);
        onTreeSelect({
          browseFields: updatedBrowseFields,
          quickFilter: isEmpty(must)
            ? undefined
            : { query: { bool: { must } } },
        });
      }
    },
    [onTreeSelect, selectedQuickFilters]
  );

  const handleRemoveBrowseLevel = useCallback(
    (levelKey: string) => {
      onTreeSelect({
        browseFields: truncateBrowsePath(browseFields, levelKey),
      });
    },
    [onTreeSelect, browseFields]
  );

  const hasQuickFilterValues = useMemo(
    () => selectedQuickFilters.some((field) => !isEmpty(field.value)),
    [selectedQuickFilters]
  );
  // Selected values round trip through the URL as lowercased aggregation keys.
  // Labels are presentational, so only the rendered fields are hydrated — query
  // building keeps reading the raw state, whose keys never change.
  const quickFilterFields = useQuickFilterLabels({
    fields: selectedQuickFilters,
    sources: hitSources,
    index: activeTabKey,
  });

  const hasActiveFilterQuery = useMemo(
    () => hasQuickFilterValues || !isEmpty(browseFields),
    [hasQuickFilterValues, browseFields]
  );
  const shouldShowQueryFilterChips = useMemo(
    () => hasActiveFilterQuery || !searchQueryParam,
    [hasActiveFilterQuery, searchQueryParam]
  );

  const selectedEntityTypes = useMemo(() => {
    const entityTypeField = selectedQuickFilters.find(
      (field) =>
        field.key === EntityFields.ENTITY_TYPE_KEYWORD ||
        field.key === EntityFields.ENTITY_TYPE
    );
    const browseEntityTypeField = browseFields.find(
      (field) => field.key === EntityFields.ENTITY_TYPE
    );

    return [
      ...(entityTypeField?.value ?? []),
      ...(browseEntityTypeField?.value ?? []),
    ].map((option) => option.key);
  }, [selectedQuickFilters, browseFields]);

  const exploreLeftPanel = useMemo(() => {
    if (tabItems.length === 0) {
      return loading ? (
        <Loader />
      ) : (
        <FilterErrorPlaceHolder
          className="h-min-80 d-flex flex-col justify-center border-none"
          size={SIZE.MEDIUM}
        />
      );
    }

    if (searchQueryParam) {
      return (
        <Tabs
          orientation="vertical"
          selectedKey={activeTabKey}
          onSelectionChange={(key) => {
            if (key !== activeTabKey) {
              onChangeSearchIndex(key as ExploreSearchIndex);
              setShowSummaryPanel(false);
            }
          }}>
          <Tabs.List
            fullWidth
            aria-label={t('label.browse-estate')}
            className="tw:w-full"
            data-testid="explore-left-panel"
            type="button-gray">
            {tabItems.map(
              ({ key, label, icon: Icon, iconClassName, count }) => (
                <Tabs.Item
                  data-testid={`${lowerCase(label)}-tab`}
                  id={key}
                  key={key}>
                  {({ isSelected }) => (
                    <>
                      <Icon
                        className={classNames(
                          'tw:size-4 tw:shrink-0',
                          iconClassName
                        )}
                      />
                      <span className="tw:min-w-0 tw:flex-1 tw:truncate tw:text-left">
                        {label}
                      </span>
                      <Badge
                        color={isSelected ? 'brand' : 'gray'}
                        data-testid="filter-count"
                        size="sm"
                        type="pill-color">
                        {count}
                      </Badge>
                    </>
                  )}
                </Tabs.Item>
              )
            )}
          </Tabs.List>
        </Tabs>
      );
    }

    return (
      <ExploreTree
        additionalQueryFilter={queryFilter as QueryFilterInterface | undefined}
        selectedEntityTypes={selectedEntityTypes}
        onFieldValueSelect={handleQuickFiltersChange}
        onTreeSelect={handleExploreTreeSelect}
      />
    );
  }, [
    searchQueryParam,
    tabItems,
    handleQuickFiltersChange,
    handleExploreTreeSelect,
    activeTabKey,
    loading,
    onChangeSearchIndex,
    selectedEntityTypes,
    queryFilter,
    t,
  ]);

  useEffect(() => {
    const escapeKeyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClosePanel();
      }
    };
    document.addEventListener('keydown', escapeKeyHandler);

    return () => {
      document.removeEventListener('keydown', escapeKeyHandler);
    };
  }, []);

  useEffect(() => {
    const dropdownItems: Array<{
      label: string;
      key: string;
    }> = getDropDownItems(activeTabKey);

    const selectedValuesFromQuickFilter = getSelectedValuesFromQuickFilter(
      dropdownItems,
      quickFilters
    );

    setSelectedQuickFilters(
      dropdownItems.map((item) => ({
        ...item,
        value: selectedValuesFromQuickFilter?.[item.label] ?? [],
      }))
    );
  }, [activeTabKey, quickFilters]);

  useEffect(() => {
    if (!isUndefined(searchResults) && searchResults?.hits?.hits[0]) {
      handleSummaryPanelDisplay(
        highlightEntityNameAndDescription(
          firstEntity._source,
          firstEntity?.highlight
        )
      );
    } else {
      setShowSummaryPanel(false);
      setEntityDetails(undefined);
    }
  }, [
    searchResults,
    firstEntity?._source,
    firstEntity?.highlight,
    handleSummaryPanelDisplay,
  ]);

  const exportModalTitle = useMemo(
    () => (
      <div className="d-flex flex-col gap-1">
        <CoreTypography className="tw:text-primary" size="text-md">
          {t('label.export')}
        </CoreTypography>
        <CoreTypography
          className="tw:text-secondary"
          size="text-xs"
          weight="regular">
          {t('label.export-search-results-description')}
        </CoreTypography>
      </div>
    ),
    [t]
  );

  if (tabItems.length === 0 && !searchQueryParam) {
    return <Loader />;
  }

  return (
    <div className="explore-page bg-grey" data-testid="explore-page">
      <CoreCard className="m-b-box tw:block tw:border-utility-gray-blue-100 tw:p-2 tw:dark:border-subtle">
        <div className="tw:mr-2 tw:flex tw:flex-wrap tw:gap-y-2">
          {/* Zero flex-basis: with flex-wrap, a max-content basis would place
              the sort controls on their own row before shrinking is even
              considered; basis 0 keeps both columns on one line and lets the
              toolbar wrap internally. */}
          <div className="tw:relative tw:min-h-px tw:max-w-full tw:min-w-0 tw:flex-[1_1_0%]">
            <ExploreQuickFilters
              immediateApply
              showSelectedCounts
              aggregations={aggregations}
              defaultQueryFilter={
                browseQueryFilter as unknown as Record<string, unknown>
              }
              fields={quickFilterFields}
              fieldsWithNullValues={SUPPORTED_EMPTY_FILTER_FIELDS}
              index={activeTabKey}
              showDeleted={showDeleted}
              onAdvanceSearch={() => toggleModal(true)}
              onChangeShowDeleted={onChangeShowDeleted}
              onFieldValueSelect={handleQuickFiltersValueSelect}
            />
          </div>
          {/* Content-sized: a grow factor here would swallow the free space the
              zero-basis filters column needs (grow 410 vs 1 left it ~2px wide).
              Top-aligned, and offset by the filters' own `mt-1`, so the controls
              sit on the first filter row: centring them inside a column the
              wrapped filters have made two rows tall floats them into the gap
              and reads as a much heavier block. */}
          {/* `self-start` keeps this column at its content height. Left to
              stretch, it grows with the wrapped filters, and the vertical
              dividers — which are `self-stretch` — grow with it, towering over
              the controls they separate. */}
          <div className="d-flex items-start justify-end gap-3 tw:relative tw:mt-1 tw:min-h-px tw:max-w-full tw:flex-none tw:self-start">
            <Button
              aria-label={t('label.sort-order')}
              className="tw:p-0"
              color="tertiary"
              data-testid="sort-order-button"
              iconLeading={
                isAscSortOrder ? (
                  <IconAscending style={{ fontSize: '14px' }} {...sortProps} />
                ) : (
                  <IconDescending style={{ fontSize: '14px' }} {...sortProps} />
                )
              }
              size="sm"
              onPress={() =>
                onChangeSortOder(
                  isAscSortOrder ? SORT_ORDER.DESC : SORT_ORDER.ASC
                )
              }
            />

            <Divider className="tw:my-2" orientation="vertical" />

            <SortingDropDown
              fieldList={translatedSortingFields}
              handleFieldDropDown={onChangeSortValue}
              sortField={sortValue}
            />

            <Divider className="tw:my-2" orientation="vertical" />

            <Dropdown.Root>
              {/* The Tools label should match the adjacent 14px Explore filters. */}
              <Button
                hideFocusOutline
                color="tertiary"
                iconTrailing={<ChevronDown size={14} />}
                size="sm">
                {t('label.tool-plural')}
              </Button>
              <Dropdown.Popover>
                <Dropdown.Menu aria-label={t('label.action-plural')}>
                  <Dropdown.Item
                    icon={Download01}
                    label={t('label.export')}
                    onPress={handleOpenExportScopeModal}
                  />

                  <Dropdown.Item
                    icon={Trash01}
                    id="show-deleted"
                    onPress={() => onChangeShowDeleted(!showDeleted)}>
                    <Box justify="between">
                      {t('label.show-deleted')}
                      <Toggle
                        excludeFromTabOrder
                        isReadOnly
                        aria-label={t('label.show-deleted')}
                        className="tw:pointer-events-none"
                        isSelected={showDeleted}
                      />
                    </Box>
                  </Dropdown.Item>

                  <Dropdown.Item
                    icon={FilterFunnel01}
                    label={t('label.advanced-search')}
                    onPress={() => toggleModal(true)}
                  />

                  <Dropdown.Item
                    icon={InfoCircle}
                    id="show-ranking-details"
                    onPress={() =>
                      onChangeShowRankingDetails?.(!showRankingDetails)
                    }>
                    <Box justify="between">
                      {t('label.ranking-detail-plural')}
                      <Toggle
                        excludeFromTabOrder
                        isReadOnly
                        aria-label={t('label.ranking-detail-plural')}
                        className="tw:pointer-events-none"
                        isSelected={showRankingDetails}
                      />
                    </Box>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown.Root>
          </div>
          <ExploreFilterStatusRow
            browseFields={browseFields}
            clearFilters={clearFilters}
            handleRemoveBrowseLevel={handleRemoveBrowseLevel}
            handleRemoveQuickFilterValue={handleRemoveQuickFilterValue}
            isElasticSearchIssue={isElasticSearchIssue}
            quickFilterFields={quickFilterFields}
            searchQueryParam={searchQueryParam}
            shouldShowQueryFilterChips={shouldShowQueryFilterChips}
            sqlQuery={sqlQuery}
            t={t}
            onEditQueryFilter={() => toggleModal(true)}
            onResetQueryFilter={() => onResetQueryFilter()}
          />
        </div>
      </CoreCard>

      <ResizableLeftPanels
        showLearningIcon
        className={classNames('content-height-with-resizable-panel', {
          'filter-applied': Boolean(sqlQuery),
        })}
        firstPanel={{
          className: 'content-resizable-panel-container',
          flex: 0.2,
          minWidth: 280,
          title: t('label.browse-estate'),
          titleClassName: 'tw:capitalize tw:font-medium',
          titleContainerClassName: 'tw:items-center tw:pb-2',
          titleStrong: false,
          children: <div className="p-x-sm">{exploreLeftPanel}</div>,
        }}
        secondPanel={{
          flex: 0.8,
          minWidth: 800,
          children: (
            <ExploreResultsPanel
              entityDetails={entityDetails}
              firstEntity={firstEntity}
              handleClosePanel={handleClosePanel}
              handleExplorePageChange={handleExplorePageChange}
              handleExplorePageSizeChange={handleExplorePageSizeChange}
              handleSummaryPanelDisplay={handleSummaryPanelDisplay}
              hasActiveFilters={hasActiveFilters}
              isElasticSearchIssue={isElasticSearchIssue}
              loading={loading}
              pageSize={pageSize}
              parsedSearch={parsedSearch}
              searchResults={searchResults}
              selectedQuickFilters={selectedQuickFilters}
              showRankingDetails={showRankingDetails}
              showSummaryPanel={showSummaryPanel}
              totalPages={totalPages}
              totalValue={totalValue}
              validCurrentPage={validCurrentPage}
            />
          ),
        }}
      />

      {searchQueryParam && tabItems.length === 0 && loading && <Loader />}

      <ExploreExportScopeModal
        activeTabLabel={activeTabLabel}
        allAssetsCount={allAssetsCount}
        exportError={exportError}
        exportScope={exportScope}
        isAllAssetsLimitExceeded={isAllAssetsLimitExceeded}
        isCountLoading={isCountLoading}
        isExporting={isExporting}
        isSearchMode={isSearchMode}
        isTabScopeDisabled={isTabScopeDisabled}
        open={showExportScopeModal}
        pageResultCount={pageResultCount}
        t={t}
        tabAssetsCount={tabAssetsCount}
        title={exportModalTitle}
        onCancel={() => {
          setShowExportScopeModal(false);
          setExportError(undefined);
        }}
        onExportScopeChange={handleExportScopeChange}
        onOk={handleExportScopeConfirm}
      />
    </div>
  );
};

export default ExploreV1;
