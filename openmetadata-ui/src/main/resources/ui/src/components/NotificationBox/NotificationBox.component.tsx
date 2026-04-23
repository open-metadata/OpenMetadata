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

import Icon from '@ant-design/icons/lib/components/Icon';
import { Badge, Button, List, Tabs, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconMentions } from '../../assets/svg/ic-mentions.svg';
import { ReactComponent as IconTask } from '../../assets/svg/ic-task.svg';
import { ActivityFeedTabs } from '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import {
  DEFAULT_DOMAIN_VALUE,
  NOTIFICATION_READ_TIMER,
} from '../../constants/constants';
import { EntityTabs } from '../../enums/entity.enum';
import { FeedFilter } from '../../enums/mydata.enum';
import { NotificationTabsKey } from '../../enums/notification.enum';
import { Post, Thread } from '../../generated/entity/feed/thread';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useDomainStore } from '../../hooks/useDomainStore';
import { getFeedsWithFilter } from '../../rest/feedsAPI';
import {
  listMyAssignedTasks,
  Task as TaskEntity,
  TaskEntityStatus,
} from '../../rest/tasksAPI';
import { getEntityFQN, getEntityType } from '../../utils/FeedUtils';
import { getUserPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import Loader from '../common/Loader/Loader';
import './notification-box.less';
import { NotificationBoxProp } from './NotificationBox.interface';
import { tabsInfo } from './NotificationBox.utils';
import NotificationFeedCard from './NotificationFeedCard.component';
import { MentionNotification } from './NotificationFeedCard.interface';

type NotificationItem = MentionNotification | TaskEntity;

const isTaskNotification = (
  notification: NotificationItem
): notification is TaskEntity => 'taskId' in notification;

const toMentionNotification = (thread: Thread): MentionNotification => ({
  id: thread.id,
  about: thread.about,
  createdBy: thread.createdBy,
  entityRef: thread.entityRef,
  message: thread.message,
  posts: thread.posts,
  reactions: thread.reactions,
  threadTs: thread.threadTs,
});

const NotificationBox = ({
  activeTab,
  hasMentionNotification,
  hasTaskNotification,
  onMarkTaskNotificationRead,
  onMarkMentionsNotificationRead,
  onTabChange,
}: NotificationBoxProp) => {
  const { t } = useTranslation();
  const activeDomain = useDomainStore((state) => state.activeDomain);
  const { currentUser } = useApplicationStore();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [viewAllPath, setViewAllPath] = useState<string>(
    getUserPath(
      currentUser?.name as string,
      EntityTabs.ACTIVITY_FEED,
      ActivityFeedTabs.TASKS
    )
  );

  const notificationDropDownList = useMemo(() => {
    return notifications.slice(0, 5).map((feed) => {
      if (isTaskNotification(feed)) {
        return (
          <NotificationFeedCard
            createdBy={feed.createdBy?.name ?? ''}
            entityFQN={feed.about?.fullyQualifiedName ?? ''}
            entityType={feed.about?.type ?? ''}
            key={`${feed.createdBy?.name ?? ''} ${feed.id}`}
            taskEntity={feed}
            timestamp={feed.createdAt}
          />
        );
      }

      const mainFeed = {
        message: feed.message,
        postTs: feed.threadTs,
        from: feed.createdBy,
        id: feed.id,
        reactions: feed.reactions,
      } as Post;
      const entityType = feed.entityRef?.type ?? getEntityType(feed.about);
      const entityFQN =
        feed.entityRef?.fullyQualifiedName ?? getEntityFQN(feed.about);

      let actualUser = mainFeed.from;
      let actualTimestamp = mainFeed.postTs;

      if (
        activeTab === NotificationTabsKey.CONVERSATION &&
        feed.posts &&
        feed.posts.length > 0
      ) {
        const mentionPost = feed.posts
          .filter(
            (post) =>
              post.message.includes('<#E::user::') && post.postTs !== undefined
          )
          .sort((a, b) => (b.postTs ?? 0) - (a.postTs ?? 0))[0];

        if (mentionPost?.postTs !== undefined) {
          actualUser = mentionPost.from;
          actualTimestamp = mentionPost.postTs;
        }
      }

      return (
        <NotificationFeedCard
          createdBy={actualUser}
          entityFQN={entityFQN as string}
          entityType={entityType as string}
          key={`${actualUser} ${mainFeed.id}`}
          mentionNotification={toMentionNotification(feed)}
          timestamp={actualTimestamp}
        />
      );
    });
  }, [notifications]);

  const getTaskNotificationData = useCallback(() => {
    setIsLoading(true);
    const domain =
      activeDomain !== DEFAULT_DOMAIN_VALUE ? activeDomain : undefined;
    listMyAssignedTasks({
      status: TaskEntityStatus.Open,
      fields: 'about,createdBy,assignees',
      limit: 10,
      domain,
    })
      .then((res) => {
        setNotifications(res.data);
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          t('server.entity-fetch-error', {
            entity: t('label.notification'),
          })
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [activeDomain, t]);

  const getMentionNotificationData = useCallback(() => {
    setIsLoading(true);
    getFeedsWithFilter(
      currentUser?.id,
      FeedFilter.MENTIONS,
      undefined,
      undefined
    )
      .then((res) => {
        setNotifications(res.data);
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          t('server.entity-fetch-error', {
            entity: t('label.notification'),
          })
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [currentUser?.id, t]);

  const updateActiveTab = useCallback(
    (key: string) => {
      onTabChange(key);

      if (key === NotificationTabsKey.TASK) {
        getTaskNotificationData();
      } else {
        getMentionNotificationData();
      }

      setViewAllPath(
        getUserPath(
          currentUser?.name as string,
          EntityTabs.ACTIVITY_FEED,
          key === NotificationTabsKey.TASK
            ? ActivityFeedTabs.TASKS
            : ActivityFeedTabs.MENTIONS
        )
      );

      if (hasTaskNotification || hasMentionNotification) {
        setTimeout(() => {
          key === NotificationTabsKey.TASK
            ? onMarkTaskNotificationRead()
            : onMarkMentionsNotificationRead();
        }, NOTIFICATION_READ_TIMER);
      }
    },
    [
      onTabChange,
      currentUser,
      hasTaskNotification,
      hasMentionNotification,
      getTaskNotificationData,
      getMentionNotificationData,
    ]
  );

  useEffect(() => {
    getTaskNotificationData();
  }, []);

  const getTabTitle = (name: string, key: string) => {
    return (
      <Badge
        dot={
          key === NotificationTabsKey.TASK
            ? hasTaskNotification
            : hasMentionNotification
        }
        offset={[5, 0]}>
        <Icon
          alt="notification-icon"
          className="align-middle m-r-xs"
          component={key === NotificationTabsKey.TASK ? IconTask : IconMentions}
          style={{ fontSize: '16px' }}
        />
        {name}
      </Badge>
    );
  };

  const notificationList = useMemo(
    () =>
      isEmpty(notifications) ? (
        <div className="h-64 flex-center">
          <p>{t('message.no-notification-found')}</p>
        </div>
      ) : (
        <List
          className="notification-content-container"
          dataSource={notificationDropDownList}
          footer={
            <Button block href={viewAllPath} type="link">
              <span>
                {t('label.view-entity', {
                  entity: t('label.all-lowercase'),
                })}
              </span>
            </Button>
          }
          itemLayout="vertical"
          renderItem={(item) => (
            <List.Item className="notification-dropdown-list-btn cursor-pointer">
              {item}
            </List.Item>
          )}
          size="small"
        />
      ),
    [notifications, notificationDropDownList, viewAllPath, t]
  );

  return (
    <div className="notification-box">
      <Typography.Title
        className="p-x-md p-t-sm p-b-xss"
        data-testid="notification-heading"
        level={5}>
        {t('label.notification-plural')}
      </Typography.Title>
      <Tabs
        className="tabs-new"
        defaultActiveKey="Task"
        size="small"
        tabBarGutter={24}
        tabBarStyle={{
          borderBottom: '1px solid #DCE3EC',
          margin: '0px',
          paddingLeft: '16px',
          color: 'inherit',
        }}
        onTabClick={updateActiveTab}>
        {tabsInfo.map(({ name, key }) => (
          <Tabs.TabPane key={key} tab={getTabTitle(name, key)}>
            {isLoading ? (
              <div className="h-64 d-flex items-center justify-center">
                <Loader size="small" />
              </div>
            ) : (
              notificationList
            )}
          </Tabs.TabPane>
        ))}
      </Tabs>
    </div>
  );
};

export default NotificationBox;
