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

import { AxiosError, AxiosResponse } from 'axios';
import { isEmpty, isNil, isUndefined } from 'lodash';
import { observer } from 'mobx-react';
import { EntityCounts, FormatedTableData, SearchResponse } from 'Models';
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import AppState from '../../AppState';
import { getAirflowPipelines } from '../../axiosAPIs/airflowPipelineAPI';
import { searchData } from '../../axiosAPIs/miscAPI';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import Loader from '../../components/Loader/Loader';
import MyData from '../../components/MyData/MyData.component';
import {
  myDataEntityCounts,
  myDataSearchIndex,
} from '../../constants/Mydata.constants';
import { FeedFilter, Ownership } from '../../enums/mydata.enum';
import { ChangeDescription } from '../../generated/entity/teams/user';
import { useAuth } from '../../hooks/authHooks';
import { formatDataResponse } from '../../utils/APIUtils';
import { getEntityCountByType } from '../../utils/EntityUtils';
import { getMyDataFilters } from '../../utils/MyDataUtils';
import { getAllServices } from '../../utils/ServiceUtils';

const MyDataPage = () => {
  const location = useLocation();
  const { isAuthDisabled } = useAuth(location.pathname);
  const [error, setError] = useState<string>('');
  const [countServices, setCountServices] = useState<number>();
  const [ingestionCount, setIngestionCount] = useState<number>();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchResult, setSearchResult] = useState<SearchResponse>();
  const [entityCounts, setEntityCounts] = useState<EntityCounts>();

  const [ownedData, setOwnedData] = useState<Array<FormatedTableData>>();
  const [followedData, setFollowedData] = useState<Array<FormatedTableData>>();
  const [feedData, setFeedData] = useState<
    Array<
      FormatedTableData & {
        entityType: string;
        changeDescriptions: Array<
          ChangeDescription & { updatedAt: number; updatedBy: string }
        >;
      }
    >
  >();
  const [feedFilter, setFeedFilter] = useState<FeedFilter>(FeedFilter.ALL);

  const feedFilterHandler = (filter: FeedFilter) => {
    setFeedFilter(filter);
  };

  const fetchData = (fetchService = false) => {
    setError('');

    searchData('', 1, 0, '', '', '', myDataSearchIndex)
      .then((res: SearchResponse) => {
        setSearchResult(res);
        if (isUndefined(entityCounts)) {
          setEntityCounts(
            getEntityCountByType(
              res.data.aggregations?.['sterms#EntityType']?.buckets
            )
          );
        }
      })
      .catch((err: AxiosError) => {
        setError(err.response?.data?.responseMessage);
        setEntityCounts(myDataEntityCounts);
      });

    if (fetchService) {
      getAllServices()
        .then((res) => setCountServices(res.length))
        .catch(() => setCountServices(0));
      getAirflowPipelines([], '', '?limit=1000000')
        .then((res) => setIngestionCount(res.data.data.length))
        .catch(() => setIngestionCount(0));
    }
    setIsLoading(false);
  };

  const fetchMyData = () => {
    const ownedEntity = searchData(
      '',
      1,
      8,
      getMyDataFilters(Ownership.OWNER, AppState.userDetails),
      '',
      '',
      myDataSearchIndex
    );

    const followedEntity = searchData(
      '',
      1,
      8,
      getMyDataFilters(Ownership.FOLLOWERS, AppState.userDetails),
      '',
      '',
      myDataSearchIndex
    );

    Promise.allSettled([ownedEntity, followedEntity]).then(
      ([resOwnedEntity, resFollowedEntity]) => {
        if (resOwnedEntity.status === 'fulfilled') {
          setOwnedData(formatDataResponse(resOwnedEntity.value.data.hits.hits));
        }
        if (resFollowedEntity.status === 'fulfilled') {
          setFollowedData(
            formatDataResponse(resFollowedEntity.value.data.hits.hits)
          );
        }
      }
    );
  };

  const getFeedData = () => {
    searchData(
      '',
      1,
      20,
      feedFilter !== FeedFilter.ALL
        ? getMyDataFilters(
            feedFilter === FeedFilter.OWNED
              ? Ownership.OWNER
              : Ownership.FOLLOWERS,
            AppState.userDetails
          )
        : '',
      'last_updated_timestamp',
      '',
      myDataSearchIndex
    ).then((res: AxiosResponse) => {
      if (res.data) {
        setFeedData(formatDataResponse(res.data.hits.hits));
      }
    });
  };

  useEffect(() => {
    fetchData(true);
  }, []);

  useEffect(() => {
    getFeedData();
  }, [feedFilter]);

  useEffect(() => {
    if (
      ((isAuthDisabled && AppState.users.length) ||
        !isEmpty(AppState.userDetails)) &&
      (isNil(ownedData) || isNil(followedData))
    ) {
      fetchMyData();
    }
  }, [AppState.userDetails, AppState.users, isAuthDisabled]);

  return (
    <PageContainerV1>
      {!isUndefined(countServices) &&
      !isUndefined(entityCounts) &&
      !isUndefined(ingestionCount) &&
      !isLoading ? (
        <MyData
          countServices={countServices}
          entityCounts={entityCounts}
          error={error}
          feedData={feedData || []}
          feedFilter={feedFilter}
          feedFilterHandler={feedFilterHandler}
          followedData={followedData || []}
          ingestionCount={ingestionCount}
          ownedData={ownedData || []}
          searchResult={searchResult}
        />
      ) : (
        <Loader />
      )}
    </PageContainerV1>
  );
};

export default observer(MyDataPage);
