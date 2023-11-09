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
import { Typography } from 'antd';
import { isEmpty } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ActivityFeedIcon } from '../../../assets/svg/activity-feed.svg';
import { ReactComponent as TaskIcon } from '../../../assets/svg/ic-task.svg';
import ErrorPlaceHolder from '../../../components/common/error-with-placeholder/ErrorPlaceHolder';
import Loader from '../../../components/Loader/Loader';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../enums/common.enum';
import { Thread } from '../../../generated/entity/feed/thread';
import { getFeedListWithRelativeDays } from '../../../utils/FeedUtils';
import FeedPanelBodyV1 from '../ActivityFeedPanel/FeedPanelBodyV1';
import { ActivityFeedTabs } from '../ActivityFeedTab/ActivityFeedTab.interface';
import './activity-feed-list.less';

interface ActivityFeedListV1Props {
  feedList: Thread[];
  isLoading: boolean;
  showThread?: boolean;
  onFeedClick?: (feed: Thread) => void;
  activeFeedId?: string;
  hidePopover: boolean;
  isForFeedTab?: boolean;
  emptyPlaceholderText: string;
  tab: ActivityFeedTabs;
}

const ActivityFeedListV1 = ({
  feedList,
  isLoading,
  showThread = true,
  onFeedClick,
  activeFeedId,
  hidePopover = false,
  isForFeedTab = false,
  emptyPlaceholderText,
  tab,
}: ActivityFeedListV1Props) => {
  const { t } = useTranslation();
  const [entityThread, setEntityThread] = useState<Thread[]>([]);

  const isTaskTab = useMemo(() => tab === ActivityFeedTabs.TASKS, [tab]);

  useEffect(() => {
    const { updatedFeedList } = getFeedListWithRelativeDays(feedList);
    setEntityThread(updatedFeedList);
  }, [feedList]);

  useEffect(() => {
    if (onFeedClick && entityThread[0]) {
      onFeedClick(entityThread[0]);
    }
  }, [entityThread, onFeedClick]);

  if (isLoading) {
    return <Loader />;
  }

  return isEmpty(entityThread) ? (
    <div
      className="h-full p-x-md"
      data-testid="no-data-placeholder-container"
      id="feedData">
      <ErrorPlaceHolder
        icon={
          isTaskTab ? (
            <TaskIcon height={24} width={24} />
          ) : (
            <ActivityFeedIcon height={SIZE.MEDIUM} width={SIZE.MEDIUM} />
          )
        }
        type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
        <Typography.Paragraph
          className="tw-max-w-md"
          style={{ marginBottom: '0' }}>
          {isTaskTab && (
            <Typography.Text strong>
              {t('message.no-open-tasks')} <br />
            </Typography.Text>
          )}
          {emptyPlaceholderText}
        </Typography.Paragraph>
      </ErrorPlaceHolder>
    </div>
  ) : (
    <div className="feed-list-container p-y-md" id="feedData">
      {entityThread.map((feed) => (
        <FeedPanelBodyV1
          feed={feed}
          hidePopover={hidePopover}
          isActive={activeFeedId === feed.id}
          isForFeedTab={isForFeedTab}
          key={feed.id}
          showThread={showThread}
          onFeedClick={onFeedClick}
        />
      ))}
    </div>
  );
};

export default ActivityFeedListV1;
