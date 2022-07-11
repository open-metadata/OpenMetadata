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
import { Operation } from 'fast-json-patch';
import { isEmpty, isNil, isUndefined } from 'lodash';
import { observer } from 'mobx-react';
import { FormattedTableData, SlackChatConfig } from 'Models';
import React, {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import AppState from '../../AppState';
import { getAllDashboards } from '../../axiosAPIs/dashboardAPI';
import { getFeedsWithFilter, postFeedById } from '../../axiosAPIs/feedsAPI';
import {
  fetchSandboxConfig,
  fetchSlackConfig,
  searchData,
} from '../../axiosAPIs/miscAPI';
import { getAllMlModal } from '../../axiosAPIs/mlModelAPI';
import { getAllPipelines } from '../../axiosAPIs/pipelineAPI';
import { getAllTables } from '../../axiosAPIs/tableAPI';
import { getTeams } from '../../axiosAPIs/teamsAPI';
import { getAllTopics } from '../../axiosAPIs/topicsAPI';
import { getUsers } from '../../axiosAPIs/userAPI';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import GithubStarButton from '../../components/GithubStarButton/GithubStarButton';
import Loader from '../../components/Loader/Loader';
import MyData from '../../components/MyData/MyData.component';
import SlackChat from '../../components/SlackChat/SlackChat';
import { useWebSocketConnector } from '../../components/web-scoket/web-scoket.provider';
import { SOCKET_EVENTS } from '../../constants/constants';
import {
  onErrorText,
  onUpdatedConversastionError,
} from '../../constants/feed.constants';
import { myDataSearchIndex } from '../../constants/Mydata.constants';
import { FeedFilter, Ownership } from '../../enums/mydata.enum';
import { Thread, ThreadType } from '../../generated/entity/feed/thread';
import { Paging } from '../../generated/type/paging';
import { useAuth } from '../../hooks/authHooks';
import jsonData from '../../jsons/en';
import { formatDataResponse } from '../../utils/APIUtils';
import {
  deletePost,
  getUpdatedThread,
  updateThreadData,
} from '../../utils/FeedUtils';
import { getMyDataFilters } from '../../utils/MyDataUtils';
import { getAllServices } from '../../utils/ServiceUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const MyDataPage = () => {
  const location = useLocation();
  const { isAuthDisabled } = useAuth(location.pathname);
  const [error, setError] = useState<string>('');
  const [countServices, setCountServices] = useState<number>();
  const [countTables, setCountTables] = useState<number>();
  const [countTopics, setCountTopics] = useState<number>();
  const [countDashboards, setCountDashboards] = useState<number>();
  const [countPipelines, setCountPipelines] = useState<number>();
  const [countMlModal, setCountMlModal] = useState<number>();
  const [countUsers, setCountUsers] = useState<number>();
  const [countTeams, setCountTeams] = useState<number>();

  const [ownedData, setOwnedData] = useState<Array<FormattedTableData>>();
  const [followedData, setFollowedData] = useState<Array<FormattedTableData>>();
  const [ownedDataCount, setOwnedDataCount] = useState(0);
  const [followedDataCount, setFollowedDataCount] = useState(0);
  const [pendingTaskCount, setPendingTaskCount] = useState(0);

  const [entityThread, setEntityThread] = useState<Thread[]>([]);
  const [isFeedLoading, setIsFeedLoading] = useState<boolean>(false);
  const [isSandbox, setIsSandbox] = useState<boolean>(false);
  const [slackConfig, setSlackConfig] = useState<SlackChatConfig | undefined>();

  const [activityFeeds, setActivityFeeds] = useState<Thread[]>([]);

  const [paging, setPaging] = useState<Paging>({} as Paging);
  const { socket } = useWebSocketConnector();

  const setTableCount = (count = 0) => {
    setCountTables(count);
  };
  const setTopicCount = (count = 0) => {
    setCountTopics(count);
  };
  const setPipelineCount = (count = 0) => {
    setCountPipelines(count);
  };
  const setDashboardCount = (count = 0) => {
    setCountDashboards(count);
  };
  const setUserCount = (count = 0) => {
    setCountUsers(count);
  };
  const setTeamCount = (count = 0) => {
    setCountTeams(count);
  };

  const currentUser = useMemo(
    () => AppState.getCurrentUserDetails(),
    [AppState.userDetails, AppState.nonSecureUserDetails]
  );

  const fetchEntityCount = () => {
    // limit=0 will fetch empty data list with total count
    getAllTables('', 0)
      .then((res) => {
        if (res.data) {
          setTableCount(res.data.paging.total);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['unexpected-server-response']
        );
        setCountTables(0);
      });

    // limit=0 will fetch empty data list with total count
    getAllTopics('', '', 0)
      .then((res) => {
        if (res.data) {
          setTopicCount(res.data.paging.total);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['unexpected-server-response']
        );
        setCountTopics(0);
      });

    // limit=0 will fetch empty data list with total count
    getAllPipelines('', '', 0)
      .then((res) => {
        if (res.data) {
          setPipelineCount(res.data.paging.total);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['unexpected-server-response']
        );
        setCountPipelines(0);
      });

    // limit=0 will fetch empty data list with total count
    getAllDashboards('', '', 0)
      .then((res) => {
        if (res.data) {
          setDashboardCount(res.data.paging.total);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['unexpected-server-response']
        );
        setCountDashboards(0);
      });

    // limit=0 will fetch empty data list with total count
    getAllMlModal('', '', 0)
      .then((res) => {
        if (res.data) {
          setCountMlModal(res.data.paging.total);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['unexpected-server-response']
        );
        setCountMlModal(0);
      });
  };

  const fetchTeamsAndUsersCount = () => {
    getUsers('', 0)
      .then((res) => {
        if (res.data) {
          setUserCount(res.data.paging.total);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['unexpected-server-response']
        );
        setUserCount(0);
      });

    getTeams('', 0)
      .then((res) => {
        if (res.data) {
          setTeamCount(res.data.paging.total);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['unexpected-server-response']
        );
        setTeamCount(0);
      });
  };

  const fetchServiceCount = () => {
    // limit=0 will fetch empty data list with total count
    getAllServices(true, 0)
      .then((res) => {
        const total = res.reduce((prev, curr) => {
          return prev + (curr?.paging?.total || 0);
        }, 0);
        setCountServices(total);
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['unexpected-server-response']
        );
        setCountServices(0);
      });
  };

  const fetchData = (fetchService = false) => {
    setError('');

    fetchEntityCount();

    fetchTeamsAndUsersCount();

    if (fetchService) {
      fetchServiceCount();
    }
  };

  const fetchMyData = () => {
    const ownedEntity = searchData(
      '',
      1,
      8,
      getMyDataFilters(
        Ownership.OWNER,
        AppState.userDetails,
        AppState.nonSecureUserDetails
      ),
      '',
      '',
      myDataSearchIndex
    );

    const followedEntity = searchData(
      '',
      1,
      8,
      getMyDataFilters(
        Ownership.FOLLOWERS,
        AppState.userDetails,
        AppState.nonSecureUserDetails
      ),
      '',
      '',
      myDataSearchIndex
    );

    Promise.allSettled([ownedEntity, followedEntity])
      .then(([resOwnedEntity, resFollowedEntity]) => {
        if (resOwnedEntity.status === 'fulfilled') {
          setOwnedData(formatDataResponse(resOwnedEntity.value.data.hits.hits));
          setOwnedDataCount(resOwnedEntity.value.data.hits.total.value);
        }
        if (resFollowedEntity.status === 'fulfilled') {
          setFollowedDataCount(resFollowedEntity.value.data.hits.total.value);
          setFollowedData(
            formatDataResponse(resFollowedEntity.value.data.hits.hits)
          );
        }
      })
      .catch(() => {
        setOwnedData([]);
        setFollowedData([]);
      });
  };

  const getFeedData = (
    filterType?: FeedFilter,
    after?: string,
    type?: ThreadType
  ) => {
    setIsFeedLoading(true);
    getFeedsWithFilter(
      currentUser?.id,
      filterType ?? FeedFilter.ALL,
      after,
      type
    )
      .then((res: AxiosResponse) => {
        const { data, paging: pagingObj } = res.data;
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
    postFeedById(id, data)
      .then((res: AxiosResponse) => {
        if (res.data) {
          const { id, posts } = res.data;
          setEntityThread((pre) => {
            return pre.map((thread) => {
              if (thread.id === id) {
                return { ...res.data, posts: posts.slice(-3) };
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

  const deletePostHandler = (threadId: string, postId: string) => {
    deletePost(threadId, postId)
      .then(() => {
        getUpdatedThread(threadId)
          .then((data) => {
            setEntityThread((pre) => {
              return pre.map((thread) => {
                if (thread.id === data.id) {
                  return {
                    ...thread,
                    posts: data.posts && data.posts.slice(-3),
                    postsCount: data.postsCount,
                  };
                } else {
                  return thread;
                }
              });
            });
          })
          .catch((error) => {
            const message = error?.message;
            showErrorToast(message ?? onUpdatedConversastionError);
          });
      })
      .catch((error) => {
        const message = error?.message;
        showErrorToast(message ?? onErrorText);
      });
  };

  const updateThreadHandler = (
    threadId: string,
    postId: string,
    isThread: boolean,
    data: Operation[]
  ) => {
    updateThreadData(threadId, postId, isThread, data, setEntityThread);
  };

  const fetchSandboxMode = () => {
    fetchSandboxConfig()
      .then((res) => {
        if (res.data) {
          setIsSandbox(Boolean(res.data.sandboxModeEnabled));
        } else {
          throw '';
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['unexpected-server-response']
        );
        setIsSandbox(false);
      });
  };

  const fetchSlackChatConfig = () => {
    fetchSlackConfig()
      .then((res) => {
        if (res.data) {
          const { apiToken, botName, channels } = res.data;
          const slackConfig = {
            apiToken,
            botName,
            channels,
          };
          setSlackConfig(slackConfig);
        } else {
          throw '';
        }
      })
      .catch((err: AxiosError) => {
        // eslint-disable-next-line no-console
        console.error(err);
        setSlackConfig(undefined);
      });
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
    ).then((res: AxiosResponse) => {
      res.data && setPendingTaskCount(res.data.paging.total);
    });
  }, [currentUser]);

  useEffect(() => {
    fetchSandboxMode();
    fetchSlackChatConfig();
    fetchData(true);
    fetchMyTaskData();
  }, []);

  useEffect(() => {
    getFeedData();
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
      {!isUndefined(countServices) &&
      !isUndefined(countTables) &&
      !isUndefined(countTopics) &&
      !isUndefined(countDashboards) &&
      !isUndefined(countPipelines) &&
      !isUndefined(countTeams) &&
      !isUndefined(countMlModal) &&
      !isUndefined(countUsers) ? (
        <Fragment>
          <MyData
            activityFeeds={activityFeeds}
            countDashboards={countDashboards}
            countMlModal={countMlModal}
            countPipelines={countPipelines}
            countServices={countServices}
            countTables={countTables}
            countTeams={countTeams}
            countTopics={countTopics}
            countUsers={countUsers}
            deletePostHandler={deletePostHandler}
            error={error}
            feedData={entityThread || []}
            fetchFeedHandler={handleFeedFetchFromFeedList}
            followedData={followedData || []}
            followedDataCount={followedDataCount}
            isFeedLoading={isFeedLoading}
            ownedData={ownedData || []}
            ownedDataCount={ownedDataCount}
            paging={paging}
            pendingTaskCount={pendingTaskCount}
            postFeedHandler={postFeedHandler}
            updateThreadHandler={updateThreadHandler}
            onRefreshFeeds={onRefreshFeeds}
          />
          {isSandbox ? <GithubStarButton /> : null}
          {slackConfig && slackConfig.apiToken ? (
            <SlackChat currentUser={currentUser} slackConfig={slackConfig} />
          ) : null}
        </Fragment>
      ) : (
        <Loader />
      )}
    </PageContainerV1>
  );
};

export default observer(MyDataPage);
