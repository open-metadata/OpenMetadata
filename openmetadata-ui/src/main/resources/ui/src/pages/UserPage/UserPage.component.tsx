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
import { compare, Operation } from 'fast-json-patch';
import { isEmpty, isEqual } from 'lodash';
import { observer } from 'mobx-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import AppState from '../../AppState';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';
import { getFeedsWithFilter, postFeedById } from '../../axiosAPIs/feedsAPI';
import { getUserByName, updateUserDetail } from '../../axiosAPIs/userAPI';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import Loader from '../../components/Loader/Loader';
import Users from '../../components/Users/Users.component';
import { UserDetails } from '../../components/Users/Users.interface';
import {
  onErrorText,
  onUpdatedConversastionError,
} from '../../constants/feed.constants';
import { getUserCurrentTab } from '../../constants/usersprofile.constants';
import { FeedFilter } from '../../enums/mydata.enum';
import {
  Thread,
  ThreadTaskStatus,
  ThreadType,
} from '../../generated/entity/feed/thread';
import { User } from '../../generated/entity/teams/user';
import { Paging } from '../../generated/type/paging';
import { useAuth } from '../../hooks/authHooks';
import jsonData from '../../jsons/en';
import {
  deletePost,
  getUpdatedThread,
  updateThreadData,
} from '../../utils/FeedUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const UserPage = () => {
  const { username, tab } = useParams<{ [key: string]: string }>();
  const { search } = useLocation();
  const { isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();
  const searchParams = new URLSearchParams(location.search);
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<User>({} as User);
  const [currentLoggedInUser, setCurrentLoggedInUser] = useState<User>();
  const [isError, setIsError] = useState(false);
  const [entityThread, setEntityThread] = useState<Thread[]>([]);
  const [isFeedLoading, setIsFeedLoading] = useState<boolean>(false);
  const [paging, setPaging] = useState<Paging>({} as Paging);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>(
    (searchParams.get('feedFilter') as FeedFilter) ?? FeedFilter.ALL
  );
  const [taskStatus, setTaskStatus] = useState<ThreadTaskStatus>(
    ThreadTaskStatus.Open
  );
  const threadType = useMemo(() => {
    return getUserCurrentTab(tab) === 2
      ? ThreadType.Task
      : ThreadType.Conversation;
  }, [tab]);

  const isTaskType = isEqual(threadType, ThreadType.Task);

  const fetchUserData = () => {
    setUserData({} as User);
    getUserByName(username, 'profile,roles,teams,follows,owns')
      .then((res: AxiosResponse) => {
        if (res.data) {
          setUserData(res.data);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-user-details-error']
        );
        setIsError(true);
      })
      .finally(() => setIsLoading(false));
  };

  const ErrorPlaceholder = () => {
    return (
      <div
        className="tw-flex tw-flex-col tw-items-center tw-place-content-center tw-mt-40 tw-gap-1"
        data-testid="error">
        <p className="tw-text-base" data-testid="error-message">
          No user available with name{' '}
          <span className="tw-font-medium" data-testid="username">
            {username}
          </span>{' '}
        </p>
      </div>
    );
  };

  const getFeedData = useCallback(
    (threadType: ThreadType, after?: string, feedFilter?: FeedFilter) => {
      const status = isTaskType ? taskStatus : undefined;
      setIsFeedLoading(true);
      getFeedsWithFilter(
        userData.id,
        feedFilter || FeedFilter.ALL,
        after,
        threadType,
        status
      )
        .then((res: AxiosResponse) => {
          const { data, paging: pagingObj } = res.data;
          setPaging(pagingObj);
          setEntityThread((prevData) => {
            if (after) {
              return [...prevData, ...data];
            } else {
              return [...data];
            }
          });
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
    },
    [taskStatus]
  );

  const handleFeedFetchFromFeedList = useCallback(
    (threadType: ThreadType, after?: string, feedFilter?: FeedFilter) => {
      !after && setEntityThread([]);
      getFeedData(threadType, after, feedFilter);
    },
    [getFeedData, setEntityThread, getFeedData]
  );

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

  const updateUserDetails = (data: UserDetails) => {
    const updatedDetails = { ...userData, ...data };
    const jsonPatch = compare(userData, updatedDetails);
    updateUserDetail(userData.id, jsonPatch)
      .then((res: AxiosResponse) => {
        if (res.data) {
          setUserData((prevData) => ({ ...prevData, ...data }));
        } else {
          throw jsonData['api-error-messages']['unexpected-error'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(err);
      });
  };

  const isLoggedinUser = (userName: string) => {
    return userName === currentLoggedInUser?.name;
  };

  const onSwitchChange = (checked: boolean) => {
    if (checked) {
      setTaskStatus(ThreadTaskStatus.Closed);
    } else {
      setTaskStatus(ThreadTaskStatus.Open);
    }
  };

  const getUserComponent = () => {
    if (!isError && !isEmpty(userData)) {
      return (
        <Users
          deletePostHandler={deletePostHandler}
          feedData={entityThread || []}
          feedFilter={feedFilter}
          fetchFeedHandler={handleFeedFetchFromFeedList}
          isAdminUser={Boolean(isAdminUser)}
          isAuthDisabled={Boolean(isAuthDisabled)}
          isFeedLoading={isFeedLoading}
          isLoggedinUser={isLoggedinUser(username)}
          paging={paging}
          postFeedHandler={postFeedHandler}
          setFeedFilter={setFeedFilter}
          tab={tab}
          threadType={threadType}
          updateThreadHandler={updateThreadHandler}
          updateUserDetails={updateUserDetails}
          userData={userData}
          username={username}
          onSwitchChange={onSwitchChange}
        />
      );
    } else {
      return <ErrorPlaceholder />;
    }
  };

  useEffect(() => {
    setEntityThread([]);
    fetchUserData();
  }, [username]);

  useEffect(() => {
    if (userData.id) {
      const threadType =
        tab === 'tasks' ? ThreadType.Task : ThreadType.Conversation;

      const newFeedFilter =
        (searchParams.get('feedFilter') as FeedFilter) ??
        (threadType === ThreadType.Conversation
          ? FeedFilter.OWNER
          : FeedFilter.ALL);
      setFeedFilter(newFeedFilter);
      setEntityThread([]);
      getFeedData(threadType, undefined, newFeedFilter);
    }
  }, [userData, tab, search, taskStatus]);

  useEffect(() => {
    setEntityThread([]);
  }, [tab]);

  useEffect(() => {
    setCurrentLoggedInUser(AppState.getCurrentUserDetails());
  }, [AppState.nonSecureUserDetails, AppState.userDetails]);

  return (
    <PageContainerV1 className="tw-pt-4">
      {isLoading ? <Loader /> : getUserComponent()}
    </PageContainerV1>
  );
};

export default observer(UserPage);
