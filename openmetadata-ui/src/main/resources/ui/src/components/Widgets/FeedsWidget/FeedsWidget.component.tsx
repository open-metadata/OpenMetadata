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
import { FeedFilter } from 'enums/mydata.enum';
import { ThreadType } from 'generated/entity/feed/thread';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getFeedsWithFilter } from 'rest/feedsAPI';
import { getCountBadge } from 'utils/CommonUtils';
import { showErrorToast } from 'utils/ToastUtils';
import './feeds-widget.less';

const FeedsWidget = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('all');
  const { loading, entityThread, getFeedData } = useActivityFeedProvider();
  const [taskCount, setTaskCount] = useState(0);
  const currentUser = useMemo(
    () => AppState.getCurrentUserDetails(),
    [AppState.userDetails, AppState.nonSecureUserDetails]
  );

  useEffect(() => {
    if (activeTab === 'all') {
      getFeedData(FeedFilter.OWNER, undefined, ThreadType.Conversation).catch(
        () => {
          // ignore since error is displayed in toast in the parent promise.
          // Added block for sonar code smell
        }
      );
    } else if (activeTab === 'mentions') {
      getFeedData(FeedFilter.MENTIONS).catch(() => {
        // ignore since error is displayed in toast in the parent promise.
        // Added block for sonar code smell
      });
    } else if (activeTab === 'tasks') {
      getFeedData(FeedFilter.OWNER, undefined, ThreadType.Task)
        .then((data) => {
          setTaskCount(data.length);
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

  useEffect(() => {
    getFeedsWithFilter(
      currentUser?.id,
      FeedFilter.OWNER,
      undefined,
      ThreadType.Task
    )
      .then((res) => {
        setTaskCount(res.data.length);
      })
      .catch((err) => {
        showErrorToast(err);
      });
  }, [currentUser]);

  return (
    <div className="feeds-widget-container">
      <Tabs
        items={[
          {
            label: t('label.all'),
            key: 'all',
            children: (
              <ActivityFeedListV1
                feedList={entityThread}
                hidePopover={false}
                isLoading={loading}
                showThread={false}
              />
            ),
          },
          {
            label: `@${t('label.mention-plural')}`,
            key: 'mentions',
            children: (
              <ActivityFeedListV1
                feedList={entityThread}
                hidePopover={false}
                isLoading={loading}
                showThread={false}
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
            key: 'tasks',
            children: (
              <ActivityFeedListV1
                feedList={entityThread}
                hidePopover={false}
                isLoading={loading}
                showThread={false}
              />
            ),
          },
        ]}
        onChange={(key) => setActiveTab(key)}
      />
    </div>
  );
};

export default FeedsWidget;
