/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import classNames from 'classnames';
import { cloneDeep, isUndefined } from 'lodash';
import {
  AggregationType,
  FilterObject,
  FormatedTableData,
  SearchResponse,
} from 'Models';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { Button } from '../../components/buttons/Button/Button';
import ErrorPlaceHolderES from '../../components/common/error-with-placeholder/ErrorPlaceHolderES';
import FacetFilter from '../../components/common/facetfilter/FacetFilter';
import PageContainer from '../../components/containers/PageContainer';
import DropDownList from '../../components/dropdown/DropDownList';
import SearchedData from '../../components/searched-data/SearchedData';
import {
  getExplorePathWithSearch,
  PAGE_SIZE,
  tableSortingFields,
  visibleFilters,
} from '../../constants/constants';
import {
  emptyValue,
  getAggrWithDefaultValue,
  getCurrentIndex,
  getCurrentTab,
  getQueryParam,
  INITIAL_SORT_FIELD,
  INITIAL_SORT_ORDER,
  tabsInfo,
  ZERO_SIZE,
} from '../../constants/explore.constants';
import { SearchIndex } from '../../enums/search.enum';
import { usePrevious } from '../../hooks/usePrevious';
import { getAggregationList } from '../../utils/AggregationUtils';
import { formatDataResponse } from '../../utils/APIUtils';
import { getCountBadge } from '../../utils/CommonUtils';
import { getFilterString } from '../../utils/FilterUtils';
import { dropdownIcon as DropDownIcon } from '../../utils/svgconstant';
import SVGIcons from '../../utils/SvgUtils';
import { ExploreProps } from './explore.interface';

