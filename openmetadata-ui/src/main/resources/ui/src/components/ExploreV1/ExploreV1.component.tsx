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
  FilterOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card as CoreCard,
  Typography as CoreTypography,
} from '@openmetadata/ui-core-components';
import { Download01 } from '@untitledui/icons';
import {
  Button as AntdButton,
  Card,
  Col,
  Menu,
  Modal,
  Radio,
  Row,
  Spin,
  Switch,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, isString, isUndefined, noop, omit } from 'lodash';
import Qs from 'qs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdvanceSearch } from '../../components/Explore/AdvanceSearchProvider/AdvanceSearchProvider.component';
import AppliedFilterText from '../../components/Explore/AppliedFilterText/AppliedFilterText';
import EntitySummaryPanel from '../../components/Explore/EntitySummaryPanel/EntitySummaryPanel.component';
import ExploreQuickFilters from '../../components/Explore/ExploreQuickFilters';
import SortingDropDown from '../../components/Explore/SortingDropDown';
import {
  entitySortingFields,
  SUPPORTED_EMPTY_FILTER_FIELDS,
  TAG_FQN_KEY,
} from '../../constants/explore.constants';
import { SIZE, SORT_ORDER } from '../../enums/common.enum';
import { SearchIndex } from '../../enums/search.enum';
import { QueryFilterInterface } from '../../pages/ExplorePage/ExplorePage.interface';
import {
  exportSearchResultsCsvStream,
  searchQuery,
} from '../../rest/searchAPI';
import { getDropDownItems } from '../../utils/AdvancedSearchUtils';
import { parseExportErrorMessage } from '../../utils/APIUtils';
import { highlightEntityNameAndDescription } from '../../utils/EntityUtils';
import { getCombinedQueryFilterObject } from '../../utils/ExplorePage/ExplorePageUtils';
import {
  getExploreQueryFilterMust,
  getSelectedValuesFromQuickFilter,
} from '../../utils/ExploreUtils';
import searchClassBase from '../../utils/SearchClassBase';
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
import './exploreV1.less';
import { IndexNotFoundBanner } from './IndexNotFoundBanner';

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
  const [exportError, setExportError] = useState<string | undefined>();
  const [isCountLoading, setIsCountLoading] = useState(false);

  const visibleResultCount = searchResults?.hits?.hits?.length ?? 0;
  const isAllAssetsLimitExceeded =
    exportScope === 'all' &&
    allAssetsCount !== undefined &&
    allAssetsCount > EXPORT_ALL_ASSETS_LIMIT;

  const handleExportScopeChange = (scope: 'visible' | 'all') => {
    setExportScope(scope);
    setExportError(undefined);
  };

  const handleOpenExportScopeModal = useCallback(async () => {
    setExportScope('all');
    setAllAssetsCount(undefined);
    setExportError(undefined);
    setShowExportScopeModal(true);
    setIsCountLoading(true);

    try {
      const combinedQueryFilter = getCombinedQueryFilterObject(
        quickFilters,
        queryFilter as QueryFilterInterface | undefined
      );
      const response = await searchQuery({
        query: searchQueryParam || '*',
        searchIndex: SearchIndex.DATA_ASSET,
        pageSize: 0,
        trackTotalHits: true,
        includeDeleted: showDeleted,
        queryFilter: combinedQueryFilter ?? undefined,
      });
      setAllAssetsCount(response.hits.total.value);
    } catch {
      // Count fetch failed — modal still usable without count
    } finally {
      setIsCountLoading(false);
    }
  }, [searchQueryParam, showDeleted, quickFilters, queryFilter]);

  const handleExportScopeConfirm = useCallback(async () => {
    if (isAllAssetsLimitExceeded) {
      return;
    }

    const isVisibleScope = exportScope === 'visible';
    const combinedQueryFilter = getCombinedQueryFilterObject(
      quickFilters,
      queryFilter as QueryFilterInterface | undefined
    );

    const params: Parameters<typeof exportSearchResultsCsvStream>[0] = {
      q: searchQueryParam || '*',
      index: isVisibleScope ? searchIndex : SearchIndex.DATA_ASSET,
      sort_field: sortValue,
      sort_order: sortOrder,
    };

    if (showDeleted !== undefined) {
      params.deleted = showDeleted;
    }

    if (combinedQueryFilter) {
      params.query_filter = JSON.stringify(combinedQueryFilter);
    }

    if (isVisibleScope) {
      const currentPage = isString(parsedSearch.page)
        ? Number.parseInt(parsedSearch.page, 10) || 1
        : 1;
      const pageSize = isString(parsedSearch.size)
        ? Number.parseInt(parsedSearch.size, 10) || visibleResultCount
        : visibleResultCount;

      params.size = visibleResultCount;
      params.from = (currentPage - 1) * pageSize;
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
    visibleResultCount,
    parsedSearch,
    searchQueryParam,
    sortValue,
    sortOrder,
    showDeleted,
    quickFilters,
    queryFilter,
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
    // onChangeAdvancedSearchQuickFilters(undefined);
    onResetAllFilters();
  };

  const handleQuickFiltersChange = (data: ExploreQuickFilterField[]) => {
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
  };

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

    return <ExploreTree onFieldValueSelect={handleQuickFiltersChange} />;
  }, [searchQueryParam, tabItems]);

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

  if (tabItems.length === 0 && !searchQueryParam) {
    return <Loader />;
  }

  const exportModalTitle = () => {
    return (
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
    );
  };

  return (
    <div className="explore-page bg-grey" data-testid="explore-page">
      <ResizableLeftPanels
        showLearningIcon
        className="content-height-with-resizable-panel"
        firstPanel={{
          className: 'content-resizable-panel-container',
          flex: 0.2,
          minWidth: 280,
          title: t('label.data-asset-plural'),
          children: <div className="p-x-sm">{exploreLeftPanel}</div>,
        }}
        secondPanel={{
          className: 'content-height-with-resizable-panel',
          flex: 0.8,
          minWidth: 800,
          children: (
            <div className="explore-main-container">
              <Row
                className="quick-filters-container"
                gutter={[20, 0]}
                wrap={false}>
                <Col span={24}>
                  <Card className="p-md card-padding-0 m-b-box">
                    <Row>
                      <Col className="searched-data-container w-full">
                        <Row gutter={[0, 8]}>
                          <Col>
                            <ExploreQuickFilters
                              aggregations={aggregations}
                              fields={selectedQuickFilters}
                              fieldsWithNullValues={
                                SUPPORTED_EMPTY_FILTER_FIELDS
                              }
                              index={activeTabKey}
                              showDeleted={showDeleted}
                              onAdvanceSearch={() => toggleModal(true)}
                              onChangeShowDeleted={onChangeShowDeleted}
                              onFieldValueSelect={handleQuickFiltersValueSelect}
                            />
                          </Col>
                          <Col
                            className="d-flex items-center justify-end gap-3"
                            flex={410}>
                            <Button
                              color="secondary"
                              data-testid="export-search-results-button"
                              iconLeading={
                                <Download01 height={16} width={16} />
                              }
                              size="sm"
                              onClick={handleOpenExportScopeModal}>
                              <CoreTypography
                                className="tw:text-secondary"
                                size="text-sm"
                                weight="medium">
                                {t('label.export')}
                              </CoreTypography>
                            </Button>
                            <span className="flex-center">
                              <Switch
                                checked={showDeleted}
                                data-testid="show-deleted"
                                onChange={onChangeShowDeleted}
                              />
                              <Typography.Text className="filters-label p-l-xs font-medium">
                                {t('label.deleted')}
                              </Typography.Text>
                            </span>
                            {(quickFilters || sqlQuery) && (
                              <Typography.Text
                                className="text-primary self-center cursor-pointer font-medium"
                                data-testid="clear-filters"
                                onClick={() => clearFilters()}>
                                {t('label.clear-entity', {
                                  entity: '',
                                })}
                              </Typography.Text>
                            )}

                            <AntdButton
                              className="cursor-pointer"
                              data-testid="advance-search-button"
                              icon={<FilterOutlined />}
                              type="text"
                              onClick={() => toggleModal(true)}
                            />
                            <span className="sorting-dropdown-container">
                              <SortingDropDown
                                fieldList={translatedSortingFields}
                                handleFieldDropDown={onChangeSortValue}
                                sortField={sortValue}
                              />
                              <AntdButton
                                className="p-0"
                                data-testid="sort-order-button"
                                size="small"
                                type="text"
                                onClick={() =>
                                  onChangeSortOder(
                                    isAscSortOrder
                                      ? SORT_ORDER.DESC
                                      : SORT_ORDER.ASC
                                  )
                                }>
                                {isAscSortOrder ? (
                                  <SortAscendingOutlined
                                    style={{ fontSize: '14px' }}
                                    {...sortProps}
                                  />
                                ) : (
                                  <SortDescendingOutlined
                                    style={{ fontSize: '14px' }}
                                    {...sortProps}
                                  />
                                )}
                              </AntdButton>
                            </span>
                          </Col>
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
                                onEdit={() => toggleModal(true)}
                              />
                            </Col>
                          )}
                        </Row>
                      </Col>
                    </Row>
                  </Card>
                </Col>
              </Row>

              <Row
                className="explore-data-container"
                gutter={[20, 0]}
                wrap={false}>
                <Col flex="auto">
                  <Card className="h-full explore-main-card">
                    <div className="h-full">
                      {!loading && !isElasticSearchIssue ? (
                        <SearchedData
                          isFilterSelected
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
                    </div>
                  </Card>
                </Col>

                {showSummaryPanel && entityDetails && !loading && (
                  <Col className="explore-right-panel" flex="400px">
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
                  </Col>
                )}
              </Row>
            </div>
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
          disabled: isExporting || isCountLoading || isAllAssetsLimitExceeded,
          loading: isExporting,
        }}
        okText={t('label.export')}
        open={showExportScopeModal}
        title={exportModalTitle()}
        width={610}
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
            isSelected={exportScope === 'visible'}
            onClick={() => handleExportScopeChange('visible')}>
            <div className="d-flex items-start gap-2">
              <Radio value="visible" />
              <div>
                <div className="d-flex items-center gap-2">
                  <CoreTypography
                    className="tw:text-primary d-flex items-center tw:gap-0.5"
                    size="text-sm"
                    weight="semibold">
                    {`${t('label.visible-result-plural')} `}
                    <CoreTypography
                      className="tw:text-tertiary"
                      size="text-sm"
                      weight="regular">
                      ({visibleResultCount} {t('label.result-plural')})
                    </CoreTypography>
                  </CoreTypography>
                </div>
                <CoreTypography
                  className="tw:text-tertiary"
                  size="text-sm"
                  weight="regular">
                  {t('message.export-visible-results-description')}
                </CoreTypography>
              </div>
            </div>
          </CoreCard>
          <CoreCard
            isClickable
            className="export-scope-option-card tw:flex-1 tw:p-4"
            isSelected={exportScope === 'all'}
            onClick={() => handleExportScopeChange('all')}>
            <div className="d-flex items-start tw:gap-1">
              <Radio value="all" />
              <div>
                <CoreTypography
                  className="tw:text-primary d-flex items-center tw:gap-0.5"
                  size="text-sm"
                  weight="semibold">
                  {`${t('label.all-matching-asset-plural')} `}
                  {isCountLoading ? (
                    <Spin className="m-l-xs" size="small" />
                  ) : (
                    allAssetsCount !== undefined && (
                      <CoreTypography
                        className="tw:text-tertiary"
                        size="text-sm"
                        weight="regular">
                        ({allAssetsCount} {t('label.result-plural')})
                      </CoreTypography>
                    )
                  )}
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
