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
import classNames from 'classnames';
import { isEmpty, isUndefined } from 'lodash';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { ReactComponent as FeedEmptyIcon } from '../../../assets/svg/ic-task-empty.svg';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { ActivityEvent } from '../../../generated/entity/activity/activityEvent';
import { Thread } from '../../../generated/entity/feed/thread';
import { getFeedListWithRelativeDays } from '../../../utils/FeedUtils';
import ErrorPlaceHolderNew from '../../common/ErrorWithPlaceholder/ErrorPlaceHolderNew';
import Loader from '../../common/Loader/Loader';
import FeedPanelBodyV1New from '../ActivityFeedPanel/FeedPanelBodyV1New';

interface ActivityFeedListV1Props {
  feedList?: Thread[];
  activityList?: ActivityEvent[];
  isLoading: boolean;
  showThread?: boolean;
  onFeedClick?: (feed: Thread) => void;
  onActivityClick?: (activity: ActivityEvent) => void;
  activeFeedId?: string;
  hidePopover: boolean;
  isForFeedTab?: boolean;
  emptyPlaceholderText: ReactNode;
  componentsVisibility?: {
    showThreadIcon?: boolean;
    showRepliesContainer?: boolean;
  };
  selectedThread?: Thread;
  onAfterClose?: () => void;
  onUpdateEntityDetails?: () => void;
  handlePanelResize?: (isFullWidth: boolean) => void;
  isFullWidth?: boolean;
  isFeedWidget?: boolean;
  isFullSizeWidget?: boolean;
}

const ActivityFeedListV1New = ({
  feedList,
  activityList,
  isLoading,
  showThread = true,
  componentsVisibility = {
    showThreadIcon: true,
    showRepliesContainer: true,
  },
  onFeedClick,
  onActivityClick,
  activeFeedId,
  hidePopover = false,
  isForFeedTab = false,
  isFullWidth,
  emptyPlaceholderText,
  selectedThread,
  onAfterClose,
  onUpdateEntityDetails,
  handlePanelResize,
  isFeedWidget = false,
  isFullSizeWidget = false,
}: ActivityFeedListV1Props) => {
  const [entityThread, setEntityThread] = useState<Thread[]>([]);
  const isActivityMode = !isUndefined(activityList) && activityList.length > 0;

  useEffect(() => {
    if (feedList && !isActivityMode) {
      const { updatedFeedList } = getFeedListWithRelativeDays(feedList);
      setEntityThread(updatedFeedList);
    }
  }, [feedList, isActivityMode]);

  useEffect(() => {
    if (!isActivityMode) {
      const thread = entityThread.find(
        (feed) => feed.id === selectedThread?.id
      );

      if (onFeedClick && (isUndefined(selectedThread) || isUndefined(thread))) {
        onFeedClick(entityThread[0]);
      }
    }
  }, [entityThread, selectedThread, onFeedClick, isActivityMode]);

  useEffect(() => {
    const listToCheck = isActivityMode ? activityList : feedList;
    if (isEmpty(listToCheck) && handlePanelResize) {
      handlePanelResize?.(true);
    } else {
      handlePanelResize?.(false);
    }
  }, [feedList, activityList, isActivityMode]);

  const feeds = useMemo(() => {
    if (isActivityMode && activityList) {
      return activityList.map((activity) => (
        <FeedPanelBodyV1New
          activity={activity}
          handlePanelResize={handlePanelResize}
          hidePopover={hidePopover}
          isActive={activeFeedId === activity.id}
          isFeedWidget={isFeedWidget}
          isForFeedTab={isForFeedTab}
          isFullSizeWidget={isFullSizeWidget}
          isFullWidth={isFullWidth}
          key={activity.id}
          showThread={false}
          onActivityClick={onActivityClick}
          onAfterClose={onAfterClose}
          onUpdateEntityDetails={onUpdateEntityDetails}
        />
      ));
    }

    return entityThread.map((feed) => (
      <FeedPanelBodyV1New
        feed={feed}
        handlePanelResize={handlePanelResize}
        hidePopover={hidePopover}
        isActive={activeFeedId === feed.id}
        isFeedWidget={isFeedWidget}
        isForFeedTab={isForFeedTab}
        isFullSizeWidget={isFullSizeWidget}
        isFullWidth={isFullWidth}
        key={feed.id}
        showThread={showThread}
        onAfterClose={onAfterClose}
        onFeedClick={onFeedClick}
        onUpdateEntityDetails={onUpdateEntityDetails}
      />
    ));
  }, [
    entityThread,
    activityList,
    isActivityMode,
    activeFeedId,
    componentsVisibility,
    hidePopover,
    isForFeedTab,
    showThread,
    isFullWidth,
    isFullSizeWidget,
    onActivityClick,
  ]);
  if (isLoading) {
    return <Loader />;
  }

  const hasNoData = isActivityMode
    ? isEmpty(activityList)
    : isEmpty(entityThread) && isEmpty(feedList);

  if (hasNoData && !isLoading) {
    return (
      <div
        className="p-x-md no-data-placeholder-container h-full"
        data-testid="no-data-placeholder-container"
        id="feedData">
        <ErrorPlaceHolderNew
          icon={<FeedEmptyIcon height={140} width={140} />}
          type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
          <Typography.Paragraph
            className="placeholder-text"
            style={{ marginBottom: '0' }}>
            {emptyPlaceholderText}
          </Typography.Paragraph>
        </ErrorPlaceHolderNew>
      </div>
    );
  }

  return (
    <div
      className={classNames({
        'feed-widget-padding': isForFeedTab,
        'activity-feed-tab-padding': !isForFeedTab,
      })}
      id="feedData">
      {feeds}
    </div>
  );
};

export default ActivityFeedListV1New;
