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
import { Tabs } from 'antd';
import AppState from 'AppState';
import ActivityFeedListV1 from 'components/ActivityFeed/ActivityFeedList/ActivityFeedListV1.component';
import { useActivityFeedProvider } from 'components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { ActivityFeedTabs } from 'components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import { useTourProvider } from 'components/TourProvider/TourProvider';
import { mockFeedData } from 'constants/mockTourData.constants';
import { FeedFilter } from 'enums/mydata.enum';
import { ThreadTaskStatus, ThreadType } from 'generated/entity/feed/thread';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getFeedsWithFilter } from 'rest/feedsAPI';
import { getCountBadge } from 'utils/CommonUtils';
import { showErrorToast } from 'utils/ToastUtils';
import './feeds-widget.less';

const FeedsWidget = () => {
  const { t } = useTranslation();
  const { isTourOpen } = useTourProvider();
  const [activeTab, setActiveTab] = useState<ActivityFeedTabs>(
    ActivityFeedTabs.ALL
  );
  const { loading, entityThread, getFeedData } = useActivityFeedProvider();
  const [taskCount, setTaskCount] = useState(0);
  const currentUser = useMemo(
    () => AppState.getCurrentUserDetails(),
    [AppState.userDetails, AppState.nonSecureUserDetails]
  );

  useEffect(() => {
    if (activeTab === ActivityFeedTabs.ALL) {
      getFeedData(FeedFilter.OWNER, undefined, ThreadType.Conversation).catch(
        () => {
          // ignore since error is displayed in toast in the parent promise.
          // Added block for sonar code smell
        }
      );
    } else if (activeTab === ActivityFeedTabs.MENTIONS) {
      getFeedData(FeedFilter.MENTIONS).catch(() => {
        // ignore since error is displayed in toast in the parent promise.
        // Added block for sonar code smell
      });
    } else if (activeTab === ActivityFeedTabs.TASKS) {
      getFeedData(FeedFilter.OWNER, undefined, ThreadType.Task)
        .then((data) => {
          const openTasks = data.filter(
            (item) => item.task?.status === ThreadTaskStatus.Open
          );
          setTaskCount(openTasks.length);
        })
        .catch(() => {
          // ignore since error is displayed in toast in the parent promise.
          // Added block for sonar code smell
        });
    }
  }, [activeTab]);

  const countBadge = useMemo(() => {
    return getCountBadge(taskCount, '', activeTab === 'tasks');
  }, [taskCount, activeTab]);

  const onTabChange = (key: string) => setActiveTab(key as ActivityFeedTabs);

  useEffect(() => {
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
              <ActivityFeedListV1
                emptyPlaceholderText={t('message.no-activity-feed')}
                feedList={isTourOpen ? mockFeedData : threads}
                hidePopover={false}
                isLoading={loading && !isTourOpen}
                showThread={false}
                tab={ActivityFeedTabs.ALL}
              />
            ),
          },
          {
            label: `@${t('label.mention-plural')}`,
            key: ActivityFeedTabs.MENTIONS,
            children: (
              <ActivityFeedListV1
                emptyPlaceholderText={t('message.no-mentions')}
                feedList={threads}
                hidePopover={false}
                isLoading={loading}
                showThread={false}
                tab={ActivityFeedTabs.MENTIONS}
              />
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
              <ActivityFeedListV1
                emptyPlaceholderText={t('message.no-tasks-assigned')}
                feedList={threads}
                hidePopover={false}
                isLoading={loading}
                showThread={false}
                tab={ActivityFeedTabs.TASKS}
              />
            ),
          },
        ]}
        onChange={onTabChange}
      />
    </div>
  );
};

export default FeedsWidget;
