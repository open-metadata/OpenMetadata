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

import { AxiosError } from 'axios';
import classNames from 'classnames';
import { cloneDeep } from 'lodash';
import {
  AggregationType,
  Bucket,
  FilterObject,
  FormatedTableData,
  SearchResponse,
} from 'Models';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import AppState from '../../AppState';
import { searchData } from '../../axiosAPIs/miscAPI';
import { Button } from '../../components/buttons/Button/Button';
import ErrorPlaceHolderES from '../../components/common/error-with-placeholder/ErrorPlaceHolderES';
import FacetFilter from '../../components/common/facetfilter/FacetFilter';
import PageContainer from '../../components/containers/PageContainer';
import DropDownList from '../../components/dropdown/DropDownList';
import SearchedData from '../../components/searched-data/SearchedData';
import {
  ERROR500,
  getExplorePathWithSearch,
  PAGE_SIZE,
  tableSortingFields,
  visibleFilters,
} from '../../constants/constants';
import { SearchIndex } from '../../enums/search.enum';
import { usePrevious } from '../../hooks/usePrevious';
import useToastContext from '../../hooks/useToastContext';
import { getAggregationList } from '../../utils/AggregationUtils';
import { formatDataResponse } from '../../utils/APIUtils';
import { getCountBadge } from '../../utils/CommonUtils';
import { getFilterString } from '../../utils/FilterUtils';
import { getTotalEntityCountByService } from '../../utils/ServiceUtils';
import { dropdownIcon as DropDownIcon } from '../../utils/svgconstant';
import SVGIcons from '../../utils/SvgUtils';
import { getAggrWithDefaultValue, tabsInfo } from './explore.constants';
import { Params } from './explore.interface';

const getQueryParam = (urlSearchQuery = ''): FilterObject => {
  const arrSearchQuery = urlSearchQuery
    ? urlSearchQuery.startsWith('?')
      ? urlSearchQuery.substr(1).split('&')
      : urlSearchQuery.split('&')
    : [];

  return arrSearchQuery
    .map((filter) => {
      const arrFilter = filter.split('=');

      return { [arrFilter[0]]: [arrFilter[1]] };
    })
    .reduce((prev, curr) => {
      return Object.assign(prev, curr);
    }, {}) as FilterObject;
};

const getCurrentTab = (tab: string) => {
  let currentTab = 1;
  switch (tab) {
    case 'topics':
      currentTab = 2;

      break;
    case 'dashboards':
      currentTab = 3;

      break;
    case 'pipelines':
      currentTab = 4;

      break;

    case 'tables':
    default:
      currentTab = 1;

      break;
  }

  return currentTab;
};

const getCurrentIndex = (tab: string) => {
  let currentIndex = SearchIndex.TABLE;
  switch (tab) {
    case 'topics':
      currentIndex = SearchIndex.TOPIC;

      break;
    case 'dashboards':
      currentIndex = SearchIndex.DASHBOARD;

      break;
    case 'pipelines':
      currentIndex = SearchIndex.PIPELINE;

      break;

    case 'tables':
    default:
      currentIndex = SearchIndex.TABLE;

      break;
  }

  return currentIndex;
};

