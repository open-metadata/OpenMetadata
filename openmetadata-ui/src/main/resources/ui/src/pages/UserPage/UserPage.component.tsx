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
import { observer } from 'mobx-react';
import { EntityThread } from 'Models';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import AppState from '../../AppState';
import { getFeedsWithFilter, postFeedById } from '../../axiosAPIs/feedsAPI';
import { getUserByName } from '../../axiosAPIs/userAPI';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import Loader from '../../components/Loader/Loader';
import Users from '../../components/Users/Users.component';
import {
  onErrorText,
  onUpdatedConversastionError,
} from '../../constants/feed.constants';
import { FeedFilter } from '../../enums/mydata.enum';
import { User } from '../../generated/entity/teams/user';
import { Paging } from '../../generated/type/paging';
import jsonData from '../../jsons/en';
import { deletePost, getUpdatedThread } from '../../utils/FeedUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const UserPage = () => {
  const { username } = useParams<{ [key: string]: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<User>({} as User);
  const [isError, setIsError] = useState(false);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>(FeedFilter.ALL);
  const [entityThread, setEntityThread] = useState<EntityThread[]>([]);
  const [isFeedLoading, setIsFeedLoading] = useState<boolean>(false);
  const [paging, setPaging] = useState<Paging>({} as Paging);

  const fetchUserData = () => {
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
          No user available with{' '}
          <span className="tw-font-medium" data-testid="username">
            {username}
          </span>{' '}
          username.
        </p>
      </div>
    );
  };

  const feedFilterHandler = (filter: FeedFilter) => {
    setFeedFilter(filter);
  };

  const getFeedData = (filterType: FeedFilter, after?: string) => {
    setIsFeedLoading(true);
    const currentUserId = AppState.getCurrentUserDetails()?.id;
    getFeedsWithFilter(currentUserId, filterType, after)
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
            showErrorToast(message ?? onUpdatedConversastionError);
          });
      })
      .catch((error) => {
        const message = error?.message;
        showErrorToast(message ?? onErrorText);
      });
  };

  useEffect(() => {
    fetchUserData();
  }, [username]);

  useEffect(() => {
    getFeedData(feedFilter);
    setEntityThread([]);
  }, [feedFilter]);

  return (
    <PageContainerV1 className="tw-pt-4">
      {isLoading ? (
        <Loader />
      ) : !isError ? (
        <Users
          deletePostHandler={deletePostHandler}
          feedData={entityThread || []}
          feedFilter={feedFilter}
          feedFilterHandler={feedFilterHandler}
          fetchFeedHandler={getFeedData}
          isFeedLoading={isFeedLoading}
          paging={paging}
          postFeedHandler={postFeedHandler}
          userData={userData}
        />
      ) : (
        <ErrorPlaceholder />
      )}
    </PageContainerV1>
  );
};

export default observer(UserPage);
