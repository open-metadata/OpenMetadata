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
import { Menu } from 'antd';
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
import { getCountBadge } from 'utils/CommonUtils';
import { getEntityFeedLink } from 'utils/EntityUtils';
import { deletePost, updateThreadData } from 'utils/FeedUtils';
import { showErrorToast } from 'utils/ToastUtils';
import { ActivityFilters } from '../ActivityFeedList/ActivityFeedList.interface';
import ActivityFeedListV1 from '../ActivityFeedList/ActivityFeedListV1.component';

type FeedKeys = 'all' | 'mentions' | 'tasks';

export const ActivityFeedTab = ({
  entityType,
  fqn,
  count,
  taskCount,
  mentionCount,
  onFeedUpdate,
}: {
  entityType: EntityType;
  fqn: string;
  entityName: string;
  onFeedUpdate: () => void;
  count: number;
  taskCount: number;
  mentionCount: number;
}) => {
  const { id: userId, name: userName } = AppState.getCurrentUserDetails() ?? {};

  const [isLoading, setIsLoading] = useState(true);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [paging, setPaging] = useState<Paging>(pagingObject);
  const [activityFilter, setActivityFilter] = useState<ActivityFilters>();
  const { t } = useTranslation();
  const [elementRef, isInView] = useElementInView(observerOptions);
  const [activeTab, setActiveTab] = useState<FeedKeys>('all');

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
    <div className="d-flex ">
      <Menu
        className="custom-menu w-72 p-t-sm"
        data-testid="global-setting-left-panel"
        items={[
          {
            label: (
              <div className="d-flex justify-between">
                <span className="font-normal">{t('label.all')}</span>
                <span>{getCountBadge(count)}</span>
              </div>
            ),
            key: 'all',
          },
          {
            label: (
              <div className="d-flex justify-between">
                <span className="font-normal">{t('label.mention-plural')}</span>
                <span>{getCountBadge(mentionCount)}</span>
              </div>
            ),
            key: 'mentions',
          },
          {
            label: (
              <div className="d-flex justify-between">
                <span className="font-normal">{t('label.task-plural')}</span>
                <span>{getCountBadge(taskCount)}</span>
              </div>
            ),
            key: 'tasks',
          },
        ]}
        mode="inline"
        selectedKeys={[activeTab]}
        style={{
          flex: '0 0 250px',
          borderRight: '1px solid rgba(0, 0, 0, 0.1)',
        }}
        onClick={(info) => setActiveTab(info.key as FeedKeys)}
      />

      <div style={{ flex: '0 0 calc(50% - 125px)' }}>
        <div
          className="w-full"
          data-testid="observer-element"
          id="observer-element"
          ref={elementRef as RefObject<HTMLDivElement>}
        />
        <ActivityFeedListV1
          feedList={threads}
          isLoading={isLoading}
          showThread={false}
        />

        {loader}
      </div>
      <div style={{ flex: '0 0 calc(50% - 125px)' }}> </div>
    </div>
  );
};
