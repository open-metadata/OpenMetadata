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
import { ReactNode, useEffect, useMemo } from 'react';
import { ReactComponent as FeedEmptyIcon } from '../../../assets/svg/ic-task-empty.svg';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { ActivityEvent } from '../../../generated/entity/activity/activityEvent';
import { Conversation } from '../../../generated/entity/feed/conversation';
import ErrorPlaceHolderNew from '../../common/ErrorWithPlaceholder/ErrorPlaceHolderNew';
import Loader from '../../common/Loader/Loader';
import FeedPanelBodyV1New from '../ActivityFeedPanel/FeedPanelBodyV1New';
interface ActivityFeedListV1Props {
  feedList?: Conversation[];
  activityList?: ActivityEvent[];
  isLoading: boolean;
  showThread?: boolean;
  onFeedClick?: (feed: Conversation) => void;
  onActivityClick?: (activity: ActivityEvent) => void;
  activeFeedId?: string;
  hidePopover: boolean;
  isForFeedTab?: boolean;
  emptyPlaceholderText: ReactNode;
  componentsVisibility?: {
    showThreadIcon?: boolean;
    showRepliesContainer?: boolean;
  };
  selectedThread?: Conversation;
  selectedActivity?: ActivityEvent;
  onAfterClose?: () => void;
  onUpdateEntityDetails?: () => void;
  handlePanelResize?: (isFullWidth: boolean) => void;
  isFullWidth?: boolean;
  isFeedWidget?: boolean;
  isFullSizeWidget?: boolean;
}

type ActivityFeedListItem =
  | {
      id: string;
      kind: 'activity';
      timestamp: number;
      value: ActivityEvent;
    }
  | {
      id: string;
      kind: 'conversation';
      timestamp: number;
      value: Conversation;
    };

const ActivityFeedListV1New = ({
  feedList,
  activityList,
  isLoading,
  showThread = true,
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
  const feedItems = useMemo<ActivityFeedListItem[]>(() => {
    const items: ActivityFeedListItem[] = [
      ...(activityList ?? []).map((activity) => ({
        id: activity.id,
        kind: 'activity' as const,
        timestamp: activity.timestamp,
        value: activity,
      })),
      ...(feedList ?? []).map((conversation) => ({
        id: conversation.id,
        kind: 'conversation' as const,
        timestamp: conversation.updatedAt,
        value: conversation,
      })),
    ];

    return items.sort(
      (left, right) =>
        right.timestamp - left.timestamp || left.id.localeCompare(right.id)
    );
  }, [activityList, feedList]);

  const selectedId = selectedActivity?.id ?? selectedThread?.id;

  useEffect(() => {
    const selectedItem = feedItems.find((item) => item.id === selectedId);

    if (selectedItem || feedItems.length === 0) {
      return;
    }

    const firstItem = feedItems[0];
    if (firstItem.kind === 'activity') {
      onActivityClick?.(firstItem.value);
    } else {
      onFeedClick?.(firstItem.value);
    }
  }, [feedItems, onActivityClick, onFeedClick, selectedId]);

  useEffect(() => {
    handlePanelResize?.(feedItems.length === 0);
  }, [feedItems.length, handlePanelResize]);

  const feeds = useMemo(
    () =>
      feedItems.map((item) =>
        item.kind === 'activity' ? (
          <FeedPanelBodyV1New
            activity={item.value}
            handlePanelResize={handlePanelResize}
            hidePopover={hidePopover}
            isActive={activeFeedId === item.id}
            isFeedWidget={isFeedWidget}
            isForFeedTab={isForFeedTab}
            isFullSizeWidget={isFullSizeWidget}
            isFullWidth={isFullWidth}
            key={`activity-${item.id}`}
            showThread={showThread}
            onActivityClick={onActivityClick}
            onAfterClose={onAfterClose}
            onUpdateEntityDetails={onUpdateEntityDetails}
          />
        ) : (
          <FeedPanelBodyV1New
            feed={item.value}
            handlePanelResize={handlePanelResize}
            hidePopover={hidePopover}
            isActive={activeFeedId === item.id}
            isFeedWidget={isFeedWidget}
            isForFeedTab={isForFeedTab}
            isFullSizeWidget={isFullSizeWidget}
            isFullWidth={isFullWidth}
            key={`conversation-${item.id}`}
            showThread={showThread}
            onAfterClose={onAfterClose}
            onFeedClick={onFeedClick}
            onUpdateEntityDetails={onUpdateEntityDetails}
          />
        )
      ),
    [
      activeFeedId,
      feedItems,
      handlePanelResize,
      hidePopover,
      isFeedWidget,
      isForFeedTab,
      isFullSizeWidget,
      isFullWidth,
      onActivityClick,
      onAfterClose,
      onFeedClick,
      onUpdateEntityDetails,
      showThread,
    ]
  );

  if (isLoading) {
    return <Loader />;
  }

  if (feedItems.length === 0) {
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
