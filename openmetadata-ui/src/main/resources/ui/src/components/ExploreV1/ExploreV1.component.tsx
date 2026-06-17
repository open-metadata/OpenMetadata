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
  Box,
  Button,
  Card as CoreCard,
  Divider,
  Dropdown,
  Toggle,
  Typography as CoreTypography,
} from '@openmetadata/ui-core-components';
import {
  ChevronDown,
  Download01,
  FilterFunnel01,
  Trash01,
} from '@untitledui/icons';
import { Card, Col, Menu, Modal, Radio, Row, Skeleton } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEmpty, isString, isUndefined, noop, omit } from 'lodash';
import Qs from 'qs';
import { lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdvanceSearch } from '../../components/Explore/AdvanceSearchProvider/AdvanceSearchProvider.component';
import AppliedFilterText from '../../components/Explore/AppliedFilterText/AppliedFilterText';
import ExploreQueryFilterChips from '../../components/Explore/ExploreQueryFilterChips/ExploreQueryFilterChips.component';
import ExploreQuickFilters from '../../components/Explore/ExploreQuickFilters';
import SortingDropDown from '../../components/Explore/SortingDropDown';
import {
  entitySortingFields,
  SUPPORTED_EMPTY_FILTER_FIELDS,
  TAG_FQN_KEY,
} from '../../constants/explore.constants';
import { EntityFields } from '../../enums/AdvancedSearch.enum';
import { SIZE, SORT_ORDER } from '../../enums/common.enum';
import { EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { QueryFilterInterface } from '../../pages/ExplorePage/ExplorePage.interface';
import {
  exportSearchResultsCsvStream,
  searchQuery,
} from '../../rest/searchAPI';
import { getDropDownItems } from '../../utils/AdvancedSearchUtils';
import { parseExportErrorMessage } from '../../utils/APIUtils';
import { highlightEntityNameAndDescription } from '../../utils/EntitySearchUtils';
import { getCombinedQueryFilterObject } from '../../utils/ExplorePage/ExplorePageUtils';
import {
  getExploreQueryFilterMust,
  getSelectedValuesFromQuickFilter,
  truncateBrowsePath,
} from '../../utils/ExploreUtils';
import searchClassBase from '../../utils/SearchClassBase';
import withSuspenseFallback from '../AppRouter/withSuspenseFallback';
import FilterErrorPlaceHolder from '../common/ErrorWithPlaceholder/FilterErrorPlaceHolder';
import Loader from '../common/Loader/Loader';
import ResizableLeftPanels from '../common/ResizablePanels/ResizableLeftPanels';
import {
  ExploreProps,
  ExploreQuickFilterField,
  ExploreSearchIndex,
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

const ExploreV1: React.FC<ExploreProps> = ({
  aggregations,
  activeTabKey,
  tabItems = [],
  searchResults,
  onChangeAdvancedSearchQuickFilters,
  searchIndex,
  sortOrder,
  onChangeSortOder,
  sortValue,
  onChangeSortValue,
  onChangeShowDeleted,
  onChangeSearchIndex,
  showDeleted,
  onChangePage = noop,
  loading,
  quickFilters,
  isElasticSearchIssue,
  browseFields = [],
  browseQueryFilter,
  onTreeSelect = noop,
}) => {
  const tabsInfo = searchClassBase.getTabsInfo();
  const { t } = useTranslation();
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
    [location.search]
  );

  const { toggleModal, sqlQuery, queryFilter, onResetAllFilters } =
    useAdvanceSearch();

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
      const currentPage = isString(parsedSearch.page)
        ? Number.parseInt(parsedSearch.page, 10) || 1
        : 1;
      const pageSize = isString(parsedSearch.size)
        ? Number.parseInt(parsedSearch.size, 10) || pageResultCount
        : pageResultCount;

      return (currentPage - 1) * pageSize;
    })();

    const params: Parameters<typeof exportSearchResultsCsvStream>[0] = {
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
      const blob = await exportSearchResultsCsvStream(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Search_Results_${new Date().toISOString()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
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
    searchIndex,
    allAssetsCount,
    visibleResultCount,
    isSearchMode,
    pageResultCount,
    parsedSearch,
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
  }, [searchIndex, t]);

  const handleClosePanel = () => {
    setShowSummaryPanel(false);
  };

  const isAscSortOrder = useMemo(
    () => sortOrder === SORT_ORDER.ASC,
    [sortOrder]
  );
  const sortProps = useMemo(
    () => ({
      className: 'text-base',
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
        <Menu
          className="custom-menu"
          data-testid="explore-left-panel"
          items={tabItems}
          mode="inline"
          rootClassName="left-container"
          selectedKeys={[activeTabKey]}
          onClick={(info) => {
            if (info && info.key !== activeTabKey) {
              onChangeSearchIndex(info.key as ExploreSearchIndex);
              setShowSummaryPanel(false);
            }
          }}
        />
      );
    }

    return (
      <ExploreTree
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
  }, [searchResults]);

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

  const visibleCardCount =
    isSearchMode && isCountLoading ? (
      <Skeleton.Input active size="small" style={{ width: 60, height: 16 }} />
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

  const allAssetsCountDisplay = isCountLoading ? (
    <Skeleton.Input active size="small" style={{ width: 60, height: 16 }} />
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

  if (tabItems.length === 0 && !searchQueryParam) {
    return <Loader />;
  }

  return (
    <div className="explore-page bg-grey" data-testid="explore-page">
      <Card className="p-xs card-padding-0 m-b-box">
        <Row className="tw:mr-2" gutter={[0, 8]}>
          <Col>
            <ExploreQuickFilters
              immediateApply
              showSelectedCounts
              aggregations={aggregations}
              defaultQueryFilter={
                browseQueryFilter as unknown as Record<string, unknown>
              }
              fields={selectedQuickFilters}
              fieldsWithNullValues={SUPPORTED_EMPTY_FILTER_FIELDS}
              helperText={t('message.pick-values-to-refine')}
              index={activeTabKey}
              showDeleted={showDeleted}
              onAdvanceSearch={() => toggleModal(true)}
              onChangeShowDeleted={onChangeShowDeleted}
              onFieldValueSelect={handleQuickFiltersValueSelect}
            />
          </Col>
          <Col className="d-flex items-center justify-end gap-3" flex={410}>
            <Button
              aria-label="Sort order"
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

            <SortingDropDown
              fieldList={translatedSortingFields}
              handleFieldDropDown={onChangeSortValue}
              sortField={sortValue}
            />

            <Divider className="tw:my-2" orientation="vertical" />

            <Dropdown.Root>
              <Button
                className="tw:p-0"
                color="tertiary"
                iconTrailing={<ChevronDown size={14} />}
                size="sm">
                {t('label.tool-plural')}
              </Button>
              <Dropdown.Popover>
                <Dropdown.Menu aria-label="Actions">
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
                      {t('label.deleted')}
                      <Toggle isSelected={showDeleted} />
                    </Box>
                  </Dropdown.Item>

                  <Dropdown.Item
                    icon={FilterFunnel01}
                    label={t('label.advanced-search')}
                    onPress={() => toggleModal(true)}
                  />
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown.Root>
          </Col>
          {(hasQuickFilterValues ||
            !isEmpty(browseFields) ||
            !searchQueryParam) && (
            <Col span={24}>
              <ExploreQueryFilterChips
                browseFields={browseFields}
                emptyText={
                  searchQueryParam
                    ? undefined
                    : t('message.browse-estate-query-placeholder')
                }
                fields={selectedQuickFilters}
                onClearAll={clearFilters}
                onRemoveBrowseLevel={handleRemoveBrowseLevel}
                onRemoveValue={handleRemoveQuickFilterValue}
              />
            </Col>
          )}
          {isElasticSearchIssue ? (
            <Col span={24}>
              <IndexNotFoundBanner />
            </Col>
          ) : (
            <></>
          )}
          {sqlQuery && (
            <Col span={24}>
              <AppliedFilterText
                filterText={sqlQuery}
                onClear={() => onResetAllFilters()}
                onEdit={() => toggleModal(true)}
              />
            </Col>
          )}
        </Row>
      </Card>

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
          children: <div className="p-x-sm">{exploreLeftPanel}</div>,
        }}
        secondPanel={{
          flex: 0.8,
          minWidth: 800,
          children: (
            <Box className="tw:h-full" colGap={3}>
              <Card className="h-full tw:flex-1 explore-main-card">
                {!loading && !isElasticSearchIssue ? (
                  <SearchedData
                    isFilterSelected
                    showResultCount
                    data={searchResults?.hits.hits ?? []}
                    filter={parsedSearch}
                    handleSummaryPanelDisplay={handleSummaryPanelDisplay}
                    isSummaryPanelVisible={showSummaryPanel}
                    selectedEntityId={entityDetails?.id || ''}
                    totalValue={searchResults?.hits.total.value ?? 0}
                    onPaginationChange={onChangePage}
                  />
                ) : (
                  <></>
                )}
                {loading ? <Loader /> : <></>}
              </Card>

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
                      entityDetails.entityType +
                      '-' +
                      entityDetails.fullyQualifiedName
                    }
                    panelPath="explore"
                  />
                </div>
              )}
            </Box>
          ),
        }}
      />

      {searchQueryParam && tabItems.length === 0 && loading && <Loader />}

      <Modal
        centered
        cancelText={t('label.cancel')}
        className="search-export-modal tw:overflow-hidden"
        data-testid="export-scope-modal"
        okButtonProps={{
          disabled:
            isExporting ||
            isCountLoading ||
            isAllAssetsLimitExceeded ||
            isTabScopeDisabled,
          loading: isExporting,
        }}
        okText={t('label.export')}
        open={showExportScopeModal}
        title={exportModalTitle}
        width={680}
        onCancel={() => {
          setShowExportScopeModal(false);
          setExportError(undefined);
        }}
        onOk={handleExportScopeConfirm}>
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
        <Radio.Group
          className="d-flex gap-3 m-t-sm w-full"
          value={exportScope}
          onChange={(e) =>
            handleExportScopeChange(e.target.value as 'visible' | 'all')
          }>
          <CoreCard
            isClickable
            className="export-scope-option-card tw:flex-1 tw:p-4"
            data-testid="export-scope-visible-card"
            isSelected={exportScope === 'visible'}
            onClick={() => handleExportScopeChange('visible')}>
            <div className="d-flex items-start gap-1">
              <Radio value="visible" />
              <div>
                <div className="d-flex items-center gap-2">
                  <CoreTypography
                    className="tw:text-primary d-flex items-center tw:gap-0.5"
                    size="text-sm"
                    weight="semibold">
                    {isSearchMode
                      ? activeTabLabel
                      : t('label.visible-result-plural')}
                    {visibleCardCount}
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
            onClick={() => handleExportScopeChange('all')}>
            <div className="d-flex items-start tw:gap-1">
              <Radio value="all" />
              <div>
                <CoreTypography
                  className="tw:text-primary d-flex items-center tw:gap-1"
                  size="text-sm"
                  weight="semibold">
                  {`${t('label.all-asset-plural')} `}
                  {allAssetsCountDisplay}
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
        </Radio.Group>
      </Modal>
    </div>
  );
};

export default ExploreV1;
