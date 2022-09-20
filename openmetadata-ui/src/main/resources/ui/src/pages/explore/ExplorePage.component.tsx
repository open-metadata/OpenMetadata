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

import { isEmpty } from 'lodash';
import { Bucket, FilterObject } from 'Models';
import React, { FunctionComponent, useEffect, useMemo, useState } from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import AppState from '../../AppState';
import { searchData } from '../../axiosAPIs/miscAPI';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import Explore from '../../components/Explore/Explore.component';
import {
  TabCounts,
  UrlParams,
} from '../../components/Explore/explore.interface';
import { getExplorePathWithSearch } from '../../constants/constants';
import {
  emptyValue,
  getCurrentTab,
  getEntityTypeByIndex,
  getInitialFilter,
  getQueryParam,
  getSearchFilter,
  INITIAL_TAB_COUNTS,
  tabsInfo,
} from '../../constants/explore.constants';
import { SearchIndex } from '../../enums/search.enum';
import { getTotalEntityCountByType } from '../../utils/EntityUtils';
import { getFilterString, prepareQueryParams } from '../../utils/FilterUtils';

const ExplorePage: FunctionComponent = () => {
  const location = useLocation();
  const history = useHistory();
  const initialFilter = useMemo(
    () => getQueryParam(getInitialFilter(location.search)),
    [location.search]
  );
  const searchFilter = useMemo(
    () => getQueryParam(getSearchFilter(location.search)),
    [location.search]
  );

  const { searchQuery, tab } = useParams<UrlParams>();

  const [searchText, setSearchText] = useState<string>(searchQuery || '');
  const [tabCounts, setTabCounts] = useState<TabCounts>(INITIAL_TAB_COUNTS);
  const [showDeleted, setShowDeleted] = useState(false);
  const [initialSortField] = useState<string>(
    tabsInfo[getCurrentTab(tab) - 1].sortField
  );

  const handleTabCounts = (value: { [key: string]: number }) => {
    setTabCounts((prev) => ({ ...prev, ...value }));
  };

  const handleSearchText = (text: string) => {
    setSearchText(text);
  };

  const handlePathChange = (path: string) => {
    AppState.updateExplorePageTab(path);
  };

  /**
   * on filter change , change the route
   * @param filterData - filter object
   */
  const handleFilterChange = (filterData: FilterObject) => {
    const params = prepareQueryParams(filterData, initialFilter);

    const explorePath = getExplorePathWithSearch(searchQuery, tab);

    history.push({
      pathname: explorePath,
      search: params,
    });
  };

  const fetchEntityCount = async (indexType: SearchIndex) => {
    const entityType = getEntityTypeByIndex(indexType);
    try {
      const { data } = await searchData(
        searchText,
        0,
        0,
        getFilterString(initialFilter),
        emptyValue,
        emptyValue,
        indexType,
        showDeleted,
        true
      );
      const count = getTotalEntityCountByType(
        data.aggregations?.['sterms#EntityType']?.buckets as Bucket[]
      );

      setTabCounts((prev) => ({ ...prev, [entityType]: count }));
    } catch (_error) {
      // eslint-disable-next-line no-console
      console.error(_error);
    }
  };

  const fetchCounts = () => {
    fetchEntityCount(SearchIndex.TABLE);

    fetchEntityCount(SearchIndex.TOPIC);

    fetchEntityCount(SearchIndex.DASHBOARD);

    fetchEntityCount(SearchIndex.PIPELINE);

    fetchEntityCount(SearchIndex.MLMODEL);
  };

  useEffect(() => {
    fetchCounts();
  }, [searchText, showDeleted, initialFilter]);

  useEffect(() => {
    AppState.updateExplorePageTab(tab);
  }, [tab]);

  return (
    <PageContainerV1>
      <Explore
        fetchCount={fetchCounts}
        handleFilterChange={handleFilterChange}
        handlePathChange={handlePathChange}
        handleSearchText={handleSearchText}
        handleTabCounts={handleTabCounts}
        initialFilter={initialFilter}
        isFilterSelected={!isEmpty(searchFilter) || !isEmpty(initialFilter)}
        searchFilter={searchFilter}
        searchQuery={searchQuery}
        searchText={searchText}
        showDeleted={showDeleted}
        sortValue={initialSortField}
        tab={tab}
        tabCounts={tabCounts}
        onShowDeleted={(checked) => setShowDeleted(checked)}
      />
    </PageContainerV1>
  );
};

export default ExplorePage;
