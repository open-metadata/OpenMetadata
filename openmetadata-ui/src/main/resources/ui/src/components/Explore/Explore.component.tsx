/*
 *  Copyright 2021 Collate
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
  faSortAmountDownAlt,
  faSortAmountUpAlt,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Card } from 'antd';
import classNames from 'classnames';
import { cloneDeep, lowerCase } from 'lodash';
import { FilterObject } from 'Models';
import React, { Fragment, useEffect, useRef, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import FacetFilter from '../../components/common/facetfilter/FacetFilter';
import SearchedData from '../../components/searched-data/SearchedData';
import {
  getExplorePathWithSearch,
  PAGE_SIZE,
  ROUTES,
  visibleFilters,
} from '../../constants/constants';
import {
  emptyValue,
  getCurrentIndex,
  getCurrentTab,
  INITIAL_FILTERS,
  INITIAL_SORT_FIELD,
  INITIAL_SORT_ORDER,
  tableSortingFields,
  tabsInfo,
} from '../../constants/explore.constants';
import { SearchIndex } from '../../enums/search.enum';
import { usePrevious } from '../../hooks/usePrevious';
import { getCountBadge } from '../../utils/CommonUtils';
import { getFilterString } from '../../utils/FilterUtils';
import PageLayout, { leftPanelAntCardStyle } from '../containers/PageLayout';
import { ExploreProps, QueryBuilderState } from './explore.interface';
import SortingDropDown from './SortingDropDown';
import AdvancedSearch from '../AdvancedSearch/AdvancedSearch.component';
import {
  emptyImmutableTree,
  getQbConfigs,
} from '../AdvancedSearch/AdvancesSearch.constants';
import { elasticSearchFormat } from '../../utils/QueryBuilder';
import { getPostFilter } from '../../axiosAPIs/searchAPI';

const Explore: React.FC<ExploreProps> = ({
  tabCounts,
  searchText,
  initialFilter,
  searchFilter,
  tab,
  searchQuery,
  searchResult,
  sortValue,
  fetchCount,
  handleFilterChange,
  handlePathChange,
  handleSearchText,
  fetchData,
  showDeleted,
  onShowDeleted,
  updateTableCount,
  updateTopicCount,
  updateDashboardCount,
  updatePipelineCount,
  isFilterSelected,
  updateMlModelCount,
}: ExploreProps) => {
  const location = useLocation();
  const history = useHistory();
  const filterObject: FilterObject = {
    ...INITIAL_FILTERS,
    ...initialFilter,
  };
  const [filters, setFilters] = useState<FilterObject>({
    ...filterObject,
    ...searchFilter,
  });

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalNumberOfValue, setTotalNumberOfValues] = useState<number>(0);
  const [searchTag, setSearchTag] = useState<string>(location.search);
  const [sortField, setSortField] = useState<string>(sortValue);
  const [sortOrder, setSortOrder] = useState<string>(INITIAL_SORT_ORDER);
  const [searchIndex, setSearchIndex] = useState<SearchIndex>(
    getCurrentIndex(tab)
  );
  const [currentTab, setCurrentTab] = useState<number>(getCurrentTab(tab));

  const [isEntityLoading, setIsEntityLoading] = useState(true);

  const isMounting = useRef(true);
  const forceSetAgg = useRef(false);
  const previsouIndex = usePrevious(searchIndex);
  const [fieldList, setFieldList] =
    useState<Array<{ name: string; value: string }>>(tableSortingFields);

  const [advancedSearchState, setAdvancedSearchState] =
    useState<QueryBuilderState>({
      tree: emptyImmutableTree,
      config: getQbConfigs(searchIndex),
    });

  const elasticsearchFilter = {
    query: elasticSearchFormat(
      advancedSearchState.tree,
      advancedSearchState.config
    ),
  } as Record<string, unknown>;

  const handleSelectedFilter = (
    checked: boolean,
    selectedFilter: string,
    type: keyof typeof filterObject
  ) => {
    let filterData;
    if (checked) {
      const filterType = filters[type];
      if (filterType.includes(selectedFilter)) {
        filterData = { ...filters };
      } else {
        filterData = {
          ...filters,
          [type]: [...filters[type], selectedFilter],
        };
      }
    } else {
      if (searchTag.includes(selectedFilter)) {
        setSearchTag('');
      }
      const filter = filters[type];
      const index = filter.indexOf(selectedFilter);
      filter.splice(index, 1);

      filterData = { ...filters, [type]: filter };
    }

    handleFilterChange(filterData);
  };

  const handleFieldDropDown = (value: string) => {
    setSortField(value);
  };

  const handleShowDeleted = (checked: boolean) => {
    onShowDeleted(checked);
  };

  const paginate = (pageNumber: string | number) => {
    setCurrentPage(pageNumber as number);
  };

  // const updateAggregationCount = useCallback(
  //   (newAggregations: Array<AggregationType>) => {
  //     const oldAggs = cloneDeep(aggregations);
  //     for (const newAgg of newAggregations) {
  //       for (const oldAgg of oldAggs) {
  //         if (newAgg.title === oldAgg.title) {
  //           if (UPDATABLE_AGGREGATION.includes(newAgg.title)) {
  //             const buckets = cloneDeep(oldAgg.buckets)
  //               .map((item) => {
  //                 // eslint-disable-next-line @typescript-eslint/camelcase
  //                 return { ...item, doc_count: 0 };
  //               })
  //               .concat(newAgg.buckets);
  //             const bucketHashmap = buckets.reduce((obj, item) => {
  //               obj[item.key]
  //                 ? // eslint-disable-next-line @typescript-eslint/camelcase
  //                   (obj[item.key].doc_count += item.doc_count)
  //                 : (obj[item.key] = { ...item });
  //
  //               return obj;
  //             }, {} as { [key: string]: Bucket });
  //             oldAgg.buckets = Object.values(bucketHashmap);
  //           } else {
  //             oldAgg.buckets = newAgg.buckets;
  //           }
  //         }
  //       }
  //     }
  //     setAggregations(oldAggs);
  //   },
  //   [aggregations, filters]
  // );

  const setCount = (count = 0, index = searchIndex) => {
    switch (index) {
      case SearchIndex.TABLE:
        updateTableCount(count);

        break;
      case SearchIndex.DASHBOARD:
        updateDashboardCount(count);

        break;
      case SearchIndex.TOPIC:
        updateTopicCount(count);

        break;
      case SearchIndex.PIPELINE:
        updatePipelineCount(count);

        break;
      case SearchIndex.MLMODEL:
        updateMlModelCount(count);

        break;
      default:
        break;
    }
  };

  const fetchTableData = () => {
    setIsEntityLoading(true);
    fetchData({
      query: searchText,
      from: currentPage,
      size: PAGE_SIZE,
      sortField,
      sortOrder,
      searchIndex,
      postFilter: getPostFilter(filters),
      queryFilter: elasticsearchFilter,
    });
  };

  const getFacetedFilter = () => {
    const facetFilters: FilterObject = cloneDeep(filterObject);
    for (const key in filters) {
      if (visibleFilters.includes(key)) {
        facetFilters[key as keyof typeof filterObject] =
          filters[key as keyof typeof filterObject];
      }
    }

    return facetFilters;
  };

  const handleOrder = (value: string) => {
    setSortOrder(value);
  };

  const getSortingElements = () => {
    return (
      <div className="tw-flex">
        <SortingDropDown
          fieldList={fieldList}
          handleFieldDropDown={handleFieldDropDown}
          sortField={sortField}
        />

        <div className="tw-flex">
          {sortOrder === 'asc' ? (
            <button className="tw-mt-2" onClick={() => handleOrder('desc')}>
              <FontAwesomeIcon
                className="tw-text-base tw-text-primary"
                data-testid="last-updated"
                icon={faSortAmountDownAlt}
              />
            </button>
          ) : (
            <button className="tw-mt-2" onClick={() => handleOrder('asc')}>
              <FontAwesomeIcon
                className="tw-text-base tw-text-primary"
                data-testid="last-updated"
                icon={faSortAmountUpAlt}
              />
            </button>
          )}
        </div>
      </div>
    );
  };

  const getActiveTabClass = (selectedTab: number) => {
    return selectedTab === currentTab ? 'active' : '';
  };

  const getTabCount = (index: string, isActive: boolean, className = '') => {
    switch (index) {
      case SearchIndex.TABLE:
        return getCountBadge(tabCounts.table, className, isActive);
      case SearchIndex.TOPIC:
        return getCountBadge(tabCounts.topic, className, isActive);
      case SearchIndex.DASHBOARD:
        return getCountBadge(tabCounts.dashboard, className, isActive);
      case SearchIndex.PIPELINE:
        return getCountBadge(tabCounts.pipeline, className, isActive);
      case SearchIndex.MLMODEL:
        return getCountBadge(tabCounts.mlModel, className, isActive);
      default:
        return getCountBadge();
    }
  };

  const onTabChange = (selectedTab: number) => {
    if (tabsInfo[selectedTab - 1].path !== tab) {
      setIsEntityLoading(true);
      handlePathChange(tabsInfo[selectedTab - 1].path);
      history.push({
        pathname: getExplorePathWithSearch(
          searchQuery,
          tabsInfo[selectedTab - 1].path
        ),
        search: location.search,
      });
    }
  };

  const getTabs = () => (
    <div className="tw-mb-5 centered-layout">
      <nav
        className={classNames(
          'tw-flex tw-flex-row tw-justify-between tw-gh-tabs-container'
        )}>
        <div className="tw-flex">
          <div>
            {tabsInfo.map((tabDetail, index) => (
              <button
                className={`tw-pb-2 tw-px-4 tw-gh-tabs ${getActiveTabClass(
                  tabDetail.tab
                )}`}
                data-testid={`${lowerCase(tabDetail.label)}-tab`}
                key={index}
                onClick={() => {
                  onTabChange(tabDetail.tab);
                }}>
                {tabDetail.label}
                <span className="tw-pl-1">
                  {getTabCount(tabDetail.index, tabDetail.tab === currentTab)}
                </span>
              </button>
            ))}
          </div>
        </div>
        {getSortingElements()}
      </nav>
    </div>
  );

  const getData = () => {
    if (!isMounting.current && previsouIndex === getCurrentIndex(tab)) {
      fetchTableData();
    }
  };

  useEffect(() => {
    handleSearchText(searchQuery || emptyValue);
    setCurrentPage(1);
  }, [searchQuery]);

  useEffect(() => {
    setFieldList(tabsInfo[getCurrentTab(tab) - 1].sortingFields);
    // if search text is there then set sortfield as ''(Relevance)
    setSortField(searchText ? '' : tabsInfo[getCurrentTab(tab) - 1].sortField);
    setSortOrder(INITIAL_SORT_ORDER);
    setCurrentTab(getCurrentTab(tab));
    setSearchIndex(getCurrentIndex(tab));
    setCurrentPage(1);
    setAdvancedSearchState({
      config: getQbConfigs(getCurrentIndex(tab)),
      tree: emptyImmutableTree,
    });
    if (!isMounting.current) {
      fetchCount();
      handleFilterChange(filterObject);
    }
  }, [tab]);

  useEffect(() => {
    setFilters({
      ...filterObject,
      ...initialFilter,
      ...searchFilter,
    });
  }, [initialFilter, searchFilter]);

  useEffect(() => {
    if (getFilterString(filters)) {
      setCurrentPage(1);
    }
  }, [searchText, filters]);

  useEffect(() => {
    forceSetAgg.current = true;
    if (!isMounting.current) {
      fetchTableData();
    }
  }, [searchText, searchIndex, showDeleted]);

  useEffect(() => {
    if (searchResult) {
      if (searchResult.hits.total.value > 0) {
        setTotalNumberOfValues(searchResult.hits.total.value);
      } else {
        setTotalNumberOfValues(0);
      }

      setCount(searchResult.hits.total.value);

      setIsEntityLoading(false);
    }
  }, [searchResult]);

  useEffect(() => {
    getData();
  }, [currentPage, sortField, sortOrder, advancedSearchState]);

  useEffect(() => {
    if (currentPage === 1) {
      getData();
    } else {
      setCurrentPage(1);
    }
  }, [filters]);

  /**
   * if search query is there then make sortfield as empty (Relevance)
   * otherwise change it to INITIAL_SORT_FIELD (last_updated)
   */
  useEffect(() => {
    if (searchText) {
      setSortField('');
    } else {
      setSortField(INITIAL_SORT_FIELD);
    }
  }, [searchText]);

  // alwyas Keep this useEffect at the end...
  useEffect(() => {
    isMounting.current = false;
  }, []);

  const fetchLeftPanel = () => {
    return (
      <div className="tw-h-full">
        <Card
          data-testid="data-summary-container"
          style={{ ...leftPanelAntCardStyle, marginTop: '16px' }}>
          <Fragment>
            <div className="tw-filter-seperator" />
            <FacetFilter
              aggregations={searchResult?.aggregations ?? {}}
              filters={getFacetedFilter()}
              showDeletedOnly={showDeleted}
              onSelectDeleted={handleShowDeleted}
              onSelectHandler={handleSelectedFilter}
            />
          </Fragment>
        </Card>
      </div>
    );
  };

  return (
    <Fragment>
      <PageLayout leftPanel={fetchLeftPanel()}>
        {getTabs()}
        <AdvancedSearch
          config={advancedSearchState.config}
          tree={advancedSearchState.tree}
          onChange={(tree, config) => setAdvancedSearchState({ tree, config })}
        />
        <p>
          <pre>{JSON.stringify(elasticsearchFilter, null, 2)}</pre>
        </p>
        {/* <code> */}
        {/*   <pre>{JSON.stringify(advancedSearchState.tree, null, 2)}</pre> */}
        {/* </code> */}
        <SearchedData
          showResultCount
          currentPage={currentPage}
          data={searchResult?.hits.hits ?? []}
          isFilterSelected={isFilterSelected}
          isLoading={
            !location.pathname.includes(ROUTES.TOUR) && isEntityLoading
          }
          paginate={paginate}
          searchText={searchText}
          totalValue={totalNumberOfValue}
        />
      </PageLayout>
    </Fragment>
  );
};

export default Explore;
