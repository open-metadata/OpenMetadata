/*
 *  Copyright 2022 Collate
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
import { Button, List, Tabs } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { Post, Thread } from '../../generated/entity/feed/thread';
import AppState from '../../AppState';
import { FeedFilter } from '../../enums/mydata.enum';
import { ThreadType } from '../../generated/api/feed/createThread';
import { getEntityFQN, getEntityType } from '../../utils/FeedUtils';
import { getFeedsWithFilter } from '../../axiosAPIs/feedsAPI';
import { AxiosError, AxiosResponse } from 'axios';
import { showErrorToast } from '../../utils/ToastUtils';
import jsonData from '../../jsons/en';
import Loader from '../Loader/Loader';
import { tabsInfo } from './NotificationBox.utils';
import NotificationFeedCard from './NotificationFeedCard.component';
import { getUserPath } from '../../constants/constants';

const NotificationBox = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [entityThread, setEntityThread] = useState<Thread[]>([]);

  const currentUser = useMemo(
    () => AppState.getCurrentUserDetails(),
    [AppState.userDetails, AppState.nonSecureUserDetails]
  );

  const notificationDropDownList = useMemo(() => {
    return entityThread.slice(0, 5).map((feed, idx) => {
      const mainFeed = {
        message: feed.message,
        postTs: feed.threadTs,
        from: feed.createdBy,
        id: feed.id,
        reactions: feed.reactions,
      } as Post;
      const entityType = getEntityType(feed.about as string);
      const entityFQN = getEntityFQN(feed.about as string);

      return (
        <NotificationFeedCard
          createdBy={mainFeed.from}
          entityFQN={entityFQN as string}
          entityType={entityType as string}
          feedType={feed.type || ThreadType.Conversation}
          key={`${mainFeed.from} ${idx}`}
          taskDetails={feed.task}
        />
      );
    });
  }, [entityThread]);

  const getData = (threadType: ThreadType, feedFilter: FeedFilter) => {
    setIsLoading(true);
    getFeedsWithFilter(currentUser?.id, feedFilter, undefined, threadType)
      .then((res: AxiosResponse) => {
        setEntityThread(res.data.data);
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-activity-feed-error']
        );
      });
    setIsLoading(false);
  };

  const handleChange = (key: string) => {
    switch (key) {
      case 'Task':
        getData(ThreadType.Task, FeedFilter.ASSIGNED_TO);

        break;

      case 'Mention':
        getData(ThreadType.Conversation, FeedFilter.MENTIONS);

        break;

      case 'Conversation':
        getData(ThreadType.Conversation, FeedFilter.ALL);

        break;
    }
  };

  useEffect(() => {
    getData(ThreadType.Task, FeedFilter.ALL);
  }, []);

  return (
    <div className="tw-bg-white tw-border tw-border-gray-100 tw-rounded tw-flex tw-flex-col tw-justify-between tw-shadow-lg">
      <div className="tw-flex tw-justify-between">
        <div className="tw-text-base tw-font-medium tw-px-4 tw-pt-3 tw-pb-1">
          Notifications
        </div>
        <Button
          href={`${getUserPath(
            currentUser?.name as string
          )}/tasks?feedFilter=ASSIGNED_TO`}
          type="link">
          <span className="tw-pt-2.5">view all</span>
        </Button>
      </div>
      {isLoading ? (
        <Loader />
      ) : (
        <Tabs
          defaultActiveKey="Task"
          size="small"
          tabBarGutter={24}
          tabBarStyle={{
            borderBottom: '1px solid #DCE3EC',
            margin: '0px',
            paddingLeft: '16px',
            color: 'inherit',
          }}
          onTabClick={handleChange}>
          {tabsInfo.map(({ name, key, icon }) => (
            <Tabs.TabPane
              key={key}
              tab={
                <span className="tw-flex tw-items-center">
                  {icon} {name}
                </span>
              }>
              <div className="tw-h-64 tw-overflow-scroll">
                {isEmpty(entityThread) ? (
                  <div className="tw-h-full tw-flex tw-items-center tw-justify-center">
                    <p>{`No ${name} Found`}</p>
                  </div>
                ) : (
                  <List
                    dataSource={notificationDropDownList}
                    renderItem={(item) => (
                      <List.Item
                        style={{
                          padding: '10px 0px 10px 16px',
                        }}>
                        {item}
                      </List.Item>
                    )}
                  />
                )}
              </div>
            </Tabs.TabPane>
          ))}
        </Tabs>
      )}
    </div>
  );
};

export default NotificationBox;
