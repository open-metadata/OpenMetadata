import { AxiosError } from 'axios';
import {
  AggregationType,
  FilterObject,
  FormatedTableData,
  SearchResponse,
} from 'Models';
import React, { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { searchData } from '../../axiosAPIs/miscAPI';
import Error from '../../components/common/error/Error';
import FacetFilter from '../../components/common/facetfilter/FacetFilter';
import Loader from '../../components/Loader/Loader';
import SearchedData from '../../components/searched-data/SearchedData';
import { ERROR404, ERROR500, PAGE_SIZE } from '../../constants/constants';
import useToastContext from '../../hooks/useToastContext';
import { getAggregationList } from '../../utils/AggregationUtils';
import { formatDataResponse } from '../../utils/APIUtils';
import { getFilterString } from '../../utils/FilterUtils';
import { getAggrWithDefaultValue } from './explore.constants';
import { Params } from './explore.interface';

const visibleFilters = ['tags', 'service', 'service type', 'tier'];

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
    ...{ tags: [], service: [], 'service type': [], tier: [] },
    ...getQueryParam(location.search),
  };
  const showToast = useToastContext();
  const { searchQuery } = useParams<Params>();
  const [searchText, setSearchText] = useState<string>(searchQuery || '');
  const [data, setData] = useState<Array<FormatedTableData>>([]);
  const [filters, setFilters] = useState<FilterObject>(filterObject);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalNumberOfValue, setTotalNumberOfValues] = useState<number>(0);
  const [aggregations, setAggregation] = useState<Array<AggregationType>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchTag, setSearchTag] = useState<string>(location.search);
  const [error, setError] = useState<string>('');
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
  const paginate = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  const fetchTableData = () => {
    setIsLoading(true);
    searchData(searchText, currentPage, PAGE_SIZE, getFilterString(filters))
      .then((res: SearchResponse) => {
        const hits = res.data.hits.hits;
        if (hits.length > 0) {
          setAggregation(getAggregationList(res.data.aggregations));
          setTotalNumberOfValues(res.data.hits.total.value);
          setData(formatDataResponse(hits));
          setIsLoading(false);
        } else {
          setData([]);
          setAggregation([]);
          setTotalNumberOfValues(0);
          setIsLoading(false);
        }
      })
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
    fetchTableData();
  }, [searchText, currentPage, filters]);

  useEffect(() => {
    if (location.search) {
      setFilters({
        ...filterObject,
        ...getQueryParam(location.search),
      });
    } else {
      setFilters(filterObject);
    }
  }, [location.search]);

  const fetchLeftPanel = () => {
    return (
      <FacetFilter
        aggregations={getAggrWithDefaultValue(aggregations)}
        filters={getFacetedFilter()}
        onSelectHandler={handleSelectedFilter}
      />
    );
  };

  return (
    <>
      {isLoading ? (
        <Loader />
      ) : (
        <>
          {error ? (
            <Error error={error} />
          ) : (
            <SearchedData
              showResultCount
              currentPage={currentPage}
              data={data}
              fetchLeftPanel={fetchLeftPanel}
              paginate={paginate}
              searchText={searchText}
              totalValue={totalNumberOfValue}
            />
          )}
        </>
      )}
    </>
  );
};

export default ExplorePage;