const Explore: React.FC<ExploreProps> = ({
  tabCounts,
  searchText,
  tab,
  searchQuery,
  searchResult,
  sortValue,
  error,
  fetchCount,
  handlePathChange,
  handleSearchText,
  fetchData,
  updateTableCount,
  updateTopicCount,
  updateDashboardCount,
  updatePipelineCount,
}: ExploreProps) => {
  const location = useLocation();
  const history = useHistory();
  const filterObject: FilterObject = {
    ...{ tags: [], service: [], tier: [] },
    ...getQueryParam(location.search),
  };
  const [data, setData] = useState<Array<FormatedTableData>>([]);
  const [filters, setFilters] = useState<FilterObject>(filterObject);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalNumberOfValue, setTotalNumberOfValues] = useState<number>(0);
  const [aggregations, setAggregations] = useState<Array<AggregationType>>([]);
  const [searchTag, setSearchTag] = useState<string>(location.search);

  const [fieldListVisible, setFieldListVisible] = useState<boolean>(false);
  const [sortField, setSortField] = useState<string>(sortValue);
  const [sortOrder, setSortOrder] = useState<string>(INITIAL_SORT_ORDER);
  const [searchIndex, setSearchIndex] = useState<string>(getCurrentIndex(tab));
  const [currentTab, setCurrentTab] = useState<number>(getCurrentTab(tab));
  const [fieldList, setFieldList] =
    useState<Array<{ name: string; value: string }>>(tableSortingFields);
  const [isEntityLoading, setIsEntityLoading] = useState(true);
  const [connectionError] = useState(error.includes('Connection refused'));
  const isMounting = useRef(true);
  const forceSetAgg = useRef(false);
  const previsouIndex = usePrevious(searchIndex);

  const handleSelectedFilter = (
    checked: boolean,
    selectedFilter: string,
    type: keyof typeof filterObject
  ) => {
    if (checked) {
      setFilters((prevState) => {
        const filterType = prevState[type];
        if (filterType.includes(selectedFilter)) {
          return { ...prevState };
        }

        return {
          ...prevState,
          [type]: [...prevState[type], selectedFilter],
        };
      });
    } else {
      if (searchTag.includes(selectedFilter)) {
        setSearchTag('');
      }
      const filter = filters[type];
      const index = filter.indexOf(selectedFilter);
      filter.splice(index, 1);
      setFilters((prevState) => ({ ...prevState, [type]: filter }));
    }
  };

  const onClearFilterHandler = (type: keyof FilterObject) => {
    setFilters((prevFilters) => {
      return {
        ...prevFilters,
        ...getQueryParam(location.search),
        [type]: [],
      };
    });
  };

  const paginate = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  const updateAggregationCount = useCallback(
    (newAggregations: Array<AggregationType>) => {
      const oldAggs = cloneDeep(aggregations);
      for (const newAgg of newAggregations) {
        for (const oldAgg of oldAggs) {
          if (newAgg.title === oldAgg.title) {
            for (const oldBucket of oldAgg.buckets) {
              let docCount = 0;
              for (const newBucket of newAgg.buckets) {
                if (newBucket.key === oldBucket.key) {
                  docCount = newBucket.doc_count;

                  break;
                }
              }
              // eslint-disable-next-line @typescript-eslint/camelcase
              oldBucket.doc_count = docCount;
            }
          }
        }
      }
      setAggregations(oldAggs);
    },
    [aggregations, filters]
  );

  const updateSearchResults = (res: SearchResponse) => {
    const hits = res.data.hits.hits;
    if (hits.length > 0) {
      setTotalNumberOfValues(res.data.hits.total.value);
      setData(formatDataResponse(hits));
    } else {
      setData([]);
      setTotalNumberOfValues(0);
    }
  };

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
      default:
        break;
    }
  };

  const fetchTableData = () => {
    setIsEntityLoading(true);
    const fetchParams = [
      {
        queryString: searchText,
        from: currentPage,
        size: PAGE_SIZE,
        filters: getFilterString(filters),
        sortField: sortField,
        sortOrder: sortOrder,
        searchIndex: searchIndex,
      },
      {
        queryString: searchText,
        from: currentPage,
        size: ZERO_SIZE,
        filters: getFilterString(filters, ['service']),
        sortField: sortField,
        sortOrder: sortOrder,
        searchIndex: searchIndex,
      },
      {
        queryString: searchText,
        from: currentPage,
        size: ZERO_SIZE,
        filters: getFilterString(filters, ['tier']),
        sortField: sortField,
        sortOrder: sortOrder,
        searchIndex: searchIndex,
      },
      {
        queryString: searchText,
        from: currentPage,
        size: ZERO_SIZE,
        filters: getFilterString(filters, ['tags']),
        sortField: sortField,
        sortOrder: sortOrder,
        searchIndex: searchIndex,
      },
    ];

    fetchData(fetchParams);
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

  const handleFieldDropDown = (
    _e: React.MouseEvent<HTMLElement, MouseEvent>,
    value?: string
  ) => {
    setSortField(value || sortField);
    setFieldListVisible(false);
  };
  const handleOrder = (value: string) => {
    setSortOrder(value);
  };

  const getSortingElements = () => {
    return (
      <div className="tw-flex tw-gap-2">
        <div className="tw-mt-4">
          <span className="tw-mr-2">Sort by :</span>
          <span className="tw-relative">
            <Button
              className="tw-underline"
              data-testid="sortBy"
              size="custom"
              theme="primary"
              variant="link"
              onClick={() => setFieldListVisible((visible) => !visible)}>
              {fieldList.find((field) => field.value === sortField)?.name ||
                'Relevance'}
              <DropDownIcon />
            </Button>
            {fieldListVisible && (
              <DropDownList
                dropDownList={fieldList}
                value={sortField}
                onSelect={handleFieldDropDown}
              />
            )}
          </span>
        </div>
        <div className="tw-mt-2 tw-flex tw-gap-2">
          {sortOrder === 'asc' ? (
            <button onClick={() => handleOrder('desc')}>
              <i
                className={classNames(
                  'fas fa-sort-amount-down-alt tw-text-base tw-text-primary'
                )}
              />
            </button>
          ) : (
            <button onClick={() => handleOrder('asc')}>
              <i
                className={classNames(
                  'fas fa-sort-amount-up-alt tw-text-base tw-text-primary'
                )}
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

  const resetFilters = () => {
    visibleFilters.forEach((type) => {
      onClearFilterHandler(type);
    });
  };

  const getTabCount = (index: string) => {
    switch (index) {
      case SearchIndex.TABLE:
        return getCountBadge(tabCounts.table);
      case SearchIndex.TOPIC:
        return getCountBadge(tabCounts.topic);
      case SearchIndex.DASHBOARD:
        return getCountBadge(tabCounts.dashboard);
      case SearchIndex.PIPELINE:
        return getCountBadge(tabCounts.pipeline);
      default:
        return getCountBadge();
    }
  };
  const onTabChange = (selectedTab: number) => {
    if (tabsInfo[selectedTab - 1].path !== tab) {
      handlePathChange(tabsInfo[selectedTab - 1].path);
      resetFilters();
      history.push({
        pathname: getExplorePathWithSearch(
          searchQuery,
          tabsInfo[selectedTab - 1].path
        ),
        search: location.search,
      });
    }
  };
  const getTabs = () => {
    return (
      <div className="tw-mb-3 tw--mt-4">
        <nav className="tw-flex tw-flex-row tw-gh-tabs-container tw-px-4 tw-justify-between">
          <div>
            {tabsInfo.map((tabDetail, index) => (
              <button
                className={`tw-pb-2 tw-px-4 tw-gh-tabs ${getActiveTabClass(
                  tabDetail.tab
                )}`}
                data-testid="tab"
                key={index}
                onClick={() => {
                  onTabChange(tabDetail.tab);
                }}>
                <SVGIcons
                  alt="icon"
                  className="tw-h-4 tw-w-4 tw-mr-2"
                  icon={tabDetail.icon}
                />
                {tabDetail.label}
                {getTabCount(tabDetail.index)}
              </button>
            ))}
          </div>
          {getSortingElements()}
        </nav>
      </div>
    );
  };

  useEffect(() => {
    handleSearchText(searchQuery || emptyValue);
    setCurrentPage(1);
  }, [searchQuery]);

  useEffect(() => {
    setFilters(filterObject);
    setFieldList(tabsInfo[getCurrentTab(tab) - 1].sortingFields);
    setSortField(
      searchQuery
        ? tabsInfo[getCurrentTab(tab) - 1].sortField
        : INITIAL_SORT_FIELD
    );
    setSortOrder(INITIAL_SORT_ORDER);
    setCurrentTab(getCurrentTab(tab));
    setSearchIndex(getCurrentIndex(tab));
    setCurrentPage(1);
    if (!isMounting.current) {
      fetchCount();
    }
  }, [tab]);

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
  }, [searchText, searchIndex]);

  useEffect(() => {
    if (searchResult) {
      updateSearchResults(searchResult.resSearchResults);
      setCount(searchResult.resSearchResults.data.hits.total.value);
      if (forceSetAgg.current) {
        setAggregations(
          searchResult.resSearchResults.data.hits.hits.length > 0
            ? getAggregationList(
                searchResult.resSearchResults.data.aggregations
              )
            : []
        );
      } else {
        const aggServiceType = getAggregationList(
          searchResult.resAggServiceType.data.aggregations,
          'service'
        );
        const aggTier = getAggregationList(
          searchResult.resAggTier.data.aggregations,
          'tier'
        );
        const aggTag = getAggregationList(
          searchResult.resAggTag.data.aggregations,
          'tags'
        );

        updateAggregationCount([...aggServiceType, ...aggTier, ...aggTag]);
      }
      setIsEntityLoading(false);
    }
  }, [searchResult]);

  useEffect(() => {
    if (!isMounting.current && previsouIndex === getCurrentIndex(tab)) {
      forceSetAgg.current = isUndefined(tab);
      fetchTableData();
    }
  }, [currentPage, filters, sortField, sortOrder]);

  // alwyas Keep this useEffect at the end...
  useEffect(() => {
    isMounting.current = false;
  }, []);

  const fetchLeftPanel = () => {
    return (
      <>
        {!error && (
          <FacetFilter
            aggregations={getAggrWithDefaultValue(aggregations, visibleFilters)}
            filters={getFacetedFilter()}
            onClearFilter={(value) => onClearFilterHandler(value)}
            onSelectHandler={handleSelectedFilter}
          />
        )}
      </>
    );
  };

  return (
    <PageContainer leftPanelContent={Boolean(!error) && fetchLeftPanel()}>
      <div className="container-fluid" data-testid="fluid-container">
        {!connectionError && getTabs()}
        {error ? (
          <ErrorPlaceHolderES errorMessage={error} type="error" />
        ) : (
          <SearchedData
            showResultCount
            currentPage={currentPage}
            data={data}
            isLoading={isEntityLoading}
            paginate={paginate}
            searchText={searchText}
            totalValue={totalNumberOfValue}
          />
        )}
      </div>
    </PageContainer>
  );
};

export default Explore;
