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
import Loader from 'components/Loader/Loader';
import { pagingObject } from 'constants/constants';
import { observerOptions } from 'constants/Mydata.constants';
import { EntityType } from 'enums/entity.enum';
import { FeedFilter } from 'enums/mydata.enum';
import { Operation } from 'fast-json-patch';
import { Post, Thread, ThreadType } from 'generated/entity/feed/thread';
import { Paging } from 'generated/type/paging';
import { useElementInView } from 'hooks/useElementInView';
import {
  default as React,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { getAllFeeds, postFeedById } from 'rest/feedsAPI';
import { getEntityFeedLink } from 'utils/EntityUtils';
import { deletePost, updateThreadData } from 'utils/FeedUtils';
import { showErrorToast } from 'utils/ToastUtils';
import ActivityFeedList from '../ActivityFeedList/ActivityFeedList';
import { ActivityFilters } from '../ActivityFeedList/ActivityFeedList.interface';

export const ActivityFeedTab = ({
  entityType,
  fqn,
  entityName,
  onFeedUpdate,
}: {
  entityType: EntityType;
  fqn: string;
  entityName: string;
  onFeedUpdate: () => void;
}) => {
  const { id: userId, name: userName } = AppState.getCurrentUserDetails() ?? {};

  const [isLoading, setIsLoading] = useState(true);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [paging, setPaging] = useState<Paging>(pagingObject);
  const [activityFilter, setActivityFilter] = useState<ActivityFilters>();
  const { t } = useTranslation();
  const [elementRef, isInView] = useElementInView(observerOptions);

  const getFeedData = async (
    after?: string,
    feedType?: FeedFilter,
    threadType?: ThreadType
  ) => {
    setIsLoading(true);
    try {
      const { data, paging: pagingObj } = await getAllFeeds(
        getEntityFeedLink(entityType, fqn),
        after,
        threadType,
        feedType,
        undefined,
        userId
      );
      setPaging(pagingObj);
      setThreads((prevData) => [...(after ? prevData : []), ...data]);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.entity-feed-plural'),
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedFetchFromFeedList = (
    after?: string,
    feedType?: FeedFilter,
    threadType?: ThreadType
  ) => {
    !after && setThreads([]);
    getFeedData(after, feedType, threadType);
  };

  useEffect(() => {
    getFeedData();
  }, []);

  const fetchMoreThread = (
    isElementInView: boolean,
    pagingObj: Paging,
    isLoading: boolean
  ) => {
    if (isElementInView && pagingObj?.after && !isLoading) {
      handleFeedFetchFromFeedList(
        pagingObj.after,
        activityFilter?.feedFilter,
        activityFilter?.threadType
      );
    }
  };

  useEffect(() => {
    fetchMoreThread(isInView, paging, isLoading);
  }, [paging, isLoading, isInView]);

  const postFeedHandler = async (value: string, id: string) => {
    const data = {
      message: value,
      from: userName,
    } as Post;

    try {
      const res = await postFeedById(id, data);
      const { id: responseId, posts } = res;
      setThreads((pre) => {
        return pre.map((thread) => {
          if (thread.id === responseId) {
            return { ...res, posts: posts?.slice(-3) };
          } else {
            return thread;
          }
        });
      });
      onFeedUpdate();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.add-entity-error', {
          entity: t('label.feed-plural'),
        })
      );
    }
  };

  //   const createThread = async (data: CreateThread) => {
  //     try {
  //       const res = await postThread(data);
  //       setThreads((pre) => [...pre, res]);
  //       onFeedUpdate();
  //     } catch (error) {
  //       showErrorToast(
  //         error as AxiosError,
  //         t('server.create-entity-error', {
  //           entity: t('label.conversation'),
  //         })
  //       );
  //     }
  //   };

  const deletePostHandler = (
    threadId: string,
    postId: string,
    isThread: boolean
  ) => {
    deletePost(threadId, postId, isThread, setThreads);
  };

  const updateThreadHandler = (
    threadId: string,
    postId: string,
    isThread: boolean,
    data: Operation[]
  ) => {
    updateThreadData(threadId, postId, isThread, data, setThreads);
  };

  const loader = useMemo(() => (isLoading ? <Loader /> : null), [isLoading]);

  const handleFeedFilterChange = useCallback((feedType, threadType) => {
    setActivityFilter({ feedFilter: feedType, threadType });
    handleFeedFetchFromFeedList(undefined, feedType, threadType);
  }, []);

  return (
    <>
      <div
        data-testid="observer-element"
        id="observer-element"
        ref={elementRef as RefObject<HTMLDivElement>}
      />
      <ActivityFeedList
        isEntityFeed
        withSidePanel
        deletePostHandler={deletePostHandler}
        entityName={entityName}
        feedList={threads}
        isFeedLoading={isLoading}
        postFeedHandler={postFeedHandler}
        updateThreadHandler={updateThreadHandler}
        onFeedFiltersUpdate={handleFeedFilterChange}
      />

      {loader}
    </>
  );
};
