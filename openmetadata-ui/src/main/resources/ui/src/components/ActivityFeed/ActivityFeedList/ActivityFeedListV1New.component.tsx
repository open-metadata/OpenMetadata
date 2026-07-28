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
import { GeneratedBy, Thread } from '../../../generated/entity/feed/thread';
import { getFeedListWithRelativeDays } from '../../../utils/FeedUtilsPure';
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

  // System-generated threads were copied into activity_stream by the 2.0
  // migration, so rendering them alongside the activity events would duplicate
  // every row. Only user-authored conversations are still exclusive to the feed.
  const userThreads = useMemo(
    () =>
      entityThread.filter((feed) => feed.generatedBy !== GeneratedBy.System),
    [entityThread]
  );

  useEffect(() => {
    if (feedList) {
      const { updatedFeedList } = getFeedListWithRelativeDays(feedList);
      setEntityThread(updatedFeedList);
    }
  }, [feedList]);

  useEffect(() => {
    if (isActivityMode) {
      const activity = activityList?.find(
        (activity) => activity.id === selectedThread?.id
      );

      if (
        onActivityClick &&
        (isUndefined(selectedThread) || isUndefined(activity))
      ) {
        onActivityClick(activityList ? activityList[0] : ({} as ActivityEvent));
      }
    } else {
      const thread = userThreads.find((feed) => feed.id === selectedThread?.id);

      if (onFeedClick && (isUndefined(selectedThread) || isUndefined(thread))) {
        onFeedClick(userThreads[0]);
      }
    }
  }, [userThreads, selectedThread, onFeedClick, isActivityMode]);

  useEffect(() => {
    const isEmptyFeed = isEmpty(activityList) && isEmpty(userThreads);
    if (isEmptyFeed && handlePanelResize) {
      handlePanelResize?.(true);
    } else {
      handlePanelResize?.(false);
    }
  }, [userThreads, activityList]);

  const feeds = useMemo(() => {
    const activityItems = (activityList ?? []).map((activity) => ({
      timestamp: activity.timestamp ?? 0,
      node: (
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
          showThread={showThread}
          onActivityClick={onActivityClick}
          onAfterClose={onAfterClose}
          onUpdateEntityDetails={onUpdateEntityDetails}
        />
      ),
    }));

    const threadItems = userThreads.map((feed) => ({
      timestamp: feed.threadTs ?? feed.updatedAt ?? 0,
      node: (
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
      ),
    }));

    return [...activityItems, ...threadItems]
      .sort((a, b) => b.timestamp - a.timestamp)
      .map((item) => item.node);
  }, [
    userThreads,
    activityList,
    activeFeedId,
    componentsVisibility,
    hidePopover,
    isForFeedTab,
    showThread,
    isFullWidth,
    isFullSizeWidget,
    onActivityClick,
    onFeedClick,
  ]);
  if (isLoading) {
    return <Loader />;
  }

  const hasNoData = isEmpty(activityList) && isEmpty(userThreads);

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
