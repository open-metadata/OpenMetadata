/*
 *  Copyright 2023 Collate.
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
import AppState from 'AppState';
import { AxiosError } from 'axios';
import { FeedFilter } from 'enums/mydata.enum';
import { Operation } from 'fast-json-patch';
import { Post, Thread, ThreadType } from 'generated/entity/feed/thread';
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  deletePostById,
  deleteThread,
  getFeedById,
  getFeedsWithFilter,
  postFeedById,
} from 'rest/feedsAPI';
import { getUpdatedThread, updateThreadData } from 'utils/FeedUtils';
import { showErrorToast } from 'utils/ToastUtils';
import { ActivityFeedProviderContextType } from './ActivityFeedProviderContext.interface';

interface Props {
  children: ReactNode;
}

export const ActivityFeedContext = createContext(
  {} as ActivityFeedProviderContextType
);

const ActivityFeedProvider = ({ children }: Props) => {
  const { t } = useTranslation();
  const [entityThread, setEntityThread] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDrawerLoading, setIsDrawerLoading] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedThread, setSelectedThread] = useState<Thread>();

  const currentUser = useMemo(
    () => AppState.getCurrentUserDetails(),
    [AppState.userDetails, AppState.nonSecureUserDetails]
  );

  const getFeedDataById = useCallback(async (id) => {
    try {
      setIsDrawerLoading(true);
      const res = await getFeedById(id);
      setSelectedThread(res.data);
    } catch (err) {
      showErrorToast(
        err as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.message-plural-lowercase'),
        })
      );
    } finally {
      setIsDrawerLoading(false);
    }
  }, []);

  const getFeedData = useCallback(
    async (filterType?: FeedFilter, after?: string, type?: ThreadType) => {
      try {
        setLoading(true);
        const feedFilterType = filterType ?? FeedFilter.ALL;
        const userId =
          feedFilterType === FeedFilter.ALL ? undefined : currentUser?.id;

        const { data } = await getFeedsWithFilter(
          userId,
          feedFilterType,
          after,
          type
        );
        setEntityThread([...data]);
      } catch (err) {
        showErrorToast(
          err as AxiosError,
          t('server.entity-fetch-error', {
            entity: t('label.activity-feed'),
          })
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Here value is the post message and id can be thread id or post id.
  const postFeed = useCallback(async (value: string, id: string) => {
    const currentUser = AppState.userDetails?.name ?? AppState.users[0]?.name;

    const data = {
      message: value,
      from: currentUser,
    } as Post;

    try {
      const res = await postFeedById(id, data);
      const { id: responseId, posts } = res;
      setEntityThread((pre) => {
        return pre.map((thread) => {
          if (thread.id === responseId) {
            return { ...res, posts: posts?.slice(-3) };
          } else {
            return thread;
          }
        });
      });
      setActiveThread(res);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.add-entity-error', {
          entity: t('label.feed-plural'),
        })
      );
    }
  }, []);

  const refreshActivityFeed = useCallback((threads) => {
    setEntityThread([...threads]);
  }, []);

  const deleteFeed = useCallback(
    async (threadId: string, postId: string, isThread: boolean) => {
      if (isThread) {
        const data = await deleteThread(threadId);
        setEntityThread((prev) =>
          prev.filter((thread) => thread.id !== data.id)
        );
      } else {
        const deleteResponse = await deletePostById(threadId, postId);
        if (deleteResponse) {
          const data = await getUpdatedThread(threadId);
          setEntityThread((pre) => {
            return pre.map((thread) => {
              if (thread.id === data.id) {
                return {
                  ...thread,
                };
              } else {
                return thread;
              }
            });
          });
          setActiveThread(data);
        }
      }
    },
    []
  );

  const setActiveThread = useCallback((active: Thread) => {
    setSelectedThread(active);
  }, []);

  const updateFeed = useCallback(
    (
      threadId: string,
      postId: string,
      isThread: boolean,
      data: Operation[]
    ) => {
      updateThreadData(threadId, postId, isThread, data, setEntityThread);
    },
    []
  );

  const showDrawer = useCallback((thread: Thread) => {
    setIsDrawerOpen(true);
    getFeedDataById(thread.id);
  }, []);

  const hideDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  const authProviderContext = {
    entityThread,
    selectedThread,
    isDrawerOpen,
    loading,
    isDrawerLoading,
    refreshActivityFeed,
    deleteFeed,
    postFeed,
    updateFeed,
    getFeedData,
    showDrawer,
    hideDrawer,
  };

  return (
    <ActivityFeedContext.Provider value={authProviderContext}>
      {children}
    </ActivityFeedContext.Provider>
  );
};

export const useActivityFeedProvider = () => useContext(ActivityFeedContext);

export default ActivityFeedProvider;
