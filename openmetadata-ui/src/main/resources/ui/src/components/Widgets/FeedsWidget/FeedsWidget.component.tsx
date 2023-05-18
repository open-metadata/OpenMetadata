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
import { AxiosError } from 'axios';
import ActivityFeedListV1 from 'components/ActivityFeed/ActivityFeedList/ActivityFeedListV1.component';
import { FeedFilter } from 'enums/mydata.enum';
import { Thread, ThreadType } from 'generated/entity/feed/thread';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getFeedsWithFilter } from 'rest/feedsAPI';
import { showErrorToast } from 'utils/ToastUtils';
import './feeds-widget.less';

const FeedsWidget = () => {
  const { t } = useTranslation();
  const [entityThread, setEntityThread] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const currentUser = useMemo(
    () => AppState.getCurrentUserDetails(),
    [AppState.userDetails, AppState.nonSecureUserDetails]
  );

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
    [currentUser?.id]
  );

  useEffect(() => {
    if (activeTab === 'all') {
      getFeedData(FeedFilter.OWNER).catch(() => {
        // ignore since error is displayed in toast in the parent promise.
        // Added block for sonar code smell
      });
    } else if (activeTab === 'mentions') {
      getFeedData(FeedFilter.MENTIONS).catch(() => {
        // ignore since error is displayed in toast in the parent promise.
        // Added block for sonar code smell
      });
    } else if (activeTab === 'tasks') {
      getFeedData(FeedFilter.OWNER, undefined, ThreadType.Task).catch(() => {
        // ignore since error is displayed in toast in the parent promise.
        // Added block for sonar code smell
      });
    }
  }, [activeTab]);

  return (
    <div className="feeds-widget-container">
      <Tabs
        items={[
          {
            label: t('label.all'),
            key: 'all',
            children: (
              <ActivityFeedListV1 feedList={entityThread} isLoading={loading} />
            ),
          },
          {
            label: `@${t('label.mention-plural')}`,
            key: 'mentions',
            children: (
              <ActivityFeedListV1 feedList={entityThread} isLoading={loading} />
            ),
          },
          {
            label: t('label.task-plural'),
            key: 'tasks',
            children: (
              <ActivityFeedListV1 feedList={entityThread} isLoading={loading} />
            ),
          },
        ]}
        onChange={(key) => setActiveTab(key)}
      />
    </div>
  );
};

export default FeedsWidget;
