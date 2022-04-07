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
import { EntityThread, FormatedTableData } from 'Models';
import React, { Fragment, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import AppState from '../../AppState';
import { getAllDashboards } from '../../axiosAPIs/dashboardAPI';
import { getFeedsWithFilter, postFeedById } from '../../axiosAPIs/feedsAPI';
import { fetchSandboxConfig, searchData } from '../../axiosAPIs/miscAPI';
import { getAllPipelines } from '../../axiosAPIs/pipelineAPI';
import { getAllTables } from '../../axiosAPIs/tableAPI';
import { getAllTopics } from '../../axiosAPIs/topicsAPI';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import GithubStarButton from '../../components/GithubStarButton/GithubStarButton';
import Loader from '../../components/Loader/Loader';
import MyData from '../../components/MyData/MyData.component';
import {
  onConfirmText,
  onErrorText,
  onUpdatedConversastionError,
} from '../../constants/feed.constants';
import { myDataSearchIndex } from '../../constants/Mydata.constants';
import { FeedFilter, Ownership } from '../../enums/mydata.enum';
import { useAuth } from '../../hooks/authHooks';
import useToastContext from '../../hooks/useToastContext';
import jsonData from '../../jsons/en';
import { formatDataResponse } from '../../utils/APIUtils';
import { deletePost, getUpdatedThread } from '../../utils/FeedUtils';
import { getMyDataFilters } from '../../utils/MyDataUtils';
import { getAllServices } from '../../utils/ServiceUtils';
import { getErrorText } from '../../utils/StringsUtils';

const MyDataPage = () => {
  const location = useLocation();
  const showToast = useToastContext();
  const { isAuthDisabled } = useAuth(location.pathname);
  const [error, setError] = useState<string>('');
  const [countServices, setCountServices] = useState<number>();
  const [countTables, setCountTables] = useState<number>();
  const [countTopics, setCountTopics] = useState<number>();
  const [countDashboards, setCountDashboards] = useState<number>();
  const [countPipelines, setCountPipelines] = useState<number>();

  const [ownedData, setOwnedData] = useState<Array<FormatedTableData>>();
  const [followedData, setFollowedData] = useState<Array<FormatedTableData>>();

  const [feedFilter, setFeedFilter] = useState<FeedFilter>(FeedFilter.ALL);
  const [entityThread, setEntityThread] = useState<EntityThread[]>([]);
  const [isFeedLoading, setIsFeedLoading] = useState<boolean>(false);
  const [isSandbox, setIsSandbox] = useState<boolean>(false);

  const handleShowErrorToast = (msg: string) => {
    showToast({
      variant: 'error',
      body: msg,
    });
  };

  const feedFilterHandler = (filter: FeedFilter) => {
    setFeedFilter(filter);
  };

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

  const fetchData = (fetchService = false) => {
    setError('');

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
        handleShowErrorToast(
          getErrorText(
            err,
            jsonData['api-error-messages']['unexpected-server-response']
          )
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
        handleShowErrorToast(
          getErrorText(
            err,
            jsonData['api-error-messages']['unexpected-server-response']
          )
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
        handleShowErrorToast(
          getErrorText(
            err,
            jsonData['api-error-messages']['unexpected-server-response']
          )
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
        handleShowErrorToast(
          getErrorText(
            err,
            jsonData['api-error-messages']['unexpected-server-response']
          )
        );
        setCountDashboards(0);
      });

    if (fetchService) {
      // limit=0 will fetch empty data list with total count
      getAllServices(true, 0)
        .then((res) => {
          const total = res.reduce((prev, curr) => {
            return prev + (curr?.paging?.total || 0);
          }, 0);
          setCountServices(total);
        })
        .catch((err: AxiosError) => {
          handleShowErrorToast(
            getErrorText(
              err,
              jsonData['api-error-messages']['unexpected-server-response']
            )
          );
          setCountServices(0);
        });
    }
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

    Promise.allSettled([ownedEntity, followedEntity])
      .then(([resOwnedEntity, resFollowedEntity]) => {
        if (resOwnedEntity.status === 'fulfilled') {
          setOwnedData(formatDataResponse(resOwnedEntity.value.data.hits.hits));
        }
        if (resFollowedEntity.status === 'fulfilled') {
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

  const getFeedData = (feedFilter: FeedFilter) => {
    setIsFeedLoading(true);
    const currentUserId = AppState.userDetails?.id;
    getFeedsWithFilter(currentUserId, feedFilter)
      .then((res: AxiosResponse) => {
        const { data } = res.data;
        setEntityThread(data);
      })
      .catch(() => {
        showToast({
          variant: 'error',
          body: 'Error while fetching the Activity Feed',
        });
      })
      .finally(() => {
        setIsFeedLoading(false);
      });
  };

  const postFeedHandler = (value: string, id: string) => {
    const currentUser = AppState.userDetails?.name ?? AppState.users[0]?.name;

    const data = {
      message: value,
      from: currentUser,
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
      .catch(() => {
        showToast({
          variant: 'error',
          body: 'Error while posting feed',
        });
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
                    posts: data.posts.slice(-3),
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
            showToast({
              variant: 'error',
              body: message ?? onUpdatedConversastionError,
            });
          });

        showToast({
          variant: 'success',
          body: onConfirmText,
        });
      })
      .catch((error) => {
        const message = error?.message;
        showToast({ variant: 'error', body: message ?? onErrorText });
      });
  };

  const fetchOMDMode = () => {
    fetchSandboxConfig()
      .then((res) => {
        if (res.data) {
          setIsSandbox(Boolean(res.data.sandboxModeEnabled));
        } else {
          throw '';
        }
      })
      .catch((err: AxiosError) => {
        showToast({
          variant: 'error',
          body:
            err.response?.data?.message ||
            jsonData['api-error-messages']['unexpected-server-response'],
        });
        setIsSandbox(false);
      });
  };

  useEffect(() => {
    fetchOMDMode();
    fetchData(true);
  }, []);

  useEffect(() => {
    getFeedData(feedFilter);
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
      !isUndefined(countTables) &&
      !isUndefined(countTopics) &&
      !isUndefined(countDashboards) &&
      !isUndefined(countPipelines) ? (
        <Fragment>
          <MyData
            countDashboards={countDashboards}
            countPipelines={countPipelines}
            countServices={countServices}
            countTables={countTables}
            countTopics={countTopics}
            deletePostHandler={deletePostHandler}
            error={error}
            feedData={entityThread || []}
            feedFilter={feedFilter}
            feedFilterHandler={feedFilterHandler}
            followedData={followedData || []}
            isFeedLoading={isFeedLoading}
            ownedData={ownedData || []}
            postFeedHandler={postFeedHandler}
          />
          {isSandbox ? <GithubStarButton /> : null}
        </Fragment>
      ) : (
        <Loader />
      )}
    </PageContainerV1>
  );
};

export default observer(MyDataPage);
