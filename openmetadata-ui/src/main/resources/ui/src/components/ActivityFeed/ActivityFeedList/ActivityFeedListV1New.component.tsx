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
import { isEmpty } from 'lodash';
import { ReactNode, useEffect, useMemo } from 'react';
import { ReactComponent as FeedEmptyIcon } from '../../../assets/svg/ic-task-empty.svg';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { ActivityEvent } from '../../../generated/entity/activity/activityEvent';
import { Thread } from '../../../generated/entity/feed/thread';
import { filterUserGeneratedThreads } from '../../../utils/FeedUtilsPure';
import ErrorPlaceHolderNew from '../../common/ErrorWithPlaceholder/ErrorPlaceHolderNew';
import Loader from '../../common/Loader/Loader';
import FeedPanelBodyV1New from '../ActivityFeedPanel/FeedPanelBodyV1New';

type MergedFeedItem =
  | {
      id: string;
      timestamp: number;
      kind: 'activity';
      activity: ActivityEvent;
    }
  | { id: string; timestamp: number; kind: 'thread'; feed: Thread };

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
  selectedActivity?: ActivityEvent;
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
  selectedActivity,
  onAfterClose,
  onUpdateEntityDetails,
  handlePanelResize,
  isFeedWidget = false,
  isFullSizeWidget = false,
}: ActivityFeedListV1Props) => {
  const userThreads = useMemo(
    () => filterUserGeneratedThreads(feedList),
    [feedList]
  );

  // Activity events and user conversations are two live sources for the same
  // timeline, so they are merged once here and that single ordering drives both
  // the rendered list and which item the right panel opens on.
  const mergedItems = useMemo<MergedFeedItem[]>(() => {
    const activityItems = (activityList ?? []).map<MergedFeedItem>(
      (activity) => ({
        id: activity.id,
        timestamp: activity.timestamp,
        kind: 'activity',
        activity,
      })
    );

    // `updatedAt` is what the feed API paginates on, so ordering by it keeps
    // every newly fetched page strictly below what is already on screen.
    const threadItems = userThreads.map<MergedFeedItem>((feed) => ({
      id: feed.id,
      timestamp: feed.updatedAt ?? feed.threadTs ?? 0,
      kind: 'thread',
      feed,
    }));

    return [...activityItems, ...threadItems].sort(
      (a, b) => b.timestamp - a.timestamp
    );
  }, [activityList, userThreads]);

  useEffect(() => {
    const hasSelection = mergedItems.some(
      (item) =>
        item.id === selectedThread?.id || item.id === selectedActivity?.id
    );

    if (isLoading || hasSelection || isEmpty(mergedItems)) {
      return;
    }

    const [topItem] = mergedItems;

    if (topItem.kind === 'activity') {
      onActivityClick?.(topItem.activity);
    } else {
      onFeedClick?.(topItem.feed);
    }
  }, [
    mergedItems,
    selectedThread,
    selectedActivity,
    onFeedClick,
    onActivityClick,
    isLoading,
  ]);

  useEffect(() => {
    handlePanelResize?.(isEmpty(mergedItems));
  }, [mergedItems]);

  const feeds = useMemo(
    () =>
      mergedItems.map((item) =>
        item.kind === 'activity' ? (
          <FeedPanelBodyV1New
            activity={item.activity}
            handlePanelResize={handlePanelResize}
            hidePopover={hidePopover}
            isActive={activeFeedId === item.id}
            isFeedWidget={isFeedWidget}
            isForFeedTab={isForFeedTab}
            isFullSizeWidget={isFullSizeWidget}
            isFullWidth={isFullWidth}
            key={item.id}
            showThread={showThread}
            onActivityClick={onActivityClick}
            onAfterClose={onAfterClose}
            onUpdateEntityDetails={onUpdateEntityDetails}
          />
        ) : (
          <FeedPanelBodyV1New
            feed={item.feed}
            handlePanelResize={handlePanelResize}
            hidePopover={hidePopover}
            isActive={activeFeedId === item.id}
            isFeedWidget={isFeedWidget}
            isForFeedTab={isForFeedTab}
            isFullSizeWidget={isFullSizeWidget}
            isFullWidth={isFullWidth}
            key={item.id}
            showThread={showThread}
            onAfterClose={onAfterClose}
            onFeedClick={onFeedClick}
            onUpdateEntityDetails={onUpdateEntityDetails}
          />
        )
      ),
    [
      mergedItems,
      activeFeedId,
      componentsVisibility,
      handlePanelResize,
      hidePopover,
      isFeedWidget,
      isForFeedTab,
      isFullSizeWidget,
      isFullWidth,
      showThread,
      onActivityClick,
      onAfterClose,
      onFeedClick,
      onUpdateEntityDetails,
    ]
  );

  if (isLoading) {
    return <Loader />;
  }

  const hasNoData = isEmpty(mergedItems);

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
