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
  ExclamationCircleOutlined,
  FilterOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
} from '@ant-design/icons';
import { Alert, Button, Card, Col, Menu, Row, Typography } from 'antd';
import { Switch } from 'antd';
import { isEmpty, isString, isUndefined, noop, omit } from 'lodash';
import Qs from 'qs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAdvanceSearch } from '../../components/Explore/AdvanceSearchProvider/AdvanceSearchProvider.component';
import AppliedFilterText from '../../components/Explore/AppliedFilterText/AppliedFilterText';
import EntitySummaryPanel from '../../components/Explore/EntitySummaryPanel/EntitySummaryPanel.component';
import ExploreQuickFilters from '../../components/Explore/ExploreQuickFilters';
import SortingDropDown from '../../components/Explore/SortingDropDown';
import {
  entitySortingFields,
  SEARCH_INDEXING_APPLICATION,
  SUPPORTED_EMPTY_FILTER_FIELDS,
  TAG_FQN_KEY,
} from '../../constants/explore.constants';
import { SIZE, SORT_ORDER } from '../../enums/common.enum';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { getDropDownItems } from '../../utils/AdvancedSearchUtils';
import { Transi18next } from '../../utils/CommonUtils';
import { highlightEntityNameAndDescription } from '../../utils/EntityUtils';
import {
  getExploreQueryFilterMust,
  getSelectedValuesFromQuickFilter,
} from '../../utils/ExploreUtils';
import { getApplicationDetailsPath } from '../../utils/RouterUtils';
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

const IndexNotFoundBanner = () => {
  const { theme } = useApplicationStore();
  const { t } = useTranslation();

  return (
    <Alert
      closable
      description={
        <div className="d-flex items-start gap-3">
          <ExclamationCircleOutlined
            style={{
              color: theme.errorColor,
              fontSize: '16px',
            }}
          />
          <div className="d-flex flex-col gap-2">
            <Typography.Text className="font-semibold text-xs">
              {t('server.indexing-error')}
            </Typography.Text>
            <Typography.Paragraph className="m-b-0 text-xs">
              <Transi18next
                i18nKey="message.configure-search-re-index"
                renderElement={
                  <Link
                    className="alert-link"
                    to={getApplicationDetailsPath(SEARCH_INDEXING_APPLICATION)}
                  />
                }
                values={{
                  settings: t('label.search-index-setting-plural'),
                }}
              />
            </Typography.Paragraph>
          </div>
        </div>
      }
      type="error"
    />
  );
};

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

  const { toggleModal, sqlQuery, onResetAllFilters } = useAdvanceSearch();

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

  return (
    <div className="explore-page bg-grey" data-testid="explore-page">
      <ResizableLeftPanels
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

                            <Button
                              className="cursor-pointer"
                              data-testid="advance-search-button"
                              icon={<FilterOutlined />}
                              type="text"
                              onClick={() => toggleModal(true)}
                            />
                            <span className="sorting-dropdown-container">
                              <SortingDropDown
                                fieldList={
                                  tabsInfo[searchIndex as ExploreSearchIndex]
                                    ?.sortingFields ?? entitySortingFields
                                }
                                handleFieldDropDown={onChangeSortValue}
                                sortField={sortValue}
                              />
                              <Button
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
                              </Button>
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
                    />
                  </Col>
                )}
              </Row>
            </div>
          ),
        }}
      />

      {searchQueryParam && tabItems.length === 0 && loading && <Loader />}
    </div>
  );
};

export default ExploreV1;
