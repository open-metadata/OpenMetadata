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
import { Button, Tabs, Typography } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import AppState from '../../../AppState';
import ActivityFeedListV1 from '../../../components/ActivityFeed/ActivityFeedList/ActivityFeedListV1.component';
import { useActivityFeedProvider } from '../../../components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { ActivityFeedTabs } from '../../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import { useTourProvider } from '../../../components/TourProvider/TourProvider';
import { mockFeedData } from '../../../constants/mockTourData.constants';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { FeedFilter } from '../../../enums/mydata.enum';
import {
  ThreadTaskStatus,
  ThreadType,
} from '../../../generated/entity/feed/thread';
import { getFeedsWithFilter } from '../../../rest/feedsAPI';
import { getCountBadge, getEntityDetailLink } from '../../../utils/CommonUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import FeedsFilterPopover from '../../common/FeedsFilterPopover/FeedsFilterPopover.component';
import './feeds-widget.less';

const FeedsWidget = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { isTourOpen } = useTourProvider();
  const [activeTab, setActiveTab] = useState<ActivityFeedTabs>(
    ActivityFeedTabs.ALL
  );
  const { loading, entityThread, entityPaging, getFeedData } =
    useActivityFeedProvider();
  const [taskCount, setTaskCount] = useState(0);
  const currentUser = useMemo(
    () => AppState.getCurrentUserDetails(),
    [AppState.userDetails, AppState.nonSecureUserDetails]
  );
  const [defaultFilter, setDefaultFilter] = useState<FeedFilter>(
    FeedFilter.OWNER_OR_FOLLOWS
  );

  useEffect(() => {
    if (activeTab === ActivityFeedTabs.ALL) {
      getFeedData(defaultFilter, undefined, ThreadType.Conversation);
    } else if (activeTab === ActivityFeedTabs.MENTIONS) {
      getFeedData(FeedFilter.MENTIONS);
    } else if (activeTab === ActivityFeedTabs.TASKS) {
      getFeedData(FeedFilter.OWNER, undefined, ThreadType.Task);
    }
  }, [activeTab, defaultFilter]);

  const countBadge = useMemo(() => {
    return getCountBadge(taskCount, '', activeTab === 'tasks');
  }, [taskCount, activeTab]);

  const onTabChange = (key: string) => setActiveTab(key as ActivityFeedTabs);

  const redirectToUserPage = useCallback(() => {
    history.push(
      getEntityDetailLink(
        EntityType.USER,
        currentUser?.name as string,
        EntityTabs.ACTIVITY_FEED,
        activeTab
      )
    );
  }, [activeTab, currentUser]);

  const moreButton = useMemo(() => {
    if (!loading && entityPaging.after) {
      return (
        <div className="p-x-md p-b-md">
          <Button className="w-full" onClick={redirectToUserPage}>
            <Typography.Text className="text-primary">
              {t('label.more')}
            </Typography.Text>
          </Button>
        </div>
      );
    }

    return null;
  }, [loading, entityPaging, redirectToUserPage]);
  const onFilterUpdate = (filter: FeedFilter) => {
    setDefaultFilter(filter);
  };

  useEffect(() => {
    setDefaultFilter(
      currentUser?.isAdmin ? FeedFilter.ALL : FeedFilter.OWNER_OR_FOLLOWS
    );
    getFeedsWithFilter(
      currentUser?.id,
      FeedFilter.OWNER,
      undefined,
      ThreadType.Task,
      ThreadTaskStatus.Open
    )
      .then((res) => {
        setTaskCount(res.data.length);
      })
      .catch((err) => {
        showErrorToast(err);
      });
  }, [currentUser]);

  const threads = useMemo(() => {
    if (activeTab === 'tasks') {
      return entityThread.filter(
        (thread) => thread.task?.status === ThreadTaskStatus.Open
      );
    }

    return entityThread;
  }, [activeTab, entityThread]);

  return (
    <div className="feeds-widget-container" data-testid="activity-feed-widget">
      <Tabs
        destroyInactiveTabPane
        items={[
          {
            label: t('label.all'),
            key: ActivityFeedTabs.ALL,
            children: (
              <>
                <ActivityFeedListV1
                  emptyPlaceholderText={t('message.no-activity-feed')}
                  feedList={isTourOpen ? mockFeedData : threads}
                  hidePopover={false}
                  isLoading={loading && !isTourOpen}
                  showThread={false}
                  tab={ActivityFeedTabs.ALL}
                />
                {moreButton}
              </>
            ),
          },
          {
            label: `@${t('label.mention-plural')}`,
            key: ActivityFeedTabs.MENTIONS,
            children: (
              <>
                <ActivityFeedListV1
                  emptyPlaceholderText={t('message.no-mentions')}
                  feedList={threads}
                  hidePopover={false}
                  isLoading={loading}
                  showThread={false}
                  tab={ActivityFeedTabs.MENTIONS}
                />
                {moreButton}
              </>
            ),
          },
          {
            label: (
              <>
                {`${t('label.task-plural')} `}
                {countBadge}
              </>
            ),
            key: ActivityFeedTabs.TASKS,
            children: (
              <>
                <ActivityFeedListV1
                  emptyPlaceholderText={t('message.no-tasks-assigned')}
                  feedList={threads}
                  hidePopover={false}
                  isLoading={loading}
                  showThread={false}
                  tab={ActivityFeedTabs.TASKS}
                />
                {moreButton}
              </>
            ),
          },
        ]}
        tabBarExtraContent={
          activeTab === ActivityFeedTabs.ALL && (
            <FeedsFilterPopover
              defaultFilter={
                currentUser?.isAdmin
                  ? FeedFilter.ALL
                  : FeedFilter.OWNER_OR_FOLLOWS
              }
              onUpdate={onFilterUpdate}
            />
          )
        }
        onChange={onTabChange}
      />
    </div>
  );
};

export default FeedsWidget;