const ExplorePage: React.FC = (): React.ReactElement => {
  const location = useLocation();
  const history = useHistory();
  const filterObject: FilterObject = {
    ...{ tags: [], service: [], tier: [] },
    ...getQueryParam(location.search),
  };
  const showToast = useToastContext();
  const { searchQuery, tab } = useParams<Params>();
  const [searchText, setSearchText] = useState<string>(searchQuery || '');
  const [data, setData] = useState<Array<FormatedTableData>>([]);
  const [filters, setFilters] = useState<FilterObject>(filterObject);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalNumberOfValue, setTotalNumberOfValues] = useState<number>(0);
  const [aggregations, setAggregations] = useState<Array<AggregationType>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTag, setSearchTag] = useState<string>(location.search);
  const [error, setError] = useState<string>('');
  const [fieldListVisible, setFieldListVisible] = useState<boolean>(false);
  const [sortField, setSortField] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<string>('desc');
  const [searchIndex, setSearchIndex] = useState<string>(getCurrentIndex(tab));
  const [currentTab, setCurrentTab] = useState<number>(getCurrentTab(tab));
  const [tableCount, setTableCount] = useState<number>(0);
  const [topicCount, setTopicCount] = useState<number>(0);
  const [dashboardCount, setDashboardCount] = useState<number>(0);
  const [pipelineCount, setPipelineCount] = useState<number>(0);
  const [fieldList, setFieldList] =
    useState<Array<{ name: string; value: string }>>(tableSortingFields);
  const isMounting = useRef(true);
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

  const setCount = (count = 0) => {
    switch (searchIndex) {
      case SearchIndex.TABLE:
        setTableCount(count);

        break;
      case SearchIndex.DASHBOARD:
        setDashboardCount(count);

        break;
      case SearchIndex.TOPIC:
        setTopicCount(count);

        break;
      case SearchIndex.PIPELINE:
        setPipelineCount(count);

        break;
      default:
        break;
    }
  };

  const fetchCounts = () => {
    const emptyValue = '';
    const tableCount = searchData(
      searchText,
      0,
      0,
      emptyValue,
      emptyValue,
      emptyValue,
      SearchIndex.TABLE
    );
    const topicCount = searchData(
      searchText,
      0,
      0,
      emptyValue,
      emptyValue,
      emptyValue,
      SearchIndex.TOPIC
    );
    const dashboardCount = searchData(
      searchText,
      0,
      0,
      emptyValue,
      emptyValue,
      emptyValue,
      SearchIndex.DASHBOARD
    );
    const pipelineCount = searchData(
      searchText,
      0,
      0,
      emptyValue,
      emptyValue,
      emptyValue,
      SearchIndex.PIPELINE
    );
    Promise.allSettled([
      tableCount,
      topicCount,
      dashboardCount,
      pipelineCount,
    ]).then(
      ([
        table,
        topic,
        dashboard,
        pipeline,
      ]: PromiseSettledResult<SearchResponse>[]) => {
        setTableCount(
          table.status === 'fulfilled'
            ? getTotalEntityCountByService(
                table.value.data.aggregations?.['sterms#Service']
                  ?.buckets as Bucket[]
              )
            : 0
        );
        setTopicCount(
          topic.status === 'fulfilled'
            ? getTotalEntityCountByService(
                topic.value.data.aggregations?.['sterms#Service']
                  ?.buckets as Bucket[]
              )
            : 0
        );
        setDashboardCount(
          dashboard.status === 'fulfilled'
            ? getTotalEntityCountByService(
                dashboard.value.data.aggregations?.['sterms#Service']
                  ?.buckets as Bucket[]
              )
            : 0
        );
        setPipelineCount(
          pipeline.status === 'fulfilled'
            ? getTotalEntityCountByService(
                pipeline.value.data.aggregations?.['sterms#Service']
                  ?.buckets as Bucket[]
              )
            : 0
        );
      }
    );
  };

  const fetchTableData = (forceSetAgg: boolean) => {
    setIsLoading(true);

    const searchResults = searchData(
      searchText,
      currentPage,
      PAGE_SIZE,
      getFilterString(filters),
      sortField,
      sortOrder,
      searchIndex
    );
    const serviceTypeAgg = searchData(
      searchText,
      currentPage,
      0,
      getFilterString(filters, ['service']),
      sortField,
      sortOrder,
      searchIndex
    );
    const tierAgg = searchData(
      searchText,
      currentPage,
      0,
      getFilterString(filters, ['tier']),
      sortField,
      sortOrder,
      searchIndex
    );
    const tagAgg = searchData(
      searchText,
      currentPage,
      0,
      getFilterString(filters, ['tags']),
      sortField,
      sortOrder,
      searchIndex
    );

    Promise.all([searchResults, serviceTypeAgg, tierAgg, tagAgg])
      .then(
        ([
          resSearchResults,
          resAggServiceType,
          resAggTier,
          resAggTag,
        ]: Array<SearchResponse>) => {
          updateSearchResults(resSearchResults);
          setCount(resSearchResults.data.hits.total.value);
          if (forceSetAgg) {
            setAggregations(
              resSearchResults.data.hits.hits.length > 0
                ? getAggregationList(resSearchResults.data.aggregations)
                : []
            );
          } else {
            const aggServiceType = getAggregationList(
              resAggServiceType.data.aggregations,
              'service'
            );
            const aggTier = getAggregationList(
              resAggTier.data.aggregations,
              'tier'
            );
            const aggTag = getAggregationList(
              resAggTag.data.aggregations,
              'tags'
            );

            updateAggregationCount([...aggServiceType, ...aggTier, ...aggTag]);
          }
          setIsLoading(false);
        }
      )
      .catch((err: AxiosError) => {
        setError(err.response?.data?.responseMessage);
        showToast({
          variant: 'error',
          body: err.response?.data?.responseMessage ?? ERROR500,
        });

        setIsLoading(false);
      });
  };

  const getFacetedFilter = () => {
    const facetFilters: FilterObject = filterObject;
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
    setSortField(value || '');
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
        return getCountBadge(tableCount);
      case SearchIndex.TOPIC:
        return getCountBadge(topicCount);
      case SearchIndex.DASHBOARD:
        return getCountBadge(dashboardCount);
      case SearchIndex.PIPELINE:
        return getCountBadge(pipelineCount);
      default:
        return getCountBadge();
    }
  };
  const onTabChange = (selectedTab: number) => {
    if (tabsInfo[selectedTab - 1].path !== tab) {
      AppState.explorePageTab = tabsInfo[selectedTab - 1].path;
      resetFilters();
      history.push({
        pathname: getExplorePathWithSearch(
          searchQuery,
          tabsInfo[selectedTab - 1].path
        ),
      });
    }
  };
  const getTabs = () => {
    return (
      <div className="tw-mb-3 tw--mt-4">
        <nav className="tw-flex tw-flex-row tw-gh-tabs-container tw-px-4 tw-justify-between">
          <div>
            {tabsInfo.map((tab, index) => (
              <button
                className={`tw-pb-2 tw-px-4 tw-gh-tabs ${getActiveTabClass(
                  tab.tab
                )}`}
                data-testid="tab"
                key={index}
                onClick={() => {
                  onTabChange(tab.tab);
                }}>
                <SVGIcons
                  alt="icon"
                  className="tw-h-4 tw-w-4 tw-mr-2"
                  icon={tab.icon}
                />
                {tab.label}
                {getTabCount(tab.index)}
              </button>
            ))}
          </div>
          {getSortingElements()}
        </nav>
      </div>
    );
  };

  useEffect(() => {
    setSearchText(searchQuery || '');
    setCurrentPage(1);
  }, [searchQuery]);

  useEffect(() => {
    setFilters(filterObject);
    setFieldList(tabsInfo[getCurrentTab(tab) - 1].sortingFields);
    setSortField(tabsInfo[getCurrentTab(tab) - 1].sortField);
    setSortOrder('desc');
    setError('');
    setCurrentTab(getCurrentTab(tab));
    setSearchIndex(getCurrentIndex(tab));
    setCurrentPage(1);
  }, [tab]);

  useEffect(() => {
    if (getFilterString(filters)) {
      setCurrentPage(1);
    }
  }, [searchText, filters]);

  useEffect(() => {
    fetchTableData(true);
  }, [searchText, searchIndex]);

  useEffect(() => {
    if (!isMounting.current && previsouIndex === getCurrentIndex(tab)) {
      fetchTableData(false);
    }
  }, [currentPage, filters, sortField, sortOrder]);

  useEffect(() => {
    fetchCounts();
  }, [searchText]);

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
    <PageContainer leftPanelContent={fetchLeftPanel()}>
      <div className="container-fluid" data-testid="fluid-container">
        {getTabs()}
        {error ? (
          <ErrorPlaceHolderES errorMessage={error} type="error" />
        ) : (
          <SearchedData
            showResultCount
            currentPage={currentPage}
            data={data}
            isLoading={isLoading}
            paginate={paginate}
            searchText={searchText}
            totalValue={totalNumberOfValue}
          />
        )}
      </div>
    </PageContainer>
  );
};

export default ExplorePage;
