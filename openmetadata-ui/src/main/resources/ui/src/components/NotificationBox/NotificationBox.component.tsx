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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconExport } from '../../assets/svg/ic-export.svg';
import { ReactComponent as IconMentions } from '../../assets/svg/ic-mentions.svg';
import { ReactComponent as IconTask } from '../../assets/svg/ic-task.svg';
import { ActivityFeedTabs } from '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import {
  getUserPath,
  NOTIFICATION_READ_TIMER,
} from '../../constants/constants';
import { EntityTabs } from '../../enums/entity.enum';
import { FeedFilter } from '../../enums/mydata.enum';
import { NotificationTabsKey } from '../../enums/notification.enum';
import { ThreadType } from '../../generated/api/feed/createThread';
import { Post, Thread } from '../../generated/entity/feed/thread';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { getFeedsWithFilter } from '../../rest/feedsAPI';
import { getEntityFQN, getEntityType } from '../../utils/FeedUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import Loader from '../common/Loader/Loader';
import { useEntityExportModalProvider } from '../Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import './notification-box.less';
import { NotificationBoxProp } from './NotificationBox.interface';
import { getFilters, tabsInfo } from './NotificationBox.utils';
import NotificationFeedCard from './NotificationFeedCard.component';

const NotificationBox = ({
  hasMentionNotification,
  hasTaskNotification,
  onMarkTaskNotificationRead,
  onMarkMentionsNotificationRead,
  onTabChange,
  hasExportAssetNotification,
  onMarkExportAssetNotificationRead,
}: NotificationBoxProp) => {
  const { csvExportJobs, onDownload } = useEntityExportModalProvider();

  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const [notifications, setNotifications] = useState<Thread[]>([]);
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
      const mainFeed = {
        message: feed.message,
        postTs: feed.threadTs,
        from: feed.createdBy,
        id: feed.id,
        reactions: feed.reactions,
      } as Post;
      const entityType = getEntityType(feed.about);
      const entityFQN = getEntityFQN(feed.about);

      return (
        <NotificationFeedCard
          createdBy={mainFeed.from}
          entityFQN={entityFQN as string}
          entityType={entityType as string}
          feedType={feed.type || ThreadType.Conversation}
          key={`${mainFeed.from} ${mainFeed.id}`}
          task={feed}
          timestamp={mainFeed.postTs}
        />
      );
    });
  }, [notifications]);

  const getNotificationData = (
    threadType: ThreadType,
    feedFilter: FeedFilter
  ) => {
    setIsLoading(true);
    getFeedsWithFilter(currentUser?.id, feedFilter, undefined, threadType)
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
  };

  const updateActiveTab = useCallback(
    (key: string) => {
      onTabChange(key);

      // if the tab is export data assets and has export asset notification then mark it as read
      if (key === NotificationTabsKey.EXPORT_DATA_ASSETS) {
        setNotifications([]);
        if (hasExportAssetNotification) {
          setTimeout(
            onMarkExportAssetNotificationRead,
            NOTIFICATION_READ_TIMER
          );
        }

        return;
      }

      const { threadType, feedFilter } = getFilters(key as ThreadType);

      getNotificationData(threadType, feedFilter);

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
      hasExportAssetNotification,
    ]
  );

  useEffect(() => {
    getNotificationData(ThreadType.Task, FeedFilter.ASSIGNED_TO);
  }, []);

  const getTabTitle = (name: string, key: string) => {
    let hasNotification = false;
    let iconComponent;

    switch (key) {
      case NotificationTabsKey.TASK: {
        hasNotification = hasTaskNotification;
        iconComponent = IconTask;

        break;
      }

      case NotificationTabsKey.CONVERSATION: {
        hasNotification = hasMentionNotification;
        iconComponent = IconMentions;

        break;
      }

      case NotificationTabsKey.EXPORT_DATA_ASSETS: {
        hasNotification = hasExportAssetNotification;
        iconComponent = IconExport;

        break;
      }

      default:
        break;
    }

    return (
      <Badge dot={hasNotification} offset={[5, 0]}>
        <Icon
          alt="notification-icon"
          className="align-middle m-r-xs"
          component={iconComponent}
          style={{ fontSize: '16px' }}
        />
        {name}
      </Badge>
    );
  };

  const getNotificationList = (key: NotificationTabsKey) => {
    const isExportDataAssetsTab =
      key === NotificationTabsKey.EXPORT_DATA_ASSETS;

    const activeCSVExportJobs = csvExportJobs.filter((job) => job.status);

    const hasActiveNotifications = isExportDataAssetsTab
      ? !isEmpty(activeCSVExportJobs)
      : !isEmpty(notifications);

    if (!hasActiveNotifications) {
      return (
        <div className="h-64 flex-center">
          <p>{t('message.no-notification-found')}</p>
        </div>
      );
    }

    const csvExportNotifications = activeCSVExportJobs.map((job) => {
      const isCompleted = job.status === 'COMPLETED';

      return (
        <List.Item.Meta
          className="m-0"
          description={
            <Typography>
              {isCompleted ? (
                <Typography.Text>
                  {`Export completed for ${job.fileName}`}{' '}
                  <Button
                    type="link"
                    onClick={() => onDownload(job.data ?? '', job.fileName)}>
                    {t('label.download')}
                  </Button>
                </Typography.Text>
              ) : (
                <Typography.Text type="danger">
                  {`Export failed for ${job.fileName}. ${job.error}`}
                </Typography.Text>
              )}
            </Typography>
          }
          key={job.jobId}
        />
      );
    });

    return (
      <List
        className="notification-content-container"
        dataSource={
          isExportDataAssetsTab
            ? csvExportNotifications
            : notificationDropDownList
        }
        footer={
          !isExportDataAssetsTab ? (
            <Button block href={viewAllPath} type="link">
              <span>
                {t('label.view-entity', {
                  entity: t('label.all-lowercase'),
                })}
              </span>
            </Button>
          ) : null
        }
        itemLayout="vertical"
        renderItem={(item) => (
          <List.Item className="notification-dropdown-list-btn cursor-pointer">
            {item}
          </List.Item>
        )}
        size="small"
      />
    );
  };

  return (
    <div className="notification-box">
      <Typography.Title
        className="p-x-md p-t-sm p-b-xss"
        data-testid="notification-heading"
        level={5}>
        {t('label.notification-plural')}
      </Typography.Title>
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
        onTabClick={updateActiveTab}>
        {tabsInfo.map(({ name, key }) => (
          <Tabs.TabPane key={key} tab={getTabTitle(name, key)}>
            {isLoading ? (
              <div className="h-64 d-flex items-center justify-center">
                <Loader size="small" />
              </div>
            ) : (
              <>{getNotificationList(key)}</>
            )}
          </Tabs.TabPane>
        ))}
      </Tabs>
    </div>
  );
};

export default NotificationBox;
