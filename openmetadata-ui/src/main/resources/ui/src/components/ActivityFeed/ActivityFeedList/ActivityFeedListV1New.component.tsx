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
import { ReactNode, useEffect, useMemo, useRef } from 'react';
import { ReactComponent as FeedEmptyIcon } from '../../../assets/svg/ic-task-empty.svg';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { ActivityEvent } from '../../../generated/entity/activity/activityEvent';
import { Conversation } from '../../../generated/entity/feed/conversation';
import ErrorPlaceHolderNew from '../../common/ErrorWithPlaceholder/ErrorPlaceHolderNew';
import Loader from '../../common/Loader/Loader';
import FeedPanelBodyV1New from '../ActivityFeedPanel/FeedPanelBodyV1New';

type MergedFeedItem =
  | { type: 'feed'; id: string; timestamp: number; feed: Conversation }
  | {
      type: 'activity';
      id: string;
      timestamp: number;
      activity: ActivityEvent;
    };

const getConversationTimestamp = (feed: Conversation): number =>
  feed.updatedAt ?? feed.createdAt ?? 0;
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
  const mergedList = useMemo<MergedFeedItem[]>(() => {
    const feedItems: MergedFeedItem[] = (feedList ?? []).map((feed) => ({
      type: 'feed',
      id: feed.id,
      timestamp: getConversationTimestamp(feed),
      feed,
    }));
    const activityItems: MergedFeedItem[] = (activityList ?? []).map(
      (activity) => ({
        type: 'activity',
        id: activity.id,
        timestamp: activity.timestamp ?? 0,
        activity,
      })
    );

    return [...activityItems, ...feedItems].sort(
      (a, b) => b.timestamp - a.timestamp || a.id.localeCompare(b.id)
    );
  }, [feedList, activityList]);

  // Id of the item WE auto-selected, so we can tell our own selection apart
  // from a deliberate user click.
  const autoSelectedIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (isFeedWidget) {
      return;
    }

    const firstItem = mergedList[0];
    if (isUndefined(firstItem)) {
      return;
    }

    const currentSelectedId = selectedThread?.id ?? selectedActivity?.id;
    const selectionInList =
      !isUndefined(currentSelectedId) &&
      mergedList.some((item) => item.id === currentSelectedId);

    // A real, in-list selection that isn't our own auto-pick means the user
    // deliberately chose it — never override that. (A stale selection no longer
    // in the list falls through so we can re-select the newest item.)
    const userHasChosen =
      selectionInList && currentSelectedId !== autoSelectedIdRef.current;
    if (userHasChosen) {
      return;
    }

    // Already on the newest item — nothing to do.
    if (firstItem.id === currentSelectedId) {
      return;
    }

    // No user choice yet: keep the newest (first) item selected as the two
    // async sources (activities + conversations) settle. This makes the initial
    // selection deterministic regardless of which request resolves first —
    // otherwise the first response to arrive would lock in its own top item.
    autoSelectedIdRef.current = firstItem.id;
    if (firstItem.type === 'activity') {
      onActivityClick?.(firstItem.activity);
    } else {
      onFeedClick?.(firstItem.feed);
    }
  }, [
    mergedList,
    selectedThread,
    selectedActivity,
    onFeedClick,
    onActivityClick,
    isFeedWidget,
  ]);

  useEffect(() => {
    handlePanelResize?.(isEmpty(mergedList));
  }, [mergedList, handlePanelResize]);

  const feeds = useMemo(() => {
    return mergedList.map((item) =>
      item.type === 'activity' ? (
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
    );
  }, [
    mergedList,
    activeFeedId,
    hidePopover,
    isForFeedTab,
    showThread,
    isFullWidth,
    isFullSizeWidget,
    isFeedWidget,
    handlePanelResize,
    onActivityClick,
    onFeedClick,
    onAfterClose,
    onUpdateEntityDetails,
  ]);
  if (isLoading) {
    return <Loader />;
  }

  const hasNoData = isEmpty(mergedList);

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
