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
import { cloneDeep } from 'lodash';
import {
  AggregationType,
  FilterObject,
  FormatedTableData,
  SearchResponse,
} from 'Models';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { searchData } from '../../axiosAPIs/miscAPI';
import { Button } from '../../components/buttons/Button/Button';
import Error from '../../components/common/error/Error';
import FacetFilter from '../../components/common/facetfilter/FacetFilter';
import DropDownList from '../../components/dropdown/DropDownList';
import SearchedData from '../../components/searched-data/SearchedData';
import {
  ERROR404,
  ERROR500,
  PAGE_SIZE,
  sortingFields,
  sortingOrder,
} from '../../constants/constants';
import useToastContext from '../../hooks/useToastContext';
import { getAggregationList } from '../../utils/AggregationUtils';
import { formatDataResponse } from '../../utils/APIUtils';
import { getFilterString } from '../../utils/FilterUtils';
import { dropdownIcon as DropDownIcon } from '../../utils/svgconstant';
import { getAggrWithDefaultValue } from './explore.constants';
import { Params } from './explore.interface';

const visibleFilters = ['tags', 'service type', 'tier'];

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

const ExplorePage: React.FC = (): React.ReactElement => {
  const location = useLocation();

  const filterObject: FilterObject = {
    ...{ tags: [], 'service type': [], tier: [] },
    ...getQueryParam(location.search),
  };
  const showToast = useToastContext();
  const { searchQuery } = useParams<Params>();
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
  const [orderListVisible, setOrderListVisible] = useState<boolean>(false);
  const [sortField, setSortField] = useState<string>(sortingFields[3].value);
  const [sortOrder, setSortOrder] = useState<string>(sortingOrder[1].value);
  const isMounting = useRef(true);

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

  const fetchTableData = (forceSetAgg: boolean) => {
    setIsLoading(true);

    const searchResults = searchData(
      searchText,
      currentPage,
      PAGE_SIZE,
      getFilterString(filters),
      sortField,
      sortOrder
    );
    const serviceTypeAgg = searchData(
      searchText,
      currentPage,
      0,
      getFilterString(filters, ['service type']),
      sortField,
      sortOrder
    );
    const tierAgg = searchData(
      searchText,
      currentPage,
      0,
      getFilterString(filters, ['tier']),
      sortField,
      sortOrder
    );
    const tagAgg = searchData(
      searchText,
      currentPage,
      0,
      getFilterString(filters, ['tags']),
      sortField,
      sortOrder
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
          if (forceSetAgg) {
            setAggregations(
              resSearchResults.data.hits.hits.length > 0
                ? getAggregationList(resSearchResults.data.aggregations)
                : []
            );
          } else {
            const aggServiceType = getAggregationList(
              resAggServiceType.data.aggregations,
              'service type'
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
        setError(ERROR404);
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
    setSortField(value || sortingFields[3].value);
    setFieldListVisible(false);
  };
  const handleOrderDropDown = (
    _e: React.MouseEvent<HTMLElement, MouseEvent>,
    value?: string
  ) => {
    setSortOrder(value || sortingOrder[1].value);
    setOrderListVisible(false);
  };

  const getSortingElements = () => {
    return (
      <div className="tw-flex tw-justify-between">
        <div />
        <div className="tw-flex tw-gap-2">
          <div className="tw-mt-2 tw-mb-4">
            <span className="tw-mr-2">Sort by :</span>
            <span className="tw-relative">
              <Button
                className="tw-underline"
                size="custom"
                theme="primary"
                variant="link"
                onClick={() => setFieldListVisible((visible) => !visible)}>
                {sortingFields.find((field) => field.value === sortField)?.name}
                <DropDownIcon />
              </Button>
              {fieldListVisible && (
                <DropDownList
                  dropDownList={sortingFields}
                  value={sortField}
                  onSelect={handleFieldDropDown}
                />
              )}
            </span>
          </div>
          <div className="tw-mt-2 tw-mb-4">
            <span className="tw-mr-2">Order by :</span>
            <span className="tw-relative">
              <Button
                className="tw-underline"
                size="custom"
                theme="primary"
                variant="link"
                onClick={() => setOrderListVisible((visible) => !visible)}>
                {sortingOrder.find((order) => order.value === sortOrder)?.name}
                <DropDownIcon />
              </Button>
              {orderListVisible && (
                <DropDownList
                  dropDownList={sortingOrder}
                  value={sortOrder}
                  onSelect={handleOrderDropDown}
                />
              )}
            </span>
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    setSearchText(searchQuery || '');
    setCurrentPage(1);
    setFilters(filterObject);
  }, [searchQuery]);
  useEffect(() => {
    if (getFilterString(filters)) {
      setCurrentPage(1);
    }
  }, [searchText, filters]);

  useEffect(() => {
    fetchTableData(true);
  }, [searchText, sortField, sortOrder]);

  useEffect(() => {
    if (!isMounting.current) {
      fetchTableData(false);
    }
  }, [currentPage, filters]);

  // alwyas Keep this useEffect at the end...
  useEffect(() => {
    isMounting.current = false;
  }, []);

  const fetchLeftPanel = () => {
    return (
      <FacetFilter
        aggregations={getAggrWithDefaultValue(aggregations, visibleFilters)}
        filters={getFacetedFilter()}
        onClearFilter={(value) => onClearFilterHandler(value)}
        onSelectHandler={handleSelectedFilter}
      />
    );
  };

  return (
    <>
      {error ? (
        <Error error={error} />
      ) : (
        <SearchedData
          showResultCount
          currentPage={currentPage}
          data={data}
          fetchLeftPanel={fetchLeftPanel}
          isLoading={isLoading}
          paginate={paginate}
          searchText={searchText}
          totalValue={totalNumberOfValue}>
          {getSortingElements()}
        </SearchedData>
      )}
    </>
  );
};

export default ExplorePage;
