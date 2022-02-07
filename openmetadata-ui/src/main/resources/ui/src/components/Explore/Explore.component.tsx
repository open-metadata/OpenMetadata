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

import classNames from 'classnames';
import { cloneDeep, isEmpty } from 'lodash';
import {
  AggregationType,
  Bucket,
  FilterObject,
  FormatedTableData,
  SearchResponse,
} from 'Models';
import React, {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { Button } from '../../components/buttons/Button/Button';
import ErrorPlaceHolderES from '../../components/common/error-with-placeholder/ErrorPlaceHolderES';
import FacetFilter from '../../components/common/facetfilter/FacetFilter';
import DropDownList from '../../components/dropdown/DropDownList';
import SearchedData from '../../components/searched-data/SearchedData';
import {
  getExplorePathWithSearch,
  PAGE_SIZE,
  ROUTES,
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
import {
  getAggregationList,
  getAggregationListFromQS,
} from '../../utils/AggregationUtils';
import { formatDataResponse } from '../../utils/APIUtils';
import { getCountBadge } from '../../utils/CommonUtils';
import { getFilterCount, getFilterString } from '../../utils/FilterUtils';
import { dropdownIcon as DropDownIcon } from '../../utils/svgconstant';
import PageLayout from '../containers/PageLayout';
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
  showDeleted,
  onShowDeleted,
  updateTableCount,
  updateTopicCount,
  updateDashboardCount,
  updatePipelineCount,
}: ExploreProps) => {
  const location = useLocation();
  const history = useHistory();
  const filterObject: FilterObject = {
    ...{ tags: [], service: [], tier: [], database: [] },
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
  const [isFilterSet, setIsFilterSet] = useState<boolean>(
    !isEmpty(getQueryParam(location.search))
  );
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
        setIsFilterSet(true);

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
      setFilters((prevState) => {
        const selectedFilterCount = getFilterCount(prevState);
        setIsFilterSet(selectedFilterCount >= 1);

        return { ...prevState, [type]: filter };
      });
    }
  };

  const handleShowDeleted = (checked: boolean) => {
    onShowDeleted(checked);
  };

  const onClearFilterHandler = (type: string[], isForceClear = false) => {
    setFilters((prevFilters) => {
      const updatedFilter = type.reduce((filterObj, type) => {
        return { ...filterObj, [type]: [] };
      }, {});
      const queryParamFilters = getQueryParam(location.search);
      setIsFilterSet(false);

      return {
        ...prevFilters,
        ...updatedFilter,
        ...(isForceClear ? {} : queryParamFilters),
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
            const buckets = cloneDeep(oldAgg.buckets)
              .map((item) => {
                // eslint-disable-next-line @typescript-eslint/camelcase
                return { ...item, doc_count: 0 };
              })
              .concat(newAgg.buckets);
            const bucketHashmap = buckets.reduce((obj, item) => {
              obj[item.key]
                ? // eslint-disable-next-line @typescript-eslint/camelcase
                  (obj[item.key].doc_count += item.doc_count)
                : (obj[item.key] = { ...item });

              return obj;
            }, {} as { [key: string]: Bucket });
            oldAgg.buckets = Object.values(bucketHashmap);
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
      {
        queryString: searchText,
        from: currentPage,
        size: ZERO_SIZE,
        filters: getFilterString(filters, ['database']),
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
          <span className="tw-mr-2">Sort by:</span>
          <span className="tw-relative">
            <Button
              className="hover:tw-no-underline focus:tw-no-underline"
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
                data-testid="last-updated"
              />
            </button>
          ) : (
            <button onClick={() => handleOrder('asc')}>
              <i
                className={classNames(
                  'fas fa-sort-amount-up-alt tw-text-base tw-text-primary'
                )}
                data-testid="last-updated"
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

  const resetFilters = (isForceReset = false) => {
    onClearFilterHandler(visibleFilters, isForceReset);
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
      <div className="tw-mb-5 tw-px-6 centered-layout">
        <nav
          className={classNames(
            'tw-flex tw-flex-row tw-justify-between tw-gh-tabs-container'
          )}>
          <div className="tw-flex">
            <div className="tw-w-64 tw-mr-5 tw-flex-shrink-0">
              <Button
                className={classNames('tw-underline tw-mt-5', {
                  'tw-invisible': !getFilterCount(filters),
                })}
                size="custom"
                theme="primary"
                variant="link"
                onClick={() => resetFilters(true)}>
                Clear All
              </Button>
            </div>
            <div>
              {tabsInfo.map((tabDetail, index) => (
                <button
                  className={`tw-pb-2 tw-pr-6 tw-gh-tabs ${getActiveTabClass(
                    tabDetail.tab
                  )}`}
                  data-testid="tab"
                  key={index}
                  onClick={() => {
                    onTabChange(tabDetail.tab);
                  }}>
                  {tabDetail.label}
                  <span className="tw-pl-2">
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
  };

  const getData = () => {
    if (!isMounting.current && previsouIndex === getCurrentIndex(tab)) {
      forceSetAgg.current = !isFilterSet;
      fetchTableData();
    }
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
      resetFilters();
      fetchTableData();
    }
  }, [searchText, searchIndex, showDeleted]);

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
            : getAggregationListFromQS(location.search)
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
        const aggDatabase = getAggregationList(
          searchResult.resAggDatabase.data.aggregations,
          'database'
        );

        updateAggregationCount([
          ...aggServiceType,
          ...aggTier,
          ...aggTag,
          ...aggDatabase,
        ]);
      }
      setIsEntityLoading(false);
    }
  }, [searchResult]);

  useEffect(() => {
    getData();
  }, [currentPage, sortField, sortOrder]);

  useEffect(() => {
    if (currentPage === 1) {
      getData();
    } else {
      setCurrentPage(1);
    }
  }, [filters]);

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
            showDeletedOnly={showDeleted}
            onSelectDeleted={handleShowDeleted}
            onSelectHandler={handleSelectedFilter}
          />
        )}
      </>
    );
  };

  return (
    <Fragment>
      {!connectionError && getTabs()}
      <PageLayout
        leftPanel={Boolean(!error) && fetchLeftPanel()}
        rightPanel={Boolean(!error) && <></>}>
        {error ? (
          <ErrorPlaceHolderES errorMessage={error} type="error" />
        ) : (
          <SearchedData
            showResultCount
            currentPage={currentPage}
            data={data}
            isLoading={
              !location.pathname.includes(ROUTES.TOUR) && isEntityLoading
            }
            paginate={paginate}
            searchText={searchText}
            totalValue={totalNumberOfValue}
          />
        )}
      </PageLayout>
    </Fragment>
  );
};

export default Explore;
