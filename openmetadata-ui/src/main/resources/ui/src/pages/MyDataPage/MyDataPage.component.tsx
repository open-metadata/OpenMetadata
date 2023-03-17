/*
 *  Copyright 2022 Collate.
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

import { AxiosError } from 'axios';
import PageContainerV1 from 'components/containers/PageContainerV1';
import Loader from 'components/Loader/Loader';
import MyData from 'components/MyData/MyData.component';
import { MyDataState } from 'components/MyData/MyData.interface';
import { useWebSocketConnector } from 'components/web-scoket/web-scoket.provider';
import { Operation } from 'fast-json-patch';
import { isEmpty, isNil } from 'lodash';
import { observer } from 'mobx-react';
import React, {
  Fragment,
  Reducer,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import { getFeedsWithFilter, postFeedById } from 'rest/feedsAPI';
import { getAllEntityCount } from 'rest/miscAPI';
import { getUserById } from 'rest/userAPI';
import AppState from '../../AppState';
import { SOCKET_EVENTS } from '../../constants/constants';
import { AssetsType } from '../../enums/entity.enum';
import { FeedFilter } from '../../enums/mydata.enum';
import { Post, Thread, ThreadType } from '../../generated/entity/feed/thread';
import { EntityReference } from '../../generated/type/entityReference';
import { Paging } from '../../generated/type/paging';
import { useAuth } from '../../hooks/authHooks';
import jsonData from '../../jsons/en';
import { reducerWithoutAction } from '../../utils/CommonUtils';
import { deletePost, updateThreadData } from '../../utils/FeedUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const MyDataPage = () => {
  const location = useLocation();
  const { isAuthDisabled } = useAuth(location.pathname);
  const [error, setError] = useState<string>('');

  const initialState = useMemo(
    () => ({
      entityCounts: {
        tableCount: 0,
        topicCount: 0,
        dashboardCount: 0,
        pipelineCount: 0,
        mlmodelCount: 0,
        servicesCount: 0,
        userCount: 0,
        teamCount: 0,
      },
      entityCountLoading: false,
    }),
    []
  );

  const [state, dispatch] = useReducer<
    Reducer<MyDataState, Partial<MyDataState>>
  >(reducerWithoutAction, initialState);

  const handleStateChange = useCallback((newState: Partial<MyDataState>) => {
    dispatch(newState);
  }, []);

  const [ownedData, setOwnedData] = useState<Array<EntityReference>>();
  const [followedData, setFollowedData] = useState<Array<EntityReference>>();
  const [ownedDataCount, setOwnedDataCount] = useState(0);
  const [followedDataCount, setFollowedDataCount] = useState(0);
  const [pendingTaskCount, setPendingTaskCount] = useState(0);

  const [entityThread, setEntityThread] = useState<Thread[]>([]);
  const [isFeedLoading, setIsFeedLoading] = useState<boolean>(false);
  const [isLoadingOwnedData, setIsLoadingOwnedData] = useState<boolean>(false);

  const [activityFeeds, setActivityFeeds] = useState<Thread[]>([]);

  const [paging, setPaging] = useState<Paging>({} as Paging);
  const { socket } = useWebSocketConnector();

  const currentUser = useMemo(
    () => AppState.getCurrentUserDetails(),
    [AppState.userDetails, AppState.nonSecureUserDetails]
  );

  const fetchEntityCount = async () => {
    handleStateChange({
      entityCountLoading: true,
    });
    try {
      const res = await getAllEntityCount();
      handleStateChange({
        entityCounts: {
          ...res,
        },
      });
    } catch (err) {
      showErrorToast(err as AxiosError);
      handleStateChange({
        entityCounts: {
          tableCount: 0,
          topicCount: 0,
          dashboardCount: 0,
          pipelineCount: 0,
          mlmodelCount: 0,
          storageContainerCount: 0,
          servicesCount: 0,
          userCount: 0,
          teamCount: 0,
        },
      });
    } finally {
      handleStateChange({
        entityCountLoading: false,
      });
    }
  };

  const fetchData = () => {
    setError('');
    fetchEntityCount();
  };

  const fetchMyData = async () => {
    if (!currentUser || !currentUser.id) {
      return;
    }
    setIsLoadingOwnedData(true);
    try {
      const userData = await getUserById(currentUser?.id, 'follows, owns');

      if (userData) {
        const includeData = Object.values(AssetsType);
        const owns: EntityReference[] = userData.owns ?? [];
        const follows: EntityReference[] = userData.follows ?? [];

        const includedFollowsData = follows.filter((data) =>
          includeData.includes(data.type as AssetsType)
        );
        const includedOwnsData = owns.filter((data) =>
          includeData.includes(data.type as AssetsType)
        );

        setFollowedDataCount(includedFollowsData.length);
        setOwnedDataCount(includedOwnsData.length);

        setFollowedData(includedFollowsData.slice(0, 8));
        setOwnedData(includedOwnsData.slice(0, 8));
      }
    } catch (err) {
      setOwnedData([]);
      setFollowedData([]);
    } finally {
      setIsLoadingOwnedData(false);
    }
  };

  const getFeedData = (
    filterType?: FeedFilter,
    after?: string,
    type?: ThreadType
  ) => {
    setIsFeedLoading(true);
    const feedFilterType = filterType ?? FeedFilter.ALL;
    const userId =
      feedFilterType === FeedFilter.ALL ? undefined : currentUser?.id;

    getFeedsWithFilter(userId, feedFilterType, after, type)
      .then((res) => {
        const { data, paging: pagingObj } = res;
        setPaging(pagingObj);
        setEntityThread((prevData) => [...prevData, ...data]);
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-activity-feed-error']
        );
      })
      .finally(() => {
        setIsFeedLoading(false);
      });
  };

  const handleFeedFetchFromFeedList = useCallback(
    (filterType?: FeedFilter, after?: string, type?: ThreadType) => {
      !after && setEntityThread([]);
      getFeedData(filterType, after, type);
    },
    [getFeedData, setEntityThread]
  );

  const postFeedHandler = (value: string, id: string) => {
    const data = {
      message: value,
      from: currentUser?.name,
    };
    postFeedById(id, data as Post)
      .then((res) => {
        if (res) {
          const { id, posts } = res;
          setEntityThread((pre) => {
            return pre.map((thread) => {
              if (thread.id === id) {
                return { ...res, posts: posts?.slice(-3) };
              } else {
                return thread;
              }
            });
          });
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(err, jsonData['api-error-messages']['feed-post-error']);
      });
  };

  const deletePostHandler = (
    threadId: string,
    postId: string,
    isThread: boolean
  ) => {
    deletePost(threadId, postId, isThread, setEntityThread);
  };

  const updateThreadHandler = (
    threadId: string,
    postId: string,
    isThread: boolean,
    data: Operation[]
  ) => {
    updateThreadData(threadId, postId, isThread, data, setEntityThread);
  };

  // Fetch tasks list to show count for Pending tasks
  const fetchMyTaskData = useCallback(() => {
    if (!currentUser || !currentUser.id) {
      return;
    }

    getFeedsWithFilter(
      currentUser.id,
      FeedFilter.ASSIGNED_TO,
      undefined,
      ThreadType.Task
    ).then((res) => {
      res.data && setPendingTaskCount(res.paging.total);
    });
  }, [currentUser]);

  useEffect(() => {
    fetchData();
    fetchMyTaskData();
  }, []);

  useEffect(() => {
    getFeedData(FeedFilter.OWNER);
  }, []);

  useEffect(() => {
    if (
      ((isAuthDisabled && AppState.users.length) ||
        !isEmpty(AppState.userDetails)) &&
      (isNil(ownedData) || isNil(followedData))
    ) {
      fetchMyData();
    }
  }, [AppState.userDetails, AppState.users, isAuthDisabled]);

  useEffect(() => {
    if (socket) {
      socket.on(SOCKET_EVENTS.ACTIVITY_FEED, (newActivity) => {
        if (newActivity) {
          setActivityFeeds((prevActivities) => [
            JSON.parse(newActivity),
            ...prevActivities,
          ]);
        }
      });
      socket.on(SOCKET_EVENTS.TASK_CHANNEL, (newActivity) => {
        if (newActivity) {
          setPendingTaskCount((prevCount) =>
            prevCount ? prevCount + 1 : prevCount
          );
        }
      });
    }

    return () => {
      socket && socket.off(SOCKET_EVENTS.ACTIVITY_FEED);
      socket && socket.off(SOCKET_EVENTS.TASK_CHANNEL);
    };
  }, [socket]);

  const onRefreshFeeds = () => {
    getFeedData();
    setEntityThread([]);
    setActivityFeeds([]);
  };

  return (
    <PageContainerV1>
      {!isEmpty(state.entityCounts) ? (
        <Fragment>
          <MyData
            activityFeeds={activityFeeds}
            data={state}
            deletePostHandler={deletePostHandler}
            error={error}
            feedData={entityThread || []}
            fetchFeedHandler={handleFeedFetchFromFeedList}
            followedData={followedData || []}
            followedDataCount={followedDataCount}
            isFeedLoading={isFeedLoading}
            isLoadingOwnedData={isLoadingOwnedData}
            ownedData={ownedData || []}
            ownedDataCount={ownedDataCount}
            paging={paging}
            pendingTaskCount={pendingTaskCount}
            postFeedHandler={postFeedHandler}
            updateThreadHandler={updateThreadHandler}
            onRefreshFeeds={onRefreshFeeds}
          />
        </Fragment>
      ) : (
        <Loader />
      )}
    </PageContainerV1>
  );
};

export default observer(MyDataPage);
